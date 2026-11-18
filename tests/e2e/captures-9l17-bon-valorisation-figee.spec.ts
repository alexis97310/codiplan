import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9L17-BON-INTERNE-VALORISATION-FIGEE — même recette que
 * `captures-9eq-fiche-onglets.spec.ts` : rien n'est écrit sans
 * `CAPTURES_9L17` (le dossier), et `CAPTURES_9L17_PHASE` choisit entre
 * `avant` et `apres` (par défaut `apres`), pour que `pnpm test:e2e`
 * ordinaire n'écrive jamais de fichier.
 *
 * ## LE SCÉNARIO : une clôture ANTÉRIEURE à 9I8A1-REPRISE-9I8A
 *
 * Une intervention insérée DÉJÀ close, `valorisation_figee` jamais posée,
 * mais `montant_ht`/`devise_code` bien écrits — exactement ce qu'une ligne
 * d'avant cette migration porte encore. AVANT ce ticket, le bon relisait le
 * barème en direct : sans aucune ligne de `taux_horaire` couvrant la date de
 * l'intervention, il affichait « Aucun taux horaire n'est en vigueur… » et
 * TAISAIT le total pourtant bien écrit en base. APRÈS, il nomme l'ancienneté
 * et reprend ce total.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `9L17-CAP-` — créée en `beforeAll`, supprimée en
 * `afterAll`, aucune ligne du semis.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9L17 ?? "";
const PHASE = process.env.CAPTURES_9L17_PHASE === "avant" ? "avant" : "apres";

const CLIENT_9L17CAP = uuidv7();
const SITE_9L17CAP = uuidv7();
const INTERVENTION_ANCIENNE = uuidv7();
const MONTANT_HT_ANCIEN = BigInt(123456);

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const societe = await client.societe.findFirstOrThrow({
      where: { id: reperes.societeId },
      select: { devise_code: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_9L17CAP,
        societe_id: reperes.societeId,
        raison_sociale: fr["9l17.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9L17CAP,
        societe_id: reperes.societeId,
        client_id: CLIENT_9L17CAP,
        agence_id: agence.id,
        libelle: fr["9l17.e2e.lieu"],
      },
    });

    // INSÉRÉE DIRECTEMENT « cloturee » (I5/D160 : une intervention close ne
    // se modifie plus) — SANS `valorisation_figee`, AVEC `montant_ht` et
    // `devise_code` : exactement ce qu'une clôture d'avant 9I8A1-REPRISE-9I8A
    // porte encore.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id",
          "type", "priorite", "statut", "mode_valorisation",
          "temps_valide_min", "montant_ht", "devise_code", "cloturee_le", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
               'curatif', 'p3', 'cloturee', 'temps_passe'::"ModeValorisation",
               90, $6, $7, now() - interval '60 days', now())`,
      INTERVENTION_ANCIENNE,
      reperes.societeId,
      CLIENT_9L17CAP,
      SITE_9L17CAP,
      agence.id,
      MONTANT_HT_ANCIEN,
      societe.devise_code,
    );
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9L17CAP,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_9L17CAP } });
    await client.client.deleteMany({ where: { id: CLIENT_9L17CAP } });
  } finally {
    await client.$disconnect();
  }
});

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

for (const largeur of [1280, 375] as const) {
  test(`capture ${PHASE.toUpperCase()} — bon d'une clôture ancienne à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto(
      `/interventions/${INTERVENTION_ANCIENNE}/bon?version=interne`,
    );
    await capturer(page, `bon-ancienne-${PHASE}`, largeur);
  });
}
