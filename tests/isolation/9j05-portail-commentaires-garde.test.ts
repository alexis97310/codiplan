import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { commentairesVisiblesClient } from "@/lib/portail/interventions";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  CLIENT_A2,
  INTERVENTION_A2,
  INTERVENTION_B1,
  PORTAIL_A2_CLIENT,
  PORTAIL_A_CLIENT,
  SITE_A1_S1,
  SOCIETE_A,
} from "./setup/fixtures";

/**
 * LE CLOISONNEMENT DE `commentairesVisiblesClient` (9J05-PORTAIL-COMMENTAIRES-
 * GARDE, point 4) — SOUS LA VRAIE POLITIQUE, pas une comparaison écrite dans
 * le module.
 *
 * `lib/portail/interventions.ts` n'ajoute AUCUNE politique : il lit sous la
 * forme « parc » (D84) que `intervention` porte déjà, exactement comme
 * `parcDuClient` (`lib/portail/depot.ts`), éprouvé par
 * `tests/isolation/portail-rattachement.test.ts`. Ce fichier-ci éprouve donc
 * l'APPELANT, pas une seconde fois la politique : *une suite qui éprouve tous
 * les maillons n'éprouve pas la chaîne* (§9, 08/09).
 *
 * `INTERVENTION_COMMENTAIRES` est une fiche DÉDIÉE, posée dans un `beforeAll`
 * et effacée dans l'`afterAll` — même patron que `INTERVENTION_DEDIEE` dans
 * `ecran-intervention.test.ts` : les fiches partagées du harnais
 * (`INTERVENTION_A1`/`A2`/`B1`) ne portent ni `note_interne` ni
 * `commentaire_technicien` ni `suite_a_donner`, et d'autres scénarios du même
 * run les déplacent — leur contenu n'est donc pas stable d'un fichier à
 * l'autre.
 */

const INTERVENTION_COMMENTAIRES = "aaaaaaaa-0000-7000-8000-00000000af0c";
const NOTE_INTERNE_TEMOIN = "9J05 — réservée au back-office, jamais au portail";
const COMMENTAIRE_TECHNICIEN_TEMOIN = "9J05 — commentaire visible côté portail";
const SUITE_A_DONNER_TEMOIN = "9J05 — suite à donner visible côté portail";

function contextePortailA1(): ContexteSession {
  return {
    utilisateurId: PORTAIL_A_CLIENT,
    societeId: SOCIETE_A,
    role: Role.client,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: CLIENT_A1,
  };
}

beforeAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention"
       ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "technicien_id", "note_interne", "commentaire_technicien", "suite_a_donner", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'terminee', NULL, $6, $7, $8, now())
     ON CONFLICT ("id") DO NOTHING`,
    INTERVENTION_COMMENTAIRES,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
    NOTE_INTERNE_TEMOIN,
    COMMENTAIRE_TECHNICIEN_TEMOIN,
    SUITE_A_DONNER_TEMOIN,
  );
});

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
    INTERVENTION_COMMENTAIRES,
  );
});

afterAll(fermerClients);

describe("commentairesVisiblesClient — ce qu'il ouvre", () => {
  it("TÉMOIN — la fiche dédiée porte bien trois valeurs DISTINCTES", async () => {
    // Sans ce témoin, un select qui rendrait `note_interne` SOUS un autre nom,
    // ou qui confondrait les trois colonnes, passerait les mesures suivantes
    // sans que rien ne le voie.
    const [ligne] = await clientOwner().$queryRawUnsafe<
      Array<{
        note_interne: string | null;
        commentaire_technicien: string | null;
        suite_a_donner: string | null;
      }>
    >(
      `SELECT "note_interne", "commentaire_technicien", "suite_a_donner" FROM "intervention" WHERE "id" = $1::uuid`,
      INTERVENTION_COMMENTAIRES,
    );
    expect(ligne?.note_interne).toBe(NOTE_INTERNE_TEMOIN);
    expect(ligne?.commentaire_technicien).toBe(COMMENTAIRE_TECHNICIEN_TEMOIN);
    expect(ligne?.suite_a_donner).toBe(SUITE_A_DONNER_TEMOIN);
    expect(
      new Set([
        ligne?.note_interne,
        ligne?.commentaire_technicien,
        ligne?.suite_a_donner,
      ]).size,
    ).toBe(3);
  });

  it("le compte portail lit SES deux commentaires, jamais la note interne", async () => {
    const commentaires = await commentairesVisiblesClient(
      contextePortailA1(),
      INTERVENTION_COMMENTAIRES,
      clientApp(),
    );
    expect(commentaires?.id).toBe(INTERVENTION_COMMENTAIRES);
    expect(commentaires?.commentaireTechnicien).toBe(
      COMMENTAIRE_TECHNICIEN_TEMOIN,
    );
    expect(commentaires?.suiteADonner).toBe(SUITE_A_DONNER_TEMOIN);
    // AUCUNE clé de la note interne, sous AUCUN nom, dans ce que la fonction
    // rend — pas seulement « le champ exposé est vide ».
    expect(Object.keys(commentaires ?? {})).not.toContain("note_interne");
    expect(Object.keys(commentaires ?? {})).not.toContain("noteInterne");
    expect(JSON.stringify(commentaires)).not.toContain(NOTE_INTERNE_TEMOIN);
  });
});

describe("commentairesVisiblesClient — ce qu'il REFUSE", () => {
  it("une intervention du MÊME client mais HORS du périmètre de sites : `null`", async () => {
    // INTERVENTION_A2 est du client A1, sur SITE_A1_S2 — hors du périmètre du
    // compte PORTAIL_A_CLIENT, restreint à SITE_A1_S1 (D10). Ni le filtre
    // société ni le filtre client ne savent produire ce refus.
    const commentaires = await commentairesVisiblesClient(
      contextePortailA1(),
      INTERVENTION_A2,
      clientApp(),
    );
    expect(commentaires).toBeNull();
    // TÉMOIN — la ligne EXISTE : sans lui, `null` prouverait seulement
    // qu'aucune ligne ne porte cet identifiant.
    const [existe] = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "intervention" WHERE "id" = $1::uuid`,
      INTERVENTION_A2,
    );
    expect(existe?.n).toBe(1);
  });

  it("une intervention d'un AUTRE client de la MÊME société : `null`", async () => {
    const commentaires = await commentairesVisiblesClient(
      {
        utilisateurId: PORTAIL_A2_CLIENT,
        societeId: SOCIETE_A,
        role: Role.client,
        secondFacteurValide: true,
        adresseIp: null,
        clientId: CLIENT_A2,
      },
      INTERVENTION_COMMENTAIRES,
      clientApp(),
    );
    expect(commentaires).toBeNull();
  });

  it("une intervention d'une AUTRE société : `null`", async () => {
    const commentaires = await commentairesVisiblesClient(
      contextePortailA1(),
      INTERVENTION_B1,
      clientApp(),
    );
    expect(commentaires).toBeNull();
    const [existe] = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "intervention" WHERE "id" = $1::uuid`,
      INTERVENTION_B1,
    );
    expect(existe?.n).toBe(1);
  });

  it("une désignation de client qui n'est PAS la sienne LÈVE — elle ne rend pas `null`", async () => {
    // Même garde que `parcDuClient` (D70) : une désignation refusée
    // INTERROMPT, elle ne se confond pas avec « hors périmètre ».
    await expect(
      commentairesVisiblesClient(
        {
          utilisateurId: PORTAIL_A_CLIENT,
          societeId: SOCIETE_A,
          role: Role.client,
          secondFacteurValide: true,
          adresseIp: null,
          clientId: CLIENT_A2,
        },
        INTERVENTION_COMMENTAIRES,
        clientApp(),
      ),
    ).rejects.toThrow();
  });
});
