import { PrismaClient } from "@prisma/client";

/**
 * Client Prisma partagé (CLAUDE.md §6 — `lib/db`).
 *
 * En développement, Next recharge les modules à chaud ; sans mise en cache sur
 * `globalThis`, chaque rechargement ouvrirait une nouvelle connexion. Le
 * contexte société et les aides RLS viendront enrichir ce module au ticket L0-04.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
