import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { MARDI, SCENE, cleDeJour, jourDeLaScene } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9H4-FINITIONS-AVANT-AUDIT, point 5 — LA COLONNE DES TECHNICIENS RESTE
 * AU-DESSUS DES BLOCS DE LA FRISE, QUELLE QUE SOIT LA POSITION DU DÉFILEMENT.
 *
 * `<th scope="row">` (le nom du technicien, figé à gauche) posait `z-[1]` ;
 * chaque bloc d'intervention de la frise, positionné `absolute` DANS SA
 * PROPRE CASE (`left: 0` relatif à elle, jamais au tableau), posait `z-10` —
 * un bloc commençant tôt dans la journée, une fois la frise défilée vers la
 * droite, glissait donc AU-DESSUS de la colonne figée plutôt que dessous.
 *
 * `SCENE.obstacle` (8 h-10 h, Ducos, `tests/e2e/setup/scene.ts`, écrite une
 * fois par `global.ts` pour tout le dépôt, et JAMAIS mutée par SQL brut
 * ailleurs — voir son docblock) commence tôt dans la journée de Ducos :
 * exactement le bloc qui, une fois défilé, chevauche la colonne. Cette
 * épreuve ne fait QUE LIRE — compare directement les `z-index` résolus
 * plutôt que de reproduire la géométrie du défilement pixel par pixel, car
 * c'est la relation entre les deux qui est le défaut, pas une coordonnée
 * précise.
 */

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test("la colonne figée des techniciens a un z-index plus grand que les blocs de la frise", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  let nomDucos: string;
  try {
    nomDucos = (
      await client.utilisateur.findUniqueOrThrow({
        where: { id: reperes.technicienDucos },
        select: { nom: true },
      })
    ).nom;
  } finally {
    await client.$disconnect();
  }

  const jour = jourDeLaScene(reperes, MARDI);
  await page.setViewportSize({ width: 1280, height: 800 });
  await ouvrirUneSession(page);
  await page.goto(`/planning?vue=jour&jour=${cleDeJour(jour)}`);

  const colonneFigee = page.locator('th[scope="row"]', {
    hasText: nomDucos,
  });
  await expect(colonneFigee).toBeVisible();

  const bloc = page.locator("[data-fin-heure]", {
    has: page.locator(`[data-tiroir-declencheur="${SCENE.obstacle}"]`),
  });
  await expect(bloc).toBeVisible();

  const [zColonne, zBloc] = await Promise.all([
    colonneFigee.evaluate((element) =>
      Number(getComputedStyle(element).zIndex),
    ),
    bloc.evaluate((element) => Number(getComputedStyle(element).zIndex)),
  ]);

  expect(Number.isNaN(zColonne)).toBe(false);
  expect(Number.isNaN(zBloc)).toBe(false);
  expect(zColonne).toBeGreaterThan(zBloc);
});
