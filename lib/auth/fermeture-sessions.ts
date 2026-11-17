import type { Prisma, PrismaClient } from "@prisma/client";

import { VARIABLE_SESSION_UTILISATEUR } from "@/lib/db/rls";

/**
 * FERME TOUTES LES SESSIONS D'UN COMPTE — décision d'Alexis du 10/11/2026
 * (9L09-SESSIONS-FERMEES-REINITIALISATION).
 *
 * **Le patron, pas une invention** : `revoquerAccesPortailClient`
 * (`lib/auth/lien-d-acces.ts`) et `retirerAccesInterne`
 * (`lib/auth/retrait-acces.ts`) le tiennent déjà chacun à sa façon. La
 * politique `session_fermeture` (DELETE) n'admet que le JETON présenté ou SA
 * PROPRE ligne, ancrée sur `app.utilisateur_id` (L1-02d) — fermer la session
 * D'UN TIERS exige donc de poser cette variable sur LA CIBLE, dans la
 * transaction qui écrit, exactement comme ces deux gestes le font déjà.
 *
 * `fermerSessionsDuCompteDansLaTransaction` s'insère dans une transaction que
 * l'appelant tient déjà (`reinitialiserSecondFacteur`, qui doit fermer les
 * sessions DANS LA MÊME transaction que les deux écritures de 9IA) ;
 * `fermerSessionsDuCompte` en ouvre une pour un appelant qui n'en tient aucune
 * (`choisirLePremierMotDePasse`, hors session).
 */
export async function fermerSessionsDuCompteDansLaTransaction(
  tx: Prisma.TransactionClient,
  utilisateurId: string,
): Promise<void> {
  await tx.$executeRawUnsafe(
    "SELECT set_config($1, $2, true)",
    VARIABLE_SESSION_UTILISATEUR,
    utilisateurId,
  );
  await tx.session.deleteMany({ where: { utilisateur_id: utilisateurId } });
}

export async function fermerSessionsDuCompte(
  client: PrismaClient,
  utilisateurId: string,
): Promise<void> {
  await client.$transaction((tx) =>
    fermerSessionsDuCompteDansLaTransaction(tx, utilisateurId),
  );
}
