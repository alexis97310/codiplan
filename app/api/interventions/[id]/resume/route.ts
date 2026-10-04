import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { peut, peutPleinement } from "@/lib/auth/habilitations";
import { avecContexteApplicatif } from "@/lib/db/client";
import { annuaireDesPersonnes } from "@/lib/auth/annuaire";
import { jourDe, maintenant } from "@/lib/calendar/fuseau";
import { peutAnnuler, peutDeplacer } from "@/lib/interventions/cycle-de-vie";
import { restrictionParPersonne } from "@/lib/interventions/depot";
import { quiTravaille } from "@/lib/interventions/personnes";
import { enRetard } from "@/lib/interventions/retard";
import { donneesMaterielDesMachines } from "@/lib/machines/depot";
import { t } from "@/lib/i18n/fr";

import {
  creneauDeLaCarte,
  dureeCarteAffichee,
  materielDeLaCarte,
  panneOuNatureDeLaCarte,
  siteDeLaCarte,
} from "@/app/(back-office)/planning/carte";
import { referenceAffichee } from "@/app/(back-office)/interventions/presentation";

/**
 * `GET /api/interventions/{id}/resume` — LE RÉSUMÉ D'UNE INTERVENTION, EN
 * LECTURE SEULE (PG-C5-TIROIR, spécification §3.9).
 *
 * Sert UNIQUEMENT `components/planning/tiroir.tsx` : le tiroir ouvre cette
 * route au lieu de recharger `/planning`, pour ne jamais interrompre la vue en
 * cours. Aucune écriture — les mêmes fonctions PURES que la fiche
 * (`peutDeplacer`, `peutAnnuler`) décident des verdicts, jamais une seconde
 * règle (§9, 01/09).
 *
 * **`consulter_planning` (D-12)** — la même capacité que la page `/planning`
 * elle-même, accordée à TOUT rôle qui voit le planning, y compris `TEC` en
 * périmètre restreint : lire le tiroir n'est pas un geste de plus que ce que
 * l'écran fait déjà. Les DEUX capacités d'ÉCRITURE (`modifier_planning`,
 * `annuler_intervention`) sont rendues À PART, pour que le tiroir masque un
 * geste que le rôle ne détient pas plutôt que de l'afficher désactivé sans
 * raison.
 *
 * **`peutModifierLePlanning` lit `peutPleinement`, pas `peut`**
 * (05/10/2026, 9D3-PLANNING-TECHNICIEN-ACTIONS) — le ○ que le technicien
 * porte sur `modifier_planning` depuis TR-5 (D136) ne sert qu'à déclarer SA
 * PROPRE absence (`/planning`, hors de ce tiroir) ; « Déplacer » et
 * « Transmettre » appellent `/api/interventions/[id]/deplacer` et
 * `.../transmettre`, qui exigent désormais l'accès complet
 * (`exigerCapaciteComplete`, 9DKA-REPRISE-9DK). Lire `peut` ici montrait ces
 * deux boutons à un technicien pour qui le serveur les refusait ensuite.
 */
export async function GET(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return dansUnEchangeAuth(() => traiter(id));
}

async function traiter(id: string): Promise<Response> {
  const contexte = await exigerCapacite("consulter_planning");
  if (contexte === null) {
    return Response.json({ erreur: "acces_refuse" }, { status: 403 });
  }
  const role = contexte.role;

  const ligne = await avecContexteApplicatif(contexte, (tx) => {
    const restriction = restrictionParPersonne(contexte);
    return tx.intervention.findFirst({
      where: { id, ...restriction },
      select: {
        id: true,
        numero: true,
        statut: true,
        priorite: true,
        type: true,
        description: true,
        date_planifiee: true,
        creneau_debut: true,
        creneau_fin: true,
        duree_estimee_min: true,
        technicien_id: true,
        agence_id: true,
        client: { select: { raison_sociale: true } },
        site: { select: { libelle: true, commune: true } },
        agence: {
          select: {
            fuseau_horaire: true,
            societe: { select: { fuseau_horaire: true } },
          },
        },
        machines: { select: { machine_id: true } },
        _count: { select: { segments: true } },
      },
    });
  });
  if (ligne === null) {
    return Response.json({ erreur: "introuvable" }, { status: 404 });
  }

  const fuseau =
    ligne.agence.fuseau_horaire ?? ligne.agence.societe.fuseau_horaire;
  const [annuaire, donneesMateriel] = await Promise.all([
    avecContexteApplicatif(contexte, (tx) =>
      annuaireDesPersonnes(
        tx,
        ligne.technicien_id === null ? [] : [ligne.technicien_id],
      ),
    ),
    donneesMaterielDesMachines(
      contexte,
      ligne.machines.map((m) => m.machine_id),
    ),
  ]);

  // LA DURÉE AFFICHÉE — le créneau posé d'abord, l'estimation ensuite, jamais
  // un zéro inventé : la MÊME règle que `dureeDe` (`app/(back-office)/
  // planning/page.tsx`), jamais une seconde écriture (§9, 01/09).
  const dureeMinutes =
    ligne.creneau_debut !== null && ligne.creneau_fin !== null
      ? Math.round(
          (ligne.creneau_fin.getTime() - ligne.creneau_debut.getTime()) /
            60_000,
        )
      : ligne.duree_estimee_min;

  return Response.json({
    id: ligne.id,
    reference: referenceAffichee(ligne),
    statut: ligne.statut,
    statutLibelle: t(`statut.${ligne.statut}`),
    priorite: ligne.priorite,
    prioriteLibelle: t(`priorite.${ligne.priorite}`),
    client: ligne.client.raison_sociale,
    site: siteDeLaCarte(ligne.site),
    creneau: creneauDeLaCarte(ligne, fuseau),
    duree: dureeMinutes === null ? null : dureeCarteAffichee(dureeMinutes),
    technicien: quiTravaille(ligne.technicien_id, annuaire),
    // LA MÊME COMPOSITION QUE LA CARTE DU PLANNING (`materielDeLaCarte`,
    // `carte.ts`) — jamais un second assemblage de la liste des machines
    // (§9, 01/09).
    machines: materielDeLaCarte(ligne, donneesMateriel),
    dureeEstimeeMin: dureeMinutes,
    // LE TITRE DE `FenetrePose` (PG-B2) — la MÊME composition que
    // `libellePourFenetrePose` (`page.tsx`), jamais une seconde écriture.
    libellePose: [
      ligne.client.raison_sociale,
      panneOuNatureDeLaCarte(ligne),
      t(`priorite.${ligne.priorite}`),
    ].join(t("ponctuation.point_median")),
    enRetard: enRetard(
      {
        statut: ligne.statut,
        datePlanifiee: ligne.date_planifiee,
        aDesSegments: ligne._count.segments > 0,
      },
      jourDe(maintenant(fuseau).local),
    ),
    fuseau,
    verdictDeplacer: peutDeplacer(ligne.statut),
    verdictAnnuler: peutAnnuler(ligne.statut),
    peutModifierLePlanning: peutPleinement(role, "modifier_planning"),
    peutAnnulerIntervention: peut(role, "annuler_intervention"),
  });
}
