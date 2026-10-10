import type { TonBadge } from "@/components/ui/badge";
import { dateCivile } from "@/lib/calendar/fuseau";
import { libelleCodeExterne } from "@/lib/clients/code-externe";
import type { SitesDUnClient } from "@/lib/clients/depot";
import { t } from "@/lib/i18n/fr";
import { mot, motDansUnePhrase } from "@/lib/i18n/vocabulaire";

import { decompte, ouTiret } from "../presentation";

/**
 * CE QUE LES ÉCRANS « CLIENTS » COMPOSENT (14/09/2026).
 *
 * Module sans JSX, pour la raison de `sites/presentation.ts` : le gardien des
 * chaînes visibles (L0-11) scanne un fichier qui porte du JSX **en entier**, et
 * un gabarit qui assemble deux clés du dictionnaire y passerait pour du texte
 * en dur. *Le gardien a raison de ne pas savoir — c'est la DESTINATION d'un
 * texte qui décide, et il ne peut pas la lire.*
 */

/**
 * « Sans Code Winpro » — le titre du seul compteur de la liste.
 *
 * **Le mot « Winpro » n'est écrit nulle part** : le libellé du code de
 * rapprochement est une DONNÉE de la société (D29), lue en base, et le
 * dictionnaire ne porte que le libellé générique pour celle qui n'a pas nommé
 * son ERP. *Nommer une colonne — ou un compteur — d'après l'outil d'un seul
 * client est le défaut du 19/08 ; le produit est destiné à la vente.*
 */
export function titreSansCode(
  libelleSociete: string | null | undefined,
): string {
  return `${t("clients.sans_code_titre")} ${libelleCodeExterne(libelleSociete)}`;
}

/**
 * LA PREMIÈRE LIGNE DE LA CARTE — le code de rapprochement, puis la commune
 * (D123, N-08) : le pendant de « CLI-000184 · Nouméa » sur `entity-card`, au
 * POINT MÉDIAN mesuré sur cette carte — jamais le tiret cadratin générique
 * de `ponctuation.separateur` (voir sa propre note dans `lib/i18n/fr.ts`).
 *
 * **Un code ABSENT ne laisse jamais un séparateur orphelin.** *Mesuré à
 * l'écran le 18/09/2026* : `codeEtCommune(null, {communes:["Koné"], …})`
 * rendait `— · Koné` — le tiret de `ouTiret(null)` suivi du point médian,
 * qui se lit comme une panne d'affichage plutôt que comme une absence. La
 * commune, quand elle existe, se suffit alors à elle-même ; le tiret ne
 * paraît que si LES DEUX manquent — c'est la seule ligne qui aurait sinon
 * disparu complètement.
 *
 * **Une seule commune**, jamais la liste : `sitesParClient` les rend déjà
 * TRIÉES, et la bande de compteurs de la carte dit combien de lieux existent
 * — cette ligne-ci ne fait que SITUER le client, pas les compter une seconde
 * fois (D123 : deux projections d'une même donnée, jamais deux écritures du
 * même compte).
 */
export function codeEtCommune(
  codeExterne: string | null,
  sites: SitesDUnClient | undefined,
): string {
  const commune = sites?.communes[0];
  if (codeExterne === null) {
    return commune ?? ouTiret(null);
  }
  return commune === undefined
    ? codeExterne
    : `${codeExterne}${t("ponctuation.point_median")}${commune}`;
}

/**
 * LA COMMUNE SEULE, POUR LE FAIT D'EN-TÊTE DE LA FICHE (9EF-TP-UX4-2-
 * FICHES-1) — PAS `codeEtCommune` : le code externe est déjà le surtitre de
 * la fiche (« CLIENT · <code> »), l'écrire une seconde fois dans un fait
 * aurait affirmé le même renseignement deux fois sur le même écran.
 */
export function communeDuClient(sites: SitesDUnClient | undefined): string {
  return sites?.communes[0] ?? ouTiret(null);
}

/**
 * LA SECONDE LIGNE DE LA CARTE — le commercial référent, labellisé (D123).
 *
 * **`null` plutôt qu'une ligne « — »** : un référent absent est fréquent
 * (D29 le dit déjà du code de rapprochement), et une carte n'a pas de
 * colonne à tenir alignée comme un tableau — l'absence s'omet, elle ne
 * s'écrit pas en tiret (contrairement à `ouTiret`, réservé à une VALEUR dans
 * une ligne qui existe déjà).
 */
export function referentClient(
  commercialReferent: string | null,
): string | null {
  if (commercialReferent === null) {
    return null;
  }
  return `${t("client.commercial_referent")}${t("ponctuation.separateur")}${commercialReferent}`;
}

/**
 * Le compteur de sites d'intervention de la bande `entity-meta` (D123).
 *
 * TON FIXE — bleu, partout où ce compteur apparaît (PASTILLES-1) : la couleur
 * est portée ICI, jamais choisie par la page qui l'affiche.
 *
 * **Le libellé se COMPOSE, il ne s'écrit pas** (PASTILLES-1) : « site » est un
 * mot imposé (§3, D5/D47) qui ne s'écrit qu'une fois, sous `vocabulaire.site` —
 * `motDansUnePhrase` le lit en minuscule, la forme d'un libellé de compteur.
 */
export function compteurSites(sites: SitesDUnClient | undefined): {
  readonly valeur: number;
  readonly libelle: string;
  readonly ton: TonBadge;
} {
  const nombre = sites?.nombre ?? 0;
  return {
    valeur: nombre,
    libelle: motDansUnePhrase("site", nombre !== 1),
    ton: "bleu",
  };
}

/**
 * LE COMPTEUR D'ÉQUIPEMENTS DE LA CARTE (LISTES-1, 23/09/2026) — *« page
 * clients : même remarques que pour la liste sites »*, et la liste des sites
 * demandait le nombre d'équipements enregistrés. Compte TOUT équipement,
 * quel que soit son statut — la même notion, au mot près, que celle qui
 * filtre la liste par défaut (`equipementsParClient`, `lib/clients/depot.ts`).
 *
 * TON FIXE — gris (décision d'Alexis 26/09, remplace le rouge de
 * PASTILLES-1 : le rouge est réservé à ce qui demande une action) ; même ton
 * dans les deux fonctions.
 */
export function compteurEquipements(nombre: number): {
  readonly valeur: number;
  readonly libelle: string;
  readonly ton: TonBadge;
} {
  return {
    valeur: nombre,
    libelle:
      nombre === 1
        ? t("clients.equipements_un")
        : t("clients.equipements_plusieurs"),
    ton: "gris",
  };
}

/**
 * LA BANDE DE CHIFFRES DE LA CARTE CLIENT (QE-13c, 9EB-TP-UX3-2-LISTES-1) —
 * `CarteEntite.chiffres`, DISTINCTE de `compteurs` ci-dessus (pastilles
 * centrées, dépréciées sur cette carte précise par ce même ticket). Quatre
 * fonctions, quatre chiffres, dans l'ordre de la maquette : sites, machines,
 * à planifier, dernière intervention.
 */

/** Même nombre que `compteurSites`, sans ton — la bande de chiffres n'a pas de pastille. */
export function chiffreSites(sites: SitesDUnClient | undefined): {
  readonly valeur: number;
  readonly libelle: string;
} {
  const nombre = sites?.nombre ?? 0;
  return { valeur: nombre, libelle: motDansUnePhrase("site", nombre !== 1) };
}

/** Même nombre que `compteurEquipements`, sans ton. */
export function chiffreMachines(nombre: number): {
  readonly valeur: number;
  readonly libelle: string;
} {
  return {
    valeur: nombre,
    libelle:
      nombre === 1
        ? t("clients.equipements_un")
        : t("clients.equipements_plusieurs"),
  };
}

/**
 * « à planifier » — en orange dès qu'il y en a au moins une : c'est le
 * geste qui reste à faire, pas un simple compte (même esprit que le
 * compteur « Sans code » qu'il remplace sur cette carte).
 */
export function chiffreAPlanifier(nombre: number): {
  readonly valeur: number;
  readonly libelle: string;
  readonly ton?: "avertissement";
} {
  return {
    valeur: nombre,
    libelle: t("clients.chiffre_a_planifier"),
    ton: nombre > 0 ? "avertissement" : undefined,
  };
}

/**
 * « jj/mm » dans l'année en cours (fuseau de la société), « jj/mm/aaaa »
 * sinon, « — » si le client n'a aucune intervention datée — EXACTEMENT la
 * même notion que `derniereInterventionDuClient` (date désc, nulls en
 * dernier, puis id désc), jamais recalculée ici : `date` vient déjà de
 * `resumeDesCartesClients`. `aujourdHui` est REÇU (D85) — jamais `new Date()`.
 */
export function chiffreDerniereIntervention(
  date: Date | null,
  aujourdHui: Date,
): {
  readonly valeur: string;
  readonly libelle: string;
} {
  const valeur =
    date === null
      ? ouTiret(null)
      : date.getUTCFullYear() === aujourdHui.getUTCFullYear()
        ? dateCivile(date).slice(0, 5)
        : dateCivile(date);
  return {
    valeur,
    libelle: t("clients.fiche.synthese.derniere_intervention"),
  };
}

/** « Donneur d'ordre : X ». L'absence (orange) est décidée par la carte, jamais ici. */
export function libelleDonneurOrdre(nom: string): string {
  return `${t("clients.donneur_ordre_prefixe")}${t("ponctuation.deux_points")}${nom}`;
}

/**
 * « N clients pour « x », sans tenir compte des accents » — le complément du
 * résumé de liste (`ResumeListe`, `components/ui/puces-filtre.tsx`).
 * `texte` absent (`null`) : aucun complément.
 */
export function complementRechercheClients(
  texte: string | null,
): string | undefined {
  if (texte === null) {
    return undefined;
  }
  return `${t("clients.resume.recherche_prefixe")}${t("ponctuation.guillemet_ouvrant")}${texte}${t("ponctuation.guillemet_fermant")}${t("clients.resume.recherche_suffixe")}`;
}

/**
 * « N clients sans machine masqués » — même forme et même raison que
 * `phraseSitesMasques` (`app/(back-office)/sites/presentation.ts`) : posée
 * sous les filtres quand la case « Afficher aussi… » n'est PAS cochée et
 * qu'au moins un client est masqué (I-16/CS7).
 */
export function phraseClientsMasques(nombre: number): string {
  return decompte(
    nombre,
    `${t("clients.resultat_un")} ${t("clients.masques_suffixe_un")}`,
    `${t("clients.resultat")} ${t("clients.masques_suffixe_plusieurs")}`,
  );
}

/** « Afficher » — le texte du lien qui lève le masquage. */
export function libelleAfficherClientsMasques(): string {
  return t("clients.masques_afficher");
}

/**
 * « Créer et ajouter un site » — le bouton secondaire de `/clients/nouveau`
 * (9EK-TP-UX5-2-CREATIONS-1). « site » est un mot imposé (D5/D47) : il se
 * compose ici, jamais au dictionnaire.
 */
export function libelleCreerEtAjouterSite(): string {
  return `${t("clients.action.creer_et_ajouter_prefixe")} ${motDansUnePhrase("site")}`;
}

/**
 * « Un site : l'adresse où l'on intervient, sa zone (le trajet en dépend). »
 * — le premier élément de la colonne « Ensuite » (9EK-TP-UX5-2-CREATIONS-1).
 */
export function elementEnsuiteSite(): string {
  return `${t("clients.ensuite.site_prefixe")} ${mot("site")}${t("clients.ensuite.site_suffixe")}`;
}

/** Un client homonyme, tel que la recherche `/api/clients/homonymes` le rend. */
export type Homonyme = {
  readonly id: string;
  readonly raison_sociale: string;
  readonly commune: string | null;
  readonly nombreSites: number;
  readonly actif: boolean;
};

/**
 * LA LIGNE D'UN HOMONYME — « · <commune> · <N> site(s) » puis « · Inactif »
 * s'il l'est (9EK-TP-UX5-2-CREATIONS-1, CS40). `commune` s'omet s'il manque,
 * exactement comme `codeEtCommune` ci-dessus : une ligne qui existe déjà ne
 * laisse jamais un séparateur orphelin.
 */
export function ligneHomonyme(homonyme: Homonyme): string {
  const parties = [
    ...(homonyme.commune === null ? [] : [homonyme.commune]),
    `${homonyme.nombreSites} ${motDansUnePhrase("site", homonyme.nombreSites !== 1)}`,
    ...(homonyme.actif ? [] : [t("clients.inactif")]),
  ];
  return parties.join(t("ponctuation.point_median"));
}

/**
 * ── LES CINQ TUILES DE LA FICHE (9EF-TP-UX4-2-FICHES-1, décision 52) ───────
 *
 * Trois d'entre elles (Sites, Machines, Interventions ouvertes) suivent la
 * maquette du 28/09 (`tuileDecompte`, :3603) : à ZÉRO, la tuile reste SANS
 * `href` (D140 ne s'applique qu'au-dessus de zéro) et son détail dit ce qu'il
 * y a à en dire, jamais un chiffre nu. Les deux autres (Prochaine, Dernière)
 * n'ont jamais de `href` : elles pointent vers UNE fiche, jamais une liste.
 */

/** « Aucun site » — le détail de la tuile « Sites » à zéro. */
export function detailTuileSitesZero(): string {
  return `${t("clients.fiche.synthese.sites_zero_prefixe")} ${motDansUnePhrase("site")}`;
}

/**
 * Le détail de la tuile « Machines » — « N en panne ou arrêtée(s) » au-dessus
 * de zéro machine, « Aucune machine suivie » à zéro machine EN PARC (et non
 * zéro en panne : une seule machine à jour n'a rien à dire sur ce détail).
 */
export function detailTuileMachines(
  nombreMachines: number,
  nombreEnPanne: number,
): string | undefined {
  if (nombreMachines === 0) {
    return t("clients.fiche.synthese.machines_zero");
  }
  if (nombreEnPanne === 0) {
    return undefined;
  }
  return `${nombreEnPanne} ${
    nombreEnPanne === 1
      ? t("clients.fiche.synthese.machines_en_panne_un")
      : t("clients.fiche.synthese.machines_en_panne_plusieurs")
  }`;
}
