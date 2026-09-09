import { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { avecSociete } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { argument } from "./lib/arguments";

/**
 * LA PREMIÈRE SOCIÉTÉ D'UNE BASE DE PRODUCTION (09/09/2026).
 *
 * ## Le trou que ce script bouche, et il était béant
 *
 * La note de mise en ligne enchaîne : créer une base neuve, migrer, puis
 * **ouvrir le premier compte avec `--societe <uuid>`**. *Mesuré en relisant la
 * chaîne : sur une base neuve, aucune société n'existe et rien dans le dépôt
 * n'en crée* — `prisma/seed.ts` en écrit deux, mais il est réservé à la
 * démonstration et le flux de migration le saute sur la cible `production`.
 * La procédure était donc **impossible à suivre jusqu'au bout**, et personne ne
 * s'en était aperçu parce que la seule base existante en portait déjà.
 *
 * ## Ce qu'il n'invente pas, et c'est la moitié du travail
 *
 * **Toutes les valeurs sont reçues en arguments.** Raison sociale, pays,
 * territoire, fuseau, devise, majoration hors ouverture : ce sont des données
 * métier, et le §8 du CLAUDE.md interdit d'inventer un taux. La majoration en
 * particulier est un POURCENTAGE : lui donner un défaut serait décider d'un
 * prix à la place de l'exploitation.
 *
 * ## Le cliquet
 *
 * Le geste refuse dès qu'une société porte déjà ce code — l'unicité est en
 * base, et le refus la double d'un message lisible. Il ne refuse PAS parce
 * qu'une autre société existe : une plateforme multi-société en accueille
 * plusieurs, et ce serait confondre « première société de la base » avec
 * « première société tout court ».
 *
 * ## Usage
 *
 *     SOCIETE_INITIALE_CONFIRMEE=oui \
 *     DATABASE_URL=<connexion du rôle PROPRIÉTAIRE> \
 *     pnpm tsx scripts/societe-initiale.mts \
 *       --code CODIMA-NC --raison-sociale "CODIMA Nouvelle-Calédonie" \
 *       --pays NC --territoire NC --fuseau Pacific/Noumea \
 *       --devise XPF --langue fr --majoration 25
 *
 * Sortie via `process.stdout.write` : `console.log` est banni (CLAUDE.md §5).
 */

export const VARIABLE_CONFIRMATION = "SOCIETE_INITIALE_CONFIRMEE";

/**
 * La saisie, validée par Zod comme toute entrée (CLAUDE.md §2).
 *
 * Le **territoire** est un code ISO 3166-1 alpha-2 et le **fuseau** un
 * identifiant IANA : deux attributs distincts et indépendants, *l'un ne se
 * déduit jamais de l'autre* (D46). La **majoration** est un pourcentage à deux
 * décimales, borné à 100 : au-delà, c'est une erreur de saisie plutôt qu'un
 * tarif — un doublement du prix hors ouverture s'écrit `100`.
 */
export const schemaSocieteInitiale = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .regex(/^[A-Z0-9][A-Z0-9-]*$/, {
      message:
        "Le code est un préfixe de numérotation : majuscules, chiffres et tirets.",
    }),
  raison_sociale: z.string().trim().min(1),
  pays: z
    .string()
    .trim()
    .regex(/^[A-Z]{2}$/),
  territoire: z
    .string()
    .trim()
    .regex(/^[A-Z]{2}$/),
  fuseau_horaire: z
    .string()
    .trim()
    .regex(/^[A-Za-z_]+\/[A-Za-z_+-]+$/, {
      message: "Le fuseau est un identifiant IANA, par exemple Pacific/Noumea.",
    }),
  devise_code: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/),
  majoration_hors_ouverture_pct: z.number().min(0).max(100),
  /**
   * La langue de la société. **Elle documente une intention et n'est pas
   * exploitée en V1** (D26) — l'interface est en français, point. Elle est
   * néanmoins obligatoire au schéma, donc elle se saisit : une valeur par
   * défaut posée ici trancherait, sans le dire, une question que D26 a
   * délibérément laissée ouverte.
   */
  langue: z
    .string()
    .trim()
    .regex(/^[a-z]{2}$/),
});

export type SaisieSocieteInitiale = z.infer<typeof schemaSocieteInitiale>;

/** Refus lisible : ce qui bloque, et la marche à suivre. */
export class RefusSocieteInitiale extends Error {}

const dire = (ligne: string): void => {
  process.stdout.write(`${ligne}\n`);
};

/**
 * Écrit la société, sous SON PROPRE contexte.
 *
 * `societe` est de forme « adhésion » — dont la moitié qui gouverne l'écriture
 * est l'identité, `id = app.societe_id` (D42, D67). Une écriture faite sans
 * contexte serait donc refusée par le `WITH CHECK`, en silence et par zéro
 * ligne : on pose le contexte sur l'identifiant que l'on vient de tirer, et la
 * politique juge la ligne contre lui.
 */
export async function ecrireSocieteInitiale(
  client: PrismaClient,
  saisie: SaisieSocieteInitiale,
): Promise<{ id: string; code: string; raison_sociale: string }> {
  const devise = await client.devise.findUnique({
    where: { code: saisie.devise_code },
  });
  if (devise === null) {
    throw new RefusSocieteInitiale(
      `La devise « ${saisie.devise_code} » n'est pas au référentiel de ` +
        "plateforme. Les devises sont posées par les migrations ; en ajouter " +
        "une est un geste d'éditeur, pas de mise en ligne.",
    );
  }

  const deja = await client.societe.findUnique({
    where: { code: saisie.code },
  });
  if (deja !== null) {
    throw new RefusSocieteInitiale(
      `Une société porte déjà le code « ${saisie.code} ». Ce geste ouvre une ` +
        "société, il n'en modifie aucune.",
    );
  }

  const id = uuidv7();
  return avecSociete(client, id, (tx) =>
    tx.societe.create({
      data: { id, ...saisie },
      select: { id: true, code: true, raison_sociale: true },
    }),
  );
}

async function principal(): Promise<number> {
  if (process.env[VARIABLE_CONFIRMATION] !== "oui") {
    dire(
      `Refus : ${VARIABLE_CONFIRMATION}=oui est exigé. Ce geste ouvre une ` +
        "société sur une base réelle ; il ne s'exécute pas par inadvertance.",
    );
    return 2;
  }

  const argv = process.argv.slice(2);
  const brut = {
    code: argument(argv, "code"),
    raison_sociale: argument(argv, "raison-sociale"),
    pays: argument(argv, "pays"),
    territoire: argument(argv, "territoire"),
    fuseau_horaire: argument(argv, "fuseau"),
    devise_code: argument(argv, "devise"),
    langue: argument(argv, "langue"),
    majoration: argument(argv, "majoration"),
  };

  if (Object.values(brut).some((valeur) => valeur === null)) {
    dire(
      "Usage : --code <CODE> --raison-sociale « … » --pays NC --territoire NC " +
        "--fuseau Pacific/Noumea --devise XPF --langue fr --majoration 25",
    );
    dire("");
    dire(
      "  Aucune de ces valeurs n'a de défaut : ce sont des données métier, et " +
        "la majoration est un POURCENTAGE — lui en inventer un reviendrait à " +
        "décider d'un prix.",
    );
    return 2;
  }

  const lu = schemaSocieteInitiale.safeParse({
    ...brut,
    majoration_hors_ouverture_pct: Number(brut.majoration),
  });
  if (!lu.success) {
    dire("Refus : la saisie est invalide.");
    for (const souci of lu.error.issues) {
      dire(`  ${souci.path.join(".") || "(racine)"} : ${souci.message}`);
    }
    return 2;
  }

  const client = new PrismaClient();
  try {
    const societe = await ecrireSocieteInitiale(client, lu.data);
    dire("");
    dire(`Société ouverte : « ${societe.raison_sociale} » (${societe.code}).`);
    dire(`  identifiant : ${societe.id}`);
    dire("");
    dire(
      "  C'est cet identifiant que réclament l'ouverture du premier compte " +
        "et le geste du taux horaire initial. Notez-le.",
    );
    return 0;
  } catch (erreur) {
    if (erreur instanceof RefusSocieteInitiale) {
      dire(`Refus : ${erreur.message}`);
      return 1;
    }
    throw erreur;
  } finally {
    await client.$disconnect();
  }
}

process.exitCode = await principal();
