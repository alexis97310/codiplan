/**
 * CRÉNEAUX SANS CHEVAUCHEMENT ENTRE SCÈNES (9L19, garde `intervention_sans_
 * chevauchement_technicien`).
 *
 * *Mesuré le 21/11/2026 (9L19SB) : plusieurs fichiers de scénario,
 * indépendants les uns des autres, partageaient la même convention —
 * `technicienDucos`, AUJOURD'HUI, `20:00–21:00` UTC — pour poser une
 * intervention hors ouverture sans avoir besoin d'une heure précise. Avant
 * cette garde, le partage ne coûtait rien : chaque fichier nettoie sa propre
 * ligne en `afterAll`. La garde EXIGE désormais qu'aucune ligne active du
 * même technicien ne recouvre une autre, y compris entre deux fichiers qui
 * ne se connaissent pas — `23P01 conflicting key value violates exclusion
 * constraint`.*
 *
 * Cette fonction ne résout rien par magie : elle donne juste à chaque scène
 * un moyen court de poser SON heure, distincte des autres. C'est l'appelant
 * qui choisit une heure qu'aucun autre fichier ne réclame déjà — jamais cette
 * fonction, qui ne connaît rien des autres fichiers.
 */
export function creneauUtc(
  cleJour: string,
  heureDebutUtc: number,
  dureeMin = 60,
): { readonly creneau_debut: Date; readonly creneau_fin: Date } {
  const debut = new Date(
    `${cleJour}T${String(heureDebutUtc).padStart(2, "0")}:00:00.000Z`,
  );
  return {
    creneau_debut: debut,
    creneau_fin: new Date(debut.getTime() + dureeMin * 60_000),
  };
}
