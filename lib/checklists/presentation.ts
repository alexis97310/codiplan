import type { ReponseDeChecklist } from "./depot";

/**
 * LA RÉPONSE CONNUE DU SERVEUR, RAMENÉE À LA SEULE VALEUR UTILE À SON TYPE
 * (9K21-CHECKLIST-TERRAIN-SAISIE, CK5 ; partagée avec l'instantané hors
 * réseau depuis 9K22-CHECKLIST-HORS-RESEAU, CK6) — `ReponseDeChecklist`
 * porte les cinq colonnes à la fois (une seule non nulle, I1 §3) ; l'écran
 * n'a besoin que de celle que `typeReponse` désigne. `null` si aucune
 * réponse n'existe encore pour ce point.
 *
 * Deux appelants, UNE SEULE fonction (§9, 01/09) : `app/(mobile)/terrain/
 * [id]/page.tsx` (la fiche en ligne) et `app/api/terrain/instantane/
 * route.ts` (la copie emportée hors réseau) doivent composer la MÊME valeur
 * depuis la MÊME réponse, jamais deux lectures qui pourraient diverger.
 */
export function valeurChecklistAffichee(
  typeReponse: string,
  reponse: ReponseDeChecklist | undefined,
): string | number | boolean | null {
  if (reponse === undefined) {
    return null;
  }
  switch (typeReponse) {
    case "conforme_non_conforme_sans_objet":
      return reponse.valeurConforme;
    case "valeur_mesuree":
      return reponse.valeurMesuree === null
        ? null
        : Number(reponse.valeurMesuree);
    case "case_faite":
      return reponse.valeurFait ?? null;
    case "choix_dans_une_liste":
      return reponse.valeurChoix;
    case "texte_libre":
      return reponse.valeurTexte;
    default:
      return null;
  }
}
