import { PrismaClient } from "@prisma/client";

import { formatMoney } from "@/lib/money";
import {
  poserTauxInitial,
  RefusTauxInitial,
} from "@/lib/tarification/taux-initial";

import { argument } from "./lib/arguments";

/**
 * TAUX INITIAL — le premier taux horaire d'une société, à sa mise en service
 * (décision d'exploitation du 09/09/2026 ; D68, RG-TAR-04).
 *
 * ## Pourquoi ce script, et pourquoi il est SÉPARÉ de l'amorçage
 *
 * `taux_horaire` naît vide : le montant est arrêté au rang 1 (D68 — 7 000 XPF
 * hors taxes pour CODIMA NC), la date d'effet est celle de la mise en service,
 * et c'était le MÉCANISME d'écriture qui attendait un mot de l'exploitation.
 * Le mot est « séparé » : un geste de sécurité (l'amorçage) et un geste de
 * tarif ne partagent ni leurs défaillances, ni leurs cliquets.
 *
 * ## Ce qu'il écrit
 *
 * UNE ligne, et seulement si la société n'en porte aucune. Le montant est
 * reçu dans l'UNITÉ LA PLUS FINE de la devise de la société — `7000` pour
 * 7 000 XPF, `6500` pour 65,00 EUR — et le script le RÉPÈTE formaté, pour
 * qu'une erreur d'échelle se voie avant d'être facturée. La devise n'est pas
 * un argument : c'est celle de la société.
 *
 * ## Usage
 *
 *     TAUX_INITIAL_CONFIRME=oui \
 *     DATABASE_URL=… \
 *     pnpm tsx scripts/taux-initial.mts \
 *       --societe <uuid> --montant 7000 [--date AAAA-MM-JJ]
 *
 * Sans `--date`, la date d'effet est LE JOUR DU GESTE, dans le fuseau de la
 * société. La variable de confirmation suit le précédent de
 * `scripts/purge-demonstration.mts` : un geste qui écrit un tarif ne
 * s'exécute pas par inadvertance dans un enchaînement.
 *
 * Sortie via `process.stdout.write` : `console.log` est banni (CLAUDE.md §5).
 */

export const VARIABLE_CONFIRMATION = "TAUX_INITIAL_CONFIRME";

const dire = (ligne: string): void => {
  process.stdout.write(`${ligne}\n`);
};

async function principal(): Promise<number> {
  if (process.env[VARIABLE_CONFIRMATION] !== "oui") {
    dire(
      `Refus : ${VARIABLE_CONFIRMATION}=oui est exigé. Ce geste écrit le ` +
        "premier taux horaire d'une société ; il ne s'exécute pas par " +
        "inadvertance.",
    );
    return 2;
  }

  const argv = process.argv.slice(2);
  const societeId = argument(argv, "societe");
  const montantTexte = argument(argv, "montant");
  const date = argument(argv, "date");

  if (societeId === null || montantTexte === null) {
    dire(
      "Usage : --societe <uuid> --montant <entier, unité la plus fine> [--date AAAA-MM-JJ]",
    );
    return 2;
  }
  if (!/^\d+$/.test(montantTexte)) {
    dire(
      `Refus : « ${montantTexte} » n'est pas un entier. Le montant s'écrit dans ` +
        "l'unité la plus fine de la devise de la société — 7000 pour 7 000 XPF, " +
        "6500 pour 65,00 EUR (I3).",
    );
    return 2;
  }

  const client = new PrismaClient();
  try {
    const pose = await poserTauxInitial(client, {
      societeId,
      montantMineur: BigInt(montantTexte),
      ...(date === null ? {} : { dateEffet: date }),
    });
    dire("");
    dire(`Premier taux horaire écrit pour « ${pose.societe} ».`);
    dire(`  date d'effet  : ${pose.dateEffet}`);
    dire(`  taux          : ${formatMoney(pose.taux, pose.devise)} hors taxes`);
    dire("");
    dire(
      "  Relire le taux formaté ci-dessus : une erreur d'échelle se corrige " +
        "par le chemin ordinaire, jamais en rejouant ce geste, qui refuse " +
        "désormais.",
    );
    return 0;
  } catch (erreur) {
    if (erreur instanceof RefusTauxInitial) {
      dire(`Refus : ${erreur.message}`);
      return 1;
    }
    throw erreur;
  } finally {
    await client.$disconnect();
  }
}

process.exitCode = await principal();
