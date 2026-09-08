import { PrismaClient } from "@prisma/client";

import { ouvrirPremierCompte, RefusAmorcage } from "@/lib/auth/amorcage";
import { estRole, Role } from "@/lib/auth/roles";

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
 * Il imprime **une fois** l'URL de premier accès. Elle porte un jeton à usage
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

/** Lit `--clef valeur` dans une ligne de commande. */
export function argument(argv: readonly string[], clef: string): string | null {
  const rang = argv.indexOf(`--${clef}`);
  if (rang === -1) {
    return null;
  }
  return argv[rang + 1] ?? null;
}

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

  if (societeId === null || email === null || nom === null) {
    dire(
      'Usage : --societe <uuid> --email <courriel> --nom "<nom>" ' +
        "[--role admin_societe] [--base https://…]",
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

process.exitCode = await principal();
