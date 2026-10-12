import {
  schemaCreationCompteDeBureau,
  type SaisieCompteDeBureau,
} from "@/lib/auth/acces-bureau";

import { champ } from "../../interventions/actions";

/**
 * LA SAISIE D'UN COMPTE DE BUREAU, LUE D'UN FORMULAIRE (D196,
 * 9ET-COMPTES-BUREAU-1) — même patron que `saisieTechnicienRecue`
 * (`app/api/techniciens/saisie-recue.ts`).
 */
export function saisieCompteDeBureauRecue(
  formulaire: FormData,
): SaisieCompteDeBureau | null {
  const analyse = schemaCreationCompteDeBureau.safeParse({
    nom: champ(formulaire, "nom") ?? "",
    courriel: champ(formulaire, "courriel") ?? "",
    role: champ(formulaire, "role") ?? "",
  });
  return analyse.success ? analyse.data : null;
}

/**
 * La case « envoyer le lien en l'ajoutant » — une case absente du corps vaut
 * « décochée », même règle que `actif` dans `saisieTechnicienRecue`.
 */
export function envoyerAccesCoche(formulaire: FormData): boolean {
  return formulaire.get("envoyer_acces") !== null;
}

/**
 * Le retour vers l'onglet « comptes de bureau » d'Équipe, avec son motif
 * s'il y en a un — même patron que `versLEquipe`
 * (`app/api/techniciens/saisie-recue.ts`), sur l'onglet `bureau` (lot 2).
 */
export function versLEquipeBureau(cle?: string): Response {
  const params = new URLSearchParams({ onglet: "bureau" });
  if (cle !== undefined) {
    params.set("motif", cle);
  }
  return new Response(null, {
    status: 303,
    headers: { Location: `/parametres/equipe?${params.toString()}` },
  });
}
