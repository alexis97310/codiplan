import { headers } from "next/headers";

import { estRolePortail } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";

/**
 * LA PORTE DE `/api/portail/tarifs` (9J20-PORTAIL-GRILLE-TARIFAIRE, CLI-7).
 *
 * **MÊME FORME que `app/api/portail/demandes/contexte.ts`**, écrite ici
 * plutôt qu'importée (§6 : chaque domaine porte la sienne).
 *
 * **ELLE NE RÉSOUT AUCUN RATTACHEMENT** — à la différence de
 * `contextePortailContact`/`contextePortailDemande` : le barème ne dépend
 * d'aucun client ni d'aucun site, seulement de la société active sur la
 * session. Résoudre un rattachement ici lirait une table de forme
 * « habilitation »/« rattachement » que la transaction dédiée de
 * `./lecture.ts` s'interdit de toucher (architecture de la route isolée,
 * décision du pilote du 29/10/2026).
 */
export type ContextePortailTarifs = {
  readonly societeId: string;
};

/** Un refus déjà décidé — motif ET code HTTP, pour que `route.ts` n'ait
 * jamais à comparer le motif lui-même (celui-ci reste « auth.refus » pour
 * l'absence de session, jamais réécrit sur un refus de DROIT — gardien
 * `tests/unit/auth/refus-de-droit.test.ts`, qui ne scrute que `route.ts`). */
export type RefusPortailTarifs = {
  readonly motif: "auth.refus" | "auth.refus_droit";
  readonly status: 401 | 403;
};

/**
 * LE REFUS D'UN CONTEXTE DÉJÀ JUGÉ ABSENT — à appeler UNIQUEMENT dans la
 * branche `contextePortailTarifs() === null`.
 */
export async function refusPortailTarifs(): Promise<RefusPortailTarifs> {
  const session = await obtenirSession(await headers());
  if (
    session === null ||
    session.contexte.societeId === null ||
    session.contexte.role === null
  ) {
    return { motif: "auth.refus", status: 401 };
  }
  return { motif: "auth.refus_droit", status: 403 };
}

export async function contextePortailTarifs(): Promise<ContextePortailTarifs | null> {
  const session = await obtenirSession(await headers());
  if (session === null) {
    return null;
  }
  const { societeId, role } = session.contexte;
  if (societeId === null || role === null || !estRolePortail(role)) {
    return null;
  }
  return { societeId };
}
