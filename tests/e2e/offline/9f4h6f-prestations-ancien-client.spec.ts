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

/**
 * 9F4H6F-PRESTATIONS-ANCIEN-CLIENT, point 5 — CAPTURE de l'effet, à l'écran,
 * du refus nommé d'un ANCIEN envoi « ensemble » (`prestation_id`). La route
 * elle-même est déjà éprouvée par `tests/unit/interventions/terrain-
 * routes-json.test.ts` (refus nommé, rien n'est écrit) ; ce fichier montre
 * ce que voit le technicien.
 *
 * **Le message agrégé de « Terminer », jamais l'indicateur en ligne** —
 * `Indicateur`/`texteIndicatif` (`components/terrain/rapport-automatique.
 * tsx`) affiche un texte GÉNÉRIQUE pour tout échec en ligne, quel que soit
 * son motif réel ; seul `onClickTerminer`, qui agrège le verdict de
 * `flushTout` et applique `texteDuMotif(verdict.prestations.motifCle)`,
 * rend le motif EXACT retourné par le serveur. Capturer le motif précis
 * demande donc de passer par « Terminer », pas par un simple clic sur une
 * case.
 *
 * **Une réponse simulée, jamais un corps `prestation_id` reconstruit à la
 * main** — reconstruire un corps `multipart/form-data` fidèle à un ANCIEN
 * client dans `page.route()` n'aurait rien prouvé de plus que l'épreuve
 * unitaire de la route (qui l'éprouve déjà, avec un vrai `FormData`) : ce
 * qui manque ICI, c'est la preuve que l'ÉCRAN affiche le bon texte quand le
 * serveur répond ce refus — la réponse est donc simulée directement.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_9F4H6F = uuidv7();
const SITE_9F4H6F = uuidv7();
const INTERVENTION_9F4H6F = uuidv7();
const PRESTATION_X = uuidv7();
const LIBELLE_X = fr["terrain9f4h6f.e2e.prestation_x"];

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
        id: CLIENT_9F4H6F,
        societe_id: societeId,
        raison_sociale: "9F4H6F client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9F4H6F,
        societe_id: societeId,
        client_id: CLIENT_9F4H6F,
        agence_id: agence.id,
        libelle: "9F4H6F site",
      },
    });
    await client.prestation.create({
      data: {
        id: PRESTATION_X,
        societe_id: societeId,
        code: "9F4H6F-X",
        libelle: LIBELLE_X,
        actif: true,
      },
    });

    await client.intervention.create({
      data: {
        id: INTERVENTION_9F4H6F,
        societe_id: societeId,
        agence_id: agence.id,
        client_id: CLIENT_9F4H6F,
        site_id: SITE_9F4H6F,
        technicien_id: technicienId,
        type: "curatif",
        priorite: "p3",
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9F4H6F — intervention forgée par l'épreuve",
        statut: "en_cours",
        date_planifiee: null,
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
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      INTERVENTION_9F4H6F,
    );
    await client.prestation.deleteMany({ where: { id: PRESTATION_X } });
    await client.site.deleteMany({ where: { client_id: CLIENT_9F4H6F } });
    await client.client.deleteMany({ where: { id: CLIENT_9F4H6F } });
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
  "docs/propositions/9F4H6F-PRESTATIONS-ANCIEN-CLIENT/captures",
);

/**
 * EN VIEWPORT, sans `fullPage` : ce qui est visible sans défiler — SAUF
 * `cibler`, ramené dans le cadre APRÈS le redimensionnement (changer la
 * largeur change la hauteur du contenu au-dessus, donc sa position).
 */
async function capturer(
  page: Page,
  nom: string,
  largeur: number,
  cibler?: ReturnType<Page["getByText"]>,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  if (cibler !== undefined) {
    await cibler.evaluate((element) =>
      element.scrollIntoView({ block: "center" }),
    );
    await page.waitForTimeout(100);
  }
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
  });
}

test("un ANCIEN CLIENT refusé nommément : le motif exact apparaît sous « Terminer », jamais un `{ok: true}` silencieux", async ({
  page,
}) => {
  await connecterLeTechnicien(page);
  await page.goto(`/terrain/${INTERVENTION_9F4H6F}`);
  await expect(
    page.getByRole("heading", { name: fr["terrain.compteur"] }),
  ).toBeVisible();

  // LE SERVEUR RÉEL REFUSE DÉJÀ CETTE FORME (voir le docblock de tête) —
  // cette réponse simulée fait seulement l'économie d'un corps
  // `multipart/form-data` reconstruit à la main pour `prestation_id`.
  await page.route(
    `**/api/terrain/${INTERVENTION_9F4H6F}/prestations`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          motif: "terrain.prestations.ancien_client",
        }),
      });
    },
  );

  const caseX = page.getByRole("checkbox", { name: LIBELLE_X, exact: true });
  await caseX.check();

  await page
    .getByRole("button", { name: fr["terrain.terminer.bouton"] })
    .click();

  const messageAttendu =
    fr["terrain.terminer.prestations_non_enregistrees"] +
    fr["terrain.prestations.ancien_client"];
  const messageAffiche = page.getByText(messageAttendu);
  await expect(messageAffiche).toBeVisible();

  await capturer(page, "fiche-ancien-client-refuse", 375, messageAffiche);
  await capturer(page, "fiche-ancien-client-refuse", 1280, messageAffiche);
});
