/**
 * RG-PLA-06 — UN BLOCAGE D'AGENDA BLOQUE LE CRÉNEAU (L3-04, R3-14).
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
 * ## IL N'Y A PLUS D'ÉTAT À LIRE — seulement une PÉRIODE (R3-14, 14/09/2026)
 *
 * La règle citée dit « validée » parce que la table portait un statut :
 * `demandee`, `validee`, `refusee`. **CODIPLAN n'étant pas un outil de gestion
 * des ressources humaines, ce circuit d'approbation a été retiré** — il ne
 * reste qu'une personne et deux dates, et **toute ligne bloque**.
 *
 * *C'est ce qui rend ce module plus sûr qu'avant, et pas seulement plus
 * court* : un critère à deux termes — la personne ET l'état — se recopiait
 * dans chaque lecteur, et une recopie qui oublie le second terme OUVRE en
 * silence. Il n'y a plus de second terme à oublier.
 *
 * ## LES BORNES SONT COMPRISES, TOUTES LES DEUX
 *
 * « du 14 au 28 » veut dire que le 14 et le 28 sont bloqués. *Une borne
 * ouverte aurait fait travailler quelqu'un le dernier jour de son
 * indisponibilité* — c'est la faute qu'on ne voit qu'en production, sur une
 * seule journée, et qu'on met un mois à croire.
 *
 * ## AUCUNE HEURE NE SE LIT ICI
 *
 * La date de l'intervention est un PARAMÈTRE, jamais `new Date()`. Lue ici,
 * elle rendrait un test vert parce que l'horloge a bougé (§9, D85 sur le
 * cloisonnement, et L0-08 sur le fuseau).
 */

/**
 * Un blocage d'agenda tel que la base le rend — une personne et une période.
 *
 * **Il n'y a pas d'état** : la ligne existe, donc elle bloque. Voir l'entête.
 */
export type AbsenceDeclaree = {
  readonly id: string;
  readonly utilisateur_id: string;
  /** Première journée bloquée, COMPRISE. */
  readonly du: Date;
  /** Dernière journée bloquée, COMPRISE. */
  readonly au: Date;
};

/** Le jour civil d'un instant, en UTC — les colonnes sont de type `DATE`. */
function jour(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * LE BLOCAGE D'AGENDA qui couvre ce jour-là, ou `null`.
 *
 * Elle rend **l'absence** et non un booléen : l'appelant doit pouvoir dire
 * laquelle, et depuis quand. *Un refus a le droit d'être lisible* (D50) — il
 * n'a pas le droit d'être informatif, et c'est l'appelant qui en décide, pas
 * cette fonction.
 *
 * **LE PREMIER qui couvre**, dans l'ordre reçu : deux blocages qui se recouvrent
 * sont un état que rien n'interdit — une semaine posée, puis prolongée d'une
 * seconde ligne —, et il n'y a rien à arbitrer entre eux. Ils bloquent tous les
 * deux.
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
        jour(absence.du) <= vise &&
        vise <= jour(absence.au),
    ) ?? null
  );
}

/**
 * LES INTERVENTIONS QU'UN BLOCAGE D'AGENDA REND À LA FILE (RG-PLA-06).
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
 * CE QU'UN BLOCAGE NE DÉPLANIFIE PAS, et les motifs ne sont pas les mêmes.
 *
 * `annulee` n'occupe rien — il n'y a pas de créneau à rendre. `cloturee` et
 * `terminee` ONT EU LIEU — les rendre à la file effacerait un fait, et le
 * travail terrain n'est jamais perdu (I5). `en_cours` est en train d'avoir
 * lieu : la personne est là, quoi qu'en dise un blocage saisi après coup.
 */
const INTOUCHABLES = new Set(["annulee", "cloturee", "terminee", "en_cours"]);

/**
 * LES PÉRIODES BLOQUÉES D'UN TECHNICIEN, FUSIONNÉES ET BORNÉES À UNE FENÊTRE
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
 * ## Et TOUTE ligne compte, depuis R3-14
 *
 * Le statut a disparu avec le circuit d'approbation : *il n'y a plus de
 * blocage qui ne bloque pas encore.* Ce que cette fonction retranchait sous
 * condition, elle le retranche désormais sans — et le nom le dit, sans quoi
 * `periodesValidees` aurait survécu à la validation qu'il nommait.
 */
export function periodesBloquees(
  absences: readonly AbsenceDeclaree[],
  technicienId: string | null,
  fenetre: { readonly du: Date; readonly au: Date },
): readonly { readonly du: Date; readonly au: Date }[] {
  if (technicienId === null) {
    // La file d'attente n'appartient à personne : il n'y a pas de blocage à
    // retrancher d'un dénominateur qui n'existe pas.
    return [];
  }
  const debutFenetre = jour(fenetre.du);
  const finFenetre = jour(fenetre.au);

  const bornees = absences
    .filter(
      (absence) =>
        absence.utilisateur_id === technicienId &&
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
