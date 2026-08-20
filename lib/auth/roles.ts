import { Role } from "@prisma/client";
import { z } from "zod";

/**
 * Énumération canonique des rôles (ticket L0-06 ; arbitrage n°1, gravité 4).
 *
 * **Source unique.** L'énumération est déclarée une seule fois, dans
 * `prisma/schema.prisma` : la base en tire le type PostgreSQL `"Role"`, le
 * client Prisma en tire l'objet `Role` réexporté ci-dessous, et tout le
 * TypeScript passe par lui. Rien n'est retranscrit à la main, donc rien ne peut
 * diverger. Un scénario d'isolation compare d'ailleurs les valeurs du type
 * PostgreSQL à cette liste, pour que la promesse soit vérifiée et pas seulement
 * énoncée.
 *
 * **Aucun rôle en chaîne libre.** Un rôle ne s'écrit jamais entre guillemets
 * dans le code : on passe par `Role.adv`, jamais par `"adv"`. Le test
 * `tests/unit/auth/roles-sans-chaine-libre.test.ts` parcourt le dépôt et
 * échoue si une chaîne littérale porte le nom d'un rôle hors de ce module.
 */

export { Role };

/** Les neuf rôles, dans l'ordre de déclaration du schéma. */
export const ROLES: readonly Role[] = Object.freeze(Object.values(Role));

/**
 * Schéma de validation de toute entrée serveur portant un rôle (CLAUDE.md §2 —
 * Zod, sans exception).
 */
export const schemaRole = z.enum(Role);

/** Affine une valeur inconnue en rôle canonique. */
export function estRole(valeur: unknown): valeur is Role {
  return schemaRole.safeParse(valeur).success;
}

/**
 * Rôles éditeur (§22.5) — ils se situent AU-DESSUS des sociétés, pas dedans.
 * Ils n'ont aucun accès par défaut aux données d'une société cliente : sans
 * ligne dans `utilisateur_societe`, ils ne peuvent activer aucune société, donc
 * ne lisent rien. Ce sont en revanche les seuls à pouvoir modifier les
 * référentiels de plateforme (I1).
 */
export const ROLES_EDITEUR: readonly Role[] = Object.freeze([
  Role.admin_plateforme,
  Role.editeur_commercial,
  Role.editeur_support,
]);

/** Rôles internes à une société : ils s'exercent sur une société active. */
export const ROLES_INTERNES: readonly Role[] = Object.freeze([
  Role.direction,
  Role.responsable_materiel,
  Role.responsable_sav,
  Role.adv,
  Role.technicien,
]);

/** Le rôle du portail client (D10) — jamais de ligne dans `utilisateur_societe`. */
export const ROLE_PORTAIL: Role = Role.client;

/**
 * Second facteur obligatoire (§12.1 « second facteur obligatoire pour les rôles
 * administrateur et direction », et §22.5 pour le super-administrateur
 * plateforme). La liste est fermée : l'ouvrir est une décision, pas un réflexe.
 */
export const ROLES_SECOND_FACTEUR_OBLIGATOIRE: readonly Role[] = Object.freeze([
  Role.admin_plateforme,
  Role.direction,
]);

/** Vrai pour les trois rôles éditeur du §22.5. */
export function estRoleEditeur(role: Role): boolean {
  return ROLES_EDITEUR.includes(role);
}

/** Vrai pour les rôles qui s'exercent à l'intérieur d'une société. */
export function estRoleInterne(role: Role): boolean {
  return ROLES_INTERNES.includes(role);
}

/** Vrai pour le rôle du portail client. */
export function estRolePortail(role: Role): boolean {
  return role === ROLE_PORTAIL;
}

/** Vrai si le rôle ne peut ouvrir de session sans second facteur validé. */
export function exigeSecondFacteur(role: Role): boolean {
  return ROLES_SECOND_FACTEUR_OBLIGATOIRE.includes(role);
}
