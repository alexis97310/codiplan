import { existsSync, readFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { chargerCalendrierAgence } from "@/lib/calendar/agence";
import { jourDe, jourSuivant, maintenant } from "@/lib/calendar/fuseau";
import { prochainJourOuvert, type Calendrier } from "@/lib/calendar";
import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { FICHIER_COURRIELS_CAPTURES } from "./setup/courriel-captures";
import { reperesDeLaScene } from "./setup/reperes";
import { cleDeJour } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9CP-PG-G14B-TRANSMETTRE-GROUPE (02/10/2026) — « TRANSMETTRE DEMAIN » ET
 * « TRANSMETTRE TOUTES LES PLANIFIÉES PRÊTES », DE BOUT EN BOUT.
 *
 * ## CE QUE LES TESTS UNITAIRES ET D'ISOLATION NE PEUVENT PAS PROUVER
 *
 * `tests/unit/interventions/cycle-de-vie.test.ts` éprouve le tri pur ;
 * `tests/isolation/transmission-groupee.test.ts` et
 * `avertissements-transmission-groupee.test.ts` éprouvent le dépôt et le
 * courriel par appel direct. Aucun des deux ne prouve qu'un geste RÉEL sur
 * l'écran — cocher deux interventions dans le dialogue, cliquer
 * « Transmettre la sélection » — fait effectivement passer les statuts et
 * partir UN courriel par technicien. C'est ce que ce fichier joue, à travers
 * l'écran.
 *
 * ## « DEMAIN » EST CALCULÉ PAR UN ORACLE, JAMAIS FIGÉ
 *
 * Même patron que `planning-filtres-aujourdhui.spec.ts` : `demain` n'est pas
 * un décalage fixe depuis `reperes.lundi` (ce que ce ticket transmet dépend
 * du JOUR OÙ L'ÉPREUVE TOURNE, pas d'un jour de semaine particulier) — c'est
 * la MÊME fonction pure (`prochainJourOuvert`), sur les MÊMES calendriers que
 * la page charge (`chargerCalendrierAgence`), à partir de J+1.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `PGG14B-`
 *
 * Créée en `beforeAll`, supprimée en `afterAll` — AUCUNE ligne au semis. Les
 * deux techniciens (Ducos, Kone) sont des identités DU SEMIS, en LECTURE
 * SEULE : ce scénario ne touche à rien qui leur appartient d'autre que les
 * lignes qu'il forge lui-même.
 *
 * ## LE COURRIEL EST DOUBLÉ, AU NIVEAU DU SERVEUR
 *
 * Même double que `pg-g14a-transmettre.spec.ts` —
 * `tests/e2e/setup/double-courriel.cjs`.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_ID = uuidv7();
const SITE_DUCOS_ID = uuidv7();
const SITE_KONE_ID = uuidv7();

const PRETE_DUCOS_1 = uuidv7();
const PRETE_DUCOS_2 = uuidv7();
const PRETE_KONE = uuidv7();
const LAISSEE = uuidv7();

let societeId = "";
let agenceDucosId = "";
let agenceKoneId = "";
let technicienDucosId = "";
let technicienKoneId = "";
let emailTechnicienDucos = "";
let emailTechnicienKone = "";
let demainCle = "";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

function courrielsCaptures(): Array<{
  to: readonly string[];
  subject: string;
  text: string;
}> {
  if (!existsSync(FICHIER_COURRIELS_CAPTURES)) {
    return [];
  }
  return readFileSync(FICHIER_COURRIELS_CAPTURES, "utf8")
    .split("\n")
    .filter((ligne) => ligne.trim().length > 0)
    .map(
      (ligne) =>
        JSON.parse(ligne) as {
          to: readonly string[];
          subject: string;
          text: string;
        },
    );
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;
  technicienDucosId = reperes.technicienDucos;
  technicienKoneId = reperes.technicienKone;

  const client = admin();
  try {
    const [ducos, kone, utilisateurDucos, utilisateurKone] = await Promise.all([
      client.agence.findFirstOrThrow({
        where: { societe_id: societeId, code: "DUCOS" },
        select: { id: true },
      }),
      client.agence.findFirstOrThrow({
        where: { societe_id: societeId, code: "KONE" },
        select: { id: true },
      }),
      client.utilisateur.findFirstOrThrow({
        where: { id: technicienDucosId },
        select: { email: true },
      }),
      client.utilisateur.findFirstOrThrow({
        where: { id: technicienKoneId },
        select: { email: true },
      }),
    ]);
    agenceDucosId = ducos.id;
    agenceKoneId = kone.id;
    emailTechnicienDucos = utilisateurDucos.email;
    emailTechnicienKone = utilisateurKone.email;

    // ── L'ORACLE : LE MÊME « DEMAIN » QUE LA PAGE CALCULE ──────────────────
    const aujourdhui = jourDe(maintenant(reperes.fuseau).local);
    const fenetre = {
      du: jourSuivant(aujourdhui),
      au: jourSuivant(aujourdhui, 16),
    };
    const agences = await client.agence.findMany({
      where: { societe_id: societeId },
      select: { id: true },
    });
    const calendriers = (
      await Promise.all(
        agences.map((agence) =>
          chargerCalendrierAgence(client, {
            societeId,
            agenceId: agence.id,
            fenetre,
          }),
        ),
      )
    ).filter((c): c is Calendrier => c !== null);
    const demain = prochainJourOuvert(calendriers, fenetre.du);
    demainCle = cleDeJour(demain);

    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: societeId,
        raison_sociale: "PGG14B — client",
        actif: true,
      },
    });
    await client.site.createMany({
      data: [
        {
          id: SITE_DUCOS_ID,
          societe_id: societeId,
          client_id: CLIENT_ID,
          agence_id: agenceDucosId,
          libelle: "PGG14B — site Ducos",
        },
        {
          id: SITE_KONE_ID,
          societe_id: societeId,
          client_id: CLIENT_ID,
          agence_id: agenceKoneId,
          libelle: "PGG14B — site Koné",
        },
      ],
    });

    const planifieePrete = (
      id: string,
      agenceId: string,
      siteId: string,
      technicienId: string,
      heure: string,
    ) => ({
      id,
      societe_id: societeId,
      agence_id: agenceId,
      client_id: CLIENT_ID,
      site_id: siteId,
      technicien_id: technicienId,
      type: "curatif" as const,
      priorite: "p3" as const,
      statut: "planifiee" as const,
      date_planifiee: new Date(`${demainCle}T00:00:00.000Z`),
      creneau_debut: new Date(`${demainCle}T${heure}:00.000Z`),
      creneau_fin: new Date(`${demainCle}T${heure}:00.000Z`),
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe" as const,
      devise_code: "XPF",
      description: "PGG14B — intervention forgée par l'épreuve",
    });
    await client.intervention.createMany({
      data: [
        planifieePrete(
          PRETE_DUCOS_1,
          agenceDucosId,
          SITE_DUCOS_ID,
          technicienDucosId,
          "08:00",
        ),
        planifieePrete(
          PRETE_DUCOS_2,
          agenceDucosId,
          SITE_DUCOS_ID,
          technicienDucosId,
          "09:00",
        ),
        planifieePrete(
          PRETE_KONE,
          agenceKoneId,
          SITE_KONE_ID,
          technicienKoneId,
          "08:00",
        ),
      ],
    });
    // LA LAISSÉE — sans technicien ni heure, une durée posée (la contrainte
    // `intervention_planifiee_a_sa_duree` reste vérifiée à l'écriture, voir
    // `tests/isolation/transmission-groupee.test.ts`) : deux motifs à la
    // fois, « sans_technicien » et « sans_heure ».
    await client.intervention.create({
      data: {
        id: LAISSEE,
        societe_id: societeId,
        agence_id: agenceDucosId,
        client_id: CLIENT_ID,
        site_id: SITE_DUCOS_ID,
        technicien_id: null,
        type: "curatif",
        priorite: "p3",
        statut: "planifiee",
        date_planifiee: new Date(`${demainCle}T00:00:00.000Z`),
        creneau_debut: null,
        creneau_fin: null,
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "PGG14B — laissée, forgée par l'épreuve",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.intervention.deleteMany({
      where: {
        id: { in: [PRETE_DUCOS_1, PRETE_DUCOS_2, PRETE_KONE, LAISSEE] },
      },
    });
    await client.site.deleteMany({
      where: { id: { in: [SITE_DUCOS_ID, SITE_KONE_ID] } },
    });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

test("« Transmettre demain » coche une sélection partielle, transmet UNIQUEMENT ce qui est coché, UN courriel par technicien", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/planning");

  const boutonDemain = page.getByRole("button", {
    name: new RegExp(`^${fr["planning.transmettre_demain"]} `),
  });
  await expect(boutonDemain).toBeVisible();

  const avantDucos = courrielsCaptures().filter((e) =>
    e.to.includes(emailTechnicienDucos),
  ).length;
  const avantKone = courrielsCaptures().filter((e) =>
    e.to.includes(emailTechnicienKone),
  ).length;

  await boutonDemain.click();
  const dialogue = page.locator("dialog[open]");
  await expect(dialogue).toBeVisible();

  // LES TROIS PRÊTES ONT UNE CASE ; LA LAISSÉE N'EN A AUCUNE.
  await expect(
    dialogue.locator(`input[type="checkbox"][value="${PRETE_DUCOS_1}"]`),
  ).toHaveCount(1);
  await expect(
    dialogue.locator(`input[type="checkbox"][value="${PRETE_DUCOS_2}"]`),
  ).toHaveCount(1);
  await expect(
    dialogue.locator(`input[type="checkbox"][value="${PRETE_KONE}"]`),
  ).toHaveCount(1);
  await expect(
    dialogue.locator(`input[type="checkbox"][value="${LAISSEE}"]`),
  ).toHaveCount(0);
  // AUCUNE CASE N'EST COCHÉE D'AVANCE (choix du pilote).
  await expect(
    dialogue.locator(`input[type="checkbox"][value="${PRETE_DUCOS_1}"]`),
  ).not.toBeChecked();
  // LA LAISSÉE EST NOMMÉE, AVEC UN LIEN VERS SA FICHE.
  await expect(
    dialogue.locator(`a[href="/interventions/${LAISSEE}"]`),
  ).toBeVisible();

  // SÉLECTION PARTIELLE — PRETE_DUCOS_2 reste délibérément décochée.
  await dialogue
    .locator(`input[type="checkbox"][value="${PRETE_DUCOS_1}"]`)
    .check();
  await dialogue
    .locator(`input[type="checkbox"][value="${PRETE_KONE}"]`)
    .check();
  await dialogue
    .getByRole("button", {
      name: fr["planning.transmettre_demain.transmettre_la_selection"],
    })
    .click();
  await page.waitForLoadState("networkidle");

  // LE COMPTE-RENDU, SUR LA PAGE RECHARGÉE.
  await expect(page.locator("[data-compte-rendu-transmission]")).toBeVisible();

  // LES DEUX COCHÉES SONT AFFECTÉES ; LA TROISIÈME PRÊTE RESTE PLANIFIÉE.
  await page.goto(`/interventions/${PRETE_DUCOS_1}`);
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.affectee"]),
  ).toBeVisible();
  await page.goto(`/interventions/${PRETE_KONE}`);
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.affectee"]),
  ).toBeVisible();
  await page.goto(`/interventions/${PRETE_DUCOS_2}`);
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.planifiee"]),
  ).toBeVisible();

  // UN COURRIEL RÉCAPITULATIF PAR TECHNICIEN — PAS UN PAR INTERVENTION.
  const apresDucos = courrielsCaptures().filter((e) =>
    e.to.includes(emailTechnicienDucos),
  );
  const apresKone = courrielsCaptures().filter((e) =>
    e.to.includes(emailTechnicienKone),
  );
  expect(apresDucos.length).toBe(avantDucos + 1);
  expect(apresKone.length).toBe(avantKone + 1);
  expect(apresDucos.at(-1)?.subject).toBe(
    "CODIPLAN — Interventions transmises (1)",
  );
  expect(apresKone.at(-1)?.subject).toBe(
    "CODIPLAN — Interventions transmises (1)",
  );
});

test("« Transmettre toutes les planifiées prêtes » : l'épreuve lit la confirmation et REVIENT, sans jamais confirmer", async ({
  page,
}) => {
  // La seule prête restante de la scène forgée, après le test précédent.
  await ouvrirUneSession(page);
  await page.goto("/planning");

  const boutonToutes = page.getByRole("button", {
    name: new RegExp(
      `^${fr["planning.transmettre_toutes_les_planifiees_pretes"]} `,
    ),
  });
  await expect(boutonToutes).toBeVisible();

  const avant = courrielsCaptures().length;
  await boutonToutes.click();

  const dialogue = page.locator("dialog[open]");
  await expect(dialogue).toBeVisible();
  // `<p>`, jamais `getByText` sur tout le dialogue : le bouton de
  // confirmation porte lui-même le même mot « Transmettre ».
  await expect(dialogue.locator("p")).toContainText(
    fr["planning.transmission.confirmer_toutes_prefixe"],
  );

  // JAMAIS DE CONFIRMATION — cela écrirait la scène partagée (toutes les
  // planifiées prêtes de TOUTE la société, pas seulement celles de ce
  // fichier). L'exécution réelle est prouvée par
  // `tests/isolation/transmission-groupee.test.ts`.
  await dialogue
    .getByRole("button", { name: fr["planning.transmission.revenir"] })
    .click();
  await expect(dialogue).toBeHidden();

  await page.goto(`/interventions/${PRETE_DUCOS_2}`);
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.planifiee"]),
  ).toBeVisible();
  expect(courrielsCaptures().length).toBe(avant);
});
