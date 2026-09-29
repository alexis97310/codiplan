import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9BV-TP-A5b-DATES-REPRISE (29/09/2026) — même recette que
 * `captures-tpa5-libelles.spec.ts` : rien n'est écrit sans la variable
 * d'environnement qui nomme le dossier, pour que `pnpm test:e2e` ordinaire
 * n'écrive jamais de fichier.
 *
 * **AVANT/APRÈS se prend en rejouant ce même fichier deux fois** — une fois
 * dans un `git worktree` posé sur le commit qui précède ce lot, une fois sur
 * le code livré. Aucune clé `fr[...]` n'est lue ici : sur le code AVANT, les
 * clés neuves n'existent pas encore, et `next build` type-vérifie ce fichier
 * contre le code qu'il capture (mémoire « captures-avant-apres-e2e »).
 *
 * `CAPTURES_9BV_PHASE` n'influence QUE le nom du fichier produit — jamais le
 * code exécuté, qui est toujours celui du commit sur lequel ce fichier
 * tourne.
 *
 * ## LA FICHE REPRISE EST POSÉE DIRECTEMENT, PAR SQL
 *
 * Même fixture que `reprise-bandeau.spec.ts` : un `INSERT` direct, jamais la
 * route d'import (hors périmètre de ce lot). Le fait est le même des deux
 * côtés — seul le RENDU change entre AVANT et APRÈS.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9BV ?? "";
const PHASE = process.env.CAPTURES_9BV_PHASE ?? "apres";

const CLIENT_CAPTURE = uuidv7();
const SITE_CAPTURE = uuidv7();
const INTERVENTION_REPRISE_CAPTURE = uuidv7();
const CLOTUREE_LE = new Date("2019-03-15T00:00:00.000Z");

let interventionOuverteId = "";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${PHASE}-${largeur}.png`),
    fullPage: true,
  });
}

test.beforeAll(async () => {
  if (DOSSIER === "") return;
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id, code: "DUCOS" },
      select: { id: true },
    });

    // IN-25 — n'importe quelle intervention NI clôturée NI annulée (les deux
    // statuts FIGÉS, `estFige`) : la note interne n'y est modifiable que
    // sur une fiche encore vivante, et c'est le formulaire — pas la phrase
    // de repli — qui porte `aria-labelledby` (simple LECTURE, rien n'est
    // forgé).
    const ouverte = await client.intervention.findFirstOrThrow({
      where: {
        societe_id: societe.id,
        statut: { notIn: ["cloturee", "annulee"] },
      },
      select: { id: true },
    });
    interventionOuverteId = ouverte.id;

    await client.client.create({
      data: {
        id: CLIENT_CAPTURE,
        societe_id: societe.id,
        raison_sociale: "9BV-CAPTURE — client de l'épreuve",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_CAPTURE,
        societe_id: societe.id,
        client_id: CLIENT_CAPTURE,
        agence_id: agence.id,
        libelle: "9BV-CAPTURE — site de l'épreuve",
      },
    });
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "temps_valide_min", "cloturee_le", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'cloturee', 60, $6, now())`,
      INTERVENTION_REPRISE_CAPTURE,
      societe.id,
      CLIENT_CAPTURE,
      SITE_CAPTURE,
      agence.id,
      CLOTUREE_LE,
    );
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  if (DOSSIER === "") return;
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_CAPTURE,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_CAPTURE } });
    await client.client.deleteMany({ where: { id: CLIENT_CAPTURE } });
  } finally {
    await client.$disconnect();
  }
});

for (const largeur of [1280, 375] as const) {
  test(`captures — planning, absences, trajets, fiche reprise, note interne, à ${largeur}px`, async ({
    page,
  }) => {
    test.skip(DOSSIER === "", "capture inerte sans CAPTURES_9BV");
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);

    // TR-54 — sous-titre du planning, semaine à cheval sur deux mois.
    await page.goto("/planning?semaine=2026-09-28");
    await capturer(page, "planning-sous-titre-a-cheval", largeur);

    // TR-7 — titre du calendrier des absences, même semaine à cheval.
    await page.goto("/absences?semaine=2026-09-28");
    await capturer(page, "absences-mois-a-cheval", largeur);

    // PA-24 — la ligne Grand Nouméa (30 min, sous l'heure).
    await page.goto("/parametres/trajets");
    await capturer(page, "trajets-grand-noumea", largeur);

    // IN-23 — la fiche reprise d'un import (bandeau, année, réalisation).
    await page.goto(`/interventions/${INTERVENTION_REPRISE_CAPTURE}`);
    await capturer(page, "fiche-reprise", largeur);

    // IN-25 — la note interne d'une fiche ouverte (changement
    // d'accessibilité seulement : AVANT et APRÈS se ressemblent à l'écran,
    // la différence est dans l'arbre d'accessibilité, pas dans le pixel).
    await page.goto(`/interventions/${interventionOuverteId}`);
    await capturer(page, "fiche-note-interne", largeur);
  });
}
