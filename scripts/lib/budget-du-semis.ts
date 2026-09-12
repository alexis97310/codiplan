import { readFileSync } from "node:fs";

/**
 * CE QUE LE BUDGET D'ALLERS-RETOURS DU SEMIS DOIT COMPTER (R3-10).
 *
 * ## LE DÉFAUT, MESURÉ LE 13/09/2026
 *
 * `allersRetoursTransaction` est le budget de la transaction cloisonnée d'une
 * société : il existe pour faire rougir `tests/unit/seed-delais.test.ts` *le
 * jour où le semis grossit au point que le délai fixé ne suffit plus* (§9,
 * 23/08). Il comptait les clients, les sites, les calendriers, les plages, les
 * agences, les écarts et l'amorçage des habilitations.
 *
 * **Il ne comptait pas les INTERVENTIONS**, qui sont écrites dans cette même
 * transaction depuis R2-12 — seize lignes, un `findUnique` puis un `create`
 * chacune. *Le budget ignorait donc une écriture sur deux*, et il l'ignorait en
 * silence : un budget trop bas ne rougit pas, il rassure.
 *
 * C'est la population auto-sélectionnée du §9 (31/08) prise par l'autre bout :
 * le budget ne se trompe pas sur ce qu'il compte, **il ne compte pas ce qui
 * s'ajoute**. Et le sens de la panne est le mauvais : *un budget sous-évalué
 * laisse passer un semis qui expirera sur la base hébergée*, c'est-à-dire dans
 * le seul environnement que rien n'exerce (§9, 23/08).
 *
 * ## CE QUE CE MODULE FAIT, ET CE QU'IL NE PEUT PAS FAIRE
 *
 * Il **dérive la population du dépôt** : les collections exportées par
 * `prisma/seed-data.ts` qui sont ITÉRÉES dans la transaction cloisonnée de
 * `prisma/seed.ts`. Chacune doit être nommée par `prisma/seed-delais.ts`.
 *
 * **Il ne vérifie pas l'arithmétique** — deux allers-retours par intervention
 * plutôt qu'un ne se lit pas dans un nom —, et il l'annonce plutôt que de le
 * laisser croire. *Ce qu'il tient est la seule moitié qu'une machine puisse
 * tenir : qu'aucune collection ne s'ajoute au semis sans que quelqu'un rouvre
 * le budget.* Le budget reste un budget, jamais une mesure.
 *
 * Les collections écrites HORS de cette transaction — les identités, les
 * comptes de portail, les techniciens — ne sont pas concernées : elles ont
 * leurs propres transactions, et c'est la limite annoncée de ce gardien.
 *
 * ## LA SEULE COUPURE LÉGITIME EST « DOCUMENTATION CONTRE EXÉCUTION »
 *
 * *Mesuré à la première exécution* : le gardien nommait DEUX collections, et la
 * seconde — `COMPTES_PORTAIL` — n'est **pas écrite** dans cette transaction.
 * Elle y est seulement CITÉE, dans le commentaire qui explique pourquoi les
 * sites portent un identifiant fixe. Un gardien qui compte une mention de
 * commentaire pour une écriture est un gardien bruyant, et *un gardien dont le
 * taux de fausses alertes conduit à ne plus le lire coûte plus qu'il ne
 * rapporte* (§9, 11/09).
 *
 * Le périmètre retire donc les commentaires, et **eux seuls** : jamais les
 * chaînes littérales, dont le §9 (26/08) dit qu'elles restent du code — une
 * écriture assemblée dans une chaîne coûte le même aller-retour qu'une autre.
 */

/**
 * Le texte d'un source PRIVÉ DE SES COMMENTAIRES — la coupure de D50.
 *
 * Le scanner suit les guillemets : un `//` à l'intérieur d'une chaîne n'ouvre
 * pas un commentaire, sans quoi la moitié d'une instruction disparaîtrait avec
 * une URL.
 */
export function sansCommentaires(source: string): string {
  let sortie = "";
  let i = 0;
  let delimiteur: string | null = null;
  while (i < source.length) {
    const c = source[i] as string;
    const suivant = source[i + 1];
    if (delimiteur !== null) {
      sortie += c;
      if (c === "\\") {
        sortie += suivant ?? "";
        i += 2;
        continue;
      }
      if (c === delimiteur) {
        delimiteur = null;
      }
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      delimiteur = c;
      sortie += c;
      i += 1;
      continue;
    }
    if (c === "/" && suivant === "/") {
      while (i < source.length && source[i] !== "\n") {
        i += 1;
      }
      continue;
    }
    if (c === "/" && suivant === "*") {
      const fin = source.indexOf("*/", i + 2);
      i = fin === -1 ? source.length : fin + 2;
      continue;
    }
    sortie += c;
    i += 1;
  }
  return sortie;
}

/** Le nom d'une collection exportée par le jeu de démonstration. */
export type Collection = string;

/**
 * Les collections exportées par `seed-data.ts` — celles qui sont des LISTES.
 *
 * `TERRITOIRE_NOUVELLE_CALEDONIE` est une chaîne, `ANNEES_AU_DELA` un nombre :
 * ni l'un ni l'autre ne coûte un aller-retour. Le motif ne retient donc que ce
 * qui se parcourt.
 */
export function collectionsExportees(source: string): readonly Collection[] {
  const noms: string[] = [];
  const motif =
    /^export const ([A-Z][A-Z0-9_]*)\s*:\s*(?:readonly|Readonly)\b/gm;
  let trouve = motif.exec(source);
  while (trouve !== null) {
    noms.push(trouve[1] as string);
    trouve = motif.exec(source);
  }
  return noms;
}

/**
 * LE TEXTE DE LA TRANSACTION CLOISONNÉE, découpé par appariement de
 * parenthèses et jamais par une borne de ligne.
 *
 * *Une borne de ligne se périme au premier ticket qui déplace une accolade* ;
 * l'appariement suit le code. La transaction visée est la PREMIÈRE de
 * `seed.ts` — celle que `allersRetoursTransaction` budgète, et la seule qui
 * écrive le parc, les interventions et les référentiels d'une société.
 *
 * Lève si elle est introuvable : *un découpage qui rend une chaîne vide rendrait
 * un gardien vert sur rien* (§9, 30/08).
 */
export function transactionCloisonnee(source: string): string {
  const debut = source.indexOf("await avecSociete(");
  if (debut === -1) {
    throw new Error(
      "prisma/seed.ts ne contient aucun appel `await avecSociete(` : le " +
        "budget d'allers-retours ne peut plus être rattaché à une " +
        "transaction, et ce gardien ne mesurerait plus rien.",
    );
  }
  let profondeur = 0;
  for (let i = source.indexOf("(", debut); i < source.length; i += 1) {
    const caractere = source[i];
    if (caractere === "(") {
      profondeur += 1;
    } else if (caractere === ")") {
      profondeur -= 1;
      if (profondeur === 0) {
        return source.slice(debut, i + 1);
      }
    }
  }
  throw new Error(
    "prisma/seed.ts : la transaction cloisonnée ne se referme pas — " +
      "l'appariement de parenthèses a atteint la fin du fichier.",
  );
}

/** Les collections que la transaction cloisonnée parcourt réellement. */
export function collectionsDeLaTransaction(
  sourceDonnees: string,
  sourceSemis: string,
): readonly Collection[] {
  const bloc = sansCommentaires(transactionCloisonnee(sourceSemis));
  return collectionsExportees(sourceDonnees).filter((nom) =>
    new RegExp(`\\b${nom}\\b`).test(bloc),
  );
}

/** Celles que le budget OUBLIE — la liste que le gardien exige vide. */
export function collectionsHorsBudget(
  sourceDonnees: string,
  sourceSemis: string,
  sourceBudget: string,
): readonly Collection[] {
  return collectionsDeLaTransaction(sourceDonnees, sourceSemis).filter(
    (nom) => !new RegExp(`\\b${nom}\\b`).test(sourceBudget),
  );
}

/** Lit un fichier du dépôt — les trois sources se lisent de la même façon. */
export function lireSource(chemin: string): string {
  return readFileSync(chemin, "utf8");
}
