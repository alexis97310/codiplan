import { PrismaClient } from "@prisma/client";

/**
 * Décompte de contrôle post-migration (workflow « DB migrate & seed »).
 *
 * Affiche dans le journal de l'exécuteur GitHub Actions un état du socle après
 * migration et amorçage : nombre de sociétés, d'agences, de comptes portail et
 * première parité XPF connue. Purement lecture, aucune écriture.
 *
 * Versionné dans le dépôt (et non écrit dans /tmp) pour que `tsx`, exécuté
 * depuis la racine, résolve `@prisma/client` via le `node_modules` du dépôt.
 *
 * Sortie via `process.stdout.write` : `console.log` est banni (CLAUDE.md §5),
 * et ce décompte est une sortie de journal délibérée, pas une trace résiduelle.
 */
const prisma = new PrismaClient();

const societes = await prisma.societe.count();
const agences = await prisma.agence.count();
const comptesPortail = await prisma.utilisateurClient.count();
const pariteXpf = await prisma.parite.findFirst({
  where: { devise_code: "XPF" },
  orderBy: { date_effet: "asc" },
});

const pariteLibelle = pariteXpf
  ? `${pariteXpf.taux} XPF pour 1 EUR (effet ${pariteXpf.date_effet
      .toISOString()
      .slice(0, 10)}, source « ${pariteXpf.source} »)`
  : "ABSENTE";

process.stdout.write(
  [
    "── Décompte de contrôle ──────────────────",
    `Sociétés        : ${societes}`,
    `Agences         : ${agences}`,
    `Comptes portail : ${comptesPortail}`,
    `Parité XPF      : ${pariteLibelle}`,
    "",
  ].join("\n"),
);

await prisma.$disconnect();
