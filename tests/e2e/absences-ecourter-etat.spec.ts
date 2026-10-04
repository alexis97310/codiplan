import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * 9DK-PG-G15A-ABSENCE-ECOURTER — QT-15 (état par ligne, Écourter/Supprimer),
 * QT-23 (tuile « Absents aujourd'hui »), QE-13e (4 semaines en bandes), TR-5
 * (un technicien déclare pour lui-même), MO-31 (lien depuis le planning).
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `ABSECO-` — jamais `tests/e2e/setup/scene.ts`
 *
 * Un technicien FORGÉ, directement en base (jamais de session à son nom :
 * `creerTechnicien`, lu dans son propre docblock, crée une IDENTITÉ, jamais
 * un ACCÈS — aucun `compte` de connexion n'existe pour une personne juste
 * forgée, et `reemettreJetonPremierAcces` le refuse explicitement). Le
 * scénario TR-5 se connecte donc avec `COMPTE_TECHNICIEN_EPREUVE`
 * (`garnier@codima.test`), le seul compte technicien du semis qui PEUT se
 * connecter — en LECTURE SEULE pour ce fichier comme pour les autres : aucune
 * absence n'est déclarée, écourtée ni supprimée pour ce compte, seules les
 * AFFORDANCES de l'écran sont vérifiées (QT-15/TR-5 sont déjà prouvées, en
 * écriture, par `tests/isolation/absence.test.ts`, describe « TR-5 »).
 *
 * TROIS absences, créées directement en base (jamais par le formulaire, hors
 * sujet ici) pour le technicien FORGÉ, une par état : TERMINÉE (−10 à −5
 * jours), EN COURS (−2 à +5 jours), À VENIR (+21 à +23 jours — dans la
 * fenêtre des 4 semaines suivantes de QE-13e). Toutes les trois sont
 * retirées en `afterAll`, que l'épreuve échoue ou non.
 */

test.describe.configure({ mode: "serial" });

const SOCIETE_CODE = "CODIMA-NC";
const NOM_PERSONNE = "Technicien ABSECO- (épreuve 9DK-PG-G15A)";
const EMAIL_PERSONNE = "abseco-technicien@codiplan.test";

let utilisateurAbseco = "";
let utilisateurSocieteAbseco = "";
let technicienAbseco = "";

let absenceTerminee = "";
let absenceEnCours = "";
let absenceAVenir = "";

/** `AAAA-MM-JJ`, civile UTC, à N jours d'aujourd'hui. */
function dansNJours(n: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

function dateCivile(aaaammjj: string): Date {
  return new Date(`${aaaammjj}T00:00:00.000Z`);
}

/** `AAAA-MM-JJ` du prochain lundi (ou aujourd'hui, si c'est déjà un lundi). */
function cleDuProchainLundi(): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  const jour = date.getUTCDay();
  const ecart = jour === 1 ? 0 : jour === 0 ? 1 : 8 - jour;
  date.setUTCDate(date.getUTCDate() + ecart);
  return date.toISOString().slice(0, 10);
}

async function nouveauClientAdministration(): Promise<PrismaClient> {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function effacerLaScene(): Promise<void> {
  if (utilisateurAbseco === "") {
    return;
  }
  const client = await nouveauClientAdministration();
  try {
    await client.absence.deleteMany({
      where: { utilisateur_id: utilisateurAbseco },
    });
    await client.technicien.deleteMany({ where: { id: technicienAbseco } });
    await client.utilisateurSociete.deleteMany({
      where: { id: utilisateurSocieteAbseco },
    });
    await client.utilisateur.deleteMany({ where: { id: utilisateurAbseco } });
  } finally {
    await client.$disconnect();
  }
}

async function ecrireLaScene(): Promise<void> {
  utilisateurAbseco = uuidv7();
  utilisateurSocieteAbseco = uuidv7();
  technicienAbseco = uuidv7();
  absenceTerminee = uuidv7();
  absenceEnCours = uuidv7();
  absenceAVenir = uuidv7();

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
        id: utilisateurAbseco,
        nom: NOM_PERSONNE,
        email: EMAIL_PERSONNE,
      },
    });
    await client.utilisateurSociete.create({
      data: {
        id: utilisateurSocieteAbseco,
        utilisateur_id: utilisateurAbseco,
        societe_id: societe.id,
        role: Role.technicien,
      },
    });
    await client.technicien.create({
      data: {
        id: technicienAbseco,
        societe_id: societe.id,
        utilisateur_id: utilisateurAbseco,
        agence_id: agence.id,
        actif: true,
      },
    });

    await client.absence.create({
      data: {
        id: absenceTerminee,
        societe_id: societe.id,
        utilisateur_id: utilisateurAbseco,
        du: dateCivile(dansNJours(-10)),
        au: dateCivile(dansNJours(-5)),
      },
    });
    await client.absence.create({
      data: {
        id: absenceEnCours,
        societe_id: societe.id,
        utilisateur_id: utilisateurAbseco,
        du: dateCivile(dansNJours(-2)),
        au: dateCivile(dansNJours(5)),
      },
    });
    await client.absence.create({
      data: {
        id: absenceAVenir,
        societe_id: societe.id,
        utilisateur_id: utilisateurAbseco,
        du: dateCivile(dansNJours(21)),
        au: dateCivile(dansNJours(23)),
      },
    });
  } finally {
    await client.$disconnect();
  }
}

test.beforeAll(ecrireLaScene);
test.afterAll(effacerLaScene);

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9DK-PG-G15A-ABSENCE-ECOURTER/captures",
);

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1400 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

/** Les trois lignes de la scène, dans l'ORDRE du tableau (`du` DESC). */
function lignesDeLaScene(page: Page) {
  const lignes = page.locator("tr").filter({ hasText: NOM_PERSONNE });
  return {
    aVenir: lignes.nth(0),
    enCours: lignes.nth(1),
    terminee: lignes.nth(2),
  };
}

test("chaque ligne porte son état, et seule l'action qui lui correspond", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/absences");

  const lignes = page.locator("tr").filter({ hasText: NOM_PERSONNE });
  await expect(lignes).toHaveCount(3);

  const { aVenir, enCours, terminee } = lignesDeLaScene(page);

  await expect(aVenir).toContainText(fr["absences.etat_a_venir"]);
  await expect(
    aVenir.getByRole("button", { name: fr["absences.lever"] }),
  ).toHaveCount(1);
  await expect(aVenir.locator('input[name="au"]')).toHaveCount(0);

  await expect(enCours).toContainText(fr["absences.etat_en_cours"]);
  await expect(
    enCours.getByRole("button", { name: fr["absences.ecourter"] }),
  ).toHaveCount(1);
  await expect(
    enCours.getByRole("button", { name: fr["absences.lever"] }),
  ).toHaveCount(0);

  await expect(terminee).toContainText(fr["absences.etat_terminee"]);
  await expect(terminee.getByRole("button")).toHaveCount(0);
  await expect(terminee.locator("input")).toHaveCount(0);

  await capturer(page, "absences-etats", 1280);
  await capturer(page, "absences-etats", 375);
});

test("la tuile « Absents aujourd'hui » nomme la personne en cours d'absence", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/absences");

  const tuile = page.locator('[data-bloc="kpi-demandes-valider"]');
  await expect(tuile).toContainText(fr["absences.kpi_absents_aujourdhui"]);
  // `NOM_PERSONNE` NE TRAVERSE JAMAIS `toContainText` (L0-11) : comparaison
  // GÉNÉRIQUE sur du texte déjà extrait, même discipline que
  // `tests/e2e/deplanifiee-1.spec.ts`.
  const texteTuile = await tuile.innerText();
  expect(texteTuile).toContain(NOM_PERSONNE);
});

test("le tableau de bord porte la même lecture — « Techniciens absents aujourd'hui »", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/tableau-de-bord");

  const tuile = page.locator("div", {
    hasText: fr["tableau_de_bord.kpi_absences_jour"],
  });
  await expect(tuile.first()).toBeVisible();
  await capturer(page, "tableau-de-bord-absents", 1280);
});

test("les 4 semaines suivantes montrent la pastille de l'absence à venir", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/absences");

  // `Carte` ne porte pas de `data-bloc` : on vise le `<section>` dont le
  // titre (`<h2>`) est celui des 4 semaines suivantes, puis la pastille
  // (`data-bloc="calendrier-pastille"`, même marqueur que le calendrier
  // d'une semaine) — jamais `getByText` nu, qui rendrait aussi les
  // ancêtres (bande, jour) qui CONTIENNENT le texte de la pastille.
  const carte = page
    .locator("section")
    .filter({ hasText: fr["absences.quatre_semaines_titre"] });
  await expect(carte).toHaveCount(1);
  const pastille = carte
    .locator('[data-bloc="calendrier-pastille"]')
    .filter({ hasText: NOM_PERSONNE });
  await expect(pastille.first()).toBeVisible();

  await capturer(page, "absences-4-semaines", 1280);
});

test("écourter l'absence en cours fixe sa nouvelle fin, et le dépôt le confirme", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/absences");

  const { enCours } = lignesDeLaScene(page);
  const nouvelleFin = dansNJours(0);
  await enCours.locator('input[name="au"]').fill(nouvelleFin);
  await capturer(page, "absences-ecourter-dialogue", 1280);
  await enCours.getByRole("button", { name: fr["absences.ecourter"] }).click();
  await page.waitForLoadState("networkidle");

  const client = await nouveauClientAdministration();
  try {
    const ligne = await client.absence.findUniqueOrThrow({
      where: { id: absenceEnCours },
      select: { au: true },
    });
    expect(ligne.au.toISOString().slice(0, 10)).toBe(nouvelleFin);
  } finally {
    await client.$disconnect();
  }
});

test("supprimer l'absence à venir, après confirmation, la retire du tableau et de la base", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/absences");

  const { aVenir } = lignesDeLaScene(page);
  await aVenir.getByRole("button", { name: fr["absences.lever"] }).click();

  const dialogue = page.locator("dialog");
  await expect(dialogue).toBeVisible();
  await dialogue
    .getByRole("button", { name: fr["absences.levee_confirmer"] })
    .click();
  await page.waitForLoadState("networkidle");

  const client = await nouveauClientAdministration();
  try {
    const compte = await client.absence.count({
      where: { id: absenceAVenir },
    });
    expect(compte).toBe(0);
  } finally {
    await client.$disconnect();
  }
});

test("TR-5 — le technicien connecté ne voit que le formulaire pour lui-même, et aucune action d'écourter/supprimer", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto("/absences");

  // Le ○ de TR-5 ouvre la déclaration pour lui-même — QT-2/D152 restreint
  // déjà le `<select>` à sa seule personne (9DG).
  const options = page.locator("#absence-personne option:not([disabled])");
  await expect(options).toHaveCount(1);

  // Mais AUCUNE action d'écourter ou de supprimer : le ○ ne suffit pas
  // (`peutGererLignes`, `exigerCapaciteComplete`).
  await expect(
    page.getByRole("button", { name: fr["absences.lever"] }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: fr["absences.ecourter"] }),
  ).toHaveCount(0);

  await capturer(page, "absences-vue-technicien", 1280);
});

test("MO-31 — le planning offre un lien « Déclarer une absence » pour cette personne", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/planning");

  const ligne = page.locator("tr", { hasText: NOM_PERSONNE }).first();
  const lien = ligne.getByRole("link", {
    name: fr["planning.declarer_absence_lien"],
  });
  await expect(lien).toHaveCount(1);
  await expect(lien).toHaveAttribute(
    "href",
    new RegExp(`/absences\\?apercu=1&utilisateur_id=${utilisateurAbseco}&du=`),
  );

  await capturer(page, "planning-semaine-lien-absence", 1280);

  // UN JOUR OUVRÉ EXPLICITE (9DW-E2E-DIMANCHE) : la vue Jour rend un état
  // vide, sans aucune ligne, le dimanche — aucune agence n'a de calendrier
  // ouvert ce jour-là. `?jour=` vise donc le PROCHAIN LUNDI plutôt que de
  // dépendre du jour où `verify:full` tourne.
  await page.goto(`/planning?vue=jour&jour=${cleDuProchainLundi()}`);
  const ligneJour = page.locator("tr", { hasText: NOM_PERSONNE }).first();
  await expect(
    ligneJour.getByRole("link", {
      name: fr["planning.declarer_absence_lien"],
    }),
  ).toHaveCount(1);
  await capturer(page, "planning-jour-lien-absence", 1280);
});
