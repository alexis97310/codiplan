import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { retablirAccesInterne } from "@/lib/auth/retrait-acces";

import { versLEquipeBureau } from "@/app/api/equipe/bureau/saisie-recue";
import { champ } from "@/app/api/interventions/actions";
import { versLEquipe } from "@/app/api/techniciens/saisie-recue";

/**
 * `POST /api/equipe/<id>/retablir-acces` — RÉTABLIT L'ACCÈS D'UN COMPTE
 * INTERNE DONT LA LIGNE `utilisateur_societe` EST INACTIVE
 * (9L04K-REACTIVER-ACCES-INTERNE).
 *
 * MÊME FORME QUE `retirer-acces` (`app/api/equipe/[id]/retirer-acces/
 * route.ts`), son symétrique : une seule route pour les deux onglets
 * d'Équipe, `onglet` voyageant dans le formulaire pour que le retour
 * retrouve le bon.
 *
 * Garde `administrer_utilisateurs` (D37/D199) — vérifiée ICI ET dans
 * `retablirAccesInterne` (défense en profondeur, même discipline que
 * `retirerAccesInterne`). L'identifiant vient du chemin, jamais du corps.
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
  const formulaire = await requete.formData();
  const surBureau = champ(formulaire, "onglet") === "bureau";
  const versLeRetour = surBureau ? versLEquipeBureau : versLEquipe;

  const contexte = await exigerCapacite("administrer_utilisateurs");
  if (contexte === null) {
    return versLeRetour(await motifDuRefus());
  }
  const { id } = await params;
  const resultat = await retablirAccesInterne(contexte, id);
  if (!resultat.accepte) {
    return versLeRetour(`equipe.retablir_acces.refus.${resultat.motif}`);
  }
  return versLeRetour("equipe.retablir_acces.reussi");
}
