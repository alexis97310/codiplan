import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  affecterTechnicien,
  deplacerIntervention,
} from "@/lib/interventions/depot";
import { schemaDeplacement } from "@/lib/interventions/saisie";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * RG-PLA-04 AU MOMENT DE LA POSE (L3-02 ; D9, D73).
 *
 * > « L'affectation est **bloquée** si le site exige une habilitation marquée
 * > **bloquante** que le technicien n'a pas, ou dont la date d'expiration est
 * > antérieure à la date d'intervention. Une exigence non bloquante produit un
 * > **avertissement**. »
 *
 * ## LE TROU QUE CE FICHIER MESURE, ET QUE RIEN NE MESURAIT
 *
 * La règle avait **un seul appelant** — `affecterTechnicien`, le formulaire de
 * la fiche. Le glisser-déposer du planning écrit pourtant `technicien_id` par
 * un tout autre chemin, `deplacerIntervention`, et **ce chemin ne consultait
 * rien**. *Mesuré avant la réparation : le même technicien, sans l'habilitation
 * bloquante de son site, était refusé par le formulaire et accepté par un
 * glissé.* Une règle tenue par un chemin sur deux n'est pas tenue.
 *
 * **Et rien ne pouvait le voir** : aucun scénario n'éprouvait RG-PLA-04 à
 * travers une écriture réelle — la règle avait ses tests unitaires, qui la
 * jugent sur des tableaux, jamais sur un chemin. *Une suite qui éprouve tous
 * les maillons n'éprouve pas la chaîne* (§9, 08/09).
 *
 * ## LA DATE COMPTE, ET C'EST CE QUE LA SEULE AFFECTATION NE VOYAIT PAS
 *
 * RG-PLA-04 compare l'expiration à la **date d'intervention**. Un déplacement
 * CHANGE cette date : une habilitation valable le 14 ne l'est plus le 28, et la
 * même personne devient inaffectable sans que personne ne l'ait réaffectée.
 * C'est le cas qu'un contrôle posé à la seule affectation ne peut pas attraper.
 *
 * ## Chaque refus porte son JUMEAU (§9, 24/08), et chaque vert sa raison
 *
 * Un refus prouve que le verrou mordait le jour où on l'a écrit. Le jumeau
 * retire **le verrou visé** — l'habilitation est accordée — et montre que la
 * même écriture passe alors. Et à côté, un cas qui doit rester vert **pour sa
 * propre raison** : une exigence NON bloquante, qui avertit sans refuser
 * (§9, 11/09).
 */

afterAll(fermerClients);

const SESSION = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien];

/**
 * UN LUNDI, dans la plage 08:00–12:00 du calendrier de l'agence A.
 *
 * *Le jour et l'heure ne sont pas décoratifs* : les deux autres contrôles à la
 * pose prononcent AVANT celui-ci, et un mardi ou un créneau de 14 h ferait
 * échouer le scénario sur « jour fermé » — c'est-à-dire en accusant la mauvaise
 * règle, et en restant vert le jour où celle qu'on mesure disparaîtrait.
 */
const LUNDI = new Date("2026-09-14T00:00:00.000Z");
const AUTRE_LUNDI = new Date("2026-09-28T00:00:00.000Z");
const DEBUT_MINUTES = 9 * 60;

/**
 * LES LIGNES DE CE FICHIER, ET ELLES SEULES.
 *
 * *La première écriture de ce scénario vidait les trois tables entre deux cas.*
 * La base d'isolation est **partagée** : `tests/isolation/habilitations.test.ts`
 * pose ses propres exigences sur les mêmes tables, et trois de ses scénarios
 * sont tombés — **sur une faute qui n'était pas la leur**. Ce qu'on efface ici
 * est donc énuméré, jamais balayé.
 *
 * Et l'intervention est **jetable** pour la même raison : remettre
 * `INTERVENTION_A1` à zéro entre deux cas la retirerait sous les pieds des
 * fichiers qui la lisent.
 */
let habilitationId = "";
let exigenceId = "";
let interventionId = "";

async function poserExigence(bloquant: boolean, code: string): Promise<void> {
  habilitationId = uuidv7();
  exigenceId = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "habilitation" ("id", "societe_id", "code", "libelle")
     VALUES ($1::uuid, $2::uuid, $3, $4)`,
    habilitationId,
    SOCIETE_A,
    `${code}-${habilitationId.slice(-6)}`,
    code,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "site_habilitation_requise"
       ("id", "societe_id", "site_id", "habilitation_id", "bloquant")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5)`,
    exigenceId,
    SOCIETE_A,
    SITE_A1_S1,
    habilitationId,
    bloquant,
  );
}

/** Le technicien DÉTIENT l'habilitation, avec ou sans échéance. */
async function accorder(expiration: string | null): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "technicien_habilitation"
       ("id", "societe_id", "utilisateur_id", "habilitation_id",
        "date_obtention", "date_expiration")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, DATE '2020-01-01', $5::date)`,
    uuidv7(),
    SOCIETE_A,
    TECHNICIEN,
    habilitationId,
    expiration,
  );
}

/** Le déplacement tel que la route le construit — même schéma, même refus. */
function deplacement(jour: Date) {
  return schemaDeplacement.parse({
    intervention_id: interventionId,
    date_planifiee: jour,
    debut_minutes: DEBUT_MINUTES,
    duree_min: 60,
    technicien_id: TECHNICIEN,
  });
}

beforeEach(async () => {
  interventionId = uuidv7();
  habilitationId = "";
  exigenceId = "";
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
             'planifiee', now())`,
    interventionId,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
  );
});

afterEach(async () => {
  // **Dans l'ordre des clés étrangères**, et sur les seules lignes de ce cas.
  if (habilitationId !== "") {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "technicien_habilitation" WHERE "habilitation_id" = $1::uuid`,
      habilitationId,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "site_habilitation_requise" WHERE "id" = $1::uuid`,
      exigenceId,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "habilitation" WHERE "id" = $1::uuid`,
      habilitationId,
    );
  }
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
    interventionId,
  );
});

describe("RG-PLA-04 à la pose — le déplacement décide comme l'affectation", () => {
  it("TÉMOIN — sans aucune exigence, le déplacement passe", async () => {
    // *Sans lui, un déplacement refusé pour une tout autre raison — jour fermé,
    // chevauchement, intervention figée — passerait pour un refus
    // d'habilitation, et tout ce fichier mesurerait le mauvais verrou.*
    const resultat = await deplacerIntervention(
      SESSION,
      deplacement(LUNDI),
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
  });

  it("LE TROU : un DÉPLACEMENT qui affecte un technicien sans l'habilitation BLOQUANTE est refusé", async () => {
    await poserExigence(true, "BR");
    const resultat = await deplacerIntervention(
      SESSION,
      deplacement(LUNDI),
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: false,
      cle: "intervention.refus.habilitation",
    });

    // ET RIEN N'A ÉTÉ ÉCRIT. *Un refus qui laisse passer l'écriture est un
    // message, pas un verrou* — et c'est exactement ce qui se serait produit si
    // le contrôle avait été posé après la mise à jour.
    const [ligne] = await clientOwner().$queryRawUnsafe<
      Array<{ technicien_id: string | null }>
    >(
      `SELECT "technicien_id" FROM "intervention" WHERE "id" = $1::uuid`,
      interventionId,
    );
    expect(ligne.technicien_id).toBeNull();
  });

  it("LE JUMEAU : l'habilitation accordée, le MÊME déplacement passe", async () => {
    // Le verrou visé est retiré — l'habilitation est détenue —, et l'écriture
    // qui échouait réussit. *Sans ce jumeau, un refus venu d'ailleurs passerait
    // pour le bon* (§9, 24/08).
    await poserExigence(true, "BR");
    await accorder(null);
    const resultat = await deplacerIntervention(
      SESSION,
      deplacement(LUNDI),
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
  });

  it("LA DATE DÉCIDE : le même technicien passe le 14 et se voit refuser le 28", async () => {
    // **Le cas qu'un contrôle posé à la seule affectation ne peut pas voir.**
    // L'habilitation expire le 20 : elle couvre le 14, pas le 28. *Déplacer
    // n'est pas réaffecter, et c'est pourtant la même question.*
    await poserExigence(true, "CACES");
    await accorder("2026-09-20");

    const avant = await deplacerIntervention(
      SESSION,
      deplacement(LUNDI),
      clientApp(),
    );
    expect(avant.accepte).toBe(true);

    const apres = await deplacerIntervention(
      SESSION,
      deplacement(AUTRE_LUNDI),
      clientApp(),
    );
    expect(apres).toEqual({
      accepte: false,
      cle: "intervention.refus.habilitation",
    });
  });

  it("LE VERT POUR SA PROPRE RAISON : une exigence NON bloquante passe, et AVERTIT", async () => {
    // §9 du 11/09 : *à côté de chaque cas qui doit rougir, un cas qui doit
    // rester vert POUR SA PROPRE RAISON.* Ici le voisin qui lui ressemble est
    // le refus ci-dessus — même exigence, même technicien, un seul booléen de
    // différence. Un contrôle qui bloquerait sur tout passerait les trois
    // premiers cas et tomberait ici.
    //
    // **Et l'avertissement est la moitié de RG-PLA-04 qui n'avait aucun
    // appelant** : elle était calculée depuis L1-04, et jetée.
    await poserExigence(false, "CACES");
    const resultat = await deplacerIntervention(
      SESSION,
      deplacement(LUNDI),
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
    expect(resultat.accepte && resultat.avertissements).toEqual([
      "intervention.avertissement.habilitation",
    ]);
  });

  it("L'AVERTISSEMENT EST ABSENT quand il n'y a rien à dire — jamais un tableau vide", async () => {
    // *Un tableau vide et « rien à signaler » se ressemblent trop pour qu'on
    // laisse un écran décider lequel des deux il affiche.*
    await poserExigence(true, "BR");
    await accorder(null);
    const resultat = await deplacerIntervention(
      SESSION,
      deplacement(LUNDI),
      clientApp(),
    );
    expect(resultat.accepte && resultat.avertissements).toBeUndefined();
  });

  it("LES DEUX CHEMINS DÉCIDENT PAREIL — c'est tout l'objet du ticket", async () => {
    // **La confrontation, et elle porte sur le CHEMIN, pas sur la règle.** Les
    // deux appellent la même fonction ; ce scénario existe pour que le jour où
    // l'un d'eux cesserait de l'appeler, quelque chose le dise. *Deux lectures
    // d'un même critère divergent en silence, et celle qui n'a pas de scénario
    // dérive la première* (§9, 01/09).
    await poserExigence(true, "BR");
    const parLeDeplacement = await deplacerIntervention(
      SESSION,
      deplacement(LUNDI),
      clientApp(),
    );
    const parLAffectation = await affecterTechnicien(
      SESSION,
      interventionId,
      TECHNICIEN,
      clientApp(),
    );
    expect(parLeDeplacement).toEqual(parLAffectation);
    expect(parLAffectation.accepte).toBe(false);
  });
});
