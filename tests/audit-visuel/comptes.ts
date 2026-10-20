import { PrismaClient } from "@prisma/client";

import { reemettreJetonPremierAcces } from "@/lib/auth/amorcage";
import { avecDesignationAuth } from "@/lib/auth/lecture-identite";
import { choisirLePremierMotDePasse } from "@/lib/auth/premier-acces";
import { Role } from "@/lib/auth/roles";
import { avecSociete, avecSocieteEtRole } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration, urlApplicative } from "../e2e/setup/base";

/**
 * TROIS ÉCRANS D'ACCÈS QUE LA SCÈNE PARTAGÉE NE PRODUIT PAS ELLE-MÊME :
 * « Activer le second facteur » (un compte `admin_societe` jamais enrôlé),
 * « Premier accès » (un jeton non consommé) et « Lien expiré » (un jeton déjà
 * consommé, rejoué).
 *
 * Chacun ouvre une identité DÉDIÉE, jamais réutilisée — `reemettreJetonPremierAcces`
 * REFUSE pour toujours dès qu'un mot de passe existe (le cliquet de
 * `lib/auth/amorcage.ts`), donc aucun des cinq comptes déjà ouverts par
 * `tests/e2e/setup/scene.ts` ne peut servir deux fois ici. Même chemin que la
 * scène (lue, jamais modifiée) : `avecSocieteEtRole` / `avecDesignationAuth`
 * pour ouvrir l'identité, `reemettreJetonPremierAcces` /
 * `choisirLePremierMotDePasse` pour le mot de passe — jamais une empreinte
 * posée à la main (I9).
 */

async function identiteSocieteCODIMA(client: PrismaClient): Promise<string> {
  const societe = await client.societe.findFirstOrThrow({
    where: { code: "CODIMA-NC" },
    select: { id: true },
  });
  return societe.id;
}

async function ouvrirIdentiteFraiche(
  email: string,
  nom: string,
  role: Role,
): Promise<string> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const societeId = await identiteSocieteCODIMA(client);
    const utilisateur = await avecSocieteEtRole(
      client,
      societeId,
      Role.admin_societe,
      (tx) =>
        tx.utilisateur.upsert({
          where: { email },
          update: { nom },
          create: { id: uuidv7(), nom, email },
        }),
    );
    const designe = avecDesignationAuth(client);
    const compteExistant = await designe.compte.findFirst({
      where: { utilisateur_id: utilisateur.id },
      select: { id: true },
    });
    if (compteExistant !== null) {
      throw new Error(
        `${email} porte déjà un compte : cette identité n'est plus FRAÎCHE, ` +
          "la réémission du jeton de premier accès refusera pour toujours.",
      );
    }
    await designe.compte.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateur.id,
        emetteur: "local:credential",
        compte_externe_id: utilisateur.id,
        fournisseur_id: "credential",
        mot_de_passe: null,
      },
    });
    await avecSociete(client, societeId, (tx) =>
      tx.utilisateurSociete.upsert({
        where: {
          utilisateur_id_societe_id: {
            utilisateur_id: utilisateur.id,
            societe_id: societeId,
          },
        },
        update: { role },
        create: {
          id: uuidv7(),
          utilisateur_id: utilisateur.id,
          societe_id: societeId,
          role,
        },
      }),
    );
    return societeId;
  } finally {
    await client.$disconnect();
  }
}

function jetonDeLUrl(url: string): string | null {
  const analysee = new URL(url, "http://harnais.invalid");
  const enParametre = analysee.searchParams.get("token");
  if (enParametre !== null && enParametre.length > 0) {
    return enParametre;
  }
  const segments = analysee.pathname.split("/").filter((s) => s.length > 0);
  return segments.length === 0 ? null : (segments.at(-1) ?? null);
}

/**
 * Ouvre le compte PORTAIL de démonstration du semis
 * (`prisma/seed-data.ts` `COMPTES_PORTAIL`, "portail@example.test") — identité
 * SÉPARÉE (D10), posée « au repos » (aucun mot de passe) par chaque semis.
 * Rend `null` si l'amorçage ne passe pas (point 2.d : abandon propre plutôt
 * qu'un échec qui interromprait tout le catalogue).
 */
export async function ouvrirSessionPortailDeDemonstration(): Promise<{
  email: string;
  motDePasse: string;
} | null> {
  const email = "portail@example.test";
  const motDePasse = "epreuve-de-bout-en-bout-codiplan";
  const administration = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  let societeId: string;
  try {
    societeId = await identiteSocieteCODIMA(administration);
  } catch {
    await administration.$disconnect();
    return null;
  }
  await administration.$disconnect();

  const client = new PrismaClient({
    datasources: { db: { url: urlApplicative() } },
  });
  try {
    const reemission = await reemettreJetonPremierAcces(client, {
      societeId,
      email,
    });
    const jeton = jetonDeLUrl(reemission.urlPremierAcces);
    if (jeton === null) return null;
    const issue = await choisirLePremierMotDePasse({
      jeton,
      motDePasse,
      confirmation: motDePasse,
    });
    return issue.issue === "abouti" ? { email, motDePasse } : null;
  } catch {
    return null;
  } finally {
    await client.$disconnect();
  }
}

/**
 * Ouvre un compte `admin_societe` DÉDIÉ, jamais enrôlé — pour capturer
 * `/enrolement` tel qu'une première connexion sensible le montre. Rend
 * l'email et le mot de passe : l'appelant se connecte lui-même, par l'écran.
 */
export async function ouvrirCompteAdminSocieteNonEnrole(): Promise<{
  email: string;
  motDePasse: string;
}> {
  const email = "audit.enrolement@codima.test";
  const motDePasse = "epreuve-de-bout-en-bout-codiplan";
  const societeId = await ouvrirIdentiteFraiche(
    email,
    "Audit visuel — enrôlement",
    Role.admin_societe,
  );

  const applicatif = new PrismaClient({
    datasources: { db: { url: urlApplicative() } },
  });
  try {
    const reemission = await reemettreJetonPremierAcces(applicatif, {
      societeId,
      email,
    });
    const jeton = jetonDeLUrl(reemission.urlPremierAcces);
    if (jeton === null) {
      throw new Error(
        "Jeton de premier accès introuvable pour le compte d'enrôlement.",
      );
    }
    const issue = await choisirLePremierMotDePasse({
      jeton,
      motDePasse,
      confirmation: motDePasse,
    });
    if (issue.issue !== "abouti") {
      throw new Error(
        `Premier accès refusé pour le compte d'enrôlement : ${issue.issue}.`,
      );
    }
  } finally {
    await applicatif.$disconnect();
  }
  // AUCUN appel à l'enrôlement : c'est tout l'objet de ce compte de rester
  // non enrôlé jusqu'à la capture.
  return { email, motDePasse };
}

/**
 * Ouvre une identité fraîche et RÉÉMET son jeton de premier accès SANS LE
 * CONSOMMER — pour capturer `/premier-acces` tel qu'un lien fraîchement reçu
 * l'affiche.
 *
 * ## Le faux 404 corrigé (point 1.b du ticket)
 *
 * `reemission.urlPremierAcces` est l'URL que la bibliothèque construit pour
 * SON PROPRE point d'entrée de redirection (`/api/auth/reset-password/...`,
 * *mesuré en corrigeant cet outil* : une navigation directe y donnait un 404
 * — ce chemin attend un en-tête de redirection, pas une visite au premier
 * degré). La page `/premier-acces` de l'application, elle, ne lit que le
 * paramètre `token` de SA PROPRE URL (`app/(sans-session)/premier-acces/page.tsx`).
 * On extrait donc le jeton avec `jetonDeLUrl` et on construit nous-mêmes
 * l'URL que l'application attend.
 */
export async function urlDePremierAccesNonConsomme(): Promise<string> {
  const email = "audit.premier-acces@codima.test";
  const societeId = await ouvrirIdentiteFraiche(
    email,
    "Audit visuel — premier accès",
    Role.adv,
  );
  const client = new PrismaClient({
    datasources: { db: { url: urlApplicative() } },
  });
  try {
    const reemission = await reemettreJetonPremierAcces(client, {
      societeId,
      email,
    });
    const jeton = jetonDeLUrl(reemission.urlPremierAcces);
    if (jeton === null) {
      throw new Error(`Jeton introuvable pour ${email}.`);
    }
    return `/premier-acces?token=${jeton}`;
  } finally {
    await client.$disconnect();
  }
}

/**
 * Ouvre une identité fraîche, RÉÉMET son jeton, le CONSOMME une première
 * fois, puis le PRÉSENTE une seconde fois — refusé, comme un lien déjà servi
 * rejoué le serait — et rend l'URL que l'application affiche alors : la page
 * ne distinguant aucun motif (D35, D50), c'est `/premier-acces` SANS jeton,
 * exactement ce que `app/api/session/premier-acces/route.ts` construit sur
 * un refus de jeton (`issue: "refuse"`, jeton retiré de l'URL).
 */
export async function urlDeLienDejaConsomme(): Promise<string> {
  const email = "audit.lien-expire@codima.test";
  const societeId = await ouvrirIdentiteFraiche(
    email,
    "Audit visuel — lien expiré",
    Role.adv,
  );
  const client = new PrismaClient({
    datasources: { db: { url: urlApplicative() } },
  });
  try {
    const reemission = await reemettreJetonPremierAcces(client, {
      societeId,
      email,
    });
    const jeton = jetonDeLUrl(reemission.urlPremierAcces);
    if (jeton === null) {
      throw new Error(`Jeton introuvable pour ${email}.`);
    }
    const motDePasse = "epreuve-de-bout-en-bout-codiplan";
    const premiere = await choisirLePremierMotDePasse({
      jeton,
      motDePasse,
      confirmation: motDePasse,
    });
    if (premiere.issue !== "abouti") {
      throw new Error(`Premier accès refusé pour ${email} : ${premiere.issue}.`);
    }
    // REJOUÉ — le même jeton, déjà consommé, est présenté une seconde fois.
    const seconde = await choisirLePremierMotDePasse({
      jeton,
      motDePasse,
      confirmation: motDePasse,
    });
    if (seconde.issue !== "refuse") {
      throw new Error(
        `Jeton encore valide après consommation pour ${email} : ${seconde.issue}.`,
      );
    }
    return "/premier-acces?motif=premier_acces.refuse";
  } finally {
    await client.$disconnect();
  }
}
