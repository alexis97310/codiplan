import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import { libellePieceRemplacee } from "@/lib/interventions/bon";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9I7B0-REPRISE-9I7B — LES PREUVES QUE 9I7B N'A PAS FAITES (son point 3 et 6
 * de passation), DE BOUT EN BOUT : la saisie terrain à 375 px (présence sur
 * curatif, absence sur préventif, remplacement intégral, lignes refusées),
 * le hors réseau (mise en file, rejeu), et la lecture (tuile du bon — client
 * et interne — et de la fiche, sans prix, absente si vide).
 *
 * Sa propre scène, préfixée `9I7B-`, créée en `beforeAll`, supprimée en
 * `afterAll` : aucune ligne ajoutée au semis partagé.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_9I7B = uuidv7();
const SITE_9I7B = uuidv7();
const CURATIF_SAISIE = uuidv7();
const PREVENTIF_ABSENCE = uuidv7();
const HORS_RESEAU = uuidv7();
const BON_AVEC_PIECES = uuidv7();
const BON_SANS_PIECES = uuidv7();
const PIECE_BON = uuidv7();

let societeId: string;
let technicienId: string;

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;
  technicienId = reperes.technicienDucos;
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_9I7B,
        societe_id: societeId,
        raison_sociale: "9I7B client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9I7B,
        societe_id: societeId,
        client_id: CLIENT_9I7B,
        agence_id: agence.id,
        libelle: "9I7B site",
      },
    });
    const commun = {
      societe_id: societeId,
      agence_id: agence.id,
      client_id: CLIENT_9I7B,
      site_id: SITE_9I7B,
      technicien_id: technicienId,
      type: "curatif" as const,
      priorite: "p3" as const,
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe" as const,
      devise_code: "XPF",
      description: "9I7B0 — intervention forgée par l'épreuve",
      statut: "affectee" as const,
      date_planifiee: null,
    };
    await client.intervention.create({
      data: { id: CURATIF_SAISIE, ...commun },
    });
    await client.intervention.create({
      data: {
        id: PREVENTIF_ABSENCE,
        ...commun,
        type: "preventif_contrat" as const,
      },
    });
    await client.intervention.create({
      data: { id: HORS_RESEAU, ...commun },
    });
    // LES DEUX FIXTURES DE LECTURE — « terminee » : le bon n'existe que pour
    // `terminee`/`cloturee` (voir `verdictBon`, ce ticket ne touche pas ce
    // refus d'accès).
    await client.intervention.create({
      data: { id: BON_AVEC_PIECES, ...commun, statut: "terminee" as const },
    });
    await client.intervention.create({
      data: { id: BON_SANS_PIECES, ...commun, statut: "terminee" as const },
    });
    await client.interventionPieceRemplacee.create({
      data: {
        id: PIECE_BON,
        societe_id: societeId,
        intervention_id: BON_AVEC_PIECES,
        designation: fr["terrain9i7b.e2e.designation_bon"],
        reference: null,
        quantite: 1,
        rang: 0,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    // `ON DELETE CASCADE` de `intervention_piece_remplacee` vers
    // `intervention` : PIECE_BON part avec BON_AVEC_PIECES, sans ligne dédiée.
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9I7B,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_9I7B } });
    await client.client.deleteMany({ where: { id: CLIENT_9I7B } });
  } finally {
    await client.$disconnect();
  }
});

async function connecterLeTechnicien(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9I7B-PIECES-REMPLACEES-SAISIE-LIBRE/captures",
);

/** EN VIEWPORT, sans `fullPage` : ce qui est visible sans défiler. */
async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
  });
}

async function piecesServeur(interventionId: string): Promise<
  readonly {
    readonly designation: string;
    readonly reference: string | null;
    readonly quantite: number;
  }[]
> {
  const client = admin();
  try {
    return await client.interventionPieceRemplacee.findMany({
      where: { intervention_id: interventionId },
      orderBy: { rang: "asc" },
      select: { designation: true, reference: true, quantite: true },
    });
  } finally {
    await client.$disconnect();
  }
}

test("curatif, 375 px : présente, absente sur un préventif, ajout/retrait persistent une seule fois, désignation vide et quantité < 1 refusées", async ({
  page,
}) => {
  await connecterLeTechnicien(page);
  await page.setViewportSize({ width: 375, height: 900 });

  // ABSENTE — hors des trois natures concernées (curatif, garantie, reprise).
  await page.goto(`/terrain/${PREVENTIF_ABSENCE}`);
  await expect(
    page.getByRole("heading", { name: fr["terrain.pieces.titre"] }),
  ).toHaveCount(0);

  // PRÉSENTE, VIDE, sur le curatif.
  await page.goto(`/terrain/${CURATIF_SAISIE}`);
  await expect(
    page.getByRole("heading", { name: fr["terrain.pieces.titre"] }),
  ).toBeVisible();
  await expect(page.getByText(fr["terrain.pieces.aucune"])).toBeVisible();
  await capturer(page, "saisie-pieces-vide", 375);

  // AJOUT DE DEUX LIGNES.
  const boutonAjouter = page.getByRole("button", {
    name: fr["terrain.pieces.ajouter"],
  });
  await boutonAjouter.click();
  await boutonAjouter.click();
  const designations = page.getByLabel(
    fr["terrain.pieces.designation_libelle"],
  );
  const references = page.getByLabel(fr["terrain.pieces.reference_libelle"]);
  const quantites = page.getByLabel(fr["terrain.pieces.quantite_libelle"]);
  await expect(designations).toHaveCount(2);

  await designations.nth(0).fill(fr["terrain9i7b.e2e.designation_un"]);
  await quantites.nth(0).fill("3");
  await designations.nth(1).fill(fr["terrain9i7b.e2e.designation_deux"]);
  await references.nth(1).fill(fr["terrain9i7b.e2e.reference_deux"]);
  await quantites.nth(1).fill("2");
  await quantites.nth(1).blur();
  await expect(page.getByText(fr["terrain.rapport.enregistre"])).toBeVisible();
  await capturer(page, "saisie-pieces-deux-lignes", 375);

  // RETRAIT DE LA PREMIÈRE LIGNE — `retirerPiece` enregistre sans attendre
  // de `blur` (voir `components/terrain/rapport-automatique.tsx`).
  await page
    .getByRole("button", { name: fr["terrain.pieces.retirer"] })
    .first()
    .click();
  await expect(designations).toHaveCount(1);
  await expect(page.getByText(fr["terrain.rapport.enregistre"])).toBeVisible();

  // RECHARGEMENT — LA LIGNE RESTANTE, UNE SEULE FOIS, DEPUIS LE SERVEUR. Le
  // brouillon local est effacé avant de recharger : sinon la valeur relue
  // pourrait venir du brouillon plutôt que du serveur (même garde que
  // `rapport-terrain.spec.ts`).
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(designations).toHaveCount(1);
  await expect(designations.first()).toHaveValue(
    fr["terrain9i7b.e2e.designation_deux"],
  );
  await expect(references.first()).toHaveValue(
    fr["terrain9i7b.e2e.reference_deux"],
  );
  await expect(quantites.first()).toHaveValue("2");

  // DÉSIGNATION VIDE ET QUANTITÉ < 1 — REFUSÉES. La quantité se recadre à 1
  // avant même d'atteindre le serveur (`modifierPiece`, `Math.max(1, …)`) ;
  // la ligne laissée sans désignation est filtrée avant l'envoi
  // (`piecesPourEnvoi`) — ni l'une ni l'autre n'atteint jamais la base.
  await boutonAjouter.click();
  await expect(designations).toHaveCount(2);
  await quantites.nth(1).fill("0");
  await expect(quantites.nth(1)).toHaveValue("1");
  await quantites.nth(1).blur();
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(designations).toHaveCount(1);
  await expect(designations.first()).toHaveValue(
    fr["terrain9i7b.e2e.designation_deux"],
  );

  expect(await piecesServeur(CURATIF_SAISIE)).toEqual([
    {
      designation: fr["terrain9i7b.e2e.designation_deux"],
      reference: fr["terrain9i7b.e2e.reference_deux"],
      quantite: 2,
    },
  ]);
});

test("curatif, HORS RÉSEAU : la pièce saisie hors réseau se met en file, puis se rejoue au retour du réseau — présente une seule fois en base et sur la fiche bureau", async ({
  page,
  context,
}) => {
  await connecterLeTechnicien(page);
  await page.goto(`/terrain/${HORS_RESEAU}`);
  await expect(
    page.getByRole("heading", { name: fr["terrain.pieces.titre"] }),
  ).toBeVisible();

  await context.setOffline(true);
  await page
    .getByRole("button", { name: fr["terrain.pieces.ajouter"] })
    .click();
  const designation = page
    .getByLabel(fr["terrain.pieces.designation_libelle"])
    .first();
  await designation.fill(fr["terrain9i7b.e2e.designation_hors_reseau"]);
  await designation.blur();
  await expect(
    page.getByText(fr["terrain.auto.hors_ligne"]).first(),
  ).toBeVisible();

  await context.setOffline(false);
  await page.getByRole("button", { name: /^Envoyer \(\d+\)$/ }).click();
  // Le rejeu passe par le bouton global de la file, pas par l'enregistrement
  // en ligne direct : « Tout est envoyé. », jamais « Rapport enregistré. »
  // (voir `tests/e2e/offline/9f4h3a-file-sans-perte.spec.ts`).
  await expect(page.getByText(fr["terrain.file.tout_envoye"])).toBeVisible();

  expect(await piecesServeur(HORS_RESEAU)).toEqual([
    {
      designation: fr["terrain9i7b.e2e.designation_hors_reseau"],
      reference: null,
      quantite: 1,
    },
  ]);

  // LA FICHE BUREAU — même donnée, jamais une seconde lecture. On se
  // déconnecte d'abord : une session technicien déjà ouverte redirige
  // `/connexion` ailleurs avant que le formulaire ne s'affiche.
  await page.goto("/terrain/profil");
  await page
    .locator("main")
    .getByRole("button", { name: fr["nav.deconnexion"] })
    .click();
  await expect(page).toHaveURL(/\/connexion/);
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${HORS_RESEAU}`);
  await expect(
    page.getByRole("heading", { name: fr["intervention.bon.pieces_titre"] }),
  ).toBeVisible();
  await expect(
    page.getByText(
      libellePieceRemplacee({
        designation: fr["terrain9i7b.e2e.designation_hors_reseau"],
        reference: null,
        quantite: 1,
      }),
    ),
  ).toBeVisible();
});

test("lecture : la tuile « Pièces remplacées » sur le bon (client et interne) et sur la fiche, sans prix, absente si aucune ligne", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.setViewportSize({ width: 1280, height: 900 });

  const libelle = libellePieceRemplacee({
    designation: fr["terrain9i7b.e2e.designation_bon"],
    reference: null,
    quantite: 1,
  });
  const titreTuile = fr["intervention.bon.pieces_titre"];
  const regexMontant = /\d[\d ]*(?:,\d+)? (?:XPF|€)/u;

  // BON, VERSION CLIENT.
  await page.goto(`/interventions/${BON_AVEC_PIECES}/bon`);
  await expect(page.getByRole("heading", { name: titreTuile })).toBeVisible();
  await expect(page.getByText(libelle)).toBeVisible();
  const tuileClient = page.locator("section", {
    has: page.getByRole("heading", { name: titreTuile }),
  });
  expect(await tuileClient.innerText()).not.toMatch(regexMontant);
  await page
    .getByRole("heading", { name: titreTuile })
    .scrollIntoViewIfNeeded();
  await capturer(page, "bon-curatif-pieces", 1280);
  await page.emulateMedia({ media: "print" });
  await capturer(page, "bon-curatif-pieces-impression", 1280);
  await page.emulateMedia({ media: "screen" });

  // BON, VERSION INTERNE.
  await page.goto(`/interventions/${BON_AVEC_PIECES}/bon?version=interne`);
  await expect(page.getByRole("heading", { name: titreTuile })).toBeVisible();
  await expect(page.getByText(libelle)).toBeVisible();
  const tuileInterne = page.locator("section", {
    has: page.getByRole("heading", { name: titreTuile }),
  });
  expect(await tuileInterne.innerText()).not.toMatch(regexMontant);

  // FICHE BUREAU.
  await page.goto(`/interventions/${BON_AVEC_PIECES}`);
  await expect(page.getByRole("heading", { name: titreTuile })).toBeVisible();
  await expect(page.getByText(libelle)).toBeVisible();
  await page
    .getByRole("heading", { name: titreTuile })
    .scrollIntoViewIfNeeded();
  await capturer(page, "fiche-pieces", 1280);

  // ABSENTE SI AUCUNE LIGNE — même nature, même statut, zéro ligne : aucune
  // tuile vide (à la différence des tuiles voisines, qui affichent toujours
  // leur absence).
  await page.goto(`/interventions/${BON_SANS_PIECES}/bon`);
  await expect(page.getByRole("heading", { name: titreTuile })).toHaveCount(0);
  await page.goto(`/interventions/${BON_SANS_PIECES}`);
  await expect(page.getByRole("heading", { name: titreTuile })).toHaveCount(0);
});
