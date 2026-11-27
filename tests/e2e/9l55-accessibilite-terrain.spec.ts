import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9L55-ACCESSIBILITE-TERRAIN — mesure automatique (`@axe-core/playwright`,
 * MPL-2.0, dépendance de DÉVELOPPEMENT seulement) sur les écrans du terrain à
 * 375 px : Ma journée, la fiche (avec sa checklist, toujours en section
 * inline — D161/D212, « un seul écran qui défile », jamais une sous-route),
 * la signature, la confirmation « Terminer », Profil et le mot de passe.
 *
 * **Un seul `critical`/`serious` fait rougir CETTE épreuve** — `moderate`/
 * `minor` sont relevés dans `releve-axe.json` (écrit par `test.afterAll`)
 * sans jamais faire échouer : la passation du lot porte le compte, écran par
 * écran, pour qui voudra les reprendre ensuite.
 *
 * SÉRIEL, une SEULE fixture pour la fiche (`en_cours`, checklist et
 * signature déjà atteignables) — partagée par les trois tests qui en ont
 * besoin, créée une fois (`beforeAll`), effacée une fois (`afterAll`), comme
 * `9l04h-terrain-recapitulatif-signature.spec.ts`. « Ma journée », Profil et
 * le mot de passe ne lisent, eux, que le semis (`COMPTE_TECHNICIEN_EPREUVE`)
 * — aucune fixture à poser pour ces trois écrans.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER_LOT = join(
  process.cwd(),
  "docs/propositions/9L55-ACCESSIBILITE-TERRAIN",
);

type EntreeReleve = {
  readonly ecran: string;
  readonly violations: ReadonlyArray<{
    readonly regle: string;
    readonly gravite: string;
    readonly description: string;
    readonly noeuds: number;
  }>;
};

const releve: EntreeReleve[] = [];

/** `critical`/`serious` font échouer l'épreuve ; le reste est relevé, pas bloquant. */
const GRAVITES_BLOQUANTES: ReadonlySet<string> = new Set([
  "critical",
  "serious",
]);

/**
 * LES TRANSITIONS CSS SONT COUPÉES AVANT LA MESURE (mesuré le 28/11/2026) —
 * `Button` porte `transition-all` : juste après un clic qui fait passer sa
 * variante d'`outline` à `default` (ex. « Signature recueillie »),
 * `getComputedStyle` peut encore rendre une couleur INTERMÉDIAIRE de
 * l'animation, pas la couleur finale — `axe-core` l'a mesurée et condamnée à
 * tort, avec une couleur différente à chaque exécution (un artefact de
 * calendrier, jamais le même défaut deux fois). Couper `transition`/
 * `animation` avant d'auditer rend la mesure déterministe : elle juge la
 * couleur RENDUE, jamais une étape de son passage.
 */
async function couperLesTransitions(page: Page): Promise<void> {
  await page.addStyleTag({
    content:
      "*, *::before, *::after { transition: none !important; animation: none !important; }",
  });
}

async function auditerEcran(page: Page, ecran: string): Promise<void> {
  await couperLesTransitions(page);
  const resultats = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  releve.push({
    ecran,
    violations: resultats.violations.map((v) => ({
      regle: v.id,
      gravite: v.impact ?? "inconnue",
      description: v.help,
      noeuds: v.nodes.length,
    })),
  });

  const graves = resultats.violations.filter(
    (v) =>
      v.impact !== null &&
      v.impact !== undefined &&
      GRAVITES_BLOQUANTES.has(v.impact),
  );
  expect(
    graves,
    graves
      .map(
        (v) => `${v.impact} — ${v.id} (${v.nodes.length} nœud(s)) : ${v.help}`,
      )
      .join("\n"),
  ).toEqual([]);
}

test.afterAll(() => {
  mkdirSync(DOSSIER_LOT, { recursive: true });
  writeFileSync(
    join(DOSSIER_LOT, "releve-axe.json"),
    JSON.stringify(releve, null, 2) + "\n",
  );
});

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

type Scene = {
  readonly clientId: string;
  readonly siteId: string;
  readonly contactId: string;
  readonly interventionId: string;
  readonly prestationId: string;
  readonly modeleId: string;
};

async function creerScene(client: PrismaClient): Promise<Scene> {
  const reperes = await reperesDeLaScene();
  const agence = await client.agence.findFirstOrThrow({
    where: { societe_id: reperes.societeId, code: "DUCOS" },
    select: { id: true },
  });

  const clientId = uuidv7();
  await client.client.create({
    data: {
      id: clientId,
      societe_id: reperes.societeId,
      raison_sociale: "zz9L55 client accessibilité",
      actif: true,
    },
  });

  const siteId = uuidv7();
  await client.site.create({
    data: {
      id: siteId,
      societe_id: reperes.societeId,
      client_id: clientId,
      agence_id: agence.id,
      libelle: "zz9L55 site accessibilité",
      adresse: { rue: "1 rue de l'épreuve" },
      commune: "Nouméa",
    },
  });

  const contactId = uuidv7();
  await client.contact.create({
    data: {
      id: contactId,
      societe_id: reperes.societeId,
      client_id: clientId,
      site_id: null,
      nom: "zz9L55 contact signataire",
      email: "zz9l55-contact@epreuve.test",
      roles: ["signataire"],
    },
  });

  const prestationId = uuidv7();
  await client.prestation.create({
    data: {
      id: prestationId,
      societe_id: reperes.societeId,
      code: "ZZ9L55-PREST",
      libelle: "zz9L55 prestation accessibilité",
      actif: true,
    },
  });

  const interventionId = uuidv7();
  await client.intervention.create({
    data: {
      id: interventionId,
      societe_id: reperes.societeId,
      agence_id: agence.id,
      client_id: clientId,
      site_id: siteId,
      contact_id: contactId,
      technicien_id: reperes.technicienDucos,
      type: "curatif",
      priorite: "p3",
      statut: "en_cours",
      date_planifiee: new Date("2026-11-20T08:00:00Z"),
      creneau_debut: new Date("2026-11-20T08:00:00Z"),
      creneau_fin: new Date("2026-11-20T10:00:00Z"),
      duree_estimee_min: 120,
      mode_valorisation: "temps_passe",
      devise_code: "XPF",
      description: "zz9L55-accessibilite-terrain",
      commentaire_technicien: "zz9L55 déjà rempli.",
    },
  });

  await client.interventionPrestation.create({
    data: {
      id: uuidv7(),
      societe_id: reperes.societeId,
      intervention_id: interventionId,
      prestation_id: prestationId,
    },
  });

  await client.segmentTravail.create({
    data: {
      id: uuidv7(),
      societe_id: reperes.societeId,
      intervention_id: interventionId,
      utilisateur_id: reperes.technicienDucos,
      nom_technicien_affiche: "Technicien de l'épreuve",
      debut: new Date(Date.now() - 2 * 60 * 60_000),
      fin: new Date(),
    },
  });

  const modeleId = uuidv7();
  await client.checklistModele.create({
    data: {
      id: modeleId,
      societe_id: reperes.societeId,
      code: "ZZ9L55-CL",
      libelle: "zz9L55 modèle accessibilité",
      actif: false,
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
  await client.checklistPoint.create({
    data: {
      id: uuidv7(),
      societe_id: reperes.societeId,
      checklist_version_id: versionId,
      section: "zz9L55 section",
      ordre: 1,
      libelle: "zz9L55 point de contrôle",
      obligatoire: false,
      type_reponse: "conforme_non_conforme_sans_objet",
    },
  });
  await client.intervention.update({
    where: { id: interventionId },
    data: { checklist_version_id: versionId },
  });

  return {
    clientId,
    siteId,
    contactId,
    interventionId,
    prestationId,
    modeleId,
  };
}

async function nettoyerScene(
  client: PrismaClient,
  scene: Scene,
): Promise<void> {
  await client.checklistReponse.deleteMany({
    where: { intervention_id: scene.interventionId },
  });
  await client.$executeRawUnsafe(
    `UPDATE "intervention" SET "checklist_version_id" = NULL WHERE "id" = $1::uuid`,
    scene.interventionId,
  );
  await client.checklistVersion.deleteMany({
    where: { checklist_modele_id: scene.modeleId },
  });
  await client.checklistModele.deleteMany({ where: { id: scene.modeleId } });
  await client.$executeRawUnsafe(
    `DELETE FROM "intervention_signature" WHERE "intervention_id" = $1::uuid`,
    scene.interventionId,
  );
  await client.interventionPrestation.deleteMany({
    where: { intervention_id: scene.interventionId },
  });
  await client.prestation.deleteMany({ where: { id: scene.prestationId } });
  await client.$executeRawUnsafe(
    `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
    scene.interventionId,
  );
  await client.$executeRawUnsafe(
    `DELETE FROM "notification" WHERE "intervention_id" = $1::uuid`,
    scene.interventionId,
  );
  await client.intervention.deleteMany({ where: { id: scene.interventionId } });
  await client.contact.deleteMany({ where: { id: scene.contactId } });
  await client.site.deleteMany({ where: { id: scene.siteId } });
  await client.client.deleteMany({ where: { id: scene.clientId } });
}

let scene: Scene;

test.beforeAll(async () => {
  const client = admin();
  try {
    scene = await creerScene(client);
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await nettoyerScene(client, scene);
  } finally {
    await client.$disconnect();
  }
});

test("375 px — Ma journée", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await expect(page).toHaveURL(/\/terrain$/);
  await auditerEcran(page, "Ma journée");
});

test("375 px — la fiche, avec sa checklist en section inline", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto(`/terrain/${scene.interventionId}`);
  await expect(
    page.getByRole("heading", { name: fr["terrain.signature.titre"] }),
  ).toBeVisible();
  await auditerEcran(page, "fiche (checklist incluse)");
});

test("375 px — la signature", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto(`/terrain/${scene.interventionId}`);
  await page
    .getByRole("button", { name: fr["terrain.signature.option_signee"] })
    .click();
  await expect(
    page.getByLabel(fr["terrain.signature.nom_libelle"]),
  ).toBeVisible();
  await auditerEcran(page, "signature");
});

test("375 px — la confirmation « Terminer »", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto(`/terrain/${scene.interventionId}`);
  await page
    .getByRole("button", { name: fr["terrain.terminer.bouton"] })
    .click();
  await expect(
    page.getByRole("dialog", {
      name: fr["terrain.terminer.confirmation.titre"],
    }),
  ).toBeVisible();
  await auditerEcran(page, "terminer (confirmation)");
});

test("375 px — Profil", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto("/terrain/profil");
  await expect(
    page.getByRole("heading", { name: fr["terrain.profil.titre"] }),
  ).toBeVisible();
  await auditerEcran(page, "Profil");
});

test("375 px — mot de passe", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto("/terrain/profil/mot-de-passe");
  await expect(
    page.getByRole("heading", { name: fr["terrain.mot_de_passe.titre"] }),
  ).toBeVisible();
  await auditerEcran(page, "mot de passe");
});
