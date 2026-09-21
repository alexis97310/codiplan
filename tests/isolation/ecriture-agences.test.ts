import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { creerAgence, lireAgence, modifierAgence } from "@/lib/agences/depot";
import { schemaCreationAgence } from "@/lib/agences/saisie";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { SOCIETE_A, SOCIETE_B, UTILISATEUR_PAR_ROLE } from "./setup/fixtures";

/**
 * AGENCE-1 — LE CHEMIN D'ÉCRITURE D'UNE AGENCE, ET CE QUE LA BASE GARDE QU'UN
 * ÉCRAN NE PEUT PAS GARDER À SA PLACE.
 *
 * ## Le constat que ce lot ferme
 *
 * Avant lui, `grep -rn "agence.create|creerAgence" lib app scripts` ne rendait
 * rien : sur une base de PRODUCTION neuve (sans semis, par construction — I9),
 * aucune agence ne pouvait naître.
 *
 * ## UNE AGENCE SANS CALENDRIER N'OUVRE JAMAIS (I7)
 *
 * `creerAgenceDans` écrit les DEUX lignes dans la MÊME transaction — voir
 * l'en-tête de `lib/agences/depot.ts`. Le premier scénario ci-dessous mesure
 * les deux à la fois : l'agence porte un `calendrier_id` non nul, et ce
 * calendrier ne porte AUCUNE plage — inventer un horaire par défaut serait une
 * donnée d'exploitation que le §8 interdit.
 *
 * ## Le code déjà pris — REFUS LISIBLE, jamais un 500
 *
 * Les deux tables portent chacune leur unicité `(societe_id, code)` sur la
 * MÊME valeur (le calendrier créé pour l'agence partage son code). Un second
 * essai avec le même code doit donc être refusé PROPREMENT — `motif:
 * "code_pris"` — et non lever une exception Prisma non rattrapée.
 */

const contexte = (societeId: string, role: Role) => ({
  utilisateurId: UTILISATEUR_PAR_ROLE[role],
  societeId,
  role,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
});

const ADMIN_A = contexte(SOCIETE_A, Role.admin_societe);
const ADMIN_B = contexte(SOCIETE_B, Role.admin_societe);

/** Un préfixe qui n'appartient qu'à ce fichier — le ménage s'y accroche. */
const PREFIXE = "EPR-AG-";

function agence(surcharge: Record<string, unknown> = {}) {
  const analyse = schemaCreationAgence.safeParse({
    code: `${PREFIXE}${Math.floor(Math.random() * 1_000_000)}`,
    libelle: "Agence d'épreuve",
    territoire: "NC",
    ...surcharge,
  });
  if (!analyse.success) {
    throw new Error(`saisie d'épreuve invalide : ${analyse.error.message}`);
  }
  return analyse.data;
}

afterEach(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "agence" WHERE "code" LIKE '${PREFIXE}%'`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "calendrier" WHERE "code" LIKE '${PREFIXE}%'`,
  );
});

afterAll(fermerClients);

describe("AGENCE-1 — une agence se crée avec son calendrier, jamais l'une sans l'autre", () => {
  it("l'agence naît reliée à un calendrier SANS AUCUNE PLAGE", async () => {
    const saisie = agence();
    const creation = await creerAgence(ADMIN_A, saisie, clientApp());
    expect(creation.accepte).toBe(true);
    if (!creation.accepte) return;

    expect(creation.fiche.calendrier_id).not.toBeNull();

    const plages = await clientOwner().$queryRawUnsafe<{ id: string }[]>(
      `SELECT "id" FROM "calendrier_plage" WHERE "calendrier_id" = $1::uuid`,
      creation.fiche.calendrier_id,
    );
    expect(plages).toHaveLength(0);

    const pasCreneau = await clientOwner().$queryRawUnsafe<
      { pas_creneau_minutes: number }[]
    >(
      `SELECT "pas_creneau_minutes" FROM "calendrier" WHERE "id" = $1::uuid`,
      creation.fiche.calendrier_id,
    );
    // Le défaut du SCHÉMA, jamais choisi ici (voir la consigne d'AGENCE-1).
    expect(pasCreneau[0]?.pas_creneau_minutes).toBe(30);
  });

  it("se relit et se modifie", async () => {
    const saisie = agence();
    const creation = await creerAgence(ADMIN_A, saisie, clientApp());
    expect(creation.accepte).toBe(true);
    if (!creation.accepte) return;

    const lue = await lireAgence(ADMIN_A, creation.fiche.id, clientApp());
    expect(lue?.libelle).toBe(saisie.libelle);

    const modification = await modifierAgence(
      ADMIN_A,
      creation.fiche.id,
      { libelle: "Renommée", territoire: "FR", actif: false },
      clientApp(),
    );
    expect(modification.accepte).toBe(true);
    if (!modification.accepte) return;
    expect(modification.fiche.libelle).toBe("Renommée");
    expect(modification.fiche.territoire).toBe("FR");
    expect(modification.fiche.actif).toBe(false);
    // Le code n'a PAS bougé — `schemaModificationAgence` ne le porte pas.
    expect(modification.fiche.code).toBe(saisie.code);
  });

  it("un code déjà pris est un REFUS LISIBLE, jamais une panne", async () => {
    const code = `${PREFIXE}${Math.floor(Math.random() * 1_000_000)}`;
    const premiere = await creerAgence(ADMIN_A, agence({ code }), clientApp());
    expect(premiere.accepte).toBe(true);

    const seconde = await creerAgence(ADMIN_A, agence({ code }), clientApp());
    expect(seconde).toEqual({ accepte: false, motif: "code_pris" });
  });
});

describe("aucune comparaison de société n'est écrite au-dessus de la politique", () => {
  it("une agence d'une AUTRE société est « introuvable », jamais « pas à vous »", async () => {
    const creation = await creerAgence(ADMIN_A, agence(), clientApp());
    expect(creation.accepte).toBe(true);
    if (!creation.accepte) return;

    expect(
      await lireAgence(ADMIN_B, creation.fiche.id, clientApp()),
    ).toBeNull();

    const refus = await modifierAgence(
      ADMIN_B,
      creation.fiche.id,
      { libelle: "Volée" },
      clientApp(),
    );
    expect(refus).toEqual({ accepte: false, motif: "introuvable" });

    const inconnue = await modifierAgence(
      ADMIN_B,
      uuidv7(),
      { libelle: "Volée" },
      clientApp(),
    );
    expect(inconnue).toEqual({ accepte: false, motif: "introuvable" });
  });
});
