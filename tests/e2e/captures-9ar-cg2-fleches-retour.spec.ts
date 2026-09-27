import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, type Page, test } from "@playwright/test";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES CAPTURES DE 9AR-CG2-FLECHES-RETOUR — même recette que
 * `captures-9aq-cg1-retour-parametres.spec.ts` : rien n'est écrit sans la
 * variable d'environnement qui nomme le dossier, pour que `pnpm test:e2e`
 * ordinaire n'écrive jamais de fichier.
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois avant
 * le remplacement du glyphe (`CAPTURES_9AR_FASE=avant`), une fois après
 * (`CAPTURES_9AR_FASE=apres`). LECTURE SEULE : aucune scène propre, les six
 * écrans se lisent tels que le semis et la scène globale (`FORFAITS_SCENE`)
 * les rendent déjà.
 *
 * L'identifiant de forfait est celui, FIXE, de `FORFAITS_SCENE` (une
 * fixture d'épreuve posée par la scène globale — `prisma/seed.ts` n'en pose
 * aucun, voir `tests/e2e/tous-les-ecrans-rendent.spec.ts`) ; les trois
 * écrans machine/VGP réutilisent la première machine du semis, société
 * CODIMA-NC.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9AR ?? "";
const FASE = process.env.CAPTURES_9AR_FASE ?? "";

const ID_FORFAIT_SCENE = "01a0e2e0-0000-7000-8000-0000000000f1";

let machineId: string;

test.beforeAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const machine = await client.machine.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
    });
    machineId = machine.id;
  } finally {
    await client.$disconnect();
  }
});

async function capturer(page: Page, ecran: string, largeur: number) {
  if (DOSSIER === "" || FASE === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${ecran}-${FASE}-${largeur}.png`),
    fullPage: true,
  });
}

const ECRANS: readonly { nom: string; chemin: () => string }[] = [
  {
    nom: "forfaits-fiche",
    chemin: () => `/parametres/forfaits/${ID_FORFAIT_SCENE}`,
  },
  { nom: "vgp-enregistrer", chemin: () => `/vgp/enregistrer/${machineId}` },
  { nom: "vgp-a-determiner", chemin: () => "/vgp/a-determiner" },
  { nom: "parc-fiche", chemin: () => `/parc/${machineId}` },
  { nom: "parc-nouvelle", chemin: () => "/parc/nouvelle" },
  { nom: "parc-modifier", chemin: () => `/parc/${machineId}/modifier` },
];

for (const largeur of [1280, 375] as const) {
  for (const ecran of ECRANS) {
    test(`capture — ${ecran.nom} à ${largeur}px`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
      await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
      await page.goto(ecran.chemin());
      await expect(page.locator("main")).toBeVisible();
      await capturer(page, ecran.nom, largeur);
    });
  }
}
