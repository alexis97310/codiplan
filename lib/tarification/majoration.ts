import { minutesHorsOuverture, type Calendrier } from "@/lib/calendar";
import { arrondirAuPlusProche, montant, zero, type Montant } from "@/lib/money";

/**
 * LA MAJORATION HORS OUVERTURE (L2-09b, RG-INT-08, D12, D13, D108).
 *
 * ## La doctrine, mot pour mot — et sans elle la règle serait indéfendable
 *
 * > **LA MAJORATION PAIE LA CONTRAINTE D'UN CRÉNEAU POSÉ HORS OUVERTURE, PAS
 * > LES MINUTES EFFECTIVEMENT TRAVAILLÉES.** *(D108)*
 *
 * *Le client a fait bloquer la soirée d'un technicien ; qu'il finisse tôt ne
 * rend pas la soirée disponible.* C'est ce qui rend la règle tenable devant
 * quelqu'un qui compte ses minutes : **ce qu'il a acheté est un créneau, et le
 * créneau a été tenu.**
 *
 * ## LE PRORATA SE LIT SUR LE CRÉNEAU, JAMAIS SUR `temps_reel_min`
 *
 * D12 disait *« au prorata, quart d'heure par quart d'heure »*, ce qui suppose
 * que la durée facturée et le créneau **coïncident**. Ils ne coïncident pas :
 * la main-d'œuvre se calcule sur `temps_reel_min` arrondi puis planché (D83,
 * D89), les minutes hors ouverture se lisent sur le créneau. *Créneau 16 h –
 * 18 h, fermeture à 17 h, travail de 30 minutes : **50 % ou 0 %** selon la base
 * retenue, et l'écart se voit sur la facture.*
 *
 * **Les deux bornes du créneau sont donc OBLIGATOIRES**, et ce n'est pas du
 * formalisme : un créneau absent traité comme « entièrement dans l'ouverture »
 * rendrait **zéro** là où il faut lire *« je ne sais pas »*, et personne ne le
 * verrait — un zéro se lit « rien à majorer ».
 *
 * ## CE QUI NE SE ROUVRE PAS, ET CE QUI RENDRA LA QUESTION CADUQUE
 *
 * Le taux (**+50 %**), l'assiette (**main-d'œuvre seule**) et le calendrier de
 * référence (**agence du TECHNICIEN**) sont arrêtés par D12 et D13. *Le jour où
 * `intervention` portera l'heure réelle de début ET de fin* — R3-05 à la file —
 * la majoration se calculera sur les heures réellement travaillées, et D12 se
 * relira pour être remplacé. **La condition est vérifiable : deux colonnes.**
 *
 * ## L'ASSIETTE EST LA MAIN-D'ŒUVRE, ET RIEN D'AUTRE
 *
 * Ni le forfait de déplacement, ni les pièces, ni le trajet : **aucun n'est
 * facturé à l'heure**, et majorer ce qui ne dépend pas de l'heure n'aurait pas
 * de sens. C'est exactement la borne que `valorisation.ts` pose déjà pour le
 * plancher d'une heure (D89), et elle est recopiée ici **comme argument, jamais
 * comme liste** : ce module ne reçoit que la main-d'œuvre, si bien qu'il ne
 * PEUT PAS majorer autre chose.
 *
 * ## LE CALENDRIER LU EST CELUI DE L'AGENCE DU TECHNICIEN, ET C'EST VÉRIFIÉ
 *
 * D13 le dit, et *« l'appelant doit passer le bon calendrier »* est une
 * exigence sur un **geste** — satisfaite par un geste faux (§9, 09/09). Le
 * calendrier arrive donc **avec l'agence dont il provient**, le technicien
 * arrive avec son rattachement, et **une discordance LÈVE** plutôt que de
 * rendre un montant calculé sur le mauvais calendrier. *L'appelant désigne, ce
 * module dispose* (la forme de D70).
 */

/** Le taux de D12, exprimé en fraction exacte — jamais en flottant. */
export const TAUX_MAJORATION = { numerateur: 1, denominateur: 2 } as const;

/** Un calendrier ACCOMPAGNÉ de l'agence dont il provient (D13). */
export type CalendrierDAgence = {
  readonly agenceId: string;
  readonly calendrier: Calendrier;
};

/** Le créneau POSÉ — les deux bornes, et il n'y a pas de demi-créneau. */
export type CreneauPose = {
  readonly debut: Date;
  readonly fin: Date;
};

/**
 * Ce que la majoration rend, décomposée pour être AFFICHABLE et vérifiable.
 *
 * *Un montant qu'un client ne peut pas recalculer est un montant
 * indéfendable* : les trois termes sont rendus ensemble, et l'arithmétique qu'un
 * lecteur refait à la main tombe juste (voir {@link majorationHorsOuverture}).
 */
export type MajorationHorsOuverture = {
  /** Les minutes DU CRÉNEAU tombant hors ouverture — le numérateur. */
  readonly minutesHorsOuverture: number;
  /** Les minutes du créneau — le dénominateur, jamais `temps_reel_min`. */
  readonly minutesDuCreneau: number;
  /** La part de main-d'œuvre soumise au taux. */
  readonly assiette: Montant;
  /** Ce qui s'ajoute au total hors taxes. */
  readonly supplement: Montant;
};

/**
 * Pourquoi la majoration ne se calcule pas — clé de dictionnaire.
 *
 * **Quatre motifs, et ils ne se corrigent pas au même endroit** : les deux
 * premiers sont prononcés ICI, les deux derniers par le dépôt qui charge les
 * données. *Les réunir sous « inconnue » ferait chercher une donnée manquante
 * là où c'est un paramétrage d'agence qui manque.*
 *
 * | Motif | Prononcé par | Ce qu'il faut faire |
 * |---|---|---|
 * | `creneau_absent` | ce module | poser un créneau, ou ne rien facturer à l'heure |
 * | `main_doeuvre_absente` | ce module | le mode ne facture pas d'heures, ou le taux manque |
 * | `technicien_absent` | le dépôt | affecter un technicien, ou le rattacher à une agence |
 * | `calendrier_absent` | le dépôt | paramétrer le calendrier de SON agence (I7) |
 */
export type MotifMajorationInconnue =
  | "intervention.majoration.creneau_absent"
  | "intervention.majoration.main_doeuvre_absente"
  | "intervention.majoration.technicien_absent"
  | "intervention.majoration.calendrier_absent";

export type VerdictMajoration =
  | { readonly connue: true; readonly majoration: MajorationHorsOuverture }
  | { readonly connue: false; readonly motif: MotifMajorationInconnue };

/** Une discordance entre le calendrier fourni et l'agence du technicien (D13). */
export class ErreurCalendrierHorsAgence extends Error {
  constructor(
    readonly agenceDuCalendrier: string,
    readonly agenceDuTechnicien: string,
  ) {
    super(
      `Le calendrier fourni est celui de l'agence ${agenceDuCalendrier}, et le ` +
        `technicien est rattaché à l'agence ${agenceDuTechnicien}. La ` +
        "majoration hors ouverture se lit sur le calendrier de l'agence du " +
        "TECHNICIEN (D13) : un calcul fait sur un autre calendrier serait faux " +
        "sans être refusé.",
    );
    this.name = "ErreurCalendrierHorsAgence";
  }
}

/**
 * Le créneau est-il entièrement dans l'ouverture ? Alors rien n'est majoré, et
 * c'est un **zéro véritable** — pas une absence d'information.
 *
 * ## Deux arrondis, et le second se fait sur le PREMIER
 *
 * `assiette = arrondi(main-d'œuvre × hors-ouverture / créneau)`, puis
 * `supplément = arrondi(assiette × 1/2)`. **Le supplément n'est PAS calculé sur
 * la fraction exacte**, et c'est une décision : un client qui lit l'assiette
 * doit pouvoir en prendre la moitié et retrouver le supplément. *Dériver le
 * supplément d'une fraction que rien n'affiche rendrait l'arithmétique de la
 * facture fausse à l'œil* — au pire d'une unité, ce qui suffit à ouvrir un
 * litige qu'on ne saurait pas expliquer. Ce que cela coûte est écrit : une
 * demi-unité de précision en plus de l'arrondi unique.
 *
 * **Aucun flottant à aucun moment** : `arrondirAuPlusProche` reçoit un quotient
 * de deux entiers, parce que `0.1 + 0.2` ne vaut pas `0.3` et qu'un montant
 * n'a pas le droit de s'en apercevoir (L0-07).
 *
 * **Ce module ne lit ni base ni horloge.** Le créneau, le calendrier et la
 * main-d'œuvre sont des paramètres : lue ici, l'heure rendrait un test vert
 * parce que l'horloge a bougé.
 *
 * *Et un horizon de calendrier dépassé LÈVE plutôt que de rendre un décompte
 * tronqué* — c'est `minutesOuvrees` qui refuse, et ce refus ne se rattrape pas
 * ici : une majoration calculée sur un calendrier qu'on ne connaît pas assez
 * loin serait fausse en silence.
 */
export function majorationHorsOuverture(parametres: {
  readonly creneau: CreneauPose | null;
  readonly mainDoeuvre: Montant | null;
  /** `null` quand l'appelant n'a pas pu le charger — jamais un calendrier vide. */
  readonly calendrierDeLAgence: CalendrierDAgence | null;
  /** `null` quand aucun technicien rattaché n'a été trouvé. */
  readonly agenceDuTechnicien: string | null;
}): VerdictMajoration {
  const { creneau, mainDoeuvre, calendrierDeLAgence, agenceDuTechnicien } =
    parametres;

  // ── LES QUATRE MOTIFS SONT PRONONCÉS ICI, ET NULLE PART AILLEURS ─────────
  //
  // L'appelant rapporte ce qu'il a OBSERVÉ — un technicien, un calendrier, un
  // créneau — et ce module décide. *Laisser le dépôt prononcer deux des quatre
  // motifs aurait été deux lectures d'un même critère* (§9, 01/09) : le jour où
  // l'ordre changerait ici, l'autre moitié ne le saurait pas.
  //
  // LA DISCORDANCE D'AGENCE EST JUGÉE LA PREMIÈRE, et elle LÈVE : c'est un
  // défaut d'APPEL, pas une donnée manquante. La rendre sous un motif anodin
  // laisserait un montant calculé sur le mauvais calendrier passer pour une
  // absence d'information.
  if (
    calendrierDeLAgence !== null &&
    agenceDuTechnicien !== null &&
    calendrierDeLAgence.agenceId !== agenceDuTechnicien
  ) {
    throw new ErreurCalendrierHorsAgence(
      calendrierDeLAgence.agenceId,
      agenceDuTechnicien,
    );
  }

  if (agenceDuTechnicien === null) {
    return {
      connue: false,
      motif: "intervention.majoration.technicien_absent",
    };
  }
  if (creneau === null) {
    return { connue: false, motif: "intervention.majoration.creneau_absent" };
  }
  if (mainDoeuvre === null) {
    return {
      connue: false,
      motif: "intervention.majoration.main_doeuvre_absente",
    };
  }
  // Le CALENDRIER est jugé APRÈS le créneau, et l'ordre porte le sens : sans
  // créneau, il n'y a rien à lire dedans. Nommer le calendrier d'abord enverrait
  // paramétrer une agence quand ce qui manque est un rendez-vous.
  if (calendrierDeLAgence === null) {
    return {
      connue: false,
      motif: "intervention.majoration.calendrier_absent",
    };
  }

  const minutesDuCreneau =
    (creneau.fin.getTime() - creneau.debut.getTime()) / 60_000;
  if (!(minutesDuCreneau > 0)) {
    // Un créneau de durée nulle ou inversée n'est pas « entièrement ouvert » :
    // c'est un créneau qu'on ne sait pas lire, et le dénominateur serait nul.
    return { connue: false, motif: "intervention.majoration.creneau_absent" };
  }

  const hors = minutesHorsOuverture(
    calendrierDeLAgence.calendrier,
    creneau.debut,
    creneau.fin,
  );

  if (hors <= 0) {
    // UN ZÉRO VÉRITABLE, et il se distingue d'un `null` : le créneau est connu,
    // il est entièrement dans l'ouverture, et il n'y a rien à majorer.
    return {
      connue: true,
      majoration: {
        minutesHorsOuverture: 0,
        minutesDuCreneau,
        assiette: zero(mainDoeuvre.devise),
        supplement: zero(mainDoeuvre.devise),
      },
    };
  }

  const assiette = montant(
    arrondirAuPlusProche(
      mainDoeuvre.valeur * BigInt(Math.round(hors)),
      BigInt(Math.round(minutesDuCreneau)),
    ),
    mainDoeuvre.devise,
  );
  const supplement = montant(
    arrondirAuPlusProche(
      assiette.valeur * BigInt(TAUX_MAJORATION.numerateur),
      BigInt(TAUX_MAJORATION.denominateur),
    ),
    mainDoeuvre.devise,
  );

  return {
    connue: true,
    majoration: {
      minutesHorsOuverture: hors,
      minutesDuCreneau,
      assiette,
      supplement,
    },
  };
}
