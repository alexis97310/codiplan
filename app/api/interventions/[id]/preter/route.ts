import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { uuidv7 } from "@/lib/db/uuid";
import {
  AppareilIndisponible,
  InterventionIntrouvable,
  RetourAvantSortie,
  sortirPret,
} from "@/lib/prets/depot";
import { schemaSortiePret } from "@/lib/prets/saisie";

import { jourCivilPret } from "../../../prets/actions";
import { avecFilet, champ, versLaFiche } from "../../actions";

/**
 * PRÊTER UN APPAREIL DEPUIS LA FICHE INTERVENTION (9L61-PRET-2-ECRANS-BUREAU,
 * D287) — même porte que la passation de 9L60 le demandait : « les lots 2 et
 * 3 appelleront `exigerCapaciteComplete("gerer_prets")` EN PLUS » du dépôt,
 * jamais à sa place.
 */
export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete, params));
}

async function traiter(
  requete: Request,
  params: Promise<{ id: string }>,
): Promise<Response> {
  const { id } = await params;
  return avecFilet(id, "preter", async () => {
    const contexte = await exigerCapaciteComplete("gerer_prets");
    if (contexte === null) {
      return versLaFiche(id, await motifDuRefus());
    }
    const formulaire = await requete.formData();
    const analyse = schemaSortiePret.safeParse({
      appareil_id: champ(formulaire, "appareil_id") ?? "",
      intervention_id: id,
      date_sortie:
        jourCivilPret(formulaire, "date_sortie") ?? new Date(Number.NaN),
      date_retour_prevue:
        jourCivilPret(formulaire, "date_retour_prevue") ?? new Date(Number.NaN),
      etat_depart: champ(formulaire, "etat_depart") ?? "",
      observations: champ(formulaire, "observations"),
      signataire_nom: champ(formulaire, "signataire_nom"),
      signataire_qualite: champ(formulaire, "signataire_qualite"),
      signature_donnees: champ(formulaire, "signature_donnees"),
      motif_absence_signature: champ(formulaire, "motif_absence_signature"),
    });
    if (!analyse.success) {
      return versLaFiche(id, "intervention.pret.refus.saisie");
    }
    const pretId = uuidv7();
    try {
      await sortirPret(contexte, pretId, analyse.data);
    } catch (erreur) {
      if (erreur instanceof AppareilIndisponible) {
        return versLaFiche(id, "intervention.pret.refus.appareil_indisponible");
      }
      if (erreur instanceof InterventionIntrouvable) {
        return versLaFiche(
          id,
          "intervention.pret.refus.intervention_introuvable",
        );
      }
      if (erreur instanceof RetourAvantSortie) {
        return versLaFiche(id, "intervention.pret.refus.retour_avant_sortie");
      }
      throw erreur;
    }
    return versLaFiche(id);
  });
}
