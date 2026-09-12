/**
 * LA PRODUCTION DÉPLOYÉE EST-ELLE DEBOUT ? — le verdict, sans réseau (R3-01).
 *
 * ## La panne que ce module existe pour empêcher, et elle a eu lieu TROIS fois
 *
 * *Mesuré les 11 et 12/09/2026.* Un commit porte sur `main` du code qui lit une
 * colonne créée par une migration **non appliquée** à la base déployée. Le code
 * est juste, les tests sont justes, `pnpm verify:full` est vert — et l'écran
 * rend une exception serveur. **Les deux portes ne gardent pas le même monde** :
 * `verify:full` tourne contre une base FRAÎCHEMENT migrée, la production contre
 * une base migrée à un autre moment (§9, 11/09).
 *
 * La première fois, la panne a duré **4 h 03 min** et personne ne l'a su. La
 * troisième, `/sante` nommait la cause en une ligne — *et personne ne l'avait
 * ouverte.* **Une sonde que personne n'ouvre ne sonne pas** : ce module est ce
 * qui l'ouvre, après chaque déploiement.
 *
 * ## CE QU'IL MESURE, ET SON LIBELLÉ NE PROMET PAS PLUS
 *
 * *Un contrôle dont le libellé pose une question plus large que sa mesure est un
 * contrôle faux* (§9, 11/09). Celui-ci répond à **une** question : *l'application
 * déployée répond-elle, et la base qu'elle interroge porte-t-elle les migrations
 * que le code déployé attend ?* Il ne dit rien de la justesse d'un écran, rien
 * d'un défaut de rendu, rien d'une lenteur.
 *
 * ## NEUF VERDICTS, ET JAMAIS TROIS
 *
 * Les confondre ferait conclure faux, et chacun se corrige ailleurs :
 *
 * | Verdict | Ce qui s'est passé | Qui corrige, et comment |
 * |---|---|---|
 * | `sain` | tout répond, et c'est bien le commit voulu | personne |
 * | `migration_manquante` | l'application répond, la base est EN RETARD | **le geste nommé** : flux « DB migrate & seed » |
 * | `base_injoignable` | l'application répond et dit qu'elle ne joint pas sa base | exploitation — l'hébergeur, un réveil, un secret |
 * | `role_inattendu` | elle se connecte, mais PAS sous le rôle applicatif | exploitation — le secret `DATABASE_URL` |
 * | `application_muette` | rien n'a répondu du tout | exploitation — le déploiement lui-même |
 * | `reponse_illisible` | quelque chose a répondu, mais pas le contrat attendu | **le dépôt** : la route et ce module ont divergé |
 * | `adresse_absente` | on ne sait pas QUOI interroger | exploitation — la variable `URL_PRODUCTION` |
 * | `deploiement_en_retard` | c'est encore le code d'AVANT qui répond | attendre le déploiement, puis relancer |
 * | `commit_inconnu` | la réponse ne dit pas quel code elle porte | **le dépôt** ou l'hébergeur — voir plus bas |
 *
 * **`reponse_illisible` n'est PAS rangé avec « injoignable ».** Une réponse
 * qu'on ne sait plus lire est un défaut de CE dépôt, pas un incident
 * d'exploitation : la ranger sous l'injoignable enverrait chercher chez
 * l'hébergeur une divergence de contrat. *C'est la leçon du gabarit d'alarme
 * (§9, 10/09) — un contrôle ne nomme une cause que s'il l'a mesurée.*
 *
 * ## LES DEUX DERNIERS SONT LE TÉMOIN DE NON-VACUITÉ, ET C'EST LEUR RAISON D'ÊTRE
 *
 * **Un contrôle lancé juste après une fusion mesure, par défaut, LE CODE
 * D'AVANT.** Le déploiement met une minute ou deux ; pendant ce temps l'ancienne
 * version répond, et elle répond *sain* — sa base lui suffit. Le contrôle
 * aurait donc été **vert précisément dans la fenêtre où la panne naît**, et
 * personne n'aurait pu le savoir : *un décompte nul ressemble toujours à un
 * sans-faute* (§9, 30/08).
 *
 * La réponse porte donc le **commit déployé**, et le contrôle refuse de conclure
 * tant que ce n'est pas celui qu'on voulait mesurer. `deploiement_en_retard`
 * dit *« ce n'est pas encore lui »* ; `commit_inconnu` dit *« elle ne me dit pas
 * lequel »*. Les deux valent **75** — on n'a rien constaté —, jamais 0 : *la
 * question à poser à tout vert inattendu n'est pas « le système est meilleur que
 * je croyais » mais « je n'ai pas mesuré ce que je crois »* (§9, 07/09).
 *
 * ## LES CODES DE SORTIE SUIVENT LA CONVENTION DE `pnpm veille`
 *
 * **75 quand on n'a rien pu constater, 1 quand on a constaté un écart.** Les
 * mêler apprendrait à ne lire ni l'un ni l'autre, et c'est déjà écrit au §4 du
 * CLAUDE.md pour la veille nocturne : une même distinction se dit avec les mêmes
 * chiffres, ou ce sont deux conventions qui divergeront.
 *
 * ## AUCUN RÉSEAU ICI
 *
 * Ce module reçoit un texte et rend un verdict. *Le réseau vit dans le
 * lanceur* — c'est ce qui rend le verdict éprouvable sans déployer quoi que ce
 * soit, y compris sur la réponse exacte qu'a rendue la production le 12/09.
 */

/** Ce que le contrôle conclut, et il n'y a pas de dixième branche. */
export type NatureVerdict =
  | "sain"
  | "migration_manquante"
  | "base_injoignable"
  | "role_inattendu"
  | "application_muette"
  | "reponse_illisible"
  | "adresse_absente"
  | "deploiement_en_retard"
  | "commit_inconnu";

export type VerdictDeploiement = {
  readonly nature: NatureVerdict;
  /** Une phrase lue par un HUMAIN dans un journal de CI — jamais à l'écran. */
  readonly detail: string;
  /** Le geste qui corrige, ou `null` quand il n'y a rien à faire. */
  readonly geste: string | null;
};

/**
 * LE CODE DE SORTIE PAR NATURE.
 *
 * `75` est réservé à *« je n'ai rien pu constater »* ; tout autre rouge est un
 * écart constaté. `reponse_illisible` vaut donc 1 : quelque chose a répondu, et
 * ce qu'il a répondu contredit le contrat que ce dépôt écrit. `adresse_absente`
 * vaut 1 aussi, et ce n'est pas un détail : une adresse qui manque ne se
 * répare pas en attendant — *un 75 inviterait à relancer, et relancer ne pose
 * aucune variable.*
 */
export const CODE_DE_SORTIE: Readonly<Record<NatureVerdict, number>> = {
  sain: 0,
  migration_manquante: 1,
  reponse_illisible: 1,
  adresse_absente: 1,
  role_inattendu: 1,
  base_injoignable: 75,
  application_muette: 75,
  deploiement_en_retard: 75,
  commit_inconnu: 75,
};

/**
 * LES NATURES QU'IL VAUT LA PEINE DE RÉESSAYER, et elles seules.
 *
 * Une base suspendue se réveille, un déploiement s'achève, une application qui
 * démarre finit par répondre. **Rien d'autre ne s'améliore en attendant** : une
 * migration manquante restera manquante, une adresse absente aussi, et un
 * contrat divergent n'a jamais convergé tout seul. *Réessayer ce qui ne peut
 * pas changer est la façon la plus sûre de transformer un rouge franc en
 * attente.*
 */
export const NATURES_A_REESSAYER: readonly NatureVerdict[] = [
  "application_muette",
  "base_injoignable",
  "deploiement_en_retard",
];

/** Le geste nommé, champ par champ — il n'est PAS joué par la CI (R3-01). */
export const GESTE_MIGRATION =
  "Actions → « DB migrate & seed » → Run workflow — " +
  "Use workflow from : main · Quelle base ? : demonstration · " +
  "Purger les données de démonstration : décoché. " +
  "Une migration jouée sans qu'on la regarde est la panne suivante.";

const GESTE_EXPLOITATION =
  "Rien à migrer : ouvrir /sante dans un navigateur et, si la page ne " +
  "répond pas davantage, regarder le déploiement et l'hébergeur de la base.";

/**
 * LE RÔLE EST UN VERDICT À PART, et c'est le cloisonnement qui l'exige.
 *
 * Une application connectée sous le rôle de MIGRATION contourne les politiques
 * RLS par nature (I1) : tout le cloisonnement tombe, et rien à l'écran ne le
 * dirait. *Le ranger sous « la base ne répond pas » enverrait chercher un
 * incident de liaison là où il y a une clé passe-partout en production.*
 */
const GESTE_ROLE =
  "Le secret DATABASE_URL du déploiement ne porte pas le rôle applicatif. " +
  "Tant qu'il en est ainsi, l'application contourne les politiques de " +
  "cloisonnement : reposer le secret avec le rôle `codiplan_app`, jamais " +
  "celui des migrations (I1, et l'interdit absolu du §5 du CLAUDE.md).";

const GESTE_CONTRAT =
  "La route /api/sante et scripts/lib/verdict-deploiement.ts ont divergé. " +
  "C'est un défaut du dépôt : relire les deux, et le gardien qui les confronte.";

const GESTE_ADRESSE =
  "Settings → Secrets and variables → Actions → Variables → " +
  "URL_PRODUCTION = l'adresse publique du déploiement, sans barre finale. " +
  "Ce n'est pas un secret : une adresse publique se lit dans un navigateur.";

const GESTE_ATTENDRE =
  "Le déploiement n'a pas encore publié ce commit. Attendre qu'il se termine, " +
  "puis relancer ce flux (Actions → CI → Run workflow). " +
  "Ce contrôle n'affirme RIEN tant qu'il n'a pas mesuré le bon code.";

const GESTE_COMMIT =
  "La réponse ne dit pas quel commit est déployé. Soit l'hébergeur ne " +
  "renseigne plus la variable d'environnement du commit, soit la route a " +
  "changé : sans elle, ce contrôle ne peut pas distinguer le code déployé de " +
  "celui d'avant, et il refuse de rendre un vert qu'il n'a pas mesuré.";

/** La forme que la route `/api/sante` promet — et rien de plus. */
type Reponse = {
  readonly baseJointe?: { readonly ok?: unknown; readonly detail?: unknown };
  readonly roleApplicatif?: {
    readonly ok?: unknown;
    readonly detail?: unknown;
  };
  readonly migrations?: { readonly ok?: unknown; readonly detail?: unknown };
  readonly commit?: unknown;
};

/** Ce que le lanceur a pu obtenir du monde extérieur, et rien de plus. */
export type Observation = {
  /** L'adresse interrogée, ou `null` quand rien n'était configuré. */
  readonly adresse: string | null;
  /** Le corps de la réponse, ou `null` quand rien n'a répondu. */
  readonly corps: string | null;
  /**
   * Le commit que l'on VOULAIT mesurer, ou `null` quand il n'y en a pas —
   * une exécution planifiée ne vise aucun commit en particulier, elle demande
   * si ce qui est en ligne va bien.
   */
  readonly commitAttendu: string | null;
};

function estBooleen(valeur: unknown): valeur is boolean {
  return typeof valeur === "boolean";
}

/**
 * LE VERDICT, depuis ce que le lanceur a observé.
 *
 * **L'ORDRE DES BRANCHES EST UNE DÉCISION**, et chacune de ses marches se lit :
 *
 * 1. **l'adresse** — sans elle, on n'a rien interrogé, et tout le reste serait
 *    un verdict sur le vide ;
 * 2. **le silence** — rien n'a répondu : ce contrôle ne dit alors RIEN de la
 *    base, il dit qu'il n'a pas pu regarder ;
 * 3. **le contrat** — une réponse qu'on ne sait pas lire est jugée AVANT tout le
 *    reste : sans cela, une réponse vide ou tronquée se lirait « toutes les
 *    réponses sont absentes, donc rien ne va », ce qui est vrai par accident et
 *    faux par construction ;
 * 4. **le commit** — on refuse de conclure sur un code qui n'est pas celui
 *    qu'on voulait mesurer, et c'est ce qui empêche le vert de complaisance
 *    dans la fenêtre même où la panne naît ;
 * 5. **la base** — sans base jointe, le verdict des migrations ne repose sur
 *    rien ;
 * 6. **les migrations** — enfin.
 */
export function verdictDuDeploiement(
  observation: Observation,
): VerdictDeploiement {
  const { adresse, corps, commitAttendu } = observation;

  if (adresse === null || adresse.trim().length === 0) {
    return {
      nature: "adresse_absente",
      detail:
        "Aucune adresse à interroger : la variable `URL_PRODUCTION` est vide. " +
        "Ce contrôle n'a rien mesuré, et il ne se tait pas pour autant — " +
        "un contrôle qui saute en silence est le contrôle qu'on croit avoir.",
      geste: GESTE_ADRESSE,
    };
  }

  if (corps === null) {
    return {
      nature: "application_muette",
      detail:
        "L'application déployée n'a rien répondu. Ce contrôle ne dit donc " +
        "RIEN de l'état de la base : il dit qu'il n'a pas pu regarder.",
      geste: GESTE_EXPLOITATION,
    };
  }

  let lu: Reponse;
  try {
    lu = JSON.parse(corps) as Reponse;
  } catch {
    return {
      nature: "reponse_illisible",
      detail: `La réponse n'est pas du JSON : ${apercu(corps)}`,
      geste: GESTE_CONTRAT,
    };
  }

  // Le contrat se vérifie sur sa FORME avant d'être cru. Une clé absente n'est
  // pas « false » : c'est une route qui ne rend plus ce qu'on lui demandait.
  if (
    lu === null ||
    typeof lu !== "object" ||
    !estBooleen(lu.baseJointe?.ok) ||
    !estBooleen(lu.roleApplicatif?.ok) ||
    !estBooleen(lu.migrations?.ok)
  ) {
    return {
      nature: "reponse_illisible",
      detail:
        "La réponse ne porte pas les deux verdicts attendus " +
        "(`baseJointe.ok`, `roleApplicatif.ok` et `migrations.ok`) : " +
        apercu(corps),
      geste: GESTE_CONTRAT,
    };
  }

  // ── LE TÉMOIN : A-T-ON MESURÉ LE CODE QU'ON VOULAIT MESURER ? ────────────
  //
  // Il vient AVANT les deux verdicts, et c'est tout son objet. L'ancienne
  // version répond « tout va bien » en toute sincérité — sa base lui suffit —,
  // si bien qu'un contrôle sans ce témoin serait vert pendant la minute où la
  // panne se crée, et vert pour une raison qu'il n'aurait pas mesurée.
  if (commitAttendu !== null && commitAttendu.trim().length > 0) {
    const deploye = typeof lu.commit === "string" ? lu.commit.trim() : "";
    if (deploye.length === 0) {
      return {
        nature: "commit_inconnu",
        detail:
          "La réponse ne nomme aucun commit déployé : ce contrôle ne peut " +
          "pas affirmer avoir mesuré le code de " +
          `${court(commitAttendu)}, et il ne rend donc pas un vert.`,
        geste: GESTE_COMMIT,
      };
    }
    if (!memeCommit(deploye, commitAttendu)) {
      return {
        nature: "deploiement_en_retard",
        detail:
          `L'application déployée porte ${court(deploye)}, et ce contrôle ` +
          `visait ${court(commitAttendu)}. C'est encore le code d'AVANT qui ` +
          "répond : tout verdict rendu ici parlerait de lui.",
        geste: GESTE_ATTENDRE,
      };
    }
  }

  if (!lu.baseJointe.ok) {
    return {
      nature: "base_injoignable",
      detail:
        "L'application répond, et elle ne joint pas sa base" +
        suffixe(lu.baseJointe.detail),
      geste: GESTE_EXPLOITATION,
    };
  }

  // LE RÔLE AVANT LES MIGRATIONS, et l'ordre porte le sens : sous un rôle
  // privilégié, tout ce qui suit est mesuré par une identité qui voit tout.
  if (!lu.roleApplicatif.ok) {
    return {
      nature: "role_inattendu",
      detail:
        "L'APPLICATION DÉPLOYÉE NE SE CONNECTE PAS SOUS LE RÔLE APPLICATIF" +
        suffixe(lu.roleApplicatif.detail),
      geste: GESTE_ROLE,
    };
  }

  if (!lu.migrations.ok) {
    return {
      nature: "migration_manquante",
      detail:
        "LA BASE DÉPLOYÉE EST EN RETARD SUR LE CODE DÉPLOYÉ" +
        suffixe(lu.migrations.detail),
      geste: GESTE_MIGRATION,
    };
  }

  return {
    nature: "sain",
    detail:
      "L'application déployée répond, sa base est jointe, et les migrations " +
      "que le code attend sont appliquées" +
      (commitAttendu === null || commitAttendu.trim().length === 0
        ? ". Aucun commit n'était visé : ce verdict porte sur ce qui est en " +
          "ligne, pas sur une fusion en particulier."
        : ` — mesuré sur ${court(commitAttendu)}.`),
    geste: null,
  };
}

/**
 * Deux empreintes désignent-elles le même commit ?
 *
 * **La comparaison est par PRÉFIXE, et dans les deux sens.** Un hébergeur peut
 * ne renseigner que les sept ou douze premiers caractères ; exiger l'égalité
 * stricte ferait alors répondre `deploiement_en_retard` pour toujours — *un
 * contrôle qui crie sans cesse à tort désapprend à lire les contrôles* (§9,
 * 11/09). Une borne de longueur empêche qu'un préfixe trop court fasse
 * coïncider n'importe quoi.
 */
function memeCommit(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  const commun = Math.min(x.length, y.length);
  if (commun < 7) return false;
  return x.slice(0, commun) === y.slice(0, commun);
}

/** Les sept premiers caractères — la forme qu'un humain lit dans un journal. */
function court(empreinte: string): string {
  return `\`${empreinte.trim().slice(0, 7)}\``;
}

/** Le détail de la sonde, recopié tel quel — elle a déjà retiré tout secret (D50). */
function suffixe(detail: unknown): string {
  return typeof detail === "string" && detail.trim().length > 0
    ? ` — ${detail.trim()}`
    : ".";
}

/**
 * Un aperçu BORNÉ de ce qui a répondu.
 *
 * Borné parce qu'une page d'erreur d'hébergeur fait des kilo-octets, et qu'un
 * journal de CI illisible ne sert personne. *Et il est rendu tel quel, sans
 * interprétation* : deviner ce qu'une réponse inconnue voulait dire est
 * exactement la façon de nommer une cause qu'on n'a pas mesurée.
 */
function apercu(corps: string): string {
  const propre = corps.replace(/\s+/g, " ").trim();
  return propre.length <= 200 ? propre : `${propre.slice(0, 200)}…`;
}
