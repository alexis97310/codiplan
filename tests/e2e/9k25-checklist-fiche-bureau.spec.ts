import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9K25-CHECKLIST-FICHE-BUREAU, CK9 — LA TUILE « CHECKLIST » EN LECTURE SUR LA
 * FICHE INTERVENTION DU BUREAU, ET LA MENTION NON BLOQUANTE DANS « AVANT DE
 * CLÔTURER ».
 *
 * **CAPTURES APRÈS SEULEMENT** — même réserve que `9k24-checklist-bons.
 * spec.ts` : un AVANT fidèle exigerait un serveur reconstruit sur le commit
 * précédent, hors budget de ce lot.
 */
test.describe.configure({ mode: "serial" });

// LES LIBELLÉS DE LA SCÈNE, DONNÉE DU TEST — jamais des clés du dictionnaire
// (ils RECOPIENT un point de checklist, même recette que 9K24).
const LIBELLE_CONFORME = "Jeu des galets vérifié";
const LIBELLE_NON_CONFORME = "Niveau d'huile correct";
const LIBELLE_MODELE = "zz9k25 modèle CK9";

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9K25-CHECKLIST-FICHE-BUREAU/captures",
);

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1400 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-apres-${largeur}.png`),
    fullPage: true,
  });
}

type Scene = {
  readonly avecChecklistId: string;
  readonly sansChecklistId: string;
  readonly modeleId: string;
  readonly auteurNom: string;
};

let scene: Scene | null = null;

async function preparerLaScene(): Promise<Scene> {
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const utilisateur = await admin.utilisateur.findFirstOrThrow({
      where: { email: COMPTE_ADMIN_SOCIETE_EPREUVE },
      select: { id: true, nom: true },
    });
    const utilisateurSociete = await admin.utilisateurSociete.findFirstOrThrow({
      where: { utilisateur_id: utilisateur.id },
      select: { societe_id: true },
    });
    const societeId = utilisateurSociete.societe_id;
    const client = await admin.client.findFirstOrThrow({
      where: { societe_id: societeId },
      select: { id: true },
    });
    const site = await admin.site.findFirstOrThrow({
      where: { societe_id: societeId, client_id: client.id },
      select: { id: true, agence_id: true },
    });

    const avecChecklistId = uuidv7();
    await admin.intervention.create({
      data: {
        id: avecChecklistId,
        societe_id: societeId,
        agence_id: site.agence_id,
        client_id: client.id,
        site_id: site.id,
        type: "curatif",
        priorite: "p3",
        statut: "terminee",
        temps_valide_min: 60,
        rapport_valide_par: utilisateur.id,
        rapport_valide_le: new Date(),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "zz9k25 checklist fiche bureau — avec checklist",
      },
    });

    const sansChecklistId = uuidv7();
    await admin.intervention.create({
      data: {
        id: sansChecklistId,
        societe_id: societeId,
        agence_id: site.agence_id,
        client_id: client.id,
        site_id: site.id,
        type: "curatif",
        priorite: "p3",
        statut: "terminee",
        temps_valide_min: 60,
        rapport_valide_par: utilisateur.id,
        rapport_valide_le: new Date(),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "zz9k25 checklist fiche bureau — sans checklist",
      },
    });

    const modeleId = uuidv7();
    await admin.checklistModele.create({
      data: {
        id: modeleId,
        societe_id: societeId,
        code: "ZZ9K25-CK9",
        libelle: LIBELLE_MODELE,
        actif: false,
      },
    });
    const versionId = uuidv7();
    await admin.checklistVersion.create({
      data: {
        id: versionId,
        societe_id: societeId,
        checklist_modele_id: modeleId,
        numero: 1,
      },
    });

    const points = [
      {
        section: "Sécurité",
        ordre: 1,
        libelle: LIBELLE_CONFORME,
        valeur_conforme: "conforme" as const,
      },
      {
        section: "Sécurité",
        ordre: 2,
        libelle: LIBELLE_NON_CONFORME,
        valeur_conforme: "non_conforme" as const,
      },
    ];

    for (const point of points) {
      const pointId = uuidv7();
      await admin.checklistPoint.create({
        data: {
          id: pointId,
          societe_id: societeId,
          checklist_version_id: versionId,
          section: point.section,
          ordre: point.ordre,
          libelle: point.libelle,
          obligatoire: false,
          type_reponse: "conforme_non_conforme_sans_objet",
        },
      });
      await admin.checklistReponse.create({
        data: {
          id: uuidv7(),
          societe_id: societeId,
          intervention_id: avecChecklistId,
          checklist_point_id: pointId,
          libelle: point.libelle,
          section: point.section,
          obligatoire: false,
          valeur_conforme: point.valeur_conforme,
          auteur_id: utilisateur.id,
        },
      });
    }

    await admin.intervention.update({
      where: { id: avecChecklistId },
      data: { checklist_version_id: versionId },
    });

    return {
      avecChecklistId,
      sansChecklistId,
      modeleId,
      auteurNom: utilisateur.nom,
    };
  } finally {
    await admin.$disconnect();
  }
}

async function effacerLaScene(courante: Scene | null): Promise<void> {
  if (courante === null) return;
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await admin.checklistReponse.deleteMany({
      where: { intervention_id: courante.avecChecklistId },
    });
    await admin.intervention.deleteMany({
      where: {
        id: { in: [courante.avecChecklistId, courante.sansChecklistId] },
      },
    });
    await admin.checklistVersion.deleteMany({
      where: { checklist_modele_id: courante.modeleId },
    });
    await admin.checklistModele.deleteMany({
      where: { id: courante.modeleId },
    });
  } finally {
    await admin.$disconnect();
  }
}

test.beforeAll(async () => {
  scene = await preparerLaScene();
});

test.afterAll(async () => {
  await effacerLaScene(scene);
});

test("bureau (1280px) — la tuile Checklist porte la provenance, le résumé, les points, l'auteur et l'heure ; la mention non bloquante", async ({
  page,
}) => {
  if (scene === null) throw new Error("scène absente");
  await ouvrirUneSession(page);
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto(`/interventions/${scene.avecChecklistId}`);
  await expect(page).toHaveURL(
    new RegExp(`/interventions/${scene.avecChecklistId}$`),
  );
  await expect(
    page.getByRole("heading", { name: fr["checklist.bon.titre"] }),
  ).toBeVisible();

  // LECTURE EN JS, JAMAIS `getByText` (gardien L0-11) — libellés et noms
  // sont des DONNÉES de la scène, pas des clés du dictionnaire.
  const texteChecklist = await page
    .locator('[data-bloc="fiche-checklist"]')
    .innerText();
  expect(texteChecklist).toContain(LIBELLE_MODELE);
  expect(texteChecklist).toContain(`1 ${fr["checklist.bon.resume_conformes"]}`);
  expect(texteChecklist).toContain(
    `1 ${fr["checklist.bon.resume_non_conformes"]}`,
  );
  expect(texteChecklist).toContain(LIBELLE_CONFORME);
  expect(texteChecklist).toContain(LIBELLE_NON_CONFORME);
  // L'AUTEUR ET L'HEURE DE CHAQUE RÉPONSE (point 1 du ticket).
  expect(texteChecklist).toContain(scene.auteurNom);
  expect(texteChecklist).toMatch(/\d{2}:\d{2}/);

  // LA MENTION NON BLOQUANTE DANS « AVANT DE CLÔTURER » (point 2 du ticket).
  const texteAvantCloture = await page
    .locator('[data-bloc="avant-cloture"]')
    .innerText();
  expect(texteAvantCloture).toContain(
    `1 ${fr["checklist.terrain.points"]} ${fr["checklist.bon.resume_non_conformes"]}`,
  );
  const lienVoirLaChecklist = page.getByRole("link", {
    name: fr["checklist.fiche.lien_voir"],
  });
  await expect(lienVoirLaChecklist).toBeVisible();
  await expect(lienVoirLaChecklist).toHaveAttribute("href", "#checklist-fiche");

  await capturer(page, "fiche-bureau-checklist", 1280);
});

test("bureau (375px) — même tuile, en mobile", async ({ page }) => {
  if (scene === null) throw new Error("scène absente");
  await ouvrirUneSession(page);
  await page.setViewportSize({ width: 375, height: 1400 });
  await page.goto(`/interventions/${scene.avecChecklistId}`);
  await expect(
    page.getByRole("heading", { name: fr["checklist.bon.titre"] }),
  ).toBeVisible();
  const texteChecklist = await page
    .locator('[data-bloc="fiche-checklist"]')
    .innerText();
  expect(texteChecklist).toContain(LIBELLE_CONFORME);
  expect(texteChecklist).toContain(LIBELLE_NON_CONFORME);
  await capturer(page, "fiche-bureau-checklist", 375);
});

test("bureau — AUCUNE tuile Checklist et AUCUNE mention quand aucune version n'est figée", async ({
  page,
}) => {
  if (scene === null) throw new Error("scène absente");
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${scene.sansChecklistId}`);
  await expect(
    page.getByRole("heading", { name: fr["checklist.bon.titre"] }),
  ).toHaveCount(0);
  const texteAvantCloture = await page
    .locator('[data-bloc="avant-cloture"]')
    .innerText();
  expect(texteAvantCloture).not.toContain(fr["checklist.fiche.lien_voir"]);
});
