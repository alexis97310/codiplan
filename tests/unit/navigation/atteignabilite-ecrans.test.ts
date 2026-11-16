import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { ENTREES, feuilles } from "@/lib/navigation/entrees";
import {
  cheminsDesignes,
  ecransOrphelins,
  mene,
  type Ecran,
} from "../../../scripts/lib/atteignabilite-ecrans";
import { RACINE } from "../outils/fichiers-source";

/**
 * TOUT ÉCRAN DU BACK-OFFICE EST ATTEIGNABLE — mesuré le 13/09/2026.
 *
 * *Trois écrans existaient et aucun lien n'y menait :* `/parametres/trajets`,
 * `/parametres/forfaits` et, selon le chemin qu'on emprunte, la liste des
 * sites. Le premier est celui qui fait mal : **Alexis avait demandé que les
 * temps de trajet soient paramétrables, et ils l'étaient déjà** (R3-03). Le
 * produit avait la fonction et pas la porte, et il a fallu lire le code pour
 * le savoir.
 *
 * *Un écran orphelin est une fonctionnalité qui n'existe pas.*
 */

const GROUPE = join(RACINE, "app", "(back-office)");

/** Les pages du groupe de routes — la population vient du dépôt. */
function pages(
  racine: string,
  prefixe = "",
): { route: string; fichier: string }[] {
  const trouves: { route: string; fichier: string }[] = [];
  for (const entree of readdirSync(racine, { withFileTypes: true })) {
    const chemin = join(racine, entree.name);
    if (entree.isDirectory()) {
      // Un segment entre parenthèses est un GROUPE de routes : il organise les
      // fichiers et n'apparaît pas dans l'URL.
      const segment = entree.name.startsWith("(") ? "" : `/${entree.name}`;
      trouves.push(...pages(chemin, `${prefixe}${segment}`));
    } else if (entree.name === "page.tsx") {
      trouves.push({ route: prefixe === "" ? "/" : prefixe, fichier: chemin });
    }
  }
  return trouves;
}

/**
 * Cache de contenu — UN fichier n'est lu qu'UNE fois, mesuré le 16/11/2026
 * sur 9L08A0 : sans lui, chaque écran reparcourt tout son graphe d'imports
 * depuis zéro (ensemble `vus` NEUF par écran), et chaque fichier y est lu
 * DEUX fois — une pour sonder l'extension, une pour la récursion. Sur les
 * cinquante écrans du back-office, pour 389 fichiers RÉELLEMENT distincts :
 * 31 311 appels à `readFileSync`, et le test dépassait sa limite de 5 s sous
 * charge. Le graphe d'imports est le même pour tout le dépôt, qu'on le
 * regarde depuis un écran ou un autre — il ne se calcule qu'une fois.
 */
const cacheContenu = new Map<string, string | null>();

function lireFichier(absolu: string): string | null {
  const vu = cacheContenu.get(absolu);
  if (vu !== undefined) {
    return vu;
  }
  let contenu: string | null;
  try {
    contenu = readFileSync(absolu, "utf8");
  } catch {
    contenu = null;
  }
  cacheContenu.set(absolu, contenu);
  return contenu;
}

/** Les imports locaux résolus d'un fichier — mémoïsés, le graphe ne se calcule qu'une fois. */
const cacheImports = new Map<string, string[]>();

function importsResolus(absolu: string): string[] {
  const vu = cacheImports.get(absolu);
  if (vu !== undefined) {
    return vu;
  }
  const resultats: string[] = [];
  const source = lireFichier(absolu);
  if (source !== null) {
    for (const trouve of source.matchAll(/from\s+"(@\/[^"]+|\.[^"]+)"/g)) {
      const brut = trouve[1]!;
      const base = brut.startsWith("@/")
        ? join(RACINE, brut.slice(2))
        : resolve(dirname(absolu), brut);
      for (const extension of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
        const candidat = `${base}${extension}`;
        if (lireFichier(candidat) !== null) {
          resultats.push(candidat);
          break;
        }
      }
    }
  }
  cacheImports.set(absolu, resultats);
  return resultats;
}

/**
 * Le source d'un écran, ET celui des composants LOCAUX qu'il utilise.
 *
 * Sans cette fermeture, un écran dont la liste vit dans un composant paraîtrait
 * ne mener nulle part — et le gardien rougirait sur un chemin qui existe. *Un
 * gardien qui crie à tort désapprend à lire les gardiens aussi sûrement qu'un
 * gardien muet* (§9, 11/09).
 *
 * `vus` reste propre à CHAQUE appel de premier niveau (un écran) : c'est ce
 * qui arrête un cycle d'imports PENDANT la descente. Le cache ci-dessus est
 * d'une autre nature — il survit entre les écrans — et c'est lui qui évite de
 * relire un fichier déjà vu par un écran précédent.
 */
function sourceAvecComposants(
  fichier: string,
  vus = new Set<string>(),
): string {
  const absolu = resolve(fichier);
  if (vus.has(absolu)) {
    return "";
  }
  vus.add(absolu);

  const source = lireFichier(absolu);
  if (source === null) {
    return "";
  }

  let total = source;
  for (const suivant of importsResolus(absolu)) {
    total += `\n${sourceAvecComposants(suivant, vus)}`;
  }
  return total;
}

/**
 * Les chemins désignés par UN fichier, mémoïsés — la seconde cause du
 * dépassement mesurée le 16/11/2026 sur 9L08A0.
 *
 * `cheminsDesignes` sur le TEXTE CONCATÉNÉ d'un écran rescanne, pour chaque
 * écran, tout le chrome partagé qu'il importe — sur le dépôt, 50 écrans
 * produisaient 84,8 Mo de texte cumulé (389 fichiers distincts seulement), et
 * les six motifs de `cheminsDesignes`, rejoués sur ce volume à chaque écran
 * de la fermeture transitive, coûtaient ~2,1 s à eux seuls. Calculé une fois
 * PAR FICHIER, puis réuni par écran, le même résultat ne rescanne plus jamais
 * un composant partagé pour un second écran qui l'inclut aussi.
 */
const cacheCheminsParFichier = new Map<string, readonly string[]>();

function cheminsDesignesParFichier(absolu: string): readonly string[] {
  const vu = cacheCheminsParFichier.get(absolu);
  if (vu !== undefined) {
    return vu;
  }
  const source = lireFichier(absolu);
  const resultat = source === null ? [] : cheminsDesignes(source);
  cacheCheminsParFichier.set(absolu, resultat);
  return resultat;
}

/** L'union des chemins désignés par un écran et toute sa fermeture d'imports. */
function cheminsDeFermeture(
  fichier: string,
  vus = new Set<string>(),
  acc = new Set<string>(),
): Set<string> {
  const absolu = resolve(fichier);
  if (vus.has(absolu)) {
    return acc;
  }
  vus.add(absolu);
  for (const chemin of cheminsDesignesParFichier(absolu)) {
    acc.add(chemin);
  }
  for (const suivant of importsResolus(absolu)) {
    cheminsDeFermeture(suivant, vus, acc);
  }
  return acc;
}

const ECRANS: readonly Ecran[] = pages(GROUPE).map(({ route, fichier }) => ({
  route,
  source: sourceAvecComposants(fichier),
  chemins: [...cheminsDeFermeture(fichier)],
}));

/**
 * Les départs : ce que la barre du back-office ouvre réellement.
 *
 * Depuis D118, `ENTREES` peut porter des groupes de premier niveau — un
 * groupe n'a pas de `chemin` propre, seuls ses enfants en ont un. Sans
 * `feuilles`, chaque écran nesté sous un groupe (Interventions, Imports
 * Excel, …) paraîtrait orphelin alors que la barre l'ouvre bel et bien, une
 * fois le groupe déplié.
 *
 * **LE CHROME DU LAYOUT S'Y AJOUTE DEPUIS 9I9-MON-COMPTE** — `ENTREES` ne
 * porte que les quatorze entrées de DOMAINE ; le pied de colonne (société
 * active, déconnexion, badge aux initiales) vit dans `app/(back-office)/
 * layout.tsx`, rendu sur CHAQUE écran du segment mais jamais importé PAR un
 * `page.tsx` — `sourceAvecComposants`, qui ne suit que les imports d'un
 * écran, ne le voit donc jamais. Sans cette ligne, le badge aux initiales
 * (qui mène à `/mon-compte`) resterait invisible à ce gardien tout en étant
 * réellement sur chaque écran : un départ de PLUS, jamais un écran retiré de
 * la vérification.
 */
const DEPARTS = [
  ...feuilles(ENTREES)
    .map((e) => e.chemin)
    .filter((chemin): chemin is string => chemin !== null),
  ...cheminsDeFermeture(join(GROUPE, "layout.tsx")),
];

/**
 * ÉCRANS RETIRÉS MAIS GARDÉS EN REDIRECTION — liste close, VIDE depuis
 * 9EZ-LOGO-SOCIETE-1 (D206, 13/10/2026).
 *
 * `/parametres/societe` (QT-22, D167, 05/10/2026, TP-NAV1) y figurait seule :
 * elle ne redirigeait plus que vers `/parametres`, sans porte qui y mène. Elle
 * ROUVRE pour le bloc Logo (D206) et retrouve sa porte — le lien « Changer le
 * logo » de la carte Identité du hub (`app/(back-office)/parametres/
 * page.tsx`) — si bien qu'elle est désormais atteinte DE PROCHE EN PROCHE,
 * sans exemption. Une liste vide qui reste vide est un meilleur signal qu'une
 * entrée qu'on cesse de regarder.
 */
const ECRANS_RETIRES_EN_REDIRECTION: readonly string[] = [];

describe("aucun écran du back-office n'est orphelin", () => {
  it("la population n'est pas vide, et elle vient du dépôt", () => {
    // TÉMOIN : un gardien qui n'énumère aucun écran passerait au vert sans
    // avoir rien regardé (§9, 30/08).
    expect(ECRANS.length).toBeGreaterThan(5);
    expect(DEPARTS.length).toBeGreaterThan(0);
    // Et les sources ont bien été lues : un écran vide ne mène nulle part et
    // ferait conclure « orphelin » à tort.
    expect(ECRANS.every((e) => e.source.length > 0)).toBe(true);
  });

  it("chaque écran retiré-en-redirection existe réellement, et redirige", () => {
    for (const route of ECRANS_RETIRES_EN_REDIRECTION) {
      const ecran = ECRANS.find((e) => e.route === route);
      expect(ecran, route).toBeDefined();
      expect(ecran?.source, route).toContain("redirect(");
    }
  });

  it("chaque écran est atteint depuis la barre, directement ou de proche en proche — hors écrans retirés-en-redirection", () => {
    const orphelins = ecransOrphelins(ECRANS, DEPARTS).filter(
      (route) => !ECRANS_RETIRES_EN_REDIRECTION.includes(route),
    );

    expect(
      orphelins,
      "ces écrans existent et AUCUN lien n'y mène — ni la barre, ni un écran " +
        "lui-même atteignable. Un écran orphelin est une fonctionnalité qui " +
        "n'existe pas : celui qui doit s'en servir ne la trouvera jamais, et " +
        "aucun autre contrôle du dépôt ne le dit.",
    ).toEqual([]);
  });
});

/**
 * LE CACHE NE CHANGE PAS CE QUE LE GARDIEN VOIT — 9L08A0, 16/11/2026.
 *
 * `sourceAvecComposants` mémoïse désormais lectures et imports résolus. Cette
 * épreuve rejoue l'ANCIEN algorithme — un `readFileSync` par fichier et par
 * écran, sans aucun partage — sur le dépôt réel, et exige exactement la même
 * population d'écrans, les mêmes départs et les mêmes orphelins que la
 * version mémoïsée déjà utilisée ci-dessus. Un cache qui change le résultat
 * serait un défaut masqué par une mesure de vitesse.
 *
 * **Volontairement lent, et volontairement hors du délai de 5000 ms** : cette
 * épreuve rejoue EXPRÈS l'algorithme SANS cache sur tout le dépôt — c'est le
 * seul moyen de prouver l'équivalence contre la version d'avant. Son coût
 * vit dans un `beforeAll` à délai explicite élargi, jamais dans le test
 * mesuré au § CONTEXTE ni dans le chemin que le gardien utilise réellement.
 */
function sourceAvecComposantsSansCache(
  fichier: string,
  vus = new Set<string>(),
): string {
  const absolu = resolve(fichier);
  if (vus.has(absolu)) {
    return "";
  }
  vus.add(absolu);

  let source: string;
  try {
    source = readFileSync(absolu, "utf8");
  } catch {
    return "";
  }

  let total = source;
  for (const trouve of source.matchAll(/from\s+"(@\/[^"]+|\.[^"]+)"/g)) {
    const brut = trouve[1]!;
    const base = brut.startsWith("@/")
      ? join(RACINE, brut.slice(2))
      : resolve(dirname(absolu), brut);
    for (const extension of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
      try {
        readFileSync(`${base}${extension}`, "utf8");
        total += `\n${sourceAvecComposantsSansCache(`${base}${extension}`, vus)}`;
        break;
      } catch {
        continue;
      }
    }
  }
  return total;
}

describe("la mémoïsation du graphe d'imports ne change pas le résultat", () => {
  let ECRANS_SANS_CACHE: readonly Ecran[];
  let DEPARTS_SANS_CACHE: string[];

  beforeAll(() => {
    // `chemins` est ici calculé par la méthode d'ORIGINE — `cheminsDesignes`
    // sur le texte concaténé en entier, sans la mémoïsation par fichier — pour
    // que cette épreuve reste un témoin indépendant de l'optimisation testée.
    ECRANS_SANS_CACHE = pages(GROUPE).map(({ route, fichier }) => {
      const source = sourceAvecComposantsSansCache(fichier);
      return { route, source, chemins: cheminsDesignes(source) };
    });
    DEPARTS_SANS_CACHE = [
      ...feuilles(ENTREES)
        .map((e) => e.chemin)
        .filter((chemin): chemin is string => chemin !== null),
      ...cheminsDesignes(
        sourceAvecComposantsSansCache(join(GROUPE, "layout.tsx")),
      ),
    ];
  }, 30000);

  it("même population d'écrans", () => {
    expect(ECRANS_SANS_CACHE.map((e) => e.route).sort()).toEqual(
      ECRANS.map((e) => e.route).sort(),
    );
  });

  it("mêmes départs", () => {
    expect([...DEPARTS_SANS_CACHE].sort()).toEqual([...DEPARTS].sort());
  });

  it("mêmes orphelins", () => {
    expect(ecransOrphelins(ECRANS_SANS_CACHE, DEPARTS_SANS_CACHE)).toEqual(
      ecransOrphelins(ECRANS, DEPARTS),
    );
  });
});

/**
 * LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON (§9, 11/09) — sans lui, le
 * gardien pourrait être vert parce qu'il apparie trop largement.
 */
describe("l'appariement d'un chemin à une route", () => {
  it("un gabarit mène à la route dynamique qu'il commence", () => {
    expect(mene("/parc/", "/parc/[id]")).toBe(true);
    expect(mene("/parc", "/parc")).toBe(true);
  });

  it("et il ne mène PAS à une route voisine, ni au-delà d'un segment", () => {
    expect(mene("/parc/", "/parc/[id]/documents")).toBe(false);
    expect(mene("/parc", "/parc/[id]")).toBe(false);
    expect(mene("/parc/", "/sites/[id]")).toBe(false);
    // Une route statique ne s'atteint pas par le gabarit d'une autre.
    expect(mene("/parametres/", "/parametres/trajets")).toBe(false);
  });

  it("c'est la VALEUR qui désigne, jamais le nom de l'attribut", () => {
    // `lien={…}` est un composant maison, et il a produit un FAUX ORPHELIN à la
    // première exécution du gardien : la fiche d'un site se rejoint par là.
    const lus = cheminsDesignes(
      'href="/parc" redirect("/planning") lien={`/sites/${site.id}`} ' +
        'href={`/parc/${m.id}`} chemin: "/parametres/trajets"',
    );
    expect(lus.sort()).toEqual([
      "/parametres/trajets",
      "/parc",
      "/parc/",
      "/planning",
      "/sites/",
    ]);
  });
});
