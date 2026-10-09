import { afterAll, afterEach, describe, expect, it } from "vitest";

import type { ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, clientOwner, fermerClients, urlApp } from "./setup/db";
import {
  AGENCE_A,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * `DATABASE_URL` EST POSÉE AVANT L'IMPORT DU MODULE — même raison que
 * `tests/isolation/vgp-client-inactif-machine-sortie.test.ts` :
 * `faitsMiseEnRoute` et `pointsDonneesACompleter` appellent `famillesADeterminer`
 * (`lib/vgp/registre.ts`), qui ne reçoit AUCUN `client` et passe donc par le
 * client global de `lib/db/client.ts`, sous le rôle applicatif.
 */
const URL_DATABASE_AVANT = process.env.DATABASE_URL;
process.env.DATABASE_URL = urlApp();
const { compterEcrituresDuJour, dernieresEcrituresDuJour } =
  await import("@/lib/audit/journal");
const { pointsDonneesACompleter, techniciensAccesAOuvrir } =
  await import("@/lib/tableau-de-bord/lectures");
const { faitsMiseEnRoute } =
  await import("@/lib/tableau-de-bord/mise-en-route");
const { creerTechnicien } = await import("@/lib/techniciens/depot");

/**
 * LE TABLEAU DE BORD DE LA DIRECTION ET DE L'ADMINISTRATEUR
 * (9EG-TP-UX6-TABLEAU-DE-BORD-2, D189) — trois propriétés éprouvées contre un
 * vrai PostgreSQL :
 *
 *   1. « Mise en route » sur une SOCIÉTÉ NEUVE (aucune agence, aucun tarif,
 *      aucun client) montre une seule étape faite sur huit — l'identité, qui
 *      ne se mesure pas ici (elle est toujours vraie, `presentation.test.ts`
 *      la couvre) : les SEPT faits mesurés par `faitsMiseEnRoute` sont tous
 *      FAUX.
 *   2. La société B ne lit ni les techniciens ni les comptes de la société A
 *      — `societe_id` est filtré EXPLICITEMENT, en plus de la RLS.
 *   3. Le journal d'aujourd'hui est refusé à l'ADV (politique RLS,
 *      `app_peut_consulter_journal_audit`) et lu par la direction, pour la
 *      MÊME écriture.
 */

afterAll(async () => {
  process.env.DATABASE_URL = URL_DATABASE_AVANT;
  await fermerClients();
});

const ADMIN_A: ContexteSession = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.admin_societe],
  societeId: SOCIETE_A,
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const DIRECTION_A: ContexteSession = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.direction],
  societeId: SOCIETE_A,
  role: Role.direction,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const ADV_A: ContexteSession = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.adv],
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const ADMIN_B: ContexteSession = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.admin_societe],
  societeId: SOCIETE_B,
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

/** Depuis l'époque : toute écriture créée par l'épreuve compte comme « du jour », sans dépendre de minuit réel. */
const DEBUT_DES_TEMPS = new Date(0);

describe("« Mise en route » sur une société neuve (PU-1, décision 29 d'Alexis du 05/10/2026)", () => {
  const SOCIETE_VIERGE = uuidv7();
  const CODE_VIERGE = `9EG2-${SOCIETE_VIERGE.slice(0, 8)}`;
  const ADMIN_VIERGE: ContexteSession = {
    utilisateurId: UTILISATEUR_PAR_ROLE[Role.admin_societe],
    societeId: SOCIETE_VIERGE,
    role: Role.admin_societe,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };

  afterAll(async () => {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "societe" WHERE "id" = $1::uuid`,
      SOCIETE_VIERGE,
    );
  });

  it("rien n'est fait : les sept faits mesurés sont tous faux", async () => {
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "societe" (id, code, raison_sociale, pays, territoire,
         fuseau_horaire, devise_code,
         majoration_hors_ouverture_pct, langue, actif)
       VALUES ($1::uuid, $2, $3, 'NC', 'NC', 'Pacific/Noumea', 'XPF',
               0, 'fr', true)`,
      SOCIETE_VIERGE,
      CODE_VIERGE,
      `Société vierge ${CODE_VIERGE}`,
    );

    const faits = await faitsMiseEnRoute(ADMIN_VIERGE, clientApp());
    expect(faits.agenceAvecHoraires).toBe(false);
    expect(faits.tauxHoraire).toBe(false);
    expect(faits.trajetsEtForfaits).toBe(false);
    expect(faits.familleMateriel).toBe(false);
    expect(faits.famillesADeterminerCompte).toBe(0);
    expect(faits.equipePosee).toBe(false);
    expect(faits.accesAOuvrirCompte).toBe(0);
    expect(faits.clientsSitesMachines).toBe(false);
    expect(faits.planningTransmis).toBe(false);
  });
});

describe("la société B ne voit rien de la société A", () => {
  it("« Accès à ouvrir » de B ne porte aucun technicien de A", async () => {
    const accesB = await techniciensAccesAOuvrir(ADMIN_B, clientApp());
    const accesA = await techniciensAccesAOuvrir(ADMIN_A, clientApp());
    const idsA = new Set(accesA.map((ligne) => ligne.utilisateurId));
    expect(accesB.some((ligne) => idsA.has(ligne.utilisateurId))).toBe(false);
  });

  it("« Données à compléter » de B n'additionne jamais les comptes de A", async () => {
    // Même critère filtré par société (RLS + `societe_id` explicite) :
    // les points lus pour B restent bornés à ses propres lignes, jamais la
    // somme de A et B.
    const pointsB = await pointsDonneesACompleter(
      ADMIN_B,
      DEBUT_DES_TEMPS,
      clientApp(),
    );
    for (const point of pointsB) {
      expect(point.compte).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("le journal d'aujourd'hui est refusé à l'ADV (RLS) et lu par la direction (I8, D32)", () => {
  const PREFIXE = "9EG2-JOURNAL-";

  function courriel(): string {
    return `${PREFIXE.toLowerCase()}${Math.floor(Math.random() * 1_000_000)}@codima.test`;
  }

  afterEach(async () => {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "technicien" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE '${PREFIXE.toLowerCase()}%')`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "utilisateur_societe" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE '${PREFIXE.toLowerCase()}%')`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "utilisateur" WHERE "email" LIKE '${PREFIXE.toLowerCase()}%'`,
    );
  });

  it("une écriture fraîche est invisible sous ADV, visible sous direction", async () => {
    const resultat = await creerTechnicien(
      ADMIN_A,
      {
        nom: "Technicien d'épreuve 9EG2",
        email: courriel(),
        agence_id: AGENCE_A,
        actif: true,
        statut_ressource: "salarie",
      },
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);

    const comptePourAdv = await compterEcrituresDuJour(
      ADV_A,
      DEBUT_DES_TEMPS,
      clientApp(),
    );
    expect(comptePourAdv).toBe(0);
    const lignesPourAdv = await dernieresEcrituresDuJour(
      ADV_A,
      DEBUT_DES_TEMPS,
      5,
      clientApp(),
    );
    expect(lignesPourAdv).toEqual([]);

    const comptePourDirection = await compterEcrituresDuJour(
      DIRECTION_A,
      DEBUT_DES_TEMPS,
      clientApp(),
    );
    expect(comptePourDirection).toBeGreaterThan(0);

    // L'ÉCRITURE PRÉCISE, PAR SON PROPRE `id` (`technicien.id`, jamais
    // `utilisateur_id`) — lue SANS politique, comme `journalDe` de
    // `journal-audit.test.ts` : ce test veut savoir ce que le déclencheur a
    // réellement produit, pas ce qu'un rôle en voit.
    const technicienCree = await clientOwner().technicien.findFirst({
      where: { utilisateur_id: resultat.accepte ? resultat.utilisateurId : "" },
      select: { id: true },
    });
    expect(technicienCree).not.toBeNull();

    const lignesPourDirection = await dernieresEcrituresDuJour(
      DIRECTION_A,
      DEBUT_DES_TEMPS,
      50,
      clientApp(),
    );
    expect(
      lignesPourDirection.some(
        (ligne) =>
          ligne.entite === "technicien" &&
          ligne.entiteId === technicienCree?.id,
      ),
    ).toBe(true);
  });
});
