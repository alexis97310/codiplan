import { habilitationsDuCompte } from "@/lib/auth/societe-active";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const u = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
  `SELECT "id" FROM "utilisateur" LIMIT 1`,
);
try {
  const h = await habilitationsDuCompte(u[0]!.id);
  process.stdout.write(`habilitations=${JSON.stringify(h)}\n`);
} catch (e) {
  process.stdout.write(`ERREUR ${String(e).slice(0, 400)}\n`);
}
await prisma.$disconnect();
