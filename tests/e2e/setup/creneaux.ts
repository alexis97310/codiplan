import { PrismaClient } from "@prisma/client";

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

/**
 * 9L44B — UN CRÉNEAU GARANTI LIBRE, QUELLE QUE SOIT L'HEURE OU LE JOUR.
 *
 * `creneauUtc` fige une heure UTC sur un jour calculé AU MOMENT DE
 * L'EXÉCUTION (« aujourd'hui », « hier », …) : elle ne sait rien du semis de
 * démonstration (`INTERVENTIONS_DEMONSTRATION`, `prisma/seed-data.ts`), qui
 * pose sur CHAQUE technicien un créneau FIXE différent chaque jour de la
 * semaine. Une scène qui choisit son heure sans relire ce que le technicien
 * tient déjà collisionne selon l'heure ET le jour où la suite tourne —
 * `23P01`, la contrainte d'exclusion `intervention_sans_chevauchement_
 * technicien` (9L19) — un échec que rien, dans le fichier qui le subit, ne
 * laisse deviner.
 *
 * Cette fonction RELIT les créneaux déjà posés pour ce technicien (hors
 * `annulee`, même filtre que la contrainte) et recule par pas de `pasMin`
 * depuis `debutSouhaite` jusqu'à trouver `dureeMin` minutes totalement
 * libres. Elle n'invente rien : si `debutSouhaite` est déjà libre, elle le
 * rend tel quel. Appelée juste avant l'INSERT qu'elle sert — jamais en
 * avance sur d'autres lignes que LA MÊME scène s'apprête à poser pour ce
 * même technicien, puisqu'elle ne voit que ce qui est déjà COMMIT en base.
 */
export async function creneauLibreDepuis(
  client: PrismaClient,
  societeId: string,
  technicienId: string,
  debutSouhaite: Date,
  dureeMin: number,
  pasMin = 30,
): Promise<{ readonly creneau_debut: Date; readonly creneau_fin: Date }> {
  const occupees = await client.intervention.findMany({
    where: {
      societe_id: societeId,
      technicien_id: technicienId,
      statut: { not: "annulee" },
      creneau_debut: { not: null },
      creneau_fin: { not: null },
    },
    select: { creneau_debut: true, creneau_fin: true },
  });
  let debut = debutSouhaite;
  for (let essai = 0; essai < 500; essai++) {
    const fin = new Date(debut.getTime() + dureeMin * 60_000);
    const chevauche = occupees.some(
      ({ creneau_debut, creneau_fin }) =>
        creneau_debut !== null &&
        creneau_fin !== null &&
        debut < creneau_fin &&
        fin > creneau_debut,
    );
    if (!chevauche) {
      return { creneau_debut: debut, creneau_fin: fin };
    }
    debut = new Date(debut.getTime() - pasMin * 60_000);
  }
  throw new Error(
    "creneauLibreDepuis : aucun créneau libre trouvé en reculant depuis le départ souhaité",
  );
}
