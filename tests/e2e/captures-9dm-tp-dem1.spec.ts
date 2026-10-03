import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9DM-TP-DEM1-TRAITEES-REUTILISATION (D164) — même recette
 * que `captures-9bl-tp-a1-historiques.spec.ts` : rien n'est écrit sans une
 * variable d'environnement qui nomme le dossier, pour que l'exécution
 * ordinaire de `pnpm test:e2e` n'écrive jamais de fichier.
 *
 * Quatre écrans, à 1280 et 375 px : `/demandes` (onglet « À traiter », qui
 * existe déjà AVANT ce lot), `/demandes?onglet=traitees` (vide sur le code
 * d'AVANT, où le paramètre n'existait pas — le même écran que « À traiter »
 * s'affiche alors, ce qui est la preuve même de l'absence), la fiche d'une
 * demande avec son motif de clôture vide et le refus `motif_requis` (porté
 * par `?motif=` — aucun geste ne le déclenche, la fiche l'affiche dès que le
 * paramètre nomme une clé du dictionnaire), et la création d'une intervention
 * depuis une demande déjà transformée (refus NOMMÉ, vide sur le code
 * d'AVANT où `?demande=` ne vérifiait aucun statut).
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le lot, une fois sur le code livré — jamais en comparant
 * deux fichiers distincts.
 */

test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9DM ?? "";

const CLIENT_CAP = "cccccccc-0000-7000-8000-000000009d1a";
const SITE_CAP = "cccccccc-0000-7000-8000-000000009d1b";
const DEMANDE_CAP_TRANSFORMEE = "cccccccc-0000-7000-8000-000000009d1c";
const DEMANDE_CAP_CLOSE = "cccccccc-0000-7000-8000-000000009d1d";
const DEMANDE_CAP_QUALIFIEE = "cccccccc-0000-7000-8000-000000009d1e";
const INTERVENTION_CAP = "cccccccc-0000-7000-8000-000000009d1f";
const TOUTES_LES_DEMANDES = [
  DEMANDE_CAP_TRANSFORMEE,
  DEMANDE_CAP_CLOSE,
  DEMANDE_CAP_QUALIFIEE,
];

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.intervention.deleteMany({ where: { id: INTERVENTION_CAP } });
  await client.demande.deleteMany({
    where: { id: { in: TOUTES_LES_DEMANDES } },
  });
  await client.site.deleteMany({ where: { id: SITE_CAP } });
  await client.client.deleteMany({ where: { id: CLIENT_CAP } });
}

test.beforeAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await nettoyer(client);

    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });

    await client.client.create({
      data: {
        id: CLIENT_CAP,
        societe_id: societe.id,
        raison_sociale: "CAP9DM- Client de démonstration",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_CAP,
        societe_id: societe.id,
        client_id: CLIENT_CAP,
        agence_id: agence.id,
        libelle: "CAP9DM- Site de démonstration",
        temps_trajet_min: 10,
        actif: true,
      },
    });

    const maintenant = new Date();
    // POSÉES DIRECTEMENT AU STATUT VISÉ — le déclencheur `demande_cycle_de_vie`
    // ne garde que l'`UPDATE` (migration `20260913140000_demande_l2_06`).
    await client.$executeRawUnsafe(
      `INSERT INTO "demande" ("id", "societe_id", "source", "client_id", "site_id",
         "agence_id", "description", "statut", "depose_le", "compteur_accuse_le", "modifie_le")
       VALUES ('${DEMANDE_CAP_TRANSFORMEE}', '${societe.id}', 'appel', '${CLIENT_CAP}',
         '${SITE_CAP}', '${agence.id}', 'CAP9DM — compresseur en panne', 'transformee',
         '${maintenant.toISOString()}', now(), now())`,
    );
    await client.$executeRawUnsafe(
      `INSERT INTO "demande" ("id", "societe_id", "source", "client_id", "site_id",
         "agence_id", "description", "statut", "motif_cloture", "depose_le",
         "compteur_accuse_le", "close_le", "modifie_le")
       VALUES ('${DEMANDE_CAP_CLOSE}', '${societe.id}', 'appel', '${CLIENT_CAP}',
         '${SITE_CAP}', '${agence.id}', 'CAP9DM — résolu par téléphone', 'close_sans_suite',
         'resolue_telephone', '${maintenant.toISOString()}', now(), now(), now())`,
    );
    await client.$executeRawUnsafe(
      `INSERT INTO "demande" ("id", "societe_id", "source", "client_id", "site_id",
         "agence_id", "description", "statut", "depose_le", "compteur_accuse_le", "modifie_le")
       VALUES ('${DEMANDE_CAP_QUALIFIEE}', '${societe.id}', 'appel', '${CLIENT_CAP}',
         '${SITE_CAP}', '${agence.id}', 'CAP9DM — fuite hydraulique', 'qualifiee',
         '${maintenant.toISOString()}', now(), now())`,
    );
    await client.intervention.create({
      data: {
        id: INTERVENTION_CAP,
        societe_id: societe.id,
        agence_id: agence.id,
        client_id: CLIENT_CAP,
        site_id: SITE_CAP,
        demande_id: DEMANDE_CAP_TRANSFORMEE,
        type: "curatif",
        priorite: "p3",
        statut: "a_planifier",
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "CAP9DM — intervention issue",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await nettoyer(client);
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
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 900 });
      await ouvrirUneSession(page);
    });

    test(`capture — /demandes, onglet « À traiter »`, async ({ page }) => {
      await page.goto("/demandes");
      await expect(page.locator("main")).toBeVisible();
      await capturer(page, "demandes-a-traiter", largeur);
    });

    test(`capture — /demandes, onglet « Traitées »`, async ({ page }) => {
      await page.goto("/demandes?onglet=traitees");
      await expect(page.locator("main")).toBeVisible();
      await capturer(page, "demandes-traitees", largeur);
    });

    test(`capture — fiche demande, motif de clôture vide et refus`, async ({
      page,
    }) => {
      await page.goto(
        `/demandes/${DEMANDE_CAP_QUALIFIEE}?motif=demande.cloture.motif_requis`,
      );
      await expect(page.locator("main")).toBeVisible();
      await capturer(page, "fiche-demande-motif-vide", largeur);
    });

    test(`capture — création d'intervention depuis une demande déjà traitée`, async ({
      page,
    }) => {
      await page.goto(
        `/interventions/nouvelle?demande=${DEMANDE_CAP_TRANSFORMEE}`,
      );
      await expect(page.locator("main")).toBeVisible();
      await capturer(page, "nouvelle-intervention-demande-traitee", largeur);
    });
  });
}
