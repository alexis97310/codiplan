import { afterAll, describe, expect, it } from "vitest";

import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  CapaciteGererPretsRequise,
  creerAppareilPret,
  enregistrerRetourPret,
  listerAppareilsPret,
  listerPretsEnCours,
  sortirPret,
} from "@/lib/prets/depot";

import { avecPortail, clientApp, fermerClients, sousSociete } from "./setup/db";
import {
  CLIENT_A1,
  INTERVENTION_A1,
  INTERVENTION_B1,
  SITE_A1_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * LE PRÊT D'ÉQUIPEMENT EST CLOISONNÉ ET FERMÉ AU PORTAIL
 * (9L60-PRET-1-MODELE, D287).
 *
 * `appareil_pret` est de forme « société » (le cas ordinaire) ;
 * `pret_equipement` de forme « interne » — comme `notification` (D229), la
 * fermeture est tenue par la BASE, pas seulement par l'absence d'écran. Ce
 * fichier traverse le chemin de PRODUCTION (`lib/prets/depot.ts`, donc
 * `avecContexteApplicatif`) pour les deux témoins RLS, et des écritures
 * DIRECTES (sous le rôle applicatif, hors dépôt) pour les deux gardes de
 * base — une garantie qui ne vit que dans la couche applicative n'en est
 * pas une (I1).
 */

afterAll(fermerClients);

function session(
  utilisateurId: string,
  societeId: string,
  role: Role,
  clientId: string | null = null,
): ContexteSession {
  return {
    utilisateurId,
    societeId,
    role,
    secondFacteurValide: true,
    adresseIp: null,
    clientId,
  };
}

const ADV_A = session(UTILISATEUR_PAR_ROLE[Role.adv], SOCIETE_A, Role.adv);
const TECHNICIEN_A = session(
  UTILISATEUR_PAR_ROLE[Role.technicien],
  SOCIETE_A,
  Role.technicien,
);
const ADV_B = session(UTILISATEUR_INTERNE_B, SOCIETE_B, Role.adv);
const PORTAIL_A1 = session(
  UTILISATEUR_PAR_ROLE[Role.client],
  SOCIETE_A,
  Role.client,
  CLIENT_A1,
);

const AUJOURDHUI = new Date(Date.UTC(2026, 10, 27));
const DEMAIN = new Date(Date.UTC(2026, 10, 28));

async function creerUnAppareilPourA(): Promise<string> {
  const id = uuidv7();
  await creerAppareilPret(
    ADV_A,
    id,
    {
      designation: "Groupe électrogène de prêt",
      marque: null,
      modele: null,
      numero_serie: null,
    },
    clientApp(),
  );
  return id;
}

async function sortirUnPretPourA1(appareilId: string): Promise<string> {
  const id = uuidv7();
  await sortirPret(
    ADV_A,
    id,
    {
      appareil_id: appareilId,
      intervention_id: INTERVENTION_A1,
      date_sortie: AUJOURDHUI,
      date_retour_prevue: DEMAIN,
      etat_depart: "Bon état, plein de carburant",
      observations: null,
    },
    clientApp(),
  );
  return id;
}

describe("le TÉMOIN PRÉALABLE — les politiques sont en vigueur et elles mordent", () => {
  it("un utilisateur interne lit SA société et pas celle de l'autre", async () => {
    const appareilId = await creerUnAppareilPourA();
    const pretId = await sortirUnPretPourA1(appareilId);

    const appareilsVusParA = await sousSociete(SOCIETE_A, (tx) =>
      tx.appareilPret.findMany({ select: { id: true } }),
    );
    expect(appareilsVusParA.map((a) => a.id)).toContain(appareilId);

    const appareilsVusParB = await sousSociete(SOCIETE_B, (tx) =>
      tx.appareilPret.findMany({ select: { id: true } }),
    );
    expect(appareilsVusParB.map((a) => a.id)).not.toContain(appareilId);

    const pretsVusParA = await sousSociete(SOCIETE_A, (tx) =>
      tx.pretEquipement.findMany({ select: { id: true } }),
    );
    expect(pretsVusParA.map((p) => p.id)).toContain(pretId);

    const pretsVusParB = await sousSociete(SOCIETE_B, (tx) =>
      tx.pretEquipement.findMany({ select: { id: true } }),
    );
    expect(pretsVusParB.map((p) => p.id)).not.toContain(pretId);
  });

  it("un compte portail n'en lit RIEN à `pret_equipement` — la fermeture EST la forme « interne »", async () => {
    const appareilId = await creerUnAppareilPourA();
    const pretId = await sortirUnPretPourA1(appareilId);

    const vusParLePortail = await avecPortail(
      {
        societeId: SOCIETE_A,
        clientId: CLIENT_A1,
        perimetreSites: [SITE_A1_S1],
      },
      (tx) => tx.pretEquipement.findMany({ select: { id: true } }),
    );
    expect(vusParLePortail.map((p) => p.id)).not.toContain(pretId);

    // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON (§9, 11/09) : le MÊME
    // compte, au MÊME instant, lit bien SON parc. Ce n'est pas la session qui
    // est muette, c'est la table qui est fermée.
    const machines = await avecPortail(
      {
        societeId: SOCIETE_A,
        clientId: CLIENT_A1,
        perimetreSites: [SITE_A1_S1],
      },
      (tx) => tx.machine.findMany({ select: { id: true } }),
    );
    expect(machines.length).toBeGreaterThan(0);
  });

  it("listerPretsEnCours — un compte portail n'en lit AUCUN, même chemin que listerNotifications", async () => {
    const appareilId = await creerUnAppareilPourA();
    await sortirUnPretPourA1(appareilId);

    const vusParLePortail = await listerPretsEnCours(PORTAIL_A1, clientApp());
    expect(vusParLePortail).toEqual([]);
  });
});

describe("gerer_prets — le BUREAU seulement (D287)", () => {
  it("un technicien ne peut pas enregistrer un appareil de prêt — refus nommé, rien n'est écrit", async () => {
    const id = uuidv7();
    await expect(
      creerAppareilPret(
        TECHNICIEN_A,
        id,
        {
          designation: "Groupe électrogène de prêt",
          marque: null,
          modele: null,
          numero_serie: null,
        },
        clientApp(),
      ),
    ).rejects.toBeInstanceOf(CapaciteGererPretsRequise);

    const appareils = await listerAppareilsPret(ADV_A, clientApp());
    expect(appareils.map((a) => a.id)).not.toContain(id);
  });

  it("un technicien ne peut pas sortir un prêt", async () => {
    const appareilId = await creerUnAppareilPourA();
    const id = uuidv7();
    await expect(
      sortirPret(
        TECHNICIEN_A,
        id,
        {
          appareil_id: appareilId,
          intervention_id: INTERVENTION_A1,
          date_sortie: AUJOURDHUI,
          date_retour_prevue: DEMAIN,
          etat_depart: "Bon état",
          observations: null,
        },
        clientApp(),
      ),
    ).rejects.toBeInstanceOf(CapaciteGererPretsRequise);

    const pretsVusParA = await sousSociete(SOCIETE_A, (tx) =>
      tx.pretEquipement.findMany({ where: { appareil_id: appareilId } }),
    );
    expect(pretsVusParA).toHaveLength(0);
  });

  it("un technicien ne peut pas enregistrer un retour", async () => {
    const appareilId = await creerUnAppareilPourA();
    const pretId = await sortirUnPretPourA1(appareilId);

    await expect(
      enregistrerRetourPret(
        TECHNICIEN_A,
        pretId,
        {
          date_retour_reelle: DEMAIN,
          etat_retour: "Bon état",
          en_revision: false,
          observations: null,
        },
        clientApp(),
      ),
    ).rejects.toBeInstanceOf(CapaciteGererPretsRequise);
  });

  it("une autre société ne peut ni lire ni écrire sur un prêt qui n'est pas le sien", async () => {
    const appareilId = await creerUnAppareilPourA();
    const pretId = await sortirUnPretPourA1(appareilId);

    // B ne le VOIT même pas — la politique RLS de `pret_equipement` le cache
    // avant que la capacité de B n'entre en jeu.
    await expect(
      enregistrerRetourPret(
        ADV_B,
        pretId,
        {
          date_retour_reelle: DEMAIN,
          etat_retour: "Bon état",
          en_revision: false,
          observations: null,
        },
        clientApp(),
      ),
    ).rejects.toThrow();

    const pretsVusParA = await sousSociete(SOCIETE_A, (tx) =>
      tx.pretEquipement.findUniqueOrThrow({ where: { id: pretId } }),
    );
    expect(pretsVusParA.date_retour_reelle).toBeNull();
  });
});

describe("les gardes posées EN BASE (I1 — une garantie applicative seule n'en est pas une)", () => {
  it("un appareil ne tient qu'UN prêt en cours — la DEUXIÈME sortie est refusée par l'index unique partiel", async () => {
    const appareilId = await creerUnAppareilPourA();
    await sortirUnPretPourA1(appareilId);

    // Écriture DIRECTE, sous le rôle applicatif, hors dépôt : c'est la BASE
    // qui doit refuser, pas seulement `AppareilIndisponible` côté dépôt.
    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.pretEquipement.create({
          data: {
            id: uuidv7(),
            societe_id: SOCIETE_A,
            appareil_id: appareilId,
            intervention_id: INTERVENTION_A1,
            client_id: CLIENT_A1,
            site_id: SITE_A1_S1,
            date_sortie: AUJOURDHUI,
            date_retour_prevue: DEMAIN,
            etat_depart: "Bon état",
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it("un retour réel ne précède jamais la sortie — refusé par le CHECK en base", async () => {
    const appareilId = await creerUnAppareilPourA();

    const AVANT_LA_SORTIE = new Date(Date.UTC(2026, 10, 26));
    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.pretEquipement.create({
          data: {
            id: uuidv7(),
            societe_id: SOCIETE_A,
            appareil_id: appareilId,
            intervention_id: INTERVENTION_A1,
            client_id: CLIENT_A1,
            site_id: SITE_A1_S1,
            date_sortie: AUJOURDHUI,
            date_retour_prevue: DEMAIN,
            date_retour_reelle: AVANT_LA_SORTIE,
            etat_depart: "Bon état",
            etat_retour: "Bon état",
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it("un retour prévu ne précède jamais la sortie — refusé par le CHECK en base", async () => {
    const appareilId = await creerUnAppareilPourA();

    const AVANT_LA_SORTIE = new Date(Date.UTC(2026, 10, 26));
    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.pretEquipement.create({
          data: {
            id: uuidv7(),
            societe_id: SOCIETE_A,
            appareil_id: appareilId,
            intervention_id: INTERVENTION_A1,
            client_id: CLIENT_A1,
            site_id: SITE_A1_S1,
            date_sortie: AUJOURDHUI,
            date_retour_prevue: AVANT_LA_SORTIE,
            etat_depart: "Bon état",
          },
        }),
      ),
    ).rejects.toThrow();
  });
});

describe("le cycle complet, via le dépôt de production", () => {
  it("sortie puis retour : l'appareil redevient disponible, le prêt sort de la liste des en cours", async () => {
    const appareilId = await creerUnAppareilPourA();
    const pretId = await sortirUnPretPourA1(appareilId);

    const enCoursApresSortie = await listerPretsEnCours(ADV_A, clientApp());
    expect(enCoursApresSortie.map((p) => p.id)).toContain(pretId);

    const appareilsApresSortie = await listerAppareilsPret(ADV_A, clientApp());
    expect(appareilsApresSortie.find((a) => a.id === appareilId)?.statut).toBe(
      "prete",
    );

    await enregistrerRetourPret(
      ADV_A,
      pretId,
      {
        date_retour_reelle: DEMAIN,
        etat_retour: "Rendu en bon état",
        en_revision: false,
        observations: null,
      },
      clientApp(),
    );

    const enCoursApresRetour = await listerPretsEnCours(ADV_A, clientApp());
    expect(enCoursApresRetour.map((p) => p.id)).not.toContain(pretId);

    const appareilsApresRetour = await listerAppareilsPret(ADV_A, clientApp());
    expect(appareilsApresRetour.find((a) => a.id === appareilId)?.statut).toBe(
      "disponible",
    );
  });

  it("une intervention d'une AUTRE société ne peut pas recevoir un prêt — refus nommé", async () => {
    const appareilId = await creerUnAppareilPourA();
    const id = uuidv7();

    await expect(
      sortirPret(
        ADV_A,
        id,
        {
          appareil_id: appareilId,
          intervention_id: INTERVENTION_B1,
          date_sortie: AUJOURDHUI,
          date_retour_prevue: DEMAIN,
          etat_depart: "Bon état",
          observations: null,
        },
        clientApp(),
      ),
    ).rejects.toThrow();
  });
});
