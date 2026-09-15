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
  /*
   * ── DEUX ENTRÉES SONT PARTIES LE 12/09/2026, ET C'EST CE RETRAIT QUI PROUVE
   *    QUE LE RATTRAPAGE A EU LIEU (R3-02, D117) ──────────────────────────
   *
   * ~~`intervention_suspension_a_son_motif`~~ et
   * ~~`intervention_suspension_a_sa_date`~~ sont désormais VALIDÉES : la
   * migration `20260913250000_rattrapage_suspensions_r3_02` répare puis
   * valide, dans le même commit.
   *
   * **La règle de réparation, en une phrase : une suspension qui ne peut pas
   * dire pourquoi n'est pas une suspension.** La date se REPREND du journal
   * d'audit (I8) ; le motif ne se reprend pas, et la ligne SORT alors de
   * l'état — ce qui n'est pas une règle nouvelle mais la reprise ordinaire du
   * produit. Les résidus sont effacés, le statut faisant foi.
   *
   * *Elles ne sont pas effacées d'ici : elles sont barrées.* Ce qui a été
   * décidé un jour se relit, et le motif de D104 reste juste — c'est la
   * situation qu'il décrivait qui a cessé d'exister. Le gardien exige
   * d'ailleurs ce retrait dans les deux sens : une entrée dont la contrainte
   * est redevenue VALIDÉE fait rougir avec le mot « rattrapage a eu lieu ».
   */
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
  {
    table: "intervention",
    contrainte: "intervention_validation_tracee",
    motif:
      "D120, et exactement la famille de sa voisine : les interventions DÉJÀ " +
      "CLÔTURÉES portent un temps, et personne n'a validé ce temps — les " +
      "colonnes n'existaient pas. Leur inventer un auteur serait signer une " +
      "validation du nom de quelqu'un qui ne l'a pas faite ; leur inventer " +
      "une date serait pire encore, aucune valeur de date ne disant son " +
      "propre inconnu. La contrainte vaut donc pour toute ligne nouvelle ou " +
      "modifiée, et les anciennes gardent leurs deux colonnes vides — ce qui " +
      "est la vérité.",
    rattrapage:
      "Aucun rattrapage n'est possible ni souhaitable sur les lignes " +
      "existantes : la validation n'a pas eu lieu. La contrainte se VALIDE le " +
      "jour où toutes les interventions clôturées l'ont été APRÈS D120 — " +
      "c'est-à-dire quand les plus anciennes sont sorties du périmètre de " +
      "conservation, ou jamais. Elle reste alors NOT VALID, et c'est l'état " +
      "juste.",
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
