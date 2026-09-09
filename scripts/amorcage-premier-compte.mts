import { PrismaClient } from "@prisma/client";

import {
  ouvrirPremierCompte,
  reemettreJetonPremierAcces,
  RefusAmorcage,
  RefusReemission,
} from "@/lib/auth/amorcage";
import { estRole, Role } from "@/lib/auth/roles";

import { argument } from "./lib/arguments";

/**
 * AMORÇAGE — ouverture de la première identité d'une société (Q1 / D65).
 *
 * ## Pourquoi ce script existe, et quand il disparaîtra
 *
 * Aucun compte de la base hébergée ne portait de mot de passe, et
 * `utilisateur_ouverture` exigeait un rôle qu'aucun compte ne pouvait tenir :
 * **personne ne pouvait se connecter**. Ce script franchit la branche
 * d'amorçage que la base admet — une société qui ne porte AUCUNE habilitation —
 * et l'acte la referme.
 *
 * *Le jour où le chemin administratif d'ouverture de compte existe, ce script
 * disparaît*, et c'est la machine qui le constate :
 * `tests/unit/auth/amorcage-retrait.test.ts` échoue dès qu'un appel à
 * `signUpEmail` apparaît hors du geste, hors d'ici et hors des tests.
 *
 * ## Ce qu'il imprime, et ce qu'il n'imprime jamais
 *
 * Il imprime **une fois** l'URL de premier accès — à l'ouverture comme à la réémission. Elle porte un jeton à usage
 * unique et daté, et **elle n'est relisible nulle part** : ni en base sous cette
 * forme, ni dans un journal. Elle se transmet HORS BANDE, par le canal de
 * l'exploitation.
 *
 * Il n'imprime **aucun mot de passe** : le geste en tire un au hasard pour
 * satisfaire la bibliothèque, ne le rend à personne, et le rend inutile en
 * émettant le jeton.
 *
 * ## Usage
 *
 *     AMORCAGE_PREMIER_COMPTE_CONFIRME=oui \
 *     DATABASE_URL=… \
 *     pnpm tsx scripts/amorcage-premier-compte.mts \
 *       --societe <uuid> --email <courriel> --nom "<nom>" [--role admin_societe] \
 *       [--base https://…]
 *
 * Et la RÉÉMISSION d'un jeton expiré ou perdu, pour une identité qui n'a
 * JAMAIS servi (10/09/2026, complément de D65) :
 *
 *     AMORCAGE_PREMIER_COMPTE_CONFIRME=oui \
 *     DATABASE_URL=… \
 *     pnpm tsx scripts/amorcage-premier-compte.mts \
 *       --reemettre --societe <uuid> --email <courriel> [--base https://…]
 *
 * La variable de confirmation suit le précédent de
 * `scripts/purge-demonstration.mts` : un geste qui touche aux droits ne
 * s'exécute pas par inadvertance dans un enchaînement.
 *
 * **La société se NOMME par son identifiant**, elle ne se cherche pas par son
 * code : `societe` est de forme « identité » (D42) et ne se lit qu'en étant
 * nommée. Chercher par code serait filtré, et un geste qui ne trouve rien
 * ressemblerait à un geste qui refuse.
 *
 * Sortie via `process.stdout.write` : `console.log` est banni (CLAUDE.md §5).
 */

export const VARIABLE_CONFIRMATION = "AMORCAGE_PREMIER_COMPTE_CONFIRME";

const dire = (ligne: string): void => {
  process.stdout.write(`${ligne}\n`);
};

async function principal(): Promise<number> {
  if (process.env[VARIABLE_CONFIRMATION] !== "oui") {
    dire(
      `Refus : ${VARIABLE_CONFIRMATION}=oui est exigé. Ce geste ouvre la ` +
        "première identité d'une société et lui accorde un rôle ; il ne " +
        "s'exécute pas par inadvertance.",
    );
    return 2;
  }

  const argv = process.argv.slice(2);
  const societeId = argument(argv, "societe");
  const email = argument(argv, "email");
  const nom = argument(argv, "nom");
  const roleDemande = argument(argv, "role");
  const base = argument(argv, "base");
  const reemettre = argv.includes("--reemettre");

  if (reemettre) {
    if (societeId === null || email === null) {
      dire(
        "Usage : --reemettre --societe <uuid> --email <courriel> [--base https://…]",
      );
      return 2;
    }
    if (base !== null) {
      process.env.BETTER_AUTH_URL = base;
    }
    return reemission(societeId, email);
  }

  if (societeId === null || email === null || nom === null) {
    dire(
      'Usage : --societe <uuid> --email <courriel> --nom "<nom>" ' +
        "[--role admin_societe] [--base https://…]\n" +
        "        --reemettre --societe <uuid> --email <courriel> [--base https://…]",
    );
    return 2;
  }
  if (roleDemande !== null && !estRole(roleDemande)) {
    dire(`Refus : « ${roleDemande} » n'est pas un rôle de l'énumération.`);
    return 2;
  }

  // La base d'URL sert à composer le lien de premier accès. Better Auth la lit
  // de l'environnement ; elle est exigée ici plutôt que devinée, une URL fausse
  // rendant le lien inutilisable sans que rien ne le dise.
  if (base !== null) {
    process.env.BETTER_AUTH_URL = base;
  }

  const client = new PrismaClient();
  try {
    const ouverture = await ouvrirPremierCompte(client, {
      societeId,
      email,
      nom,
      role: roleDemande === null ? Role.admin_societe : (roleDemande as Role),
    });
    dire("");
    dire("Première identité ouverte.");
    dire(`  identifiant   : ${ouverture.utilisateurId}`);
    dire(`  rôle          : ${ouverture.role}`);
    dire(`  sessions refermées par le geste : ${ouverture.sessionsRefermees}`);
    dire("");
    dire("  URL DE PREMIER ACCÈS — imprimée UNE FOIS, jamais relisible :");
    dire(`  ${ouverture.urlPremierAcces}`);
    dire("");
    dire(
      "  À transmettre hors bande. Le jeton est à usage unique et daté ; " +
        "aucun mot de passe n'a été posé ni imprimé.",
    );
    dire("");
    dire(
      "  La porte est REFERMÉE : la société porte désormais une habilitation, " +
        "et la branche d'amorçage de utilisateur_ouverture est inapplicable.",
    );
    return 0;
  } catch (erreur) {
    if (erreur instanceof RefusAmorcage) {
      dire(`Refus : ${erreur.message}`);
      return 1;
    }
    throw erreur;
  } finally {
    await client.$disconnect();
  }
}

/**
 * LA RÉÉMISSION (10/09/2026, complément de D65).
 *
 * Le jeton de premier accès vit une heure. Expiré, il ne laissait AUCUNE voie
 * de retour : le second appel du geste est refusé, et la production n'émet
 * rien. Ce chemin la rend, sous un cliquet plus étroit que celui de l'amorçage :
 * il ne sert qu'une identité qui n'a JAMAIS servi — `compte.mot_de_passe` nul,
 * l'état dans lequel l'amorçage laisse le moyen de connexion — et il se ferme
 * pour toujours dès qu'un mot de passe existe. Il ne rouvre jamais le chemin
 * d'ouverture, et il imprime l'URL UNE fois, comme l'ouverture.
 */
async function reemission(societeId: string, email: string): Promise<number> {
  const client = new PrismaClient();
  try {
    const reemis = await reemettreJetonPremierAcces(client, {
      societeId,
      email,
    });
    dire("");
    dire("Jeton de premier accès RÉÉMIS.");
    dire(`  identifiant   : ${reemis.utilisateurId}`);
    dire("");
    dire("  URL DE PREMIER ACCÈS — imprimée UNE FOIS, jamais relisible :");
    dire(`  ${reemis.urlPremierAcces}`);
    dire("");
    dire(
      "  À transmettre hors bande. Le jeton est à usage unique et daté. Un " +
        "jeton précédent encore vivant reste valide jusqu'à son expiration : " +
        "ce geste ne sait pas l'invalider.",
    );
    dire("");
    dire(
      "  Ce geste se FERME pour toujours dès qu'un mot de passe est choisi : " +
        "un mot de passe oublié se traite par le chemin ordinaire.",
    );
    return 0;
  } catch (erreur) {
    if (erreur instanceof RefusReemission) {
      dire(`Refus : ${erreur.message}`);
      return 1;
    }
    throw erreur;
  } finally {
    await client.$disconnect();
  }
}

process.exitCode = await principal();
