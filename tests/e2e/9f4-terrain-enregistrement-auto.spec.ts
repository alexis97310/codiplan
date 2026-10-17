import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";

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
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_AVION,
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

test("mode avion : la saisie s'enregistre seule au retour du réseau, puis Terminer", async ({
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

  // ── LE RÉSEAU REVIENT : L'ENVOI EN ATTENTE PART SEUL ─────────────────────
  await context.setOffline(false);

  await expect(page.getByText(fr["terrain.rapport.enregistre"])).toBeVisible();
  await capturer(page, "terrain-fiche-en-saisie", 375);
  await capturer(page, "terrain-fiche-en-saisie", 1280);

  // ── TERMINER : le temps et la signature pré-semés suffisent désormais ───
  await page
    .getByRole("button", { name: fr["terrain.terminer.bouton"] })
    .click();
  await expect(
    page.getByText(fr["statut.terminee"], { exact: true }),
  ).toBeVisible();
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

  await page
    .getByRole("button", { name: fr["terrain.terminer.bouton"] })
    .click();

  await expect(
    page.getByText(fr["intervention.refus.temps_manquant"]),
  ).toBeVisible();
  await capturer(page, "terrain-terminer-incomplet", 375);
  await capturer(page, "terrain-terminer-incomplet", 1280);
});
