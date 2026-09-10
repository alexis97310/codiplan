import { lireSchema, observeesDuSchema } from "./schema-prisma";
import {
  ecartsCouverture,
  tablesComptees,
  tablesTemoins,
} from "./tables-comptees";

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
 * ── LA POPULATION EST PRODUITE PAR LE SCHÉMA (10/09/2026) ──────────────────
 *
 * **Ces deux listes étaient écrites à la main, et elles ont rendu le contrôle
 * de la base hébergée aveugle pendant deux jours et vingt et une heures.** La
 * cécité naît au commit `97e8f95` — fusion de #32, ticket L1-02 : `site` entre
 * dans la liste close, son compteur n'est jamais écrit, et l'inventaire rend
 * zéro. Le contrôle de cloisonnement se confronte à cet inventaire : il
 * comparait **zéro à zéro** et concluait au vert sur `site`, `machine` et
 * `intervention` — les trois tables de forme « parc ».
 *
 * Passer de huit entrées à vingt et une n'aurait rien réparé : *vingt et un est
 * un nombre, et un nombre tenu à la main dérive comme les huit précédents.* La
 * charge est donc renversée comme pour D41 et D55 — la population vient du
 * SCHÉMA, et toute table qui n'y trouve pas son rang fait rougir le jour de sa
 * création. Le motif de chaque exemption est écrit dans
 * `scripts/lib/tables-comptees.ts`, seule maison de ces règles.
 *
 * *Mesuré au moment du déménagement : les vingt et une tables dérivées sont
 * exactement celles que la liste tenue à la main portait. Ce ticket change la
 * SOURCE, pas le contenu — et c'est ce qui le rend vérifiable.*
 */
const OBSERVEES = observeesDuSchema(lireSchema());

/** Tables comptées par société — dérivées de la première catégorie de I1. */
export const TABLES_CLOISONNEES: readonly string[] = tablesComptees(OBSERVEES);

/** Tables comptées hors cloisonnement — témoins, dérivés de la deuxième catégorie de I1. */
export const TABLES_HORS_CLOISONNEMENT: readonly string[] = tablesTemoins();

/**
 * Écarts de COUVERTURE de la population — à jouer avant toute mesure.
 *
 * Réexporté ici parce que c'est l'inventaire qui l'exerce : un script qui
 * compterait sans avoir vérifié sa propre population mesurerait ce qu'il sait
 * déjà regarder, et resterait muet sur le reste.
 */
export function ecartsPopulation(): string[] {
  return ecartsCouverture(OBSERVEES);
}

/**
 * Un décompte, table par table. Les clés sont celles de `TABLES_CLOISONNEES`,
 * donc du schéma : le typage ne les énumère plus — c'est la DÉRIVATION qui
 * garantit l'exhaustivité, et `ecartsPopulation` qui le prouve.
 */
export type DecompteParTable = Record<string, number>;

export type DecompteHorsCloisonnement = Record<string, number>;

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
  // **DÉRIVÉ de `TABLES_CLOISONNEES`, qui est elle-même dérivée du schéma.**
  // La chaîne n'a plus aucun maillon tenu à la main : une table métier créée
  // demain reçoit son zéro, puis son compteur, sans que personne y pense.
  return Object.fromEntries(TABLES_CLOISONNEES.map((table) => [table, 0]));
}

/** Somme des décomptes de chaque société. */
export function totaliser(
  lignes: readonly LigneInventaire[],
): DecompteParTable {
  const total = decompteVide();
  for (const ligne of lignes) {
    for (const table of TABLES_CLOISONNEES) {
      total[table] = (total[table] ?? 0) + (ligne.decomptes[table] ?? 0);
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
    if ((recalcule[table] ?? 0) !== (inventaire.total[table] ?? 0)) {
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
    if ((ligne.decomptes.societe ?? 0) > 1) {
      ecarts.push(
        `la société ${ligne.societe_id} compte ${ligne.decomptes.societe} ` +
          "lignes dans « societe » : l'identifiant doit être unique.",
      );
    }
  }

  return ecarts;
}

/**
 * TÉMOIN DE LA LECTURE — le rôle applicatif voit-il seulement quelque chose ?
 *
 * `ecartsSansContexte` attend ZÉRO partout, et c'est là son danger : **une
 * connexion aveugle rend exactement le même résultat qu'un cloisonnement
 * parfait.** Base vide, mauvaise base, requête jouée hors du schéma attendu,
 * privilèges retirés au rôle — dans les quatre cas, zéro ligne, et un vert qui
 * ne parle de rien. C'est l'espèce du §9 (30/08) : *un décompte nul ressemble
 * toujours à un sans-faute.*
 *
 * Le témoin ne coûte aucun privilège, et c'est ce qui le rend disponible LA
 * NUIT. Les référentiels de plateforme portent la forme « référentiel », dont
 * la lecture est `USING (true)` : ils sont lisibles **sans aucun contexte**,
 * par le rôle applicatif, et ils sont peuplés dès `pnpm db:referentiels` —
 * avant même qu'une société existe. Les voir non vides prouve que la lecture
 * traverse réellement les politiques et rapporte des lignes ; les zéros
 * mesurés à côté ont alors un sens.
 *
 * **Ce que ce témoin n'est PAS.** Il ne remplace pas la confrontation à
 * l'inventaire à plat — « chaque société voit exactement ses lignes » —, qui
 * exige une lecture EXEMPTÉE des politiques, donc une accréditation privilégiée
 * que la veille refuse de porter. Il établit ce qu'une lecture non privilégiée
 * peut établir seule, et pas un mot de plus.
 */
export function ecartsTemoinLecture(
  temoins: DecompteHorsCloisonnement,
): string[] {
  const lues = TABLES_HORS_CLOISONNEMENT.filter(
    (table) => (temoins[table] ?? 0) > 0,
  );
  if (lues.length > 0) {
    return [];
  }
  return [
    "la lecture n'a rapporté AUCUNE ligne, sur aucun référentiel de " +
      `plateforme (${TABLES_HORS_CLOISONNEMENT.join(", ")}) — dont la forme ` +
      "« référentiel » est pourtant `USING (true)`. Les zéros mesurés sur les " +
      "tables cloisonnées ne prouvent donc RIEN : ils ont exactement la forme " +
      "d'un cloisonnement parfait et celle d'une connexion aveugle. Base vide, " +
      "mauvaise base, ou privilèges retirés au rôle applicatif.",
  ];
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
    if ((observe[table] ?? 0) !== 0) {
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
    const attendu = ligne.decomptes[table] ?? 0;
    const vu = observe[table] ?? 0;
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
 * ── ZÉRO CONTRE ZÉRO N'EST PAS UN RÉSULTAT : C'EST UNE ABSENCE DE MESURE ────
 *
 * Ce gardien n'existait pas, et c'est ce qui a laissé la cécité du 07/09 durer
 * deux jours et vingt et une heures. `ecartsAvecContexte` compare, table par
 * table, ce que l'inventaire attribue à une société et ce que le rôle
 * applicatif en voit. **Quand les deux côtés valent zéro, la comparaison est
 * satisfaite** — et elle l'est d'autant mieux que le contrôle n'a rien regardé.
 * *Un gardien qui ne regarde rien ne peut que dire oui.*
 *
 * La règle est donc posée sur le FAIT et non sur le geste (§9, 09/09) : une
 * comparaison dont les deux termes sont vides sur toute la population ne rend
 * pas « vert », elle rend « je n'ai pas pu regarder ». Elle se distingue de
 * `ecartsInventaire`, qui échoue sur une base sans société : ici la base peut
 * porter ses sociétés et n'être mesurée sur rien d'autre — c'est exactement
 * l'état qu'a produit la liste de compteurs figée à sept entrées.
 *
 * **Il regarde le DÉTAIL, jamais la seule somme.** Une population où une table
 * unique porte des lignes et où les vingt autres comparent zéro à zéro reste
 * une mesure creuse sur ces vingt-là ; le seuil ci-dessous nomme donc les
 * tables muettes, et ne se contente pas d'un total non nul. Il ne les refuse
 * pas — `forfait` naît vide par décision, et une base neuve n'a pas encore
 * d'intervention — il exige qu'aucune SOCIÉTÉ ne soit intégralement muette,
 * ce qui est impossible sur une base saine : toute société se compte
 * elle-même dans « societe ».
 */
export function ecartsMesureVide(
  attendu: DecompteParTable,
  observe: DecompteParTable,
  quoi: string,
): string[] {
  const tables = [...TABLES_CLOISONNEES];
  if (tables.length === 0) {
    return [
      `${quoi} : la population des tables comptées est VIDE. Le contrôle ` +
        "compare deux objets sans clés et les trouve égaux — il n'a rien " +
        "établi.",
    ];
  }

  const totalAttendu = tables.reduce((n, t) => n + (attendu[t] ?? 0), 0);
  const totalObserve = tables.reduce((n, t) => n + (observe[t] ?? 0), 0);
  if (totalAttendu === 0 && totalObserve === 0) {
    return [
      `${quoi} : les DEUX côtés de la comparaison sont vides sur les ` +
        `${tables.length} tables comptées. Zéro contre zéro n'est pas un ` +
        "résultat, c'est une absence de mesure : le cloisonnement n'est ni " +
        "prouvé ni infirmé. Chercher d'abord ce qui empêche de compter — " +
        "population dérivée à vide, décompte filtré par une politique, base " +
        "vide — avant de lire ce contrôle comme vert.",
    ];
  }

  return [];
}

/**
 * LES TABLES SUR LESQUELLES LA COMPARAISON N'A RIEN ÉTABLI — zéro des deux
 * côtés, pour cette société.
 *
 * **Ce n'est pas un écart, et en faire un serait la faute du §9 (11/09)** : un
 * gardien dont le taux de fausses alertes conduit à ne plus le lire coûte plus
 * qu'il ne rapporte. `forfait` naît vide par décision, `machine` et `contact`
 * n'ont pas encore de saisie ; les refuser ferait rougir toutes les nuits.
 *
 * **Mais ce n'est pas non plus une preuve, et c'est là qu'était le trou.** Du
 * 07/09 au 09/09, quatorze tables comparaient zéro à zéro et le rapport
 * concluait « exactement les lignes de chaque société sous son contexte » —
 * une phrase vraie de sept tables, présentée comme vraie de vingt et une.
 * C'est la faute du §9 (06/09) : *une ligne qui ne peut pas bouger sous la
 * faute que je surveille n'a rien à faire dans la colonne des observations.*
 *
 * Elles sont donc NOMMÉES dans le rapport et retranchées de ce qu'il affirme.
 * Un lecteur qui voit « site » dans cette liste sait en trois secondes que le
 * cloisonnement de `site` n'a pas été éprouvé cette nuit-là ; c'est
 * exactement ce que personne n'a pu voir pendant deux jours.
 */
export function tablesMuettes(
  attendu: DecompteParTable,
  observe: DecompteParTable,
): string[] {
  return TABLES_CLOISONNEES.filter(
    (table) => (attendu[table] ?? 0) === 0 && (observe[table] ?? 0) === 0,
  );
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
    if ((observe[table] ?? 0) !== (attendu[table] ?? 0)) {
      ecarts.push(
        `témoin « ${table} » : ${attendu[table] ?? 0} ligne(s) à l'inventaire, ` +
          `${observe[table] ?? 0} lue(s) sous le rôle applicatif.`,
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
