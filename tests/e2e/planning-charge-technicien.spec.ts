import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import {
  cleJour,
  instantDuJour,
  jourDe,
  maintenant,
} from "@/lib/calendar/fuseau";
import { lundiDeLaSemaine } from "@/lib/calendar/semaine";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * PG-C4-CHARGE (28/09/2026) — LES TROIS ÉTATS DE LA COLONNE COMPACTE.
 *
 * SA PROPRE SCÈNE, préfixée `PGC4-` — jamais `SCENE.*`, jamais les
 * techniciens de démonstration (`guerin@`, `poigoune@`) : une autre épreuve,
 * en parallèle, pourrait compter leur semaine (piège connu du lot).
 *
 * Trois techniciens forgés, un par état :
 * - ZÉRO : actif, rattaché à une agence SEMÉE (calendrier connu), AUCUNE
 *   intervention cette semaine → « 0 % ».
 * - INCOMPLET : une intervention cette semaine, SANS DURÉE (ni temps validé,
 *   ni estimation) → « ≥ N % ».
 * - SANS CALENDRIER : rattaché à une agence FORGÉE PAR CE FICHIER, sans
 *   `calendrier_id` — aucune agence semée n'en manque — et aucune
 *   intervention → « — ».
 */
test.describe.configure({ mode: "serial" });

const SOCIETE_CODE = "CODIMA-NC";
const PREFIXE = "PGC4-";

const NOM_ZERO = `${PREFIXE}Zéro (épreuve PG-C4-CHARGE)`;
const NOM_INCOMPLET = `${PREFIXE}Incomplet (épreuve PG-C4-CHARGE)`;
const NOM_SANS_CALENDRIER = `${PREFIXE}SansCalendrier (épreuve PG-C4-CHARGE)`;

const utilisateurZero = randomUUID();
const utilisateurSocieteZero = randomUUID();
const technicienZero = randomUUID();

const utilisateurIncomplet = randomUUID();
const utilisateurSocieteIncomplet = randomUUID();
const technicienIncomplet = randomUUID();
const clientIncomplet = randomUUID();
const siteIncomplet = randomUUID();
const interventionIncomplete = randomUUID();

const agenceSansCalendrier = randomUUID();
const utilisateurSansCalendrier = randomUUID();
const utilisateurSocieteSansCalendrier = randomUUID();
const technicienSansCalendrier = randomUUID();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.intervention.deleteMany({
    where: { id: { in: [interventionIncomplete] } },
  });
  await client.site.deleteMany({ where: { id: siteIncomplet } });
  await client.client.deleteMany({ where: { id: clientIncomplet } });
  await client.technicien.deleteMany({
    where: {
      id: {
        in: [technicienZero, technicienIncomplet, technicienSansCalendrier],
      },
    },
  });
  await client.utilisateurSociete.deleteMany({
    where: {
      id: {
        in: [
          utilisateurSocieteZero,
          utilisateurSocieteIncomplet,
          utilisateurSocieteSansCalendrier,
        ],
      },
    },
  });
  await client.utilisateur.deleteMany({
    where: {
      id: {
        in: [utilisateurZero, utilisateurIncomplet, utilisateurSansCalendrier],
      },
    },
  });
  await client.agence.deleteMany({ where: { id: agenceSansCalendrier } });
}

let semaineCourante = "";

test.beforeAll(async () => {
  const client = admin();
  try {
    await nettoyer(client);
    const societe = await client.societe.findFirstOrThrow({
      where: { code: SOCIETE_CODE },
      select: { id: true, fuseau_horaire: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id, calendrier_id: { not: null } },
      select: { id: true },
      orderBy: { code: "asc" },
    });

    const lundi = lundiDeLaSemaine(
      jourDe(maintenant(societe.fuseau_horaire).local),
    );
    semaineCourante = cleJour(lundi);
    const dateDuJour = instantDuJour(lundi);

    // ── ZÉRO : rattaché à l'agence SEMÉE, aucune intervention ────────────
    await client.utilisateur.create({
      data: {
        id: utilisateurZero,
        nom: NOM_ZERO,
        email: "pgc4-zero@codiplan.test",
      },
    });
    await client.utilisateurSociete.create({
      data: {
        id: utilisateurSocieteZero,
        utilisateur_id: utilisateurZero,
        societe_id: societe.id,
        role: Role.technicien,
      },
    });
    await client.technicien.create({
      data: {
        id: technicienZero,
        societe_id: societe.id,
        utilisateur_id: utilisateurZero,
        agence_id: agence.id,
        actif: true,
      },
    });

    // ── INCOMPLET : une intervention cette semaine, sans durée ───────────
    await client.utilisateur.create({
      data: {
        id: utilisateurIncomplet,
        nom: NOM_INCOMPLET,
        email: "pgc4-incomplet@codiplan.test",
      },
    });
    await client.utilisateurSociete.create({
      data: {
        id: utilisateurSocieteIncomplet,
        utilisateur_id: utilisateurIncomplet,
        societe_id: societe.id,
        role: Role.technicien,
      },
    });
    await client.technicien.create({
      data: {
        id: technicienIncomplet,
        societe_id: societe.id,
        utilisateur_id: utilisateurIncomplet,
        agence_id: agence.id,
        actif: true,
      },
    });
    await client.client.create({
      data: {
        id: clientIncomplet,
        societe_id: societe.id,
        raison_sociale: `${PREFIXE}Client`,
      },
    });
    await client.site.create({
      data: {
        id: siteIncomplet,
        societe_id: societe.id,
        client_id: clientIncomplet,
        agence_id: agence.id,
        libelle: `${PREFIXE}Site`,
      },
    });
    await client.intervention.create({
      data: {
        id: interventionIncomplete,
        societe_id: societe.id,
        agence_id: agence.id,
        client_id: clientIncomplet,
        site_id: siteIncomplet,
        // LE TECHNICIEN AFFECTÉ EST UNE IDENTITÉ (`utilisateur.id`), JAMAIS
        // `technicien.id` — `lib/interventions/personnes.ts` unit les deux
        // sources (référentiel et interventions) dans le MÊME espace
        // d'identifiants ; `technicien.id` n'y appartient pas.
        technicien_id: utilisateurIncomplet,
        type: "curatif",
        priorite: "p3",
        statut: "terminee",
        date_planifiee: dateDuJour,
        // NI temps_valide_min NI duree_estimee_min : c'est ce couple qui
        // rend `sansDuree > 0`, et donc « ≥ N % » plutôt qu'un chiffre nu.
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
      },
    });

    // ── SANS CALENDRIER : une agence FORGÉE, sans `calendrier_id` ────────
    await client.agence.create({
      data: {
        id: agenceSansCalendrier,
        societe_id: societe.id,
        code: `${PREFIXE}SANSCAL`,
        libelle: `${PREFIXE}SANSCAL`,
        territoire: "NC",
        actif: true,
      },
    });
    await client.utilisateur.create({
      data: {
        id: utilisateurSansCalendrier,
        nom: NOM_SANS_CALENDRIER,
        email: "pgc4-sanscalendrier@codiplan.test",
      },
    });
    await client.utilisateurSociete.create({
      data: {
        id: utilisateurSocieteSansCalendrier,
        utilisateur_id: utilisateurSansCalendrier,
        societe_id: societe.id,
        role: Role.technicien,
      },
    });
    await client.technicien.create({
      data: {
        id: technicienSansCalendrier,
        societe_id: societe.id,
        utilisateur_id: utilisateurSansCalendrier,
        agence_id: agenceSansCalendrier,
        actif: true,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await nettoyer(client);
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("un technicien actif sans intervention cette semaine affiche 0 %, jamais rien", async ({
  page,
}) => {
  await page.goto(`/planning?vue=semaine&semaine=${semaineCourante}`);
  await expect(page.locator("main")).toBeVisible();

  const ligne = page.locator("tr", { hasText: NOM_ZERO });
  await expect(ligne).toBeVisible();
  // UN CHIFFRE, PAS « — » NI « ≥ » : ni l'incertitude du calendrier inconnu,
  // ni le plancher d'une durée manquante — les deux AUTRES états que ce
  // fichier éprouve, jamais celui-ci.
  await expect(ligne).toContainText(fr["statistiques.pourcent"]);
  await expect(ligne).not.toContainText(
    fr["statistiques.taux_compact_inconnu"],
  );
  await expect(ligne).not.toContainText(
    fr["statistiques.taux_compact_au_moins_signe"],
  );
});

test("une intervention sans durée fait afficher « ≥ N % », jamais le chiffre nu", async ({
  page,
}) => {
  await page.goto(`/planning?vue=semaine&semaine=${semaineCourante}`);
  await expect(page.locator("main")).toBeVisible();

  const ligne = page.locator("tr", { hasText: NOM_INCOMPLET });
  await expect(ligne).toBeVisible();
  await expect(ligne).toContainText(
    fr["statistiques.taux_compact_au_moins_signe"],
  );
  await expect(ligne).toContainText(fr["statistiques.pourcent"]);
});

test("un technicien dont l'agence n'a pas de calendrier affiche « — », jamais 0 %", async ({
  page,
}) => {
  await page.goto(`/planning?vue=semaine&semaine=${semaineCourante}`);
  await expect(page.locator("main")).toBeVisible();

  const ligne = page.locator("tr", { hasText: NOM_SANS_CALENDRIER });
  await expect(ligne).toBeVisible();
  await expect(ligne).toContainText(fr["statistiques.taux_compact_inconnu"]);
  // JAMAIS DE POURCENTAGE DU TOUT : « pas de calendrier » n'est pas « 0 % »
  // (D56) — l'absence du signe « % » sur cette ligne EST l'assertion, pas
  // seulement l'absence d'un chiffre précis.
  await expect(ligne).not.toContainText(fr["statistiques.pourcent"]);
});

/* ── 9BJA-REPRISE-9BJ, POINT 4c — LA BARRE PAR JOUR DANS LES CASES ───────── */

test("un technicien avec calendrier connu porte une barre de charge dans chaque case de sa semaine", async ({
  page,
}) => {
  await page.goto(`/planning?vue=semaine&semaine=${semaineCourante}`);
  await expect(page.locator("main")).toBeVisible();

  const casesZero = page.locator(
    `[data-depot-technicien="${utilisateurZero}"]`,
  );
  await expect(casesZero).not.toHaveCount(0);
  const nombreDeCases = await casesZero.count();
  for (let i = 0; i < nombreDeCases; i++) {
    await expect(
      casesZero.nth(i).locator("[data-barre-charge-jour]"),
    ).toHaveCount(1);
  }
});

test("un technicien SANS calendrier ne porte AUCUNE barre de charge — rien à comparer", async ({
  page,
}) => {
  await page.goto(`/planning?vue=semaine&semaine=${semaineCourante}`);
  await expect(page.locator("main")).toBeVisible();

  const casesSansCalendrier = page.locator(
    `[data-depot-technicien="${utilisateurSansCalendrier}"]`,
  );
  await expect(casesSansCalendrier).not.toHaveCount(0);
  const nombreDeCases = await casesSansCalendrier.count();
  for (let i = 0; i < nombreDeCases; i++) {
    await expect(
      casesSansCalendrier.nth(i).locator("[data-barre-charge-jour]"),
    ).toHaveCount(0);
  }
});
