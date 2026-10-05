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
 * LES CAPTURES DE 9DT-TP-MOD2-INDICATEURS-DONNEES (QT-20, QE-19, D170) —
 * même recette que `captures-9dp-vgp2-registre.spec.ts`.
 *
 * **AVANT/APRÈS se prend en rejouant ce même fichier deux fois** — une fois
 * dans un `git worktree` posé sur le commit qui précède ce lot
 * (`52023991`), une fois sur le code livré — jamais en changeant ce fichier
 * entre les deux. Aucune clé `fr[...]` n'est lue ici, à dessein : sur le code
 * AVANT, les clés neuves de ce lot n'existent pas encore. La fixture, elle,
 * est directe (Prisma), jamais par l'application — le schéma ne change pas
 * dans ce lot (« Migration : NON »), donc la même écriture vaut sur les deux
 * commits.
 *
 * **Sur le code AVANT**, `/indicateurs` et `/parametres/donnees` n'existent
 * pas encore : la capture montre ce que Next.js rend pour une route absente
 * — exactement ce que la capture AVANT doit montrer (l'absence).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9DT ?? "";
const PHASE = process.env.CAPTURES_9DT_PHASE ?? "apres";

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
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${PHASE}-${largeur}.png`),
    fullPage: true,
  });
}

const PREFIXE = "9DTCAP-";

const CLIENT = uuidv7();
const SITE = uuidv7();
const FAMILLE = uuidv7();
const MODELE = uuidv7();
const MACHINE = uuidv7();
const INTERVENTION = uuidv7();

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
        id: CLIENT,
        societe_id: societeId,
        raison_sociale: "9DT — Client des captures",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE,
        societe_id: societeId,
        client_id: CLIENT,
        agence_id: agence.id,
        libelle: "9DT — Lieu des captures",
      },
    });
    await client.familleMateriel.create({
      data: {
        id: FAMILLE,
        societe_id: societeId,
        code: "9DTCAP-FAM",
        libelle: "9DT — Famille des captures",
      },
    });
    await client.modeleMateriel.create({
      data: {
        id: MODELE,
        societe_id: societeId,
        famille_id: FAMILLE,
        marque: "9DTCAP-MARQUE",
        reference: "9DTCAP-REF",
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE,
        societe_id: societeId,
        modele_id: MODELE,
        client_id: CLIENT,
        site_id: SITE,
        numero_serie: `${PREFIXE}SN`,
        qr_token: engendrerJetonQr(),
        source_creation: "terrain",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION,
        societe_id: societeId,
        client_id: CLIENT,
        site_id: SITE,
        agence_id: agence.id,
        type: "expertise",
        statut: "a_planifier",
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
    await client.intervention.deleteMany({ where: { id: INTERVENTION } });
    await client.machine.deleteMany({ where: { id: MACHINE } });
    await client.modeleMateriel.deleteMany({ where: { id: MODELE } });
    await client.familleMateriel.deleteMany({ where: { id: FAMILLE } });
    await client.site.deleteMany({ where: { id: SITE } });
    await client.client.deleteMany({ where: { id: CLIENT } });
  } finally {
    await client.$disconnect();
  }
});

test("Indicateurs du mois — 1280 et 375 px, mois en cours et mois précédent", async ({
  page,
}) => {
  if (DOSSIER === "") return;
  await ouvrirUneSession(page);
  await page.goto("/indicateurs");
  await capturer(page, "indicateurs-mois-actuel", 1280);
  await capturer(page, "indicateurs-mois-actuel", 375);

  await page.goto("/indicateurs?mois=precedent");
  await capturer(page, "indicateurs-mois-precedent", 1280);
});

test("Données à compléter — 1280 et 375 px", async ({ page }) => {
  if (DOSSIER === "") return;
  await ouvrirUneSession(page);
  await page.goto("/parametres/donnees");
  await capturer(page, "donnees-a-completer", 1280);
  await capturer(page, "donnees-a-completer", 375);
});

test("Hub Paramètres — la porte « Données »", async ({ page }) => {
  if (DOSSIER === "") return;
  await ouvrirUneSession(page);
  await page.goto("/parametres");
  await capturer(page, "hub-parametres-porte-donnees", 1280);
});

test("Une liste ouverte depuis un chiffre — le parc filtré par origine", async ({
  page,
}) => {
  if (DOSSIER === "") return;
  await ouvrirUneSession(page);
  await page.goto("/parc?origine=terrain");
  await capturer(page, "liste-ouverte-depuis-un-chiffre", 1280);
});
