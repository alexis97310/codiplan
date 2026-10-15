import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { compterAgences } from "@/lib/agences/depot";
import { Role } from "@/lib/auth/roles";
import { jourDe, maintenant, type JourLocal } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { decomptesParametrage } from "@/lib/navigation/decomptes-parametrage";
import {
  PORTES_PARAMETRAGE,
  type PorteParametrage,
} from "@/lib/navigation/portes-parametrage";
import { compterHabilitationsExpirees } from "@/lib/tableau-de-bord/lectures";
import { compterZonesSansForfaitDeDeplacement } from "@/lib/tarification/depot-forfaits";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  FUSEAU_SOCIETE_A,
  FUSEAU_SOCIETE_B,
  SOCIETE_A,
  SOCIETE_B,
  TERRITOIRE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * 9EWD2-PARAMETRES-HUB-ISOLATION — LES DÉCOMPTES DU HUB « Paramètres » À
 * TRAVERS LE CLOISONNEMENT.
 *
 * ## Ce que ce fichier répare
 *
 * `compterAgences`, `compterHabilitationsExpirees` et
 * `compterZonesSansForfaitDeDeplacement` n'étaient éprouvés qu'avec `vi.mock`
 * (`tests/unit/navigation/decomptes-parametrage.test.ts`) : rien ne mesurait
 * qu'une société B lit zéro des données posées pour une société A — ni que les
 * trois lectures tiennent réellement contre une base, sous le rôle applicatif.
 *
 * ## La stratégie : une donnée posée pour A, jamais une donnée balayée
 *
 * Chaque scénario mesure le décompte de A ET de B **avant** de poser une seule
 * ligne pour A, pose cette ligne, puis mesure les deux à nouveau. B doit
 * retomber EXACTEMENT sur sa valeur d'avant — jamais un zéro espéré à l'aveugle,
 * qui masquerait une fuite si la base d'isolation portait déjà des zones sans
 * forfait ou des habilitations expirées pour B. Le forfait posé pour le
 * scénario de tarification est volontairement `zone_geo = NULL`
 * (« sans condition », voir `tests/isolation/forfait-sans-condition.test.ts`) :
 * il couvre les SIX zones à la fois, ce qui rend le décompte de A
 * déterministe — exactement zéro — quel que soit l'état laissé par un autre
 * fichier du projet `isolation` (`fileParallelism: false`, mais l'ordre entre
 * fichiers n'est pas une garantie à soigner deux fois).
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

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien];

function porte(chemin: string): PorteParametrage {
  const trouvee = PORTES_PARAMETRAGE.find((p) => p.chemin === chemin);
  if (trouvee === undefined) {
    throw new Error(`porte introuvable : ${chemin}`);
  }
  return trouvee;
}

let avantAgencesA: { readonly total: number; readonly actives: number };
let avantAgencesB: { readonly total: number; readonly actives: number };
let avantHabilitationsA = 0;
let avantHabilitationsB = 0;
let avantForfaitB = 0;
let aujourdHuiA: JourLocal;
let aujourdHuiB: JourLocal;

let agenceId = "";
let technicienPoseIci = false;
let habilitationId = "";
let technicienHabilitationId = "";
let forfaitId = "";

async function poserAgencePourA(): Promise<void> {
  agenceId = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "agence" ("id", "societe_id", "code", "libelle", "territoire", "actif")
     VALUES ($1::uuid, $2::uuid, $3, 'Agence d''épreuve 9EWD2-ISOLATION', $4, true)`,
    agenceId,
    SOCIETE_A,
    `EPR-DEC-AG-${agenceId.slice(-8)}`,
    TERRITOIRE_A,
  );
}

async function poserTechnicienSiAbsent(): Promise<void> {
  const id = uuidv7();
  const pose = await clientOwner().$executeRawUnsafe(
    `INSERT INTO "technicien" ("id", "societe_id", "utilisateur_id", "agence_id", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, now())
     ON CONFLICT DO NOTHING`,
    id,
    SOCIETE_A,
    TECHNICIEN,
    AGENCE_A,
  );
  technicienPoseIci = pose > 0;
}

async function poserHabilitationExpireePourA(): Promise<void> {
  habilitationId = uuidv7();
  technicienHabilitationId = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "habilitation" ("id", "societe_id", "code", "libelle")
     VALUES ($1::uuid, $2::uuid, $3, 'Habilitation expirée (épreuve 9EWD2-ISOLATION)')`,
    habilitationId,
    SOCIETE_A,
    `EPR-DEC-HAB-${habilitationId.slice(-8)}`,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "technicien_habilitation"
       ("id", "societe_id", "utilisateur_id", "habilitation_id", "date_obtention", "date_expiration")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, DATE '2020-01-01', DATE '2020-06-01')`,
    technicienHabilitationId,
    SOCIETE_A,
    TECHNICIEN,
    habilitationId,
  );
}

/** Zone géographique nulle = « sans condition » (D23) : couvre les SIX zones. */
async function poserForfaitUniverselPourA(): Promise<void> {
  forfaitId = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "forfait" ("id", "societe_id", "code", "libelle", "type", "rang",
       "montant_mineur", "devise_code", "zone_geo", "type_intervention",
       "cumulable_temps", "actif")
     VALUES ($1::uuid, $2::uuid, $3, 'Déplacement général (épreuve 9EWD2-ISOLATION)',
             'deplacement', 987654, 1000, 'XPF', NULL, NULL, true, true)`,
    forfaitId,
    SOCIETE_A,
    `EPR-DEC-FOR-${forfaitId.slice(-8)}`,
  );
}

beforeAll(async () => {
  aujourdHuiA = jourDe(maintenant(FUSEAU_SOCIETE_A).local);
  aujourdHuiB = jourDe(maintenant(FUSEAU_SOCIETE_B).local);

  avantAgencesA = await compterAgences(ADMIN_A, clientApp());
  avantAgencesB = await compterAgences(ADMIN_B, clientApp());
  avantHabilitationsA = await compterHabilitationsExpirees(
    ADMIN_A,
    aujourdHuiA,
    clientApp(),
  );
  avantHabilitationsB = await compterHabilitationsExpirees(
    ADMIN_B,
    aujourdHuiB,
    clientApp(),
  );
  avantForfaitB = await compterZonesSansForfaitDeDeplacement(
    ADMIN_B,
    clientApp(),
  );

  await poserAgencePourA();
  await poserTechnicienSiAbsent();
  await poserHabilitationExpireePourA();
  await poserForfaitUniverselPourA();
});

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "forfait" WHERE "id" = $1::uuid`,
    forfaitId,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "technicien_habilitation" WHERE "id" = $1::uuid`,
    technicienHabilitationId,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "habilitation" WHERE "id" = $1::uuid`,
    habilitationId,
  );
  if (technicienPoseIci) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "technicien" WHERE "societe_id" = $1::uuid AND "utilisateur_id" = $2::uuid`,
      SOCIETE_A,
      TECHNICIEN,
    );
  }
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "agence" WHERE "id" = $1::uuid`,
    agenceId,
  );
  await fermerClients();
});

describe("compterAgences — B ne compte jamais l'agence posée pour A", () => {
  it("A voit sa nouvelle agence, B reste exactement sur sa valeur d'avant", async () => {
    const apresA = await compterAgences(ADMIN_A, clientApp());
    const apresB = await compterAgences(ADMIN_B, clientApp());

    expect(apresA.total).toBe(avantAgencesA.total + 1);
    expect(apresA.actives).toBe(avantAgencesA.actives + 1);
    expect(apresB).toEqual(avantAgencesB);
  });
});

describe("compterHabilitationsExpirees — B ne compte jamais l'habilitation expirée posée pour A", () => {
  it("A voit son habilitation expirée en plus, B reste exactement sur sa valeur d'avant", async () => {
    const apresA = await compterHabilitationsExpirees(
      ADMIN_A,
      aujourdHuiA,
      clientApp(),
    );
    const apresB = await compterHabilitationsExpirees(
      ADMIN_B,
      aujourdHuiB,
      clientApp(),
    );

    expect(apresA).toBe(avantHabilitationsA + 1);
    expect(apresB).toBe(avantHabilitationsB);
  });
});

describe("compterZonesSansForfaitDeDeplacement — B ne compte jamais le forfait universel posé pour A", () => {
  it("A tombe à zéro zone sans forfait, B reste exactement sur sa valeur d'avant", async () => {
    const apresA = await compterZonesSansForfaitDeDeplacement(
      ADMIN_A,
      clientApp(),
    );
    const apresB = await compterZonesSansForfaitDeDeplacement(
      ADMIN_B,
      clientApp(),
    );

    // Un forfait de déplacement SANS CONDITION couvre les six zones à la
    // fois (D23) — déterministe, quel que soit le nombre de zones sans
    // forfait avant ce scénario.
    expect(apresA).toBe(0);
    expect(apresB).toBe(avantForfaitB);
  });
});

describe("decomptesParametrage — le hub de B reste indemne pendant que celui de A reflète ses propres décomptes", () => {
  it("les trois pastilles isolent correctement les deux sociétés", async () => {
    const portes = [
      porte("/parametres/agences"),
      porte("/parametres/habilitations"),
      porte("/parametres/forfaits"),
    ];

    const decomptesA = await decomptesParametrage(
      ADMIN_A,
      portes,
      FUSEAU_SOCIETE_A,
      clientApp(),
    );
    const decomptesB = await decomptesParametrage(
      ADMIN_B,
      portes,
      FUSEAU_SOCIETE_B,
      clientApp(),
    );

    expect(decomptesA.get("/parametres/agences")?.texte).toContain(
      `${avantAgencesA.total + 1}`,
    );
    expect(decomptesA.get("/parametres/habilitations")?.texte).toContain(
      `${avantHabilitationsA + 1}`,
    );
    // 0 zone sans forfait : AUCUNE pastille, jamais un zéro affiché (même
    // discipline que `decompteHabilitations`, voir son en-tête).
    expect(decomptesA.has("/parametres/forfaits")).toBe(false);

    expect(decomptesB.get("/parametres/agences")?.texte).toContain(
      `${avantAgencesB.total}`,
    );
    if (avantHabilitationsB === 0) {
      expect(decomptesB.has("/parametres/habilitations")).toBe(false);
    } else {
      expect(decomptesB.get("/parametres/habilitations")?.texte).toContain(
        `${avantHabilitationsB}`,
      );
    }
    if (avantForfaitB === 0) {
      expect(decomptesB.has("/parametres/forfaits")).toBe(false);
    } else {
      expect(decomptesB.get("/parametres/forfaits")?.texte).toContain(
        `${avantForfaitB}`,
      );
    }
  });
});
