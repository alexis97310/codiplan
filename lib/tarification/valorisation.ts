import { arrondirAuPlusProche, montant, type Montant } from "@/lib/money";

import type { VerdictMajoration } from "./majoration";

/**
 * VALORISATION DE LA MAIN-D'ŒUVRE — arrondi et plancher (RG-TAR-05, D83).
 *
 * ## Les deux règles, dans leur ordre
 *
 * 1. **Arrondi.** Le temps d'intervention est arrondi **au quart d'heure
 *    supérieur**.
 * 2. **Plancher.** La main-d'œuvre facturée ne peut être **inférieure à une
 *    heure** au taux en vigueur.
 *
 * **L'ordre est une décision, pas une commodité** : arrondir d'abord puis
 * plancher ensuite donne le même résultat que l'inverse sur toutes les valeurs
 * — le plancher, 60 minutes, est lui-même un multiple de 15 — mais l'écrire
 * dans cet ordre rend le calcul lisible et le rend faux à relire à l'envers si
 * un jour le plancher cesse d'être un multiple du pas.
 *
 * **Les deux s'appliquent UNE SEULE FOIS, sur l'intervention ENTIÈRE**, jamais
 * tâche par tâche. C'est D11 pour l'agrégation interne — le temps est cumulé
 * avant d'être arrondi — et D57 pour l'externe : l'arrondi est par
 * intervention, jamais sur le total d'une journée. **Une intervention étalée
 * sur deux jours reste UNE intervention** : un seul arrondi, un seul plancher.
 *
 * ## Ce à quoi le plancher ne s'applique PAS, et pourquoi
 *
 * - **Les interventions au forfait.** Le prix d'un forfait ne dépend pas de la
 *   durée ; lui appliquer un plancher horaire reviendrait à facturer une heure
 *   par-dessus un prix déjà convenu.
 * - **Le trajet.** Il n'est pas facturé à l'heure (D74, RG-PLA-05) : c'est une
 *   donnée de planification, pas une ligne de main-d'œuvre.
 * - **Le travail interne.** Il n'est facturé à personne.
 *
 * D'où la forme de ce module : il n'expose **aucune** fonction générale
 * « valoriser une intervention ». Il expose la valorisation du **temps passé**,
 * qui est le seul mode où les deux règles mordent, et l'appelant doit avoir
 * décidé du mode avant de l'appeler. *Une fonction qui aurait accepté un mode
 * en argument aurait porté la composition forfait + excédent, qui n'est pas
 * tranchée (registre).*
 */

/** Le pas d'arrondi, en minutes : le quart d'heure. */
export const PAS_ARRONDI_MINUTES = 15;

/** Le plancher de main-d'œuvre facturée, en minutes : une heure. */
export const PLANCHER_MINUTES = 60;

/** Minutes dans une heure — nommé pour que la division du taux se lise. */
const MINUTES_PAR_HEURE = 60;

/** Ce qu'une valorisation au temps passé rend, décomposé pour être affichable. */
export type ValorisationTempsPasse = {
  /** Le temps réellement saisi, en minutes, tel quel. */
  readonly minutesReelles: number;
  /** Après arrondi au quart d'heure supérieur. */
  readonly minutesArrondies: number;
  /** Après plancher — c'est ce qui est facturé. */
  readonly minutesFacturees: number;
  /** Vrai quand le plancher a relevé le temps facturé au-dessus de l'arrondi. */
  readonly plancherApplique: boolean;
  /** Le taux horaire retenu, rendu pour que l'écran n'ait pas à le redemander. */
  readonly tauxHoraire: Montant;
  /** La main-d'œuvre facturée, hors taxes. */
  readonly mainDoeuvre: Montant;
};

/** Refus de valoriser : la saisie n'est pas une durée exploitable. */
export class ErreurDureeInvalide extends Error {
  constructor(minutes: number) {
    super(
      `Durée d'intervention invalide : ${minutes}. Le temps saisi doit être ` +
        "un nombre entier de minutes, positif ou nul.",
    );
    this.name = "ErreurDureeInvalide";
  }
}

/**
 * Arrondit une durée en minutes **au quart d'heure supérieur**.
 *
 * Zéro reste zéro : une intervention sans temps saisi n'est pas une
 * intervention d'un quart d'heure, c'est une intervention dont le temps
 * manque, et c'est à l'appelant de le refuser (la clôture l'exige).
 * Un multiple de 15 ne bouge pas — `30 → 30`, jamais `30 → 45`.
 */
export function arrondirAuQuartDHeureSuperieur(minutes: number): number {
  if (!Number.isSafeInteger(minutes) || minutes < 0) {
    throw new ErreurDureeInvalide(minutes);
  }
  return Math.ceil(minutes / PAS_ARRONDI_MINUTES) * PAS_ARRONDI_MINUTES;
}

/**
 * Valorise le temps passé d'UNE intervention : arrondi, puis plancher, puis
 * taux.
 *
 * Le montant est calculé en arithmétique entière exacte — `taux × minutes / 60`
 * passe par {@link arrondirAuPlusProche}, jamais par un flottant : un taux qui
 * ne se divise pas par quatre (un quart d'heure) donnerait sinon un centime de
 * dérive, et I3 interdit qu'un montant s'en aperçoive.
 */
export function valoriserTempsPasse(
  minutesReelles: number,
  tauxHoraire: Montant,
): ValorisationTempsPasse {
  const minutesArrondies = arrondirAuQuartDHeureSuperieur(minutesReelles);
  const minutesFacturees = Math.max(minutesArrondies, PLANCHER_MINUTES);
  const valeur = arrondirAuPlusProche(
    tauxHoraire.valeur * BigInt(minutesFacturees),
    BigInt(MINUTES_PAR_HEURE),
  );
  return {
    minutesReelles,
    minutesArrondies,
    minutesFacturees,
    plancherApplique: minutesFacturees > minutesArrondies,
    tauxHoraire,
    mainDoeuvre: montant(valeur, tauxHoraire.devise),
  };
}

/**
 * LE TOTAL HORS TAXES D'UNE INTERVENTION — la composition, enfin tranchée
 * (L2-09a ; RG-TAR-05, D11, D77, RG-INT-07).
 *
 * ## Pourquoi cette fonction n'existait pas, et pourquoi elle existe
 *
 * L'en-tête ci-dessus l'écrivait : *« aucune fonction générale valoriser une
 * intervention … la composition forfait + excédent n'est pas tranchée. »*
 * **Elle l'est** — D77, le 09/09/2026 : *un forfait s'ajoute **toujours** au
 * temps facturé ; il n'en absorbe jamais une partie.* La phrase d'origine est
 * conservée en tête, comme le dépôt conserve ce qu'il barre : elle a gouverné
 * ce module, et ce qui a été décidé un jour se relit.
 *
 * ## LES TROIS MODES SONT CEUX DE RG-TAR-05, ET RIEN D'AUTRE
 *
 * > *« Une intervention est valorisée **au forfait**, **au temps passé**, ou
 * > **au forfait plus les heures excédentaires**. »*
 *
 * ## LE FORFAIT DE DÉPLACEMENT N'EST PAS UN MODE : IL S'AJOUTE TOUJOURS
 *
 * RG-INT-07 : *le déplacement se facture par un forfait conditionné par zone,
 * un seul par intervention*, et le temps de trajet n'est **jamais** facturé à
 * l'heure. Il ne dépend donc d'aucun mode — une intervention au temps passé le
 * porte comme une intervention au forfait.
 *
 * *C'était le premier des deux défauts mesurés à L2-09a : il n'entrait dans
 * AUCUN total, alors que `intervention.forfait_deplacement_id` le désignait
 * depuis D84. L'écran affichait « Total hors taxes » sur la main-d'œuvre
 * seule.*
 *
 * ## UN TOTAL QU'ON NE SAIT PAS CALCULER EST `null`, JAMAIS ZÉRO
 *
 * Rien ne sélectionne aujourd'hui de forfait de **prestation** — `forfaitRetenu`
 * n'est appelé que pour le déplacement. Les modes qui en dépendent rendent donc
 * un total **inconnu**.
 *
 * *C'était le second défaut : une intervention au forfait se clôturait à
 * **zéro**.* Et zéro est une réponse — il dit « cela ne coûte rien » là où il
 * faut lire « je ne sais pas encore ». **Une absence d'information ne s'affiche
 * jamais comme une réponse négative**, et c'est vrai d'un montant plus que de
 * tout le reste.
 *
 * ## CE QUI N'EST PAS ICI, ET QUI EST NOMMÉ
 *
 * **La majoration hors ouverture** (D12, +50 %, assiette main-d'œuvre seule).
 * Son taux et son assiette sont écrits ; **la BASE de son prorata ne l'est
 * pas**. *« Au prorata, quart d'heure par quart d'heure »* suppose que la durée
 * facturée et le créneau coïncident — ils ne coïncident pas : la main-d'œuvre
 * se calcule sur `temps_reel_min`, arrondi puis planché, et les minutes hors
 * ouverture se lisent sur le créneau. Une intervention de 30 minutes dans un
 * créneau de 16 h à 18 h, l'agence fermant à 17 h, se majore de 0 % ou de 50 %
 * **selon la base retenue** — et cela change ce qu'un client paie. ~~*Question
 * portée à l'exploitation plutôt que tranchée en séance.*~~
 *
 * **TRANCHÉE LE 12/09/2026 — D108 : le prorata se lit sur le CRÉNEAU**, et la
 * majoration entre donc dans le total (L2-09b). *La phrase est barrée et non
 * effacée : elle a gouverné ce module, et ce qui a été décidé un jour se relit.*
 * Le calcul vit dans `majoration.ts` — il a besoin du créneau et du calendrier,
 * que ce module ne connaît pas — et il arrive ici sous la forme d'un VERDICT,
 * jamais d'un nombre nu : *un supplément absent et un supplément nul ne se
 * corrigent pas au même endroit.*
 */
export type ModeDeValorisation =
  "forfait" | "temps_passe" | "forfait_plus_heures";

/** Ce qu'une valorisation d'intervention rend, décomposée pour être affichable. */
export type ValorisationIntervention = {
  readonly mode: ModeDeValorisation;
  /** Le forfait de déplacement retenu, s'il y en a un (RG-INT-07). */
  readonly forfaitDeplacement: Montant | null;
  /** La main-d'œuvre, quand le mode en facture — `null` sinon. */
  readonly mainDoeuvre: Montant | null;
  /**
   * La MAJORATION hors ouverture retenue (D12, D108), ou `null`.
   *
   * Rendue à côté des autres termes parce qu'un total doit s'expliquer par ce
   * qui le compose : *un client qui ne peut pas recalculer un montant ne peut
   * pas le contester, et c'est pire que de le contester.*
   */
  readonly majoration: Montant | null;
  /**
   * Le total hors taxes, ou `null` quand il ne se calcule pas.
   *
   * **`null` n'est pas zéro**, et les deux ne se corrigent pas pareil : zéro
   * dit « cela ne coûte rien », `null` dit « il manque quelque chose pour le
   * savoir ». Le motif est alors nommé par {@link motifTotalInconnu}.
   */
  readonly totalHT: Montant | null;
  /** Pourquoi le total est inconnu — clé de dictionnaire, ou `null`. */
  readonly motifTotalInconnu: string | null;
};

/** Le mode facture-t-il de la main-d'œuvre à l'heure ? */
function factureDesHeures(mode: ModeDeValorisation): boolean {
  return mode === "temps_passe" || mode === "forfait_plus_heures";
}

/** Le mode exige-t-il un forfait de PRESTATION, que rien ne sait encore choisir ? */
function exigeUnForfaitDePrestation(mode: ModeDeValorisation): boolean {
  return mode === "forfait" || mode === "forfait_plus_heures";
}

/**
 * Compose le total hors taxes d'une intervention, dans l'ordre de D11 :
 * **forfaits applicables → heures → MAJORATION → total HT**.
 *
 * L'ordre est respecté même là où l'addition est commutative : *il fige la
 * lecture*, et le jour où un terme dépendra d'un autre, la règle restera
 * lisible au lieu de devenir ambiguë. La majoration vient **après** les heures
 * parce qu'elle en dérive — son assiette EST la main-d'œuvre (D12).
 *
 * ## LA MAJORATION EST UN ARGUMENT OBLIGATOIRE, et c'est délibéré
 *
 * Un appelant qui l'oublierait **ne compile pas**. C'est la leçon de D70 telle
 * que `occupationTechnicien` l'applique déjà au trajet : *une garantie énoncée
 * en termes de ce qu'il faut faire se referme un étage plus bas, et le gardien
 * reste vert* (§9, 09/09). Un paramètre facultatif aurait valu zéro par défaut,
 * et **zéro se lit « rien à majorer »** là où il faudrait lire « personne n'a
 * regardé ».
 *
 * Et c'est un VERDICT, jamais un montant nu : quand la majoration n'est pas
 * calculable — un créneau absent —, le total est `null` **avec le motif de la
 * majoration**, parce qu'une facture amputée d'un supplément dû est fausse.
 */
export function valoriserIntervention(parametres: {
  readonly mode: ModeDeValorisation;
  readonly forfaitDeplacement: Montant | null;
  readonly mainDoeuvre: Montant | null;
  readonly majoration: VerdictMajoration;
}): ValorisationIntervention {
  const { mode, forfaitDeplacement } = parametres;
  const mainDoeuvre = factureDesHeures(parametres.mode)
    ? parametres.mainDoeuvre
    : null;
  // Le supplément n'existe que si des heures sont facturées : l'assiette de D12
  // est la main-d'œuvre, et majorer une intervention au forfait reviendrait à
  // majorer ce qui ne dépend pas de l'heure.
  const majoration =
    mainDoeuvre !== null && parametres.majoration.connue
      ? parametres.majoration.majoration.supplement
      : null;

  if (exigeUnForfaitDePrestation(mode)) {
    // Rien ne sélectionne de forfait de prestation : le total est INCONNU, et
    // il se dit. *Rendre le seul forfait de déplacement présenterait un total
    // partiel comme un total.*
    return {
      mode,
      forfaitDeplacement,
      mainDoeuvre,
      majoration,
      totalHT: null,
      motifTotalInconnu: "intervention.total.forfait_de_prestation_absent",
    };
  }

  if (mainDoeuvre === null) {
    return {
      mode,
      forfaitDeplacement,
      mainDoeuvre,
      majoration,
      totalHT: null,
      motifTotalInconnu: "intervention.total.main_doeuvre_absente",
    };
  }

  // LA MAJORATION EST JUGÉE AVANT LE FORFAIT, et l'ordre porte le sens : un
  // supplément qu'on ne sait pas calculer rend le total inconnu, quel que soit
  // le reste. Le dire après le forfait ferait rendre un total complet sur une
  // intervention dont le supplément manque.
  if (!parametres.majoration.connue) {
    return {
      mode,
      forfaitDeplacement,
      mainDoeuvre,
      majoration,
      totalHT: null,
      motifTotalInconnu: parametres.majoration.motif,
    };
  }

  const supplement = parametres.majoration.majoration.supplement;

  if (supplement.devise !== mainDoeuvre.devise) {
    // I2, comme ci-dessous : deux devises dans une même intervention est un
    // état que rien ne devrait produire, et l'additionner fabriquerait un
    // montant faux. Le contrôle est ici plutôt que dans `majoration.ts` parce
    // que c'est ICI que les termes se rencontrent.
    return {
      mode,
      forfaitDeplacement,
      mainDoeuvre,
      majoration,
      totalHT: null,
      motifTotalInconnu: "intervention.total.devises_incompatibles",
    };
  }

  if (forfaitDeplacement === null) {
    // *Aucun forfait applicable : le déplacement n'est PAS facturé* (D11 le dit
    // en toutes lettres). Ce n'est pas une absence d'information, c'est un
    // prix — et le total vaut la main-d'œuvre seule.
    return {
      mode,
      forfaitDeplacement,
      mainDoeuvre,
      majoration,
      totalHT: montant(
        mainDoeuvre.valeur + supplement.valeur,
        mainDoeuvre.devise,
      ),
      motifTotalInconnu: null,
    };
  }

  if (forfaitDeplacement.devise !== mainDoeuvre.devise) {
    // I2 : jamais de conversion ligne à ligne. Deux devises dans une même
    // intervention est un état que rien ne devrait produire — la société n'en a
    // qu'une — et l'additionner en silence fabriquerait un montant faux.
    return {
      mode,
      forfaitDeplacement,
      mainDoeuvre,
      majoration,
      totalHT: null,
      motifTotalInconnu: "intervention.total.devises_incompatibles",
    };
  }

  return {
    mode,
    forfaitDeplacement,
    mainDoeuvre,
    majoration,
    totalHT: montant(
      forfaitDeplacement.valeur + mainDoeuvre.valeur + supplement.valeur,
      mainDoeuvre.devise,
    ),
    motifTotalInconnu: null,
  };
}
