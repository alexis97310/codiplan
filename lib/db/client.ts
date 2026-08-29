import { PrismaClient, type Prisma } from "@prisma/client";

import { exigerContexteActif, type ContexteSession } from "@/lib/auth/contexte";

import { verifierRoleApplicatif } from "./garde-role";
import { avecContexteRls, avecSocieteEtRole } from "./rls";

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
 * La consolidation multi-sociétés, elle, a sa propre connexion et son propre
 * garde : `lib/reporting/connexion.ts` (D21).
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
 * Point d'entrée des accès applicatifs cloisonnés PILOTÉS PAR UNE SESSION
 * (ticket L0-06) : c'est la société de la session qui alimente
 * `app.societe_id`, et son rôle qui alimente `app.role`.
 *
 * Le contexte est d'abord validé (`exigerContexteActif`) : pas de société
 * active, pas de rôle, ou second facteur manquant sur un rôle qui l'exige, et
 * la transaction n'est pas même ouverte.
 *
 * C'est aussi ICI que l'auteur entre en base (L0-10, I8). Le déclencheur
 * d'audit lit `app.utilisateur_id` ; ce chemin est le seul qui connaisse un
 * utilisateur, donc le seul qui puisse le nommer. Les autres chemins écrivent
 * un auteur nul — et sont journalisés quand même.
 */
export async function avecContexteApplicatif<T>(
  contexte: ContexteSession,
  travail: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const actif = exigerContexteActif(contexte);
  await garantirRoleApplicatif();
  return avecContexteRls(
    prisma,
    {
      societeId: actif.societeId,
      role: actif.role,
      auteurId: actif.utilisateurId,
      adresseIp: actif.adresseIp,
    },
    travail,
  );
}

/**
 * Accès cloisonné sans session, pour les chemins serveur qui n'en ont pas
 * (tâches planifiées, traitements par société). Le contexte se réduit alors à
 * la société : aucun rôle n'est posé, donc aucun référentiel de plateforme
 * n'est modifiable. Tout chemin issu d'une requête utilisateur passe par
 * `avecContexteApplicatif`.
 */
export async function avecSocieteApplicative<T>(
  societeId: string,
  travail: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  await garantirRoleApplicatif();
  return avecSocieteEtRole(prisma, societeId, null, travail);
}
