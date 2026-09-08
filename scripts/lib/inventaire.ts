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
 * `client` les rejoint au ticket L1-01 : c'est la première table métier du lot
 * 1, cloisonnée par `societe_id` comme les autres. Sa POLITIQUE est de forme
 * « parc » et non « société » (D10, D22), mais cette liste-ci ne juge pas la
 * forme — elle sert un décompte comparé —, et le décompte est le même : sans
 * `app.client_id`, un utilisateur interne voit tout le parc de sa société.
 *
 * Les référentiels de plateforme (`devise`, `parite`, `jour_ferie`) et
 * l'identité globale (`utilisateur`) n'en sont pas : ils relèvent de la liste
 * close de I1 ou de l'authentification, et se comptent hors cloisonnement.
 *
 * **`journal_audit` (L0-10) n'y figure pas non plus, et ce n'est pas un
 * oubli.** Cette liste sert un DÉCOMPTE COMPARÉ : ce que le seed a écrit, face
 * à ce que le rôle applicatif en voit sous le contexte de chaque société. Le
 * journal ne se prête à aucun des deux termes — il grossit à chaque écriture
 * plutôt qu'à chaque seed, et sa lecture n'est ouverte qu'à deux rôles (§5.2),
 * si bien qu'un contexte sans rôle n'en verrait jamais rien. Comparer les deux
 * chiffres reviendrait à exiger l'égalité de deux grandeurs qui n'ont aucune
 * raison d'être égales, et l'étape échouerait sur une base parfaitement saine.
 * Son cloisonnement est éprouvé là où il peut l'être — `tests/isolation/` —, et
 * son ajout seul par un contrôle de privilèges dédié dans
 * `scripts/controle-cloisonnement.mts`.
 */
export const TABLES_CLOISONNEES = [
  "societe",
  "client",
  "site",
  "contact",
  "agence",
  "calendrier",
  "calendrier_plage",
  "calendrier_ferie",
  "utilisateur_societe",
  "utilisateur_client",
  "utilisateur_client_site",
  // L1-04 : les trois tables d'habilitation. `habilitation` est une table
  // MÉTIER et non un référentiel de plateforme (D60) — une nomenclature
  // nationale est un fait de la France, pas un fait de la plateforme.
  "habilitation",
  "technicien_habilitation",
  "site_habilitation_requise",
  // L1-05 : familles et modèles de matériel. Elles étaient destinées à la
  // DEUXIÈME catégorie de I1 — référentiels de plateforme —, et l'amendement à
  // D4 du 08/09/2026 en fait des tables métier cloisonnées. Le mécanisme
  // « référentiel + copie masquante » se contredisait : une société qui ne peut
  // pas écrire ne peut pas créer de copie.
  "famille_materiel",
  "modele_materiel",
  // L1-07 : le taux horaire, HISTORISÉ par date d'effet. Un tarif est
  // commercial, donc propre à chaque société — D4 le dit déjà de `prestation`
  // et `forfait`.
  "taux_horaire",
  // L1-06 : le catalogue de forfaits. Table VIDE — la liste appartient à
  // l'exploitation, et l'inventer serait inventer une donnée métier.
  "forfait",
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
 *
 * **`utilisateur` en est SORTIE au ticket L1-02c**, et la façon dont elle en est
 * sortie mérite d'être dite : personne ne l'a retirée, **c'est le contrôle de la
 * base hébergée qui l'a réclamé**, en pleine migration — « témoin
 * “utilisateur” : 3 ligne(s) à l'inventaire, 0 lue(s) sous le rôle applicatif ».
 * Le rouge était juste : la table est désormais cloisonnée, elle DOIT rendre
 * zéro sans contexte, et c'est le témoin qui mentait.
 *
 * **Aucune suite locale ne pouvait l'attraper**, et c'est l'angle mort que ce
 * script existe pour couvrir : `test:isolation` ne joue pas les témoins de
 * l'inventaire, qui exigent d'ÉCRIRE puis de comparer. Le seul environnement où
 * le défaut existait était le seul qui ne soit jamais exercé — §9 du 23/08, mot
 * pour mot. La liste ci-dessous est donc confrontée à `TABLES_RLS_FORCEE` par
 * `tests/unit/db/inventaire.test.ts` : une table ne peut plus être à la fois
 * « hors cloisonnement » et « sous RLS forcée ».
 */
export const TABLES_HORS_CLOISONNEMENT = [
  "devise",
  "parite",
  "jour_ferie",
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
  // **DÉRIVÉ de `TABLES_CLOISONNEES`, et non recopié.** Une seconde liste
  // écrite à la main ici aurait été la même maladie que le périmètre d'audit
  // d'avant D55 et que la purge d'avant #29 : deux listes qui disent la même
  // chose, dont l'une grandit un jour sans l'autre. Elle a d'ailleurs commencé
  // à diverger au ticket L1-02 — `site` manquait ici et le total sortait à
  // `NaN`, ce qu'aucun message ne nommait. Ce qui les confrontait était le
  // typage, et le typage seul : `Record<TableCloisonnee, number>` refuse la clé
  // manquante, mais rien n'empêchait d'ajouter la ligne au lieu de retirer la
  // liste. Elle est retirée.
  return Object.fromEntries(
    TABLES_CLOISONNEES.map((table) => [table, 0]),
  ) as DecompteParTable;
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
