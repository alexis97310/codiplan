import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9L08F-CHECKLIST-DERNIER-RELEVE — RELEVÉ SEUL, AUCUNE TOLÉRANCE (décisions
 * d'Alexis du 11/11 et du 16/11/2026).
 *
 * Ce que les épreuves unitaires et d'isolation ne peuvent pas prouver :
 * qu'une SECONDE intervention sur la MÊME machine affiche bien, sous le
 * libellé du point chiffré, le relevé de la PREMIÈRE — en ligne, et dans la
 * coquille hors réseau (même instantané, même composant `ChecklistTerrain`,
 * voir l'en-tête de `components/terrain/checklist-terrain.tsx`).
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `9L08F` : client, site, machine, deux
 * interventions (une déjà CLÔTURÉE qui porte le relevé, une COURANTE
 * `en_cours`) et un modèle de checklist GÉNÉRIQUE à deux points chiffrés —
 * l'un avec antécédent, l'autre sans, pour montrer les deux cas sur la même
 * rubrique. SÉRIEL, même raison que `9k21`/`9k22`/`9l04b` : un modèle
 * générique s'applique à toute intervention de la société.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const DOSSIER = join(
  process.cwd(),
  "docs/propositions/9L08F-CHECKLIST-DERNIER-RELEVE/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER, { recursive: true });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.screenshot({ path: join(DOSSIER, `${nom}-375.png`) });
}

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const MACHINE_ID = uuidv7();
const INTERVENTION_ANCIENNE_ID = uuidv7();
const INTERVENTION_COURANTE_ID = uuidv7();
const INTERVENTION_MACHINE_ANCIENNE_ID = uuidv7();
const INTERVENTION_MACHINE_COURANTE_ID = uuidv7();

const CODE_MODELE = "9L08F-GENERIQUE";
const LIBELLE_SECTION = "Mesures 9L08F";
const LIBELLE_POINT_AVEC_RELEVE = "Pression 9L08F";
const LIBELLE_POINT_SANS_RELEVE = "Niveau d'huile 9L08F";
const VALEUR_RELEVE = "6.2";
const UNITE_RELEVE = "bar";
const DATE_RELEVE = "2026-09-12T08:00:00.000Z";
const DATE_AFFICHEE = "12/09/2026";

let modeleId = "";

test.beforeAll(async () => {
  const client = admin();
  try {
    const reperes = await reperesDeLaScene();
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const modeleMateriel = await client.modeleMateriel.findFirstOrThrow({
      where: { societe_id: reperes.societeId },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: "9L08F client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "9L08F site",
        adresse: { rue: "1 rue de l'épreuve" },
        commune: "Nouméa",
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_ID,
        societe_id: reperes.societeId,
        modele_id: modeleMateriel.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        numero_serie: "9L08F-SN",
        qr_token: uuidv7(),
      },
    });

    modeleId = uuidv7();
    await client.checklistModele.create({
      data: {
        id: modeleId,
        societe_id: reperes.societeId,
        code: CODE_MODELE,
        libelle: "9L08F checklist générique",
        actif: true,
      },
    });
    const versionId = uuidv7();
    await client.checklistVersion.create({
      data: {
        id: versionId,
        societe_id: reperes.societeId,
        checklist_modele_id: modeleId,
        numero: 1,
      },
    });
    const pointAvecReleveId = uuidv7();
    await client.checklistPoint.create({
      data: {
        id: pointAvecReleveId,
        societe_id: reperes.societeId,
        checklist_version_id: versionId,
        section: LIBELLE_SECTION,
        ordre: 1,
        libelle: LIBELLE_POINT_AVEC_RELEVE,
        obligatoire: false,
        type_reponse: "valeur_mesuree",
        unite: UNITE_RELEVE,
      },
    });
    await client.checklistPoint.create({
      data: {
        id: uuidv7(),
        societe_id: reperes.societeId,
        checklist_version_id: versionId,
        section: LIBELLE_SECTION,
        ordre: 2,
        libelle: LIBELLE_POINT_SANS_RELEVE,
        obligatoire: false,
        type_reponse: "valeur_mesuree",
        unite: "L",
      },
    });

    // ── L'INTERVENTION ANCIENNE, PORTE LE RELEVÉ ───────────────────────────
    // NAÎT `en_cours` : la machine est rattachée pendant le travail, PUIS
    // seulement l'intervention est clôturée (9L14SB — ordre réel, le
    // figement à la clôture refuse désormais ce rattachement sur une
    // intervention déjà `cloturee`).
    await client.intervention.create({
      data: {
        id: INTERVENTION_ANCIENNE_ID,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        priorite: "p3",
        statut: "en_cours",
        date_planifiee: null,
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9L08F-intervention-ancienne",
      },
    });
    await client.interventionMachine.create({
      data: {
        id: INTERVENTION_MACHINE_ANCIENNE_ID,
        societe_id: reperes.societeId,
        intervention_id: INTERVENTION_ANCIENNE_ID,
        machine_id: MACHINE_ID,
      },
    });
    // PUIS la clôture — l'ordre réel, rien n'est rattaché après (même patron
    // que `tests/e2e/9l14-fige-a-la-cloture.spec.ts` : la matrice D8 ne
    // clôture qu'à partir de `terminee`, temps validé et rapport validé).
    await client.intervention.update({
      where: { id: INTERVENTION_ANCIENNE_ID },
      data: {
        statut: "terminee",
        temps_valide_min: 60,
        rapport_valide_par: reperes.technicienDucos,
        rapport_valide_le: new Date(),
      },
    });
    await client.intervention.update({
      where: { id: INTERVENTION_ANCIENNE_ID },
      data: { statut: "cloturee", cloturee_le: new Date() },
    });
    await client.checklistReponse.create({
      data: {
        id: uuidv7(),
        societe_id: reperes.societeId,
        intervention_id: INTERVENTION_ANCIENNE_ID,
        checklist_point_id: pointAvecReleveId,
        libelle: LIBELLE_POINT_AVEC_RELEVE,
        section: LIBELLE_SECTION,
        unite: UNITE_RELEVE,
        obligatoire: false,
        valeur_mesuree: VALEUR_RELEVE,
        auteur_id: reperes.technicienDucos,
        repondu_le: new Date(DATE_RELEVE),
      },
    });

    // ── L'INTERVENTION COURANTE, SUR LA MÊME MACHINE ──────────────────────
    await client.intervention.create({
      data: {
        id: INTERVENTION_COURANTE_ID,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        priorite: "p3",
        statut: "en_cours",
        date_planifiee: null,
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9L08F-intervention-courante",
      },
    });
    await client.interventionMachine.create({
      data: {
        id: INTERVENTION_MACHINE_COURANTE_ID,
        societe_id: reperes.societeId,
        intervention_id: INTERVENTION_COURANTE_ID,
        machine_id: MACHINE_ID,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.checklistReponse.deleteMany({
      where: { intervention_id: INTERVENTION_ANCIENNE_ID },
    });
    // `intervention_machine` CASCADE depuis `intervention`, jamais l'inverse
    // (même raisonnement que `9l04j-prestations-par-materiel.spec.ts`) :
    // un `DELETE` explicite ici tomberait sur le figement à la clôture de
    // `INTERVENTION_ANCIENNE_ID`, désormais `cloturee`.
    await client.intervention.deleteMany({
      where: {
        id: { in: [INTERVENTION_ANCIENNE_ID, INTERVENTION_COURANTE_ID] },
      },
    });
    if (modeleId !== "") {
      await client.checklistVersion.deleteMany({
        where: { checklist_modele_id: modeleId },
      });
      await client.checklistModele.deleteMany({ where: { id: modeleId } });
    }
    await client.machine.deleteMany({ where: { id: MACHINE_ID } });
    await client.site.deleteMany({ where: { id: SITE_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

function ligneDuPoint(page: Page, libelle: string) {
  return page.locator("div").filter({ hasText: libelle }).last();
}

test("en ligne — le relevé de l'intervention antérieure s'affiche sous le point chiffré, RIEN sous celui sans antécédent", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`/terrain/${INTERVENTION_COURANTE_ID}`);

  const texteAttendu = `${fr["checklist.terrain.dernier_releve_prefixe"]}${fr["ponctuation.deux_points"]}${VALEUR_RELEVE} ${UNITE_RELEVE} ${fr["checklist.terrain.dernier_releve_le"]} ${DATE_AFFICHEE}`;
  await expect(page.getByText(texteAttendu, { exact: true })).toBeVisible();

  // LE POINT SANS ANTÉCÉDENT NE PORTE AUCUN RAPPEL — jamais un texte
  // générique pour les deux points.
  await expect(
    ligneDuPoint(page, LIBELLE_POINT_SANS_RELEVE).getByText(
      fr["checklist.terrain.dernier_releve_prefixe"],
    ),
  ).toHaveCount(0);

  await ligneDuPoint(page, LIBELLE_POINT_AVEC_RELEVE).scrollIntoViewIfNeeded();
  await capturer(page, "rubrique-avec-et-sans-releve-apres");
});

test("375 px — le champ d'un point chiffré garde la même position, avec ou sans dernier relevé (petit défaut relevé 9L31)", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`/terrain/${INTERVENTION_COURANTE_ID}`);

  // AVANT CE LOT, le champ du point AVEC dernier relevé passait sous le
  // libellé par un simple effet de bord du retour à la ligne (le texte du
  // relevé laissait trop peu de place sur la même ligne) ; le point SANS
  // dernier relevé, lui, gardait son champ à droite — même type de point,
  // deux mises en page différentes selon le hasard du texte affiché. Même
  // ligne que `ligneDuPoint` ci-dessus (libellé en DONNÉE de scène, jamais
  // du dictionnaire — `getByText`/`getByRole` sur ce texte ferait rougir le
  // gardien L0-11, qui n'accepte que `.filter({ hasText })`).
  const ligneAvecReleve = ligneDuPoint(page, LIBELLE_POINT_AVEC_RELEVE);
  const ligneSansReleve = ligneDuPoint(page, LIBELLE_POINT_SANS_RELEVE);
  const champAvecReleve = ligneAvecReleve.getByRole("spinbutton");
  const champSansReleve = ligneSansReleve.getByRole("spinbutton");
  await expect(champAvecReleve).toBeVisible();
  await expect(champSansReleve).toBeVisible();

  const libelleAvecReleve = ligneAvecReleve.locator("span").first();
  const libelleSansReleve = ligneSansReleve.locator("span").first();

  const [boiteLibelleAvec, boiteChampAvec, boiteLibelleSans, boiteChampSans] =
    await Promise.all([
      libelleAvecReleve.boundingBox(),
      champAvecReleve.boundingBox(),
      libelleSansReleve.boundingBox(),
      champSansReleve.boundingBox(),
    ]);
  if (
    boiteLibelleAvec === null ||
    boiteChampAvec === null ||
    boiteLibelleSans === null ||
    boiteChampSans === null
  ) {
    throw new Error("boîte introuvable");
  }

  // MÊME MISE EN PAGE DANS LES DEUX CAS : le champ est SOUS le libellé (même
  // bord gauche, posé plus bas), que le point porte un dernier relevé ou non.
  expect(boiteChampAvec.x).toBeCloseTo(boiteLibelleAvec.x, 0);
  expect(boiteChampAvec.y).toBeGreaterThan(
    boiteLibelleAvec.y + boiteLibelleAvec.height,
  );
  expect(boiteChampSans.x).toBeCloseTo(boiteLibelleSans.x, 0);
  expect(boiteChampSans.y).toBeGreaterThan(
    boiteLibelleSans.y + boiteLibelleSans.height,
  );

  // LA CIBLE TACTILE RESTE ≥ 44 PX DANS LES DEUX CAS (D143/D263).
  expect(boiteChampAvec.height).toBeGreaterThanOrEqual(44);
  expect(boiteChampSans.height).toBeGreaterThanOrEqual(44);
});

test("hors réseau — le même relevé survit dans la copie locale", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`/terrain/${INTERVENTION_COURANTE_ID}`);
  await page.waitForResponse(
    (r) => r.url().includes("/api/terrain/instantane") && r.ok(),
  );
  // L'ÉCRITURE INDEXEDDB SUIT LA RÉPONSE HTTP (asynchrone, même marge que
  // `9k22-checklist-hors-reseau.spec.ts`).
  await page.waitForTimeout(300);

  await page.context().setOffline(true);
  try {
    await page.goto(`/terrain-hors-reseau?id=${INTERVENTION_COURANTE_ID}`);
    const texteAttendu = `${fr["checklist.terrain.dernier_releve_prefixe"]}${fr["ponctuation.deux_points"]}${VALEUR_RELEVE} ${UNITE_RELEVE} ${fr["checklist.terrain.dernier_releve_le"]} ${DATE_AFFICHEE}`;
    await expect(page.getByText(texteAttendu, { exact: true })).toBeVisible();
    await ligneDuPoint(
      page,
      LIBELLE_POINT_AVEC_RELEVE,
    ).scrollIntoViewIfNeeded();
    await capturer(page, "rubrique-hors-reseau-apres");
  } finally {
    await page.context().setOffline(false);
  }
});
