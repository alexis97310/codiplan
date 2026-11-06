import type { ContexteActif, ContexteSession } from "@/lib/auth/contexte";
import { estRolePortail, exigeSecondFacteur, type Role } from "@/lib/auth/roles";
import { type PerimetrePlanning } from "@/lib/interventions/perimetre-technicien";

/**
 * PAR OÙ UN RÔLE ENTRE (R5-01) — extrait de `page.tsx` (ticket 99A-ARRIVEE).
 *
 * **Vit hors de `page.tsx`** pour la même raison que `composants.tsx` :
 * Next.js refuse qu'un fichier de route exporte autre chose que les champs
 * qu'il reconnaît, et une fonction pure méritait d'être éprouvée sans
 * navigateur. C'est la MÊME question que documentait `Entree` (`page.tsx`) —
 * « par où entre-t-on ? » — et c'est désormais la même fonction qui la
 * tranche pour le lien affiché ET pour la redirection d'une société unique :
 * *deux lectures d'un même critère divergeraient en silence* (§9, 01/09).
 */

/** Les trois portes ouvertes depuis l'arrivée (R5-01), et jamais une quatrième. */
export type PointEntree = "/portail" | "/terrain" | "/planning";

/** Le point d'entrée que ce rôle ouvre, compte tenu de son périmètre de planning. */
export function pointEntreeRole(
  role: Role,
  perimetre: PerimetrePlanning | null,
): PointEntree {
  if (estRolePortail(role)) {
    return "/portail";
  }
  if (perimetre?.acces === "restreint") {
    return "/terrain";
  }
  return "/planning";
}

/**
 * La destination d'un compte qui vient d'arriver, SI une seule société le
 * rattache — `null` sinon, et l'écran garde son sélecteur (audit d'ergonomie
 * du 25/09, constat 2) : zéro ou plusieurs sociétés ne changent rien.
 */
export function destinationSiSocieteUnique(
  nombreSocietes: number,
  role: Role,
  perimetre: PerimetrePlanning | null,
): PointEntree | null {
  return nombreSocietes === 1 ? pointEntreeRole(role, perimetre) : null;
}

/**
 * ASSEZ POUR CHOISIR UNE DESTINATION — délibérément plus FAIBLE que
 * `estContexteActif` (9J21, symptôme 4 d'Alexis le 06/11).
 *
 * `basculerSociete` pose TOUJOURS `clientId: null` (D70, `societe-active.ts`) :
 * désigner le client n'est pas le rôle de la bascule, c'est celui de
 * `/portail`, au moment de la requête. `estContexteActif` refuse donc
 * SYSTÉMATIQUEMENT le contexte d'un compte portail qui vient d'arriver — pas
 * seulement parfois — et bloquait la redirection automatique vers `/portail`
 * pour ce seul rôle : Alexis cliquait « Travailler sur cette société », la
 * page se rendait de nouveau, et rien ne menait plus loin.
 *
 * Choisir une destination n'ouvre aucune transaction cloisonnée — ni
 * `app.client_id` ni la forme « parc » n'interviennent ici — donc rien n'exige
 * l'appariement rôle ↔ client que `estContexteActif` impose pour LIRE. Société
 * et rôle établis, second facteur satisfait s'il est exigé : c'est tout ce que
 * `pointEntreeRole` lit.
 */
export function pretAChoisirUneDestination(
  contexte: ContexteSession,
): contexte is ContexteActif {
  if (contexte.societeId === null || contexte.role === null) {
    return false;
  }
  return !exigeSecondFacteur(contexte.role) || contexte.secondFacteurValide;
}
