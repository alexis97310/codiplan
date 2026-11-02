import { afterAll, afterEach, describe, expect, it } from "vitest";

import {
  creerCompteDeBureau,
  envoyerLienDAccesBureau,
  etatsAccesDesComptes,
} from "@/lib/auth/acces-bureau";
import {
  envoyerLienDAcces,
  etatsAccesDesTechniciens,
} from "@/lib/auth/acces-technicien";
import { Role } from "@/lib/auth/roles";
import { creerTechnicien } from "@/lib/techniciens/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { AGENCE_A, SOCIETE_A, UTILISATEUR_PAR_ROLE } from "./setup/fixtures";

/**
 * 9IC-CORRECTIFS-COURTS, point 2 (réserve du solde 595 sur
 * 9I4-EQUIPE-N-PLUS-UN) — le `Promise.all` SANS plafond qui lisait les
 * comptes de l'écran Équipe de front est remplacé par `parTranchesDeCinq`
 * (`lib/auth/acces-bureau.ts`), dans `etatsAccesDesTechniciens` ET
 * `etatsAccesDesComptes`.
 *
 * Ce fichier mesure ce que 9I4 ne mesurait pas :
 *   (b) qu'aucune confusion d'identité ne se glisse entre tranches — chaque
 *       utilisateur reçoit SON état, pas celui d'un autre, sur un lot
 *       d'états MÉLANGÉS (aucun, actif, lien_envoye, lien_expire) ;
 *   (c) la même mesure côté bureau (`etatsAccesDesComptes`).
 *
 * **Le plafond de 5 lectures simultanées (point 2a) n'est PAS mesuré ici.**
 * Une épreuve mesurée l'a d'abord été ici, en comptant les `$transaction`
 * en vol sur `clientApp()` — et a révélé, sous `pnpm test:isolation`
 * complet, jusqu'à 35 comptes aux rôles « administrer_utilisateurs »
 * accumulés dans SOCIETE_A par d'autres fichiers du dépôt (mesuré par une
 * requête directe sur `utilisateur_societe`, filtrée sur ces rôles et
 * groupée par société). `etatsAccesDesTechniciens` lit le journal de
 * CHAQUE administrateur par un `Promise.all` SANS plafond (hors territoire
 * de ce lot) : la mesure comptait CETTE concurrence-là, pas celle de la
 * tranche de 5 `compte.findFirst`, et un nombre d'administrateurs qui varie
 * selon ce qui tourne par ailleurs dans la suite rend la mesure instable
 * par construction — pas par un défaut du plafond. La preuve déterministe
 * du plafond est dans `tests/unit/auth/acces-bureau.test.ts` (describe
 * `parTranchesDeCinq`), sur la fonction partagée elle-même, sans dépendre
 * d'aucune donnée de fixture.
 */

const ADMIN_A = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.admin_societe],
  societeId: SOCIETE_A,
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const PREFIXE = "9iceq-";

function courriel(): string {
  return `${PREFIXE}${Math.floor(Math.random() * 10_000_000)}@codima.test`;
}

async function reculerDeuxHeures(utilisateurId: string): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `UPDATE "compte" SET cree_le = now() - interval '2 hours'
      WHERE utilisateur_id = $1::uuid`,
    utilisateurId,
  );
  await clientOwner().$executeRawUnsafe(
    `UPDATE "journal_acces" SET horodatage = now() - interval '2 hours'
      WHERE detail LIKE '%cible:' || $1`,
    utilisateurId,
  );
}

async function poserMotDePasse(utilisateurId: string): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `UPDATE "compte" SET mot_de_passe = 'empreinte-de-test' WHERE utilisateur_id = $1::uuid`,
    utilisateurId,
  );
}

type EtatVoulu = "aucun" | "lien_envoye" | "lien_expire" | "actif";

async function creerTechnicienDansEtat(etat: EtatVoulu): Promise<string> {
  const resultat = await creerTechnicien(
    ADMIN_A,
    {
      nom: `Technicien 9IC ${etat}`,
      email: courriel(),
      agence_id: AGENCE_A,
      actif: true,
      statut_ressource: "salarie",
    },
    clientApp(),
  );
  if (!resultat.accepte) throw new Error("fixture technicien non créée");
  const { utilisateurId } = resultat;
  if (etat === "aucun") return utilisateurId;
  await envoyerLienDAcces(ADMIN_A, utilisateurId, clientApp(), {});
  if (etat === "lien_envoye") return utilisateurId;
  if (etat === "lien_expire") {
    await reculerDeuxHeures(utilisateurId);
    return utilisateurId;
  }
  await poserMotDePasse(utilisateurId);
  return utilisateurId;
}

async function creerBureauDansEtat(etat: EtatVoulu): Promise<string> {
  const cree = await creerCompteDeBureau(
    ADMIN_A,
    { nom: `Bureau 9IC ${etat}`, courriel: courriel(), role: Role.adv },
    clientApp(),
  );
  if (!cree.accepte) throw new Error("fixture compte de bureau non créée");
  const { utilisateurId } = cree;
  if (etat === "aucun") return utilisateurId;
  await envoyerLienDAccesBureau(ADMIN_A, utilisateurId, clientApp(), {});
  if (etat === "lien_envoye") return utilisateurId;
  if (etat === "lien_expire") {
    await reculerDeuxHeures(utilisateurId);
    return utilisateurId;
  }
  await poserMotDePasse(utilisateurId);
  return utilisateurId;
}

afterEach(async () => {
  const motif = `${PREFIXE}%`;
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "journal_acces" WHERE "detail" LIKE $1 OR "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "compte" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "technicien" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur_societe" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur" WHERE "email" LIKE $1`,
    motif,
  );
});

afterAll(fermerClients);

describe("etatsAccesDesTechniciens — des états MÉLANGÉS dans un même appel ne se confondent pas entre tranches (point 2b)", () => {
  it("chaque technicien reçoit SON état, pas celui d'un voisin de tranche", async () => {
    const aucun = await creerTechnicienDansEtat("aucun");
    const envoye = await creerTechnicienDansEtat("lien_envoye");
    const expire = await creerTechnicienDansEtat("lien_expire");
    const actif = await creerTechnicienDansEtat("actif");

    // Répété pour dépasser une seule tranche de 5 (8 identifiants, les
    // quatre états répétés deux fois) — si une tranche écrivait dans le
    // mauvais emplacement, ce test le verrait, un appel à 4 ne le verrait
    // peut-être pas (une seule tranche).
    const aucun2 = await creerTechnicienDansEtat("aucun");
    const envoye2 = await creerTechnicienDansEtat("lien_envoye");
    const expire2 = await creerTechnicienDansEtat("lien_expire");
    const actif2 = await creerTechnicienDansEtat("actif");

    const ids = [
      aucun,
      envoye,
      expire,
      actif,
      aucun2,
      envoye2,
      expire2,
      actif2,
    ];
    const etats = await etatsAccesDesTechniciens(ADMIN_A, ids, clientApp());

    expect(etats.get(aucun)?.etat).toBe("aucun");
    expect(etats.get(envoye)?.etat).toBe("lien_envoye");
    expect(etats.get(expire)?.etat).toBe("lien_expire");
    expect(etats.get(actif)?.etat).toBe("actif");
    expect(etats.get(aucun2)?.etat).toBe("aucun");
    expect(etats.get(envoye2)?.etat).toBe("lien_envoye");
    expect(etats.get(expire2)?.etat).toBe("lien_expire");
    expect(etats.get(actif2)?.etat).toBe("actif");
  });
});

describe("etatsAccesDesComptes — des états MÉLANGÉS dans un même appel ne se confondent pas entre tranches (point 2c)", () => {
  it("chaque compte de bureau reçoit SON état, pas celui d'un voisin de tranche", async () => {
    const aucun = await creerBureauDansEtat("aucun");
    const envoye = await creerBureauDansEtat("lien_envoye");
    const expire = await creerBureauDansEtat("lien_expire");
    const actif = await creerBureauDansEtat("actif");
    const aucun2 = await creerBureauDansEtat("aucun");
    const envoye2 = await creerBureauDansEtat("lien_envoye");
    const expire2 = await creerBureauDansEtat("lien_expire");
    const actif2 = await creerBureauDansEtat("actif");

    const ids = [
      aucun,
      envoye,
      expire,
      actif,
      aucun2,
      envoye2,
      expire2,
      actif2,
    ];
    const etats = await etatsAccesDesComptes(ADMIN_A, ids, clientApp());

    expect(etats.get(aucun)?.etat).toBe("aucun");
    expect(etats.get(envoye)?.etat).toBe("lien_envoye");
    expect(etats.get(expire)?.etat).toBe("lien_expire");
    expect(etats.get(actif)?.etat).toBe("actif");
    expect(etats.get(aucun2)?.etat).toBe("aucun");
    expect(etats.get(envoye2)?.etat).toBe("lien_envoye");
    expect(etats.get(expire2)?.etat).toBe("lien_expire");
    expect(etats.get(actif2)?.etat).toBe("actif");
  });
});
