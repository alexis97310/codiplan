/**
 * Inventaire du socle et contrôle de cloisonnement — logique pure (I1).
 *
 * Ce module ne touche pas la base : il décrit la forme de l'inventaire et
 * porte les comparaisons. Il est partagé par les deux étapes du workflow
 * « DB migrate & seed », qui ne s'exécutent NI avec le même rôle, NI avec la
 * même URL :
 *
 *   1. `scripts/inventaire.mts` — décompte À PLAT, sous une identité exemptée
 *      des politiques. C'est l'inventaire : il dit ce que la base contient
 *      réellement, sans que les politiques puissent le fausser.
 *   2. `scripts/controle-cloisonnement.mts` — relecture du même contenu SOUS
 *      le rôle applicatif, soumis aux politiques. Elle prouve le cloisonnement
 *      en confrontant ce que ce rôle voit à l'inventaire de l'étape 1.
 *
 * Deux étapes, deux motifs d'échec distincts : la première échoue quand
 * l'inventaire ne peut pas être juste, la seconde quand le cloisonnement ne
 * tient pas. Voir docs/decisions/2026-08-20-inventaire-et-controle-de-cloisonnement.md.
 */

/**
 * Tables soumises au cloisonnement société, telles que les migrations les ont
 * passées en `FORCE ROW LEVEL SECURITY` — `20260820130000` pour les quatre
 * premières, `20260821120000` pour les trois du calendrier. `societe` y
 * figure : elle est cloisonnée par son identité (`id = app.societe_id`), les
 * autres par leur colonne `societe_id`.
 *
 * Les référentiels de plateforme (`devise`, `parite`, `jour_ferie`) et
 * l'identité globale (`utilisateur`) n'en sont pas : ils relèvent de la liste
 * close de I1 ou de l'authentification, et se comptent hors cloisonnement.
 */
export const TABLES_CLOISONNEES = [
  "societe",
  "agence",
  "calendrier",
  "calendrier_plage",
  "calendrier_ferie",
  "utilisateur_societe",
  "utilisateur_client",
] as const;

export type TableCloisonnee = (typeof TABLES_CLOISONNEES)[number];

/** Nombre de lignes par table cloisonnée. */
export type DecompteParTable = Record<TableCloisonnee, number>;

/**
 * Tables comptées hors cloisonnement — témoins de l'étape 2.
 *
 * `jour_ferie` les rejoint au ticket L0-08 : c'est un référentiel de plateforme
 * (D46), lisible par toutes les sociétés. Le compter parmi les témoins n'est
 * pas décoratif — c'est ce qui prouve qu'il reste lisible SOUS le rôle
 * applicatif et SANS contexte société, là où une table cloisonnée doit rendre
 * zéro.
 */
export const TABLES_HORS_CLOISONNEMENT = [
  "devise",
  "parite",
  "jour_ferie",
  "utilisateur",
] as const;

export type TableHorsCloisonnement = (typeof TABLES_HORS_CLOISONNEMENT)[number];

export type DecompteHorsCloisonnement = Record<TableHorsCloisonnement, number>;

/**
 * Une société telle que la base la porte réellement.
 *
 * `code` vaut `null` lorsque l'identifiant n'apparaît que dans une table fille :
 * des lignes rattachées à une société qui n'existe pas. Les clés étrangères
 * l'interdisent aujourd'hui ; l'inventaire le rapporterait quand même plutôt
 * que de l'ignorer.
 */
export type LigneInventaire = {
  societe_id: string;
  code: string | null;
  decomptes: DecompteParTable;
};

/** Identité sous laquelle l'inventaire à plat a été pris. */
export type IdentiteInventaire = {
  /** Rôle porté par l'URL de connexion. */
  role_connecte: string;
  /** Identité effectivement utilisée pour lire — `SET ROLE` le cas échéant. */
  identite_exemptee: string;
  base: string;
};

export type Inventaire = {
  identite: IdentiteInventaire;
  /** Une entrée par `societe_id` présent en base, y compris inconnu du seed. */
  societes: LigneInventaire[];
  /** Somme des décomptes, toutes sociétés confondues. */
  total: DecompteParTable;
  hors_cloisonnement: DecompteHorsCloisonnement;
};

/** Fichier d'échange entre les deux étapes du workflow (jamais versionné). */
export const FICHIER_INVENTAIRE = "inventaire-controle.json";

/** Décompte à zéro sur toutes les tables cloisonnées. */
export function decompteVide(): DecompteParTable {
  return {
    societe: 0,
    agence: 0,
    calendrier: 0,
    calendrier_plage: 0,
    calendrier_ferie: 0,
    utilisateur_societe: 0,
    utilisateur_client: 0,
  };
}

/** Somme des décomptes de chaque société. */
export function totaliser(
  lignes: readonly LigneInventaire[],
): DecompteParTable {
  const total = decompteVide();
  for (const ligne of lignes) {
    for (const table of TABLES_CLOISONNEES) {
      total[table] += ligne.decomptes[table];
    }
  }
  return total;
}

/**
 * Incohérences internes de l'inventaire, indépendamment de tout cloisonnement.
 *
 * L'inventaire doit être juste : une base vide, un total qui ne correspond pas
 * au détail, ou des lignes rattachées à une société inexistante sont des motifs
 * d'échec de l'étape 1 — pas des observations à publier telles quelles.
 */
export function ecartsInventaire(inventaire: Inventaire): string[] {
  const ecarts: string[] = [];

  if (inventaire.societes.length === 0) {
    ecarts.push(
      "aucune société en base : le seed n'a pas produit le socle attendu.",
    );
  }

  const recalcule = totaliser(inventaire.societes);
  for (const table of TABLES_CLOISONNEES) {
    if (recalcule[table] !== inventaire.total[table]) {
      ecarts.push(
        `« ${table} » : total annoncé ${inventaire.total[table]}, ` +
          `somme du détail par société ${recalcule[table]}.`,
      );
    }
  }

  for (const ligne of inventaire.societes) {
    if (ligne.code === null) {
      ecarts.push(
        `des lignes sont rattachées à la société ${ligne.societe_id}, ` +
          "qui n'existe pas dans la table « societe ».",
      );
    }
    if (ligne.decomptes.societe > 1) {
      ecarts.push(
        `la société ${ligne.societe_id} compte ${ligne.decomptes.societe} ` +
          "lignes dans « societe » : l'identifiant doit être unique.",
      );
    }
  }

  return ecarts;
}

/**
 * Écarts observés SANS contexte société, sous un rôle soumis aux politiques.
 *
 * Attendu : zéro ligne, sur chacune des tables cloisonnées. Toute ligne visible
 * est une fuite — soit une politique trop permissive, soit un rôle qui échappe
 * aux politiques.
 */
export function ecartsSansContexte(observe: DecompteParTable): string[] {
  const ecarts: string[] = [];
  for (const table of TABLES_CLOISONNEES) {
    if (observe[table] !== 0) {
      ecarts.push(
        `« ${table} » : ${observe[table]} ligne(s) visible(s) sans contexte ` +
          "société, zéro attendue.",
      );
    }
  }
  return ecarts;
}

/**
 * Écarts observés SOUS le contexte d'une société.
 *
 * Attendu : exactement les lignes que l'inventaire à plat attribue à cette
 * société. Un excédent est une fuite entre sociétés ; un déficit signale une
 * politique qui cache à une société ses propres données.
 */
export function ecartsAvecContexte(
  ligne: LigneInventaire,
  observe: DecompteParTable,
): string[] {
  const ecarts: string[] = [];
  const societe = `${ligne.code ?? "sans code"} (${ligne.societe_id})`;

  for (const table of TABLES_CLOISONNEES) {
    const attendu = ligne.decomptes[table];
    const vu = observe[table];
    if (vu === attendu) {
      continue;
    }
    const nature =
      vu > attendu
        ? "fuite : la société voit des lignes qui ne sont pas les siennes"
        : "la société ne voit pas toutes ses propres lignes";
    ecarts.push(
      `société ${societe}, « ${table} » : ${attendu} ligne(s) attendue(s), ` +
        `${vu} observée(s) — ${nature}.`,
    );
  }

  return ecarts;
}

/**
 * Écarts sur les témoins hors cloisonnement.
 *
 * Ils servent de contrôle positif : sous le rôle applicatif et sans contexte,
 * les référentiels de plateforme restent lisibles (D4). Sans eux, une base vide
 * ou une connexion muette produirait les mêmes zéros qu'un cloisonnement
 * parfait, et l'étape 2 passerait sans rien prouver.
 */
export function ecartsTemoins(
  attendu: DecompteHorsCloisonnement,
  observe: DecompteHorsCloisonnement,
): string[] {
  const ecarts: string[] = [];
  for (const table of TABLES_HORS_CLOISONNEMENT) {
    if (observe[table] !== attendu[table]) {
      ecarts.push(
        `témoin « ${table} » : ${attendu[table]} ligne(s) à l'inventaire, ` +
          `${observe[table]} lue(s) sous le rôle applicatif.`,
      );
    }
  }
  return ecarts;
}

/**
 * Relit l'inventaire écrit par l'étape 1.
 *
 * Validation écrite à la main plutôt que déléguée à Zod : Zod n'est pas encore
 * une dépendance du projet et l'ajouter pour valider un fichier que nous venons
 * nous-mêmes d'écrire coûterait plus qu'il ne rapporte (CLAUDE.md §2). L'entrée
 * n'est pas une entrée serveur : elle ne quitte pas l'exécuteur du workflow.
 * Le jour où Zod entre au projet pour les entrées serveur, ce lecteur suivra.
 */
export function lireInventaire(texte: string): Inventaire {
  const brut: unknown = JSON.parse(texte);
  const racine = objet(brut, "inventaire");

  const identite = objet(racine.identite, "inventaire.identite");
  const societesBrutes = racine.societes;
  if (!Array.isArray(societesBrutes)) {
    throw new Error("inventaire.societes : tableau attendu.");
  }

  const societes = societesBrutes.map((ligneBrute, index) => {
    const ligne = objet(ligneBrute, `inventaire.societes[${index}]`);
    return {
      societe_id: chaine(ligne.societe_id, `societes[${index}].societe_id`),
      code:
        ligne.code === null
          ? null
          : chaine(ligne.code, `societes[${index}].code`),
      decomptes: decomptes(
        ligne.decomptes,
        `societes[${index}].decomptes`,
        TABLES_CLOISONNEES,
      ),
    };
  });

  return {
    identite: {
      role_connecte: chaine(identite.role_connecte, "identite.role_connecte"),
      identite_exemptee: chaine(
        identite.identite_exemptee,
        "identite.identite_exemptee",
      ),
      base: chaine(identite.base, "identite.base"),
    },
    societes,
    total: decomptes(racine.total, "total", TABLES_CLOISONNEES),
    hors_cloisonnement: decomptes(
      racine.hors_cloisonnement,
      "hors_cloisonnement",
      TABLES_HORS_CLOISONNEMENT,
    ),
  };
}

function objet(valeur: unknown, chemin: string): Record<string, unknown> {
  if (typeof valeur !== "object" || valeur === null || Array.isArray(valeur)) {
    throw new Error(`${chemin} : objet attendu.`);
  }
  return valeur as Record<string, unknown>;
}

function chaine(valeur: unknown, chemin: string): string {
  if (typeof valeur !== "string" || valeur.length === 0) {
    throw new Error(`${chemin} : chaîne non vide attendue.`);
  }
  return valeur;
}

function decomptes<T extends string>(
  valeur: unknown,
  chemin: string,
  tables: readonly T[],
): Record<T, number> {
  const source = objet(valeur, chemin);
  const resultat = {} as Record<T, number>;
  for (const table of tables) {
    const nombre = source[table];
    if (typeof nombre !== "number" || !Number.isInteger(nombre) || nombre < 0) {
      throw new Error(`${chemin}.${table} : entier positif ou nul attendu.`);
    }
    resultat[table] = nombre;
  }
  return resultat;
}
