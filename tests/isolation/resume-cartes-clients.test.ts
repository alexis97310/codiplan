import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import {
  comptesVueClients,
  rechercherClients,
  resumeDesCartesClients,
} from "@/lib/clients/depot";
import { schemaRechercheClient } from "@/lib/clients/saisie";
import { uuidv7 } from "@/lib/db/uuid";
import { derniereInterventionDuClient } from "@/lib/interventions/depot";
import { nombreEquipementsActifsDuClient } from "@/lib/machines/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  MODELE_A,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * `resumeDesCartesClients` et `comptesVueClients` (9EB-TP-UX3-2-LISTES-1,
 * QE-13c/QE-10 (a)) — les deux lectures GROUPÉES de la carte client.
 *
 * **Scène dédiée, préfixée, jamais les fixtures partagées** — même leçon que
 * `tests/isolation/client-desactivation-refusee.test.ts` : `CLIENT_A1` reçoit
 * des machines et des interventions transitoires d'autres fichiers, et
 * `comptesVueClients` compterait alors un nombre qui dépend de l'ordre
 * d'exécution plutôt qu'un fait. `texte: PREFIXE` borne chaque lecture à
 * cette seule scène.
 */

afterAll(fermerClients);

const PREFIXE = "9EB1-";

const INTERNE_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const clientsEngendres: string[] = [];
const contactsEngendres: string[] = [];

afterAll(async () => {
  if (contactsEngendres.length > 0) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "contact" WHERE "id" = ANY($1::uuid[])`,
      contactsEngendres,
    );
  }
  if (clientsEngendres.length > 0) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = ANY($1::uuid[])`,
      clientsEngendres,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "machine" WHERE "client_id" = ANY($1::uuid[])`,
      clientsEngendres,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "site" WHERE "client_id" = ANY($1::uuid[])`,
      clientsEngendres,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "client" WHERE "id" = ANY($1::uuid[])`,
      clientsEngendres,
    );
  }
});

async function creerClient(
  raisonSociale: string,
  options: { readonly actif?: boolean; readonly codeExterne?: string } = {},
): Promise<{ readonly clientId: string; readonly siteId: string }> {
  const clientId = uuidv7();
  const siteId = uuidv7();
  clientsEngendres.push(clientId);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "client" ("id", "societe_id", "code_externe", "raison_sociale", "actif")
     VALUES ($1::uuid, $2::uuid, $3, $4, $5)`,
    clientId,
    SOCIETE_A,
    options.codeExterne ?? null,
    raisonSociale,
    options.actif ?? true,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "site" ("id", "societe_id", "client_id", "agence_id", "libelle")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5)`,
    siteId,
    SOCIETE_A,
    clientId,
    AGENCE_A,
    `${raisonSociale} — site`,
  );
  return { clientId, siteId };
}

async function poserMachine(
  clientId: string,
  siteId: string,
  statut: string,
): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "machine" ("id", "societe_id", "modele_id", "client_id", "site_id", "numero_serie", "qr_token", "statut", "modifie_le")
     VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7::"StatutMachine", now())`,
    SOCIETE_A,
    MODELE_A,
    clientId,
    siteId,
    `${PREFIXE}${uuidv7()}`,
    `QR-${PREFIXE}${uuidv7()}`,
    statut,
  );
}

async function poserIntervention(
  clientId: string,
  siteId: string,
  statut: string,
  datePlanifiee: string | null,
): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "date_planifiee", "modifie_le")
     VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, $4::uuid, 'curatif', $5::"StatutIntervention", $6::date, now())`,
    SOCIETE_A,
    clientId,
    siteId,
    AGENCE_A,
    statut,
    datePlanifiee,
  );
}

async function poserContact(
  clientId: string,
  siteId: string | null,
  nom: string,
  options: {
    readonly actif?: boolean;
    readonly roles?: readonly string[];
  } = {},
): Promise<void> {
  const id = uuidv7();
  contactsEngendres.push(id);
  await clientOwner().$executeRawUnsafe(
    // UN COURRIEL EST POSÉ bien que `resumeDesCartesClients` ne l'exige PAS
    // (elle affiche un nom, elle n'envoie rien) : `canaux` par défaut
    // (`{email}`) et sa contrainte `contact_courriel_si_canal_email`
    // l'exigent à l'écriture, quel que soit l'usage qu'on en fait ensuite.
    `INSERT INTO "contact" ("id", "societe_id", "client_id", "site_id", "nom", "email", "roles", "actif")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7::text[], $8)`,
    id,
    SOCIETE_A,
    clientId,
    siteId,
    nom,
    `${id}@exemple.test`,
    options.roles ?? ["donneur_ordre"],
    options.actif ?? true,
  );
}

describe("resumeDesCartesClients — parité avec les lectures unitaires (QE-13c)", () => {
  it("compte les machines EN PARC, l'intervention à planifier, la dernière datée et le donneur d'ordre départagé", async () => {
    const { clientId, siteId } = await creerClient(`${PREFIXE}Client résumé`);
    await poserMachine(clientId, siteId, "en_service");
    await poserMachine(clientId, siteId, "remplacee");
    await poserIntervention(clientId, siteId, "a_planifier", null);
    await poserIntervention(clientId, siteId, "en_cours", "2026-01-10");
    await poserIntervention(clientId, siteId, "terminee", "2026-03-05");
    // LE SITE — contact IGNORÉ par cette carte (site_id non nul), à la
    // différence de `destinataireClient` qui le préférerait.
    await poserContact(clientId, siteId, `${PREFIXE}Z du site`);
    // INACTIF — ignoré.
    await poserContact(clientId, null, `${PREFIXE}A inactif`, {
      actif: false,
    });
    // DEUX éligibles au niveau CLIENT : le départage nom, puis id, retient
    // le premier alphabétiquement.
    await poserContact(clientId, null, `${PREFIXE}B second`);
    await poserContact(clientId, null, `${PREFIXE}A premier`);

    const resume = await resumeDesCartesClients(
      INTERNE_A,
      [{ id: clientId }],
      clientApp(),
    );
    const carte = resume.get(clientId);
    expect(carte).toBeDefined();
    expect(carte?.nombreMachines).toBe(1);
    expect(carte?.nombreAPlanifier).toBe(1);
    expect(carte?.derniereIntervention?.toISOString().slice(0, 10)).toBe(
      "2026-03-05",
    );
    expect(carte?.donneurOrdre).toBe(`${PREFIXE}A premier`);

    // PARITÉ avec les lectures unitaires de la fiche (jamais un second calcul).
    const nombreUnitaire = await nombreEquipementsActifsDuClient(
      INTERNE_A,
      clientId,
      clientApp(),
    );
    expect(carte?.nombreMachines).toBe(nombreUnitaire);
    const derniereUnitaire = await derniereInterventionDuClient(
      INTERNE_A,
      clientId,
      clientApp(),
    );
    expect(carte?.derniereIntervention?.toISOString()).toBe(
      derniereUnitaire?.date_planifiee?.toISOString(),
    );
  });

  it("rend zéro/null pour un client sans aucune donnée — jamais une absence de clé", async () => {
    const { clientId } = await creerClient(`${PREFIXE}Client vide`);
    const resume = await resumeDesCartesClients(
      INTERNE_A,
      [{ id: clientId }],
      clientApp(),
    );
    expect(resume.get(clientId)).toEqual({
      nombreMachines: 0,
      nombreAPlanifier: 0,
      derniereIntervention: null,
      donneurOrdre: null,
    });
  });
});

describe("comptesVueClients — quatre comptes, une seule lecture des candidats (QE-10 (a))", () => {
  it("actifs/inactifs/sansCode/tous comptent la même scène, bornée par le texte", async () => {
    // SOUS-PRÉFIXE PROPRE À CE SCÉNARIO (jamais `PREFIXE` seul) — les clients
    // du `describe` précédent portent aussi `PREFIXE`, et `texte` bornerait
    // sinon ce compte à toute la scène du fichier, pas à ces trois-ci.
    const sousPrefixe = `${PREFIXE}CVC-`;
    await creerClient(`${sousPrefixe}Actif avec code`, { codeExterne: "C-1" });
    await creerClient(`${sousPrefixe}Actif sans code`);
    await creerClient(`${sousPrefixe}Inactif`, {
      actif: false,
      codeExterne: "C-2",
    });

    const criteres = schemaRechercheClient.parse({
      texte: sousPrefixe,
      inclure_sans_equipement: true,
    });
    const comptes = await comptesVueClients(INTERNE_A, criteres, clientApp());
    expect(comptes).toEqual({ actifs: 2, inactifs: 1, sansCode: 1, tous: 3 });
  });
});

describe("le tri des clients porte sur TOUTE la population filtrée, avant la page (9EB-TP-UX3-2-LISTES-1)", () => {
  it("« machines » décroissant fait remonter en page 1 un client qui serait en page 2 par ordre alphabétique", async () => {
    const sousPrefixe = `${PREFIXE}TRI-`;
    const { clientId: idPeu, siteId: sitePeu } = await creerClient(
      `${sousPrefixe}A peu de machines`,
    );
    const { clientId: idBeaucoup, siteId: siteBeaucoup } = await creerClient(
      `${sousPrefixe}Z beaucoup de machines`,
    );
    await poserMachine(idPeu, sitePeu, "en_service");
    await poserMachine(idBeaucoup, siteBeaucoup, "en_service");
    await poserMachine(idBeaucoup, siteBeaucoup, "en_service");

    const criteres = schemaRechercheClient.parse({
      texte: sousPrefixe,
      inclure_sans_equipement: true,
      tri: "machines",
      limite: 1,
      page: 1,
    });
    const page1 = await rechercherClients(INTERNE_A, criteres, clientApp());
    expect(page1.map((c) => c.id)).toEqual([idBeaucoup]);
  });
});
