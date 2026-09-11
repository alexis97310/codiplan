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

/**
 * LES PÉRIODES VALIDÉES D'UN TECHNICIEN, FUSIONNÉES ET BORNÉES À UNE FENÊTRE
 * (L3-17).
 *
 * ## Pourquoi FUSIONNÉES, et pourquoi c'est le cœur de la fonction
 *
 * Le taux d'occupation retranche ces périodes de son dénominateur — *un
 * technicien absent toute la semaine a un dénominateur nul, pas une semaine
 * pleine qu'il n'aurait « pas remplie ».* Retrancher **sans fusionner** est la
 * faute qui se commet ici :
 *
 * > Un congé du 14 au 18 prolongé par un arrêt du 16 au 20 est un état que rien
 * > n'interdit, et c'est même le cas ordinaire. Retranchées séparément, les
 * > journées des 16, 17 et 18 sont **comptées deux fois**, et le dénominateur
 * > peut devenir NÉGATIF — c'est-à-dire un taux d'occupation supérieur à 100 %,
 * > ou un signe moins sur un écran de direction.
 *
 * La fusion n'est donc pas une optimisation : *c'est ce qui rend la
 * soustraction juste.*
 *
 * ## Elles sont BORNÉES à la fenêtre
 *
 * Une absence d'un mois ne retranche que ce qu'elle recouvre de la semaine
 * affichée. Sans cette borne, une absence longue viderait le dénominateur de
 * semaines qu'elle ne touche pas.
 *
 * ## Et « validée » est la seule qui compte
 *
 * Même règle qu'`absenceCouvrant`, et pour la même raison : une demandée n'est
 * pas tranchée, une refusée ne l'est plus. *Retrancher une demande en attente
 * ferait baisser un dénominateur qu'un refus rétablirait le lendemain, sans que
 * personne comprenne pourquoi le taux a bougé.*
 */
export function periodesValidees(
  absences: readonly AbsenceDeclaree[],
  technicienId: string | null,
  fenetre: { readonly du: Date; readonly au: Date },
): readonly { readonly du: Date; readonly au: Date }[] {
  if (technicienId === null) {
    // La file d'attente n'appartient à personne : il n'y a pas d'absence à
    // retrancher d'un dénominateur qui n'existe pas.
    return [];
  }
  const debutFenetre = jour(fenetre.du);
  const finFenetre = jour(fenetre.au);

  const bornees = absences
    .filter(
      (absence) =>
        absence.utilisateur_id === technicienId &&
        absence.statut === BLOQUANT &&
        jour(absence.du) <= finFenetre &&
        jour(absence.au) >= debutFenetre,
    )
    .map((absence) => ({
      du: Math.max(jour(absence.du), debutFenetre),
      au: Math.min(jour(absence.au), finFenetre),
    }))
    .sort((a, b) => a.du - b.du);

  // LA FUSION. Deux périodes se rejoignent si elles se recouvrent **ou si elles
  // se touchent d'un jour à l'autre** : du 14 au 15 et du 16 au 18 forment une
  // seule absence du 14 au 18, et les traiter séparément n'est pas faux — mais
  // la borne « se touchent » évite de dépendre de la façon dont l'absence a été
  // saisie, ce qui est exactement ce qu'on ne veut pas voir dans un chiffre.
  const fusionnees: { du: number; au: number }[] = [];
  for (const periode of bornees) {
    const derniere = fusionnees[fusionnees.length - 1];
    if (derniere !== undefined && periode.du <= derniere.au + UN_JOUR_MS) {
      derniere.au = Math.max(derniere.au, periode.au);
    } else {
      fusionnees.push({ ...periode });
    }
  }

  return fusionnees.map((periode) => ({
    du: new Date(periode.du),
    // **La borne HAUTE est la FIN du dernier jour**, et c'est la moitié qu'on
    // oublie : les bornes d'une absence sont comprises, si bien qu'une absence
    // « du 14 au 14 » couvre la journée entière du 14 et non son instant zéro.
    au: new Date(periode.au + UN_JOUR_MS),
  }));
}

const UN_JOUR_MS = 24 * 60 * 60 * 1000;
