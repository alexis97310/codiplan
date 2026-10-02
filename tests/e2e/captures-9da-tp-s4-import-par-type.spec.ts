import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE, COMPTE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9DA-TP-S4-IMPORT-PAR-TYPE (QT-3, D150).
 *
 * `[data-type-reserve]` et le texte « Réservé à d'autres rôles » n'existent
 * PAS sur le code d'AVANT ce lot — ce fichier ne les affirme JAMAIS, comme
 * `captures-tpa3-rapport-import.spec.ts` : seulement les écrans et libellés
 * déjà présents avant ce lot, pour rester rejouable des deux côtés du
 * `git stash` (AVANT / APRÈS).
 *
 * **Aucun compte `responsable_materiel` ni `responsable_sav` n'existe dans la
 * scène de bout en bout** (`tests/e2e/setup/scene.ts` ne porte que `adv`,
 * `admin_societe`, `technicien`) : le cas « RM refusé sur un classeur de
 * clients » (D130) n'a donc pas de capture — il est mesuré par
 * `tests/isolation/droits-import-par-type.test.ts` et par la matrice de
 * `tests/unit/imports/droits-import.test.ts`. L'ADV, lui, existe déjà et
 * suffit à montrer l'AUTRE moitié de D150 : refusé sur familles, modèles et
 * prestations (le droit de l'écran Paramètres), accepté sur clients et sites
 * (D130).
 *
 * Le lot de FAMILLES qu'ADV regarde est posé DIRECTEMENT en base (I9 : une
 * scène de démonstration, jamais un fichier déposé) — ce fichier n'a pas
 * besoin de fabriquer un classeur `.xlsx` réel pour montrer un ÉTAT du
 * rapport, que `tests/isolation/droits-import-par-type.test.ts` a déjà
 * traversé par la vraie chaîne.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9DA_TP_S4_IMPORT_PAR_TYPE ?? "";
const PREFIXE = "9da-capture-";

const idsDesLots: string[] = [];

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.afterAll(async () => {
  if (idsDesLots.length === 0) return;
  const client = admin();
  try {
    await client.importLot.deleteMany({ where: { id: { in: idsDesLots } } });
  } finally {
    await client.$disconnect();
  }
});

async function capturer(page: Page, nom: string, largeur: number) {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

/**
 * Un lot de FAMILLES, `controle`, posé pour le compte d'ADV — le type que
 * D150 lui refuse désormais à l'application, pour que la fiche du lot ait
 * quelque chose à montrer AUX DEUX ÉTATS (avant : bouton « Appliquer » ;
 * après : le motif réservé).
 */
async function lotDeFamillesControle(client: PrismaClient): Promise<string> {
  const utilisateur = await client.utilisateur.findFirstOrThrow({
    where: { email: COMPTE_EPREUVE },
    select: { id: true },
  });
  const societe = await client.utilisateurSociete.findFirstOrThrow({
    where: { utilisateur_id: utilisateur.id },
    select: { societe_id: true },
  });

  const lotId = uuidv7();
  await client.importLot.create({
    data: {
      id: lotId,
      societe_id: societe.societe_id,
      type_import: "familles",
      version_modele: 1,
      utilisateur_id: utilisateur.id,
      nom_fichier: `${PREFIXE}familles.xlsx`,
      lignes_creations: 1,
      lignes: {
        create: [
          {
            id: uuidv7(),
            rang: 3,
            action: "creation",
            cle: `FAMILLE-${PREFIXE}capture`,
            complete: true,
            valeurs: {
              Code: `${PREFIXE}capture`,
              Libellé: "Famille de capture 9DA",
            },
          },
        ],
      },
    },
  });
  return lotId;
}

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
    });

    test(`administrateur de société — /imports inchangé, à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
      await page.goto("/imports");
      await capturer(page, "admin-imports-liste", largeur);
    });

    test(`ADV — /imports, « Réservé à d'autres rôles » sur familles/modèles/prestations, à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirUneSession(page);
      await page.goto("/imports");
      await capturer(page, "adv-imports-liste", largeur);
    });

    test(`ADV — la fiche d'un lot de FAMILLES au statut « contrôlé », à ${largeur}px`, async ({
      page,
    }) => {
      const client = admin();
      let lotId: string;
      try {
        lotId = await lotDeFamillesControle(client);
      } finally {
        await client.$disconnect();
      }
      idsDesLots.push(lotId);

      await ouvrirUneSession(page);
      await page.goto(`/imports/${lotId}`);
      await expect(page).toHaveURL(new RegExp(`/imports/${lotId}$`));
      await capturer(page, "adv-fiche-familles-controle", largeur);
    });
  });
}
