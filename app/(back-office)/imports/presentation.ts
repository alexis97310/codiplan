import { versLocal, type Fuseau } from "@/lib/calendar/fuseau";
import type { Designation } from "@/lib/auth/annuaire";
import type { Decomptes } from "@/lib/imports/depot";
import type { ComptesParRang } from "@/lib/imports/rapport-historique";
import type { ComptesDeRattachementVgp } from "@/lib/imports/rapport-vgp";
import type { MotifNonRattachee } from "@/lib/imports/reprise";
import type { MotifAttente } from "@/lib/imports/vgp";
import { t, type CleTraduction } from "@/lib/i18n/fr";

/**
 * LES COMPOSITIONS DE L'ÉCRAN D'IMPORT (L1-11).
 *
 * Elles sortent du JSX : *un littéral n'y est pas admis* (L0-11), et ce qui se
 * lit à l'écran vient du dictionnaire, jamais de la balise.
 */

/** Un instant, dans le fuseau de la société — jamais dans celui du serveur. */
export function instantLisible(instant: Date, fuseau: Fuseau): string {
  const local = versLocal(instant, fuseau);
  const deux = (n: number): string => String(n).padStart(2, "0");
  return `${deux(local.jour)}/${deux(local.mois)}/${local.annee} ${deux(local.heures)}:${deux(local.minutes)}`;
}

/**
 * Le nom d'une personne, ou ce qui tient lieu de nom.
 *
 * **Les deux absences ne rendent pas la même chose**, et c'est tout l'objet de
 * `Designation` : *« la politique refuse » est légitime et le reste ; « je n'ai
 * pas demandé » est une anomalie et se lit comme telle* (14/09/2026). Ici la
 * seconde ne peut pas se produire — la liste demande l'auteur de chaque lot
 * qu'elle rend — et c'est précisément pourquoi elle doit être DISTINGUABLE :
 * si elle se produisait, elle dirait un défaut de ce module.
 */
export function nomDeLAuteur(designation: Designation): string {
  switch (designation.etat) {
    case "nom":
      return designation.nom;
    case "refusee":
      return t("imports.auteur_non_communique");
    case "non_demandee":
      return t("imports.auteur_non_demande");
  }
}

/**
 * LES SIX DÉCOMPTES DU RAPPORT, DANS L'ORDRE DE LA MAQUETTE.
 *
 * **Ils vivent ici et non dans l'écran**, pour la raison exacte de
 * `lib/navigation/portes-parametrage.ts` : *le gardien des chaînes en dur
 * (L0-11) lit un fichier qui porte du JSX et prend ses littéraux pour du texte
 * visible* — un tableau de clés n'en est pas, et il a raison de ne pas savoir.
 *
 * **« INCHANGÉES » EXISTE DEPUIS LE 16/09/2026, et ce fichier disait le
 * contraire jusque-là** : *« notre rapport ne mesure pas cette catégorie ».*
 * C'était vrai tant qu'aucun chemin ne savait comparer une ligne à la fiche
 * qu'elle vise — le CONTRÔLE ne le pouvait pas, lui qui ne touche jamais la
 * base. **Ce n'est plus le contrôle qui le mesure : c'est l'APPLICATION**
 * (`porteEncore`, `lib/imports/application.ts`), et c'est pourquoi ce
 * sixième chiffre vaut zéro tant que le lot reste `controle` — *une ligne
 * classée MODIFICATION n'est pas encore sue « inchangée », elle l'est
 * seulement une fois comparée à ce qu'elle vise réellement.* Le motif du 06/09
 * reste valable pour ce qu'il protégeait : *une ligne qu'aucune mesure ne
 * produit n'est jamais présentée à côté de celles qui le sont* — et
 * « inchangées » EST désormais une mesure, faite plus tard que les cinq
 * autres plutôt qu'en même temps qu'elles.
 */
export type LigneDeResultat = {
  readonly cle: string;
  readonly libelle: CleTraduction;
  readonly detail: CleTraduction;
  readonly valeur: number;
};

export function lignesDeResultat(
  decomptes: Decomptes,
): readonly LigneDeResultat[] {
  return [
    {
      cle: "creations",
      libelle: "imports.creations",
      detail: "imports.creations_detail",
      valeur: decomptes.creations,
    },
    {
      cle: "modifications",
      libelle: "imports.modifications",
      detail: "imports.modifications_detail",
      valeur: decomptes.modifications,
    },
    {
      cle: "inchangees",
      libelle: "imports.inchangees",
      detail: "imports.inchangees_detail",
      valeur: decomptes.inchangees,
    },
    {
      cle: "rejets",
      libelle: "imports.rejets",
      detail: "imports.rejets_detail",
      valeur: decomptes.rejets,
    },
    {
      cle: "gabarits",
      libelle: "imports.gabarits",
      detail: "imports.gabarits_detail",
      valeur: decomptes.gabarits,
    },
    {
      cle: "vides",
      libelle: "imports.vides",
      detail: "imports.vides_detail",
      valeur: decomptes.vides,
    },
  ];
}

/** L'entête d'un lot : l'instant, puis l'auteur, séparés une fois pour toutes. */
export function coordonneesDuLot(
  instant: Date,
  fuseau: Fuseau,
  auteur: Designation,
): string {
  return `${instantLisible(instant, fuseau)}${t("ponctuation.separateur")}${nomDeLAuteur(auteur)}`;
}

/**
 * LES QUATRE COMPTES DU RATTACHEMENT D'UN LOT D'HISTORIQUE, DANS L'ORDRE DES
 * RANGS (REPRISE-HISTORIQUE ; D127).
 *
 * Même forme que `lignesDeResultat`, et pour la même raison : *le gardien des
 * chaînes en dur lit un fichier qui porte du JSX et prend ses littéraux pour du
 * texte visible* — un tableau de clés n'en est pas. Le quatrième compte est
 * la LONGUEUR de la liste des non-rattachées : il ne peut pas diverger d'elle.
 */
export function lignesDeRattachement(
  comptes: ComptesParRang,
): readonly LigneDeResultat[] {
  return [
    {
      cle: "sans_serie",
      libelle: "imports.rattachement.sans_serie",
      detail: "imports.rattachement.sans_serie_detail",
      valeur: comptes.sansSerie,
    },
    {
      cle: "rang1",
      libelle: "imports.rattachement.rang1",
      detail: "imports.rattachement.rang1_detail",
      valeur: comptes.rang1,
    },
    {
      cle: "rang2",
      libelle: "imports.rattachement.rang2",
      detail: "imports.rattachement.rang2_detail",
      valeur: comptes.rang2,
    },
    {
      cle: "rang3",
      libelle: "imports.rattachement.rang3",
      detail: "imports.rattachement.rang3_detail",
      valeur: comptes.nonRattachees.length,
    },
  ];
}

/** Le libellé d'un motif de non-rattachement — un CODE du rapprochement, une clé ici. */
export function cleDuMotifDeRattachement(
  motif: MotifNonRattachee,
): CleTraduction {
  switch (motif) {
    case "serie_inconnue":
      return "imports.rattachement.serie_inconnue";
    case "serie_ambigue":
      return "imports.rattachement.serie_ambigue";
    case "serie_autre_client":
      return "imports.rattachement.serie_autre_client";
  }
}

/**
 * LES COMPTES DE RATTACHEMENT D'UN LOT DE VGP (VGP-IMPORT ; arbitrage 3).
 *
 * Trois lignes : ce qui entre sous sa machine, ce qui ATTEND — retenu, pas
 * refusé —, et les vrais rejets. *Le total des trois explique chaque ligne de
 * données du fichier.*
 */
export function lignesDeRattachementVgp(
  comptes: ComptesDeRattachementVgp,
): readonly LigneDeResultat[] {
  return [
    {
      cle: "rattachees",
      libelle: "imports.vgp.rattachees",
      detail: "imports.vgp.rattachees_detail",
      valeur: comptes.rattachees,
    },
    {
      cle: "en_attente",
      libelle: "imports.vgp.en_attente",
      detail: "imports.vgp.en_attente_detail",
      valeur: comptes.enAttente.length,
    },
    {
      cle: "autres_rejets",
      libelle: "imports.vgp.autres_rejets",
      detail: "imports.vgp.autres_rejets_detail",
      valeur: comptes.autresRejets,
    },
  ];
}

/** Le libellé COURT d'un motif d'attente — un CODE du gabarit, une clé ici. */
export function cleDuMotifDAttente(motif: MotifAttente): CleTraduction {
  switch (motif) {
    case "a_rattacher_sans_serie":
      return "imports.vgp.attente.sans_serie";
    case "a_rattacher_serie_inconnue":
      return "imports.vgp.attente.serie_inconnue";
    case "a_rattacher_serie_ambigue":
      return "imports.vgp.attente.serie_ambigue";
    case "a_rattacher_serie_autre_client":
      return "imports.vgp.attente.serie_autre_client";
  }
}
