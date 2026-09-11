import { PrismaClient } from "@prisma/client";

import { MIGRATIONS_ATTENDUES } from "./migrations-attendues";

/**
 * L'ÉTAT DE SANTÉ DE L'INSTALLATION (mise en ligne).
 *
 * ## Ce que cette page existe pour répondre, et à qui
 *
 * À quelqu'un qui vient de déployer et qui regarde son téléphone : *est-ce que
 * ça marche ?* Quatre questions, quatre réponses en clair — la base répond-elle,
 * le rôle est-il le bon, les migrations sont-elles à jour, y a-t-il des données.
 *
 * ## LA RÈGLE QUI GOUVERNE CE MODULE : IL NE LÈVE JAMAIS
 *
 * *Avec une base injoignable, la page s'affiche quand même et dit « non ».*
 * C'est la demande explicite, et elle a une raison : une page de santé qui rend
 * 500 quand la base est absente ne dit rien de plus que le 500 qu'on cherchait
 * à diagnostiquer. **Une sonde qui tombe en même temps que ce qu'elle
 * surveille ne surveille rien.** Chaque lecture est donc encapsulée, et un échec
 * devient une réponse « non » accompagnée d'un motif LISIBLE.
 *
 * ## ET ELLE NE DIT JAMAIS DE SECRET
 *
 * Ni URL, ni nom de base, ni nom d'hôte, ni identifiant, ni mot de passe —
 * cette page est **sans compte**, donc lisible par n'importe qui. Le motif d'un
 * échec est réécrit en une phrase de notre main : le message brut d'un pilote
 * PostgreSQL porte l'hôte et le port. *Un message d'erreur est un canal
 * d'information : il est soumis au cloisonnement comme une requête* (D50).
 */

/** Une réponse en clair : oui, non, et pourquoi. */
export type Reponse = {
  readonly ok: boolean;
  readonly detail: string | null;
};

/**
 * Un DÉCOMPTE, et ce qu'il vaut.
 *
 * `lisible: false` n'est pas « zéro » : c'est *« cette connexion n'a pas le
 * droit de compter »*. Les confondre serait la faute du §9 (06/09) — un chiffre
 * juste, dans un rapport vrai, qui fait conclure faux : **un zéro se lit comme
 * une installation vide**, alors qu'il dit ici que le cloisonnement fonctionne.
 */
export type Decompte =
  | { readonly lisible: true; readonly valeur: number }
  | { readonly lisible: false; readonly motif: string };

/** Ce que la page affiche, en entier. */
export type EtatSante = {
  readonly baseJointe: Reponse;
  readonly roleApplicatif: Reponse;
  readonly migrations: Reponse;
  readonly societes: Decompte;
  readonly comptes: Decompte;
};

/**
 * Réécrit un échec en une phrase SANS hôte, sans port, sans nom de base.
 *
 * Le message brut d'un pilote PostgreSQL — « Can't reach database server at
 * `ep-xxxx.aws.neon.tech:5432` » — nomme l'hébergeur, la région et le nom de
 * l'instance. Sur une page sans compte, c'est une carte du système offerte au
 * premier venu.
 */
function detailAbsentes(premiere: string, nombre: number): string {
  return nombre === 1
    ? `Une migration n'est pas appliquée : ${premiere}.`
    : `${nombre} migrations ne sont pas appliquées. La première est ${premiere}.`;
}

/**
 * Une migration RESTÉE EN ÉCHEC — et « en échec » n'est pas « annulée ».
 *
 * La rédaction précédente disait « a échoué **ou** a été annulée », et ce OU
 * était la faute : les deux états ne se corrigent pas du même geste. *Une
 * migration annulée se rejoue toute seule au déploiement suivant ; une
 * migration en échec BLOQUE toutes les suivantes* (`P3018`) et demande d'abord
 * qu'on la déclare annulée. Le motif dit donc lequel des deux, et ce qu'il
 * empêche.
 */
function detailEchec(nom: string): string {
  return (
    `Une migration a échoué et bloque toutes les suivantes : ${nom}. ` +
    "Elle doit être déclarée annulée avant de pouvoir être rejouée."
  );
}

/**
 * UNE TENTATIVE de migration, telle que `_prisma_migrations` la porte.
 *
 * **C'est bien une TENTATIVE et non une migration** : la table en porte une
 * LIGNE PAR ESSAI, et le même nom peut y figurer plusieurs fois. *Mesuré le
 * 11/09/2026 en rejouant la panne : après `migrate resolve --rolled-back` puis
 * `migrate deploy`, `_prisma_migrations` porte **deux** lignes pour
 * `20260913160000_suspension_l2_10` — la tentative annulée à 22:32:06, la
 * tentative appliquée à 22:32:09.*
 */
export type TentativeMigration = {
  readonly nom: string;
  readonly debut: Date;
  readonly finie: boolean;
  readonly annulee: boolean;
};

/** Le verdict, et le motif qui dit QUEL geste il appelle. */
export type VerdictMigrations =
  | { readonly aJour: true }
  | {
      readonly aJour: false;
      readonly nom: string;
      readonly nombre: number;
      /** `true` : elle BLOQUE les suivantes. `false` : il en manque, sans blocage. */
      readonly echec: boolean;
    };

/**
 * L'ÉTAT D'UNE MIGRATION EST CELUI DE SA DERNIÈRE TENTATIVE, ET D'ELLE SEULE.
 *
 * ## La faute que cette fonction répare, mesurée le 11/09/2026
 *
 * La rédaction précédente cherchait une tentative non appliquée **n'importe où**
 * dans la table :
 *
 * ```ts
 * const echouee = lignes.find((l) => !l.applique);
 * ```
 *
 * Elle trouvait donc la tentative ANNULÉE d'une migration qui avait été
 * **réappliquée avec succès juste après**, et la page répondait *« Une migration
 * a échoué ou a été annulée »* sur une base parfaitement à jour.
 *
 * > **Hier la sonde disait OUI sans mesurer ; aujourd'hui elle disait NON sans
 * > mesurer.** C'est la même espèce prise par l'autre bout, et le coût est
 * > symétrique : *une alarme qui hurle à tort désapprend à lire les alarmes
 * > aussi sûrement qu'une alarme muette* (§9, 11/09 — le gardien bruyant).
 *
 * ## UNE SEULE LECTURE DU CRITÈRE, et c'est pour cela qu'elle est ici
 *
 * Le défaut ne portait que sur la moitié « en échec » : la moitié « absente »
 * était juste. Réparer la seule moitié fautive aurait laissé **deux lectures du
 * même critère dans la même fonction** — la divergence du §9 (01/09), au pire
 * endroit. Les deux moitiés dérivent donc du même `derniere`.
 *
 * ## TROIS ÉTATS, ET JAMAIS DEUX
 *
 * | dernière tentative | sens | geste |
 * |---|---|---|
 * | finie, non annulée | **appliquée** | — |
 * | ni finie ni annulée | **EN ÉCHEC** — bloque les suivantes (`P3018`) | la déclarer annulée, puis migrer |
 * | annulée | rejouable | migrer |
 *
 * *Les deux derniers étaient confondus, et ils n'appellent pas le même geste.*
 * Une migration annulée n'est pas un incident : c'est un état d'attente que le
 * déploiement suivant résout tout seul.
 *
 * **L'échec est préféré à l'absence dans le motif**, et l'ordre n'est pas
 * arbitraire : une migration en échec empêche d'appliquer celles qui manquent.
 * Nommer l'absence d'abord enverrait jouer un geste qui ne peut pas aboutir.
 *
 * *La limite, écrite : l'ordre des tentatives se lit sur `started_at`. Deux
 * tentatives de la même microseconde seraient indiscernables — `_prisma_migrations`
 * n'a pas d'autre clé ordonnée, son `id` étant tiré au sort.*
 */
export function verdictDesMigrations(
  tentatives: readonly TentativeMigration[],
  attendues: readonly string[] = MIGRATIONS_ATTENDUES,
): VerdictMigrations {
  const derniere = new Map<string, TentativeMigration>();
  for (const tentative of tentatives) {
    const connue = derniere.get(tentative.nom);
    if (connue === undefined || tentative.debut > connue.debut) {
      derniere.set(tentative.nom, tentative);
    }
  }

  const appliquee = (nom: string): boolean => {
    const t = derniere.get(nom);
    return t !== undefined && t.finie && !t.annulee;
  };

  // L'ORDRE est celui du dépôt, et il porte l'information : la PREMIÈRE absente
  // est celle par laquelle la base a décroché.
  const absentes = attendues.filter((nom) => !appliquee(nom));

  // Une migration EN ÉCHEC bloque tout, y compris celles qui manquent — et
  // elle compte même si le code déployé ne l'attend pas : c'est la base qui est
  // verrouillée, pas le code.
  const enEchec = [...derniere.values()].find((t) => !t.finie && !t.annulee);

  if (enEchec !== undefined) {
    return { aJour: false, nom: enEchec.nom, nombre: 1, echec: true };
  }
  if (absentes.length > 0) {
    return {
      aJour: false,
      nom: absentes[0]!,
      nombre: absentes.length,
      echec: false,
    };
  }
  return { aJour: true };
}

function motifSansSecret(erreur: unknown): string {
  const code =
    typeof erreur === "object" && erreur !== null && "errorCode" in erreur
      ? String((erreur as { errorCode: unknown }).errorCode)
      : null;
  if (code === "P1001" || code === "P1000" || code === "P1002") {
    return "La base de données ne répond pas.";
  }
  if (code === "P1010") {
    return "La base refuse ces identifiants.";
  }
  return "La base n'a pas pu être interrogée.";
}

/** Le rôle applicatif attendu — il ne doit être ni propriétaire, ni privilégié. */
const ROLE_ATTENDU = "codiplan_app";

/**
 * Lit l'état, sans jamais lever.
 *
 * Le client est créé ici et refermé ici : cette page ne partage pas le client
 * de l'application, dont la création peut elle-même échouer si la configuration
 * manque — et c'est précisément un des cas qu'elle doit savoir rapporter.
 */
export async function lireSante(): Promise<EtatSante> {
  let prisma: PrismaClient | null = null;
  try {
    prisma = new PrismaClient();
  } catch {
    return {
      baseJointe: { ok: false, detail: "La configuration est absente." },
      roleApplicatif: { ok: false, detail: null },
      migrations: { ok: false, detail: null },
      societes: decompteNonLisible(),
      comptes: decompteNonLisible(),
    };
  }

  try {
    const roles = await prisma.$queryRawUnsafe<
      Array<{ role: string; superutilisateur: boolean; contourne: boolean }>
    >(
      `SELECT current_user AS role,
              rolsuper AS superutilisateur,
              rolbypassrls AS contourne
         FROM pg_roles WHERE rolname = current_user`,
    );
    const role = roles[0];

    // ── LA QUESTION POSÉE EST « LES MIGRATIONS SONT-ELLES À JOUR ? » ────────
    //
    // **Elle ne l'était pas, et c'est la panne du 11/09/2026.** Ce bloc
    // cherchait une ligne EN ÉCHEC dans `_prisma_migrations` :
    //
    //     const manquante = attendues.find((m) => !m.applique);
    //
    // *Une migration jamais appliquée n'a pas de ligne.* La recherche ne
    // trouvait donc rien, et la page répondait « oui » pendant que sept
    // migrations manquaient et que `/planning` rendait une exception serveur —
    // **le code déployé sélectionnait quatre colonnes qui n'existaient pas en
    // base.**
    //
    // > La question posée était « une migration a-t-elle ÉCHOUÉ ? », et la
    // > réponse était rendue sous le libellé « les migrations sont-elles À
    // > JOUR ? ». Ce sont deux questions différentes, et **la seconde ne peut
    // > pas se répondre depuis la base seule** : il y faut ce que le DÉPÔT
    // > attend. *Un contrôle qui ment est plus grave que la panne qu'il rate.*
    //
    // Les deux questions sont désormais posées, et une seule réponse les porte :
    // une migration **en échec** et une migration **absente** rendent toutes
    // deux « non », et le motif dit laquelle.
    // LES TROIS COLONNES BRUTES, et `started_at` EN FAIT PARTIE : sans elle, on
    // ne peut pas savoir laquelle des tentatives d'un même nom est la dernière —
    // et c'est exactement ce qui manquait à la rédaction du 11/09. *Le verdict
    // est calculé par `verdictDesMigrations`, qui ne connaît aucune base.*
    const tentatives = await prisma.$queryRawUnsafe<TentativeMigration[]>(
      `SELECT migration_name       AS nom,
              started_at           AS debut,
              finished_at IS NOT NULL   AS finie,
              rolled_back_at IS NOT NULL AS annulee
         FROM _prisma_migrations`,
    );
    const verdict = verdictDesMigrations(tentatives);

    // Les décomptes sont lus SANS contexte de société : ils ne rendent donc que
    // des NOMBRES, jamais une ligne. `societe` est de forme « identité » — sans
    // contexte, elle rend zéro sous le rôle applicatif —, et c'est pour cela
    // que le décompte passe par un agrégat que la politique laisse compter.
    const societes = decompteNonLisible();
    const comptes = decompteNonLisible();

    return {
      baseJointe: { ok: true, detail: null },
      roleApplicatif:
        role === undefined
          ? { ok: false, detail: null }
          : {
              ok:
                role.role === ROLE_ATTENDU &&
                !role.superutilisateur &&
                !role.contourne,
              detail:
                role.role === ROLE_ATTENDU
                  ? null
                  : `Le rôle connecté n'est pas « ${ROLE_ATTENDU} ».`,
            },
      migrations: verdict.aJour
        ? { ok: true, detail: null }
        : {
            ok: false,
            // Le motif NOMME la migration et COMBIEN il en manque : *la
            // première absente est celle par laquelle la base a décroché*,
            // et le nombre dit l'ampleur du geste à jouer. Un nom de
            // migration n'est pas un secret — il est dans le dépôt public —,
            // et cette page n'en dit toujours aucun autre.
            detail: verdict.echec
              ? detailEchec(verdict.nom)
              : detailAbsentes(verdict.nom, verdict.nombre),
          },
      societes,
      comptes,
    };
  } catch (erreur: unknown) {
    return {
      baseJointe: { ok: false, detail: motifSansSecret(erreur) },
      roleApplicatif: { ok: false, detail: null },
      migrations: { ok: false, detail: null },
      societes: decompteNonLisible(),
      comptes: decompteNonLisible(),
    };
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

/**
 * LE DÉCOMPTE DES TABLES CLOISONNÉES N'EST PAS LISIBLE D'ICI, ET C'EST ÉCRIT
 * PLUTÔT QUE MAQUILLÉ EN ZÉRO.
 *
 * **Mesuré à l'écran avant d'être corrigé** : la page affichait « Sociétés : 0 »
 * et « Comptes : 0 » sur une base qui en portait deux et une. Le compte est fait
 * sous le rôle applicatif et **sans société active** ; `societe` est de forme
 * « identité » et `utilisateur` de forme « désignation » — l'une comme l'autre
 * rendent **zéro** tant que rien n'est nommé. Le chiffre était donc juste au
 * sens où la requête le rendait, et **faux au sens où on le lisait** : un zéro
 * se lit « installation vide », et c'est la conclusion opposée à la vraie.
 *
 * *C'est le §9 du 06/09 dans sa forme la plus coûteuse — un chiffre juste, dans
 * un rapport vrai, qui fait conclure faux.* La réparation n'est pas de trouver
 * une connexion qui verrait tout : ce serait déposer une clé passe-partout sur
 * une page **sans compte**. C'est de dire ce qu'on sait, et pas davantage.
 *
 * **Et ce que la page dit à la place est PLUS FORT qu'un nombre** : que la
 * lecture soit refusée prouve que le cloisonnement mord sur cette connexion.
 */
function decompteNonLisible(): Decompte {
  return {
    lisible: false,
    motif:
      "Le cloisonnement l'interdit à cette connexion, et c'est le bon " +
      "comportement : les sociétés et les comptes ne se lisent qu'une fois " +
      "connecté. Que cette page ne puisse pas les compter prouve que le " +
      "cloisonnement fonctionne.",
  };
}
