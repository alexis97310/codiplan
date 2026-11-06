import { type StatutIntervention } from "@prisma/client";

import { dateCivile, versLocal, type Fuseau } from "@/lib/calendar/fuseau";
import { enDuree } from "@/lib/calendar/duree";
import {
  dureesParEtat,
  type LigneHistoriqueEtat,
} from "@/lib/interventions/durees-par-etat";
import { STATUTS_INTERVENTION } from "@/lib/interventions/saisie";
import { t } from "@/lib/i18n/fr";
import { mot, motDansUnePhrase } from "@/lib/i18n/vocabulaire";

import { type InterventionDuPortail } from "./depot";

/**
 * CE QUE L'ÉCRAN DES INTERVENTIONS DU PORTAIL ÉCRIT, COMPOSÉ HORS DU JSX
 * (L0-11) — même rangement que `../presentation.ts` et
 * `../demandes/presentation.ts` : chaque domaine porte la sienne (§6).
 */

const TIRET = "—";

/** « INT-2026-0123 », ou « Numéro provisoire » tant que le serveur ne l'a pas attribué (I10). */
export function identifiantDeLIntervention(
  numero: number | null,
  annee: number | null,
): string {
  return numero === null || annee === null
    ? t("intervention.sans_numero")
    : `INT-${annee}-${String(numero).padStart(4, "0")}`;
}

/** « L'état de vos interventions, telles que votre agence les suit. » */
export function sousTitreDesInterventions(): string {
  return `${t("portail.interventions.sous_titre_avant")} ${motDansUnePhrase("agence")} ${t("portail.interventions.sous_titre_apres")}`;
}

/** « 03/04/2026 », ou « Date à confirmer » tant qu'aucune date n'est posée. */
export function dateDeLIntervention(
  intervention: InterventionDuPortail,
): string {
  return intervention.datePlanifiee === null
    ? t("portail.interventions.sans_date")
    : dateCivile(intervention.datePlanifiee);
}

/** « <référence> », repris au surtitre de la fiche — MÊME texte qu'à la liste. */
export function titreDeLaFicheIntervention(
  intervention: InterventionDuPortail,
): string {
  return `${t("intervention.titre")} ${identifiantDeLIntervention(intervention.numero, intervention.annee)}`;
}

/** « Site : Atelier principal », à partir de la carte des sites déjà lus (`parcDuClient`). */
export function siteDeLIntervention(
  siteId: string,
  libelleParId: ReadonlyMap<string, string>,
): string {
  return `${mot("site")} ${t("ponctuation.deux_points")} ${libelleParId.get(siteId) ?? TIRET}`;
}

/** « JJ/MM/AAAA » LOCAL — même forme que `dateCourteLocale` des demandes (§6, chaque domaine porte la sienne). */
function dateLocaleCourte(instant: Date, fuseau: Fuseau): string {
  const local = versLocal(instant, fuseau);
  const jour = String(local.jour).padStart(2, "0");
  const mois = String(local.mois).padStart(2, "0");
  return `${jour}/${mois}/${local.annee}`;
}

/** Une ligne affichée de la section « Temps par état » du portail. */
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
 * LA SECTION « TEMPS PAR ÉTAT » DE LA FICHE INTERVENTION DU PORTAIL
 * (9J08B-PORTAIL-TEMPS-PAR-ETAT, CLI-2.4) — même calcul que la tuile du
 * back-office (`tempsParEtatAffiche`, `app/(back-office)/interventions/
 * presentation.ts`), réécrit ici plutôt qu'importé (§6, chaque domaine porte
 * la sienne) et avec les libellés `statut.<valeur>` DÉJÀ montrés par cette
 * fiche (voir `PageFicheInterventionPortail`), jamais un libellé inventé.
 *
 * L'ORDRE affiché est l'ordre CANONIQUE de `STATUTS_INTERVENTION`, pas
 * l'ordre de traversée — même motif que le back-office : un état traversé
 * deux fois ne doit apparaître qu'une fois, avec son total cumulé.
 */
export function tempsParEtatDeLIntervention(
  historique: readonly LigneHistoriqueEtat<StatutIntervention>[],
  statutActuel: StatutIntervention,
  maintenant: Date,
  fuseau: Fuseau,
): TempsParEtatPortail {
  const resultat = dureesParEtat(historique, statutActuel, maintenant);
  const lignes: LigneTempsParEtatPortail[] = STATUTS_INTERVENTION.filter(
    (etat) => resultat.dureesCumuleesMs.has(etat),
  ).map((etat) => ({
    libelle: t(`statut.${etat}`),
    duree: enDuree(
      Math.round((resultat.dureesCumuleesMs.get(etat) ?? 0) / 60_000),
    ),
    enCours: etat === resultat.etatCourant,
  }));
  return {
    lignes,
    indisponibleAvant:
      resultat.depuisLe === null
        ? `${t("portail.interventions.temps_par_etat.indisponible_avant")} ${dateLocaleCourte(maintenant, fuseau)}`
        : resultat.historiqueIncomplet
          ? `${t("portail.interventions.temps_par_etat.indisponible_avant")} ${dateLocaleCourte(resultat.depuisLe, fuseau)}`
          : null,
  };
}
