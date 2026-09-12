import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { listerPlanning } from "@/lib/interventions/depot";
import { occupationsDuPlanning } from "@/lib/interventions/occupation";
import { reglerTrajetZone, retirerTrajetZone } from "@/lib/sites/depot";
import { schemaTrajetZone } from "@/lib/sites/trajet-zone";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  CLIENT_A2,
  SITE_A1_S1,
  SITE_A1_S2,
  SITE_A2_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * LE TRAJET DANS LA CHARGE — la chaîne complète (L3-05a, D107, RG-PLA-05).
 *
 * ## Pourquoi ce fichier existe, et ce qu'aucun autre ne mesurerait
 *
 * `trajet.test.ts` éprouve la lecture C sur des étapes fabriquées ;
 * `trajet-zone.test.ts` éprouve la cascade sur un catalogue fabriqué. **Aucun
 * des deux ne franchit la frontière** entre le planning, les sites lus sous le
 * contexte cloisonné, le catalogue de la société et le taux d'occupation — et
 * *une suite qui éprouve tous les maillons n'éprouve pas la chaîne* (§9, 08/09).
 *
 * Ce fichier est cet appelant : il pose de vraies interventions, les relit par
 * `listerPlanning` — **donc dans l'ordre que l'écran affiche** —, et lit la
 * charge que le planning affiche.
 *
 * ## Les valeurs du harnais, lues et non supposées
 *
 * `Site A1-1` porte **25** minutes, `Site A2-1` **15**, et `Site A1-2` **aucune
 * valeur et aucune zone** — c'est le cas « trajet inconnu » sans rien avoir à
 * fabriquer. Les trois dépendent de la même agence, celle du technicien : *la
 * prémisse de D107 — tous les techniciens partent de la même agence — est donc
 * satisfaite ici, et c'est écrit plutôt que sous-entendu.*
 */

const SESSION = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien];

/** Un lundi de la plage 08:00–12:00 du calendrier de l'agence A. */
const JOUR = "2026-09-14";
const JOUR_SUIVANT = "2026-09-15";
const DU = new Date(`${JOUR}T00:00:00.000Z`);
/**
 * LA BORNE HAUTE EST EXCLUSIVE, ET ELLE SE COMPTE EN JOURS (12/09/2026).
 *
 * Elle valait `${JOUR_SUIVANT}T23:59:59Z` quand `listerPlanning` comparait par
 * `lte` ; elle compare désormais par `lt`, l'écran lui passant le lendemain à
 * minuit. **Et la granularité est le JOUR, pas la seconde** — mesuré :
 * `date_planifiee` est un `@db.Date`, Prisma convertit l'opérande de la
 * comparaison en `date`, si bien que `< '2026-09-15T23:59:59Z'` vaut
 * `< '2026-09-15'` et écarte la journée entière du 15. *Une borne à
 * 23:59:59 sur une colonne de type date n'est donc pas « la fin de la
 * journée » : c'est son début.*
 */
const AU = new Date("2026-09-16T00:00:00.000Z");
/** La même fenêtre EN JOURS — borne haute exclusive (12/09/2026). */
const FENETRE = {
  du: { annee: 2026, mois: 9, jour: 14 },
  au: { annee: 2026, mois: 9, jour: 16 },
};

const posees: string[] = [];

/**
 * Une intervention posée, avec son jour et son créneau.
 *
 * Le CRÉNEAU décide de l'ordre dans la journée — c'est `listerPlanning` qui
 * l'applique, et c'est le même ordre que l'écran montre.
 */
async function poser(options: {
  readonly site: string;
  readonly client: string;
  readonly jour: string;
  readonly heure: string;
  readonly dureeMin?: number;
}): Promise<string> {
  const id = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "technicien_id", "type", "statut", "date_planifiee",
       "creneau_debut", "duree_estimee_min", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
             'curatif', 'planifiee', $7::date, $8::timestamptz, $9::int, now())`,
    id,
    SOCIETE_A,
    options.client,
    options.site,
    AGENCE_A,
    TECHNICIEN,
    options.jour,
    `${options.jour}T${options.heure}:00.000Z`,
    options.dureeMin ?? 60,
  );
  posees.push(id);
  return id;
}

/** La charge du technicien, telle que l'écran du planning la lit. */
async function charge(): Promise<{
  readonly trajetMin: number;
  readonly journees: number;
  readonly journeesSansTrajet: number;
  readonly engagees: number;
}> {
  const lignes = await listerPlanning(SESSION, DU, AU, clientApp());
  const charges = await occupationsDuPlanning(
    SESSION,
    lignes,
    FENETRE,
    clientApp(),
  );
  const ligne = charges.find((l) => l.technicienId === TECHNICIEN);
  if (ligne === undefined) {
    throw new Error("aucune ligne de charge pour le technicien");
  }
  return {
    trajetMin: ligne.occupation.trajet.minutes,
    journees: ligne.occupation.trajet.journees,
    journeesSansTrajet: ligne.occupation.trajet.journeesSansTrajet,
    engagees: ligne.occupation.minutesEngagees,
  };
}

beforeEach(async () => {
  // TÉMOIN PRÉALABLE : la journée part VIDE. Sans lui, un total juste pourrait
  // venir de lignes laissées par un scénario voisin (§9, 07/09).
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "societe_id" = '${SOCIETE_A}'::uuid
       AND "date_planifiee" BETWEEN '${JOUR}'::date AND '${JOUR_SUIVANT}'::date`,
  );
});

afterEach(async () => {
  for (const id of posees.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      id,
    );
  }
  await retirerTrajetZone(SESSION, "sud", clientApp());
  await clientOwner().$executeRawUnsafe(
    `UPDATE "site" SET "zone_geo" = NULL WHERE "id" = '${SITE_A1_S2}'::uuid`,
  );
});

afterAll(fermerClients);

describe("la chaîne : planning → sites → cascade → charge", () => {
  it("une journée à UN site compte l'aller ET le retour", async () => {
    await poser({
      site: SITE_A1_S1,
      client: CLIENT_A1,
      jour: JOUR,
      heure: "08:00",
    });
    const mesure = await charge();
    // `Site A1-1` porte 25 minutes : aller 25 + retour 25.
    expect(mesure.trajetMin).toBe(50);
    expect(mesure.journees).toBe(1);
    expect(mesure.journeesSansTrajet).toBe(0);
    // TÉMOIN : le temps d'intervention est compté À PART, et non absorbé.
    expect(mesure.engagees).toBe(60);
  });

  it("une journée à DEUX sites compte UN aller et UN retour, jamais deux", async () => {
    await poser({
      site: SITE_A1_S1,
      client: CLIENT_A1,
      jour: JOUR,
      heure: "08:00",
    });
    await poser({
      site: SITE_A2_S1,
      client: CLIENT_A2,
      jour: JOUR,
      heure: "10:00",
    });
    const mesure = await charge();
    // 25 (aller vers le premier) + 15 (retour depuis le dernier) = 40.
    // La lecture A aurait donné 2×25 + 2×15 = 80 : *C cesse de compter un
    // retour à l'agence qui n'a pas eu lieu.*
    expect(mesure.trajetMin).toBe(40);
    expect(mesure.journees).toBe(1);
  });

  it("et l'ORDRE est celui des créneaux — les extrémités changent avec eux", async () => {
    // Les mêmes deux sites, dans l'ordre inverse : le premier devient A2-1.
    await poser({
      site: SITE_A2_S1,
      client: CLIENT_A2,
      jour: JOUR,
      heure: "08:00",
    });
    await poser({
      site: SITE_A1_S1,
      client: CLIENT_A1,
      jour: JOUR,
      heure: "10:00",
    });
    // La lecture C est symétrique : 15 + 25 = 40, comme 25 + 15. Ce que ce
    // scénario prouve n'est donc pas un écart de total — c'est que la chaîne
    // TRAVERSE l'ordre du planning sans se tromper de journée.
    expect((await charge()).trajetMin).toBe(40);
  });

  it("DEUX journées comptent DEUX allers-retours", async () => {
    await poser({
      site: SITE_A1_S1,
      client: CLIENT_A1,
      jour: JOUR,
      heure: "08:00",
    });
    await poser({
      site: SITE_A2_S1,
      client: CLIENT_A2,
      jour: JOUR_SUIVANT,
      heure: "08:00",
    });
    const mesure = await charge();
    expect(mesure.trajetMin).toBe(50 + 30);
    expect(mesure.journees).toBe(2);
  });

  it("un site SANS zone et SANS valeur rend la journée INCONNUE, jamais zéro", async () => {
    // `Site A1-2` ne porte ni valeur ni zone : la cascade rend `null`.
    await poser({
      site: SITE_A1_S2,
      client: CLIENT_A1,
      jour: JOUR,
      heure: "08:00",
    });
    const mesure = await charge();
    expect(mesure.trajetMin).toBe(0);
    expect(mesure.journees).toBe(0);
    // *« Aucun trajet » et « je ne sais pas » ne se corrigent pas au même
    // endroit* — et c'est ce compteur qui les distingue à l'écran.
    expect(mesure.journeesSansTrajet).toBe(1);
  });

  it("un site au MILIEU sans trajet ne gêne pas : C ne lit pas le milieu", async () => {
    await poser({
      site: SITE_A1_S1,
      client: CLIENT_A1,
      jour: JOUR,
      heure: "08:00",
    });
    await poser({
      site: SITE_A1_S2,
      client: CLIENT_A1,
      jour: JOUR,
      heure: "09:00",
    });
    await poser({
      site: SITE_A2_S1,
      client: CLIENT_A2,
      jour: JOUR,
      heure: "10:00",
    });
    const mesure = await charge();
    expect(mesure.trajetMin).toBe(40);
    expect(mesure.journeesSansTrajet).toBe(0);
  });
});

describe("la cascade traverse la chaîne — défaut, puis réglage de la société", () => {
  it("une ZONE sans valeur de site prend le DÉFAUT de D107", async () => {
    await clientOwner().$executeRawUnsafe(
      `UPDATE "site" SET "zone_geo" = 'sud' WHERE "id" = '${SITE_A1_S2}'::uuid`,
    );
    await poser({
      site: SITE_A1_S2,
      client: CLIENT_A1,
      jour: JOUR,
      heure: "08:00",
    });
    // `sud` vaut 90 minutes chez D107 : aller-retour 180.
    expect((await charge()).trajetMin).toBe(180);
  });

  it("et le RÉGLAGE de la société l'emporte sur le défaut", async () => {
    await clientOwner().$executeRawUnsafe(
      `UPDATE "site" SET "zone_geo" = 'sud' WHERE "id" = '${SITE_A1_S2}'::uuid`,
    );
    await reglerTrajetZone(
      SESSION,
      schemaTrajetZone.parse({ zone: "sud", minutes: 120 }),
      clientApp(),
    );
    await poser({
      site: SITE_A1_S2,
      client: CLIENT_A1,
      jour: JOUR,
      heure: "08:00",
    });
    expect((await charge()).trajetMin).toBe(240);
  });

  it("mais la valeur SAISIE sur le site l'emporte sur les deux", async () => {
    // `Site A1-1` porte 25 minutes ET on lui donne la zone `sud` réglée à 120 :
    // c'est la valeur du site qui gagne. *La cascade a un ordre, et il ne
    // s'inverse pas* (D23).
    await clientOwner().$executeRawUnsafe(
      `UPDATE "site" SET "zone_geo" = 'sud' WHERE "id" = '${SITE_A1_S1}'::uuid`,
    );
    await reglerTrajetZone(
      SESSION,
      schemaTrajetZone.parse({ zone: "sud", minutes: 120 }),
      clientApp(),
    );
    await poser({
      site: SITE_A1_S1,
      client: CLIENT_A1,
      jour: JOUR,
      heure: "08:00",
    });
    expect((await charge()).trajetMin).toBe(50);
    await clientOwner().$executeRawUnsafe(
      `UPDATE "site" SET "zone_geo" = NULL WHERE "id" = '${SITE_A1_S1}'::uuid`,
    );
  });

  it("une zone SANS ESTIMATION rend la journée inconnue — les Îles (D107)", async () => {
    await clientOwner().$executeRawUnsafe(
      `UPDATE "site" SET "zone_geo" = 'iles' WHERE "id" = '${SITE_A1_S2}'::uuid`,
    );
    await poser({
      site: SITE_A1_S2,
      client: CLIENT_A1,
      jour: JOUR,
      heure: "08:00",
    });
    const mesure = await charge();
    // *« Déplacement par avion — estimation impossible »* : la journée se
    // compte à part, et le total n'invente rien.
    expect(mesure.trajetMin).toBe(0);
    expect(mesure.journeesSansTrajet).toBe(1);
  });
});

describe("la FILE D'ATTENTE n'a pas de trajet", () => {
  it("une intervention non datée ne compte ni minute ni journée inconnue", async () => {
    const id = uuidv7();
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
         "agence_id", "technicien_id", "type", "statut", "duree_estimee_min",
         "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
               'curatif', 'a_planifier', 45, now())`,
      id,
      SOCIETE_A,
      CLIENT_A1,
      SITE_A1_S1,
      AGENCE_A,
      TECHNICIEN,
    );
    posees.push(id);

    const mesure = await charge();
    // *Personne n'y est allé.* Et le TÉMOIN : le temps engagé, lui, compte.
    expect(mesure.trajetMin).toBe(0);
    expect(mesure.journees).toBe(0);
    expect(mesure.journeesSansTrajet).toBe(0);
    expect(mesure.engagees).toBe(45);
  });
});
