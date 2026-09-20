import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  attribuerHabilitation,
  basculerActiviteHabilitation,
  creerExigence,
  creerHabilitation,
  listerHabilitations,
  modifierHabilitation,
} from "@/lib/habilitations/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  SITE_A1_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * ÉQUIPE-2 — LE RÉFÉRENTIEL, SOUS LE RÔLE APPLICATIF.
 *
 * Même raisonnement que `tests/isolation/prestations.test.ts` : `habilitation`,
 * `technicien_habilitation` et `site_habilitation_requise` portaient une
 * politique juste depuis L1-04, et RIEN ne l'appelait — mesuré, `ls
 * lib/habilitations/` ne rendait que `affectation.ts` et `saisie.ts`. Ce
 * fichier couvre ce que `alimentation-habilitations.test.ts` ne couvre pas :
 * le cloisonnement du CATALOGUE lui-même, indépendamment de toute
 * intervention.
 */

const SESSION = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const SESSION_B = { ...SESSION, societeId: SOCIETE_B };
const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien];

/** Les DERNIERS caractères d'un UUID v7, jamais les premiers (I10, §9 14/09). */
function code(prefixe: string): string {
  return `${prefixe}-${uuidv7().replaceAll("-", "").slice(-12)}`;
}

const habilitationsPosees: string[] = [];
const attributionsPosees: string[] = [];
const exigencesPosees: string[] = [];

async function creer(surcharge: Record<string, unknown> = {}): Promise<{
  readonly id: string;
  readonly code: string;
}> {
  const habilitationCode = code("REF");
  const resultat = await creerHabilitation(
    SESSION,
    {
      code: habilitationCode,
      libelle: "Habilitation de test",
      duree_validite_mois: null,
      ...surcharge,
    },
    clientApp(),
  );
  if (!resultat.accepte) {
    throw new Error(`création refusée : ${resultat.motif}`);
  }
  habilitationsPosees.push(resultat.id);
  return { id: resultat.id, code: habilitationCode };
}

describe("ÉQUIPE-2 — le référentiel des habilitations", () => {
  afterEach(async () => {
    if (attributionsPosees.length > 0) {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "technicien_habilitation" WHERE "id" IN (${attributionsPosees.map((id) => `'${id}'`).join(",")})`,
      );
      attributionsPosees.length = 0;
    }
    if (exigencesPosees.length > 0) {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "site_habilitation_requise" WHERE "id" IN (${exigencesPosees.map((id) => `'${id}'`).join(",")})`,
      );
      exigencesPosees.length = 0;
    }
    if (habilitationsPosees.length > 0) {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "habilitation" WHERE "id" IN (${habilitationsPosees.map((id) => `'${id}'`).join(",")})`,
      );
      habilitationsPosees.length = 0;
    }
  });

  afterAll(fermerClients);

  it("TÉMOIN — la politique mord : sans contexte, zéro habilitation", async () => {
    await creer();
    const vues = await clientApp().$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "habilitation"`,
    );
    expect(vues).toHaveLength(0);
  });

  it("une société lit SON référentiel et jamais celui d'une autre", async () => {
    const { id } = await creer();
    const chezA = await listerHabilitations(SESSION, clientApp());
    expect(chezA.map((h) => h.id)).toContain(id);

    const chezB = await listerHabilitations(SESSION_B, clientApp());
    expect(chezB.map((h) => h.id)).not.toContain(id);
  });

  it("deux habilitations de la MÊME société ne peuvent pas partager un code", async () => {
    const { code: memeCode } = await creer();
    const doublon = await creerHabilitation(
      SESSION,
      { code: memeCode, libelle: "Autre libellé", duree_validite_mois: null },
      clientApp(),
    );
    expect(doublon).toStrictEqual({ accepte: false, motif: "code_pris" });
  });

  it("modifier une habilitation d'une AUTRE société rend « introuvable » — même refus qu'un identifiant inconnu (D35, D50)", async () => {
    const { id } = await creer();
    const ailleurs = await modifierHabilitation(
      SESSION_B,
      id,
      { code: code("X"), libelle: "x", duree_validite_mois: null, actif: true },
      clientApp(),
    );
    const inconnue = await modifierHabilitation(
      SESSION_B,
      uuidv7(),
      { code: code("X"), libelle: "x", duree_validite_mois: null, actif: true },
      clientApp(),
    );
    expect(ailleurs).toStrictEqual({ accepte: false, motif: "introuvable" });
    expect(inconnue).toStrictEqual(ailleurs);
  });

  it("la bascule d'activité retire du choix sans supprimer — et ne mord que sur SA société", async () => {
    const { id } = await creer();
    const desactivee = await basculerActiviteHabilitation(
      SESSION,
      id,
      false,
      clientApp(),
    );
    expect(desactivee).toStrictEqual({ accepte: true, id });

    const [ligne] = await listerHabilitations(SESSION, clientApp()).then(
      (lignes) => lignes.filter((l) => l.id === id),
    );
    expect(ligne?.actif).toBe(false);

    const depuisB = await basculerActiviteHabilitation(
      SESSION_B,
      id,
      true,
      clientApp(),
    );
    expect(depuisB).toStrictEqual({ accepte: false, motif: "introuvable" });
  });
});

describe("ÉQUIPE-2 — les attributions, sous le rôle applicatif", () => {
  afterEach(async () => {
    if (attributionsPosees.length > 0) {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "technicien_habilitation" WHERE "id" IN (${attributionsPosees.map((id) => `'${id}'`).join(",")})`,
      );
      attributionsPosees.length = 0;
    }
    if (habilitationsPosees.length > 0) {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "habilitation" WHERE "id" IN (${habilitationsPosees.map((id) => `'${id}'`).join(",")})`,
      );
      habilitationsPosees.length = 0;
    }
  });

  it("attribuer deux fois la MÊME habilitation au MÊME technicien est refusé", async () => {
    const { id } = await creer();
    const premiere = await attribuerHabilitation(
      SESSION,
      {
        utilisateur_id: TECHNICIEN,
        habilitation_id: id,
        date_obtention: new Date("2024-01-01T00:00:00.000Z"),
        date_expiration: null,
      },
      clientApp(),
    );
    expect(premiere.accepte).toBe(true);
    if (premiere.accepte) attributionsPosees.push(premiere.id);

    const doublon = await attribuerHabilitation(
      SESSION,
      {
        utilisateur_id: TECHNICIEN,
        habilitation_id: id,
        date_obtention: new Date("2024-01-01T00:00:00.000Z"),
        date_expiration: null,
      },
      clientApp(),
    );
    expect(doublon).toStrictEqual({ accepte: false, motif: "deja_attribuee" });
  });

  it("attribuer à un technicien qui n'appartient pas à la société active est refusé — rien n'est écrit", async () => {
    // L'HABILITATION appartient à B — visible sous SESSION_B — ; c'est le
    // TECHNICIEN, de la société A, qui manque. Sans cette habilitation posée
    // côté B, le premier parent manquant serait l'habilitation elle-même, et
    // ce scénario mesurerait le mauvais motif.
    const habilitationDeB = await creerHabilitation(
      SESSION_B,
      {
        code: code("REFB"),
        libelle: "Habilitation de B",
        duree_validite_mois: null,
      },
      clientApp(),
    );
    expect(habilitationDeB.accepte).toBe(true);
    if (!habilitationDeB.accepte) return;
    habilitationsPosees.push(habilitationDeB.id);

    const technicienDeA = UTILISATEUR_PAR_ROLE[Role.technicien];
    const tentative = await attribuerHabilitation(
      SESSION_B,
      {
        utilisateur_id: technicienDeA,
        habilitation_id: habilitationDeB.id,
        date_obtention: new Date("2024-01-01T00:00:00.000Z"),
        date_expiration: null,
      },
      clientApp(),
    );
    expect(tentative).toStrictEqual({
      accepte: false,
      motif: "technicien_hors_societe",
    });

    const lignes = await clientOwner().$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "technicien_habilitation" WHERE "habilitation_id" = $1::uuid`,
      habilitationDeB.id,
    );
    expect(lignes).toHaveLength(0);
  });
});

describe("ÉQUIPE-2 — les exigences de site, sous le rôle applicatif", () => {
  afterEach(async () => {
    if (exigencesPosees.length > 0) {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "site_habilitation_requise" WHERE "id" IN (${exigencesPosees.map((id) => `'${id}'`).join(",")})`,
      );
      exigencesPosees.length = 0;
    }
    if (habilitationsPosees.length > 0) {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "habilitation" WHERE "id" IN (${habilitationsPosees.map((id) => `'${id}'`).join(",")})`,
      );
      habilitationsPosees.length = 0;
    }
  });

  afterAll(fermerClients);

  it("exiger deux fois la MÊME habilitation sur le MÊME site est refusé", async () => {
    const { id } = await creer();
    const premiere = await creerExigence(
      SESSION,
      { site_id: SITE_A1_S1, habilitation_id: id, bloquant: true },
      clientApp(),
    );
    expect(premiere.accepte).toBe(true);
    if (premiere.accepte) exigencesPosees.push(premiere.id);

    const doublon = await creerExigence(
      SESSION,
      { site_id: SITE_A1_S1, habilitation_id: id, bloquant: false },
      clientApp(),
    );
    expect(doublon).toStrictEqual({ accepte: false, motif: "deja_exigee" });
  });
});
