import { PrismaClient } from "@prisma/client";

import { uuidv7 } from "@/lib/db/uuid";
import { DEVISES, PARITES } from "../prisma/seed-data";

/**
 * LES RÉFÉRENTIELS DE PLATEFORME, SUR UNE BASE QUI N'A PAS VU LE SEED
 * (09/09/2026).
 *
 * ## Le trou, mesuré plutôt que supposé
 *
 * `devise`, `parite` et `jour_ferie` sont des **référentiels de plateforme**
 * (I1, deuxième catégorie) : des FAITS — *« le franc Pacifique est le même
 * partout »* (D4) —, et non des données de démonstration. Or ils n'étaient
 * écrits nulle part ailleurs que dans `prisma/seed.ts`, c'est-à-dire dans le
 * geste qu'on interdit sur une base de production.
 *
 * *Mesuré le 09/09/2026, sur une base neuve migrée sans seed :*
 * `scripts/societe-initiale.mts` refuse en disant **« la devise XPF n'est pas
 * au référentiel de plateforme »**. La chaîne de mise en ligne était donc
 * coupée deux crans plus bas qu'on ne le croyait : pas de devise, donc pas de
 * société, donc pas de premier compte.
 *
 * **Le refus était juste, et c'est ce qui a rendu le trou visible.** Un script
 * qui aurait créé la devise « au passage » aurait fait disparaître le symptôme
 * en laissant la question — quels référentiels une base de production
 * porte-t-elle, et qui les y met ?
 *
 * ## Ce qu'il écrit, et ce qu'il n'écrit pas
 *
 * **Devises et parités**, par `upsert` sur leur clé naturelle : rejouable sans
 * dommage, et un libellé se corrige sans dupliquer la ligne.
 *
 * **Pas les jours fériés**, et ce n'est pas un oubli : leur horizon est
 * GLISSANT et se calcule par TERRITOIRE (D46), or le territoire vient des
 * agences. Le geste existe déjà et il est daté — `pnpm feries:etendre` —, il
 * se joue une fois qu'une agence existe, et `pnpm feries:horizon` échoue si
 * l'horizon retombe sous douze mois. *Les recopier ici serait une seconde
 * lecture d'un même critère (§9, 01/09).*
 *
 * ## Usage
 *
 *     REFERENTIELS_PLATEFORME_CONFIRMES=oui \
 *     DATABASE_URL=<connexion du rôle PROPRIÉTAIRE> \
 *     pnpm tsx scripts/referentiels-plateforme.mts
 *
 * Sortie via `process.stdout.write` : `console.log` est banni (CLAUDE.md §5).
 */

export const VARIABLE_CONFIRMATION = "REFERENTIELS_PLATEFORME_CONFIRMES";

const dire = (ligne: string): void => {
  process.stdout.write(`${ligne}\n`);
};

/** Écrit devises et parités, et rend ce qui a été posé. */
export async function poserReferentiels(
  prisma: PrismaClient,
): Promise<{ devises: number; parites: number }> {
  for (const devise of DEVISES) {
    await prisma.devise.upsert({
      where: { code: devise.code },
      update: {
        libelle: devise.libelle,
        decimales: devise.decimales,
        symbole: devise.symbole,
      },
      create: devise,
    });
  }

  for (const parite of PARITES) {
    const date_effet = new Date(parite.date_effet);
    await prisma.parite.upsert({
      where: {
        devise_code_date_effet: { devise_code: parite.devise_code, date_effet },
      },
      update: { taux: parite.taux, source: parite.source },
      create: {
        id: uuidv7(),
        devise_code: parite.devise_code,
        date_effet,
        taux: parite.taux,
        source: parite.source,
      },
    });
  }

  return { devises: DEVISES.length, parites: PARITES.length };
}

async function principal(): Promise<number> {
  if (process.env[VARIABLE_CONFIRMATION] !== "oui") {
    dire(
      `Refus : ${VARIABLE_CONFIRMATION}=oui est exigé. Ce geste écrit des ` +
        "référentiels sur une base réelle ; il ne s'exécute pas par inadvertance.",
    );
    return 2;
  }

  const prisma = new PrismaClient();
  try {
    const pose = await poserReferentiels(prisma);
    dire("");
    dire(`Référentiels de plateforme posés.`);
    dire(`  devises : ${pose.devises}`);
    dire(`  parités : ${pose.parites}`);
    dire("");
    dire(
      "  Les JOURS FÉRIÉS ne sont pas ici : leur horizon est glissant et se " +
        "calcule par territoire, donc depuis les agences. Jouer " +
        "« pnpm feries:etendre » une fois qu'une agence existe, puis " +
        "« pnpm feries:horizon » pour constater les douze mois.",
    );
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

process.exitCode = await principal();
