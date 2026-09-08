/**
 * Q7 — LE CHAPITRE 11 PORTE-T-IL TOUTES LES TABLES QUI EXISTENT ?
 *
 * ## L'écart qui a fait ce module
 *
 * D15 (rang 1) écrit « restauration des valeurs antérieures, conservées dans
 * `import_lot_ligne.valeurs_avant` » ; le chapitre 11 (rang 3) n'énumérait
 * qu'`import_lot`. Le rang 1 l'emporte, donc la table existera : **ce n'était
 * pas une décision à prendre, c'était une omission à réparer.**
 *
 * **Et l'exploitation a demandé s'il y en avait d'autres. Il y en avait SEIZE.**
 * `agence`, `calendrier`, `calendrier_plage`, `calendrier_ferie`, `jour_ferie`,
 * `contact`, `taux_horaire`, `technicien_habilitation`,
 * `site_habilitation_requise`, `utilisateur_client`, `utilisateur_client_site`,
 * `session`, `compte`, `verification`, `second_facteur`, `journal_acces` —
 * toutes au schéma, aucune au chapitre 11.
 *
 * Ce n'était pas seize décisions manquantes : c'était **la même omission, seize
 * fois** — un ticket crée une table, et personne ne revient compléter le
 * chapitre. C'est très exactement la maladie que le §9 nomme depuis le
 * 20/08/2026, *une liste close se re-vérifie à chaque objet créé, sinon elle
 * devient fausse* — et le remède est le même que celui de D41 : **renverser la
 * charge, et partir du schéma.**
 *
 * ## Ce que ce module confronte, et pourquoi c'est un contrôle
 *
 * La population vient de `prisma/schema.prisma` — **une source que ce module ne
 * contrôle pas** et qui ne se plie pas à ce qu'il déclare. C'est le test du
 * 01/09 : *qu'est-ce qui confronterait les deux copies ?* Ici, l'une des deux
 * est le schéma réel.
 *
 * ## CE QU'IL NE FAIT PAS, ET IL FAUT LE DIRE
 *
 * **Il ne contrôle QU'UN SENS.** Une table nommée au chapitre 11 sans exister
 * au schéma est légitime : le chapitre décrit le modèle complet, dont la plus
 * grande part n'est pas encore construite — `machine`, `contrat`,
 * `intervention`, `import_lot_ligne`. Exiger la réciproque ferait échouer le
 * gardien sur le PLAN, c'est-à-dire sur ce que le chapitre est.
 *
 * **Il ne voit donc PAS le défaut d'origine.** `import_lot_ligne` était
 * prescrite par une décision de rang 1 et absente des deux côtés : aucun motif
 * statique ne peut décider qu'une phrase de prose prescrit une table. Ce
 * gardien ferme la classe la plus peuplée — celle où la table EXISTE — et
 * annonce que l'autre reste à la relecture. *Un gardien qui annonce sa limite
 * vaut mieux qu'un gardien qu'on croit complet.*
 */

/** Le titre de la section qui énumère les tables. */
const DEBUT = /^###\s+11\.2\s/;

/** N'importe quel titre de même rang ou supérieur ferme la section. */
const FIN = /^#{1,3}\s+/;

/** Un nom de table Prisma, tel que `@@map` le donne. */
const MAP = /@@map\("([a-z_][a-z0-9_]*)"\)/g;

/** Un nom de table cité au chapitre, en gras. */
const CITEE = /\*\*([a-z_][a-z0-9_]*)\*\*/g;

/** Les tables réellement déclarées au schéma Prisma. */
export function tablesDuSchema(schema: string): string[] {
  return [...new Set([...schema.matchAll(MAP)].map((m) => m[1]!))].sort();
}

/** Les tables nommées par la section 11.2 du cahier des charges. */
export function tablesDuChapitre11(cahierDesCharges: string): string[] {
  const lignes = cahierDesCharges.split("\n");
  const debut = lignes.findIndex((ligne) => DEBUT.test(ligne));
  if (debut === -1) {
    return [];
  }
  const suite = lignes
    .slice(debut + 1)
    .findIndex((ligne) => FIN.test(ligne) && !DEBUT.test(ligne));
  const section = lignes
    .slice(debut + 1, suite === -1 ? undefined : debut + 1 + suite)
    .join("\n");
  return [...new Set([...section.matchAll(CITEE)].map((m) => m[1]!))].sort();
}

/**
 * Écarts : toute table du schéma que le chapitre 11 ne nomme pas.
 *
 * Le témoin de population ouvre la fonction — zéro table lue ressemble trait
 * pour trait à zéro écart (§9, 30/08).
 */
export function ecartsModeleDeDonnees(
  schema: string,
  cahierDesCharges: string,
): string[] {
  const duSchema = tablesDuSchema(schema);
  if (duSchema.length === 0) {
    return [
      "aucune table lue dans prisma/schema.prisma : le contrôle du modèle de " +
        "données n'a rien établi. Motif `@@map` devenu aveugle, ou fichier lu " +
        "hors du chemin attendu.",
    ];
  }

  const duChapitre = new Set(tablesDuChapitre11(cahierDesCharges));
  if (duChapitre.size === 0) {
    return [
      "la section 11.2 du cahier des charges n'a été trouvée, ou ne nomme " +
        "aucune table : le contrôle compare le schéma à rien du tout.",
    ];
  }

  return duSchema
    .filter((table) => !duChapitre.has(table))
    .map(
      (table) =>
        `« ${table} » existe au schéma et ne figure pas au chapitre 11.2. Le ` +
        "modèle de données est de rang 3 : une table qu'il ne porte pas est " +
        "une omission, jamais une décision. L'ajouter au chapitre, avec ce " +
        "qu'elle porte et la décision qui la prescrit.",
    );
}
