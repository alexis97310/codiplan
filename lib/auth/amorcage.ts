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
