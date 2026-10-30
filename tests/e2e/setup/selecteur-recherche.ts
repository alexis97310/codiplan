import { type Locator, type Page, expect } from "@playwright/test";

/**
 * AIDES POUR `SelecteurRecherche` (SELECTEURS-1, 24/09/2026).
 *
 * Les trois écrans qui posaient un `<select>` — `/sites/nouveau`,
 * `/interventions/nouvelle`, `/parc/nouvelle` — cherchent désormais un
 * client, un site ou un modèle par `components/ui/selecteur-recherche.tsx` :
 * un champ texte, une liste de résultats, un choix qui pose un champ CACHÉ.
 * `data-selecteur={nom}` identifie chaque instance — voir le composant.
 *
 * Les scénarios qui manipulaient `select[name="site"]`/`selectOption(...)`
 * appellent maintenant `choisirPremierResultat`/`choisirResultatParTexte` :
 * la MISE EN SCÈNE change, aucune assertion métier n'est modifiée.
 */

function champ(portee: Page | Locator, nom: string): Locator {
  return portee.locator(`[data-selecteur="${nom}"]`);
}

/**
 * LA LISTE EST VRAIMENT VISIBLE, PAS SEULEMENT SA PREMIÈRE LIGNE
 * (9I7E-CREER-MACHINE-LISTES-DEROULANTES, 30/10/2026) — `choisirPremierResultat`
 * et `choisirResultatParTexte` cliquent toujours le PREMIER résultat, qui
 * reste visible même rogné par le bas d'une carte (il se rend juste sous le
 * champ, avant la coupure) ; c'est exactement ce qui a laissé passer le
 * signalement d'Alexis. Cette aide ouvre le sélecteur, exige AU MOINS DEUX
 * résultats, et éprouve le DERNIER : sa boîte doit être non nulle, tenir DANS
 * la fenêtre, et son centre doit, par `elementFromPoint`, retomber sur une
 * option — jamais sur ce qui la recouvre ou la rogne. Rend le libellé choisi,
 * et clique VRAIMENT cette dernière option (jamais la première).
 */
export async function assertListeVisibleEtCliquable(
  page: Page,
  nom: string,
  texte: string,
): Promise<string> {
  const bloc = champ(page, nom);
  const saisie = bloc.locator('input[type="text"]');
  // ATTENDRE LA RÉPONSE FILTRÉE, PAS UNE ABSENCE DE TRAFIC (même mesure que
  // `choisirResultatEnPaginant` ci-dessous) — le focus déclenche d'abord une
  // recherche non filtrée ; compter avant que la recherche filtrée par
  // `texte` ne soit revenue lirait encore cette liste-là.
  const motif = `q=${encodeURIComponent(texte)}`;
  await saisie.click();
  await Promise.all([
    page.waitForResponse((reponse) => reponse.url().includes(motif)),
    saisie.fill(texte),
  ]);
  const options = page.locator(`#${nom}-resultats li[role="option"]`);
  await expect(options.first()).toBeVisible();
  const compte = await options.count();
  expect(compte).toBeGreaterThan(1);
  const derniere = options.nth(compte - 1);
  const boite = await derniere.boundingBox();
  expect(boite).not.toBeNull();
  const fenetre = page.viewportSize();
  expect(fenetre).not.toBeNull();
  if (boite === null || fenetre === null) {
    throw new Error("inatteignable — les assertions ci-dessus ont déjà échoué");
  }
  expect(boite.y).toBeGreaterThanOrEqual(0);
  expect(boite.y + boite.height).toBeLessThanOrEqual(fenetre.height);
  const centre = {
    x: boite.x + boite.width / 2,
    y: boite.y + boite.height / 2,
  };
  const recouverte = await page.evaluate(
    ({ x, y, nom: nomDuChamp }) => {
      const element = document.elementFromPoint(x, y);
      return (
        element === null ||
        element.closest(`#${nomDuChamp}-resultats li[role="option"]`) === null
      );
    },
    { ...centre, nom },
  );
  expect(recouverte).toBe(false);
  const libelle = ((await derniere.textContent()) ?? "").trim();
  await derniere.click();
  return libelle;
}

/**
 * Ouvre le sélecteur `nom` et choisit le PREMIER résultat proposé — le cas
 * « n'importe quel choix valide suffit », qui remplace
 * `selectOption(optionsSite.first())`.
 *
 * Rend le libellé choisi, pour les scénarios qui veulent le reconnaître
 * ensuite (comme l'ancien code lisait le texte de l'option).
 */
export async function choisirPremierResultat(
  portee: Page | Locator,
  nom: string,
): Promise<string> {
  const bloc = champ(portee, nom);
  await bloc.locator('input[type="text"]').click();
  const premiere = bloc.locator('ul[role="listbox"] li[role="option"]').first();
  await expect(premiere).toBeVisible();
  const libelle = ((await premiere.textContent()) ?? "").trim();
  await premiere.click();
  return libelle;
}

/**
 * Ouvre le sélecteur `nom`, tape `texte`, et choisit le résultat qui
 * contient `libelleAttendu` (ou le premier résultat si absent).
 */
export async function choisirResultatParTexte(
  portee: Page | Locator,
  nom: string,
  texte: string,
  libelleAttendu?: string | RegExp,
): Promise<void> {
  const bloc = champ(portee, nom);
  const saisie = bloc.locator('input[type="text"]');
  await saisie.click();
  await saisie.fill(texte);
  const resultat =
    libelleAttendu === undefined
      ? bloc.locator('ul[role="listbox"] li[role="option"]').first()
      : bloc
          .locator('ul[role="listbox"] li[role="option"]')
          .filter({ hasText: libelleAttendu })
          .first();
  await expect(resultat).toBeVisible();
  await resultat.click();
}

/** La valeur actuellement posée dans le champ CACHÉ soumis avec le formulaire. */
export function valeurChamp(portee: Page | Locator, nom: string): Locator {
  return champ(portee, nom).locator('input[type="hidden"]');
}

/**
 * Ouvre le sélecteur `nom`, cherche `texte`, et enchaîne « Voir plus »
 * jusqu'à ce que le résultat `libelleAttendu` apparaisse — la preuve qu'un
 * référentiel de PLUS de 20 lignes reste atteignable (SELECTEURS-1).
 *
 * Attend le réseau après CHAQUE clic : le bouton ferme sur la valeur de
 * `page` au moment du rendu, et deux clics tirés sans attendre le
 * re-rendu React redemanderaient la MÊME page plutôt que d'avancer.
 */
export async function choisirResultatEnPaginant(
  page: Page,
  nom: string,
  texte: string,
  libelleAttendu: string | RegExp,
  libelleVoirPlus: string,
  clicsMaximum = 20,
): Promise<void> {
  const bloc = champ(page, nom);
  const saisie = bloc.locator('input[type="text"]');
  const resultat = bloc
    .locator('ul[role="listbox"] li[role="option"]')
    .filter({ hasText: libelleAttendu });
  const boutonVoirPlus = bloc.getByRole("button", { name: libelleVoirPlus });

  // LE FOCUS DÉCLENCHE UNE PREMIÈRE REQUÊTE IMMÉDIATE (non filtrée) ; LA
  // FRAPPE EN DÉCLENCHE UNE SECONDE, 250 ms PLUS TARD (débounce du
  // composant). `waitForLoadState("networkidle")` juste après `fill()`
  // peut se résoudre AVANT que cette seconde requête ne parte — la mesure a
  // montré la boucle « Voir plus » cliquer sur une liste encore non filtrée,
  // remplacée sous elle. On attend donc la réponse PRÉCISE de la requête
  // filtrée, jamais une absence générique de trafic réseau.
  const motif = `q=${encodeURIComponent(texte)}`;
  await saisie.click();
  await Promise.all([
    page.waitForResponse((reponse) => reponse.url().includes(motif)),
    saisie.fill(texte),
  ]);

  for (let clic = 0; clic < clicsMaximum; clic += 1) {
    if ((await resultat.count()) > 0) break;
    if (!(await boutonVoirPlus.isVisible())) break;
    await Promise.all([
      page.waitForResponse((reponse) => reponse.url().includes(motif)),
      boutonVoirPlus.click(),
    ]);
  }

  await expect(resultat.first()).toBeVisible();
  await resultat.first().click();
}
