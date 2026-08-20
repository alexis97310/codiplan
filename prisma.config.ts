import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "prisma/config";

/**
 * Configuration de l'outillage Prisma (ticket L0-E).
 *
 * Elle vivait dans `package.json#prisma`, que Prisma 6 déprécie et que Prisma 7
 * supprimera. Le déplacement est fait ici À VERSION INCHANGÉE : la montée en
 * version majeure est un changement d'un autre ordre, qui mérite sa propre
 * décision et son propre ticket.
 *
 * Attention, ce fichier a un effet de bord que `package.json#prisma` n'avait
 * pas : dès qu'un fichier de configuration existe, la CLI Prisma cesse de
 * charger `.env` toute seule. Sans le rattrapage ci-dessous, `pnpm db:migrate`
 * et `pnpm db:seed` échoueraient sur un poste de développement avec
 * « Environment variable not found: DATABASE_URL », alors qu'un `.env` est bien
 * là.
 */

const racine = dirname(fileURLToPath(import.meta.url));
const fichierEnv = resolve(racine, ".env");

// `process.loadEnvFile` est natif (Node ≥ 20.12, et le dépôt exige Node 22) :
// aucune dépendance à ajouter pour retrouver ce que la CLI faisait seule. Comme
// dotenv auparavant, il NE remplace PAS une variable déjà posée dans
// l'environnement — c'est essentiel : le harnais d'isolation impose
// `DATABASE_URL` à son `migrate deploy` pour viser la base jetable, et un `.env`
// de développement pointant vers la base hébergée ne doit jamais la supplanter.
if (existsSync(fichierEnv)) {
  process.loadEnvFile(fichierEnv);
}

export default defineConfig({
  schema: resolve(racine, "prisma", "schema.prisma"),
  migrations: {
    // Reprend à l'identique `package.json#prisma.seed`, que `prisma db seed`
    // (donc `pnpm db:seed`) exécute.
    seed: "tsx prisma/seed.ts",
  },
});
