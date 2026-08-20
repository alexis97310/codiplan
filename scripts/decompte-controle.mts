import { PrismaClient } from "@prisma/client";

import { avecSociete } from "../lib/db/rls";
import { SOCIETES } from "../prisma/seed-data";

/**
 * Décompte de contrôle post-migration (workflow « DB migrate & seed »).
 *
 * Affiche dans le journal de l'exécuteur GitHub Actions un état du socle après
 * migration et amorçage : nombre de sociétés, d'agences, de comptes portail et
 * première parité XPF connue. Purement lecture, aucune écriture.
 *
 * Depuis `FORCE ROW LEVEL SECURITY`, le rôle propriétaire est lui aussi soumis
 * au cloisonnement : un `count()` sans contexte renverrait zéro. Le decompte se
 * fait donc société par société, sous le contexte de chacune — ce qui a le
 * mérite de vérifier au passage, en conditions réelles, que le filet mord.
 *
 * Versionné dans le dépôt (et non écrit dans /tmp) pour que `tsx`, exécuté
 * depuis la racine, résolve `@prisma/client` via le `node_modules` du dépôt.
 *
 * Sortie via `process.stdout.write` : `console.log` est banni (CLAUDE.md §5),
 * et ce decompte est une sortie de journal délibérée, pas une trace résiduelle.
 */
const prisma = new PrismaClient();

let societes = 0;
let agences = 0;
let comptesPortail = 0;

for (const societe of SOCIETES) {
  const decompte = await avecSociete(prisma, societe.id, async (tx) => ({
    societe: await tx.societe.count(),
    agence: await tx.agence.count(),
    portail: await tx.utilisateurClient.count(),
  }));

  societes += decompte.societe;
  agences += decompte.agence;
  comptesPortail += decompte.portail;
}

// Référentiel de plateforme : lisible par tous, hors cloisonnement (D4).
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
