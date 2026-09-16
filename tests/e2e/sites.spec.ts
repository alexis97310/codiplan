import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * L'ÉCRAN « SITES » (L3-16, D75, D56).
 *
 * ## Ce que ce fichier mesure et que rien d'autre ne mesure
 *
 * Les scénarios d'isolation prouvent que la BASE refuse un rattachement changé
 * sans temps de trajet revu — le déclencheur `site_trajet_suit_agence` est posé
 * depuis L1-02. Ils ne peuvent pas prouver que **le refus arrive à l'écran avec
 * son message**, et c'est l'acceptation même du ticket :
 *
 * > *« Changer le rattachement sans revoir le temps de trajet est refusé à
 * > l'écran avec le message de D56. »*
 *
 * ## Et il éprouve que l'écran A UN APPELANT
 *
 * La maquette ne donne aucune entrée de barre à cet écran — sa liste est close
 * et un gardien la confronte. Il se rejoint donc **par le lieu d'une
 * intervention**, et *une interface sans appelant est la maladie que le portail
 * a soignée* : le dernier scénario suit ce chemin plutôt que de taper l'URL.
 */

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

/**
 * Le premier lieu de la liste, celui que le semis a posé.
 *
 * **`/sites/nouveau` en est exclu, et ce n'est pas un détail de sélecteur** :
 * la première écriture le prenait — c'est le bouton « Nouveau lieu » —, et la
 * route a rendu un **500**, Prisma levant `P2023` en tentant de lire
 * « nouveau » comme un UUID. *Le scénario a trouvé un défaut réel en visant à
 * côté*, et la route refuse désormais un identifiant mal formé au lieu de
 * tomber.
 */
async function premierSite(page: Page): Promise<string> {
  await page.goto("/sites");
  const lien = page
    .locator('a[href^="/sites/"]')
    .filter({ hasNotText: fr["sites.creer"] })
    .first();
  await expect(lien).toBeVisible();
  const href = await lien.getAttribute("href");
  if (href === null || href === "/sites/nouveau") {
    throw new Error("aucun lieu dans la liste");
  }
  return href;
}

test("un identifiant MAL FORMÉ est refusé, jamais une panne", async ({
  page,
}) => {
  // *Mesuré le 11/09/2026 : `/api/sites/nouveau/modifier` rendait un 500.* Un
  // segment d'URL est une entrée, et une entrée se contrôle avant d'atteindre
  // la base.
  const reponse = await page.request.post("/api/sites/nouveau/modifier", {
    form: { libelle: "Atelier" },
    maxRedirects: 0,
  });
  expect(reponse.status()).toBe(303);
  expect(reponse.headers()["location"] ?? "").toContain(
    "site.refus.fiche_introuvable",
  );
});

test("la liste affiche les lieux, et le RATTACHEMENT à côté du temps de trajet", async ({
  page,
}) => {
  await page.goto("/sites");
  // La colonne du rattachement est présente, et celle du trajet aussi : *un
  // nombre dont la signification dépend d'une autre colonne ne voyage jamais
  // seul* (D56), et les séparer à l'écran serait la même faute qu'en base.
  await expect(
    page.getByRole("columnheader", { name: fr["site.rattachement"] }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: fr["sites.colonne_trajet"] }),
  ).toBeVisible();
});

test("LE REFUS DE D56 ARRIVE À L'ÉCRAN AVEC SON MESSAGE", async ({ page }) => {
  // **C'est l'acceptation du ticket.** Le formulaire ne porte pas le
  // rattachement — on ne le change pas depuis cet écran —, si bien que le refus
  // se provoque par la route, comme un import ou une correction à la main le
  // feraient. *C'est précisément pour eux que la base porte le même refus.*
  const href = await premierSite(page);
  const id = href.split("/").pop() ?? "";

  const reponse = await page.request.post(`/api/sites/${id}/modifier`, {
    form: {
      // Un rattachement changé, et AUCUN temps de trajet fourni : le cas exact
      // que D56 refuse.
      agence_id: "00000000-0000-7000-8000-000000000000",
      libelle: "Atelier",
    },
    maxRedirects: 0,
  });
  expect(reponse.status()).toBe(303);
  const destination = reponse.headers()["location"] ?? "";
  expect(destination).toContain("site.refus");

  // Et le message est RENDU, pas seulement transporté.
  await page.goto(destination);
  await expect(page.locator("[data-motif]")).toBeVisible();
});

test("L'ÉCRAN A UN APPELANT — on y arrive par le LIEU d'une intervention", async ({
  page,
}) => {
  // *La maquette ne lui donne aucune entrée de barre, et sa liste est close.*
  // Ce qui rend l'écran atteignable est ce lien-ci, et rien d'autre : sans lui,
  // il n'existerait que pour qui connaît son URL.
  await page.goto("/planning");
  // **Un BLOC, et non le premier lien qui commence par « /interventions/ »** :
  // celui-là est le bouton « Créer » (`/interventions/nouvelle`), et le
  // scénario partait vers le formulaire de création au lieu d'une fiche. Les
  // blocs portent `data-bloc`, posé par `components/planning/pose.tsx`.
  const bloc = page.locator("[data-bloc] a").first();
  await expect(bloc).toBeVisible();
  await bloc.click();
  // `/interventions/{id}`, et non `/planning/{id}` — depuis N-01 (#207) :
  // *une intervention n'est pas plus un sous-écran du planning que du parc ou
  // d'un client.* `/planning/{id}` redirige encore en 308, mais un clic sur un
  // BLOC part directement vers l'adresse neuve.
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]{36}/);

  const versLeSite = page.locator('a[href^="/sites/"]').first();
  await expect(versLeSite).toBeVisible();
  await versLeSite.click();
  await expect(page).toHaveURL(/\/sites\//);
  // La fiche porte le retour vers la liste : un écran sans sortie est une
  // impasse, et c'est le coût que « pas de barre du tout » ferait payer.
  await expect(
    page.getByRole("link", { name: fr["sites.retour"] }),
  ).toBeVisible();
});
