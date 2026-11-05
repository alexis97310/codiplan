import { headers } from "next/headers";

import { type ContexteSession } from "@/lib/auth/contexte";
import { estRolePortail } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { rattachementsDuCompte } from "@/lib/portail/depot";

/**
 * LA PORTE DES ROUTES D'ÉCRITURE DU PORTAIL (9J04-PORTAIL-DEMANDES, CLI-4).
 *
 * MÊME FORME que `app/api/portail/contacts/contexte.ts`, écrite ici plutôt
 * qu'importée : « chaque domaine porte la sienne plutôt que d'en importer
 * une à un autre » (§6) — et `app/(portail)/portail/demandes/page.tsx` répète
 * la même lecture pour sa propre raison (un module de page et un module de
 * route n'ont pas le même cycle de vie Next, aucun des deux ne peut importer
 * l'autre).
 *
 * `exigerCapacite` (`lib/auth/porte.ts`) juge la matrice des capacités des
 * rôles INTERNES — un compte portail n'y figure jamais (D10, D70). La porte
 * reprend donc : session active, rôle du portail, puis le PREMIER
 * rattachement de ce compte sur la société active.
 *
 * **`clientId` ici DÉSIGNE, il n'AUTORISE rien** (D70) : c'est
 * `avecContexteApplicatif`, en aval, qui pose `app.client_id` et le fait
 * valider par `app_poser_perimetre_client` dans la même transaction.
 */
export type ContextePortailDemande = {
  readonly contexte: ContexteSession;
  readonly clientId: string;
};

/**
 * LE MOTIF D'UN REFUS DÉJÀ DÉCIDÉ — même forme que `motifDuRefusPortail`
 * (`app/api/portail/contacts/contexte.ts`) : à appeler UNIQUEMENT dans la
 * branche `contextePortailDemande() === null`.
 */
export async function motifDuRefusPortailDemande(): Promise<
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

export async function contextePortailDemande(): Promise<ContextePortailDemande | null> {
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
