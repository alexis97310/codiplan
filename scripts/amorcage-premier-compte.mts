import { PrismaClient } from "@prisma/client";

import {
  ouvrirPremierCompte,
  reemettreJetonPremierAcces,
  RefusAmorcage,
  RefusReemission,
} from "@/lib/auth/amorcage";
import { estRole, Role } from "@/lib/auth/roles";
import type { Envoi } from "@/lib/courriel/message";
import { envoyerLienPremierAcces } from "@/lib/courriel/premier-acces";

import { argument } from "./lib/arguments";
import {
  codeApresEnvoi,
  lignesDelivrance,
  resoudreDelivrance,
  type Delivrance,
} from "./lib/delivrance-premier-acces";

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
 *       [--base https://…] [--envoyer] [--destinataire <courriel>]
 *
 * Et la RÉÉMISSION d'un jeton expiré ou perdu, pour une identité qui n'a
 * JAMAIS servi (10/09/2026, complément de D65) :
 *
 *     AMORCAGE_PREMIER_COMPTE_CONFIRME=oui \
 *     DATABASE_URL=… \
 *     pnpm tsx scripts/amorcage-premier-compte.mts \
 *       --reemettre --societe <uuid> --email <courriel> [--base https://…]
 *       [--envoyer] [--destinataire <courriel>]
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
  // L'ENVOI SE DEMANDE. Sans ce drapeau rien ne part et rien n'est tenté : un
  // geste qui enverrait « au cas où » écrirait à une adresse qu'on n'a pas
  // relue, et un courriel se transfère et s'imprime.
  const envoyer = argv.includes("--envoyer");
  // LE DESTINATAIRE, DISSOCIÉ DE L'IDENTITÉ (13/09/2026). Facultatif : absent,
  // il vaut `--email`, et le geste se comporte exactement comme avant.
  const destinataire = argument(argv, "destinataire");

  if (reemettre) {
    if (societeId === null || email === null) {
      dire(
        "Usage : --reemettre --societe <uuid> --email <courriel> " +
          "[--base https://…] [--envoyer] [--destinataire <courriel>]",
      );
      return 2;
    }
    if (base !== null) {
      process.env.BETTER_AUTH_URL = base;
    }
    return reemission(
      societeId,
      email,
      envoyer,
      resoudreDelivrance(email, destinataire),
    );
  }

  if (societeId === null || email === null || nom === null) {
    dire(
      'Usage : --societe <uuid> --email <courriel> --nom "<nom>" ' +
        "[--role admin_societe] [--base https://…] [--envoyer] " +
        "[--destinataire <courriel>]\n" +
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
    const envoi = await envoyerSiDemande(
      envoyer,
      resoudreDelivrance(email, destinataire),
      ouverture.urlPremierAcces,
    );
    return codeApresEnvoi(envoi);
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
 * L'ENVOI DU LIEN PAR COURRIEL — `--envoyer` (Q8, 13/09/2026).
 *
 * **Le geste imprimait le lien dans un terminal qu'Alexis n'a pas sous la
 * main.** Le dépôt est public depuis le 12/09, donc un journal d'exécution
 * n'est pas un canal ; et il travaille depuis un téléphone, donc une console
 * locale non plus. *Le lien de premier accès est la seule porte d'une base
 * neuve, et il n'avait aucun chemin jusqu'à son destinataire.*
 *
 * ## L'URL EST IMPRIMÉE DANS TOUS LES CAS, ET C'EST DÉLIBÉRÉ
 *
 * Un envoi manqué ne doit jamais coûter le jeton : il est émis, il vit une
 * heure, et le réémettre demande de rejouer le geste. **Le canal est un
 * confort ; le jeton est le produit.** Celui qui joue le geste depuis un
 * terminal garde donc le lien sous les yeux, que l'envoi parte ou non.
 *
 * *Et l'envoi ne se fait QUE si on le demande* — sans `--envoyer`, rien ne part
 * et rien n'est tenté. Un geste qui enverrait « au cas où » écrirait à une
 * adresse qu'on n'a pas relue.
 *
 * ## `--destinataire` — LA BOÎTE N'EST PLUS L'IDENTITÉ (13/09/2026)
 *
 * `--email` DÉSIGNE l'identité : la réémission la cherche par
 * `utilisateur.findUnique({ where: { email } })`. Envoyer à cette adresse
 * revenait donc à écrire à l'identité elle-même — et les neuf identités du
 * semis portent des adresses en `@codima.test`, un domaine réservé par la RFC
 * 2606 qui ne résout nulle part. *Le canal ouvert la veille livrait dans le
 * vide, sur la seule base où l'on répète le geste avant de le jouer pour de
 * bon.* `--destinataire` sépare les deux ; absent, il vaut `--email`.
 *
 * ## CE N'EST PAS UNE ÉLÉVATION DE PRIVILÈGE, ET VOICI CE QUI LE MESURE
 *
 * **L'ensemble des personnes capables de ce geste ne change pas d'un membre.**
 * Le script exige `DATABASE_URL` sous le rôle de MIGRATION, et ce secret vit
 * dans les secrets Actions du dépôt : qui peut jouer le flux détient déjà
 * l'accès en ÉCRITURE au dépôt, donc — c'est le modèle documenté de GitHub —
 * la capacité de lire ce secret depuis un flux qu'il écrit. Avec lui, la
 * réémission imprimait déjà l'URL sur la sortie d'un terminal, et cette
 * sortie-là ne vit dans aucun journal. **Le drapeau ne donne rien de neuf à
 * personne : il déplace un canal**, du terminal de l'exploitant vers une boîte
 * qu'il nomme.
 *
 * **Et il n'ouvre aucun cliquet.** Les deux verrous de D65 sont intacts et
 * en amont : `ouvrirPremierCompte` refuse dès que la société porte une
 * habilitation, `reemettreJetonPremierAcces` refuse dès qu'un mot de passe
 * existe. Le drapeau est lu APRÈS eux, dans la seule fonction qui poste un
 * message ; il ne touche ni la base, ni une politique, ni un rôle.
 *
 * **Ce qu'il coûte, écrit plutôt que tu.** Le lien voyage vers une adresse qui
 * n'est pas celle du compte qu'il ouvre. C'est pour cela — et pas par souci de
 * traçabilité — que la sortie ET le corps du message nomment l'identité :
 * *qui reçoit doit pouvoir juger sous quel nom il entrerait.*
 */
async function envoyerSiDemande(
  demande: boolean,
  delivrance: Delivrance,
  url: string,
): Promise<Envoi | null> {
  if (!demande) {
    return null;
  }
  const envoi = await envoyerLienPremierAcces(
    delivrance.destinataire,
    url,
    delivrance.identite,
  );
  dire("");
  for (const ligne of lignesDelivrance(envoi, delivrance)) {
    dire(ligne);
  }
  return envoi;
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
async function reemission(
  societeId: string,
  email: string,
  envoyer: boolean,
  delivrance: Delivrance,
): Promise<number> {
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
    const envoi = await envoyerSiDemande(
      envoyer,
      delivrance,
      reemis.urlPremierAcces,
    );
    return codeApresEnvoi(envoi);
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
