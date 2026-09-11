/**
 * RG-PLA-06 — UNE ABSENCE VALIDÉE BLOQUE LE CRÉNEAU (L3-04).
 *
 * > *« Une absence validée bloque le créneau ; les interventions posées
 * > repassent en file à planifier avec alerte. Tant que l'effectif est d'un
 * > seul technicien, l'absence déclenche une alerte de rupture de service et
 * > propose le report groupé. »*
 *
 * ## Ce module DÉCIDE, il n'écrit rien et ne lit aucune base
 *
 * Même coupure que `lib/interventions/pose.ts` et
 * `lib/habilitations/affectation.ts`, et pour la même raison : la règle se
 * relit sans base sous la main, et elle s'éprouve sur des tableaux.
 *
 * ## « VALIDÉE » EST LA MOITIÉ QUI COMPTE
 *
 * Une absence **demandée** ne bloque rien — la personne travaille encore,
 * l'arbitrage n'a pas eu lieu. Une absence **refusée** non plus. *Un booléen
 * `validee` n'aurait pas su dire la différence entre les deux dernières*, et le
 * planning aurait bloqué sur une demande qu'on venait de refuser.
 *
 * ## LES BORNES SONT COMPRISES, TOUTES LES DEUX
 *
 * « du 14 au 28 » veut dire que le 14 et le 28 sont absents. *Une borne
 * ouverte aurait fait travailler quelqu'un le dernier jour de son arrêt* —
 * c'est la faute qu'on ne voit qu'en production, sur une seule journée, et
 * qu'on met un mois à croire.
 *
 * ## AUCUNE HEURE NE SE LIT ICI
 *
 * La date de l'intervention est un PARAMÈTRE, jamais `new Date()`. Lue ici,
 * elle rendrait un test vert parce que l'horloge a bougé (§9, D85 sur le
 * cloisonnement, et L0-08 sur le fuseau).
 */

/** Une absence telle que la base la rend — la période et son état. */
export type AbsenceDeclaree = {
  readonly id: string;
  readonly utilisateur_id: string;
  /** Première journée d'absence, COMPRISE. */
  readonly du: Date;
  /** Dernière journée d'absence, COMPRISE. */
  readonly au: Date;
  readonly statut: string;
};

/** Le seul statut qui bloque. Les deux autres laissent travailler. */
const BLOQUANT = "validee";

/** Le jour civil d'un instant, en UTC — les colonnes sont de type `DATE`. */
function jour(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * L'absence VALIDÉE qui couvre ce jour-là, ou `null`.
 *
 * Elle rend **l'absence** et non un booléen : l'appelant doit pouvoir dire
 * laquelle, et depuis quand. *Un refus a le droit d'être lisible* (D50) — il
 * n'a pas le droit d'être informatif, et c'est l'appelant qui en décide, pas
 * cette fonction.
 *
 * **La PREMIÈRE qui couvre**, dans l'ordre reçu : deux absences validées qui se
 * recouvrent sont un état que rien n'interdit — un congé prolongé par un arrêt
 * en est un —, et il n'y a rien à arbitrer entre elles. Elles bloquent toutes
 * les deux.
 */
export function absenceCouvrant(
  absences: readonly AbsenceDeclaree[],
  technicienId: string,
  dateIntervention: Date,
): AbsenceDeclaree | null {
  const vise = jour(dateIntervention);
  return (
    absences.find(
      (absence) =>
        absence.utilisateur_id === technicienId &&
        absence.statut === BLOQUANT &&
        jour(absence.du) <= vise &&
        vise <= jour(absence.au),
    ) ?? null
  );
}

/**
 * LES INTERVENTIONS QU'UNE ABSENCE VALIDÉE REND À LA FILE (RG-PLA-06).
 *
 * *« Les interventions posées repassent en file à planifier avec alerte. »*
 *
 * **Elle ne décide pas du statut** — c'est `cycle-de-vie.ts` qui sait ce qu'une
 * intervention accepte —, et elle ne décide pas non plus de l'alerte. Elle dit
 * **lesquelles sont touchées**, et c'est tout ce qu'une règle peut dire sans
 * lire une base.
 *
 * **Les interventions SANS date ne sont jamais touchées** : elles sont déjà
 * dans la file. Et celles qui n'occupent plus rien non plus — une intervention
 * annulée n'a pas de créneau à libérer. *Une clôturée, en revanche, A EU LIEU* :
 * la déplanifier effacerait un fait, et c'est la préséance de I5 lue à
 * l'envers. Elle est donc ÉCARTÉE elle aussi, et ce n'est pas le même motif —
 * l'une n'a rien à rendre, l'autre a quelque chose à protéger.
 */
export function interventionsADeplanifier(
  posees: readonly {
    readonly id: string;
    readonly technicien_id: string | null;
    readonly date_planifiee: Date | null;
    readonly statut: string;
  }[],
  absence: AbsenceDeclaree,
): readonly string[] {
  const du = jour(absence.du);
  const au = jour(absence.au);
  return posees
    .filter((ligne) => {
      if (ligne.technicien_id !== absence.utilisateur_id) return false;
      if (ligne.date_planifiee === null) return false;
      if (INTOUCHABLES.has(ligne.statut)) return false;
      const vise = jour(ligne.date_planifiee);
      return du <= vise && vise <= au;
    })
    .map((ligne) => ligne.id);
}

/**
 * CE QU'UNE ABSENCE NE DÉPLANIFIE PAS, et les motifs ne sont pas les mêmes.
 *
 * `annulee` n'occupe rien — il n'y a pas de créneau à rendre. `cloturee` et
 * `terminee` ONT EU LIEU — les rendre à la file effacerait un fait, et le
 * travail terrain n'est jamais perdu (I5). `en_cours` est en train d'avoir
 * lieu : la personne est là, quoi qu'en dise une absence saisie après coup.
 */
const INTOUCHABLES = new Set(["annulee", "cloturee", "terminee", "en_cours"]);
