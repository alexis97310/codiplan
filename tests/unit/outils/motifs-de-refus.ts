import ts from "typescript";

import type { FichierSource } from "./fichiers-source";

/**
 * Lecture des MOTIFS DE REFUS déclarés en dur dans les types (ticket
 * 9L51-I18N-MOTIFS-MANQUANTS).
 *
 * `tests/unit/gardiens/motif-connu-du-dictionnaire.test.ts` fournit la
 * règle ; ce module fournit la lecture — même partage que
 * `fichiers-source.ts` et `rendu-visible.ts`.
 *
 * **La convention mesurée dans le dépôt.** Un refus se déclare par un type
 * `export type Refus… = "…"` ou `export type MotifRefus… = "…"`
 * (`lib/societes/identite.ts`, `lib/societes/logo.ts`,
 * `lib/calendar/depot.ts`…), et la fonction renvoie `{ motif: "…" }`. Deux
 * familles de littéraux cohabitent sous ces types :
 *
 * - les littéraux POINTÉS (`"regle_arrondi.refus.droit"`) sont la clé du
 *   dictionnaire ELLE-MÊME — l'écran les passe tels quels à `t()` via
 *   `estCleTraduction` (`app/(back-office)/parametres/tarifs/page.tsx`) ;
 * - les littéraux SANS POINT (`"fusionnee"`, `"introuvable"`…) sont des
 *   codes COURTS, composés plus loin par un gabarit littéral
 *   (`` `machine.refus.${resultat.motif}` ``,
 *   `app/api/machines/[id]/changer-statut/route.ts`) : ce ne sont pas des
 *   clés, et les traiter comme telles ferait rougir le gardien sur un dépôt
 *   sain.
 *
 * Seule la première famille se vérifie ici — c'est elle que nomme le ticket
 * (« littéraux de la forme domaine.refus.xxx »). La composition par gabarit
 * est hors de portée d'une lecture syntaxique sans résolution de type, et
 * n'est pas le défaut que la revue de 9I8A1 a trouvé.
 *
 * **Pourquoi un type nommé, et pas toute propriété `motif: "…"`.** Une
 * propriété `motif` existe aussi côté ÉCRAN, comme simple étiquette comparée
 * par `===` pour choisir un AUTRE texte déjà traduit
 * (`motif === "equipe.acces.tous_envoyes"`,
 * `app/(back-office)/parametres/equipe/page.tsx`) — cette étiquette-là n'est
 * jamais passée à `t()`, et l'exiger au dictionnaire serait un faux positif.
 * Se limiter aux types nommés `Refus…`/`Motif…` revient à la SOURCE du
 * motif, côté dépôt (`lib/`, `app/api/`) — là où il est produit, jamais là
 * où il est seulement comparé.
 */

/** Un littéral de refus déclaré sous un type `Refus…` / `Motif…`. */
export type MotifDeclare = {
  readonly cle: string;
  readonly chemin: string;
  readonly ligne: number;
};

/** Une clé de dictionnaire plausible : des mots en minuscules séparés par un point. */
const FORME_CLE = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;

/** Le nom d'un type qui déclare des motifs de refus. */
const NOM_TYPE_REFUS = /motif|refus/i;

function collecteLitteraux(
  noeud: ts.TypeNode,
  source: ts.SourceFile,
  chemin: string,
  resultat: MotifDeclare[],
): void {
  if (ts.isUnionTypeNode(noeud)) {
    for (const membre of noeud.types) {
      collecteLitteraux(membre, source, chemin, resultat);
    }
    return;
  }
  if (ts.isParenthesizedTypeNode(noeud)) {
    collecteLitteraux(noeud.type, source, chemin, resultat);
    return;
  }
  if (ts.isLiteralTypeNode(noeud) && ts.isStringLiteral(noeud.literal)) {
    const cle = noeud.literal.text;
    if (FORME_CLE.test(cle)) {
      const { line } = source.getLineAndCharacterOfPosition(noeud.getStart());
      resultat.push({ cle, chemin, ligne: line + 1 });
    }
  }
  // Une référence à un autre type (`| MotifRefusEtatMachine`) n'est pas
  // résolue ici : ce type référencé, s'il porte lui aussi un nom concerné,
  // est lu de façon indépendante par le même parcours.
}

/**
 * Tous les motifs de refus déclarés sous un type `Refus…`/`Motif…`, dans les
 * fichiers donnés.
 */
export function motifsDeRefusDeclares(
  fichiers: readonly FichierSource[],
): readonly MotifDeclare[] {
  const resultat: MotifDeclare[] = [];
  for (const fichier of fichiers) {
    const scriptKind = fichier.chemin.endsWith(".tsx")
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS;
    const source = ts.createSourceFile(
      fichier.chemin,
      fichier.contenu,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    );
    const visiter = (noeud: ts.Node): void => {
      if (
        ts.isTypeAliasDeclaration(noeud) &&
        NOM_TYPE_REFUS.test(noeud.name.text)
      ) {
        collecteLitteraux(noeud.type, source, fichier.chemin, resultat);
      }
      ts.forEachChild(noeud, visiter);
    };
    visiter(source);
  }
  return resultat;
}
