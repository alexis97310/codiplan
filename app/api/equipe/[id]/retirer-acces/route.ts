import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { retirerAccesInterne } from "@/lib/auth/retrait-acces";

import { versLEquipeBureau } from "@/app/api/equipe/bureau/saisie-recue";
import { champ } from "@/app/api/interventions/actions";
import { versLEquipe } from "@/app/api/techniciens/saisie-recue";

/**
 * `POST /api/equipe/<id>/retirer-acces` — RETIRE L'ACCÈS D'UN COMPTE INTERNE
 * (9L03C — REPRISE de 9L03A ; décision d'Alexis du 10/11/2026 puis du
 * 13/11/2026, « Désactiver »).
 *
 * **UNE SEULE ROUTE POUR LES DEUX ONGLETS D'ÉQUIPE** — bureau et technicien —
 * parce que le geste lui-même ne les distingue pas :
 * `retirerAccesInterne` (`lib/auth/retrait-acces.ts`) désactive la ligne
 * `utilisateur_societe` par son `utilisateur_id`, quel que soit le rôle
 * qu'elle porte. `onglet` voyage dans le formulaire pour que le retour
 * retrouve le bon onglet — même rôle que `retour` sur
 * `/api/clients/[id]/revoquer-acces`, jamais déduit de l'identifiant.
 *
 * Garde `administrer_utilisateurs` (D37/D199) — vérifiée ICI ET dans
 * `retirerAccesInterne` (défense en profondeur, même discipline que
 * `inviterClientAuPortail`). L'identifiant vient du chemin, jamais du corps.
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
  const resultat = await retirerAccesInterne(contexte, id);
  if (!resultat.accepte) {
    return versLeRetour(`equipe.retrait_acces.refus.${resultat.motif}`);
  }
  return versLeRetour("equipe.retrait_acces.reussi");
}
