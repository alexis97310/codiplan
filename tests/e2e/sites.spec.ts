import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr, mot } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { choisirPremierResultat } from "./setup/selecteur-recherche";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

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

test("la liste montre des CARTES, et le RATTACHEMENT reste à côté du temps de trajet (D123)", async ({
  page,
}) => {
  // N-08/D123 : la liste passe du tableau aux cartes — *le geste change,
  // l'assertion reste*. Ce qu'elle vérifiait avant (deux colonnes visibles)
  // vérifie désormais la même chose sous une autre forme : une carte qui
  // nomme le rattachement porte AUSSI, dans la même carte, le compteur de
  // trajet — *un nombre dont la signification dépend d'une autre ligne ne
  // voyage jamais seul* (D56), et les séparer à l'écran serait la même faute
  // qu'en base.
  await page.goto("/sites");
  const cartes = page.locator("article");
  await expect(cartes.first()).toBeVisible();

  const carteAvecRattachement = cartes
    .filter({ hasText: mot("agence") })
    .first();
  await expect(carteAvecRattachement).toBeVisible();
  await expect(
    carteAvecRattachement.getByText(fr["sites.colonne_trajet"]),
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

/**
 * CONTRAT-SITE-1 — la case « sous contrat de maintenance ».
 *
 * Trois choses, dans le MÊME scénario, dans cet ordre : cocher/décocher
 * PERSISTE (le formulaire envoie un champ caché `sous_contrat=0` à côté de la
 * case — voir `app/api/sites/[id]/modifier/route.ts` — pour que décocher ne
 * se lise pas comme « ne touche pas à cette colonne ») ; l'état en LECTURE
 * (un `<p>`, distinct du `<label>` du formulaire) suit ; la pastille jaune
 * de la CARTE ne s'affiche que quand la case est cochée.
 */
test("la case ACTIVE persiste, l'état en lecture suit, et la pastille n'apparaît que si cochée (CONTRAT-SITE-1)", async ({
  page,
}) => {
  // Un JETON UNIQUE par exécution (STABILITE-3) — la liste `/sites` est
  // PAGINÉE, et d'autres scènes (`selecteurs-1.spec.ts` en pose 210,
  // préfixés `SEL1-`) créent des sites EN PARALLÈLE pendant ce scénario. Un
  // libellé fixe pouvait tomber hors de la première page selon le tri et la
  // charge du moment ; le jeton sert de critère `q` pour que la recherche ne
  // ramène JAMAIS que ce site-ci, quelle que soit la taille de la liste.
  const jeton = `STAB3-${crypto.randomUUID().slice(0, 8)}`;
  // Le libellé ÉVITE le mot « contrat » : `getByText` fait une recherche en
  // sous-chaîne insensible à la casse, et « CONTRAT-SITE-1 » collisionnerait
  // avec la pastille « Contrat » cherchée plus bas.
  const libelle = `Site e2e ${jeton} (persistance)`;
  // Un site DÉDIÉ, créé par ce scénario — jamais « le premier de la liste » :
  // ce pourrait être le site fictif sous contrat du jeu de démonstration
  // (`prisma/seed-data.ts`), et le décocher ici fausserait le scénario du
  // filtre qui suit. SUPPRIMÉ en fin de scénario par l'administration de
  // l'épreuve : aucune trace ne doit survivre à ce test précis.
  let href: string | null = null;
  try {
    await page.goto("/sites/nouveau");
    await choisirPremierResultat(page, "client_id");
    await page.locator('select[name="agence_id"]').selectOption({ index: 1 });
    await page.locator('input[name="libelle"]').fill(libelle);
    await page.getByRole("button", { name: fr["sites.action.creer"] }).click();
    await expect(page).toHaveURL(/\/sites\/[0-9a-f-]{36}/);
    href = new URL(page.url()).pathname;

    const case_ = page.getByLabel(fr["site.sous_contrat"]);
    await expect(case_).not.toBeChecked();
    // Rien en lecture tant que la case n'a jamais été cochée.
    await expect(
      page.locator("p").filter({ hasText: fr["site.sous_contrat"] }),
    ).toHaveCount(0);

    await case_.check();
    await page
      .getByRole("button", { name: fr["sites.action.modifier"] })
      .click();
    // Le succès ajoute `?motif=sites.modifie` — une sous-chaîne de l'URL, pas
    // l'URL exacte.
    await expect(page).toHaveURL(new RegExp(`${href}(\\?|$)`));
    await expect(page.getByLabel(fr["site.sous_contrat"])).toBeChecked();
    await expect(
      page.locator("p").filter({ hasText: fr["site.sous_contrat"] }),
    ).toBeVisible();

    // `?sans_equipement=1` : ce site fraîchement créé n'a aucun équipement, et
    // la liste masque ces sites-là par défaut (LISTES-1) — sans quoi la carte
    // elle-même serait absente, pour une raison qui n'a rien à voir avec ce
    // scénario. `q=<jeton>` (STABILITE-3) : la carte est alors la SEULE que
    // la liste rend, jamais reléguée sur une page que ce scénario ne visite
    // pas.
    await page.goto(`/sites?sans_equipement=1&q=${encodeURIComponent(jeton)}`);
    const carte = page.locator(`article:has(a[href="${href}"])`);
    await expect(
      carte.getByText(fr["sites.contrat"], { exact: true }),
    ).toBeVisible();

    // Décocher persiste tout autant — le champ caché en fait foi.
    await page.goto(href);
    await page.getByLabel(fr["site.sous_contrat"]).uncheck();
    await page
      .getByRole("button", { name: fr["sites.action.modifier"] })
      .click();
    await expect(page.getByLabel(fr["site.sous_contrat"])).not.toBeChecked();
    await expect(
      page.locator("p").filter({ hasText: fr["site.sous_contrat"] }),
    ).toHaveCount(0);

    await page.goto(`/sites?sans_equipement=1&q=${encodeURIComponent(jeton)}`);
    await expect(
      carte.getByText(fr["sites.contrat"], { exact: true }),
    ).toHaveCount(0);
  } finally {
    if (href !== null) {
      const idSite = href.replace("/sites/", "");
      const admin = new PrismaClient({
        datasources: { db: { url: urlAdministration() } },
      });
      try {
        await admin.site.deleteMany({ where: { id: idSite } });
      } finally {
        await admin.$disconnect();
      }
    }
  }
});

test("le filtre « Sous contrat uniquement » compose (CONTRAT-SITE-1)", async ({
  page,
}) => {
  // Le site fictif du jeu d'essai (`prisma/seed-data.ts`) reste le SEUL sous
  // contrat une fois le scénario ci-dessus revenu à son état de départ. Il ne
  // porte aucun équipement : `sans_equipement=1` compose avec le filtre de
  // contrat, exactement ce que la demande décrit.
  await page.goto("/sites?sous_contrat=1&sans_equipement=1");
  const cartes = page.locator("article");
  await expect(cartes.first()).toBeVisible();
  const total = await cartes.count();
  for (let i = 0; i < total; i++) {
    await expect(
      cartes.nth(i).getByText(fr["sites.contrat"], { exact: true }),
    ).toBeVisible();
  }
});

test("un rôle SANS la capacité de modifier le site ne voit pas la case ACTIVE (CONTRAT-SITE-1)", async ({
  page,
}) => {
  // La MÊME capacité que la route POST (`gerer_client_site`) — un technicien
  // ne l'a pas (§5.2). La fiche reste lisible : seule la case du formulaire
  // disparaît.
  const href = await premierSite(page);
  // La session ADV ouverte par `beforeEach` doit d'abord se FERMER : visiter
  // `/connexion` alors qu'une session est déjà active en détourne, et le
  // second `ouvrirLaSessionSensible` n'atteindrait jamais son formulaire.
  await page.getByRole("button", { name: fr["nav.deconnexion"] }).click();
  await expect(page).toHaveURL(/\/connexion/);
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto(href);
  await expect(page.getByLabel(fr["site.sous_contrat"])).toHaveCount(0);
});
