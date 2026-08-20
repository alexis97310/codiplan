import { PrismaClient, type Prisma } from "@prisma/client";

import { verifierRoleApplicatif } from "./garde-role";
import { avecSociete } from "./rls";

/**
 * Client Prisma applicatif (CLAUDE.md §6 — `lib/db`).
 *
 * En développement, Next recharge les modules à chaud ; sans mise en cache sur
 * `globalThis`, chaque rechargement ouvrirait une nouvelle connexion — et
 * rejouerait le contrôle de rôle ci-dessous.
 *
 * Ce client est celui de l'APPLICATION : il doit se connecter avec le rôle
 * applicatif non propriétaire (`codiplan_app`), sans quoi les politiques RLS ne
 * mordent pas sur lui (I1). Les migrations et le seed, eux, conservent le rôle
 * propriétaire et instancient leur propre client — ils ne passent pas par ici.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  controleRoleApplicatif: Promise<void> | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Contrôle au démarrage : refuse la connexion si le rôle courant est
 * propriétaire de la base (ou superutilisateur, ou BYPASSRLS).
 *
 * Joué une seule fois par processus, puis mémorisé — y compris en échec : une
 * connexion refusée le reste, elle n'est pas retentée requête après requête.
 * Le client est fermé dans la foulée, pour que le refus soit un vrai refus de
 * se connecter et non un simple avertissement.
 */
export function garantirRoleApplicatif(): Promise<void> {
  globalForPrisma.controleRoleApplicatif ??= verifierRoleApplicatif(
    prisma,
  ).then(
    () => undefined,
    async (erreur: unknown) => {
      await prisma.$disconnect();
      throw erreur;
    },
  );
  return globalForPrisma.controleRoleApplicatif;
}

/**
 * Point d'entrée unique des accès applicatifs cloisonnés : contrôle du rôle,
 * puis transaction portant `app.societe_id` (voir `lib/db/rls`).
 */
export async function avecSocieteApplicative<T>(
  societeId: string,
  travail: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  await garantirRoleApplicatif();
  return avecSociete(prisma, societeId, travail);
}
