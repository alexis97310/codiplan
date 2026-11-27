import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import {
  enregistrerRetourPret,
  PretDejaRetourne,
  PretIntrouvable,
  RetourAvantSortie,
} from "@/lib/prets/depot";
import { schemaRetourPret } from "@/lib/prets/saisie";

import { champ, jourCivilPret } from "../../actions";
import { avecFilet, versLaFiche } from "../../../interventions/actions";

/**
 * ENREGISTRER LE RETOUR D'UN PRÊT (9L61-PRET-2-ECRANS-BUREAU, D287) — depuis
 * la fiche intervention, qui porte le bloc « Prêt en cours ».
 *
 * `intervention_id` est un champ caché, de NAVIGATION SEULEMENT (vers quelle
 * fiche revenir) : le retour lui-même reste scopé au prêt désigné par `id`,
 * sous la politique RLS « interne » — un champ forgé ne redirige mal, il ne
 * fait écrire sur rien d'autre.
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
  const formulaire = await requete.formData();
  const interventionId = champ(formulaire, "intervention_id") ?? id;
  return avecFilet(interventionId, "retour-pret", async () => {
    const contexte = await exigerCapaciteComplete("gerer_prets");
    if (contexte === null) {
      return versLaFiche(interventionId, await motifDuRefus());
    }
    const analyse = schemaRetourPret.safeParse({
      date_retour_reelle:
        jourCivilPret(formulaire, "date_retour_reelle") ?? new Date(Number.NaN),
      etat_retour: champ(formulaire, "etat_retour") ?? "",
      en_revision: formulaire.get("en_revision") !== null,
      observations: champ(formulaire, "observations"),
    });
    if (!analyse.success) {
      return versLaFiche(interventionId, "intervention.pret.refus.saisie");
    }
    try {
      await enregistrerRetourPret(contexte, id, analyse.data);
    } catch (erreur) {
      if (erreur instanceof PretIntrouvable) {
        return versLaFiche(
          interventionId,
          "intervention.pret.refus.pret_introuvable",
        );
      }
      if (erreur instanceof PretDejaRetourne) {
        return versLaFiche(
          interventionId,
          "intervention.pret.refus.pret_deja_retourne",
        );
      }
      if (erreur instanceof RetourAvantSortie) {
        return versLaFiche(
          interventionId,
          "intervention.pret.refus.retour_avant_sortie",
        );
      }
      throw erreur;
    }
    return versLaFiche(interventionId);
  });
}
