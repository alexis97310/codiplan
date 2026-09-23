import type { StatutIntervention } from "./saisie";

/**
 * LE CYCLE DE VIE D'UNE INTERVENTION — ce qui est permis, et ce qui est REFUSÉ
 * avec sa raison écrite (lot 2, D84 ; I5 pour la préséance).
 *
 * ## Ce module ne garde rien — il EXPLIQUE
 *
 * La garantie est en base : `intervention_cycle_de_vie` refuse en PostgreSQL
 * ce que ce module refuse en TypeScript. *Une action refusée à l'écran mais
 * acceptée par la base est un trou*, et c'est le déclencheur qui ferme le trou.
 *
 * Alors pourquoi ce module ? Parce qu'un refus de base est un message technique
 * arrivé trop tard, et que **le refus doit s'afficher à la place de l'action,
 * avec sa raison** — pas après coup dans une bannière rouge. Les deux disent la
 * même chose ; celui-ci le dit AVANT, celui-là le dit QUOI QU'IL ARRIVE.
 *
 * *Deux lectures d'un même critère divergent en silence (§9, 01/09).* Ce qui
 * les confronte ici est un scénario d'isolation : pour chaque transition que ce
 * module refuse, la base est sollicitée et doit refuser aussi.
 */

/** Un refus, avec la clé de dictionnaire qui l'explique à l'écran. */
export type Refus = {
  readonly refuse: true;
  /** Clé de `lib/i18n/fr.ts` — jamais une phrase en dur (CLAUDE.md §5). */
  readonly cle: string;
};

/** Une action permise. */
export type Permis = { readonly refuse: false };

export type Verdict = Refus | Permis;

const PERMIS: Permis = { refuse: false };

/**
 * Les statuts TERMINAUX au sens de la modification : plus rien ne se change,
 * hors la seule sortie que I5 laisse ouverte.
 *
 * `cloturee` n'est pas tout à fait terminal — I5 donne à `annulee` la préséance
 * sur `cloturee`, et l'annulation d'une intervention déjà clôturée reste donc
 * possible. `annulee`, lui, l'est : rien n'a préséance sur lui.
 */
export function estFige(statut: StatutIntervention): boolean {
  return statut === "annulee" || statut === "cloturee";
}

/** Peut-on DÉPLACER cette intervention — créneau ou technicien ? */
export function peutDeplacer(statut: StatutIntervention): Verdict {
  if (statut === "annulee") {
    return { refuse: true, cle: "intervention.refus.annulee_figee" };
  }
  if (statut === "cloturee") {
    return { refuse: true, cle: "intervention.refus.cloturee_figee" };
  }
  return PERMIS;
}

/** Peut-on AFFECTER un technicien ? Mêmes bornes que le déplacement. */
export function peutAffecter(statut: StatutIntervention): Verdict {
  return peutDeplacer(statut);
}

/**
 * Peut-on CLÔTURER — c'est-à-dire VALIDER le temps puis clore ? (D120)
 *
 * **Ce qui est exigé n'est plus une saisie, c'est une MESURE.** *Le compteur du
 * technicien est la seule source du temps* : clôturer sans qu'aucun segment
 * n'ait tourné facturerait le plancher d'une heure sur un temps que personne
 * n'a mesuré — la faute d'origine de cette garde, déplacée d'un cran.
 *
 * **Le paramètre est donc le temps MESURÉ, jamais le validé.** Prendre le
 * validé rendrait la garde circulaire : l'écran le pré-remplit depuis le
 * mesuré, et une garde qui juge ce qu'elle vient d'écrire ne juge rien.
 *
 * *Conséquence assumée et écrite : une intervention sur laquelle personne n'a
 * démarré de compteur ne se clôture pas dans CODIPLAN.* C'est la contrepartie
 * exacte de « la saisie manuelle se fait dans Winpro au moment de facturer ».
 */
export function peutCloturer(
  statut: StatutIntervention,
  tempsMesureMin: number | null,
): Verdict {
  if (statut === "annulee") {
    return { refuse: true, cle: "intervention.refus.annulee_figee" };
  }
  if (statut === "cloturee") {
    return { refuse: true, cle: "intervention.refus.deja_cloturee" };
  }
  if (tempsMesureMin === null || tempsMesureMin <= 0) {
    return { refuse: true, cle: "intervention.refus.temps_manquant" };
  }
  return PERMIS;
}

/**
 * Peut-on DÉMARRER LE COMPTEUR sur cette intervention ? (D120)
 *
 * **Aucune machine n'est exigée**, et c'est tout l'objet de D120 : *une
 * intervention peut porter sur autre chose qu'un équipement — un réseau d'air
 * comprimé, par exemple.* Le bloc qui l'exigeait est retiré de la base au même
 * moment, et non seulement d'ici : *une garde qu'un chemin contourne ne garde
 * plus rien.*
 *
 * Trois refus, et le troisième est celui qu'on oublie :
 *
 *   - une intervention **figée** — annulée ou clôturée — ne se rouvre pas par
 *     un compteur. La base le refuse déjà ; le dire ici donne un motif LISIBLE
 *     plutôt qu'une violation de contrainte rendue à l'écran ;
 *   - une intervention **suspendue** se REPREND, elle ne se redémarre pas.
 *     *La reprise rend le statut que le créneau dicte* (L2-10) ; démarrer un
 *     compteur par-dessus écraserait ce chemin sans le dire.
 */
export function peutDemarrerLeCompteur(statut: StatutIntervention): Verdict {
  if (statut === "annulee") {
    return { refuse: true, cle: "intervention.refus.annulee_figee" };
  }
  if (statut === "cloturee") {
    return { refuse: true, cle: "intervention.refus.deja_cloturee" };
  }
  if (statut === "suspendue") {
    return { refuse: true, cle: "compteur.refus.suspendue" };
  }
  return PERMIS;
}

/**
 * Peut-on SUSPENDRE ? (L2-10, RG-INT-06)
 *
 * Une intervention figée ne se suspend pas — il n'y a plus rien à reprendre.
 * Et une intervention **déjà suspendue** non plus : *la re-suspendre écraserait
 * `suspendue_le`, c'est-à-dire remettrait à zéro l'ancienneté que la file de
 * L2-10 et l'alerte « > 30 jours » du chapitre 16.1 mesurent.* Modifier le
 * motif d'une suspension en cours est une autre action, et elle n'est pas
 * demandée.
 *
 * **Le motif est exigé ici comme il l'est en base.** *Une intervention arrêtée
 * sans qu'on sache pourquoi est une intervention perdue* — celui qui la
 * retrouvera dans trois semaines n'aura personne à qui demander.
 */
export function peutSuspendre(
  statut: StatutIntervention,
  motif: string | null,
): Verdict {
  if (statut === "annulee") {
    return { refuse: true, cle: "intervention.refus.annulee_figee" };
  }
  if (statut === "cloturee") {
    return { refuse: true, cle: "intervention.refus.cloturee_figee" };
  }
  if (statut === "suspendue") {
    return { refuse: true, cle: "intervention.refus.deja_suspendue" };
  }
  if (motif === null || motif.trim().length === 0) {
    return { refuse: true, cle: "intervention.refus.motif_manquant" };
  }
  return PERMIS;
}

/**
 * Peut-on REPRENDRE une intervention suspendue ? (L2-10)
 *
 * Seule une intervention suspendue se reprend — et elle retrouve alors l'état
 * que son CRÉNEAU dicte, jamais celui qu'elle avait avant : *entre-temps, le
 * planificateur a pu la déplacer ou lui retirer sa date.* C'est
 * `statutALaCreation` qui décide, et il décide de la même manière qu'à la
 * naissance — **une seule règle pour « quel statut dit ce créneau »**, plutôt
 * que deux qui divergeraient en silence (§9, 01/09).
 */
export function peutReprendre(statut: StatutIntervention): Verdict {
  if (statut !== "suspendue") {
    return { refuse: true, cle: "intervention.refus.pas_suspendue" };
  }
  return PERMIS;
}

/**
 * Peut-on ANNULER ? Presque toujours — et c'est I5 qui le veut.
 *
 * `ANNULEE` a la préséance sur tout, y compris sur `CLOTUREE` : une
 * intervention clôturée par erreur doit pouvoir être annulée, sinon la
 * préséance de I5 serait vraie dans la synchronisation et fausse à l'écran.
 * Le seul refus est l'annulation de ce qui est déjà annulé.
 */
export function peutAnnuler(statut: StatutIntervention): Verdict {
  if (statut === "annulee") {
    return { refuse: true, cle: "intervention.refus.deja_annulee" };
  }
  return PERMIS;
}

/**
 * Peut-on GÉNÉRER LE BON D'INTERVENTION imprimable ? (AFFICHAGE-MATERIEL-1,
 * 23/09/2026)
 *
 * *Mesuré en production le 23/09/2026 : le lien « Bon d'intervention » était
 * proposé sur une intervention encore `planifiee`, et l'URL du bon la rendait
 * quand même — un bon récapitulant un travail que le terrain n'a pas encore
 * fait.* Le bon existe pour RENDRE COMPTE d'un travail fait : `terminee` et
 * `cloturee` sont les DEUX SEULS statuts où le terrain a dit avoir fini —
 * jamais un troisième inventé ici.
 */
export function peutGenererLeBon(statut: StatutIntervention): Verdict {
  if (statut === "terminee" || statut === "cloturee") {
    return PERMIS;
  }
  return { refuse: true, cle: "intervention.bon.refus.non_terminee" };
}

/**
 * PEUT-ON POSER CE CRÉNEAU SUR UNE INTERVENTION ENCORE « À PLANIFIER » ?
 * (PARCOURS-1, 23/09/2026, arbitrage Alexis)
 *
 * > *« Planifier et qualifier l'intervention » exige la date, l'heure de
 * > début, la DURÉE PRÉVUE (obligatoire) et le technicien — les quatre à la
 * > fois. Une intervention ne peut pas passer au statut planifié/affecté sans
 * > ces quatre valeurs.*
 *
 * **Ne juge qu'une intervention `a_planifier`.** Une intervention déjà
 * planifiée n'est pas concernée : la replanifier partiellement — changer
 * seulement l'heure, ou seulement le technicien — reste un DÉPLACEMENT
 * ordinaire, pas une planification initiale ; les quatre valeurs qu'exige ce
 * verdict ont déjà été données une première fois pour qu'elle quitte la file.
 *
 * **Tout ou rien** : si AUCUNE des quatre n'est donnée, il n'y a rien à
 * planifier — ce n'est pas un refus, c'est un déplacement qui ne déplace
 * rien. Si AU MOINS UNE est donnée sans les trois autres, c'est la moitié
 * d'une planification, et c'est refusé en nommant ce qui manque — jamais un
 * message générique, pour que l'écran comme le glisser-déposer du planning
 * disent EXACTEMENT quoi ajouter (même exigence que RG-PLA-04, L3-02).
 *
 * C'est ce verdict, et lui seul, qui ferme le trou que le glisser-déposer
 * ouvrait : il pose une date et parfois un technicien sur la ligne d'une
 * personne, SANS heure ni durée en vue semaine. Le déploiement de ce
 * verdict dans `deplacerIntervention` refuse alors ce dépôt-là comme il
 * refuse un formulaire incomplet — MÊME route, MÊME décision (R2-19).
 */
export function peutPlanifier(
  statut: StatutIntervention,
  valeurs: {
    readonly datePlanifiee: unknown;
    readonly debutMinutes: unknown;
    readonly dureeMin: unknown;
    readonly technicienId: unknown;
  },
): Verdict {
  if (statut !== "a_planifier") {
    return PERMIS;
  }
  const { datePlanifiee, debutMinutes, dureeMin, technicienId } = valeurs;
  const toutesPresentes =
    datePlanifiee !== null &&
    debutMinutes !== null &&
    dureeMin !== null &&
    technicienId !== null;
  const uneSeulePresente =
    datePlanifiee !== null ||
    debutMinutes !== null ||
    dureeMin !== null ||
    technicienId !== null;
  if (!uneSeulePresente || toutesPresentes) {
    return PERMIS;
  }
  if (datePlanifiee === null) {
    return {
      refuse: true,
      cle: "intervention.refus.planification_date_manquante",
    };
  }
  if (debutMinutes === null || dureeMin === null) {
    return {
      refuse: true,
      cle: "intervention.refus.planification_duree_manquante",
    };
  }
  return {
    refuse: true,
    cle: "intervention.refus.planification_technicien_manquant",
  };
}

/**
 * Le statut qu'une création prend, DÉDUIT de la POSE et jamais saisi.
 *
 * **« À planifier » veut dire « sans date », et rien d'autre.** L'annexe D en
 * fait la file d'attente ; une intervention qui porte une date n'y est plus,
 * même si l'heure exacte reste à fixer.
 *
 * *La première rédaction ne regardait que le créneau, et une intervention datée
 * sans heure restait « à planifier » — mesuré à l'écran : trois lignes datées du
 * 14 septembre, marquées « à planifier », rangées parmi les posées.* Un statut
 * qui contredit la ligne où il s'affiche est pire qu'un statut absent.
 */
export function statutALaCreation(
  datePlanifiee: Date | null,
  creneauDebut: Date | null,
): StatutIntervention {
  return datePlanifiee === null && creneauDebut === null
    ? "a_planifier"
    : "planifiee";
}
