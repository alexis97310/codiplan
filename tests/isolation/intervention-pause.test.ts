import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  enregistrerNoteInterne,
  pausesDeLIntervention,
  reprendreIntervention,
  suspendreIntervention,
} from "@/lib/interventions/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  INTERVENTION_A1,
  INTERVENTION_B1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_INTERNE_B,
} from "./setup/fixtures";

/**
 * L'HISTORIQUE DES PAUSES, ÉPROUVÉ SUR LES VRAIES TABLES (50-INTERVENTIONS-2,
 * SAV-09).
 *
 * Forme « filiation » (D103), sur le modèle exact d'`intervention_prestation`
 * (`tests/isolation/rapport-terrain.test.ts`). Ce fichier confronte le module
 * et la base : `cycle-de-vie.ts` explique le refus avant l'action, l'index
 * partiel et les politiques RLS le tiennent quoi qu'il arrive.
 */

afterAll(fermerClients);

const SESSION_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const SESSION_B = {
  utilisateurId: UTILISATEUR_INTERNE_B,
  societeId: SOCIETE_B,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const jetables: string[] = [];

afterEach(async () => {
  for (const id of jetables.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${id}'`,
    );
  }
});

/** Une intervention planifiée, jetable, dérivée d'une fixture de la société donnée. */
async function jetable(depuis: string): Promise<string> {
  const id = uuidv7();
  jetables.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id","societe_id","client_id","site_id","agence_id",
       "type","statut","date_planifiee","duree_estimee_min","modifie_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", "agence_id",
            'curatif', 'planifiee', DATE '2026-09-14', 60, now()
       FROM "intervention" WHERE "id" = '${depuis}'`,
  );
  return id;
}

describe("le TÉMOIN PRÉALABLE — RLS en vigueur sur intervention_pause", () => {
  it("les deux drapeaux sont posés", async () => {
    const [etat] = await clientOwner().$queryRawUnsafe<
      Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>
    >(
      `SELECT "relrowsecurity", "relforcerowsecurity" FROM "pg_class"
        WHERE "relname" = $1 AND "relnamespace" = 'public'::regnamespace`,
      "intervention_pause",
    );
    expect(etat?.relrowsecurity).toBe(true);
    expect(etat?.relforcerowsecurity).toBe(true);
  });
});

describe("suspendre OUVRE une pause, reprendre la FERME — SAV-09", () => {
  it("suspendre ouvre une ligne datée, avec son auteur", async () => {
    const id = await jetable(INTERVENTION_A1);
    const resultat = await suspendreIntervention(
      SESSION_A,
      {
        intervention_id: id,
        motif: "Attente de pièce fournisseur",
        piece_attendue_ref: "CMP-4417-B",
        date_dispo_prevue: new Date("2026-10-01T00:00:00.000Z"),
      },
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);

    const pauses = await pausesDeLIntervention(SESSION_A, id, clientApp());
    expect(pauses).toHaveLength(1);
    expect(pauses?.[0]?.fin).toBeNull();
    expect(pauses?.[0]?.motif).toBe("Attente de pièce fournisseur");
    expect(pauses?.[0]?.pieceAttendueRef).toBe("CMP-4417-B");
    expect(pauses?.[0]?.ouvertPar).not.toBeNull();
    expect(pauses?.[0]?.fermeePar).toBeNull();
  });

  it("reprendre ferme la pause ouverte, avec son auteur", async () => {
    const id = await jetable(INTERVENTION_A1);
    await suspendreIntervention(
      SESSION_A,
      {
        intervention_id: id,
        motif: "Client absent",
        piece_attendue_ref: null,
        date_dispo_prevue: null,
      },
      clientApp(),
    );
    const reprise = await reprendreIntervention(
      SESSION_A,
      { intervention_id: id },
      clientApp(),
    );
    expect(reprise.accepte).toBe(true);

    const pauses = await pausesDeLIntervention(SESSION_A, id, clientApp());
    expect(pauses).toHaveLength(1);
    expect(pauses?.[0]?.fin).not.toBeNull();
    expect(pauses?.[0]?.fermeePar).not.toBeNull();
  });

  it("DEUX pauses successives restent TOUTES DEUX lisibles — c'est exactement SAV-09", async () => {
    const id = await jetable(INTERVENTION_A1);

    await suspendreIntervention(
      SESSION_A,
      {
        intervention_id: id,
        motif: "Attente de la pièce X",
        piece_attendue_ref: "X-1",
        date_dispo_prevue: new Date("2026-10-01T00:00:00.000Z"),
      },
      clientApp(),
    );
    await reprendreIntervention(
      SESSION_A,
      { intervention_id: id },
      clientApp(),
    );
    await suspendreIntervention(
      SESSION_A,
      {
        intervention_id: id,
        motif: "Attente de la pièce Y",
        piece_attendue_ref: "Y-1",
        date_dispo_prevue: new Date("2026-10-05T00:00:00.000Z"),
      },
      clientApp(),
    );

    const pauses = await pausesDeLIntervention(SESSION_A, id, clientApp());
    expect(pauses).toHaveLength(2);
    // La plus RÉCENTE en tête (voir `pausesDeLIntervention`) : la pièce Y,
    // encore ouverte, avant la pièce X, déjà refermée.
    expect(pauses?.[0]?.pieceAttendueRef).toBe("Y-1");
    expect(pauses?.[0]?.fin).toBeNull();
    expect(pauses?.[1]?.pieceAttendueRef).toBe("X-1");
    expect(pauses?.[1]?.fin).not.toBeNull();
  });

  it("JAMAIS DEUX PAUSES OUVERTES — la base refuse, pas seulement l'écran", async () => {
    const id = await jetable(INTERVENTION_A1);
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "intervention_pause" ("id","societe_id","intervention_id","debut","motif")
       VALUES ('${uuidv7()}', '${SOCIETE_A}', '${id}', now(), 'Première')`,
    );
    // Le message brut de Prisma ne nomme pas toujours l'index (`23505`
    // générique) ; l'index qui refuse réellement est
    // `intervention_pause_une_seule_ouverte` (voir la migration) — nommé ici
    // en commentaire, faute d'apparaître de façon fiable dans le message.
    await expect(
      clientOwner().$executeRawUnsafe(
        `INSERT INTO "intervention_pause" ("id","societe_id","intervention_id","debut","motif")
         VALUES ('${uuidv7()}', '${SOCIETE_A}', '${id}', now(), 'Seconde')`,
      ),
    ).rejects.toThrow(/already exists|23505/);
  });
});

describe("cloisonnement — forme « filiation », comme intervention_prestation", () => {
  it("une pause de la société B est invisible sous le contexte de la société A", async () => {
    const idB = await jetable(INTERVENTION_B1);
    await suspendreIntervention(
      SESSION_B,
      {
        intervention_id: idB,
        motif: "Motif société B",
        piece_attendue_ref: null,
        date_dispo_prevue: null,
      },
      clientApp(),
    );

    // Sous le contexte A, l'intervention elle-même n'est pas visible : la
    // même lecture cloisonnée qui protège `intervention` protège sa fille.
    const pausesDepuisA = await pausesDeLIntervention(
      SESSION_A,
      idB,
      clientApp(),
    );
    expect(pausesDepuisA).toBeNull();

    // Sous son propre contexte, la société B les voit.
    const pausesDepuisB = await pausesDeLIntervention(
      SESSION_B,
      idB,
      clientApp(),
    );
    expect(pausesDepuisB).toHaveLength(1);
  });
});

describe("la note interne — back-office seulement, invisible ailleurs par construction", () => {
  it("s'enregistre et se lit sous le même contexte", async () => {
    const id = await jetable(INTERVENTION_A1);
    const resultat = await enregistrerNoteInterne(
      SESSION_A,
      { intervention_id: id, note_interne: "À rappeler demain matin." },
      clientApp(),
    );
    expect(resultat).not.toBeNull();

    const [ligne] = await clientOwner().$queryRawUnsafe<
      Array<{ note_interne: string | null }>
    >(`SELECT "note_interne" FROM "intervention" WHERE "id" = '${id}'`);
    expect(ligne?.note_interne).toBe("À rappeler demain matin.");
  });

  it("n'est SÉLECTIONNÉE ni par le rapport de terrain ni par le bon — témoin statique", async () => {
    // `lireRapportTexte` (`lib/interventions/depot-rapport-terrain.ts`) et
    // `CHAMPS_LIGNE` (`lib/interventions/depot.ts`, dont dépend `bon.ts`) ne
    // portent PAS `note_interne` dans leur `select` — c'est une garantie de
    // TYPE (TypeScript refuserait de lire un champ qu'aucun des deux ne
    // sélectionne), pas seulement de rendu. Ce test l'écrit en clair pour que
    // la garantie ne dépende pas de la lecture du code par un humain.
    const id = await jetable(INTERVENTION_A1);
    await enregistrerNoteInterne(
      SESSION_A,
      { intervention_id: id, note_interne: "Jamais sur le terrain." },
      clientApp(),
    );
    const { lireRapportTexte } = await import(
      "@/lib/interventions/depot-rapport-terrain"
    );
    const rapport = await lireRapportTexte(SESSION_A, id, clientApp());
    expect(rapport).not.toBeNull();
    expect(Object.keys(rapport ?? {})).not.toContain("note_interne");
  });
});
