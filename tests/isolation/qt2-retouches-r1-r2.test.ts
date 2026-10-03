import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, clientOwner, fermerClients, urlApp } from "./setup/db";
import {
  CLIENT_A2,
  INTERVENTION_A2,
  MACHINE_A1,
  MACHINE_A2,
  MODELE_A,
  SITE_A2_S1,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * RELECTURE DE 9DG (R1 ET R2, 04/10/2026) — deux retouches demandées par la
 * passation du ticket suivant (9DI) sur la lecture du technicien (QT-2, D152).
 *
 * **R1** — `fragmentDuClientDuTechnicien` portait une branche plus large que
 * celle du parc (`fragmentDuParcDuTechnicien`), si bien qu'un technicien
 * pouvait créer une machine chez un client dont il ne voyait ensuite PAS la
 * machine. `tests/unit/interventions/client-du-technicien.test.ts` éprouve la
 * part pure ; ce fichier éprouve que `creerMachine` MORD désormais sous la
 * même fenêtre que le parc.
 *
 * **R2** — les lectures manquantes nommées par la passation de 9DG : une
 * machine hors périmètre refuse `lireMachine` ET `informationDeLaMachine` ;
 * `creerMachine`/`modifierMachine` refusent hors périmètre ; et le document
 * d'un COLLÈGUE (attaché à son intervention) refuse `lireDocument`.
 *
 * `DATABASE_URL` est posée avant les imports dynamiques, même geste que
 * `parc-perimetre-technicien.test.ts` : `lireMachine`, `creerMachine` et
 * `modifierMachine` transitent par le client global de `lib/db/client.ts`
 * sans qu'un client explicite leur soit toujours passé.
 */
const URL_DATABASE_AVANT = process.env.DATABASE_URL;
process.env.DATABASE_URL = urlApp();
const { creerMachine, lireMachine, modifierMachine } =
  await import("@/lib/machines/depot");
const { informationDeLaMachine } = await import("@/lib/vgp/registre");
const { lireDocument } = await import("@/lib/documents/depot");

afterAll(async () => {
  process.env.DATABASE_URL = URL_DATABASE_AVANT;
  await fermerClients();
});

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien] as string;

const SESSION_TECH = {
  utilisateurId: TECHNICIEN,
  societeId: SOCIETE_A,
  role: Role.technicien,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

describe("R1 — creerMachine refuse un client hors de la fenêtre du parc", () => {
  it("CLIENT_A2 — aucune intervention transmise au technicien : refus nommé", async () => {
    const resultat = await creerMachine(
      SESSION_TECH,
      {
        modele_id: MODELE_A,
        client_id: CLIENT_A2,
        site_id: SITE_A2_S1,
        numero_serie: `SN-R1-${uuidv7()}`,
        reference_interne: null,
        localisation: null,
        facture_origine: null,
        date_mise_en_service: null,
        date_vente: null,
        garantie_fin: null,
        statut: "en_service",
        criticite: "normale",
        source_creation: "terrain",
        machine_remplacee_id: null,
        complet: true,
      },
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "reference_invalide" });
  });
});

describe("R2 — lectures manquantes de 9DG, sur la vraie table", () => {
  it("lireMachine — MACHINE_A2 (aucune intervention ni visite du technicien) : introuvable", async () => {
    const fiche = await lireMachine(SESSION_TECH, MACHINE_A2);
    expect(fiche).toBeNull();
  });

  it("informationDeLaMachine — même machine hors périmètre, même refus", async () => {
    const etat = await informationDeLaMachine(
      SESSION_TECH,
      MACHINE_A2,
      new Date("2026-10-05T00:00:00.000Z"),
      clientApp(),
    );
    expect(etat).toBeNull();
  });

  it("modifierMachine — MACHINE_A2 hors périmètre : refus nommé, aucune ligne touchée", async () => {
    const resultat = await modifierMachine(
      SESSION_TECH,
      MACHINE_A2,
      {
        modele_id: MODELE_A,
        client_id: CLIENT_A2,
        site_id: SITE_A2_S1,
        numero_serie: "SN-A2",
        reference_interne: null,
        localisation: null,
        facture_origine: null,
        date_mise_en_service: null,
        date_vente: null,
        garantie_fin: null,
        statut: "en_service",
        criticite: "normale",
        source_creation: "terrain",
        machine_remplacee_id: null,
        complet: true,
      },
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "introuvable" });
  });

  it("lireMachine — MACHINE_A1, liée à une intervention du technicien, reste accessible (témoin)", async () => {
    // Le témoin : sans lui, un refus devenu trop large rendrait MACHINE_A2
    // introuvable pour la mauvaise raison (un périmètre qui refuserait tout).
    const fiche = await lireMachine(SESSION_TECH, MACHINE_A1);
    expect(fiche?.id).toBe(MACHINE_A1);
  });

  it("lireDocument — le document d'un COLLÈGUE, attaché à son intervention, refuse au technicien", async () => {
    // INTERVENTION_A2 est affectée à `UTILISATEUR_INTERNE_A`, jamais au
    // technicien (voir `tests/isolation/setup/global.ts`) : un document
    // jetable, posé puis retiré par ce test, s'y attache.
    const id = uuidv7();
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "document"
         ("id","societe_id","intervention_id","classe","libelle","nom_fichier",
          "type_mime","taille_octets","empreinte","objet_cle","cree_le","modifie_le")
       VALUES ('${id}', '${SOCIETE_A}', '${INTERVENTION_A2}', 'client', 'Photo R2',
               'photo-r2.jpg', 'image/jpeg', 1000,
               '${"d".repeat(64)}', 'r2/photo-r2.jpg', now(), now())`,
    );
    try {
      const document = await lireDocument(SESSION_TECH, id, clientApp());
      expect(document).toBeNull();
    } finally {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "document" WHERE "id" = '${id}'`,
      );
    }
  });
});
