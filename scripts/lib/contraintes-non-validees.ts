/**
 * LES CONTRAINTES POSÉES « NOT VALID » — l'état non validé est VISIBLE, ou il
 * n'existe pas (D104).
 *
 * ## Pourquoi cette liste existe
 *
 * Une contrainte `NOT VALID` vaut pour toute ligne **nouvelle ou modifiée**, et
 * ne relit jamais les lignes d'avant. C'est exactement ce qu'il faut dire quand
 * une règle naît après les données qu'elle gouverne — *et c'est aussi la forme
 * la plus commode d'une règle qu'on n'applique pas*. La différence entre les
 * deux n'est pas dans le SQL : elle est dans le fait que quelqu'un l'ait
 * DÉCIDÉ, et que cela se relise.
 *
 * **Sans cette liste, `NOT VALID` serait le raccourci qui fait taire une
 * migration.** Le jour où une contrainte gênerait, l'ajouter coûterait deux
 * mots et ne ferait rougir personne — *une règle silencieusement non tenue sur
 * une partie des données*, qui est précisément ce que l'exploitation a refusé
 * le 11/09/2026.
 *
 * ## GARDÉE DANS LES DEUX SENS, et le second est celui qu'on oublie
 *
 *   — une contrainte **observée non validée** et **non déclarée** : quelqu'un a
 *     posé `NOT VALID` sans le décider. C'est le sens qu'on attend.
 *   — une contrainte **déclarée** et **observée VALIDÉE** : le rattrapage a eu
 *     lieu, et l'entrée ment désormais. *Une liste qui garde ses entrées après
 *     leur objet devient une liste qu'on cesse de regarder.*
 *   — une contrainte **déclarée** qui **n'existe pas** : l'entrée ne s'adosse
 *     plus à rien — elle n'exempte plus personne, et le premier objet qui
 *     reprendra ce nom héritera d'une exemption que nul ne lui a accordée
 *     (§9, 31/08).
 *
 * Cette liste doit se VIDER. Elle n'est pas un inventaire des dettes tolérées :
 * chaque entrée nomme son rattrapage, et le rattrapage a un ticket.
 */

/** Ce que `pg_constraint` rend, et qui suffit à décider. */
export type ContrainteObservee = {
  readonly table: string;
  readonly contrainte: string;
  readonly validee: boolean;
};

/**
 * La requête. Elle ne lit que le catalogue — aucune donnée métier, aucune
 * ligne d'aucune table cloisonnée : la veille tourne sous le rôle applicatif et
 * en lecture seule.
 *
 * `contype IN ('c','f')` : seules les contraintes CHECK et les clés étrangères
 * admettent `NOT VALID` en PostgreSQL. Une contrainte d'unicité ou une clé
 * primaire n'en a pas la possibilité — les inclure gonflerait la population
 * d'objets dont `convalidated` est vrai par construction, et **une population
 * qu'on gonfle de cas impossibles rend un témoin de non-vacuité menteur.**
 */
export const SQL_CONTRAINTES = `
  SELECT rel.relname::text  AS "table",
         con.conname::text  AS "contrainte",
         con.convalidated   AS "validee"
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND con.contype IN ('c', 'f')
  ORDER BY rel.relname, con.conname
`;

/** Une contrainte dont l'état non validé est DÉCIDÉ, avec son rattrapage. */
export type NonValideeDeclaree = {
  readonly table: string;
  readonly contrainte: string;
  readonly motif: string;
  readonly rattrapage: string;
};

/**
 * LA LISTE CLOSE. Toute addition passe par un arbitrage — `NOT VALID` est un
 * assouplissement d'invariant, et le §8 en fait un point d'arrêt.
 */
export const CONTRAINTES_NON_VALIDEES: readonly NonValideeDeclaree[] = [
  {
    table: "intervention",
    contrainte: "intervention_suspension_a_son_motif",
    motif:
      "D104. Les interventions suspendues ANTÉRIEURES à L2-10 n'ont pas de " +
      "motif, et personne ne peut en énoncer un à leur place : ce serait une " +
      "donnée que nul n'a jamais dite. La règle vaut pour toute ligne nouvelle " +
      "ou modifiée — une ligne ancienne qu'on touche doit se mettre en règle, " +
      "et c'est le seul moment où quelqu'un est là pour dire le motif.",
    rattrapage:
      "R3-02 — renseigner le motif des suspensions antérieures, puis " +
      "VALIDATE CONSTRAINT et retirer cette entrée.",
  },
  {
    table: "intervention",
    contrainte: "intervention_suspension_a_sa_date",
    motif:
      "D104, et pour une raison plus forte que sa jumelle : AUCUNE valeur de " +
      "date ne dit son propre inconnu. Une date inventée alimenterait " +
      "l'ancienneté que la file « en attente de pièce » affiche et que " +
      "l'alerte « > 30 jours » du chapitre 16.1 surveille — on ne fabrique " +
      "pas l'âge d'une attente.",
    rattrapage:
      "R3-02 — même rattrapage : la date se lit dans le journal d'audit, qui " +
      "porte l'instant du changement de statut, et c'est une reprise, pas une " +
      "invention.",
  },
  {
    table: "intervention",
    contrainte: "intervention_cloture_a_son_statut_facturation",
    motif:
      "D104, et la même famille que ses deux voisines : les interventions " +
      "DÉJÀ CLÔTURÉES n'ont pas de statut de facturation, parce que la " +
      "colonne n'existait pas. Et les deux valeurs disponibles décident de " +
      "l'argent — « à facturer » ferait entrer une intervention close il y a " +
      "six mois dans une file de facturation, « non facturable » " +
      "renoncerait à un montant. Personne ne peut trancher à la place de " +
      "l'exploitant, ligne par ligne.",
    rattrapage:
      "Renseigner le statut de facturation des interventions déjà clôturées " +
      "— le retour de facturation (chapitre 11, reference_facture) dit " +
      "lesquelles ont été facturées —, puis VALIDATE CONSTRAINT et retirer " +
      "cette entrée.",
  },
] as const;

function cle(table: string, contrainte: string): string {
  return `${table}.${contrainte}`;
}

/**
 * LE RAPPORT NOMME, il ne compte pas. *Un décompte se lit en trois secondes et
 * ne se vérifie pas ; un nom se vérifie* (§9, 06/09). Et chaque ligne dit de
 * quel côté du miroir elle vient — la base, ou la liste déclarée.
 */
export function rapportContraintesNonValidees(
  observees: readonly ContrainteObservee[],
  declarees: readonly NonValideeDeclaree[] = CONTRAINTES_NON_VALIDEES,
): string {
  const nonValidees = observees.filter((c) => !c.validee);
  return [
    `Contraintes CHECK et clés étrangères lues en base : ${observees.length}.`,
    `  observées NON VALIDÉES : ${
      nonValidees.length === 0
        ? "aucune"
        : nonValidees.map((c) => cle(c.table, c.contrainte)).join(", ")
    }`,
    `  déclarées (dépôt)      : ${
      declarees.length === 0
        ? "aucune"
        : declarees.map((d) => cle(d.table, d.contrainte)).join(", ")
    }`,
  ].join("\n");
}

export function ecartsContraintesNonValidees(
  observees: readonly ContrainteObservee[],
  declarees: readonly NonValideeDeclaree[] = CONTRAINTES_NON_VALIDEES,
): string[] {
  // TÉMOIN DE NON-VACUITÉ. Zéro contrainte observée n'est pas « aucune n'est
  // NOT VALID » : c'est une requête qui n'a rien lu, et elle rendrait un vert
  // sur toute liste déclarée. *Un décompte nul ressemble à un sans-faute.*
  if (observees.length === 0) {
    return [
      "aucune contrainte lue en base : la requête n'a rien observé, et ce " +
        "contrôle ne mesure alors rien. Ce n'est pas un vert.",
    ];
  }

  const ecarts: string[] = [];
  const parCle = new Map(observees.map((c) => [cle(c.table, c.contrainte), c]));
  const declareesParCle = new Map(
    declarees.map((d) => [cle(d.table, d.contrainte), d]),
  );

  for (const observee of observees) {
    const k = cle(observee.table, observee.contrainte);
    if (!observee.validee && !declareesParCle.has(k)) {
      ecarts.push(
        `${k} est posée NOT VALID et n'est DÉCLARÉE nulle part. Une règle qui ` +
          "ne vaut que pour une partie des lignes est une décision, pas une " +
          "modalité : elle s'écrit dans CONTRAINTES_NON_VALIDEES avec son " +
          "motif et son rattrapage, ou la contrainte se pose validée.",
      );
    }
  }

  for (const declaree of declarees) {
    const k = cle(declaree.table, declaree.contrainte);
    const observee = parCle.get(k);
    if (observee === undefined) {
      ecarts.push(
        `${k} est déclarée non validée et n'existe PAS en base. L'entrée ne ` +
          "s'adosse plus à rien : elle n'exempte plus personne, et le premier " +
          "objet qui reprendra ce nom héritera d'une exemption que nul ne lui " +
          "a accordée.",
      );
      continue;
    }
    if (observee.validee) {
      ecarts.push(
        `${k} est déclarée non validée et la base la dit VALIDÉE. Le ` +
          "rattrapage a eu lieu — retirer l'entrée, sans quoi la liste " +
          `survit à son objet. (${declaree.rattrapage})`,
      );
    }
  }

  return ecarts;
}
