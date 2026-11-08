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
import type { MachineDuPortail } from "@/lib/portail/depot";

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

/**
 * « Votre demande DEM-2026-0029 est enregistrée. » — LE BANDEAU DE SUCCÈS DU
 * DÉPÔT (9K03), avec le numéro dès qu'il est attribué (il l'est toujours à ce
 * point : le dépôt portail est synchrone). Sans lui, le texte générique
 * existant (`portail.demandes.cree`) — même discipline que
 * `identifiantDeLaDemande`, qu'elle réutilise plutôt que de la recomposer.
 */
export function confirmationDuDepot(
  numero: number | null,
  annee: number | null,
): string {
  return numero === null || annee === null
    ? t("portail.demandes.cree")
    : `${t("portail.demandes.cree.avant")} ${identifiantDeLaDemande(numero, annee)} ${t("portail.demandes.cree.apres")}`;
}

/**
 * LA MACHINE PRÉ-CHOISIE DEPUIS SA FICHE (9K03) — REVÉRIFIÉE ICI contre le
 * parc DÉJÀ LU sous le contexte cloisonné, jamais crue sur parole depuis le
 * paramètre d'URL `machine_id`. `machines` vient de `parcDuClient` (forme
 * « parc ») : une machine d'un autre client ou d'un autre périmètre de sites
 * n'y figure JAMAIS (éprouvé par `tests/isolation/portail-client.test.ts` et
 * `tests/isolation/9j06-portail-fiche-machine.test.ts`) — cette fonction n'a
 * donc qu'à vérifier l'appartenance à CETTE liste, jamais une seconde
 * comparaison de client ou de société.
 */
export function machinePreselectionneeValide(
  machineIdBrut: string | string[] | undefined,
  machines: readonly MachineDuPortail[],
): string | undefined {
  return typeof machineIdBrut === "string" &&
    machines.some((machine) => machine.id === machineIdBrut)
    ? machineIdBrut
    : undefined;
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
