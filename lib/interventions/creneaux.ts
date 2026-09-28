import type { Calendrier } from "@/lib/calendar/calendrier";
import { creneauxDuJour } from "@/lib/calendar/ouverture";
import type { JourLocal } from "@/lib/calendar/fuseau";

/**
 * LES DÉBUTS DE CRÉNEAU POSSIBLES POUR UN TECHNICIEN, UN JOUR ET UNE DURÉE
 * (PG-B1, spécification §3.10).
 *
 * **Module pur** : il ne lit ni la base ni le contexte cloisonné — les
 * plages ouvertes (`Calendrier`), le pas de grille de l'agence, les
 * interventions déjà posées ce jour-là et l'absence éventuelle sont fournis
 * par l'appelant, sous le contexte cloisonné (la route `verdict-pose`).
 *
 * **Le pas est celui du calendrier, jamais inventé** (§3.10) : c'est
 * `calendrier.pas_creneau_minutes`, lu par l'appelant, qui fixe l'écart entre
 * deux débuts proposés dans une même plage ouverte.
 */

/** Une intervention déjà posée ce jour-là, telle qu'occupation à éviter. */
export type OccupationDuJour = {
  readonly debut: Date;
  readonly fin: Date;
};

export type ParametresCreneaux = {
  /** Le calendrier de l'AGENCE de l'intervention — jamais celui du technicien. */
  readonly calendrier: Calendrier;
  readonly jour: JourLocal;
  readonly dureeMin: number;
  readonly pasMinutes: number;
  /** Les créneaux déjà occupés du technicien visé, ce jour-là. */
  readonly occupations: readonly OccupationDuJour[];
  /** Une absence validée couvre-t-elle ce jour ? Alors aucun créneau. */
  readonly absent: boolean;
  /** L'instant présent, dans le fuseau de l'agence (`maintenant(fuseau)`). */
  readonly maintenant: Date;
};

/**
 * Les débuts de créneau, en instants, dans l'ordre chronologique.
 *
 * Un début n'est retenu que si la durée demandée tient ENTIÈREMENT dans la
 * plage ouverte, ne chevauche aucune occupation, et n'est pas dans le passé —
 * comparé à `maintenant` quand le jour visé est celui d'aujourd'hui, la
 * comparaison d'instants suffit pour tout autre jour.
 */
export function creneauxDisponibles(
  parametres: ParametresCreneaux,
): readonly Date[] {
  const {
    calendrier,
    jour,
    dureeMin,
    pasMinutes,
    occupations,
    absent,
    maintenant,
  } = parametres;

  if (absent || dureeMin <= 0 || pasMinutes <= 0) {
    return [];
  }

  const dureeMs = dureeMin * 60_000;
  const pasMs = pasMinutes * 60_000;
  const maintenantMs = maintenant.getTime();

  const resultats: Date[] = [];
  for (const plage of creneauxDuJour(calendrier, jour)) {
    const finPlageMs = plage.fin.getTime();
    for (
      let debutMs = plage.debut.getTime();
      debutMs + dureeMs <= finPlageMs;
      debutMs += pasMs
    ) {
      if (debutMs < maintenantMs) {
        continue;
      }
      const finMs = debutMs + dureeMs;
      const libre = occupations.every(
        (occupation) =>
          debutMs >= occupation.fin.getTime() ||
          finMs <= occupation.debut.getTime(),
      );
      if (libre) {
        resultats.push(new Date(debutMs));
      }
    }
  }
  return resultats;
}
