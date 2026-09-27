import { t } from "@/lib/i18n/fr";

/**
 * UNE DURÉE, JAMAIS UNE HEURE DU JOUR — « 45 min », « 1 h 30 », « 2 h 00 »
 * (GR14, audit GR du 26/09/2026, constat G17).
 *
 * Trois écrans (`interventions/[id]`, `interventions/[id]/bon`,
 * `terrain/[id]`) écrivaient chacun leur propre conversion minutes → heures,
 * et une seule des trois complétait les minutes à deux chiffres AVANT de
 * tester l'heure nulle — « 05 min » au lieu de « 5 min ». Une seule écriture,
 * ici, pour que les trois lisent la même chose.
 *
 * Distincte de `enHeure` (`./parametrage`), qui lit l'HEURE DU JOUR
 * (`HH:MM`) : les deux se complètent à deux chiffres, mais l'une compte un
 * point du jour et l'autre un intervalle — les confondre effacerait cette
 * différence de sens.
 */
export function enDuree(minutes: number): string {
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  if (heures === 0) {
    return `${reste} ${t("terrain.minutes")}`;
  }
  return `${heures} ${t("terrain.heures")} ${String(reste).padStart(2, "0")}`;
}
