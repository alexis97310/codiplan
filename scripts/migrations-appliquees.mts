import { PrismaClient } from "@prisma/client";

/**
 * LES MIGRATIONS RÉELLEMENT APPLIQUÉES EN BASE, une par ligne, triées.
 *
 * **Une automatisation muette ne peut pas être auditée** (N1). Ce script est la
 * moitié « observation » du résumé d'exécution : le flux le joue AVANT et APRÈS
 * la migration, et c'est la SOUSTRACTION entre les deux qui nomme ce que cette
 * exécution a posé. *Recopier le répertoire `prisma/migrations/` aurait rendu
 * une ligne qui ne peut pas bouger sous une faute* (§9, 06/09) : elle serait
 * identique que la migration ait abouti ou non.
 *
 * **Une ligne par TENTATIVE, jamais une par migration** — `_prisma_migrations`
 * porte l'essai annulé à côté de l'essai réussi (mesuré le 11/09). Seules les
 * tentatives qui ont abouti sont rendues : `finished_at` non nul et
 * `rolled_back_at` nul. Le `DISTINCT` fait le reste, une migration débloquée
 * pouvant y figurer deux fois.
 *
 * La sortie est TRIÉE et sans décoration : elle est lue par `comm`, qui exige
 * deux entrées triées et rendrait des différences fantaisistes sinon.
 */

const prisma = new PrismaClient();

try {
  const lignes = await prisma.$queryRawUnsafe<Array<{ nom: string }>>(`
    SELECT DISTINCT "migration_name" AS "nom"
    FROM "_prisma_migrations"
    WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL
    ORDER BY "nom"
  `);
  process.stdout.write(lignes.map((l) => l.nom).join("\n"));
  if (lignes.length > 0) process.stdout.write("\n");
  await prisma.$disconnect();
} catch (erreur) {
  // Une table absente est le cas d'une base NEUVE : zéro migration appliquée
  // est la bonne réponse, et elle se distingue d'une base injoignable par le
  // fait que la migration qui suit échouera elle aussi. On ne rend RIEN plutôt
  // que d'inventer, et l'appelant lit un fichier vide.
  await prisma.$disconnect().catch(() => undefined);
  process.stderr.write(
    `Lecture de _prisma_migrations impossible : ${String(erreur)}\n`,
  );
}
