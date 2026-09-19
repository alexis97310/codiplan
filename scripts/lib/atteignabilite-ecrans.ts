/**
 * UN ÉCRAN ORPHELIN EST UNE FONCTIONNALITÉ QUI N'EXISTE PAS, et rien ne le
 * disait (mesuré le 13/09/2026).
 *
 * ## Ce qui a ouvert la question
 *
 * Alexis a demandé que les temps de trajet soient paramétrables. **Ils le sont
 * depuis R3-03** — les valeurs sont des défauts, la table les porte, l'écran
 * existe. *Et personne ne pouvait y arriver* : la barre mène à
 * `/parametres/agences` et à rien d'autre, et le seul chemin vers les trajets
 * était une redirection d'API après soumission — c'est-à-dire un chemin qu'on
 * n'emprunte qu'en venant d'un formulaire qu'on ne peut pas ouvrir.
 *
 * **Il a fallu lire le code pour le savoir.** L'ADV qui doit saisir ces données
 * ne l'aurait jamais trouvé, et aucune assertion du dépôt n'aurait rougi : les
 * scénarios de rendu ouvrent un écran par son chemin, ce qui suppose déjà
 * qu'on sache le chemin. *C'est la famille du 09/09 — un défaut invisible à
 * toute assertion —, prise par un autre bout : ici l'image ne l'aurait pas
 * montré non plus, puisqu'il faut regarder les écrans qu'on n'a PAS.*
 *
 * ## La règle
 *
 * **Tout écran de `app/(back-office)/` est atteignable par au moins un lien**,
 * depuis la barre de navigation ou depuis un écran lui-même atteignable. C'est
 * une fermeture transitive, et c'est ce qui la rend juste : `/sites` n'est pas
 * dans la barre, et pourtant on y arrive — depuis le lieu d'une intervention,
 * puis depuis la fiche du site. *Exiger la barre aurait refusé un chemin qui
 * existe ; exiger « un lien quelque part » aurait accepté un écran qui ne
 * renvoie qu'à lui-même.*
 *
 * ## CE QU'IL NE PROUVE PAS, et c'est écrit plutôt que tu
 *
 * Il prouve qu'un chemin **existe dans le code**, jamais qu'il est **trouvable
 * par un humain** : un lien au bas d'une fiche atteinte par trois clics est un
 * chemin, et c'est un mauvais chemin. Il ne lit pas non plus les liens
 * construits à l'exécution — un `href={variable}` lui échappe, et c'est la
 * forme 6 du §9 (26/08), qu'aucun motif statique n'arrête.
 */

/** Un écran : sa route, et le texte où ses liens se lisent. */
export type Ecran = {
  /** La route Next.js, segments dynamiques compris : `/parc/[id]`. */
  readonly route: string;
  /** Le source de la page ET des composants locaux qu'elle utilise. */
  readonly source: string;
};

/**
 * Les chemins internes qu'un source DÉSIGNE.
 *
 * **Les gabarits comptent, et c'est le cas majoritaire** : une fiche se rejoint
 * par `` href={`/parc/${machine.id}`} ``, jamais par une chaîne nue. Seule la
 * partie LITTÉRALE est retenue — `/parc/` —, et l'appariement la traite comme
 * la désignation d'un segment dynamique.
 */
export function cheminsDesignes(source: string): string[] {
  const trouves = new Set<string>();

  // ── C'EST LA VALEUR QUI DÉSIGNE, JAMAIS LE NOM DE L'ATTRIBUT ─────────────
  //
  // La première rédaction ne lisait que `href`, et elle a rendu un FAUX
  // ORPHELIN dès sa première exécution : la fiche d'un site se rejoint depuis
  // le lieu d'une intervention par `` lien={`/sites/${ligne.site_id}`} `` — un
  // composant maison, dont l'attribut porte un autre nom. *Chasser les noms
  // d'attributs, c'est tenir une liste close à la main, que le prochain
  // composant fera mentir.* Tout attribut dont la VALEUR est un chemin interne
  // désigne donc ce chemin.
  // ── ET UN NOM D'ATTRIBUT N'EST PAS LE SEUL NOM POSSIBLE ──────────────────
  //
  // Un écran d'aiguillage tient ses routes dans un TABLEAU et les rend par une
  // boucle : `` { chemin: "/parametres/trajets", … } `` puis
  // `` href={porte.chemin} ``. C'est la bonne façon d'écrire cet écran-là, et
  // la rédaction précédente ne la voyait pas — elle aurait poussé à écrire
  // quatre liens à la main POUR SATISFAIRE LE GARDIEN. *Un gardien qui force à
  // écrire du code moins bon a cessé de servir ce qu'il garde.*
  //
  // Ce qu'il lit est donc une DÉSIGNATION : un nom, puis un chemin interne —
  // que le nom soit un attribut JSX (`href=`) ou une clé d'objet (`chemin:`).
  const motifs = [
    /\b[a-zA-Z_]+\s*[:=]\s*\{?"(\/[^"]*)"/g,
    /\b[a-zA-Z_]+\s*[:=]\s*\{?`(\/[^`$]*)/g,
    /(?:redirect|push|replace)\(\s*"(\/[^"]*)"/g,
    /(?:redirect|push|replace)\(\s*`(\/[^`$]*)/g,
  ];

  for (const motif of motifs) {
    for (const trouve of source.matchAll(motif)) {
      const chemin = trouve[1]!.split("?")[0]!.split("#")[0]!;
      if (chemin.startsWith("/")) {
        trouves.add(chemin);
      }
    }
  }

  // ── LE SEGMENT DYNAMIQUE PEUT ÊTRE SUIVI D'UN SUFFIXE LITTÉRAL ───────────
  //
  // Les quatre motifs ci-dessus s'arrêtent au premier `${` : un gabarit
  // `` `/parc/${machine.id}/modifier` `` ne leur rend que `/parc/`, qui mène
  // à `/parc/[id]` mais jamais à `/parc/[id]/modifier` — mesuré le 18/09/2026
  // sur la première route du dépôt où le segment dynamique n'est pas le
  // dernier. Ce motif-ci lit le gabarit EN ENTIER et remplace CHAQUE
  // interpolation par `SEGMENT_DYNAMIQUE`, pour que `mene()` puisse faire
  // correspondre un segment de la désignation à N'IMPORTE QUEL rang de la
  // route, pas seulement au dernier. Il s'AJOUTE aux motifs ci-dessus, il ne
  // les remplace pas : les deux désignations coexistent dans `trouves`.
  const motifsAvecSuffixe = [
    /\b[a-zA-Z_]+\s*[:=]\s*\{?`([^`]*)`/g,
    /(?:redirect|push|replace)\(\s*`([^`]*)`/g,
  ];
  for (const motif of motifsAvecSuffixe) {
    for (const trouve of source.matchAll(motif)) {
      const brut = trouve[1]!;
      if (!brut.startsWith("/") || !brut.includes("${")) {
        continue;
      }
      const normalise = brut
        .replaceAll(/\$\{[^}]*\}/g, SEGMENT_DYNAMIQUE)
        .split("?")[0]!
        .split("#")[0]!;
      // Redondant avec les quatre motifs ci-dessus quand le gabarit S'ARRÊTE
      // au segment dynamique (rien après le dernier jeton) : ne l'ajouter
      // dans ce cas ferait deux désignations pour le même lien, l'une déjà
      // couverte par la forme 2 de `mene()`. Seul un SUFFIXE littéral après
      // le dernier segment dynamique justifie la forme 1.
      if (!normalise.endsWith(SEGMENT_DYNAMIQUE)) {
        trouves.add(normalise);
      }
    }
  }

  return [...trouves];
}

/** Le jeton qui, dans une désignation, représente un segment interpolé (`${…}`). */
const SEGMENT_DYNAMIQUE = "\u0000";

/**
 * Ce chemin désigné mène-t-il à cette route ?
 *
 * Trois formes, et la troisième est celle des fiches : `/parc/` désigné mène à
 * `/parc/[id]`, parce que le reste du gabarit remplit le segment dynamique.
 */
export function mene(designe: string, route: string): boolean {
  if (designe === route) {
    return true;
  }

  // ── FORME 1 : LE SEGMENT DYNAMIQUE EST EXPLICITE (`SEGMENT_DYNAMIQUE`) ───
  //
  // Il peut être à N'IMPORTE QUEL rang de la route — `/parc/\0/modifier`
  // mène à `/parc/[id]/modifier` comme `/parc/\0` mène à `/parc/[id]`. La
  // désignation porte alors AUTANT de segments que la route : le jeton en
  // occupe un, là où la forme 2 ci-dessous s'arrête avant de le compter.
  if (designe.includes(SEGMENT_DYNAMIQUE)) {
    const segmentsRoute = route.split("/").filter((s) => s.length > 0);
    const segmentsDesignes = designe.split("/").filter((s) => s.length > 0);
    if (segmentsDesignes.length !== segmentsRoute.length) {
      return false;
    }
    return segmentsDesignes.every((s, i) =>
      s === SEGMENT_DYNAMIQUE
        ? segmentsRoute[i]!.startsWith("[")
        : s === segmentsRoute[i],
    );
  }

  // ── FORME 2 : LE GABARIT S'ARRÊTE AU SEGMENT DYNAMIQUE (historique) ──────
  //
  // LA BARRE OBLIQUE FINALE PORTE TOUTE LA DIFFÉRENCE, et elle n'est pas de la
  // cosmétique : `href="/parc"` ouvre la LISTE, `` href={`/parc/${id}`} ``
  // ouvre une FICHE. Le second ne laisse qu'un littéral `/parc/`. La dépouiller
  // ferait d'un lien vers la liste une porte vers la fiche — un écran de
  // détail passerait alors pour atteignable sans que rien n'y mène.
  if (!designe.endsWith("/")) {
    return false;
  }

  const segmentsRoute = route.split("/").filter((s) => s.length > 0);
  const segmentsDesignes = designe.split("/").filter((s) => s.length > 0);

  // Le gabarit s'arrête là où le segment dynamique commence : il a donc un
  // segment de MOINS que la route, et tous les précédents coïncident.
  if (segmentsDesignes.length !== segmentsRoute.length - 1) {
    return false;
  }
  if (!segmentsRoute[segmentsRoute.length - 1]!.startsWith("[")) {
    return false;
  }
  return segmentsDesignes.every((s, i) => s === segmentsRoute[i]);
}

/**
 * LES ÉCRANS QU'AUCUN CHEMIN N'ATTEINT, par fermeture transitive depuis la
 * barre.
 *
 * La population vient du DÉPÔT — les fichiers `page.tsx` du groupe de routes —
 * et jamais d'une liste tenue à la main : un écran écrit demain y entre de
 * lui-même, et c'est tout l'objet. *Une liste d'admis oublie, par construction,
 * l'écran que personne n'y a ajouté.*
 */
export function ecransOrphelins(
  ecrans: readonly Ecran[],
  departs: readonly string[],
): string[] {
  const atteints = new Set<string>();
  const aExplorer: string[] = [];

  const ouvrir = (designe: string): void => {
    for (const ecran of ecrans) {
      if (mene(designe, ecran.route) && !atteints.has(ecran.route)) {
        atteints.add(ecran.route);
        aExplorer.push(ecran.route);
      }
    }
  };

  for (const depart of departs) {
    ouvrir(depart);
  }

  while (aExplorer.length > 0) {
    const route = aExplorer.pop()!;
    const ecran = ecrans.find((e) => e.route === route);
    if (ecran === undefined) {
      continue;
    }
    for (const designe of cheminsDesignes(ecran.source)) {
      ouvrir(designe);
    }
  }

  return ecrans
    .map((e) => e.route)
    .filter((route) => !atteints.has(route))
    .sort();
}
