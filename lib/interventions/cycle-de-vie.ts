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
 *
 * **AMENDEMENT QG-4 (décision d'Alexis, 27/09/2026) — sur ce seul point.**
 * Ce verdict ne juge qu'une intervention encore `a_planifier`, à dessein :
 * la PREMIÈRE planification exige les quatre valeurs ensemble, mais une
 * intervention déjà `planifiee`/`affectee` pouvait ensuite, par un simple
 * déplacement, perdre son heure et sa durée tout en gardant sa date — une
 * « journée sans heure » à mi-chemin. QG-4 referme cette voie-là sans
 * toucher à celle-ci : voir `peutGarderHeure`, juste en dessous, qui juge
 * ce cas précis et lui seul.
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
 * UNE INTERVENTION DÉJÀ PLANIFIÉE OU AFFECTÉE GARDE SON HEURE (décision QG-4
 * d'Alexis, 27/09/2026 —
 * `docs/propositions/planning-gmao/decisions-2026-09-27.md`).
 *
 * > *« Non : heure (et durée) obligatoires pour une intervention qui reste
 * > planifiée ; tout vider = remettre dans la file. »*
 *
 * **Juge le statut ACTUEL de la ligne**, pas l'état après écriture : pour ce
 * cas précis les deux coïncident toujours (`statutApresDeplacement` ne
 * change un statut `planifiee`/`affectee` que si la date ET le créneau sont
 * TOUS DEUX vidés — exactement le cas que ce verdict laisse passer).
 *
 * **Ne juge que `debutMinutesDemande`** : `schemaDeplacement` (`saisie.ts`)
 * lie déjà l'heure et la durée en entier — l'une ne se donne jamais sans
 * l'autre —, juger les deux séparément dirait deux fois le même fait.
 *
 * **Tout vider reste permis** : si la date elle-même est vidée, l'intervention
 * retourne à la file (`a_planifier`), ce n'est pas un demi-état.
 */
export function peutGarderHeure(
  statutActuel: StatutIntervention,
  datePlanifieeDemandee: unknown,
  debutMinutesDemande: unknown,
): Verdict {
  if (statutActuel !== "planifiee" && statutActuel !== "affectee") {
    return PERMIS;
  }
  if (datePlanifieeDemandee === null || debutMinutesDemande !== null) {
    return PERMIS;
  }
  return { refuse: true, cle: "intervention.refus.heure_obligatoire" };
}

/**
 * PEUT-ON ÉCRIRE CETTE LIGNE, TELLE QU'ELLE SERA APRÈS L'ÉCRITURE ? (audit
 * d'ergonomie du 27/09/2026, bug 4 ; PG-A4-SANS-DUREE-AVANT-ECRITURE)
 *
 * **La contrainte `intervention_planifiee_a_sa_duree` est `NOT VALID`** —
 * PostgreSQL ne l'a pas vérifiée sur l'existant, mais il la vérifie sur
 * TOUTE ligne réécrite, même quand l'écriture ne touche ni le statut ni la
 * durée. *Mesuré en production le 27/09/2026 : cinq interventions
 * `planifiee` sans durée, posées avant que la contrainte n'existe — et
 * chacune d'elles fait échouer, par 23514, le PROCHAIN geste qui la touche*
 * (affecter un technicien, noter une remarque interne, ou l'ouverture même
 * de la fiche terrain qui pose `vue_technicien_le`).
 *
 * **Ce verdict juge l'ÉTAT APRÈS ÉCRITURE, jamais l'état avant.** Un
 * appelant qui ne change ni le statut ni la durée doit quand même passer les
 * valeurs qu'IL S'APPRÊTE À ÉCRIRE — d'où deux paramètres nommés « après » :
 * juger l'avant laisserait passer une écriture qui perpétue une ligne
 * bloquée.
 *
 * *Ce qu'il NE fait PAS : retirer la ligne du planning reste permis.* Une
 * ligne qui redevient `a_planifier` (date et créneau vidés) n'est ni
 * `planifiee` ni `affectee` : ce verdict ne la concerne pas.
 */
export function peutEcrireSansDuree(
  statutApres: StatutIntervention,
  dureeApresMin: number | null,
): Verdict {
  if (
    (statutApres === "planifiee" || statutApres === "affectee") &&
    dureeApresMin === null
  ) {
    return { refuse: true, cle: "intervention.refus.planifiee_sans_duree" };
  }
  return PERMIS;
}

/**
 * PEUT-ON TRANSMETTRE UNE PLANIFIÉE AU TECHNICIEN ? (QG-5, D141,
 * 9CO-PG-G14A-TRANSMETTRE)
 *
 * *« Planifiée » = préparée par le bureau, INVISIBLE du terrain ; « Transmettre »
 * passe Planifiée → Affectée, envoie le courriel au technicien et rend
 * visible.* Seule une intervention `planifiee` se transmet — une autre
 * statut n'a rien à transmettre, par exemple parce qu'elle est déjà
 * `affectee`, ou encore `a_planifier`.
 *
 * **Les trois valeurs que « Planifier et qualifier » exige déjà ensemble**
 * (PARCOURS-1) sont rejugées ici, PAR PRUDENCE : rien ne garantit qu'une
 * ligne `planifiee` plus ancienne les porte toutes — `intervention_
 * planifiee_a_sa_duree` est `NOT VALID` (bug 4, PG-A4), et le technicien n'a
 * jamais été une colonne `NOT NULL`. Un manque se nomme, jamais une
 * transmission à moitié.
 */
export function peutTransmettre(intervention: {
  readonly statut: StatutIntervention;
  readonly technicienId: string | null;
  readonly datePlanifiee: unknown;
  readonly debutMinutes: unknown;
  readonly dureeMin: unknown;
}): Verdict {
  if (intervention.statut !== "planifiee") {
    return { refuse: true, cle: "intervention.refus.pas_planifiee" };
  }
  if (intervention.datePlanifiee === null) {
    return {
      refuse: true,
      cle: "intervention.refus.transmission_date_manquante",
    };
  }
  if (intervention.debutMinutes === null || intervention.dureeMin === null) {
    return {
      refuse: true,
      cle: "intervention.refus.transmission_duree_manquante",
    };
  }
  if (intervention.technicienId === null) {
    return {
      refuse: true,
      cle: "intervention.refus.transmission_technicien_manquant",
    };
  }
  return PERMIS;
}

/** Les quatre manques, fermés, que le tri « pretes / laissées » peut nommer. */
export type MotifNonTransmissible =
  "sans_technicien" | "sans_heure" | "sans_duree" | "date_passee";

/**
 * TOUS LES MANQUES D'UNE LIGNE, PAS LE PREMIER (9CP-PG-G14B-TRANSMETTRE-GROUPE)
 * — le tri « pretes / laissées » de « Transmettre demain » et « Transmettre
 * toutes les planifiées prêtes ».
 *
 * **Reprend les trois mêmes conditions que `peutTransmettre`, mais TOUTES à
 * la fois.** `peutTransmettre` s'arrête au premier refus — ce qu'il faut pour
 * dire QUOI FAIRE sur une fiche unique ; ce tri doit au contraire nommer tout
 * ce qui manque à une ligne laissée, pour que son motif affiché n'en cache
 * pas un second.
 *
 * **Ni le statut ni la date ne sont examinés ici, SAUF si `aPartirDe` est
 * fourni** (décision d'Alexis du 02/10/2026, point 7, D141,
 * 9CT-RETOUCHES-5) : une `PLANIFIEE` porte toujours sa date —
 * `statutApresDeplacement` la fait retomber à `a_planifier` dès que la date
 * est vidée, jamais `planifiee` sans date (QG-4) — mais « Transmettre toutes
 * les planifiées prêtes » exclut désormais celles dont la date est déjà
 * PASSÉE. **`aPartirDe` est injecté par l'appelant, jamais lu d'une horloge
 * ici** (gardiens `calendar/sans-date-courante-implicite`,
 * `calendar/sans-fuseau-en-dur`) : omis, ce motif ne se pose jamais — c'est
 * le cas de « Transmettre demain », qui ne regarde qu'un jour déjà choisi.
 */
export function motifsNonTransmissible(
  intervention: {
    readonly technicienId: string | null;
    readonly debutMinutes: unknown;
    readonly dureeMin: unknown;
    readonly datePlanifiee?: Date | null;
  },
  aPartirDe?: Date,
): readonly MotifNonTransmissible[] {
  const motifs: MotifNonTransmissible[] = [];
  if (intervention.technicienId === null) {
    motifs.push("sans_technicien");
  }
  if (intervention.debutMinutes === null) {
    motifs.push("sans_heure");
  }
  if (intervention.dureeMin === null) {
    motifs.push("sans_duree");
  }
  if (
    aPartirDe !== undefined &&
    intervention.datePlanifiee !== undefined &&
    intervention.datePlanifiee !== null &&
    intervention.datePlanifiee.getTime() < aPartirDe.getTime()
  ) {
    motifs.push("date_passee");
  }
  return motifs;
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
