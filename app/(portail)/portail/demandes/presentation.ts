import { type StatutDemande } from "@prisma/client";

import { versLocal, type Fuseau } from "@/lib/calendar/fuseau";
import { enDuree } from "@/lib/calendar/duree";
import { STATUTS_DEMANDE } from "@/lib/demandes/saisie";
import {
  dureesParEtat,
  type LigneHistoriqueEtat,
} from "@/lib/interventions/durees-par-etat";
import { t } from "@/lib/i18n/fr";
import { motDansUnePhrase } from "@/lib/i18n/vocabulaire";

/**
 * CE QUE L'ÉCRAN DES DEMANDES DU PORTAIL ÉCRIT, COMPOSÉ HORS DU JSX (L0-11).
 *
 * Même rangement que `app/(portail)/portail/presentation.ts` et
 * `app/(portail)/portail/contacts/presentation.ts`.
 */

/** « Les demandes que vous transmettez à votre agence et la suite qu'elle leur donne. » */
export function sousTitreDesDemandes(): string {
  return `${t("portail.demandes.sous_titre_avant")} ${motDansUnePhrase("agence")} ${t("portail.demandes.sous_titre_apres")}`;
}

/**
 * « DEM-2026-0029 », ou « Numéro provisoire » tant que le serveur ne l'a pas
 * attribué — même forme que `surtitreFiche`
 * (`app/(back-office)/demandes/presentation.ts`), écrite ici plutôt
 * qu'importée (§6, chaque domaine porte la sienne).
 */
export function identifiantDeLaDemande(
  numero: number | null,
  annee: number | null,
): string {
  return numero === null || annee === null
    ? t("demande.sans_numero")
    : `DEM-${annee}-${String(numero).padStart(4, "0")}`;
}

/** « JJ/MM/AAAA » LOCAL — même forme que `dateCourteLocale` (tableau de bord, L0-08). */
export function dateCourteLocale(instant: Date, fuseau: Fuseau): string {
  const local = versLocal(instant, fuseau);
  const jour = String(local.jour).padStart(2, "0");
  const mois = String(local.mois).padStart(2, "0");
  return `${jour}/${mois}/${local.annee}`;
}

/** Une ligne affichée de la section « Temps par état » d'une demande du portail. */
export type LigneTempsParEtatPortail = {
  readonly libelle: string;
  readonly duree: string;
  readonly enCours: boolean;
};

export type TempsParEtatPortail = {
  readonly lignes: readonly LigneTempsParEtatPortail[];
  /** Le message « disponible à partir du JJ/MM/AAAA » — `null` si complet. */
  readonly indisponibleAvant: string | null;
};

/**
 * LA SECTION « TEMPS PAR ÉTAT » D'UNE DEMANDE DU PORTAIL
 * (9J08B-PORTAIL-TEMPS-PAR-ETAT, CLI-2.4) — même calcul pur que
 * `tempsParEtatDeLIntervention` (`../interventions/presentation.ts`),
 * réécrit ici (§6, chaque domaine porte la sienne) avec les libellés
 * `demande.statut.<valeur>` DÉJÀ montrés par `LigneDemandeVue` (`./vue.tsx`),
 * jamais un libellé inventé.
 *
 * L'ORDRE affiché est l'ordre CANONIQUE de `STATUTS_DEMANDE`, pas l'ordre de
 * traversée — même motif que le back-office.
 */
export function tempsParEtatDeLaDemande(
  historique: readonly LigneHistoriqueEtat<StatutDemande>[],
  statutActuel: StatutDemande,
  maintenant: Date,
  fuseau: Fuseau,
): TempsParEtatPortail {
  const resultat = dureesParEtat(historique, statutActuel, maintenant);
  const lignes: LigneTempsParEtatPortail[] = STATUTS_DEMANDE.filter((etat) =>
    resultat.dureesCumuleesMs.has(etat),
  ).map((etat) => ({
    libelle: t(`demande.statut.${etat}`),
    duree: enDuree(
      Math.round((resultat.dureesCumuleesMs.get(etat) ?? 0) / 60_000),
    ),
    enCours: etat === resultat.etatCourant,
  }));
  return {
    lignes,
    indisponibleAvant:
      resultat.depuisLe === null
        ? `${t("portail.demandes.temps_par_etat.indisponible_avant")} ${dateCourteLocale(maintenant, fuseau)}`
        : resultat.historiqueIncomplet
          ? `${t("portail.demandes.temps_par_etat.indisponible_avant")} ${dateCourteLocale(resultat.depuisLe, fuseau)}`
          : null,
  };
}
