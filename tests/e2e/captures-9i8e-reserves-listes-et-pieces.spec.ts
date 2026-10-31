import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * CAPTURES DE 9I8E-RESERVES-LISTES-ET-PIECES, point 5 — les trois preuves
 * visuelles demandées par le ticket : la liste qui se retourne vers le haut
 * près du bas d'un formulaire défilé, la liste qui laisse « choix requis »
 * visible, et le plafond de 50 pièces (bouton désactivé).
 *
 * Scène propre, préfixée `9I8EC-`, créée en `beforeAll`, supprimée en
 * `afterAll` — même discipline que `9i7b-pieces-remplacees.spec.ts`.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const PREFIXE = "9I8EC-";
const CLIENTS = [uuidv7(), uuidv7()] as const;
const CLIENT_PIECES = uuidv7();
const SITE_PIECES = uuidv7();
const CURATIF_50_PIECES = uuidv7();

function libelleClient(rang: number): string {
  return `${PREFIXE}Client ${rang}`;
}

let societeId: string;

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;
  const client = admin();
  try {
    await client.client.createMany({
      data: CLIENTS.map((id, rang) => ({
        id,
        societe_id: societeId,
        raison_sociale: libelleClient(rang + 1),
        actif: true,
      })),
    });

    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_PIECES,
        societe_id: societeId,
        raison_sociale: `${PREFIXE}Client pièces`,
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_PIECES,
        societe_id: societeId,
        client_id: CLIENT_PIECES,
        agence_id: agence.id,
        libelle: `${PREFIXE}Site pièces`,
      },
    });
    await client.intervention.create({
      data: {
        id: CURATIF_50_PIECES,
        societe_id: societeId,
        agence_id: agence.id,
        client_id: CLIENT_PIECES,
        site_id: SITE_PIECES,
        technicien_id: reperes.technicienDucos,
        type: "curatif" as const,
        priorite: "p3" as const,
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe" as const,
        devise_code: "XPF",
        description: `${PREFIXE}intervention forgée par la capture`,
        statut: "affectee" as const,
        date_planifiee: null,
      },
    });
    await client.interventionPieceRemplacee.createMany({
      data: Array.from({ length: 50 }, (_v, rang) => ({
        id: uuidv7(),
        societe_id: societeId,
        intervention_id: CURATIF_50_PIECES,
        designation: `${PREFIXE}Pièce ${rang + 1}`,
        reference: null,
        quantite: 1,
        rang,
      })),
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.interventionPieceRemplacee.deleteMany({
      where: { intervention_id: CURATIF_50_PIECES },
    });
    await client.intervention.deleteMany({
      where: { id: CURATIF_50_PIECES },
    });
    await client.site.deleteMany({ where: { id: SITE_PIECES } });
    await client.client.deleteMany({
      where: { id: { in: [...CLIENTS, CLIENT_PIECES] } },
    });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9I8E-RESERVES-LISTES-ET-PIECES/captures",
);

/** EN VIEWPORT, sans `fullPage` : ce qui est visible sans défiler. */
async function capturer(
  page: Page,
  nom: string,
  largeur: number,
  hauteur = 900,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: hauteur });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
  });
}

test("liste retournée vers le haut, près du bas d'un formulaire défilé (375 px)", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/parc/nouvelle");

  // CLIQUE D'ABORD, MESURE ENSUITE, PUIS RÉDUIT LA FENÊTRE (voir
  // `placerChampPresDuBas`, `9i8e-reserves-listes-et-pieces.spec.ts`) — un
  // défilement seul ne pousse jamais `client_id` (premier champ du
  // formulaire) plus bas que sa position naturelle, et mesurer AVANT le
  // clic ignore le défilement que `locator.click()` effectue lui-même. La
  // marge (180, pas 90) laisse la barre d'action fixe du formulaire
  // (`action-primaire.tsx`, `bottom-16`) sous le champ, jamais sur lui —
  // une marge trop courte le recouvre réellement, et `champEstVisible` ferme
  // alors la liste à raison.
  const champ = page.locator('[data-selecteur="client_id"] input[type="text"]');
  await champ.click();
  const boite = await champ.boundingBox();
  if (boite === null) {
    throw new Error("champ client_id introuvable");
  }
  await page.setViewportSize({
    width: 375,
    height: Math.round(boite.y + boite.height + 180),
  });

  const motif = `q=${encodeURIComponent(PREFIXE)}`;
  await Promise.all([
    page.waitForResponse((reponse) => reponse.url().includes(motif)),
    champ.fill(PREFIXE),
  ]);
  await expect(
    page.locator('#client_id-resultats li[role="option"]').first(),
  ).toBeVisible();

  await page.screenshot({
    path: join(DOSSIER_CAPTURES, "liste-vers-le-haut-pres-du-bas-375.png"),
  });
});

test("« choix requis » reste visible, liste ouverte (1280 px)", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/sites/nouveau");

  const champ = page.locator('[data-selecteur="client_id"] input[type="text"]');
  const motif = `q=${encodeURIComponent(PREFIXE)}`;
  await champ.click();
  await Promise.all([
    page.waitForResponse((reponse) => reponse.url().includes(motif)),
    champ.fill(PREFIXE),
  ]);
  await page.evaluate(() => {
    document
      .querySelector('[data-selecteur="client_id"] input[type="text"]')
      ?.closest("form")
      ?.requestSubmit();
  });
  await expect(
    page.locator('[data-selecteur="client_id"] [role="alert"]'),
  ).toBeVisible();

  await page.screenshot({
    path: join(DOSSIER_CAPTURES, "liste-avec-choix-requis-visible-1280.png"),
  });
});

test("le plafond de 50 pièces — « Ajouter une pièce » désactivé (375 px)", async ({
  page,
}) => {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);

  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`/terrain/${CURATIF_50_PIECES}`);

  const boutonAjouter = page.getByRole("button", {
    name: fr["terrain.pieces.ajouter"],
  });
  await expect(boutonAjouter).toBeDisabled();
  await boutonAjouter.scrollIntoViewIfNeeded();

  await capturer(page, "plafond-50-pieces-bouton-desactive", 375);
});
