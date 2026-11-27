import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import {
  AppareilPretIntrouvable,
  changerStatutAppareilPret,
  StatutAppareilVerrouille,
  type StatutManuelAppareilPret,
} from "@/lib/prets/depot";

import { champ } from "../../../../interventions/actions";
import { versLeParcDePret } from "../../saisie-recue";

/**
 * PASSER UN APPAREIL « EN RÉVISION » / « DISPONIBLE » (9L61, D287).
 *
 * L'état visé est ENVOYÉ par le formulaire, jamais déduit d'une bascule —
 * même raison que l'activité du référentiel matériel : une bascule aveugle
 * inverserait un état qu'un autre onglet vient de changer. `prete` n'est
 * jamais un choix de ce formulaire : seule la sortie le pose, seul le retour
 * le défait.
 */
export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete, params));
}

function statutVise(valeur: string | null): StatutManuelAppareilPret | null {
  return valeur === "disponible" || valeur === "en_revision" ? valeur : null;
}

async function traiter(
  requete: Request,
  params: Promise<{ id: string }>,
): Promise<Response> {
  const formulaire = await requete.formData();
  const { id } = await params;
  const contexte = await exigerCapaciteComplete("gerer_prets");
  if (contexte === null) {
    return versLeParcDePret({ motif: await motifDuRefus() });
  }
  const vise = statutVise(champ(formulaire, "statut"));
  if (vise === null) {
    return versLeParcDePret({ motif: "prets.refus.saisie" });
  }
  try {
    await changerStatutAppareilPret(contexte, id, vise);
  } catch (erreur) {
    if (erreur instanceof AppareilPretIntrouvable) {
      return versLeParcDePret({ motif: "prets.refus.introuvable" });
    }
    if (erreur instanceof StatutAppareilVerrouille) {
      return versLeParcDePret({ motif: "prets.refus.statut_verrouille" });
    }
    throw erreur;
  }
  return versLeParcDePret({});
}
