import { dateCivile, versLocal, type Fuseau } from "@/lib/calendar/fuseau";
import { t } from "@/lib/i18n/fr";

/**
 * CE QUE LA FICHE ET LA CARTE DU TERRAIN COMPOSENT, PARTAGÉ (9DI-TP-TER1-
 * JOURNEE-FICHE, QE-11).
 *
 * Une seule écriture de chaque critère, lue par les deux écrans — jamais
 * recomposée à part dans l'un ou l'autre (§9, 01/09).
 */

/**
 * `HH:MM`, dans le fuseau donné — jamais celui de l'appareil (L0-08).
 * Exportée : le bandeau « compteur en cours » (`bandeau-compteur.tsx`) en a
 * besoin pour l'heure de départ, hors de tout créneau.
 */
export function heureLocale(instant: Date, fuseau: Fuseau): string {
  const local = versLocal(instant, fuseau);
  return `${String(local.heures).padStart(2, "0")}:${String(local.minutes).padStart(2, "0")}`;
}

/**
 * LE CRÉNEAU DE LA FICHE — « HH:MM – HH:MM », ou la date seule quand aucun
 * créneau n'est posé (une intervention datée sans heure existe : c'est la
 * file de planification transmise malgré tout).
 */
export function creneauDeLaFiche(
  ligne: {
    readonly date_planifiee: Date | null;
    readonly creneau_debut: Date | null;
    readonly creneau_fin: Date | null;
  },
  fuseau: Fuseau,
): string {
  if (ligne.creneau_debut === null) {
    return ligne.date_planifiee === null
      ? t("terrain.inconnu")
      : dateCivile(ligne.date_planifiee);
  }
  const debut = heureLocale(ligne.creneau_debut, fuseau);
  if (ligne.creneau_fin === null) {
    return debut;
  }
  return `${debut} – ${heureLocale(ligne.creneau_fin, fuseau)}`;
}

/**
 * LA PREMIÈRE LIGNE D'UNE PANNE SIGNALÉE — pour la carte de Ma journée, où
 * le texte complet déborderait. `null` dès que la description est vide ou
 * absente : une carte ne montre jamais un bloc muet.
 */
export function premiereLignePanne(description: string | null): string | null {
  if (description === null) {
    return null;
  }
  const premiere = description.split("\n")[0]?.trim() ?? "";
  return premiere.length === 0 ? null : premiere;
}

/**
 * LE CONTACT AFFICHÉ — son nom, et ses numéros (téléphone ET mobile s'ils
 * diffèrent, un seul s'ils sont égaux ou qu'un seul est renseigné, aucun
 * sinon). `null` dès qu'aucun contact n'est désigné : la fiche ne montre
 * alors rien, plutôt qu'un bloc vide.
 */
export type ContactAffiche = {
  readonly nom: string;
  readonly numeros: readonly string[];
};

export function contactAffiche(
  contact: {
    readonly nom: string;
    readonly telephone: string | null;
    readonly mobile: string | null;
  } | null,
): ContactAffiche | null {
  if (contact === null) {
    return null;
  }
  const numeros = [
    ...new Set(
      [contact.telephone, contact.mobile].filter(
        (valeur): valeur is string => valeur !== null,
      ),
    ),
  ];
  return { nom: contact.nom, numeros };
}
