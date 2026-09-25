import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import {
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
  SCENE,
} from "./setup/scene";

/**
 * L'APPLICATION DU TECHNICIEN, DE BOUT EN BOUT (R5-01, R5-02, D119).
 *
 * ## Ce que ce fichier mesure et que rien d'autre ne mesure
 *
 * Les scénarios d'isolation prouvent que la BASE n'accepte qu'un compteur
 * ouvert par personne, et que le dépôt rend un refus NOMMÉ. Ils ne peuvent pas
 * prouver que **l'écran ne propose pas un départ que la base refuserait** — et
 * c'est la moitié qui compte pour quelqu'un sur le terrain : *proposer une
 * action qui sera refusée coûte un aller-retour sur un réseau de brousse.*
 *
 * ## UNE SECONDE IDENTITÉ, ET POUR LA RAISON INVERSE DU PORTAIL
 *
 * Le compte qui sert au reste des scénarios est `adv`, dont l'accès au planning
 * est COMPLET : `/terrain` le renverrait au back-office. Il ne manque pas de
 * droits — **il en a trop**. Le compte du terrain est connectable, lui, et il
 * ouvre sa session par le même chemin que l'autre, à l'écran.
 *
 * ## CE QU'IL N'ÉPROUVE PAS, ET C'EST ÉCRIT
 *
 * Il ne mesure **aucune durée** : deux clics séparés d'une seconde rendent
 * *0 min*, la mesure étant tronquée à la minute. Ce que ce fichier éprouve est
 * l'ÉTAT du compteur — il tourne, il ne tourne pas, il tourne ailleurs —, et
 * l'arithmétique est mesurée là où elle vit, dans les scénarios unitaires.
 */

test.describe.configure({ mode: "serial" });

async function ouvrirLaSessionDuTerrain(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  // Retouché par 99A-ARRIVEE : ce compte n'a qu'UNE société, donc `/arrivee`
  // ne s'y arrête plus — elle redirige d'emblée au terrain.
  await expect(page).toHaveURL(/\/terrain$/);
}

test.beforeEach(async ({ page }) => {
  await ouvrirLaSessionDuTerrain(page);
});

test("l'arrivée mène directement au TERRAIN, jamais au planning du back-office", async ({
  page,
}) => {
  // *Une porte se pose dans le même geste que la pièce* : sans cette
  // redirection, l'écran du terrain n'aurait aucun appelant, et c'est la
  // maladie que ce dépôt a déjà payée trois fois (D61, D67, D92).
  //
  // Retouché par 99A-ARRIVEE : la connexion elle-même y mène déjà (voir
  // `ouvrirLaSessionDuTerrain` ci-dessus) — ce scénario le confirme aussi
  // pour une visite DIRECTE de `/arrivee`, preuve que c'est la page qui
  // redirige, et non un hasard de la connexion.
  await page.goto("/arrivee");
  await expect(page).toHaveURL(/\/terrain$/);
  await expect(
    page.getByRole("heading", { name: fr["terrain.titre"] }),
  ).toBeVisible();
});

test("un technicien n'atteint PAS le planning du back-office par son URL", async ({
  page,
}) => {
  // L'écran du terrain redirige un accès COMPLET vers `/planning` ; l'inverse
  // n'est pas vrai, et ce scénario le dit plutôt que de le supposer : le
  // planning reste ouvert, mais il ne montre QUE ses interventions à lui.
  // *C'est la restriction par personne qui garde, jamais l'absence de lien.*
  await page.goto("/planning");
  await expect(page).toHaveURL(/\/planning/);
});

test("le compteur démarre, se met en pause, et ne se dédouble JAMAIS", async ({
  page,
}) => {
  await page.goto(`/terrain/${SCENE.compteurA}`);
  await expect(
    page.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
  ).toBeVisible();

  // ── DÉMARRER ─────────────────────────────────────────────────────────────
  await page
    .getByRole("button", { name: fr["terrain.compteur.demarrer"] })
    .click();
  await expect(page).toHaveURL(new RegExp(`/terrain/${SCENE.compteurA}$`));
  await expect(page.getByText(fr["terrain.compteur.tourne"])).toBeVisible();
  await expect(
    page.getByRole("button", { name: fr["terrain.compteur.pause"] }),
  ).toBeVisible();

  // ── L'AUTRE INTERVENTION DE LA MÊME PERSONNE ─────────────────────────────
  //
  // Le refus PREND LA PLACE de l'action, avec sa raison et un lien vers le
  // compteur qui tourne — jamais un bouton grisé, et jamais un départ que la
  // base refuserait.
  await page.goto(`/terrain/${SCENE.compteurB}`);
  await expect(page.getByText(fr["terrain.compteur.ailleurs"])).toBeVisible();
  await expect(
    page.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
  ).toHaveCount(0);

  // Le lien du refus MÈNE au compteur qui tourne.
  await page.getByRole("link", { name: fr["terrain.compteur.aller"] }).click();
  await expect(page).toHaveURL(new RegExp(`/terrain/${SCENE.compteurA}$`));

  // ── METTRE EN PAUSE, et l'autre intervention redevient démarrable ────────
  await page
    .getByRole("button", { name: fr["terrain.compteur.pause"] })
    .click();
  await expect(page.getByText(fr["terrain.compteur.tourne"])).toHaveCount(0);

  await page.goto(`/terrain/${SCENE.compteurB}`);
  await expect(
    page.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
  ).toBeVisible();
});
