import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { ECARTS_MAQUETTE } from "@/lib/navigation/entrees";
import { LARGEUR_UTILE_PX } from "@/lib/theme/apparence";
import { FORFAITS_DEMONSTRATION } from "@/prisma/seed-data";

import { FORFAITS_SCENE, SCENE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * R2-05 et R2-06 — LES DEUX ÉCRANS DE RÉGLAGE OCCUPENT LA LARGEUR UTILE ET SE
 * LISENT D'UN REGARD.
 *
 * ## Ce que ce scénario mesure, et pourquoi une assertion ne suffisait pas
 *
 * L'acceptation de R2-05 demande une mesure : *« le nombre d'établissements
 * visibles sans défiler à 1700 px est mesuré avant et après, et il augmente. »*
 * Un scénario de rendu ne peut pas répondre à cela — il interroge des textes,
 * pas une mise en page. **Il faut une fenêtre réelle**, et c'est ce que le
 * harnais de R2-18 rend possible depuis cette nuit.
 *
 * *Mesuré le 11/09/2026, fenêtre 1700 × 1000, trois établissements :*
 *
 * | | avant | après |
 * |---|---|---|
 * | largeur du contenu | 896 px | 1360 px |
 * | hauteur du document | 1428 px | 1000 px |
 * | établissements entièrement visibles | **2 sur 3** | **3 sur 3** |
 *
 * ## Les deux assertions sont des FAITS, jamais des chiffres figés
 *
 * « Trois lignes visibles » deviendrait faux à la quatrième agence de
 * démonstration — et *un gardien qui rougit sur un dépôt sain est un gardien
 * qu'on apprend à ne plus lire* (§9, 11/09). Ce qui est exigé est donc : **TOUTES
 * les lignes sont entièrement visibles**, et le contenu occupe la largeur utile.
 * Le témoin de non-vacuité est à part : il faut au moins trois lignes, sans quoi
 * « toutes visibles » ne prouverait rien.
 */

const FENETRE = { width: 1700, height: 1000 };

/** La largeur utile, moins les gouttières latérales de `LargeurUtile` (px-5). */
const GOUTTIERE_PX = 20;

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(FENETRE);
  await ouvrirUneSession(page);
});

test("les établissements tiennent tous dans la fenêtre, sur la largeur utile", async ({
  page,
}) => {
  await page.goto("/parametres/agences");

  // Le flux de rendu dépose d'abord le vrai contenu dans un conteneur CACHÉ
  // avant de le révéler (React, sous rendu en flux) : mesurer un rectangle
  // sans attendre la visibilité peut lire ce conteneur, de largeur ET DE
  // HAUTEUR nulles — mesuré le 17/09/2026, cause de la régression de CI de
  // #217. Posée ici, AVANT LA PREMIÈRE mesure géométrique du scénario : une
  // revue automatique sur #220 a montré que la poser seulement avant la
  // largeur laissait le contrôle de débordement, ci-dessous, passer sur des
  // rectangles nuls — mesuré à 11 reprises sur 25 essais avant ce correctif.
  // Attendre n'assouplit rien : les valeurs exactes attendues sont inchangées.
  await expect(page.locator("main")).toBeVisible();

  const lignes = page.locator("main tbody tr");
  // Témoin : sans lignes, « toutes visibles » serait vrai et ne dirait rien.
  await expect(lignes).toHaveCount(3);

  const debordent = await lignes.evaluateAll(
    (elements, hauteur) =>
      elements.filter((e) => e.getBoundingClientRect().bottom > hauteur).length,
    FENETRE.height,
  );
  expect(debordent).toBe(0);

  const largeur = await page
    .locator("main")
    .evaluate((element) => Math.round(element.getBoundingClientRect().width));
  expect(largeur).toBe(LARGEUR_UTILE_PX - 2 * GOUTTIERE_PX);
});

test("le réglage du pas reste dans la ligne de son établissement", async ({
  page,
}) => {
  await page.goto("/parametres/agences");

  // *On règle un pas en regardant celui des autres établissements* : sortir le
  // réglage dans un écran de détail ferait perdre la comparaison que le tableau
  // vient de gagner.
  const formulaires = page.locator("main tbody tr form");
  await expect(formulaires).toHaveCount(3);
});

test("le catalogue de forfaits occupe la même largeur, et la même forme", async ({
  page,
}) => {
  await page.goto("/parametres/forfaits");

  // Voir le commentaire du premier scénario : attendre la révélation du flux
  // avant de mesurer, sans changer la valeur attendue.
  await expect(page.locator("main")).toBeVisible();
  const largeur = await page
    .locator("main")
    .evaluate((element) => Math.round(element.getBoundingClientRect().width));
  expect(largeur).toBe(LARGEUR_UTILE_PX - 2 * GOUTTIERE_PX);

  // La MÊME forme d'en-tête que les agences — 10,5 px, capitales : c'est ce que
  // « les deux écrans se ressemblent » veut dire, et cela se mesure.
  //
  // *Le catalogue de démonstration naît VIDE (L1-06), et sans les deux forfaits
  // que la scène pose, cet écran n'afficherait AUCUN tableau : sa reprise
  // d'apparence serait restée « écrite mais jamais vue ».*
  //
  // **Le compte attendu se DÉRIVE, il ne se fige pas.** Depuis SEMIS-2 (#269),
  // le SEMIS lui-même pose désormais une ligne de démonstration
  // (`FORFAITS_DEMONSTRATION`, pour que `/parametres/forfaits/[id]` cesse
  // d'être sauté faute de donnée) — la base d'épreuve porte donc CETTE ligne
  // EN PLUS des deux que la scène ajoute. Un total figé à 2 redeviendrait faux
  // à chaque ligne que l'un ou l'autre pose ensuite (§9, 11/09) ; additionner
  // les deux sources reste vrai quel que soit leur nombre.
  const entete = page.locator("main thead th").first();
  await expect(entete).toHaveCSS("text-transform", "uppercase");
  await expect(entete).toHaveCSS("font-size", "10.5px");
  await expect(page.locator("main tbody tr")).toHaveCount(
    FORFAITS_SCENE.length + FORFAITS_DEMONSTRATION.length,
  );
});

// R2-04 mesurait ici la mise en page de `/arrivee` (contenu de 448 px, centré
// à mi-hauteur — la forme d'une page de connexion sous une barre ancrée en
// haut, avant correction). RETIRÉ par 99A-ARRIVEE : le compte de ce fichier
// (`ouvrirUneSession`, ADV, UNE société) ne voit plus jamais `/arrivee` — la
// page redirige d'emblée vers `/planning`, et un `page.goto("/arrivee")`
// suivrait la redirection sans rien peindre à mesurer. Aucun compte de
// `tests/e2e/setup/scene.ts` n'a de société active ni plusieurs sociétés pour
// rouvrir cet écran par un chemin réel ; en forger un romprait le
// cloisonnement d'une scène partagée sous `fullyParallel` (voir le piège du
// ticket). La classe `<Page>` qui portait la correction reste partagée et
// éprouvée par les AUTRES scénarios de ce fichier (établissements, forfaits,
// fiche d'intervention) : ce n'est donc pas une garantie qui reste sans
// aucune épreuve, seulement sans épreuve PROPRE à `/arrivee`.

test("la fiche d'intervention occupe la largeur utile, et garde ses actions", async ({
  page,
}) => {
  // R2-08. *Mesuré avant : `max-w-3xl`, soit 768 px dans une fenêtre de 1700, et
  // cinq actions empilées à la file sous l'identification.*
  await page.goto(`/interventions/${SCENE.obstacle}`);

  // Voir le commentaire du premier scénario : attendre la révélation du flux
  // avant de mesurer, sans changer la valeur attendue.
  await expect(page.locator("main")).toBeVisible();
  const largeur = await page
    .locator("main")
    .evaluate((element) => Math.round(element.getBoundingClientRect().width));
  expect(largeur).toBe(LARGEUR_UTILE_PX - 2 * GOUTTIERE_PX);

  // Les actions de D84 restent ATTEIGNABLES — c'est l'acceptation du ticket, et
  // c'est ce que déplacer des formulaires en colonne latérale risquait de
  // perdre. Un décompte plutôt qu'une présence : « il en reste » ne dit pas
  // combien ont disparu.
  //
  // **CINQ depuis L2-10** : la suspension et sa reprise s'ajoutent aux quatre
  // de D84 — et une seule des deux s'offre à la fois, l'autre n'ayant pas de
  // sens dans l'état où l'intervention se trouve.
  const actions = page.locator("main aside form");
  await expect(actions).toHaveCount(5);
});

test("les écrans sans session ne défilent pas pour rien", async ({ page }) => {
  // R2-09 et R2-10. *Mesuré avant : `min-h-dvh` posé sur la page, à l'intérieur
  // d'un cadre portant 88 px de gouttière verticale — document de 1088 px dans
  // une fenêtre de 1000, c'est-à-dire une page de connexion qui défile de 88 px
  // pour rien.*
  //
  // Retouché par 99A-ARRIVEE : ce scénario promet « sans session » mais
  // héritait, sans l'effacer, de la session ADV du `beforeEach` du fichier —
  // sans conséquence tant que `/connexion` redirigeait un compte déjà
  // authentifié vers le petit écran `/arrivee`. Depuis que `/arrivee`
  // redirige elle-même vers `/planning` pour ce compte à une seule société
  // (une page bien plus grande), l'omission cesse d'être sans conséquence :
  // la session est désormais effacée pour de bon.
  await page.context().clearCookies();
  for (const chemin of ["/sante", "/connexion"]) {
    await page.goto(chemin);
    const document_ = await page.evaluate(() => document.body.scrollHeight);
    expect(document_, `${chemin} déborde la fenêtre`).toBeLessThanOrEqual(
      FENETRE.height,
    );
  }
});

test("le parc machines rend des lignes, et la barre l'allume", async ({
  page,
}) => {
  // R2-21. *L'entrée « Parc machines » était INERTE depuis D95 : la fiche
  // existait depuis L2-01, et rien n'y menait.* Ce scénario éprouve les deux
  // moitiés — l'écran rend, et la barre le désigne.
  await page.goto("/parc");

  // Voir le commentaire du premier scénario : attendre la révélation du flux
  // avant de mesurer, sans changer la valeur attendue.
  await expect(page.locator("main")).toBeVisible();
  const largeur = await page
    .locator("main")
    .evaluate((element) => Math.round(element.getBoundingClientRect().width));
  expect(largeur).toBe(LARGEUR_UTILE_PX - 2 * GOUTTIERE_PX);

  // Le TÉMOIN : des lignes réelles. Une liste vide passerait toutes les
  // assertions de forme sans rien prouver du cloisonnement ni de la lecture.
  //
  // **DEPUIS N-10 (D125), CE N'EST PLUS UN TABLEAU** : `/parc` est un
  // maître-détail, et ce scénario en éprouve la forme plutôt que de
  // continuer à chercher des `<tr>`/`<th>` que l'écran ne rend plus — la
  // même intention que le scénario portait déjà (« des lignes RÉELLES, et le
  // message de vacuité ABSENT »), sur `.machine-row` plutôt que sur
  // `<tbody>`. Voir `tests/e2e/parc.spec.ts` pour le reste du comportement du
  // maître-détail (sélection, repli responsive, état vide).
  const lignes = page.locator('[data-bloc="liste-machines"] a');
  await expect(lignes.first()).toBeVisible();
  expect(await lignes.count()).toBeGreaterThan(0);
  await expect(page.getByText(fr["parc.aucune_trouvee"])).toHaveCount(0);
  await expect(page.locator('[data-bloc="apercu-hero"]')).toBeVisible();

  // L'entrée de la barre est désormais un LIEN, et c'est elle qui est allumée.
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: fr["nav.parc_machines"] }),
  ).toHaveAttribute("href", "/parc");

  // D98 — « Fiche machine » est SORTIE de la barre, et c'est ici qu'on le
  // mesure : à l'écran, là où un humain la lisait. *Le gardien unitaire prouve
  // que la liste ne la porte plus ; il ne prouve pas que la barre rendue ne la
  // montre plus.* La seconde attente est la paire qui doit rester verte pour
  // sa propre raison (§9, 11/09) : son voisin de libellé, lui, est bien là.
  // *Le libellé n'est pas écrit ici : il vient de la liste close, qui est son
  // seul domicile depuis que l'entrée a quitté le dictionnaire.*
  const barre = page.getByRole("navigation");
  for (const ecart of ECARTS_MAQUETTE) {
    await expect(
      barre.getByText(ecart.libelle, { exact: true }),
      ecart.motif,
    ).toHaveCount(0);
  }
  await expect(
    barre.getByText(fr["nav.parc_machines"], { exact: true }),
  ).toHaveCount(1);
});

test("la colonne latérale descend jusqu'en bas de la fenêtre, même sur un écran COURT", async ({
  page,
}) => {
  // N-08, 18/09/2026 — mesuré sur les captures du ticket, jamais ressenti :
  // fenêtre 1280 × 900, la colonne (`<aside>`) s'arrêtait à 747 px, laissant
  // 153 px de fond de page sous elle. Cause : `h-full` sur l'`<aside>`
  // résolvait un pourcentage contre son parent flex, dont la hauteur n'a
  // qu'un PLANCHER (`min-h-dvh`, jamais `height`) — un pourcentage contre une
  // hauteur `auto` ne résout à rien, et `height:100%` désactive au passage le
  // `align-items:stretch` qui aurait sinon suffi. Voir
  // `components/navigation/barre.tsx` pour le correctif (`h-dvh` + `sticky
  // top-0`, la forme exacte de `.sidebar` dans
  // `docs/maquette/codiplan-maquette-complete.html`).
  //
  // `/absences` est délibérément COURT : un écran dont le contenu dépasse
  // 900 px étirerait la colonne par accident, et le défaut resterait masqué
  // — c'est exactement la « population auto-sélectionnée » que ce scénario
  // évite en le disant.
  //
  // La session est déjà ouverte par le `beforeEach` du fichier — l'y ouvrir
  // une seconde fois viserait `/connexion` sur un compte déjà authentifié,
  // qui redirige ailleurs et ne montre plus le formulaire (mesuré : c'est
  // exactement ce qui a fait échouer ce scénario à l'écriture).
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/absences");

  const colonne = page.locator("aside").first();
  await expect(colonne).toBeVisible();

  // Le témoin : la page est bien COURTE, sans quoi la mesure ci-dessous ne
  // prouverait rien de ce qu'elle prétend.
  const hauteurDocument = await page.evaluate(() => document.body.scrollHeight);
  expect(
    hauteurDocument,
    "/absences n'est plus un écran court",
  ).toBeLessThanOrEqual(900);

  const hauteurColonne = await colonne.evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  expect(Math.round(hauteurColonne)).toBe(900);
});
