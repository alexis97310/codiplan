import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import { formatAdresseSite } from "@/lib/interventions/bon";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { cliquerTerminer } from "./setup/terrain-gestes";

/**
 * 9F4-TERRAIN-ENREGISTREMENT-AUTO (décision d'Alexis n° 95) — DEUX GARANTIES
 * QUE LES ÉPREUVES EXISTANTES NE MESURAIENT PAS.
 *
 * ## LA DÉ-DUPLICATION DE SIGNATURE
 *
 * L'enregistrement automatique peut renvoyer la MÊME signature plusieurs
 * fois (réouverture d'onglet, retry réseau) — `tests/isolation/rapport-
 * terrain.test.ts` le mesure déjà au DÉPÔT ; ce fichier le mesure à la
 * ROUTE, en JSON, comme l'écran l'appelle réellement.
 *
 * ## LE MODE AVION (I4)
 *
 * Le compteur (démarrer/pause) est HORS TERRITOIRE de ce ticket — ce
 * scénario pré-sème donc un temps déjà mesuré (segment fermé) et une
 * signature déjà recueillie directement en base, pour isoler ce qui est
 * réellement neuf : le rapport s'enregistre tout seul, y compris quand la
 * page reste ouverte sans réseau, et s'envoie au retour de celui-ci — sans
 * qu'aucune saisie ait jamais déclenché un rechargement.
 *
 * **Aucune prestation n'est créée ici** : le catalogue de `CODIMA-NC` est
 * PARTAGÉ par tous les fichiers e2e joués en parallèle (`fullyParallel`) —
 * `tests/e2e/rapport-terrain.spec.ts` mesure justement qu'il est VIDE pour
 * cette société ; y ajouter une ligne ferait échouer ce témoin ailleurs,
 * au hasard de l'ordonnancement des workers. L'envoi immédiat des
 * prestations au changement est déjà éprouvé à l'unité
 * (`tests/unit/terrain/rapport-automatique.test.tsx`).
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9F4-`, SANS TOUCHER À `setup/scene.ts`
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9F4-TERRAIN-ENREGISTREMENT-AUTO/captures",
);

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

// — 9F4A-TERMINER-SANS-PERTE, point 5 — SA PROPRE PROPOSITION, SON PROPRE
// DOSSIER DE CAPTURES, EN VIEWPORT (jamais `fullPage`) : c'est ce qu'un
// technicien voit sans faire défiler, sous le bouton « Terminer ».
const DOSSIER_CAPTURES_9F4A = join(
  process.cwd(),
  "docs/propositions/9F4A-TERMINER-SANS-PERTE/captures",
);

/**
 * Descend tout en bas AVANT de capturer — la barre basse du terrain est EN
 * POSITION FIXE (QE-11, D161) : elle recouvre le bas du viewport sans que
 * Playwright la compte comme un obstacle, et le message visé vit juste
 * au-dessus du bouton « Terminer », tout en bas de la page.
 */
async function capturerViewport(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES_9F4A, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.screenshot({
    path: join(DOSSIER_CAPTURES_9F4A, `${nom}-${largeur}.png`),
  });
}

async function ouvrirLaSessionDuTerrain(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const INTERVENTION_DUP = uuidv7();
const INTERVENTION_AVION = uuidv7();
const INTERVENTION_INCOMPLETE = uuidv7();
const SEGMENT_ID = uuidv7();
const SIGNATURE_PREALABLE_ID = uuidv7();
// — 9F4A-TERMINER-SANS-PERTE, point 4 —
const INTERVENTION_ROUTE_INTERCEPTEE = uuidv7();
const SEGMENT_INTERCEPTEE_ID = uuidv7();
const SIGNATURE_INTERCEPTEE_ID = uuidv7();
const INTERVENTION_SEGMENT_OUVERT = uuidv7();
const SIGNATURE_SEGMENT_OUVERT_ID = uuidv7();
const INTERVENTION_CAPTURES = uuidv7();
const SEGMENT_CAPTURES_ID = uuidv7();
const SIGNATURE_CAPTURES_ID = uuidv7();
// — 9G8-TERRAIN-CONFIRMATIONS-ET-ACCES, D220 —
const INTERVENTION_REOUVERTURE = uuidv7();
const SEGMENT_REOUVERTURE_ID = uuidv7();
const SIGNATURE_REOUVERTURE_ID = uuidv7();

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: "zz9F4 Client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "zz9F4 Site",
        // L'ADRESSE ET LA COMMUNE (défaut mesuré en ligne par Alexis le
        // 21/10/2026, 9G8-TERRAIN-CONFIRMATIONS-ET-ACCES) — voir le test
        // dédié ci-dessous.
        adresse: { rue: "12 rue des Tests" },
        commune: "Dumbéa",
      },
    });
    const commun = {
      societe_id: reperes.societeId,
      agence_id: agence.id,
      client_id: CLIENT_ID,
      site_id: SITE_ID,
      technicien_id: reperes.technicienDucos,
      type: "curatif" as const,
      mode_valorisation: "temps_passe" as const,
      devise_code: "XPF",
      date_planifiee: new Date(),
    };

    // — POUR LA DÉ-DUPLICATION : n'importe quel statut non figé suffit.
    await client.intervention.create({
      data: {
        id: INTERVENTION_DUP,
        statut: "affectee",
        priorite: "p3",
        duree_estimee_min: 30,
        ...commun,
      },
    });

    // — POUR LE MODE AVION : EN COURS, un temps déjà mesuré et une
    // signature déjà recueillie — le compteur est hors territoire de ce
    // ticket (voir l'en-tête).
    await client.intervention.create({
      data: {
        id: INTERVENTION_AVION,
        statut: "en_cours",
        priorite: "p3",
        duree_estimee_min: 30,
        ...commun,
      },
    });
    await client.segmentTravail.create({
      data: {
        id: SEGMENT_ID,
        societe_id: reperes.societeId,
        intervention_id: INTERVENTION_AVION,
        utilisateur_id: reperes.technicienDucos,
        debut: new Date(Date.now() - 60 * 60_000),
        fin: new Date(),
      },
    });
    await client.interventionSignature.create({
      data: {
        id: SIGNATURE_PREALABLE_ID,
        societe_id: reperes.societeId,
        intervention_id: INTERVENTION_AVION,
        issue: "client_absent",
        motif: "Préalable de scène — hors territoire de ce lot.",
      },
    });

    // — POUR LE MESSAGE « TERMINER INCOMPLET » : EN COURS, sans aucun temps
    // mesuré ni signature — le bouton reste affiché (9F4 : le refus ne le
    // remplace plus) et le motif du serveur s'affiche dessous au clic.
    await client.intervention.create({
      data: {
        id: INTERVENTION_INCOMPLETE,
        statut: "en_cours",
        priorite: "p3",
        duree_estimee_min: 30,
        ...commun,
      },
    });

    // — POUR LA ROUTE INTERCEPTÉE (9F4A, point 4a) : même préalable que le
    // mode avion — un temps déjà mesuré et une signature déjà recueillie —
    // pour isoler ce qui est neuf : Terminer refuse tant que le rapport
    // n'est pas parti, jamais au prix de la saisie.
    await client.intervention.create({
      data: {
        id: INTERVENTION_ROUTE_INTERCEPTEE,
        statut: "en_cours",
        priorite: "p3",
        duree_estimee_min: 30,
        ...commun,
      },
    });
    await client.segmentTravail.create({
      data: {
        id: SEGMENT_INTERCEPTEE_ID,
        societe_id: reperes.societeId,
        intervention_id: INTERVENTION_ROUTE_INTERCEPTEE,
        utilisateur_id: reperes.technicienDucos,
        debut: new Date(Date.now() - 60 * 60_000),
        fin: new Date(),
      },
    });
    await client.interventionSignature.create({
      data: {
        id: SIGNATURE_INTERCEPTEE_ID,
        societe_id: reperes.societeId,
        intervention_id: INTERVENTION_ROUTE_INTERCEPTEE,
        issue: "client_absent",
        motif: "Préalable de scène — hors territoire de ce lot.",
      },
    });

    // — POUR LE SEGMENT OUVERT, JAMAIS MIS EN PAUSE (9F4A, point 4b) : EN
    // COURS, signature déjà recueillie, AUCUN segment pré-semé — le
    // scénario démarre lui-même le compteur, pour éprouver que « Terminer »
    // ferme le segment ouvert et compte son temps, sans qu'une pause soit
    // jamais passée (le piège du temps mesuré sur les seuls segments fermés).
    await client.intervention.create({
      data: {
        id: INTERVENTION_SEGMENT_OUVERT,
        statut: "en_cours",
        priorite: "p3",
        duree_estimee_min: 30,
        ...commun,
      },
    });
    await client.interventionSignature.create({
      data: {
        id: SIGNATURE_SEGMENT_OUVERT_ID,
        societe_id: reperes.societeId,
        intervention_id: INTERVENTION_SEGMENT_OUVERT,
        issue: "client_absent",
        motif: "Préalable de scène — hors territoire de ce lot.",
      },
    });

    // — POUR LES CAPTURES DU POINT 5 : même préalable que la route
    // interceptée, pour que « Terminer » n'ait plus que le rapport à juger.
    await client.intervention.create({
      data: {
        id: INTERVENTION_CAPTURES,
        statut: "en_cours",
        priorite: "p3",
        duree_estimee_min: 30,
        ...commun,
      },
    });
    await client.segmentTravail.create({
      data: {
        id: SEGMENT_CAPTURES_ID,
        societe_id: reperes.societeId,
        intervention_id: INTERVENTION_CAPTURES,
        utilisateur_id: reperes.technicienDucos,
        debut: new Date(Date.now() - 60 * 60_000),
        fin: new Date(),
      },
    });
    await client.interventionSignature.create({
      data: {
        id: SIGNATURE_CAPTURES_ID,
        societe_id: reperes.societeId,
        intervention_id: INTERVENTION_CAPTURES,
        issue: "client_absent",
        motif: "Préalable de scène — hors territoire de ce lot.",
      },
    });

    // — POUR LA RÉOUVERTURE (D220, 9G8-TERRAIN-CONFIRMATIONS-ET-ACCES) :
    // déjà TERMINÉE, avec un temps mesuré et une signature — démarrer de
    // nouveau doit reposer la question, puis rendre « Terminer » actif
    // SANS rechargement de la page.
    await client.intervention.create({
      data: {
        id: INTERVENTION_REOUVERTURE,
        statut: "terminee",
        priorite: "p3",
        duree_estimee_min: 30,
        ...commun,
      },
    });
    await client.segmentTravail.create({
      data: {
        id: SEGMENT_REOUVERTURE_ID,
        societe_id: reperes.societeId,
        intervention_id: INTERVENTION_REOUVERTURE,
        utilisateur_id: reperes.technicienDucos,
        debut: new Date(Date.now() - 60 * 60_000),
        fin: new Date(),
      },
    });
    await client.interventionSignature.create({
      data: {
        id: SIGNATURE_REOUVERTURE_ID,
        societe_id: reperes.societeId,
        intervention_id: INTERVENTION_REOUVERTURE,
        issue: "client_absent",
        motif: "Préalable de scène — hors territoire de ce lot.",
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
      [
        INTERVENTION_AVION,
        INTERVENTION_ROUTE_INTERCEPTEE,
        INTERVENTION_SEGMENT_OUVERT,
        INTERVENTION_CAPTURES,
        INTERVENTION_REOUVERTURE,
      ],
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_ID,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

test("deux envois de signature identiques ne créent qu'UNE ligne", async ({
  page,
}) => {
  await ouvrirLaSessionDuTerrain(page);
  const corps = {
    issue: "signee",
    image_base64: "data:image/png;base64,AAAA",
    signataire_nom: fr["terrain.e2e.signataire_nom"],
  };

  const premier = await page.request.post(
    `/api/terrain/${INTERVENTION_DUP}/signature`,
    { form: corps, headers: { Accept: "application/json" } },
  );
  expect((await premier.json()).ok).toBe(true);

  const second = await page.request.post(
    `/api/terrain/${INTERVENTION_DUP}/signature`,
    { form: corps, headers: { Accept: "application/json" } },
  );
  expect((await second.json()).ok).toBe(true);

  const client = admin();
  try {
    const [{ n }] = await client.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS "n" FROM "intervention_signature" WHERE "intervention_id" = '${INTERVENTION_DUP}'`,
    );
    expect(Number(n)).toBe(1);
  } finally {
    await client.$disconnect();
  }
});

test("mode avion : la saisie reste gardée hors connexion, puis Terminer la renvoie en ligne", async ({
  page,
  context,
}) => {
  await ouvrirLaSessionDuTerrain(page);
  await page.goto(`/terrain/${INTERVENTION_AVION}`);

  // LA PAGE RESTE OUVERTE, JAMAIS RECHARGÉE HORS CONNEXION (le service
  // worker ne met aucune page authentifiée en cache — un rechargement ici
  // donnerait l'erreur du navigateur, pas la page).
  await context.setOffline(true);

  await page
    .getByLabel(fr["terrain.rapport.commentaire_libelle"])
    .fill(fr["terrain.e2e.commentaire"]);
  await page.getByLabel(fr["terrain.rapport.commentaire_libelle"]).blur();

  await expect(
    page.getByText(fr["terrain.auto.hors_ligne"]).first(),
  ).toBeVisible();
  await capturer(page, "terrain-hors-connexion", 375);
  await capturer(page, "terrain-hors-connexion", 1280);

  // ── LE RÉSEAU REVIENT : AUCUN ENVOI AUTOMATIQUE (9F4H3-HORS-RESEAU-
  // ENVOYER, décision n° 105 d'Alexis) — REMPLACE l'ancien comportement de
  // ce test, qui renvoyait seul au retour du réseau. Le commentaire reste
  // gardé dans la file hors réseau (point 1), MAIS « Terminer » ci-dessous
  // renvoie aussi le rapport lui-même par son propre `flushTout` (inchangé,
  // en ligne) avant d'appeler `/terminer` — l'entrée de la file, devenue
  // redondante, restera en attente jusqu'à un « Envoyer » qui ne trouvera
  // alors plus rien à y changer (le dépôt du rapport est un remplacement,
  // pas un ajout).
  await context.setOffline(false);
  await capturer(page, "terrain-fiche-en-saisie", 375);
  await capturer(page, "terrain-fiche-en-saisie", 1280);

  // ── TERMINER : le temps et la signature pré-semés suffisent désormais ───
  await cliquerTerminer(page);
  await expect(
    page.getByText(fr["statut.terminee"], { exact: true }),
  ).toBeVisible();
});

test("l'adresse et la commune du site s'affichent sur la fiche terrain, sans aucun montant", async ({
  page,
}) => {
  const client = admin();
  let site;
  try {
    site = await client.site.findUniqueOrThrow({
      where: { id: SITE_ID },
      select: { adresse: true, commune: true },
    });
  } finally {
    await client.$disconnect();
  }

  await ouvrirLaSessionDuTerrain(page);
  await page.goto(`/terrain/${INTERVENTION_INCOMPLETE}`);

  // MÊME FONCTION que la fiche elle-même (`formatAdresseSite`) — jamais une
  // reconstruction à la main du texte attendu, qui divergerait en silence
  // du vrai format le jour où celui-ci change.
  await expect(
    page.getByText(formatAdresseSite(site.adresse, site.commune) ?? ""),
  ).toBeVisible();
  // AUCUN montant — jamais la forme que `formatMoney` produit (chiffres
  // groupés par milliers, espace insécable, devise) dans le texte de la
  // fiche (même contrôle que `tests/e2e/offline/9f4h1-consultation.spec.ts`).
  const texteFiche = await page.locator("main").innerText();
  expect(texteFiche).not.toMatch(/\d[\d ]*(?:,\d+)? (?:XPF|€)/u);
});

test("le bouton Terminer reste affiché, incomplet : le motif du serveur s'affiche dessous", async ({
  page,
}) => {
  await ouvrirLaSessionDuTerrain(page);
  await page.goto(`/terrain/${INTERVENTION_INCOMPLETE}`);

  // LE REFUS NE REMPLACE PLUS LE BOUTON (9F4 : corrige le piège du temps
  // mesuré sur les seuls segments fermés) — il reste affiché, cliquable,
  // et le serveur reste seul juge au clic.
  await expect(
    page.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
  ).toBeVisible();

  await cliquerTerminer(page);

  await expect(
    page.getByText(fr["intervention.refus.temps_manquant"]),
  ).toBeVisible();
  await capturer(page, "terrain-terminer-incomplet", 375);
  await capturer(page, "terrain-terminer-incomplet", 1280);
});

test("9F4A — une route interceptée bloque Terminer, garde le brouillon, puis termine une fois le réseau revenu", async ({
  page,
}) => {
  await ouvrirLaSessionDuTerrain(page);
  await page.goto(`/terrain/${INTERVENTION_ROUTE_INTERCEPTEE}`);

  let intercepte = 0;
  await page.route(
    `**/api/terrain/${INTERVENTION_ROUTE_INTERCEPTEE}/rapport`,
    (route) => {
      intercepte += 1;
      return route.abort("failed");
    },
  );

  const champ = page.getByLabel(fr["terrain.rapport.commentaire_libelle"]);
  await champ.fill(fr["terrain9f4a.e2e.commentaire"]);
  await champ.blur();
  await expect(page.getByText(fr["terrain.auto.hors_ligne"])).toBeVisible();

  await cliquerTerminer(page);
  await expect(
    page.getByText(fr["terrain.terminer.sans_reseau"]),
  ).toBeVisible();
  expect(intercepte).toBeGreaterThan(0);

  // ── EN BASE, L'INTERVENTION RESTE « EN COURS » — LA SAISIE N'A JAMAIS
  // ÉTÉ PERDUE SOUS UN « TERMINÉE » QUI NE LA PORTERAIT PAS ──────────────
  const admin1 = admin();
  try {
    const ligne = await admin1.intervention.findUniqueOrThrow({
      where: { id: INTERVENTION_ROUTE_INTERCEPTEE },
      select: { statut: true, commentaire_technicien: true },
    });
    expect(ligne.statut).toBe("en_cours");
    expect(ligne.commentaire_technicien).not.toBe(
      fr["terrain9f4a.e2e.commentaire"],
    );
  } finally {
    await admin1.$disconnect();
  }

  // ── LE BROUILLON EST REPRIS AU RECHARGEMENT ──────────────────────────────
  await page.reload();
  await expect(champ).toHaveValue(fr["terrain9f4a.e2e.commentaire"]);

  // ── LE RÉSEAU REVIENT : « TERMINER » RÉUSSIT, LE RAPPORT EST EN BASE ─────
  await page.unroute(
    `**/api/terrain/${INTERVENTION_ROUTE_INTERCEPTEE}/rapport`,
  );
  await cliquerTerminer(page);
  await expect(
    page.getByText(fr["statut.terminee"], { exact: true }),
  ).toBeVisible();

  const admin2 = admin();
  try {
    const ligne = await admin2.intervention.findUniqueOrThrow({
      where: { id: INTERVENTION_ROUTE_INTERCEPTEE },
      select: { statut: true, commentaire_technicien: true },
    });
    expect(ligne.statut).toBe("terminee");
    expect(ligne.commentaire_technicien).toBe(
      fr["terrain9f4a.e2e.commentaire"],
    );
  } finally {
    await admin2.$disconnect();
  }
});

test("9F4A — un segment ouvert, jamais mis en pause, se ferme et compte au Terminer", async ({
  page,
}) => {
  await ouvrirLaSessionDuTerrain(page);
  await page.goto(`/terrain/${INTERVENTION_SEGMENT_OUVERT}`);

  // L'INTERVENTION EST SEMÉE DÉJÀ « EN COURS » (comme un redémarrage de
  // page) : le bouton porte donc le libellé « Reprendre », jamais
  // « Démarrer l'intervention » — réservé aux statuts qui ne l'ont pas
  // encore ouverte (D8, D160). Le geste posé (`demarrer`) est le même.
  await page
    .getByRole("button", { name: fr["terrain.compteur.reprendre"] })
    .click();
  await expect(
    page.getByText(
      new RegExp(`${fr["terrain.compteur.tourne_depuis"]} \\d{2}:\\d{2}`),
    ),
  ).toBeVisible();

  // Recule le DÉBUT du segment ouvert, pour que l'écart mesure plus que
  // zéro minute sans attendre réellement (même geste que les voisins du
  // compteur) — JAMAIS de pause : c'est tout l'objet de l'épreuve.
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `UPDATE "segment_travail" SET "debut" = "debut" - interval '70 minutes'
        WHERE "intervention_id" = $1::uuid AND "fin" IS NULL`,
      INTERVENTION_SEGMENT_OUVERT,
    );
  } finally {
    await client.$disconnect();
  }

  await cliquerTerminer(page);
  await expect(
    page.getByText(fr["statut.terminee"], { exact: true }),
  ).toBeVisible();

  const verif = admin();
  try {
    const ligne = await verif.intervention.findUniqueOrThrow({
      where: { id: INTERVENTION_SEGMENT_OUVERT },
      select: { statut: true, temps_mesure_min: true },
    });
    expect(ligne.statut).toBe("terminee");
    expect(ligne.temps_mesure_min).not.toBeNull();
    expect(ligne.temps_mesure_min ?? 0).toBeGreaterThan(0);
  } finally {
    await verif.$disconnect();
  }
});

test("D220 — rouvrir une intervention « terminée » pose la question, puis « Terminer » redevient actif sans recharger", async ({
  page,
}) => {
  await ouvrirLaSessionDuTerrain(page);
  await page.goto(`/terrain/${INTERVENTION_REOUVERTURE}`);

  await expect(
    page.getByText(fr["statut.terminee"], { exact: true }),
  ).toBeVisible();
  // « Terminer » a disparu — l'intervention est déjà terminée.
  await expect(
    page.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
  ).toHaveCount(0);

  await page
    .getByRole("button", { name: fr["terrain.compteur.demarrer"] })
    .click();
  await expect(
    page.getByText(fr["terrain.compteur.reouverture.titre"]),
  ).toBeVisible();

  await page
    .getByRole("button", { name: fr["terrain.compteur.reouverture.oui"] })
    .click();
  await expect(
    page.getByText(
      new RegExp(`${fr["terrain.compteur.tourne_depuis"]} \\d{2}:\\d{2}`),
    ),
  ).toBeVisible();

  // « TERMINER » EST ACTIF IMMÉDIATEMENT — SANS AUCUN RECHARGEMENT DE PAGE
  // (le défaut mesuré par Alexis le 21/10/2026) : cliquer dessus doit
  // terminer l'intervention de nouveau, tout de suite.
  await cliquerTerminer(page);
  await expect(
    page.getByText(fr["statut.terminee"], { exact: true }),
  ).toBeVisible();

  const verif = admin();
  try {
    const ligne = await verif.intervention.findUniqueOrThrow({
      where: { id: INTERVENTION_REOUVERTURE },
      select: { statut: true },
    });
    expect(ligne.statut).toBe("terminee");
  } finally {
    await verif.$disconnect();
  }
});

test("9F4A — captures : le message nommé sous « Terminer », refusé puis sans réseau", async ({
  page,
}) => {
  await ouvrirLaSessionDuTerrain(page);
  await page.goto(`/terrain/${INTERVENTION_CAPTURES}`);

  // ── LE SERVEUR REFUSE LE RAPPORT, AVEC UN MOTIF (jamais un réseau absent) ─
  await page.route(`**/api/terrain/${INTERVENTION_CAPTURES}/rapport`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, motif: "terrain.rapport.refus" }),
    }),
  );
  const champ = page.getByLabel(fr["terrain.rapport.commentaire_libelle"]);
  await champ.fill(fr["terrain9f4a.e2e.commentaire"]);
  await champ.blur();
  await expect(page.getByText(fr["terrain.rapport.refus"])).toBeVisible();

  await cliquerTerminer(page);
  const messageRefuse = page.getByText(
    `${fr["terrain.terminer.rapport_non_enregistre"]}${fr["terrain.rapport.refus"]}`,
  );
  await expect(messageRefuse).toBeVisible();
  await capturerViewport(page, "terrain-terminer-rapport-non-enregistre", 375);
  await capturerViewport(page, "terrain-terminer-rapport-non-enregistre", 1280);

  // ── LE RÉSEAU LUI-MÊME EST ABSENT (jamais un refus structuré) ────────────
  await page.unroute(`**/api/terrain/${INTERVENTION_CAPTURES}/rapport`);
  await page.route(`**/api/terrain/${INTERVENTION_CAPTURES}/rapport`, (route) =>
    route.abort("failed"),
  );
  await champ.fill(`${fr["terrain9f4a.e2e.commentaire"]} — bis`);
  await champ.blur();
  await expect(page.getByText(fr["terrain.auto.hors_ligne"])).toBeVisible();

  await cliquerTerminer(page);
  const messageSansReseau = page.getByText(fr["terrain.terminer.sans_reseau"]);
  await expect(messageSansReseau).toBeVisible();
  await capturerViewport(page, "terrain-terminer-sans-reseau", 375);
  await capturerViewport(page, "terrain-terminer-sans-reseau", 1280);
});
