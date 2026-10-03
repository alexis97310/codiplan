import type { Fuseau, JourLocal } from "@/lib/calendar/fuseau";
import { versLocal } from "@/lib/calendar/fuseau";
import type { LigneAttribution } from "@/lib/habilitations/depot";

/**
 * CE QUE L'ÉCRAN AFFICHE — jamais une décision de blocage.
 *
 * Extraite de `page.tsx` (D-13) : un `page.tsx` de l'App Router n'accepte que
 * les exports que Next.js reconnaît (`default`, `metadata`, …) — mesuré à la
 * compilation, `pnpm build` refuse `estExpiree` exportée depuis la page avec
 * « n'est pas un champ d'export de Page valide ». Même raisonnement que
 * `referenceAffichee` dans `app/(back-office)/interventions/presentation.ts` :
 * un fichier voisin, pas un composant, pour que la fonction reste testable
 * sans navigateur.
 *
 * **Le jugement « expirée » compare le jour LOCAL, jamais le jour UTC** — la
 * portée est l'affichage, et seulement lui. `lib/habilitations/affectation.ts`
 * (RG-PLA-04) ne dérive rien de « maintenant » : il compare à la date de
 * l'intervention, et cette fonction ne le remplace jamais.
 */
export function estExpiree(
  attribution: LigneAttribution,
  aujourdHui: JourLocal,
): boolean {
  if (attribution.date_expiration === null) {
    return false;
  }
  const expiration = Date.UTC(
    attribution.date_expiration.getUTCFullYear(),
    attribution.date_expiration.getUTCMonth(),
    attribution.date_expiration.getUTCDate(),
  );
  const jourCourant = Date.UTC(
    aujourdHui.annee,
    aujourdHui.mois - 1,
    aujourdHui.jour,
  );
  return expiration < jourCourant;
}

/**
 * UN INSTANT, EN « JJ/MM à HH:MM » LOCAL — l'état d'accès d'un technicien
 * (D162, 9DJ-TP-ACC1-DONNER-ACCES).
 *
 * Un événement d'accès (`journal_acces.horodatage`) est un INSTANT, pas un
 * jour civil : `dateCivile` ne convient pas, voir `dateHeureLocale` de
 * `app/(back-office)/interventions/presentation.ts`, dont cette fonction est
 * la variante SANS année — le ticket ne demande que « JJ/MM à HH:MM ».
 */
export function dateHeureCourte(instant: Date, fuseau: Fuseau): string {
  const local = versLocal(instant, fuseau);
  const jour = String(local.jour).padStart(2, "0");
  const mois = String(local.mois).padStart(2, "0");
  const heures = String(local.heures).padStart(2, "0");
  const minutes = String(local.minutes).padStart(2, "0");
  return `${jour}/${mois} à ${heures}:${minutes}`;
}
