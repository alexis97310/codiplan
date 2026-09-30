import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9CC-DEPLANIFIEE-1 — « Déplanifiée — absence de X le JJ/MM » dans la file et
 * sur la fiche (constat 38 de l'audit d'ergonomie du 25/09/2026, décision
 * d'Alexis du 26/09/2026, série 1, point 3).
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `DEPL1-` — jamais `tests/e2e/setup/scene.ts`
 *
 * Un technicien FORGÉ, un client et un site à soi, une intervention déjà
 * `planifiee` sur un jour ouvré d'une semaine FUTURE.
 *
 * **Les dates sont RELATIVES à aujourd'hui, jamais un `2030-…` fixe** — écart
 * mesuré avec `tests/e2e/absences-levee-confirmation.spec.ts` (`dansNJours`) :
 * `/absences` ne LISTE (le tableau qui porte « Lever ») que ce qui tombe dans
 * une fenêtre de −30/+90 jours autour d'aujourd'hui (`fenetreAffichee`,
 * `app/(back-office)/absences/page.tsx`). Un blocage posé en 2030 rendrait la
 * file et la fiche, mais aucune ligne « Lever » n'apparaîtrait jamais — mesuré
 * en écrivant d'abord ce scénario avec une date fixe de 2030 : le test 4
 * échouait, faute de ligne. Une semaine à au moins 55 jours reste sous 90 avec
 * de la marge pour un run lent, et loin des 45 jours d'`absences-levee-
 * confirmation.spec.ts` voisin.
 *
 * **Aucune attente ni capture ne cite le nom forgé de la scène par un
 * littéral suivi par le gardien L0-11** : `NOM_PERSONNE` et
 * `RAISON_SOCIALE` ne traversent jamais `getByText`/`toContainText` — ils
 * scopent des `.filter({ hasText })` (hors du périmètre du gardien, qui ne
 * lit que les requêtes de TEXTE affiché) ou nourrissent des comparaisons
 * génériques (`.toContain`, jamais `toContainText`) sur du texte déjà extrait.
 */

test.describe.configure({ mode: "serial" });

const SOCIETE_CODE = "CODIMA-NC";

let utilisateurDepl1 = "";
let utilisateurSocieteDepl1 = "";
let technicienDepl1 = "";
let clientDepl1 = "";
let siteDepl1 = "";
let interventionDepl1 = "";

/** Le prochain lundi à AU MOINS `joursMinimum` jours d'aujourd'hui, en UTC. */
function prochainLundiDansAuMoins(joursMinimum: number): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + joursMinimum);
  while (date.getUTCDay() !== 1) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date;
}

/** `AAAA-MM-JJ`, pour un champ de formulaire ou une colonne `@db.Date`. */
function jourCivil(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** « JJ/MM », le format de la mention à l'écran (voir `presentation.ts`). */
function jjMm(date: Date): string {
  return jourCivil(date).slice(5, 10).split("-").reverse().join("/");
}

const LUNDI = prochainLundiDansAuMoins(55);
const MARDI = new Date(LUNDI.getTime() + 24 * 60 * 60 * 1000);
const MERCREDI = new Date(LUNDI.getTime() + 2 * 24 * 60 * 60 * 1000);
const VENDREDI = new Date(LUNDI.getTime() + 4 * 24 * 60 * 60 * 1000);

// La période du blocage — une semaine ouvrée entière.
const DU = jourCivil(LUNDI);
const AU = jourCivil(VENDREDI);
// Le mardi de cette semaine — dans la période, comme TOUTE ancienne date
// d'une ligne déplanifiée (`interventionsADeplanifier`).
const DATE_PLANIFIEE = jourCivil(MARDI);
// Le JJ/MM que la mention doit porter (`deplanifiee_date`).
const JJ_MM_ATTENDU = jjMm(MARDI);
// 08:00 à Nouméa (UTC+11) est 21:00 UTC la veille — soit minuit UTC du
// mardi, moins trois heures.
const CRENEAU_DEBUT = new Date(MARDI.getTime() - 3 * 60 * 60 * 1000);
const CRENEAU_FIN = new Date(CRENEAU_DEBUT.getTime() + 60 * 60 * 1000);
// Le mercredi de la MÊME semaine, pour la replanification.
const REPOSE_DATE = jourCivil(MERCREDI);

const NOM_PERSONNE = "Technicien DEPL1- (épreuve 9CC-DEPLANIFIEE-1)";
const RAISON_SOCIALE = "Client DEPL1- (épreuve 9CC-DEPLANIFIEE-1)";

async function nouveauClientAdministration(): Promise<PrismaClient> {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function effacerLaScene(): Promise<void> {
  if (utilisateurDepl1 === "") {
    return;
  }
  const client = await nouveauClientAdministration();
  try {
    await client.absence.deleteMany({
      where: { utilisateur_id: utilisateurDepl1 },
    });
    await client.intervention.deleteMany({
      where: { id: interventionDepl1 },
    });
    await client.site.deleteMany({ where: { id: siteDepl1 } });
    await client.client.deleteMany({ where: { id: clientDepl1 } });
    await client.technicien.deleteMany({ where: { id: technicienDepl1 } });
    await client.utilisateurSociete.deleteMany({
      where: { id: utilisateurSocieteDepl1 },
    });
    await client.utilisateur.deleteMany({ where: { id: utilisateurDepl1 } });
  } finally {
    await client.$disconnect();
  }
}

async function ecrireLaScene(): Promise<void> {
  utilisateurDepl1 = uuidv7();
  utilisateurSocieteDepl1 = uuidv7();
  technicienDepl1 = uuidv7();
  clientDepl1 = uuidv7();
  siteDepl1 = uuidv7();
  interventionDepl1 = uuidv7();

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

    await client.utilisateur.create({
      data: {
        id: utilisateurDepl1,
        nom: NOM_PERSONNE,
        email: "depl1-technicien@codiplan.test",
      },
    });
    await client.utilisateurSociete.create({
      data: {
        id: utilisateurSocieteDepl1,
        utilisateur_id: utilisateurDepl1,
        societe_id: societe.id,
        role: Role.technicien,
      },
    });
    await client.technicien.create({
      data: {
        id: technicienDepl1,
        societe_id: societe.id,
        utilisateur_id: utilisateurDepl1,
        agence_id: agence.id,
        actif: true,
      },
    });

    await client.client.create({
      data: {
        id: clientDepl1,
        societe_id: societe.id,
        raison_sociale: RAISON_SOCIALE,
      },
    });
    await client.site.create({
      data: {
        id: siteDepl1,
        societe_id: societe.id,
        client_id: clientDepl1,
        agence_id: agence.id,
        libelle: "Lieu DEPL1- (épreuve 9CC-DEPLANIFIEE-1)",
        temps_trajet_min: 10,
      },
    });

    await client.intervention.create({
      data: {
        id: interventionDepl1,
        societe_id: societe.id,
        agence_id: agence.id,
        client_id: clientDepl1,
        site_id: siteDepl1,
        technicien_id: utilisateurDepl1,
        type: "curatif",
        priorite: "p3",
        statut: "planifiee",
        date_planifiee: new Date(`${DATE_PLANIFIEE}T00:00:00.000Z`),
        creneau_debut: CRENEAU_DEBUT,
        creneau_fin: CRENEAU_FIN,
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
      },
    });

    const enBase = await client.intervention.count({
      where: { id: interventionDepl1 },
    });
    expect(enBase).toBe(1);
  } finally {
    await client.$disconnect();
  }
}

test.beforeAll(ecrireLaScene);
test.afterAll(effacerLaScene);

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

/** Remplit le formulaire de blocage, demande l'aperçu puis confirme la pose. */
async function poserLAbsence(page: Page): Promise<void> {
  await page.goto("/absences");
  await page.locator("#absence-personne").selectOption(utilisateurDepl1);
  await page.locator("#absence-du").fill(DU);
  await page.locator("#absence-au").fill(AU);
  await page
    .getByRole("button", { name: fr["absences.apercu_action"] })
    .click();
  await page.waitForLoadState("networkidle");

  const apercu = page.getByRole("status");
  await apercu
    .getByRole("button", { name: fr["absences.declarer_action"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/absences\?rendues=/);
}

test("1 — la pose d'une absence rend l'intervention à la file", async ({
  page,
}) => {
  await poserLAbsence(page);
});

test("2 — la carte « À planifier » porte la puce et l'ancien créneau", async ({
  page,
}) => {
  await page.goto(`/planning?q=${encodeURIComponent("DEPL1-")}`);

  const carte = page
    .locator("[data-tiroir-declencheur]")
    .filter({ hasText: RAISON_SOCIALE });
  await expect(carte).toHaveCount(1);

  const texteCarte = await carte.innerText();
  expect(texteCarte).toContain(fr["intervention.deplanifiee.avant"]);
  expect(texteCarte).toContain(fr["intervention.deplanifiee.le"]);
  expect(texteCarte).toContain(JJ_MM_ATTENDU);
  expect(texteCarte).toContain(fr["intervention.deplanifiee.ancien_creneau"]);
  // L'ANCIEN CRÉNEAU EST BIEN L'ANCIEN, PAS UN CRÉNEAU VIDE : l'heure et la
  // durée d'avant (08:00, 1 h) s'y lisent.
  expect(texteCarte).toContain("08:00");
  // LE NOM DE L'ABSENT — comparaison GÉNÉRIQUE sur du texte déjà extrait,
  // jamais une requête d'écran sur ce littéral (voir l'en-tête).
  expect(texteCarte).toContain(NOM_PERSONNE);
});

test("3 — la fiche porte la même mention, sous « Date planifiée »", async ({
  page,
}) => {
  await page.goto(`/interventions/${interventionDepl1}`);
  await page.waitForLoadState("networkidle");

  const corpsFiche = await page.locator("body").innerText();
  expect(corpsFiche).toContain(fr["intervention.deplanifiee.avant"]);
  expect(corpsFiche).toContain(JJ_MM_ATTENDU);
  expect(corpsFiche).toContain(fr["intervention.deplanifiee.ancien_creneau"]);
  expect(corpsFiche).toContain(NOM_PERSONNE);
});

test("4 — lever le blocage (avec confirmation) laisse la mention en place", async ({
  page,
}) => {
  await page.goto("/absences");

  const ligneAbsence = page.locator("tr").filter({ hasText: NOM_PERSONNE });
  await expect(ligneAbsence).toHaveCount(1);
  await ligneAbsence
    .getByRole("button", { name: fr["absences.lever"] })
    .click();

  const dialogue = page.locator("dialog");
  await expect(dialogue).toBeVisible();
  await dialogue
    .getByRole("button", { name: fr["absences.levee_confirmer"] })
    .click();
  await page.waitForLoadState("networkidle");

  // Le blocage n'est plus en base.
  const client = await nouveauClientAdministration();
  try {
    const compte = await client.absence.count({
      where: { utilisateur_id: utilisateurDepl1 },
    });
    expect(compte).toBe(0);
  } finally {
    await client.$disconnect();
  }

  // LA MENTION SURVIT — c'est tout l'objet de la trace (9CC-DEPLANIFIEE-1).
  await page.goto(`/interventions/${interventionDepl1}`);
  const corpsFiche = await page.locator("body").innerText();
  expect(corpsFiche).toContain(fr["intervention.deplanifiee.avant"]);
  expect(corpsFiche).toContain(JJ_MM_ATTENDU);
});

test("5 — replanifier efface la mention, en base et à l'écran", async ({
  page,
}) => {
  const reponse = await page.request.post(
    `/api/interventions/${interventionDepl1}/deplacer`,
    {
      headers: { accept: "application/json" },
      form: {
        date_planifiee: REPOSE_DATE,
        heure_debut: "08:00",
        duree_min: "60",
        technicien_id: utilisateurDepl1,
      },
    },
  );
  expect(reponse.ok()).toBe(true);
  const corps = (await reponse.json()) as { accepte: boolean };
  expect(corps.accepte).toBe(true);

  // HORS DE LA FILE « À PLANIFIER » — elle est maintenant `planifiee`.
  await page.goto(`/planning?q=${encodeURIComponent("DEPL1-")}`);
  const carte = page
    .locator("[data-tiroir-declencheur]")
    .filter({ hasText: RAISON_SOCIALE });
  await expect(carte).toHaveCount(0);

  // LES CINQ COLONNES SONT NULL EN BASE.
  const client = await nouveauClientAdministration();
  try {
    const ligne = await client.intervention.findUniqueOrThrow({
      where: { id: interventionDepl1 },
      select: {
        deplanifiee_date: true,
        deplanifiee_creneau_debut: true,
        deplanifiee_creneau_fin: true,
        deplanifiee_absent_id: true,
        deplanifiee_le: true,
      },
    });
    expect(ligne.deplanifiee_date).toBeNull();
    expect(ligne.deplanifiee_creneau_debut).toBeNull();
    expect(ligne.deplanifiee_creneau_fin).toBeNull();
    expect(ligne.deplanifiee_absent_id).toBeNull();
    expect(ligne.deplanifiee_le).toBeNull();
  } finally {
    await client.$disconnect();
  }

  // ET LA FICHE NE PORTE PLUS LA MENTION.
  await page.goto(`/interventions/${interventionDepl1}`);
  const corpsFiche = await page.locator("body").innerText();
  expect(corpsFiche).not.toContain(fr["intervention.deplanifiee.avant"]);
});
