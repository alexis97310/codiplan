import { posix } from "node:path";

import ts from "typescript";

/**
 * Lecture des emplacements VISIBLES d'un fichier source (ticket L0-11).
 *
 * Ce module fournit la LECTURE ; `tests/unit/i18n/sans-chaine-visible-en-dur`
 * fournit la règle — même partage que `fichiers-source.ts` et les gardiens qui
 * s'en servent.
 *
 * **Il lit l'arbre syntaxique, pas le texte.** Un gardien à expressions
 * régulières aurait eu à décider si `"Bonjour"` est un libellé, une classe CSS,
 * une clé ou une URL ; il aurait donc eu besoin d'une heuristique, et une
 * heuristique est exactement ce qui rend un gardien creux. Ici la question ne se
 * pose pas : le compilateur dit où la chaîne se trouve. Un texte entre deux
 * balises est visible parce qu'il est un `JsxText`, pas parce qu'il ressemble à
 * du français. La graphie — guillemets simples ou doubles, accents graves,
 * retours à la ligne, casse — disparaît du même coup : l'analyse ne la voit
 * plus (forme 1 du §9). Les commentaires disparaissent aussi, et c'est la seule
 * coupure « documentation contre exécution » que le module s'autorise : ils ne
 * sont pas des nœuds de l'arbre. Aucune chaîne littérale n'est en revanche
 * retirée du périmètre, jamais.
 */

/** Un emplacement où une chaîne atteint l'écran. */
export type Emplacement =
  "texte JSX" | "attribut visible" | "métadonnées" | "requête d'écran";

/** Une chaîne écrite en dur dans un emplacement visible. */
export type ChaineVisible = {
  readonly emplacement: Emplacement;
  readonly ligne: number;
  readonly texte: string;
};

/**
 * Ce qui fait qu'un fichier est CONCERNÉ. Trois marques, chacune un fait du
 * cadre technique — jamais une opinion sur le rôle du fichier.
 */
export type Marque =
  /** Il porte du JSX : le compilateur ne l'accepte que dans un `.tsx`. */
  | "rend du JSX"
  /** Il exporte les `metadata` de Next.js : titre et description du document. */
  | "exporte des métadonnées"
  /** Il interroge l'écran : API de Testing Library ou de Playwright. */
  | "interroge l'écran";

export type Analyse = {
  readonly chemin: string;
  readonly marques: readonly Marque[];
  readonly chaines: readonly ChaineVisible[];
};

/**
 * Attributs HTML dont la valeur est LUE par un humain — à l'écran, ou par un
 * lecteur d'écran, ce qui est la même chose au regard de D26.
 *
 * C'est un vocabulaire du HTML, extérieur au dépôt, au même titre que la
 * palette de Tailwind qu'énumère le gardien des couleurs. Ce n'est pas la liste
 * des fichiers concernés — celle-là se déduit (voir `Marque`).
 */
export const ATTRIBUTS_VISIBLES: ReadonlySet<string> = new Set([
  "title",
  "alt",
  "placeholder",
  "label",
  "summary",
  "abbr",
  "download",
  "aria-label",
  "aria-description",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
  "aria-braillelabel",
  // Du contenu, sous un nom qui dit déjà qu'il faut y regarder à deux fois.
  "dangerouslySetInnerHTML",
]);

/** Champs de `metadata` que le navigateur ou un moteur affiche tels quels. */
export const METADONNEES_VISIBLES: ReadonlySet<string> = new Set([
  "title",
  "description",
  "applicationName",
  "siteName",
  "category",
  "keywords",
]);

/** Requêtes dont le PREMIER argument est du texte affiché. */
const REQUETES_TEXTE =
  /^(?:(?:get|find|query)(?:All)?By(?:Text|LabelText|PlaceholderText|Title|AltText)|getByLabel|getByPlaceholder|toHaveText|toContainText|toHaveTitle|toHaveTextContent|toHaveAccessibleName|toHaveAccessibleDescription)$/;

/** Requêtes par rôle : le rôle n'est pas du texte, ses options le sont. */
const REQUETES_ROLE = /^(?:get|find|query)(?:All)?ByRole$/;

/** Options d'une requête par rôle qui portent du texte affiché. */
const OPTIONS_TEXTE: ReadonlySet<string> = new Set(["name", "description"]);

/** Vrai si le nom d'appel désigne une interrogation de l'écran. */
export function interrogeLEcran(nom: string): boolean {
  return REQUETES_TEXTE.test(nom) || REQUETES_ROLE.test(nom);
}

/**
 * Les accesseurs du dictionnaire, DÉDUITS du module `lib/i18n` lui-même.
 *
 * Rien n'est énuméré : les fonctions exportées sont les formes d'appel
 * autorisées, les objets exportés les formes d'accès. Ajouter un accesseur à
 * `lib/i18n/index.ts` l'autorise du même coup ; en retirer un le ferme.
 */
export type AccesseursDictionnaire = {
  readonly fonctions: ReadonlySet<string>;
  readonly objets: ReadonlySet<string>;
};

export function accesseursDictionnaire(
  module: Record<string, unknown>,
): AccesseursDictionnaire {
  const fonctions = new Set<string>();
  const objets = new Set<string>();
  for (const [nom, valeur] of Object.entries(module)) {
    // L'espace de noms d'un module peut porter un `default` d'interopérabilité,
    // qui est le module lui-même et n'ajoute aucun accesseur.
    if (nom === "default") {
      continue;
    }
    if (typeof valeur === "function") {
      fonctions.add(nom);
    } else if (typeof valeur === "object" && valeur !== null) {
      objets.add(nom);
    }
  }
  return { fonctions, objets };
}

/**
 * Le chemin, relatif à la racine, que désigne un import — ou `null`.
 *
 * En arithmétique POSIX exprès, et pas celle du système : `chemin` vient de
 * `fichiersSource`, qui l'écrit en `/`, et la cible est COMPARÉE à
 * `lib/i18n`. Sous Windows, `normalize` de `node:path` rend `lib\i18n`, le
 * dictionnaire n'est plus reconnu, et chaque `t("…")` du dépôt devient une
 * chaîne en dur — mesuré le 22/09/2026 (PORTABILITE-1).
 */
function cibleDeLImport(chemin: string, specificateur: string): string | null {
  if (specificateur.startsWith("@/")) {
    return posix.normalize(specificateur.slice(2));
  }
  if (specificateur.startsWith(".")) {
    return posix.normalize(`${posix.dirname(chemin)}/${specificateur}`);
  }
  return null;
}

/** Vrai si l'import vise le dictionnaire, quelle que soit la forme du chemin. */
function viseLeDictionnaire(chemin: string, specificateur: string): boolean {
  const cible = cibleDeLImport(chemin, specificateur);
  return cible === "lib/i18n" || (cible?.startsWith("lib/i18n/") ?? false);
}

/**
 * Noms LOCAUX liés au dictionnaire dans ce fichier, alias compris.
 *
 * `import { t as traduire }` lie `traduire` ; un fichier qui n'importe pas le
 * dictionnaire ne lie rien, et une fonction locale nommée `t` n'y donne donc
 * aucun droit. C'est l'import qui fait la référence, pas le nom.
 */
function liaisonsDuDictionnaire(
  source: ts.SourceFile,
  chemin: string,
  accesseurs: AccesseursDictionnaire,
): { fonctions: Set<string>; objets: Set<string> } {
  const fonctions = new Set<string>();
  const objets = new Set<string>();

  for (const declaration of source.statements) {
    if (
      !ts.isImportDeclaration(declaration) ||
      !ts.isStringLiteral(declaration.moduleSpecifier) ||
      !viseLeDictionnaire(chemin, declaration.moduleSpecifier.text)
    ) {
      continue;
    }
    const liaisons = declaration.importClause?.namedBindings;
    if (liaisons && ts.isNamedImports(liaisons)) {
      for (const element of liaisons.elements) {
        const origine = (element.propertyName ?? element.name).text;
        const local = element.name.text;
        if (accesseurs.fonctions.has(origine)) {
          fonctions.add(local);
        }
        if (accesseurs.objets.has(origine)) {
          objets.add(local);
        }
      }
    }
    // `import * as i18n` : l'espace de noms porte les deux formes.
    if (liaisons && ts.isNamespaceImport(liaisons)) {
      fonctions.add(liaisons.name.text);
      objets.add(liaisons.name.text);
    }
  }

  return { fonctions, objets };
}

/** Racine d'une chaîne d'accès : `i18n.fr["x"]` a pour racine `i18n`. */
function racine(expression: ts.Expression): string | null {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  if (
    ts.isPropertyAccessExpression(expression) ||
    ts.isElementAccessExpression(expression)
  ) {
    return racine(expression.expression);
  }
  return null;
}

type Contexte = {
  readonly fonctions: ReadonlySet<string>;
  readonly objets: ReadonlySet<string>;
  /** Constantes littérales du fichier : `const T = "…"`, `const M = { a: "…" }`. */
  readonly constantes: ReadonlyMap<string, string[]>;
};

/** Vrai si l'expression EST une lecture du dictionnaire — la seule forme admise. */
function estReferenceDictionnaire(
  expression: ts.Expression,
  contexte: Contexte,
): boolean {
  if (ts.isCallExpression(expression)) {
    const nom = racine(expression.expression);
    return nom !== null && contexte.fonctions.has(nom);
  }
  if (
    ts.isElementAccessExpression(expression) ||
    ts.isPropertyAccessExpression(expression)
  ) {
    const nom = racine(expression);
    return nom !== null && contexte.objets.has(nom);
  }
  return false;
}

/**
 * Les chaînes littérales que cette expression fait parvenir à l'écran.
 *
 * L'enveloppe ne protège pas (forme 2 du §9) : un gabarit, une concaténation,
 * un tableau assemblé, l'argument d'un appel — la descente les traverse tous.
 * Le DEUX-TEMPS non plus (forme 3) : un identifiant est résolu vers la
 * constante littérale du même fichier, car c'est l'état final qui compte, pas
 * le verbe qui l'installe.
 */
function litterauxVisibles(
  expression: ts.Expression,
  contexte: Contexte,
): string[] {
  if (estReferenceDictionnaire(expression, contexte)) {
    return [];
  }
  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression)
  ) {
    return expression.text.trim() ? [expression.text] : [];
  }
  if (ts.isTemplateExpression(expression)) {
    const morceaux = [
      expression.head,
      ...expression.templateSpans.map((portee) => portee.literal),
    ]
      .map((partie) => partie.text)
      .filter((texte) => texte.trim());
    return [
      ...morceaux,
      ...expression.templateSpans.flatMap((portee) =>
        litterauxVisibles(portee.expression, contexte),
      ),
    ];
  }
  if (ts.isBinaryExpression(expression)) {
    return [
      ...litterauxVisibles(expression.left, contexte),
      ...litterauxVisibles(expression.right, contexte),
    ];
  }
  if (ts.isConditionalExpression(expression)) {
    return [
      ...litterauxVisibles(expression.whenTrue, contexte),
      ...litterauxVisibles(expression.whenFalse, contexte),
    ];
  }
  if (ts.isParenthesizedExpression(expression)) {
    return litterauxVisibles(expression.expression, contexte);
  }
  if (ts.isArrayLiteralExpression(expression)) {
    return expression.elements.flatMap((element) =>
      ts.isSpreadElement(element)
        ? []
        : litterauxVisibles(element as ts.Expression, contexte),
    );
  }
  if (ts.isObjectLiteralExpression(expression)) {
    return expression.properties.flatMap((propriete) =>
      ts.isPropertyAssignment(propriete)
        ? litterauxVisibles(propriete.initializer, contexte)
        : [],
    );
  }
  if (ts.isCallExpression(expression)) {
    // Les arguments, ET le receveur de l'appel : `["Bonjour", nom].join(" ")`
    // ne porte sa faute ni dans son argument ni dans son nom, mais dans le
    // tableau sur lequel il s'applique.
    const receveur =
      ts.isPropertyAccessExpression(expression.expression) ||
      ts.isElementAccessExpression(expression.expression)
        ? litterauxVisibles(expression.expression.expression, contexte)
        : [];
    return [
      ...receveur,
      ...expression.arguments.flatMap((argument) =>
        litterauxVisibles(argument, contexte),
      ),
    ];
  }
  if (
    ts.isIdentifier(expression) ||
    ts.isPropertyAccessExpression(expression)
  ) {
    return contexte.constantes.get(expression.getText()) ?? [];
  }
  return [];
}

/** Constantes littérales du fichier, y compris les champs d'un objet constant. */
function constantesLitterales(source: ts.SourceFile): Map<string, string[]> {
  const constantes = new Map<string, string[]>();
  const vide: Contexte = {
    fonctions: new Set(),
    objets: new Set(),
    constantes: new Map(),
  };

  const visiter = (noeud: ts.Node): void => {
    if (
      ts.isVariableDeclaration(noeud) &&
      ts.isIdentifier(noeud.name) &&
      noeud.initializer
    ) {
      const nom = noeud.name.text;
      const initialisation = noeud.initializer;
      if (ts.isObjectLiteralExpression(initialisation)) {
        for (const propriete of initialisation.properties) {
          if (
            ts.isPropertyAssignment(propriete) &&
            (ts.isIdentifier(propriete.name) ||
              ts.isStringLiteral(propriete.name))
          ) {
            const litteraux = litterauxVisibles(propriete.initializer, vide);
            if (litteraux.length) {
              constantes.set(`${nom}.${propriete.name.text}`, litteraux);
            }
          }
        }
      } else {
        const litteraux = litterauxVisibles(initialisation, vide);
        if (litteraux.length) {
          constantes.set(nom, litteraux);
        }
      }
    }
    ts.forEachChild(noeud, visiter);
  };

  ts.forEachChild(source, visiter);
  return constantes;
}

/** Nom du dernier segment appelé : `screen.getByText` → `getByText`. */
function nomAppele(expression: ts.LeftHandSideExpression): string | null {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text;
  }
  return null;
}

/** Nom d'un attribut JSX, trait d'union compris (`aria-label`). */
function nomAttribut(nom: ts.JsxAttributeName): string {
  return ts.isIdentifier(nom) ? nom.text : nom.getText();
}

/**
 * Analyse un fichier : ses marques, et les chaînes visibles écrites en dur.
 *
 * `accesseurs` vient du module `lib/i18n` lui-même — le gardien le lui passe.
 */
export function analyser(
  chemin: string,
  contenu: string,
  accesseurs: AccesseursDictionnaire,
): Analyse {
  const source = ts.createSourceFile(
    chemin,
    contenu,
    ts.ScriptTarget.Latest,
    true,
    chemin.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const liaisons = liaisonsDuDictionnaire(source, chemin, accesseurs);
  const contexte: Contexte = {
    fonctions: liaisons.fonctions,
    objets: liaisons.objets,
    constantes: constantesLitterales(source),
  };

  const marques = new Set<Marque>();
  const chaines: ChaineVisible[] = [];

  const signaler = (
    noeud: ts.Node,
    emplacement: Emplacement,
    textes: readonly string[],
  ): void => {
    for (const texte of textes) {
      chaines.push({
        emplacement,
        ligne:
          source.getLineAndCharacterOfPosition(noeud.getStart(source)).line + 1,
        texte: texte.trim(),
      });
    }
  };

  const visiter = (noeud: ts.Node): void => {
    if (
      ts.isJsxElement(noeud) ||
      ts.isJsxSelfClosingElement(noeud) ||
      ts.isJsxFragment(noeud)
    ) {
      marques.add("rend du JSX");
    }

    // 1. Le texte écrit entre deux balises.
    if (ts.isJsxText(noeud) && noeud.text.trim()) {
      signaler(noeud, "texte JSX", [noeud.text]);
    }

    // 2. Une expression en position d'ENFANT : `{…}` entre deux balises.
    if (
      ts.isJsxExpression(noeud) &&
      noeud.expression &&
      noeud.parent &&
      (ts.isJsxElement(noeud.parent) || ts.isJsxFragment(noeud.parent))
    ) {
      signaler(
        noeud,
        "texte JSX",
        litterauxVisibles(noeud.expression, contexte),
      );
    }

    // 3. Un attribut que l'utilisateur lit — à l'écran ou par la voix.
    if (ts.isJsxAttribute(noeud) && noeud.initializer) {
      if (ATTRIBUTS_VISIBLES.has(nomAttribut(noeud.name))) {
        const valeur = ts.isJsxExpression(noeud.initializer)
          ? noeud.initializer.expression
          : noeud.initializer;
        if (valeur) {
          signaler(
            noeud,
            "attribut visible",
            litterauxVisibles(valeur, contexte),
          );
        }
      }
    }

    // 4. Les métadonnées de Next.js — le titre de l'onglet est de l'écran.
    if (
      ts.isVariableDeclaration(noeud) &&
      ts.isIdentifier(noeud.name) &&
      noeud.name.text === "metadata" &&
      noeud.initializer
    ) {
      marques.add("exporte des métadonnées");
      const visiterMeta = (interne: ts.Node): void => {
        if (
          ts.isPropertyAssignment(interne) &&
          (ts.isIdentifier(interne.name) || ts.isStringLiteral(interne.name)) &&
          METADONNEES_VISIBLES.has(interne.name.text)
        ) {
          signaler(
            interne,
            "métadonnées",
            litterauxVisibles(interne.initializer, contexte),
          );
        }
        ts.forEachChild(interne, visiterMeta);
      };
      visiterMeta(noeud.initializer);
    }

    // 5. Une requête d'écran : le texte attendu est du texte affiché.
    if (ts.isCallExpression(noeud)) {
      const nom = nomAppele(noeud.expression);
      if (nom !== null && interrogeLEcran(nom)) {
        marques.add("interroge l'écran");
        if (REQUETES_ROLE.test(nom)) {
          const options = noeud.arguments[1];
          if (options && ts.isObjectLiteralExpression(options)) {
            for (const propriete of options.properties) {
              if (
                ts.isPropertyAssignment(propriete) &&
                ts.isIdentifier(propriete.name) &&
                OPTIONS_TEXTE.has(propriete.name.text)
              ) {
                signaler(
                  propriete,
                  "requête d'écran",
                  litterauxVisibles(propriete.initializer, contexte),
                );
              }
            }
          }
        } else if (noeud.arguments[0]) {
          signaler(
            noeud,
            "requête d'écran",
            litterauxVisibles(noeud.arguments[0], contexte),
          );
        }
      }
    }

    ts.forEachChild(noeud, visiter);
  };

  ts.forEachChild(source, visiter);

  return { chemin, marques: [...marques], chaines };
}
