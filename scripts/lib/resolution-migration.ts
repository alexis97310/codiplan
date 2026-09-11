/**
 * RÉSOUDRE UNE MIGRATION EN ÉCHEC — la règle, sans base et sans horloge.
 *
 * Quand `prisma migrate deploy` échoue, Prisma laisse dans `_prisma_migrations`
 * une ligne SANS `finished_at` et SANS `rolled_back_at`, et il REFUSE toute
 * migration ultérieure tant qu'elle est là (`P3018` — « New migrations cannot
 * be applied before the error is recovered from »). *La base ne se remet pas
 * d'elle-même : il faut une main.*
 *
 * Or cette main tient un secret qu'Alexis n'a pas sous les doigts — la chaîne
 * de connexion ne vit que dans les secrets du dépôt. Le seul chemin qui lui
 * reste est un flux GitHub, et un flux qui écrit dans l'historique des
 * migrations d'une base réelle doit être **plus difficile à mal déclencher
 * qu'à bien déclencher**.
 *
 * ## UN SEUL VERBE, ET CE N'EST PAS CELUI QU'ON CROIT
 *
 * `prisma migrate resolve` en a deux. `--applied` marque une migration comme
 * appliquée **sans l'exécuter** : il ÉCRIT DANS L'HISTOIRE une chose qui n'a
 * pas eu lieu, et la base diverge alors du dépôt sans que rien ne le dise —
 * exactement la panne que la veille cherche. Il n'est pas exposé ici, et ce
 * n'est pas un oubli.
 *
 * `--rolled-back` dit l'inverse : *cette migration n'a rien laissé, on la
 * rejouera.* C'est une constatation, et elle se VÉRIFIE avant d'être écrite.
 *
 * ## LA VÉRIFICATION QUI PORTE TOUT : `applied_steps_count`
 *
 * Prisma joue le fichier d'une migration comme **une seule commande**, donc
 * dans une transaction implicite : un échec ne laisse rien, et le compteur
 * d'étapes vaut **0**. *Mesuré le 11/09/2026 sur la panne réelle rejouée en
 * local : `applied_steps_count = 0`, et aucune des quatre colonnes de la
 * migration n'existait en base.*
 *
 * **Mais ce n'est pas vrai de toute migration.** Une migration qui contient un
 * ordre non transactionnel — `CREATE INDEX CONCURRENTLY`, et c'est le cas
 * ordinaire le jour où le journal d'audit grossira — s'applique par morceaux,
 * et le compteur est alors NON NUL. Déclarer une telle migration « rolled
 * back » serait affirmer que la base ne porte rien d'elle alors qu'elle en
 * porte la moitié : *un état que rien ne décrit, et que le rejeu ne rattrapera
 * pas.* Le verdict REFUSE ce cas et nomme ce qu'il faut faire à la place.
 *
 * La règle vit ici, éprouvée sur des états fabriqués
 * (`tests/unit/db/resolution-migration.test.ts`) ; `scripts/resoudre-migration.mts`
 * fournit l'OBSERVATION et rien d'autre — même partage que l'horizon des
 * fériés, le battement et les partitions.
 */

/** Ce que `_prisma_migrations` porte, et qui suffit à décider. */
export type LigneMigration = {
  readonly migration_name: string;
  readonly finished_at: Date | null;
  readonly rolled_back_at: Date | null;
  readonly applied_steps_count: number;
};

/** La requête. Elle ne lit AUCUNE donnée métier — l'historique, et lui seul. */
export const SQL_HISTORIQUE_MIGRATIONS = `
  SELECT "migration_name", "finished_at", "rolled_back_at", "applied_steps_count"
  FROM "_prisma_migrations"
  ORDER BY "started_at" ASC
`;

export type Verdict =
  | { readonly resoluble: true; readonly migration: LigneMigration }
  | { readonly resoluble: false; readonly motif: string };

/**
 * `nomDemande` est ce que la personne a TAPÉ dans le flux. Il n'est pas une
 * commodité : c'est la confirmation. Une résolution qui se contenterait de
 * « la migration en échec, quelle qu'elle soit » s'exécuterait à l'identique
 * sur une base dont on n'a pas lu l'état — et le jour où deux personnes
 * cliquent, la seconde résout ce que la première vient de réparer.
 */
export function verdictDeResolution(
  lignes: readonly LigneMigration[],
  nomDemande: string,
): Verdict {
  // TÉMOIN DE NON-VACUITÉ. Un historique vide n'est pas « rien à résoudre » :
  // c'est une base qui n'a jamais été migrée, ou une requête qui n'a rien lu.
  // *Un décompte nul ressemble toujours à un sans-faute* (§9, 30/08).
  if (lignes.length === 0) {
    return {
      resoluble: false,
      motif:
        "L'historique des migrations est VIDE. Ce n'est pas « rien à résoudre » : " +
        "c'est une base jamais migrée, ou une lecture qui n'a rien vu. " +
        "Rien n'est écrit.",
    };
  }

  const enEchec = lignes.filter(
    (l) => l.finished_at === null && l.rolled_back_at === null,
  );

  if (enEchec.length === 0) {
    return {
      resoluble: false,
      motif:
        `Aucune migration en échec parmi les ${lignes.length} de l'historique. ` +
        "Il n'y a rien à résoudre — et s'il reste des migrations à appliquer, " +
        "c'est « DB migrate & seed » qu'il faut lancer, pas ce flux-ci.",
    };
  }

  // Prisma s'arrête à la PREMIÈRE migration qui échoue ; il ne peut donc y en
  // avoir qu'une. Deux signifient qu'une main est passée par là, et ce flux
  // n'est pas le bon endroit pour en décider.
  if (enEchec.length > 1) {
    return {
      resoluble: false,
      motif:
        `${enEchec.length} migrations sont en échec : ` +
        `${enEchec.map((l) => l.migration_name).join(", ")}. ` +
        "Prisma s'arrête à la première : cet état n'a pas été produit par une " +
        "migration ordinaire. Il demande un arbitrage, pas un bouton.",
    };
  }

  const cible = enEchec[0];

  if (cible.migration_name !== nomDemande) {
    return {
      resoluble: false,
      motif:
        `La migration en échec est « ${cible.migration_name} », et le flux a ` +
        `reçu « ${nomDemande} ». Rien n'est écrit : le nom saisi EST la ` +
        "confirmation, et il ne correspond pas à ce que la base porte.",
    };
  }

  if (cible.applied_steps_count > 0) {
    return {
      resoluble: false,
      motif:
        `« ${cible.migration_name} » a appliqué ${cible.applied_steps_count} ` +
        "étape(s) avant d'échouer : la base en porte une PARTIE. La déclarer " +
        "« annulée » affirmerait qu'elle n'a rien laissé — ce serait faux, et " +
        "le rejeu buterait sur ce qui existe déjà. Ce cas demande un arbitrage : " +
        "il faut décider, objet par objet, ce que la base garde.",
    };
  }

  return { resoluble: true, migration: cible };
}

/**
 * Ce que le flux imprime AVANT d'agir. Il nomme les migrations, il ne se
 * contente pas de les compter : *un décompte se lit en trois secondes et ne se
 * vérifie pas, un nom se vérifie* (§9, 06/09).
 */
export function rapportHistorique(lignes: readonly LigneMigration[]): string {
  const appliquees = lignes.filter((l) => l.finished_at !== null);
  const annulees = lignes.filter(
    (l) => l.finished_at === null && l.rolled_back_at !== null,
  );
  const enEchec = lignes.filter(
    (l) => l.finished_at === null && l.rolled_back_at === null,
  );

  const lignesRapport = [
    `Historique lu dans _prisma_migrations — ${lignes.length} ligne(s).`,
    `  appliquées : ${appliquees.length}`,
    `  annulées   : ${annulees.length}${
      annulees.length === 0
        ? ""
        : ` — ${annulees.map((l) => l.migration_name).join(", ")}`
    }`,
    `  EN ÉCHEC   : ${enEchec.length}${
      enEchec.length === 0
        ? ""
        : ` — ${enEchec
            .map(
              (l) => `${l.migration_name} (${l.applied_steps_count} étape(s))`,
            )
            .join(", ")}`
    }`,
  ];
  return lignesRapport.join("\n");
}
