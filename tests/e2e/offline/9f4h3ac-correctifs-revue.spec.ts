import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "../setup/base";
import { reperesDeLaScene } from "../setup/reperes";
import {
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "../setup/scene";
import { cliquerTerminer } from "../setup/terrain-gestes";

/**
 * LES CORRECTIFS DE LA REVUE (9F4H3AC-FILE-CORRECTIFS-REVUE, point 3) — sa
 * propre scène, préfixée `9F4H3AC-`, même discipline que `9f4h3-mode-
 * avion.spec.ts` : créée en `beforeAll`, supprimée en `afterAll`, aucune
 * ligne ajoutée au semis partagé.
 *
 * UN COMPTEUR DÉMARRÉ EN LIGNE, PUIS TERMINÉ HORS RÉSEAU — avant ce
 * correctif, le verdict local de « Terminer » ne connaissait que la file des
 * saisies hors réseau ; un segment ouvert EN LIGNE (jamais passé par cette
 * file) n'y laissait aucune trace, et le refus « temps manquant » tombait à
 * tort sur le cas le plus ordinaire de tous : démarrer en ligne, perdre le
 * réseau, finir l'intervention.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_9F4H3AC = uuidv7();
const SITE_9F4H3AC = uuidv7();
const INTERVENTION_9F4H3AC = uuidv7();
const INTERVENTION_ECHEC_GARDE_9F4H3AC = uuidv7();

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
        id: CLIENT_9F4H3AC,
        societe_id: societeId,
        raison_sociale: "9F4H3AC client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9F4H3AC,
        societe_id: societeId,
        client_id: CLIENT_9F4H3AC,
        agence_id: agence.id,
        libelle: "9F4H3AC site",
      },
    });
    const commun = {
      societe_id: societeId,
      agence_id: agence.id,
      client_id: CLIENT_9F4H3AC,
      site_id: SITE_9F4H3AC,
      technicien_id: technicienId,
      type: "curatif" as const,
      priorite: "p3" as const,
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe" as const,
      devise_code: "XPF",
      description: "9F4H3AC — intervention forgée par l'épreuve",
      date_planifiee: null,
    };
    await client.intervention.create({
      data: { id: INTERVENTION_9F4H3AC, ...commun, statut: "affectee" },
    });
    // DÉJÀ EN COURS, UN SEGMENT FERMÉ CONNU DU SERVEUR (point 4) — cette
    // intervention n'a besoin d'aucun compteur démarré EN LIGNE pour son
    // propre scénario : seul un temps déjà mesuré lui suffit pour que le
    // verdict local de « Terminer » ne refuse jamais « temps manquant »,
    // et laisse voir le SEUL refus que ce second test éprouve : l'échec de
    // garde.
    await client.intervention.create({
      data: {
        id: INTERVENTION_ECHEC_GARDE_9F4H3AC,
        ...commun,
        statut: "en_cours",
      },
    });
    await client.segmentTravail.create({
      data: {
        id: uuidv7(),
        societe_id: societeId,
        intervention_id: INTERVENTION_ECHEC_GARDE_9F4H3AC,
        utilisateur_id: technicienId,
        debut: new Date(Date.now() - 60 * 60_000),
        fin: new Date(),
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = ANY($1::uuid[])`,
      [INTERVENTION_9F4H3AC, INTERVENTION_ECHEC_GARDE_9F4H3AC],
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9F4H3AC,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_9F4H3AC } });
    await client.client.deleteMany({ where: { id: CLIENT_9F4H3AC } });
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
  "docs/propositions/9F4H3AC-FILE-CORRECTIFS-REVUE/captures",
);

/**
 * EN VIEWPORT, sans `fullPage` : ce qui est visible sans défiler.
 *
 * `aDefiler`, s'il est fourni, est re-déroulé APRÈS le redimensionnement —
 * jamais avant : le contenu se réarrange entre 375 et 1280 px (plus haut,
 * plus étroit), et un défilement posé pour UNE largeur place rarement le
 * même élément dans le cadre de l'autre.
 */
async function capturer(
  page: Page,
  nom: string,
  largeur: number,
  aDefiler?: ReturnType<Page["getByText"]>,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await aDefiler?.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
  });
}

/** EN VIEWPORT, 375 ET 1280 px (point 7 du lot voisin, même discipline ici). */
async function capturerLesDeux(
  page: Page,
  nom: string,
  aDefiler?: ReturnType<Page["getByText"]>,
): Promise<void> {
  await capturer(page, nom, 375, aDefiler);
  await capturer(page, nom, 1280, aDefiler);
}

test("point 3 : démarré EN LIGNE, terminé hors réseau — envoyé sans perte, un seul segment fermé", async ({
  page,
  context,
}) => {
  await connecterLeTechnicien(page);
  await page.goto(`/terrain/${INTERVENTION_9F4H3AC}`);
  await expect(
    page.getByRole("heading", { name: fr["terrain.compteur"] }),
  ).toBeVisible();

  // ── LE COMPTEUR DÉMARRE EN LIGNE — un segment ouvert, connu du serveur ──
  await page
    .getByRole("button", { name: fr["terrain.compteur.demarrer"] })
    .click();
  await expect(
    page.getByText(fr["terrain.compteur.tourne_depuis"], { exact: false }),
  ).toBeVisible();

  const avantCoupure = admin();
  try {
    const segment = await avantCoupure.segmentTravail.findFirstOrThrow({
      where: { intervention_id: INTERVENTION_9F4H3AC, fin: null },
      select: { id: true },
    });
    // UN TEMPS MESURABLE SANS ATTENDRE RÉELLEMENT — même technique que
    // `9f4h3-mode-avion.spec.ts` : antidate le DÉBUT du segment ouvert, pas
    // l'heure de l'appareil. Posée APRÈS le `router.refresh()` du démarrage
    // (ci-dessus) : la page a déjà reçu `segmentOuvertConnu` EN LIGNE — la
    // mesure exacte de son début n'importe qu'à la fermeture SERVEUR, à
    // « Envoyer ».
    await avantCoupure.segmentTravail.update({
      where: { id: segment.id },
      data: { debut: new Date(Date.now() - 45 * 60_000) },
    });
  } finally {
    await avantCoupure.$disconnect();
  }

  // ── LE RÉSEAU TOMBE — SUR LA PAGE DÉJÀ CHARGÉE (voir l'en-tête de
  // `9f4h3-mode-avion.spec.ts` : une NAVIGATION hors réseau n'est pas
  // mesurable ici, jamais de `reload` après `setOffline`) ────────────────
  await context.setOffline(true);

  // LE RAPPORT, SAISI HORS RÉSEAU.
  await page
    .getByLabel(fr["terrain.rapport.commentaire_libelle"])
    .fill(fr["terrain.e2e.commentaire"]);
  await page.getByLabel(fr["terrain.rapport.commentaire_libelle"]).blur();
  await expect(
    page.getByText(fr["terrain.auto.hors_ligne"]).first(),
  ).toBeVisible();

  // LA SIGNATURE, SAISIE HORS RÉSEAU.
  await page
    .getByRole("button", { name: fr["terrain.signature.option_absent"] })
    .click();
  await page
    .getByLabel(fr["terrain.signature.motif_libelle"])
    .fill("Client absent au départ du technicien");
  await page.getByLabel(fr["terrain.signature.motif_libelle"]).blur();

  // « TERMINER » — AUCUNE TRACE DU DÉMARRAGE DANS LA FILE (il a eu lieu EN
  // LIGNE), et pourtant ACCEPTÉ : c'est exactement ce que ce correctif
  // corrige (avant lui, le verdict local refusait ici « temps manquant »).
  await cliquerTerminer(page);
  await expect(
    page.getByText(fr["terrain.terminer.en_attente_envoi"]),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
  ).toHaveCount(0);
  await expect(
    page.getByText(fr["intervention.refus.temps_manquant"]),
  ).toHaveCount(0);

  await capturerLesDeux(
    page,
    "fiche-hors-reseau-terminee-demarre-en-ligne",
    page.getByText(fr["terrain.terminer.en_attente_envoi"]),
  );

  // ── LE RÉSEAU REVIENT : « ENVOYER » ─────────────────────────────────────
  await context.setOffline(false);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: /^Envoyer \(\d+\)$/ }).click();
  await expect(page.getByText(fr["terrain.file.tout_envoye"])).toBeVisible();

  const verif = admin();
  try {
    const segments = await verif.segmentTravail.findMany({
      where: { intervention_id: INTERVENTION_9F4H3AC },
      select: { fin: true },
    });
    // UN SEUL SEGMENT, FERMÉ — celui démarré en ligne, fermé par le serveur
    // à l'instant du « terminer », jamais un second segment créé par erreur
    // pour le temps passé hors réseau.
    expect(segments).toHaveLength(1);
    expect(segments[0].fin).not.toBeNull();

    const intervention = await verif.intervention.findUniqueOrThrow({
      where: { id: INTERVENTION_9F4H3AC },
      select: { statut: true, temps_mesure_min: true },
    });
    expect(intervention.statut).toBe("terminee");
    expect(intervention.temps_mesure_min).not.toBeNull();
    expect(intervention.temps_mesure_min).toBeGreaterThanOrEqual(44);
  } finally {
    await verif.$disconnect();
  }
});

test("point 4 (capture) : « Terminer » hors réseau, IndexedDB brisée — l'échec de garde s'affiche, jamais « en attente d'envoi »", async ({
  page,
  context,
}) => {
  await connecterLeTechnicien(page);
  await page.goto(`/terrain/${INTERVENTION_ECHEC_GARDE_9F4H3AC}`);
  await expect(
    page.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
  ).toBeVisible();

  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: undefined,
    });
  });
  await page.reload();
  await context.setOffline(true);

  await page
    .getByLabel(fr["terrain.rapport.commentaire_libelle"])
    .fill("Capture : échec de garde au clic Terminer");
  await page.getByLabel(fr["terrain.rapport.commentaire_libelle"]).blur();

  await page
    .getByRole("button", { name: fr["terrain.signature.option_absent"] })
    .click();
  await page
    .getByLabel(fr["terrain.signature.motif_libelle"])
    .fill("Client absent au départ du technicien");
  await page.getByLabel(fr["terrain.signature.motif_libelle"]).blur();

  await cliquerTerminer(page);

  const messageEchec = page.getByText(fr["terrain.file.echec_gardee"]).first();
  await expect(messageEchec).toBeVisible();
  await expect(
    page.getByText(fr["terrain.terminer.en_attente_envoi"]),
  ).toHaveCount(0);
  // LE BOUTON RESTE — rien n'a été gardé, le geste doit pouvoir être
  // retenté plutôt que de disparaître derrière « en attente d'envoi ».
  await expect(
    page.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
  ).toBeVisible();

  await capturerLesDeux(page, "echec-de-garde-au-clic-terminer", messageEchec);
});
