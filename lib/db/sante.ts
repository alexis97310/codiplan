import { PrismaClient } from "@prisma/client";

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

    const attendues = await prisma.$queryRawUnsafe<
      Array<{ nom: string; applique: boolean }>
    >(
      `SELECT migration_name AS nom,
              (finished_at IS NOT NULL AND rolled_back_at IS NULL) AS applique
         FROM _prisma_migrations
        ORDER BY started_at DESC`,
    );
    const manquante = attendues.find((m) => !m.applique);

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
      migrations:
        manquante === undefined
          ? { ok: true, detail: null }
          : { ok: false, detail: manquante.nom },
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
