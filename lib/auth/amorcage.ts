import { randomBytes } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import { avecSociete } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { creerAuth } from "./config";
import { dansUnEchangeAuth } from "./echange";
import { avecDesignationAuth } from "./lecture-identite";
import { Role } from "./roles";

/**
 * LE GESTE D'OUVERTURE DU PREMIER COMPTE (Q1 / D65, arbitrage du 09/09/2026).
 *
 * ## Le problème, et pourquoi il bloquait tout
 *
 * `utilisateur_ouverture` exigeait une société active ET le rôle qui administre.
 * Pour la PREMIÈRE identité d'une société il n'existe personne à être :
 * **personne ne pouvait se connecter à CODIPLAN, et rien ne pouvait y
 * remédier.**
 *
 * La nuit du 08/09 avait refusé de poser ce geste parce qu'un script qui
 * poserait lui-même `app.role` sur le rôle qui administre **s'attribuerait une autorité
 * que personne ne lui a accordée**. Ce refus était juste, et il n'est pas
 * revenu dessus : la sortie n'est pas que le script prétende à un rôle, c'est
 * que **la BASE admette un cas qui se détruit en s'exerçant**
 * (`app_societe_active_vierge()`). Le script ne pose AUCUN rôle — il passe
 * `role: null`, et il faut le lire comme la moitié qui compte.
 *
 * ## CE QUE CE MODULE NE FAIT PAS
 *
 * **Il ne pose aucun mot de passe qui transite.** Better Auth exige un mot de
 * passe à la création : celui-ci est tiré au hasard, utilisé une fois et
 * **jamais rendu à l'appelant** — il n'est ni affiché, ni journalisé, ni écrit
 * nulle part en clair. Ce qui est rendu est un **jeton de premier accès** :
 * une ligne de `verification` émise par la mécanique de la bibliothèque, donc
 * **à usage unique et datée**, dont l'identifiant opaque est le seul secret.
 *
 * *Mesuré le 09/09/2026 :* un second usage du même jeton est refusé
 * (`INVALID_TOKEN`), et la consommation se fait sur l'instance de PRODUCTION,
 * qui ne peut pas en émettre. Émettre et consommer sont deux droits distincts.
 *
 * **Il ne rattrape pas l'erreur d'unicité du courriel.** `utilisateur.email` est
 * `@unique` : le refus de servir deux fois existe déjà en base, et le geste le
 * laisse remonter tel quel plutôt que d'inventer un rattrapage.
 *
 * **Il ne laisse pas de session derrière lui (D2 du registre du 08/09).**
 * `signUpEmail` OUVRE une session au nom du compte créé — mesuré, une ligne de
 * `session` après l'appel. Celui qui ouvre le compte en repartirait donc avec
 * une session à ce nom : *une porte d'amorçage qui laisse une session ouverte
 * derrière elle est pire que celle qu'on voulait éviter.* Le geste la ferme
 * explicitement, et un scénario compte les sessions avant et après.
 *
 * ## L'ORDRE DES ÉCRITURES EST LE CLIQUET
 *
 * L'identité d'abord — la branche d'amorçage est alors ouverte, la société ne
 * portant aucune habilitation. L'habilitation ensuite — et cette écriture
 * **referme la branche pour toujours**. Un second appel sur la même société est
 * refusé par la base, pas par une condition de ce module.
 *
 * ## CE QUI ARRIVE SI LE GESTE ÉCHOUE À MI-CHEMIN
 *
 * Écrit plutôt que tu : les appels de Better Auth ouvrent chacun leur propre
 * transaction, et rien ne peut les envelopper toutes. Un échec après la
 * création de l'identité laisse donc **une identité sans habilitation** — qui
 * ne lit rien de cloisonné, et n'accorde rien. La société reste vierge, donc le
 * geste reste rejouable ; il faudra un autre courriel, l'unicité refusant le
 * premier. C'est une gêne d'exploitation, jamais une ouverture.
 *
 * ## LA CONDITION DE RETRAIT, ET ELLE EST GARDÉE PAR LA MACHINE
 *
 * *Le jour où le chemin administratif d'ouverture de compte existe, ce geste
 * disparaît.* Ce n'est pas une intention : `tests/unit/auth/amorcage-retrait.test.ts`
 * échoue dès qu'un appel à `signUpEmail` apparaît **hors de ce module, hors du
 * script, et hors des tests**. La porte se referme le jour où la porte
 * principale s'ouvre, et c'est la machine qui le constate.
 */

/** Ce que le geste rend — et ce qu'il ne rend pas. */
export type OuvertureAmorcage = {
  /** L'identité créée. */
  readonly utilisateurId: string;
  /** Le rôle accordé sur la société. */
  readonly role: Role;
  /**
   * L'URL de premier accès, à remettre HORS BANDE. Elle porte le jeton, à usage
   * unique et daté. Elle n'est relisible nulle part ensuite : ni en base sous
   * cette forme, ni dans un journal.
   */
  readonly urlPremierAcces: string;
  /** Nombre de sessions ouvertes par le geste et refermées par lui (D2). */
  readonly sessionsRefermees: number;
};

/** Ce que le geste refuse, avec le motif. */
export class RefusAmorcage extends Error {}

/**
 * Un mot de passe jetable, jamais rendu.
 *
 * 32 octets d'aléa cryptographique. Les trois caractères ajoutés satisfont les
 * exigences de forme que la bibliothèque pourrait poser sans réduire l'entropie.
 */
function motDePasseJetable(): string {
  return `${randomBytes(32).toString("base64url")}Aa1!`;
}

/**
 * Ouvre la PREMIÈRE identité d'une société et l'habilite.
 *
 * @param client client Prisma sous le rôle APPLICATIF. Le geste doit franchir
 *   les politiques comme la production les franchit : le passer sous le
 *   propriétaire prouverait un cloisonnement sous des privilèges que la
 *   production n'a pas.
 */
export async function ouvrirPremierCompte(
  client: PrismaClient,
  demande: {
    readonly societeId: string;
    readonly email: string;
    readonly nom: string;
    readonly role?: Role;
    /** Où le jeton de premier accès conduit. */
    readonly redirection?: string;
  },
): Promise<OuvertureAmorcage> {
  // UN POINT D'ENTRÉE OUVRE SON ÉCHANGE (D64). Ce geste en est un : la
  // bibliothèque lit une ligne par sa clé de désignation puis réécrit celle
  // qu'elle vient d'obtenir en la nommant par son `id`. Sans échange, le report
  // n'a rien à rendre et l'écriture est refusée EN SILENCE — zéro ligne, pas une
  // erreur. *Un point d'entrée qui oublie d'ouvrir un échange casse la
  // fonctionnalité, il n'ouvre jamais rien* : c'est le seul sens de défaillance
  // acceptable, et c'est celui qu'on a mesuré ici.
  return dansUnEchangeAuth(() =>
    ouvrir(client, demande, demande.role ?? Role.admin_societe),
  );
}

async function ouvrir(
  client: PrismaClient,
  demande: {
    readonly societeId: string;
    readonly email: string;
    readonly nom: string;
    readonly redirection?: string;
  },
  role: Role,
): Promise<OuvertureAmorcage> {
  // ── 1. LA SOCIÉTÉ EXISTE-T-ELLE, ET EST-ELLE VIERGE ? ────────────────────
  //
  // Les deux lectures se font sous `app.societe_id` : `societe` est de forme
  // « identité » (D42), elle ne se lit qu'en étant nommée. Ce n'est pas ce qui
  // GARDE le geste — la base le garde — c'est ce qui lui permet de refuser
  // LISIBLEMENT plutôt que de buter sur une politique.
  const etat = await avecSociete(client, demande.societeId, async (tx) => {
    const societe = await tx.societe.findUnique({
      where: { id: demande.societeId },
      select: { id: true, raison_sociale: true },
    });
    const habilitations = await tx.utilisateurSociete.count({
      where: { societe_id: demande.societeId },
    });
    return { societe, habilitations };
  });

  if (etat.societe === null) {
    throw new RefusAmorcage(
      `Aucune société ne porte l'identifiant ${demande.societeId}. ` +
        "Le geste d'amorçage nomme la société : il ne la cherche pas, et ne " +
        "la crée pas.",
    );
  }
  if (etat.habilitations > 0) {
    throw new RefusAmorcage(
      `La société « ${etat.societe.raison_sociale} » porte déjà des habilitations : le ` +
        "geste d'amorçage n'ouvre que la PREMIÈRE identité d'une société. " +
        "Les comptes suivants s'ouvrent par un administrateur de la société.",
    );
  }

  // ── 2. L'IDENTITÉ ─────────────────────────────────────────────────────────
  //
  // `role: null` — le geste ne s'attribue rien. C'est la branche d'amorçage de
  // `utilisateur_ouverture` qui l'admet, et elle exige que la société soit
  // vierge.
  const auth = creerAuth(client, { societeId: demande.societeId, role: null });

  const reponse = await auth.api.signUpEmail({
    body: {
      email: demande.email,
      password: motDePasseJetable(),
      name: demande.nom,
    },
    asResponse: true,
  });
  if (!reponse.ok) {
    throw new RefusAmorcage(
      `L'ouverture de l'identité a été refusée (${reponse.status}) : ` +
        `${await reponse.text()}`,
    );
  }

  // LA RELECTURE PASSE PAR LA DÉSIGNATION, ET C'EST MESURÉ. Sous un simple
  // contexte de société, `utilisateur_lecture` refuse : la branche
  // « rattachement » exige une habilitation, et l'identité n'en a pas encore.
  // Le geste NOMME donc la ligne par le courriel qu'il vient de saisir — la
  // forme « désignation », qui ne rend jamais plus que ce qu'on savait avant
  // d'interroger.
  const utilisateurId = await avecDesignationAuth(client)
    .utilisateur.findUnique({
      where: { email: demande.email },
      select: { id: true },
    })
    .then((u) => u?.id ?? null);
  if (utilisateurId === null) {
    throw new RefusAmorcage(
      "L'identité a été créée mais reste illisible : le geste s'arrête ici " +
        "plutôt que de poursuivre sur un état qu'il ne comprend pas.",
    );
  }

  // ── 2 bis. L'EMPREINTE DU MOT DE PASSE JETABLE EST UN MENSONGE DANS LA
  //          DONNÉE, ET ELLE EST EFFACÉE (10/09/2026, raison corrigée le
  //          11/09/2026) ────────────────────────────────────────────────────
  //
  // `signUpEmail` a rangé l'EMPREINTE du mot de passe jetable dans `compte`.
  // **Un compte qui n'a pas de mot de passe ne doit pas en porter un** : la
  // colonne affirme un fait qui est faux, et elle laisse derrière elle un
  // moyen de connexion que personne n'a choisi. L'effacer rend la donnée
  // VRAIE — c'est la seule raison, et elle se suffit.
  //
  // *La justification écrite la nuit du 10/09 était « pour rendre le fait
  // observable ». Elle est retirée :* modifier un état pour qu'un verrou
  // fonctionne est une mauvaise habitude même quand le résultat est bon.
  // **`mot_de_passe IS NULL` devient lisible EN CONSÉQUENCE de la
  // réparation, jamais l'inverse** — et c'est ce fait que la réémission lit :
  // aucun mot de passe n'existe tant que la personne n'en a pas choisi un, et
  // dès qu'elle l'a fait, l'état ne revient jamais.
  //
  // *Mesuré (11/09/2026, trois tentatives sur le chemin réel) :* une empreinte
  // nulle refuse une chaîne quelconque, la chaîne vide et la valeur nulle —
  // les deux premières sur `if (!currentPassword)`, la troisième sur la
  // validation d'entrée —, et aucune n'ouvre de session. Sous cette garde,
  // `verifyPassword` ne rend pas `false` sur une empreinte nulle : elle LÈVE.
  // Voir `tests/unit/auth/empreinte-nulle.test.ts`.
  //
  // Le décompte est une assertion : une modification qui ne toucherait pas
  // exactement une ligne laisserait une empreinte derrière elle, et le geste
  // s'arrête.
  const effacees = await avecDesignationAuth(client).compte.updateMany({
    where: { utilisateur_id: utilisateurId },
    data: { mot_de_passe: null },
  });
  if (effacees.count !== 1) {
    throw new RefusAmorcage(
      `L'empreinte du mot de passe jetable n'a pas été effacée (${effacees.count} ` +
        "ligne modifiée au lieu d'une) : le geste s'arrête plutôt que de laisser " +
        "un moyen de connexion que personne n'a choisi.",
    );
  }

  // ── 3. LA SESSION OUVERTE PAR `signUpEmail` EST REFERMÉE (D2) ────────────
  //
  // Par le chemin de la bibliothèque, avec le cookie qu'elle vient de poser :
  // c'est la fermeture réelle, pas une suppression de ligne qui lui
  // ressemblerait.
  const cookie = reponse.headers.get("set-cookie");
  let sessionsRefermees = 0;
  if (cookie !== null) {
    const enTetes = new Headers({ cookie: cookie.split(";")[0] ?? "" });
    await auth.api.signOut({ headers: enTetes });
    sessionsRefermees = 1;
  }

  // ── 4. L'HABILITATION — ET C'EST ELLE QUI REFERME LA PORTE ───────────────
  await avecSociete(client, demande.societeId, (tx) =>
    tx.utilisateurSociete.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        societe_id: demande.societeId,
        role,
      },
    }),
  );

  // ── 5. LE JETON DE PREMIER ACCÈS ─────────────────────────────────────────
  //
  // Émis par une instance QUI N'EST PAS CELLE DE PRODUCTION : elle seule porte
  // le canal de remise, et c'est ce canal qui rend `/request-password-reset`
  // disponible. La production ne l'a pas, donc personne ne peut faire émettre
  // un jeton depuis un navigateur (mesuré : `RESET_PASSWORD_DISABLED`).
  let url = "";
  const emetteur = creerAuth(
    client,
    { societeId: demande.societeId, role: null },
    async (remise) => {
      url = remise.url;
    },
  );
  await emetteur.api.requestPasswordReset({
    body: {
      email: demande.email,
      redirectTo: demande.redirection ?? "/premier-acces",
    },
  });
  if (url === "") {
    throw new RefusAmorcage(
      "Aucun jeton de premier accès n'a été émis : le compte existe mais " +
        "personne ne peut s'en servir. Le geste échoue plutôt que de rendre " +
        "une ouverture muette.",
    );
  }

  // ── 6. LA TRACE, ET ELLE EST UN ÉVÉNEMENT D'ACCÈS ────────────────────────
  //
  // `utilisateur` n'est PAS auditée — quatrième catégorie de I1, hors du
  // périmètre inversé de D55 — et elle ne peut pas l'être : `journal_audit` est
  // cloisonné par société et partitionné, quand une identité n'appartient à
  // aucune société. La trace est donc ÉCRITE par le geste, dans `journal_acces`.
  //
  // **L'auteur est le compte créé, et c'est la vérité de ce geste** : il n'y a
  // personne d'autre. `societe_id_cible` porte la société, `detail` le chemin.
  // La ligne se DÉSIGNE par son `utilisateur_id` : `journal_acces` porte la
  // forme « désignation » depuis L1-02d, et Prisma émet `INSERT … RETURNING`,
  // que PostgreSQL soumet à la politique de LECTURE.
  await avecDesignationAuth(client).journalAcces.create({
    data: {
      id: uuidv7(),
      utilisateur_id: utilisateurId,
      evenement: "ouverture_identite",
      societe_id_cible: demande.societeId,
      role,
      detail:
        "amorçage — première identité de la société, ouverte par le geste " +
        "d'amorçage (Q1 / D65) ; aucun compte n'était encore habilité.",
    },
  });

  return { utilisateurId, role, urlPremierAcces: url, sessionsRefermees };
}

/**
 * LA RÉÉMISSION DU JETON DE PREMIER ACCÈS (10/09/2026, complément de D65).
 *
 * ## L'enfermement, mesuré avant d'être réparé
 *
 * Le jeton de premier accès vit une heure. Deux scénarios existaient, chacun
 * de son côté, et personne ne les avait mis côte à côte : *le second appel du
 * geste sur la même société est refusé* et *l'instance de production n'émet
 * aucun jeton*. Ensemble : **jeton expiré ⇒ le compte existe, personne ne peut
 * lui donner de mot de passe, et rien ne peut en émettre un autre.** Le cliquet
 * qui protège l'ouverture condamnait l'issue de secours (§9, 08/09).
 *
 * ## LE CLIQUET, PLUS ÉTROIT QUE CELUI DE L'AMORÇAGE
 *
 * Ce geste ne regarde pas les habilitations de la société — elles existent, la
 * porte d'amorçage est déjà refermée. Il lit UN fait, sur la ligne de `compte`
 * de l'identité visée : **`mot_de_passe IS NULL`**. C'est l'état dans lequel
 * l'amorçage laisse le moyen de connexion, et la première réinitialisation par
 * jeton l'efface pour toujours. Il ne peut donc servir qu'une identité qui n'a
 * JAMAIS servi, et il se ferme au premier usage réel — la forme de D65,
 * appliquée à un cas plus étroit.
 *
 * *Pourquoi ce fait-là et pas un autre :* il est le seul qui soit à la fois
 * LISIBLE par le geste — `compte` se désigne par l'identifiant de l'utilisateur
 * — et IRRÉVERSIBLE par construction — aucun chemin du produit ne remet une
 * empreinte à `NULL`. Une trace du journal aurait fait d'une trace un verrou ;
 * une session aurait été effacée à son expiration ; l'horodatage de
 * modification aurait bougé pour d'autres raisons.
 *
 * ## Ce qu'il ne fait PAS
 *
 * Il n'ouvre aucune identité, ne touche à aucune habilitation, ne pose aucun
 * rôle, et **ne rouvre jamais le chemin d'ouverture** : `utilisateur_ouverture`
 * n'est pas lue ici. Il ne peut pas non plus INVALIDER un jeton précédent
 * encore vivant — `verification` ne se lit que par l'identifiant opaque qu'on
 * présente, et le geste ne l'a pas gardé. Un jeton réémis pendant l'heure du
 * premier laisse donc deux jetons valides jusqu'à l'expiration du premier ;
 * c'est écrit ici plutôt que tu, et la fenêtre est celle qui existait déjà.
 *
 * Comme l'ouverture, il ne laisse aucune session et trace dans `journal_acces`
 * — `reemission_premier_acces`, auteur l'identité elle-même, société cible.
 */

/** Ce que la réémission refuse, avec le motif. */
export class RefusReemission extends Error {}

/** Ce que la réémission rend. */
export type Reemission = {
  readonly utilisateurId: string;
  /** L'URL de premier accès, à remettre HORS BANDE. Imprimée une fois. */
  readonly urlPremierAcces: string;
};

/**
 * Réémet un jeton de premier accès pour une identité qui n'a jamais servi.
 *
 * @param client client Prisma sous le rôle APPLICATIF — même exigence que
 *   `ouvrirPremierCompte`, et pour la même raison.
 */
export async function reemettreJetonPremierAcces(
  client: PrismaClient,
  demande: {
    readonly societeId: string;
    readonly email: string;
    readonly redirection?: string;
  },
): Promise<Reemission> {
  return dansUnEchangeAuth(() => reemettre(client, demande));
}

async function reemettre(
  client: PrismaClient,
  demande: {
    readonly societeId: string;
    readonly email: string;
    readonly redirection?: string;
  },
): Promise<Reemission> {
  // ── 1. L'IDENTITÉ, DÉSIGNÉE PAR LE COURRIEL QU'ON VIENT DE SAISIR ───────
  const identite = await avecDesignationAuth(client).utilisateur.findUnique({
    where: { email: demande.email },
    select: { id: true },
  });
  if (identite === null) {
    throw new RefusReemission(
      `Aucune identité ne porte le courriel ${demande.email}. La réémission ` +
        "nomme une identité existante : elle n'en ouvre aucune.",
    );
  }

  // ── 2. LA SOCIÉTÉ EXISTE, ET L'IDENTITÉ Y EST HABILITÉE ──────────────────
  //
  // Lu sous le contexte de la société : c'est ce qui ancre le geste à une
  // société et ce qui permet de refuser LISIBLEMENT. Ce n'est pas le cliquet.
  const etat = await avecSociete(client, demande.societeId, async (tx) => {
    const societe = await tx.societe.findUnique({
      where: { id: demande.societeId },
      select: { raison_sociale: true },
    });
    const habilitations = await tx.utilisateurSociete.count({
      where: { societe_id: demande.societeId, utilisateur_id: identite.id },
    });
    return { societe, habilitations };
  });
  if (etat.societe === null) {
    throw new RefusReemission(
      `Aucune société ne porte l'identifiant ${demande.societeId}.`,
    );
  }
  if (etat.habilitations === 0) {
    throw new RefusReemission(
      `L'identité ${demande.email} n'est pas habilitée sur la société ` +
        `« ${etat.societe.raison_sociale} » : la réémission ne sert qu'une ` +
        "identité ouverte par le geste d'amorçage, sur SA société.",
    );
  }

  // ── 3. LE CLIQUET : AUCUN MOT DE PASSE N'EXISTE ──────────────────────────
  const compte = await avecDesignationAuth(client).compte.findFirst({
    where: { utilisateur_id: identite.id },
    select: { mot_de_passe: true },
  });
  if (compte === null) {
    throw new RefusReemission(
      `L'identité ${demande.email} ne porte aucun moyen de connexion : ce ` +
        "n'est pas l'état que le geste d'amorçage laisse, et la réémission " +
        "s'arrête plutôt que de poursuivre sur un état qu'elle ne comprend pas.",
    );
  }
  if (compte.mot_de_passe !== null) {
    throw new RefusReemission(
      `L'identité ${demande.email} porte déjà un mot de passe : elle a servi ` +
        "au moins une fois, et la réémission est FERMÉE pour toujours. Un mot " +
        "de passe oublié se traite par le chemin ordinaire, jamais par ce geste.",
    );
  }

  // ── 4. LE JETON, PAR UNE INSTANCE QUI N'EST PAS CELLE DE PRODUCTION ─────
  let url = "";
  const emetteur = creerAuth(
    client,
    { societeId: demande.societeId, role: null },
    async (remise) => {
      url = remise.url;
    },
  );
  await emetteur.api.requestPasswordReset({
    body: {
      email: demande.email,
      redirectTo: demande.redirection ?? "/premier-acces",
    },
  });
  if (url === "") {
    throw new RefusReemission(
      "Aucun jeton de premier accès n'a été réémis : le geste échoue plutôt " +
        "que de rendre une réémission muette.",
    );
  }

  // ── 5. LA TRACE — UN ÉVÉNEMENT D'ACCÈS, COMME L'OUVERTURE ───────────────
  await avecDesignationAuth(client).journalAcces.create({
    data: {
      id: uuidv7(),
      utilisateur_id: identite.id,
      evenement: "reemission_premier_acces",
      societe_id_cible: demande.societeId,
      detail:
        "réémission du jeton de premier accès — l'identité n'avait jamais " +
        "servi (aucun mot de passe), le jeton précédent est présumé expiré ou " +
        "perdu ; geste d'exploitation, complément de D65.",
    },
  });

  return { utilisateurId: identite.id, urlPremierAcces: url };
}
