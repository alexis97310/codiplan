import { z } from "zod";

import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { creerReprise } from "@/lib/suite-a-donner/reprise";

import { champ } from "../../../actions";

/**
 * CONFIRMER LE DÉPLACEMENT DE L'INTERVENTION DE REPRISE
 * (9J18-SUITE-A-DONNER-ECRAN, FLX-6/7/11).
 *
 * **Aucune case « confirmer » ici** (D93, D123) — à la différence du
 * formulaire « Déplacer » ordinaire, cette route ne propose pas de lever un
 * jour fermé, une heure hors ouverture ou une date déjà passée : un refus
 * « à confirmer » se montre comme un refus plein, et l'écran renvoie choisir
 * un autre créneau. Écart nommé, pas une dérogation à RG-PLA-07/D93 — la
 * confirmation reste un geste à part, hors périmètre de ce ticket.
 */
export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return dansUnEchangeAuth(() => traiter(requete, id));
}

const schemaRequete = z.object({
  technicien_id: z.string().uuid(),
  date_planifiee: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  debut_minutes: z.coerce
    .number()
    .int()
    .min(0)
    .max(24 * 60 - 1),
  duree_min: z.coerce.number().int().positive(),
});

async function traiter(requete: Request, id: string): Promise<Response> {
  const contexte = await exigerCapaciteComplete("modifier_planning");
  if (contexte === null) {
    return versReplanifier(id, await motifDuRefus());
  }

  const formulaire = await requete.formData();
  const saisie = schemaRequete.safeParse({
    technicien_id: champ(formulaire, "technicien_id") ?? "",
    date_planifiee: champ(formulaire, "date_planifiee") ?? "",
    debut_minutes: champ(formulaire, "debut_minutes") ?? "",
    duree_min: champ(formulaire, "duree_min") ?? "",
  });
  if (!saisie.success) {
    return versReplanifier(id, "suites_a_donner.refus.statut_invalide");
  }

  const resultat = await creerReprise(contexte, id, {
    technicien_id: saisie.data.technicien_id,
    date_planifiee: new Date(`${saisie.data.date_planifiee}T00:00:00.000Z`),
    debut_minutes: saisie.data.debut_minutes,
    duree_min: saisie.data.duree_min,
    confirmer_hors_ouverture: false,
    confirmer_date_passee: false,
  });
  if (!resultat.accepte) {
    return versReplanifier(id, resultat.cle);
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/interventions/${resultat.fiche.id}?motif=${encodeURIComponent("suites_a_donner.reprise_creee")}`,
    },
  });
}

function versReplanifier(id: string, cle: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/interventions/suites-a-donner/${id}/replanifier?motif=${encodeURIComponent(cle)}`,
    },
  });
}
