import { t, type CleTraduction } from "@/lib/i18n/fr";

/**
 * CE QUI SERT L'INTERVENTION ET LE TERRAIN, ET NE DOIT VIVRE QU'UNE FOIS
 * (9F4H5B-JOURNEE-SANS-MONTANT, point 4).
 *
 * `jourEtDateAbregee` et `machinesAffichees` vivaient dans `app/(back-office)/
 * interventions/presentation.ts`, qui en reste le point d'entrée pour le
 * back-office (il les réexporte) — mais `components/terrain/liste-journee.tsx`
 * est un composant CLIENT, et un import depuis `app/(back-office)/` y tirait
 * tout ce fichier de 2000 lignes dans le paquet envoyé au téléphone. Une
 * seule écriture de chaque format, lue par les deux côtés (§9, 01/09) : la
 * déplacer ici évite de la dupliquer, ce que la même doctrine interdit tout
 * autant qu'un second import du back-office.
 */

/**
 * LE JOUR ABRÉGÉ D'UN JOUR CIVIL, SANS FUSEAU — `date_planifiee` est une
 * colonne `@db.Date`, un jour civil stocké à minuit UTC ; le lire dans un
 * fuseau le déplacerait d'un cran sous UTC+11.
 */
function jourAbregeDuJourCivil(date: Date): CleTraduction {
  switch (date.getUTCDay()) {
    case 0:
      return "intervention.resume.jour_abrege.dimanche";
    case 1:
      return "intervention.resume.jour_abrege.lundi";
    case 2:
      return "intervention.resume.jour_abrege.mardi";
    case 3:
      return "intervention.resume.jour_abrege.mercredi";
    case 4:
      return "intervention.resume.jour_abrege.jeudi";
    case 5:
      return "intervention.resume.jour_abrege.vendredi";
    default:
      return "intervention.resume.jour_abrege.samedi";
  }
}

/** « 25/09 » — le jour et le mois d'un jour civil, sans fuseau (voir ci-dessus). */
export function jourMois(date: Date): string {
  const jour = String(date.getUTCDate()).padStart(2, "0");
  const mois = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${jour}/${mois}`;
}

/**
 * « jeu. 25/09 », ou « jeu. 25/09/2025 » avec `avecAnnee` — le jour abrégé et
 * le jour civil. Lue par la fiche d'intervention (reprise d'un import, IN-23)
 * et par la carte « En retard » du terrain (« En retard · prévue jeu. 25/09 »).
 */
export function jourEtDateAbregee(date: Date, avecAnnee: boolean): string {
  const base = `${t(jourAbregeDuJourCivil(date))} ${jourMois(date)}`;
  return avecAnnee ? `${base}/${date.getUTCFullYear()}` : base;
}

/** Le signe d'absence — aucune machine affectée (RG-INT-01, dépannage à l'appel). */
export const ABSENT_MACHINE = "—";

/**
 * LES MACHINES D'UNE INTERVENTION — chaque exemplaire par son modèle, jamais
 * son numéro de série (une fiche `SN-INCONNU-…` n'aide pas à distinguer deux
 * exemplaires), jointes par une virgule, sans troncature (le chapitre 11.3 ne
 * borne nulle part le nombre de machines par intervention).
 */
export function machinesAffichees(
  ligne: { readonly machines: readonly { readonly machine_id: string }[] },
  libellesMachines: ReadonlyMap<string, string>,
): string {
  if (ligne.machines.length === 0) {
    return ABSENT_MACHINE;
  }
  return ligne.machines
    .map((m) => libellesMachines.get(m.machine_id) ?? ABSENT_MACHINE)
    .join(", ");
}
