import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { referenceAffichee } from "@/app/(back-office)/interventions/presentation";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 59-ABSENCES-2 — L'APERÇU AVANT LA POSE (SAV-12).
 *
 * ## Ce que les épreuves unitaires et d'isolation ne peuvent pas prouver
 *
 * `tests/isolation/absences-2.test.ts` éprouve que `apercuAbsence` ne
 * traverse aucune société. Ni lui ni aucune épreuve unitaire ne prouvent que
 * l'ÉCRAN affiche bien un bouton « Voir l'impact » AVANT la pose, que le
 * message rendu nomme EXACTEMENT les interventions que `apercuAbsence` a
 * désignées, que la saisie reste sous les yeux entre les deux étapes, et que
 * la pose qui suit rend EXACTEMENT ce que l'aperçu avait annoncé.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `ABS2-` — jamais `tests/e2e/setup/scene.ts`
 *
 * Un technicien FORGÉ — aucun des techniciens du semis, partagés avec
 * `tests/e2e/blocage-agenda-visible.spec.ts` et les scénarios de
 * glisser-déposer —, un client et un site à soi, et QUATRE interventions :
 * trois DANS la période visée, une hors. Sous `fullyParallel`, un technicien
 * partagé serait faussé par ce qu'un autre fichier lui pose pendant que
 * celui-ci mesure (§9, même piège que `blocage-agenda-visible.spec.ts`).
 *
 * **Les identifiants sont engendrés par `uuidv7()`, jamais écrits en dur** —
 * y compris ceux des quatre interventions. Le gardien L0-11
 * (`tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`) résout un identifiant
 * jusqu'à la CONSTANTE LITTÉRALE qui l'a défini, et ce fichier compare le
 * texte rendu à la référence `Local-<6 caractères>` que ces identifiants
 * produisent (I10) : un `const INTERVENTION_1 = "…"` littéral aurait fait
 * rougir le gardien dès qu'il atteint `toContainText`, la RÉFÉRENCE affichée
 * n'étant jamais qu'une lecture de l'identifiant. Engendré à l'exécution, un
 * identifiant n'est plus une constante que le gardien puisse résoudre — comme
 * `interventionId = uuidv7()` dans `tests/isolation/absence.test.ts`.
 *
 * La PÉRIODE visée — 14 au 18 janvier 2030 — est fixée loin dans le futur :
 * aucun autre scénario ne date une intervention ou un blocage à cette
 * distance, et `/absences` n'a pas besoin de sa fenêtre par défaut pour ce
 * que ce fichier mesure (`apercuAbsence` et la pose ne sont pas bornées par
 * elle — seuls le calendrier et le tableau de `/absences` le sont).
 */

// SÉRIEL, pour la même raison que `registre-1.spec.ts` : `beforeAll`/`afterAll`
// de Playwright s'exécutent une fois PAR WORKER sous `fullyParallel`, et deux
// workers écrivant puis effaçant la même scène se feraient la course. L'ORDRE
// DES ÉPREUVES COMPTE AUSSI ICI : celle qui confirme la pose déplanifie les
// interventions que l'épreuve de capture doit encore trouver « à venir » —
// elle est donc écrite AVANT.
test.describe.configure({ mode: "serial" });

const SOCIETE_CODE = "CODIMA-NC";

let utilisateurAbs2 = "";
let utilisateurSocieteAbs2 = "";
let technicienAbs2 = "";
let clientAbs2 = "";
let siteAbs2 = "";

let intervention1 = "";
let intervention2 = "";
let intervention3 = "";
let interventionHors = "";

const DU = "2030-01-14";
const AU = "2030-01-18";
const HORS_PERIODE = new Date("2030-01-20T00:00:00.000Z");

/** La référence affichée, LUE depuis la même fonction que l'écran (I10). */
function reference(id: string): string {
  return referenceAffichee({ id, numero: null });
}

async function nouveauClientAdministration(): Promise<PrismaClient> {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function effacerLaScene(): Promise<void> {
  if (utilisateurAbs2 === "") {
    return;
  }
  const client = await nouveauClientAdministration();
  try {
    await client.absence.deleteMany({
      where: { utilisateur_id: utilisateurAbs2 },
    });
    await client.intervention.deleteMany({
      where: {
        id: {
          in: [intervention1, intervention2, intervention3, interventionHors],
        },
      },
    });
    await client.site.deleteMany({ where: { id: siteAbs2 } });
    await client.client.deleteMany({ where: { id: clientAbs2 } });
    await client.technicien.deleteMany({ where: { id: technicienAbs2 } });
    await client.utilisateurSociete.deleteMany({
      where: { id: utilisateurSocieteAbs2 },
    });
    await client.utilisateur.deleteMany({ where: { id: utilisateurAbs2 } });
  } finally {
    await client.$disconnect();
  }
}

async function ecrireLaScene(): Promise<void> {
  utilisateurAbs2 = uuidv7();
  utilisateurSocieteAbs2 = uuidv7();
  technicienAbs2 = uuidv7();
  clientAbs2 = uuidv7();
  siteAbs2 = uuidv7();
  intervention1 = uuidv7();
  intervention2 = uuidv7();
  intervention3 = uuidv7();
  interventionHors = uuidv7();

  const client = await nouveauClientAdministration();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: SOCIETE_CODE },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });

    // Le technicien forgé — une identité, un rattachement à la société
    // (`utilisateur_societe`, dont `absence` dépend, D48), un rattachement à
    // une agence (`technicien`, actif).
    await client.utilisateur.create({
      data: {
        id: utilisateurAbs2,
        nom: "Technicien ABS2- (épreuve ABSENCES-2)",
        email: "abs2-technicien@codiplan.test",
      },
    });
    await client.utilisateurSociete.create({
      data: {
        id: utilisateurSocieteAbs2,
        utilisateur_id: utilisateurAbs2,
        societe_id: societe.id,
        role: Role.technicien,
      },
    });
    await client.technicien.create({
      data: {
        id: technicienAbs2,
        societe_id: societe.id,
        utilisateur_id: utilisateurAbs2,
        agence_id: agence.id,
        actif: true,
      },
    });

    await client.client.create({
      data: {
        id: clientAbs2,
        societe_id: societe.id,
        raison_sociale: "Client ABS2- (épreuve ABSENCES-2)",
      },
    });
    await client.site.create({
      data: {
        id: siteAbs2,
        societe_id: societe.id,
        client_id: clientAbs2,
        agence_id: agence.id,
        libelle: "Lieu ABS2- (épreuve ABSENCES-2)",
        temps_trajet_min: 10,
      },
    });

    const base = {
      societe_id: societe.id,
      agence_id: agence.id,
      client_id: clientAbs2,
      site_id: siteAbs2,
      technicien_id: utilisateurAbs2,
      type: "curatif" as const,
      priorite: "p3" as const,
      statut: "planifiee" as const,
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe" as const,
      devise_code: "XPF",
    };

    // TROIS interventions DANS la période — le premier jour, un jour
    // intermédiaire, le dernier jour (les bornes sont comprises, RG-PLA-06).
    await client.intervention.create({
      data: {
        id: intervention1,
        ...base,
        date_planifiee: new Date(`${DU}T00:00:00.000Z`),
      },
    });
    await client.intervention.create({
      data: {
        id: intervention2,
        ...base,
        date_planifiee: new Date("2030-01-16T00:00:00.000Z"),
      },
    });
    await client.intervention.create({
      data: {
        id: intervention3,
        ...base,
        date_planifiee: new Date(`${AU}T00:00:00.000Z`),
      },
    });
    // UNE intervention HORS période — le témoin qui ne doit jamais bouger.
    await client.intervention.create({
      data: { id: interventionHors, ...base, date_planifiee: HORS_PERIODE },
    });

    const enBase = await client.intervention.count({
      where: {
        id: {
          in: [intervention1, intervention2, intervention3, interventionHors],
        },
      },
    });
    expect(enBase).toBe(4);
  } finally {
    await client.$disconnect();
  }
}

test.beforeAll(ecrireLaScene);
test.afterAll(effacerLaScene);

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

/** Remplit le formulaire de blocage et clique « Voir l'impact ». */
async function demanderLApercu(page: Page): Promise<void> {
  await page.goto("/absences");
  await page.locator("#absence-personne").selectOption(utilisateurAbs2);
  await page.locator("#absence-du").fill(DU);
  await page.locator("#absence-au").fill(AU);
  await page
    .getByRole("button", { name: fr["absences.apercu_action"] })
    .click();
  await page.waitForLoadState("networkidle");
}

test("« Voir l'impact » annonce exactement les 3 interventions de la période, rien n'a encore changé", async ({
  page,
}) => {
  await demanderLApercu(page);

  await expect(page).toHaveURL(/\/absences\?apercu=1/);

  // LE PANNEAU D'APERÇU — le seul `role="status"` de la page à ce stade :
  // aucun `motif`, aucune retombée `rendues`/`rompues` dans l'URL.
  const panneau = page.getByRole("status");
  await expect(panneau).toHaveCount(1);
  await expect(panneau).toContainText(reference(intervention1));
  await expect(panneau).toContainText(reference(intervention2));
  await expect(panneau).toContainText(reference(intervention3));
  // LE TÉMOIN — la 4e, hors période, n'est jamais nommée.
  await expect(panneau).not.toContainText(reference(interventionHors));

  // Les valeurs saisies restent sous les yeux.
  await expect(page.locator("#absence-personne")).toHaveValue(utilisateurAbs2);
  await expect(page.locator("#absence-du")).toHaveValue(DU);
  await expect(page.locator("#absence-au")).toHaveValue(AU);

  // RIEN N'A ENCORE CHANGÉ EN BASE — le TÉMOIN qui rend ce scénario réel.
  const client = await nouveauClientAdministration();
  try {
    const lignes = await client.intervention.findMany({
      where: {
        id: {
          in: [intervention1, intervention2, intervention3, interventionHors],
        },
      },
      select: { id: true, date_planifiee: true, statut: true },
    });
    for (const ligne of lignes) {
      expect(ligne.date_planifiee).not.toBeNull();
      expect(ligne.statut).toBe("planifiee");
    }
    const absences = await client.absence.count({
      where: { utilisateur_id: utilisateurAbs2 },
    });
    expect(absences).toBe(0);
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/59-ABSENCES-2/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  for (const largeur of [375, 1280]) {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.screenshot({
      path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
      fullPage: true,
    });
  }
}

test("capture — l'étape d'aperçu, avant toute pose", async ({ page }) => {
  await demanderLApercu(page);
  await expect(page.getByRole("status")).toContainText(
    reference(intervention1),
  );
  await capturer(page, "apercu");
});

test("après confirmation, les mêmes 3 interventions sont rendues à la file, la 4e n'a pas bougé", async ({
  page,
}) => {
  await demanderLApercu(page);
  const panneau = page.getByRole("status");
  await expect(panneau).toContainText(reference(intervention1));

  // Le bouton qui poste vers `/api/absences/declarer`, avec les MÊMES
  // valeurs — portées par les champs cachés du panneau d'aperçu.
  await panneau
    .getByRole("button", { name: fr["absences.declarer_action"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveURL(/\/absences\?rendues=/);
  const rendues = page.getByRole("status").filter({
    hasText: fr["absences.rendues_titre"],
  });
  await expect(rendues).toContainText(reference(intervention1));
  await expect(rendues).toContainText(reference(intervention2));
  await expect(rendues).toContainText(reference(intervention3));
  await expect(rendues).not.toContainText(reference(interventionHors));

  const client = await nouveauClientAdministration();
  try {
    const dansLaPeriode = await client.intervention.findMany({
      where: { id: { in: [intervention1, intervention2, intervention3] } },
      select: {
        id: true,
        date_planifiee: true,
        statut: true,
        technicien_id: true,
      },
    });
    for (const ligne of dansLaPeriode) {
      // LA DATE ET LE CRÉNEAU PARTENT, LE TECHNICIEN RESTE (voir
      // `lib/absences/depot.ts`).
      expect(ligne.date_planifiee).toBeNull();
      expect(ligne.statut).toBe("a_planifier");
      expect(ligne.technicien_id).toBe(utilisateurAbs2);
    }

    // LE TÉMOIN — la 4e n'a pas bougé.
    const hors = await client.intervention.findFirstOrThrow({
      where: { id: interventionHors },
      select: { date_planifiee: true, statut: true },
    });
    expect(hors.date_planifiee).toEqual(HORS_PERIODE);
    expect(hors.statut).toBe("planifiee");

    const absence = await client.absence.findFirstOrThrow({
      where: { utilisateur_id: utilisateurAbs2 },
      select: { du: true, au: true },
    });
    expect(absence.du).toEqual(new Date(`${DU}T00:00:00.000Z`));
    expect(absence.au).toEqual(new Date(`${AU}T00:00:00.000Z`));
  } finally {
    await client.$disconnect();
  }
});
