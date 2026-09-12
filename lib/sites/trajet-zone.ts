import { z } from "zod";

import type { CleTraduction } from "@/lib/i18n/fr";

import { ZONES_GEOGRAPHIQUES, type ZoneGeographique } from "./zones";

/**
 * LE TEMPS DE TRAJET PAR ZONE — le DÉFAUT de D23, chiffré par D107 (R3-03).
 *
 * ## Ce que ce module décide, et ce qu'il refuse de décider
 *
 * RG-PLA-05 et D23 posent une cascade : *la valeur saisie sur le site fait foi ;
 * l'estimation par zone n'est qu'un DÉFAUT appliqué en son absence.* Les six
 * durées de cette estimation n'étaient **écrites nulle part** — mesuré à L3-05,
 * et c'est le §8 du CLAUDE.md : *un délai non spécifié ne s'invente pas.* D107
 * les a arrêtées, et elles sont ici.
 *
 * **Elles sont des DÉFAUTS, jamais des constantes.** Une société les corrige
 * depuis l'écran de réglage, et sa correction vit en base (`temps_trajet_zone`).
 * *Une constante du dépôt ferait d'une correction de terrain une demande de
 * fusion* — c'est-à-dire un déploiement pour changer « 90 » en « 100 ».
 *
 * **Et le point de départ est l'AGENCE, jamais un autre site** (D56, D107). Ces
 * durées sont des trajets ALLER depuis l'agence. *Soustraire deux distances à un
 * point commun n'est pas une distance* : rien ici ne dit, et rien ne dira, ce
 * que coûte un déplacement d'un site à un autre.
 *
 * ## LA CASCADE A TROIS ÉTAGES, ET ELLE REND SON ORIGINE
 *
 * Site → société → défaut. C'est la forme de la cascade d'assujettissement des
 * VGP (D88) et de la priorité du calendrier d'un technicien (D72) : *la valeur
 * ne voyage jamais sans dire d'où elle vient.* Un écran qui afficherait « 90 »
 * sans dire s'il s'agit d'une mesure, d'un réglage ou d'un défaut ferait revoir
 * les mauvaises lignes le jour d'une correction — c'est D56, *un nombre dont la
 * signification dépend d'autre chose ne voyage jamais seul.*
 *
 * ## `iles` NE PORTE AUCUN NOMBRE, ET C'EST UNE DÉCISION
 *
 * *« Déplacement par avion — estimation impossible, à saisir par
 * intervention »* (D107). Ce n'est pas une valeur qui manque : c'est une valeur
 * qui **n'existe pas à la maille de la zone**. Lifou, Bélep et Ouvéa n'ont ni le
 * même vol ni la même fréquence, et un nombre unique pour « Îles » serait un
 * chiffre que personne ne peut défendre — qui finirait dans le dénominateur d'un
 * taux d'occupation (§8, et la discipline du `NOT VALID` de D104 : *ce qu'on ne
 * sait pas, on le dit*).
 *
 * **Une seule lecture de ce critère**, et c'est `DEFAUTS_TRAJET_ZONE` : le
 * schéma de saisie refuse d'écrire une telle zone, la résolution rend `null`
 * avec son motif, et l'écran affiche la phrase au lieu d'un champ. *Trois
 * lecteurs, une source* — une seconde liste « les zones sans estimation »
 * aurait divergé en silence (§9, 01/09).
 *
 * ## CE QUE LA LISTE EXHAUSTIVE GARANTIT
 *
 * `Record<ZoneGeographique, DefautZone>` est **complet par le type** : le jour
 * où un arbitrage ajoute une septième zone à D23, ce fichier **ne compile
 * plus** tant que personne n'a dit ce qu'elle vaut — ou qu'elle n'admet pas
 * d'estimation. *C'est le seul endroit du dépôt où une énumération élargie
 * réclame une décision plutôt qu'un défaut silencieux.*
 *
 * ## CE QUE CE MODULE N'EST PAS
 *
 * Il ne lit **ni base ni horloge**, et il ne décide **aucun prix**. Le temps de
 * trajet n'est jamais facturé au temps : RG-PLA-05 — *« elle ne s'ajoute jamais
 * aux heures facturées »* — et RG-INT-07 — *« le déplacement se facture par un
 * forfait conditionné par zone »*. Deux fois la même réponse, mesurée à D107 :
 * *le gel des valeurs à la clôture n'a donc pas d'objet.*
 */

/** Le défaut d'une zone : un nombre de minutes, ou l'impossibilité d'estimer. */
export type DefautZone =
  | { readonly nature: "minutes"; readonly minutes: number }
  | { readonly nature: "sans_estimation"; readonly motif: CleTraduction };

/**
 * LES VALEURS DE D107 — trajet ALLER depuis l'agence, en minutes.
 *
 * Elles sont les valeurs de RÉFÉRENCE, pas des plafonds : une société les
 * corrige, et sa correction l'emporte. *Ce qui est écrit ici est ce qu'un
 * déploiement neuf propose ; ce qui est en base est ce que l'exploitation a
 * mesuré.*
 */
export const DEFAUTS_TRAJET_ZONE: Readonly<
  Record<ZoneGeographique, DefautZone>
> = {
  grand_noumea: { nature: "minutes", minutes: 30 },
  sud: { nature: "minutes", minutes: 90 },
  cote_est: { nature: "minutes", minutes: 240 },
  cote_ouest: { nature: "minutes", minutes: 150 },
  nord: { nature: "minutes", minutes: 240 },
  // D107, mot pour mot. La clé porte la phrase ; ce fichier ne porte aucun
  // texte lisible (CLAUDE.md §5).
  iles: { nature: "sans_estimation", motif: "trajets.sans_estimation_iles" },
};

/**
 * Cette zone admet-elle une estimation à sa maille ?
 *
 * **La seule lecture du critère.** Le schéma de saisie, la résolution et l'écran
 * passent tous par ici.
 */
export function zoneAdmetUneEstimation(zone: ZoneGeographique): boolean {
  return DEFAUTS_TRAJET_ZONE[zone].nature === "minutes";
}

/**
 * Le plafond d'une durée de trajet : une journée.
 *
 * **Ce n'est pas une règle de gestion, c'est la longueur d'un jour** — même
 * nature que les bornes de `latitude`, qui sont celles de la mesure et non un
 * choix d'exploitation. Un trajet de plus de vingt-quatre heures n'est pas un
 * trajet ; et le refuser évite qu'une faute de frappe — un zéro de trop — passe
 * dans le dénominateur d'un taux d'occupation sans rien allumer.
 */
export const TRAJET_MINUTES_MAXIMUM = 24 * 60;

/**
 * Ce qu'on a le droit d'écrire au catalogue — Zod, sur toute entrée serveur.
 *
 * **Zéro est refusé**, et ce n'est pas une coquetterie : *zéro se lit « l'agence
 * est sur place » là où il faut lire « je ne sais pas encore »*. Retirer une
 * valeur se fait en RETIRANT la ligne, ce qui rend la main au défaut — jamais en
 * écrivant zéro.
 *
 * **Et une zone sans estimation est refusée à l'écriture**, par la même source
 * que celle qui la fait afficher autrement. Le refus est au NIVEAU SERVEUR et
 * non en base : figer `zone <> 'iles'` dans un `CHECK` écrirait la géographie de
 * la Nouvelle-Calédonie dans le schéma, ce que `lib/sites/zones.ts` refuse
 * explicitement depuis D23 — et c'est l'objet de R3-04.
 */
export const schemaTrajetZone = z.object({
  zone: z.enum(ZONES_GEOGRAPHIQUES).refine(zoneAdmetUneEstimation),
  minutes: z.number().int().min(1).max(TRAJET_MINUTES_MAXIMUM),
});

export type EcritureTrajetZone = z.infer<typeof schemaTrajetZone>;

/** Retirer une valeur : la zone suffit, et la ligne s'en va. */
export const schemaRetraitTrajetZone = z.object({
  zone: z.enum(ZONES_GEOGRAPHIQUES),
});

/** Le catalogue d'une société, tel que le dépôt le rend. */
export type CatalogueTrajets = ReadonlyMap<string, number>;

/** D'où vient la valeur — et il n'y a pas de quatrième réponse. */
export type OrigineTrajet = "site" | "societe" | "defaut";

/**
 * Le temps de trajet d'un site, avec son ORIGINE — ou son absence, avec son
 * MOTIF.
 *
 * Les deux motifs d'absence ne se corrigent pas au même endroit, et c'est
 * pourquoi ils ne se confondent pas : `sans_zone` se corrige sur la FICHE DU
 * SITE — personne ne lui a donné de zone —, `sans_estimation` se corrige sur la
 * fiche aussi mais pour une autre raison : la zone n'admet pas de défaut, et
 * seule une valeur mesurée site par site répondra (D107).
 */
export type Trajet =
  | { readonly minutes: number; readonly origine: OrigineTrajet }
  | {
      readonly minutes: null;
      readonly motif: "sans_zone" | "sans_estimation";
    };

/**
 * LA CASCADE : la valeur du site, puis le réglage de la société, puis le défaut.
 *
 * **L'ordre des deux premiers tests n'est pas interchangeable.** La valeur du
 * site fait foi (D23), et une zone qui n'admet pas d'estimation ne doit jamais
 * masquer une mesure réelle : un site des Îles dont on a chronométré le trajet
 * rend ce chronomètre, pas le refus de la zone.
 *
 * **Et l'impossibilité se lit AVANT le catalogue.** Une ligne écrite à la main
 * dans une console pour une zone sans estimation ne rouvre donc rien : la
 * réponse reste `null`, et le refus de saisie n'est pas la seule chose qui la
 * tient. *Une garantie qui ne vit que dans la validation d'entrée n'en est pas
 * une.*
 */
export function resoudreTempsTrajet(
  site: {
    readonly temps_trajet_min: number | null;
    readonly zone_geo: string | null;
  },
  catalogue: CatalogueTrajets,
): Trajet {
  if (site.temps_trajet_min !== null) {
    return { minutes: site.temps_trajet_min, origine: "site" };
  }
  const zone = site.zone_geo;
  if (zone === null || !(zone in DEFAUTS_TRAJET_ZONE)) {
    return { minutes: null, motif: "sans_zone" };
  }
  const defaut = DEFAUTS_TRAJET_ZONE[zone as ZoneGeographique];
  if (defaut.nature === "sans_estimation") {
    return { minutes: null, motif: "sans_estimation" };
  }
  const regle = catalogue.get(zone);
  if (regle !== undefined) {
    return { minutes: regle, origine: "societe" };
  }
  return { minutes: defaut.minutes, origine: "defaut" };
}

/** Une ligne de l'écran de réglage : la zone, ce qu'elle vaut, et d'où. */
export type LigneCatalogue = {
  readonly zone: ZoneGeographique;
  readonly defaut: DefautZone;
  /** La valeur réglée par la société, si elle en a une. */
  readonly reglee: number | null;
  /** Ce qui s'applique aujourd'hui, et d'où cela vient. */
  readonly applique: Trajet;
};

/**
 * LES SIX ZONES, TOUJOURS LES SIX, dans l'ordre de D23.
 *
 * *Un écran qui n'afficherait que les zones réglées cacherait exactement ce
 * qu'on vient y chercher* — la zone dont personne ne s'est occupé. La liste est
 * donc celle de l'énumération, jamais celle du catalogue.
 */
export function catalogueAffichable(
  catalogue: CatalogueTrajets,
): readonly LigneCatalogue[] {
  return ZONES_GEOGRAPHIQUES.map((zone) => ({
    zone,
    defaut: DEFAUTS_TRAJET_ZONE[zone],
    reglee: catalogue.get(zone) ?? null,
    applique: resoudreTempsTrajet(
      { temps_trajet_min: null, zone_geo: zone },
      catalogue,
    ),
  }));
}
