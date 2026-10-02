import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Parcours des sources du dépôt, pour les gardiens statiques (L0-06).
 *
 * Deux règles du ticket ne se prouvent pas en exécutant du code : « aucun rôle
 * en chaîne libre nulle part » et « aucun chemin hors `lib/reporting` n'utilise
 * la connexion de consolidation ». Elles se prouvent en lisant le dépôt. Ce
 * module fournit la lecture ; les deux tests fournissent la règle.
 */

/** Racine du dépôt, déduite de l'emplacement de ce fichier. */
export const RACINE = join(import.meta.dirname, "..", "..", "..");

const IGNORES = new Set([
  "node_modules",
  ".git",
  ".next",
  "out",
  "build",
  "coverage",
  "playwright-report",
  "test-results",
]);

/** Extensions retenues par défaut : les sources TypeScript du dépôt. */
export const EXTENSIONS_TS = [".ts", ".tsx", ".mts"] as const;

/** Feuilles de style — périmètre du gardien des couleurs (L0-09). */
export const EXTENSIONS_CSS = [".css"] as const;

/** Un fichier source, chemin relatif à la racine et contenu. */
export type FichierSource = {
  /** Chemin relatif, toujours en séparateurs `/`. */
  chemin: string;
  contenu: string;
};

function parcourir(
  repertoire: string,
  resultat: FichierSource[],
  extensions: readonly string[],
): void {
  for (const entree of readdirSync(repertoire)) {
    if (IGNORES.has(entree)) {
      continue;
    }
    const complet = join(repertoire, entree);
    if (statSync(complet).isDirectory()) {
      parcourir(complet, resultat, extensions);
      continue;
    }
    if (!extensions.some((extension) => entree.endsWith(extension))) {
      continue;
    }
    resultat.push({
      chemin: relative(RACINE, complet).split(sep).join("/"),
      contenu: readFileSync(complet, "utf8"),
    });
  }
}

/**
 * Tous les fichiers des répertoires demandés, filtrés par extension.
 *
 * `extensions` vaut les sources TypeScript par défaut ; le gardien des couleurs
 * (L0-09) s'en sert aussi pour lire les feuilles de style, où une couleur
 * s'écrit tout aussi bien.
 *
 * Le SQL des migrations est délibérément hors périmètre : la base a son propre
 * garde-fou, le type PostgreSQL `"Role"`, qui fait échouer une valeur inventée
 * à l'application de la migration.
 */
export function fichiersSource(
  repertoires: readonly string[],
  extensions: readonly string[] = EXTENSIONS_TS,
): FichierSource[] {
  const resultat: FichierSource[] = [];
  for (const repertoire of repertoires) {
    parcourir(join(RACINE, repertoire), resultat, extensions);
  }
  return resultat;
}

/**
 * Le même code, commentaires retirés (ticket L0-08).
 *
 * **Pourquoi les gardiens en ont besoin.** Trois règles du ticket L0-08 se
 * prouvent en cherchant des motifs dans les sources : un identifiant de fuseau,
 * une date fériée, un accesseur local de `Date`. Or la documentation du module
 * calendrier CITE ces motifs — c'est même ce qui la rend lisible : « ex.
 * Pacific/Noumea », « jamais par getDay() ». Un gardien qui lirait le texte
 * brut échouerait donc sur les commentaires qui expliquent la règle, et la
 * seule façon de le faire passer serait d'appauvrir la documentation. C'est
 * l'inverse de ce qu'on veut.
 *
 * Un commentaire ne peut pas coder en dur un fuseau : il n'est pas exécuté.
 * Le retirer avant l'analyse n'affaiblit donc aucun des trois gardiens.
 *
 * **Ticket 9CN — pourquoi une paire de regex ne suffisait plus.** La première
 * version retirait `/* … *\/` et `// …` par deux remplacements globaux, sans
 * jamais regarder si ce `/*` ou ce `//` vivait dans une chaîne. `accept="image/*"`
 * (`app/(mobile)/terrain/[id]/page.tsx`) ouvrait ainsi un faux commentaire bloc
 * qui avalait tout le code jusqu'au PROCHAIN `*\/` du fichier — des lignes
 * entières disparaissaient de la lecture des gardiens sans qu'aucun ne rougisse,
 * puisqu'ils lisent tous une sortie déjà tronquée. Cette version balaie le texte
 * caractère par caractère et épargne le contenu de `'…'`, `"…"`, et des gabarits
 * `` `…` `` — y compris leurs `${…}` imbriqués, qui redeviennent du code le temps
 * de la substitution — ainsi que les littéraux regex (`/…/`, distingués d'une
 * division par le dernier jeton significatif lu). Un bloc retiré laisse AUTANT
 * de `\n` qu'il en contenait : les numéros de ligne en aval ne bougent plus,
 * alors que l'ancienne version les décalait en réduisant tout bloc à un seul
 * saut de ligne.
 *
 * **Le `//` d'une URL DANS UNE CHAÎNE reste épargné par la protection des
 * chaînes** — mais hors chaîne, dans du texte JSX (`<a>http://…</a>`), rien ne
 * le protégeait avant le ticket 9CQ : il ouvrait un vrai commentaire ligne et
 * avalait la fin de la ligne (constat du 02/10/2026). L'exemption ajoutée est
 * étroite — un `//` dont le caractère IMMÉDIATEMENT précédent est `:` n'ouvre
 * pas de commentaire, ce qui couvre `http://`/`https://` sans épargner un vrai
 * commentaire qui suivrait un `:` avec une espace entre les deux
 * (`lib/interventions/depot.ts:1519`, qui reste retiré).
 *
 * L'analyse reste volontairement grossière — elle ne cherche pas à comprendre
 * TypeScript, seulement à ne pas confondre prose et code — et elle est éprouvée
 * sur des cas fabriqués par le gardien qui s'en sert.
 */
export function sansCommentaires(source: string): string {
  const n = source.length;
  let out = "";
  let i = 0;

  type Cadre =
    { type: "gabarit" } | { type: "substitution"; profondeur: number };
  const pile: Cadre[] = [];

  // Vrai quand le dernier jeton significatif rend un `/` suivant une DIVISION
  // plutôt qu'un littéral regex (`return /x/` est un regex, `a /x/` est une
  // division de trois valeurs — la distinction classique de tout lexeur JS).
  let diviseurAttendu = false;

  const MOTS_AVANT_REGEX = new Set([
    "return",
    "typeof",
    "instanceof",
    "in",
    "of",
    "new",
    "delete",
    "void",
    "throw",
    "case",
    "do",
    "else",
    "yield",
    "await",
    "default",
    "extends",
    "function",
    "class",
    "export",
    "import",
    "static",
    "async",
  ]);

  while (i < n) {
    const sommet = pile[pile.length - 1];

    if (sommet?.type === "gabarit") {
      const c = source[i];
      if (c === "\\") {
        out += source.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (c === "`") {
        out += c;
        pile.pop();
        diviseurAttendu = true;
        i += 1;
        continue;
      }
      if (c === "$" && source[i + 1] === "{") {
        out += "${";
        pile.push({ type: "substitution", profondeur: 0 });
        diviseurAttendu = false;
        i += 2;
        continue;
      }
      out += c;
      i += 1;
      continue;
    }

    const c = source[i];
    const c2 = source[i + 1];

    // Commentaire bloc : remplacé par autant de \n qu'il en contenait.
    if (c === "/" && c2 === "*") {
      const fin = source.indexOf("*/", i + 2);
      const texte = fin === -1 ? source.slice(i) : source.slice(i, fin + 2);
      out += "\n".repeat(texte.split("\n").length - 1);
      i += texte.length;
      diviseurAttendu = false;
      continue;
    }

    // Commentaire ligne : retiré jusqu'au \n, qui lui survit — sauf si le
    // premier `/` est IMMÉDIATEMENT précédé de `:` (une URL hors chaîne,
    // ex. du texte JSX `http://…`), qui n'ouvre pas de commentaire.
    if (c === "/" && c2 === "/" && source[i - 1] !== ":") {
      const fin = source.indexOf("\n", i);
      i = fin === -1 ? n : fin;
      diviseurAttendu = false;
      continue;
    }

    // Chaîne '…' ou "…", épargnée en bloc, échappements compris.
    if (c === "'" || c === '"') {
      const guillemet = c;
      let j = i + 1;
      while (j < n) {
        if (source[j] === "\\") {
          j += 2;
          continue;
        }
        if (source[j] === guillemet || source[j] === "\n") {
          if (source[j] === guillemet) j += 1;
          break;
        }
        j += 1;
      }
      out += source.slice(i, j);
      i = j;
      diviseurAttendu = true;
      continue;
    }

    // Ouverture d'un gabarit `…`.
    if (c === "`") {
      out += c;
      pile.push({ type: "gabarit" });
      i += 1;
      diviseurAttendu = true;
      continue;
    }

    // Littéral regex, épargné en bloc — distingué d'une division par
    // `diviseurAttendu`. `[…]` est traversé sans que son `/` ne ferme le
    // littéral (classe de caractères).
    if (c === "/" && !diviseurAttendu) {
      let j = i + 1;
      let dansClasse = false;
      let ferme = false;
      while (j < n) {
        const d = source[j];
        if (d === "\\") {
          j += 2;
          continue;
        }
        if (d === "\n") break;
        if (d === "[") {
          dansClasse = true;
          j += 1;
          continue;
        }
        if (d === "]") {
          dansClasse = false;
          j += 1;
          continue;
        }
        if (d === "/" && !dansClasse) {
          j += 1;
          ferme = true;
          break;
        }
        j += 1;
      }
      if (ferme) {
        while (j < n && /[a-zA-Z]/.test(source[j])) j += 1;
        out += source.slice(i, j);
        i = j;
        diviseurAttendu = true;
        continue;
      }
      // Pas de fermeture trouvée avant la fin de ligne : ce n'était pas un
      // regex, le `/` retombe au traitement générique ci-dessous.
    }

    // Dans une substitution ${…} : son accolade fermante y met fin, celles
    // qu'elle contient (objet, bloc…) se comptent au passage.
    if (sommet?.type === "substitution") {
      if (c === "{") {
        sommet.profondeur += 1;
        out += c;
        i += 1;
        diviseurAttendu = false;
        continue;
      }
      if (c === "}") {
        if (sommet.profondeur === 0) {
          pile.pop();
        } else {
          sommet.profondeur -= 1;
        }
        out += c;
        i += 1;
        diviseurAttendu = true;
        continue;
      }
    }

    // Identifiant ou mot-clé : la liste close ci-dessus décide si un `/` qui
    // suivrait serait un regex.
    if (/[A-Za-z_$]/.test(c)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_$]/.test(source[j])) j += 1;
      const mot = source.slice(i, j);
      out += mot;
      diviseurAttendu = !MOTS_AVANT_REGEX.has(mot);
      i = j;
      continue;
    }

    // Nombre : un `/` qui suit est toujours une division.
    if (/[0-9]/.test(c)) {
      let j = i + 1;
      while (j < n && /[0-9.a-fA-FxXoObB_]/.test(source[j])) j += 1;
      out += source.slice(i, j);
      i = j;
      diviseurAttendu = true;
      continue;
    }

    // Tout le reste : ponctuation, espaces, texte JSX. `)` et `]` ferment une
    // expression (un `/` suivant divise) ; le reste remet l'attente à faux,
    // sauf les espaces qui ne jugent de rien.
    out += c;
    i += 1;
    if (c === ")" || c === "]") {
      diviseurAttendu = true;
    } else if (!/\s/.test(c)) {
      diviseurAttendu = false;
    }
  }

  return out;
}
