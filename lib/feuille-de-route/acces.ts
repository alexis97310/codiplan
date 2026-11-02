import { Role } from "@/lib/auth/roles";

/**
 * QUI VOIT LA FEUILLE DE ROUTE — demande d'Alexis du 02/11/2026, réponse
 * « les deux » : administrateur de société ET administrateur plateforme,
 * personne d'autre (ni `direction`, qu'aucune capacité existante n'exclut
 * ici — `parametrer_societe` couvre `admin_societe` ET `direction`, ce qui
 * ouvrirait la page à `direction`, non demandé).
 *
 * Une exigence par RÔLE, posée ici plutôt que dans `lib/auth/habilitations.ts`
 * (hors territoire de ce ticket) : la matrice des capacités n'a pas de case
 * qui tienne EXACTEMENT ces deux rôles.
 */
export const ROLES_FEUILLE_DE_ROUTE: readonly Role[] = [
  Role.admin_societe,
  Role.admin_plateforme,
];

export function peutVoirFeuilleDeRoute(role: Role | null): boolean {
  return role !== null && ROLES_FEUILLE_DE_ROUTE.includes(role);
}
