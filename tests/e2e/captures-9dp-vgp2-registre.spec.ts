import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { engendrerJetonQr } from "@/lib/machines/qr";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9DP-TP-VGP2-REGISTRE — même recette que
 * `captures-tpa2-vgp-registre.spec.ts` : rien n'est écrit sans la variable
 * d'environnement qui nomme le dossier, pour que `pnpm test:e2e` ordinaire
 * n'écrive jamais de fichier.
 *
 * **AVANT/APRÈS se prend en rejouant ce même fichier deux fois** — une fois
 * dans un `git worktree` posé sur le commit qui précède ce lot
 * (`dd53a36b`), une fois sur le code livré — jamais en changeant ce fichier
 * entre les deux. Aucune clé `fr[...]` n'est lue ici, à dessein : sur le code
 * AVANT, les clés neuves de ce lot n'existent pas encore. La fixture, elle,
 * est directe (Prisma), jamais par l'application — le schéma ne change pas
 * dans ce lot (« Pas de migration »), donc la même écriture vaut sur les deux
 * commits.
 *
 * **Sur le code AVANT**, les paramètres `client=`, `site=` et `groupe=`
 * n'existent pas encore : la page les ignore silencieusement et rend le
 * registre nu — exactement ce que la capture AVANT doit montrer (l'absence).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9DP ?? "";
const PHASE = process.env.CAPTURES_9DP_PHASE ?? "apres";

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

const PREFIXE = "9DPCAP-";

const CLIENT_X = uuidv7();
const CLIENT_Y = uuidv7();
const SITE_X = uuidv7();
const SITE_Y = uuidv7();
const FAMILLE = uuidv7();
const MODELE = uuidv7();
const MACHINE_X = uuidv7();
const MACHINE_Y = uuidv7();

const SN_X = `${PREFIXE}MACHINE-X`;
const SN_Y = `${PREFIXE}MACHINE-Y`;

test.beforeAll(async () => {
  if (DOSSIER === "") return;
  const reperes = await reperesDeLaScene();
  const societeId = reperes.societeId;

  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_X,
        societe_id: societeId,
        raison_sociale: "9DP — Client des captures, X",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_X,
        societe_id: societeId,
        client_id: CLIENT_X,
        agence_id: agence.id,
        libelle: "9DP — Lieu des captures, X",
      },
    });
    await client.client.create({
      data: {
        id: CLIENT_Y,
        societe_id: societeId,
        raison_sociale: "9DP — Client des captures, Y",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_Y,
        societe_id: societeId,
        client_id: CLIENT_Y,
        agence_id: agence.id,
        libelle: "9DP — Lieu des captures, Y",
      },
    });
    await client.familleMateriel.create({
      data: {
        id: FAMILLE,
        societe_id: societeId,
        code: "9DPCAP-FAM",
        libelle: "9DP — Famille des captures",
        assujettissement_vgp: "soumis",
        vgp_periodicite_mois: 12,
        vgp_reference_texte: "9DP — Texte des captures",
      },
    });
    await client.modeleMateriel.create({
      data: {
        id: MODELE,
        societe_id: societeId,
        famille_id: FAMILLE,
        marque: "9DPCAP-MARQUE",
        reference: "9DPCAP-REF",
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_X,
        societe_id: societeId,
        modele_id: MODELE,
        client_id: CLIENT_X,
        site_id: SITE_X,
        numero_serie: SN_X,
        qr_token: engendrerJetonQr(),
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_Y,
        societe_id: societeId,
        modele_id: MODELE,
        client_id: CLIENT_Y,
        site_id: SITE_Y,
        numero_serie: SN_Y,
        qr_token: engendrerJetonQr(),
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  if (DOSSIER === "") return;
  const client = admin();
  try {
    await client.machine.deleteMany({
      where: { id: { in: [MACHINE_X, MACHINE_Y] } },
    });
    await client.modeleMateriel.deleteMany({ where: { id: MODELE } });
    await client.familleMateriel.deleteMany({ where: { id: FAMILLE } });
    await client.site.deleteMany({ where: { id: { in: [SITE_X, SITE_Y] } } });
    await client.client.deleteMany({
      where: { id: { in: [CLIENT_X, CLIENT_Y] } },
    });
  } finally {
    await client.$disconnect();
  }
});

for (const largeur of [1280, 375] as const) {
  test(`captures — /vgp : titre, onglets, tuiles, ligne avec marque et référence, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);

    await page.goto("/vgp");
    await capturer(page, "vgp-accueil", largeur);

    await page.goto(`/vgp?q=${encodeURIComponent(PREFIXE)}`);
    await capturer(page, "vgp-recherche-scene", largeur);
  });

  test(`captures — /vgp : filtres client/site, vue groupée par client, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);

    // SUR LE CODE AVANT, `client=`/`site=` sont ignorés : la capture montre
    // alors le registre nu, sans aucun filtre visible — l'absence qu'elle
    // doit montrer.
    await page.goto(`/vgp?q=${encodeURIComponent(PREFIXE)}&client=${CLIENT_X}`);
    await capturer(page, "vgp-filtre-client", largeur);

    await page.goto(`/vgp?q=${encodeURIComponent(PREFIXE)}&groupe=client`);
    await capturer(page, "vgp-groupe-par-client", largeur);
  });

  test(`captures — aperçu d'impression pour un client, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);

    await page.goto(`/vgp?q=${encodeURIComponent(PREFIXE)}&groupe=client`);
    // LE BOUTON « IMPRIMER POUR CE CLIENT » N'EXISTE QUE SUR LE CODE APRÈS —
    // absent, cette capture reste simplement celle de la vue groupée (ou du
    // registre nu) prise ci-dessus : aucune erreur, juste rien de plus à
    // montrer sur le code AVANT.
    const bouton = page.locator('[data-bloc="vgp-imprimer-client"]').first();
    if ((await bouton.count()) > 0) {
      await page.evaluate(() => {
        window.print = () => {};
      });
      await bouton.click();
      // LE RENDU D'IMPRESSION, SIMULÉ (jamais une vraie boîte de dialogue) —
      // `emulateMedia` applique les règles `@media print` sans ouvrir de
      // fenêtre native.
      await page.emulateMedia({ media: "print" });
      await capturer(page, "vgp-apercu-impression", largeur);
      await page.emulateMedia({ media: null });
    }
  });
}
