import { headers } from "next/headers";

import { type ContexteSession } from "@/lib/auth/contexte";
import { estRolePortail } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { rattachementsDuCompte } from "@/lib/portail/depot";

/**
 * LA PORTE DES ROUTES D'ÉCRITURE DU PORTAIL (9J03-PORTAIL-CONTACTS).
 *
 * `exigerCapacite` (`lib/auth/porte.ts`) juge la matrice des capacités des
 * rôles INTERNES — un compte portail n'y figure jamais (D10, D70) — donc ce
 * n'est pas la porte qu'une route du portail doit appeler. Cette porte reprend
 * exactement la lecture déjà faite par `app/(portail)/portail/page.tsx` :
 * session active, rôle du portail, puis le PREMIER rattachement de ce compte
 * sur la société active — jamais une seconde désignation inventée pour les
 * routes d'écriture (§9, 01/09).
 *
 * **`clientId` ici DÉSIGNE, il n'AUTORISE rien** (D70) : c'est
 * `avecContexteApplicatif`, en aval, qui pose `app.client_id` et le fait
 * valider par `app_poser_perimetre_client` dans la même transaction. Un
 * compte sans rattachement sur cette société reçoit `null`, exactement comme
 * la page de lecture redirigerait vers `/arrivee`.
 */
export type ContextePortailContact = {
  readonly contexte: ContexteSession;
  readonly clientId: string;
};

/**
 * LE MOTIF D'UN REFUS DÉJÀ DÉCIDÉ (D-12, décision d'Alexis du 29/09/2026,
 * 9BP/9BR-TP-A4-MESSAGES) — même forme que `motifDuRefus`
 * (`lib/auth/porte.ts`) : à appeler UNIQUEMENT dans la branche
 * `contextePortailContact() === null`, pour NOMMER le refus plutôt que de
 * reprendre `"auth.refus"` en dur dans une route — la chaîne de l'échec de
 * connexion, distincte du refus de droit.
 *
 * Deux motifs, à la résolution que cette porte peut honnêtement garantir :
 * `"auth.refus"` si la session, la société ou le rôle manquent ; sinon
 * `"auth.refus_droit"` — une session complète existe (et, pour le portail,
 * le rôle y est forcément celui du portail puisqu'`estRolePortail` l'a déjà
 * écarté sinon ci-dessous), mais ce compte n'a aucun rattachement sur cette
 * société (D70).
 */
export async function motifDuRefusPortail(): Promise<
  "auth.refus" | "auth.refus_droit"
> {
  const session = await obtenirSession(await headers());
  if (
    session === null ||
    session.contexte.societeId === null ||
    session.contexte.role === null
  ) {
    return "auth.refus";
  }
  return "auth.refus_droit";
}

export async function contextePortailContact(): Promise<ContextePortailContact | null> {
  const session = await obtenirSession(await headers());
  if (session === null) {
    return null;
  }
  const { societeId, role } = session.contexte;
  if (societeId === null || role === null || !estRolePortail(role)) {
    return null;
  }
  const rattachements = await rattachementsDuCompte(
    session.contexte.utilisateurId,
  );
  const premier = rattachements.find((r) => r.societeId === societeId);
  if (premier === undefined) {
    return null;
  }
  return {
    contexte: { ...session.contexte, clientId: premier.clientId },
    clientId: premier.clientId,
  };
}
