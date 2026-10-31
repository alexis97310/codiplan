import { t } from "@/lib/i18n/fr";

import type { ModeDeValorisation, RegleArrondi } from "./valorisation";

/**
 * LES CONDITIONS DE FACTURATION, SANS AUCUN MONTANT (9I8B-CONDITIONS-DE-
 * FACTURATION-SANS-MONTANT, décisions d'Alexis du 29/10/2026) —
 * *« les conditions de facturation (forfait paramétré au préalable, prix
 * temps horaire, système de comptage du temps par palier…) doivent être
 * affichés lorsque le client signe, sur le bon d'intervention final »*,
 * mais *« gardons la règle initiale de ne pas montrer les montants sur le
 * bon »*. Ce module dit COMMENT l'intervention sera facturée, jamais
 * COMBIEN — aucun chiffre monétaire, aucune devise, aucun taux.
 *
 * ## FONCTION PURE
 *
 * Pas de base, pas de session : l'appelant (l'écran de signature du
 * technicien, le bon) a déjà résolu ce qui s'applique à CETTE intervention
 * — mode, libellés, règle, majoration — et cette fonction ne fait que les
 * mettre en phrases.
 *
 * ## LE FORFAIT DE PRESTATION N'A PAS DE LIBELLÉ AUJOURD'HUI
 *
 * **Mesuré (9I8B)** : rien ne sélectionne de forfait de PRESTATION sur une
 * intervention — seul `forfait_deplacement_id` existe en base
 * (`lib/tarification/valorisation.ts`, `exigeUnForfaitDePrestation`). Un
 * appelant qui passe `libelleForfait: null` en mode `forfait` ou
 * `forfait_plus_heures` obtient donc une phrase SANS libellé : ce n'est pas
 * une donnée manquante par accident, c'est l'état réel du dépôt tant que le
 * lot 2 (types d'intervention, catalogue de forfaits applicable) n'a pas
 * donné à une intervention de quoi en choisir un.
 */

/** Ce qui s'applique à UNE intervention — rien de plus que ce qu'il faut pour écrire les conditions. */
export type ConditionsFacturation = {
  readonly mode: ModeDeValorisation;
  /** Le forfait de PRESTATION retenu — `null` : voir l'entête du module. */
  readonly libelleForfait: string | null;
  /** Le forfait de déplacement (RG-INT-07) — `null` : aucun n'est retenu. */
  readonly libelleForfaitDeplacement: string | null;
  readonly regle: RegleArrondi;
  /**
   * La majoration hors ouverture (D12, D108) s'applique-t-elle à CETTE
   * intervention ? Un booléen, jamais le supplément lui-même — c'est tout ce
   * qu'une ligne sans montant a besoin de savoir.
   */
  readonly majorationApplicable: boolean;
};

/** Le mode facture-t-il de la main-d'œuvre à l'heure ? Même critère que `valorisation.ts`. */
function factureDesHeures(mode: ModeDeValorisation): boolean {
  return mode === "temps_passe" || mode === "forfait_plus_heures";
}

/** Le mode porte-t-il un forfait de PRESTATION ? Même critère que `valorisation.ts`. */
function porteUnForfait(mode: ModeDeValorisation): boolean {
  return mode === "forfait" || mode === "forfait_plus_heures";
}

function phrasePlancher(plancherMinutes: number): string {
  if (plancherMinutes === 60) {
    return t("tarification.conditions.temps_passe.plancher_heure");
  }
  return (
    t("tarification.conditions.temps_passe.plancher_minutes_avant") +
    plancherMinutes +
    t("tarification.conditions.temps_passe.plancher_minutes_apres")
  );
}

function phraseSeuil(seuilPalierMinutes: number): string {
  if (seuilPalierMinutes === 1) {
    return t("tarification.conditions.temps_passe.seuil_un");
  }
  return (
    t("tarification.conditions.temps_passe.seuil_prefixe") +
    seuilPalierMinutes +
    t("tarification.conditions.temps_passe.seuil_suffixe")
  );
}

function phraseRegle(regle: RegleArrondi): string {
  return (
    phrasePlancher(regle.plancherMinutes) +
    t("tarification.conditions.temps_passe.au_dela") +
    regle.palierMinutes +
    t("tarification.conditions.temps_passe.palier_suffixe") +
    phraseSeuil(regle.seuilPalierMinutes)
  );
}

function phraseForfait(libelle: string | null): string {
  if (libelle === null) {
    return t("tarification.conditions.forfait.sans_libelle");
  }
  return (
    t("tarification.conditions.forfait.avec_libelle_avant") +
    libelle +
    t("tarification.conditions.forfait.avec_libelle_apres")
  );
}

function phraseDeplacement(libelle: string): string {
  return (
    t("tarification.conditions.deplacement_avant") +
    libelle +
    t("tarification.conditions.deplacement_apres")
  );
}

/**
 * LES LIGNES DE TEXTE DES CONDITIONS DE FACTURATION — aucun chiffre
 * monétaire, aucune devise, aucun taux. L'ORDRE est celui de D11 : la
 * main-d'œuvre d'abord (si le mode en facture), le forfait ensuite (s'il y
 * en a un), le déplacement, puis la majoration — même ordre que
 * `valoriserIntervention` compose le total, pour que la liste se lise comme
 * la facture qu'elle décrit sans en donner le chiffre.
 */
export function conditionsDeFacturation(
  entree: ConditionsFacturation,
): readonly string[] {
  const lignes: string[] = [];
  if (factureDesHeures(entree.mode)) {
    lignes.push(t("tarification.conditions.temps_passe.intro"));
    lignes.push(phraseRegle(entree.regle));
  }
  if (porteUnForfait(entree.mode)) {
    lignes.push(phraseForfait(entree.libelleForfait));
  }
  if (entree.libelleForfaitDeplacement !== null) {
    lignes.push(phraseDeplacement(entree.libelleForfaitDeplacement));
  }
  if (entree.majorationApplicable) {
    lignes.push(t("tarification.conditions.majoration"));
  }
  return lignes;
}
