import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { occupationsDuPlanning } from "@/lib/interventions/occupation";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CALENDRIER_SAMEDI_A,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * LE CALENDRIER D'UNE AGENCE N'EST CHARGÉ QU'UNE FOIS PAR APPEL (PERF-2).
 *
 * ## Le défaut, mesuré le 23/09
 *
 * `occupationsDuPlanning` regroupe ses lignes par (technicien, agence) — I7 et
 * L3-01a l'exigent, et ce n'est PAS remis en cause ici. Mais pour CHAQUE
 * couple, le dénominateur appelait `chargerCalendrierDuTechnicien`, qui
 * rappelle en interne `chargerCalendrierAgence` : les fériés du territoire et
 * les plages de l'agence étaient donc relus, **identiques**, une fois PAR
 * TECHNICIEN — cinq techniciens d'une même agence, cinq lectures des mêmes
 * fériés et des mêmes horaires.
 *
 * ## Ce que ce fichier mesure, et ce qu'il ne mesure pas
 *
 * Le premier bloc COMPTE les requêtes — c'est la mesure que le ticket exige
 * avant toute ligne de correction. Le second bloc éprouve que le CHIFFRE rendu
 * n'a pas bougé : la mutualisation ne touche que le CHARGEMENT, jamais le
 * dénominateur par couple, qui reste PROPRE à chaque technicien (L3-01a) — un
 * technicien avec calendrier propre et un technicien sans l'un ne se
 * confondent pas parce qu'ils partagent une agence.
 */

afterAll(async () => {
  await retirerTechniciens();
  await fermerClients();
});

/** Cinq techniciens de l'agence A — la population dont PERF-2 mesure le coût. */
const TECHNICIENS = Array.from({ length: 5 }, () => uuidv7());
const [AVEC_CALENDRIER_PROPRE, ...SANS_CALENDRIER_PROPRE] = TECHNICIENS;

const SESSION = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

/** La même fenêtre, en jours (12/09/2026) — voir `occupation-absences.test.ts`. */
const FENETRE = {
  du: { annee: 2026, mois: 9, jour: 14 },
  au: { annee: 2026, mois: 9, jour: 21 },
};

/** Une ligne minimale, telle que le planning en passe à `occupationsDuPlanning`. */
function ligneDe(technicienId: string) {
  return {
    technicien_id: technicienId,
    agence_id: AGENCE_A,
    statut: "planifiee" as const,
    temps_valide_min: null,
    duree_estimee_min: 60,
    site_id: SITE_A1_S1,
    date_planifiee: null,
  };
}

/** Rattache les cinq techniciens à l'agence A, l'un d'eux avec un calendrier propre. */
async function poserTechniciens(): Promise<void> {
  for (const utilisateurId of TECHNICIENS) {
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "technicien" ("societe_id","utilisateur_id","agence_id","modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, now())`,
      SOCIETE_A,
      utilisateurId,
      AGENCE_A,
    );
  }
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "technicien_calendrier" ("societe_id","utilisateur_id","calendrier_id","modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, now())`,
    SOCIETE_A,
    AVEC_CALENDRIER_PROPRE,
    CALENDRIER_SAMEDI_A,
  );
}

async function retirerTechniciens(): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "technicien_calendrier" WHERE "societe_id" = $1::uuid AND "utilisateur_id" = $2::uuid`,
    SOCIETE_A,
    AVEC_CALENDRIER_PROPRE,
  );
  for (const utilisateurId of TECHNICIENS) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "technicien" WHERE "societe_id" = $1::uuid AND "utilisateur_id" = $2::uuid`,
      SOCIETE_A,
      utilisateurId,
    );
  }
}

beforeAll(poserTechniciens);

describe("MESURE — le chargement de l'agence, compté", () => {
  it("cinq techniciens de la MÊME agence ne déclenchent qu'UN SEUL chargement de ses fériés et de ses horaires", async () => {
    let appelsAgence = 0;
    let appelsFeries = 0;
    const clientCompte = clientApp().$extends({
      query: {
        agence: {
          async findFirst({ args, query }) {
            appelsAgence += 1;
            return query(args);
          },
        },
        jourFerie: {
          async findMany({ args, query }) {
            appelsFeries += 1;
            return query(args);
          },
        },
      },
    });

    const lignes = await occupationsDuPlanning(
      SESSION,
      TECHNICIENS.map(ligneDe),
      FENETRE,
      clientCompte as unknown as PrismaClient,
    );

    // Témoin : les cinq techniciens ont bien produit cinq lignes distinctes —
    // sinon un compte à 1 ne prouverait rien, faute de population.
    expect(lignes.length).toBe(TECHNICIENS.length);

    expect(appelsAgence).toBe(1);
    expect(appelsFeries).toBe(1);
  });
});

describe("le dénominateur par technicien ne bouge pas, seul ou mêlé à ses voisins", () => {
  it("SANS calendrier propre : le même chiffre, seul ou dans le groupe", async () => {
    const cible = SANS_CALENDRIER_PROPRE[0]!;
    const solo = await occupationsDuPlanning(
      SESSION,
      [ligneDe(cible)],
      FENETRE,
      clientApp(),
    );
    const groupe = await occupationsDuPlanning(
      SESSION,
      TECHNICIENS.map(ligneDe),
      FENETRE,
      clientApp(),
    );
    const ligneSolo = solo.find((l) => l.technicienId === cible);
    const ligneGroupe = groupe.find((l) => l.technicienId === cible);
    expect(ligneSolo).toBeDefined();
    expect(ligneGroupe?.occupation.minutesOuvrables).toBe(
      ligneSolo?.occupation.minutesOuvrables,
    );
  });

  it("AVEC calendrier propre : le même chiffre, seul ou dans le groupe — et il DIFFÈRE de ses voisins", async () => {
    const solo = await occupationsDuPlanning(
      SESSION,
      [ligneDe(AVEC_CALENDRIER_PROPRE)],
      FENETRE,
      clientApp(),
    );
    const groupe = await occupationsDuPlanning(
      SESSION,
      TECHNICIENS.map(ligneDe),
      FENETRE,
      clientApp(),
    );
    const ligneSolo = solo.find(
      (l) => l.technicienId === AVEC_CALENDRIER_PROPRE,
    );
    const ligneGroupe = groupe.find(
      (l) => l.technicienId === AVEC_CALENDRIER_PROPRE,
    );
    expect(ligneSolo).toBeDefined();
    expect(ligneGroupe?.occupation.minutesOuvrables).toBe(
      ligneSolo?.occupation.minutesOuvrables,
    );

    // Et sans lui, l'égalité ci-dessus serait vraie pour rien : le calendrier
    // propre doit réellement changer le dénominateur face à un voisin qui n'en
    // a pas — la mutualisation du CHARGEMENT ne doit pas avoir aplati la
    // RÈGLE DE PRIORITÉ (L3-01a).
    const voisin = groupe.find(
      (l) => l.technicienId === SANS_CALENDRIER_PROPRE[0],
    );
    expect(ligneGroupe?.occupation.minutesOuvrables).not.toBe(
      voisin?.occupation.minutesOuvrables,
    );
  });
});
