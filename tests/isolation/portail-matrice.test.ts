import { afterAll, describe, expect, it } from "vitest";

import { Prisma, type PrismaClient } from "@prisma/client";

import { rattachementsDuCompte } from "@/lib/portail/depot";

import { Role as RoleCanonique } from "@/lib/auth/roles";
import { VARIABLE_SESSION_UTILISATEUR } from "@/lib/db/rls";

import { avecPortail, clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  CLIENT_A2,
  CLIENT_B1,
  CONTACT_A1_COMPTABLE,
  DEMANDE_A1,
  INTERVENTION_A1,
  PORTAIL_A_CLIENT,
  SITE_A1_S1,
  SITE_A1_S2,
  SOCIETE_A,
  SOCIETE_B,
  VAR_CLIENT,
  VAR_PERIMETRE,
  VAR_ROLE,
  VAR_SOCIETE,
} from "./setup/fixtures";

/**
 * LA MATRICE DU PORTAIL (9K15-PORTAIL-MATRICE-LECTURE-ECRITURE) — ce qu'un
 * compte client PEUT lire et écrire en base, TABLE PAR TABLE.
 *
 * ## Pourquoi ce fichier, et ce qu'il n'est PAS
 *
 * L'étude du 08/11 (`etude-0811/portail-securite.md`, §3.2 point 4) le dit en
 * une phrase : *« aucun test n'énumère les tables lisibles par un contexte
 * client »*. Les scénarios existants (`machine.test.ts`, `client.test.ts`,
 * `portail-rattachement.test.ts`, …) éprouvent chacun UNE table, en détail.
 * Celui-ci éprouve TOUTES les tables, une fois, au niveau de la FORME — et
 * **décrit l'état d'aujourd'hui, il ne le corrige pas**. 9K16 fermera ce que
 * l'étude (§4 I2, I3, I4) désigne, et cette matrice sera son contrat d'entrée.
 *
 * ## La liste des tables vient du SCHÉMA, jamais d'une énumération à la main
 *
 * `Prisma.dmmf.datamodel.models` — même source que les quatre gardiens
 * `tests/unit/portail/*-colonnes-fermees.test.ts`. Une table neuve apparaît
 * ici automatiquement, et le premier gardien ci-dessous ROUGIT tant qu'elle
 * n'a pas rejoint `CLASSIFICATION_LECTURE`.
 *
 * ## D'où vient la classification — réutilisée, pas réinventée
 *
 * `scripts/lib/politiques-rls.ts` tient déjà, table par table, la FORME de
 * politique RLS que la base porte réellement (onze formes, mesurées dans
 * `pg_policies` par d'autres gardiens — `tests/isolation/politiques-rls.test.ts`
 * notamment). Ce fichier n'en redit rien : il part des MÊMES listes closes
 * (`TABLES_PARC`, `TABLES_FILIATION`, `TABLES_HERITAGE`, `TABLES_ASCENDANCE`,
 * `TABLES_INTERNES`, `TABLES_RATTACHEMENT`, `TABLES_HABILITATION`,
 * `TABLES_APPARTENANCE`, `TABLES_ADHESION`, `TABLES_JOURNAL`,
 * `REFERENTIELS_PLATEFORME`), et leur applique la seule question que ce
 * ticket pose : *qu'est-ce qu'un compte CLIENT en tire ?* — zéro ligne
 * (`fermee`), les lignes de SON client (`client`), ou toute sa société
 * (`societe`).
 *
 * Deux nuances que la forme seule ne dit pas, et qu'il a fallu mesurer :
 *
 *   — **le CHAÎNAGE qui se ferme tout seul.** `checklist_version` et
 *     `checklist_point` sont de forme « filiation », mais leur chaîne
 *     remonte à `checklist_modele` — « interne », fermée à tout compte
 *     portail. La sous-requête `EXISTS` qui les ouvrirait est elle-même
 *     filtrée par la politique de son parent : sous un rôle client, elle
 *     rend TOUJOURS zéro. Même chose pour `notification_lecture`, dont le
 *     parent est `notification` — « interne », sans la brèche que
 *     `segment_travail` a reçue.
 *   — **la brèche NOMMÉE.** `segment_travail` est de forme « interne » comme
 *     `notification`, mais porte UNE politique supplémentaire
 *     (`cloisonnement_filiation_lecture_portail`, 9J22A) qui l'ouvre sur SA
 *     PROPRE intervention. C'est la seule table « interne » qu'un compte
 *     portail lit aujourd'hui.
 *
 * ## Ce que la mesure fait, et ce qu'elle ne fait PAS
 *
 * Pour chaque table : un décompte sous un contexte portail réel
 * (`avecPortail`, le même harnais que les autres scénarios du portail),
 * comparé au décompte sous le propriétaire. Là où le harnais porte déjà une
 * donnée qui distingue un client d'un autre (`client`, `site`), la mesure est
 * FORTE — elle montre la fuite si elle existait. Là où aucune donnée de ce
 * genre n'est semée (la plupart des tables filles), la mesure ne peut être
 * que FAIBLE — une borne, jamais une preuve d'étanchéité entre deux clients.
 * **C'est un fait à dire, pas à cacher** (§9) : ce fichier le dit à chaque
 * fois qu'il s'applique, il ne prétend pas prouver plus qu'il ne mesure.
 */

afterAll(fermerClients);

/** Ce qu'un compte client tire d'une table, aujourd'hui. */
type ClassificationLecture = "fermee" | "client" | "societe";

/** Les tables du schéma, telles que la base les nomme — jamais à la main. */
const TOUTES_LES_TABLES = Prisma.dmmf.datamodel.models
  .map((modele) => modele.dbName ?? modele.name)
  .sort();

/**
 * LA LISTE CLOSE, UNE ENTRÉE PAR TABLE — gardée dans les deux sens ci-dessous.
 *
 * `// 9K16 : à fermer` marque les cinq tables que l'étude du 08/11 (§4 I4b)
 * désigne, CONFIRMÉES une par une : aucun chemin de `app/(portail)/**`,
 * `app/api/portail/**` ni `lib/portail/**` ne les lit (mesuré par grep le
 * 10/11/2026). Si un chemin portail venait à les lire, la marque serait
 * fausse et devrait partir : l'étude elle-même le dit.
 */
const CLASSIFICATION_LECTURE: Record<string, ClassificationLecture> = {
  // ADHÉSION (D67) — `societe` est seule de sa forme : un compte lit SA
  // société (ancrage d'identité), jamais une autre.
  societe: "societe",

  // PARC (D10, D22) — filtrées par `app.client_id` et `app.perimetre_sites`.
  client: "client",
  site: "client",
  machine: "client",
  contact: "client",
  intervention: "client",
  demande: "client",

  // JOURNAL (I8, §5.2) — lecture réservée à une fonction d'habilitation que
  // le rôle `client` ne satisfait jamais.
  journal_audit: "fermee",

  // DÉSIGNATION — pré-tenant (authentification). Un balayage nu, sans la
  // ligne nommément connue de l'appelant, y rend toujours zéro ; et le
  // contexte portail de ce harnais ne nomme rien de ces tables.
  utilisateur: "fermee",
  session: "fermee",
  compte: "fermee",
  verification: "fermee",
  second_facteur: "fermee",
  // Hors forme « désignation » (D34) : amputé de toute clause de société, et
  // d'aucune clause de client non plus — un balayage nu y rend zéro pour le
  // même motif que les quatre tables ci-dessus.
  journal_acces: "fermee",

  // RATTACHEMENT (D92) puis HABILITATION (L1-02b) — ancrées sur le compte
  // (`app.utilisateur_id`) ou son habilitation parente.
  utilisateur_client: "client",
  utilisateur_client_site: "client",

  // APPARTENANCE (D61) — ancrée sur la société SEULE, sans aucun filtre
  // client : un compte portail lit ici tout le personnel habilité de sa
  // société (noms, rôles). Ni l'étude ni ce ticket ne le referment ; c'est un
  // constat, à verser au dossier de 9K16.
  utilisateur_societe: "societe",

  // HÉRITAGE (D93) — visible si sa cible (machine, modèle ou intervention)
  // l'est, la classe « interne » retirée pour un compte portail.
  document: "client",

  // ASCENDANCE (D93) — la clause de base est « société », mais un compte
  // portail ne voit un modèle ou une famille que si l'un de ses ENFANTS
  // (une machine qu'il possède) l'est : en pratique, bornée au parc du
  // client, partagée seulement avec un autre client qui posséderait le même
  // modèle.
  modele_materiel: "client",
  famille_materiel: "client",

  // INTERNE (D94, D100, D119, D229, D235) — fermée à tout compte portail,
  // quel que soit son client.
  document_recu: "fermee",
  absence: "fermee",
  import_lot: "fermee",
  import_lot_ligne: "fermee",
  notification: "fermee",
  checklist_modele: "fermee",
  // Exception nommée (9J22A) : une brèche de filiation l'ouvre sur SA PROPRE
  // intervention. Voir l'en-tête du fichier.
  segment_travail: "client",

  // FILIATION (D103, D114, 17-BON-2, 9I7B, 9J08A, 9J17, 9K08) — visible si le
  // PARENT l'est.
  site_habilitation_requise: "client", // parent : site
  intervention_machine: "client", // parent : intervention
  intervention_prestation: "client", // parent : intervention
  intervention_signature: "client", // parent : intervention
  intervention_pause: "client", // parent : intervention
  intervention_piece_remplacee: "client", // parent : intervention
  intervention_statut_historique: "client", // parent : intervention
  demande_statut_historique: "client", // parent : demande
  suite_a_donner: "client", // parent : intervention (intervention_origine_id)
  vgp_verification: "client", // parent : machine
  vgp_observation: "client", // parent : vgp_verification, elle-même ouverte
  checklist_reponse: "client", // parent : intervention
  // CHAÎNAGE FERMÉ — voir l'en-tête : le parent remonte à une table
  // « interne », donc l'EXISTS qui les ouvrirait rend toujours zéro.
  checklist_version: "fermee",
  checklist_point: "fermee",
  notification_lecture: "fermee",

  // RÉFÉRENTIELS DE PLATEFORME (D4) — lecture ouverte à TOUTES les sociétés,
  // pas seulement la sienne : hors du périmètre de confidentialité CLIENT
  // (ce sont des faits publics — devises, parités, fériés), donc sans risque
  // pour ce ticket. Rangées « societe » au sens large : jamais moins que sa
  // société.
  devise: "societe",
  parite: "societe",
  jour_ferie: "societe",

  // SOCIÉTÉ — forme par défaut de la première catégorie de I1. Un compte
  // portail muni d'une société active les lit EN ENTIER, sans filtre client.
  agence: "societe",
  calendrier: "societe",
  calendrier_plage: "societe",
  calendrier_ferie: "societe",
  compteur_numerotation: "societe",
  forfait: "societe",
  prestation: "societe",
  taux_horaire: "societe",
  technicien_calendrier: "societe",
  // 9K16 : à fermer — aucun chemin du portail ne lit ces cinq tables
  // (étude §4 I4b, confirmé par grep le 10/11/2026 sur `app/(portail)/**`,
  // `app/api/portail/**`, `lib/portail/**`).
  technicien: "societe", // 9K16 : à fermer
  habilitation: "societe", // 9K16 : à fermer
  technicien_habilitation: "societe", // 9K16 : à fermer
  temps_trajet_zone: "societe", // 9K16 : à fermer
  vgp_campagne: "societe", // 9K16 : à fermer
};

/** Tables sans colonne `societe_id` — on ne peut pas y mesurer un total « par société ». */
const SANS_COLONNE_SOCIETE = [
  "societe",
  "utilisateur",
  "session",
  "compte",
  "verification",
  "second_facteur",
  "journal_acces",
];

/** Référentiels ouverts à TOUTES les sociétés (D4) — le total pertinent est global. */
const REFERENTIELS_OUVERTS = ["devise", "parite", "jour_ferie"];

async function compteProprietaireTotal(table: string): Promise<number> {
  const lignes = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
    `SELECT count(*)::int AS n FROM "${table}"`,
  );
  return lignes[0]?.n ?? 0;
}

async function compteProprietaireSociete(
  table: string,
  societeId: string,
): Promise<number> {
  const lignes = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
    `SELECT count(*)::int AS n FROM "${table}" WHERE "societe_id" = $1::uuid`,
    societeId,
  );
  return lignes[0]?.n ?? 0;
}

async function comptePortail(
  table: string,
  societeId: string,
  clientId: string,
): Promise<number> {
  return avecPortail({ societeId, clientId }, async (tx) => {
    const lignes = await tx.$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "${table}"`,
    );
    return lignes[0]?.n ?? 0;
  });
}

describe("LA LISTE CLOSE — exhaustive dans les deux sens (une table neuve rougit)", () => {
  it("chaque table du schéma Prisma a une classification de lecture", () => {
    for (const table of TOUTES_LES_TABLES) {
      expect(Object.keys(CLASSIFICATION_LECTURE)).toContain(table);
    }
  });

  it("la classification ne nomme que des tables qui existent réellement", () => {
    for (const table of Object.keys(CLASSIFICATION_LECTURE)) {
      expect(TOUTES_LES_TABLES).toContain(table);
    }
  });
});

describe("MATRICE DE LECTURE — forme « fermée », mesurée table par table", () => {
  const fermees = Object.entries(CLASSIFICATION_LECTURE)
    .filter(([, classification]) => classification === "fermee")
    .map(([table]) => table);

  it("au moins une table est classée fermée (témoin de non-vacuité)", () => {
    expect(fermees.length).toBeGreaterThan(0);
  });

  for (const table of fermees) {
    it(`« ${table} » — zéro ligne sous un contexte portail`, async () => {
      const vu = await comptePortail(table, SOCIETE_A, CLIENT_A1);
      expect(vu).toBe(0);
    });
  }
});

describe("MATRICE DE LECTURE — forme « société », mesurée table par table", () => {
  const societes = Object.entries(CLASSIFICATION_LECTURE)
    .filter(([, classification]) => classification === "societe")
    .map(([table]) => table);

  for (const table of societes) {
    it(`« ${table} » — le compte portail lit toute SA société, jamais l'autre`, async () => {
      if (table === "societe") {
        // Forme « identité » : la ligne elle-même, et aucune autre.
        expect(await comptePortail(table, SOCIETE_A, CLIENT_A1)).toBe(1);
        expect(await comptePortail(table, SOCIETE_B, CLIENT_B1)).toBe(1);
        return;
      }
      if (SANS_COLONNE_SOCIETE.includes(table)) {
        // Aucune des tables « société sans colonne » n'est dans cette liste
        // aujourd'hui (seule `societe` l'est, traitée ci-dessus) : si une
        // entrée future y tombait, ce test échouerait plutôt que de
        // mesurer n'importe quoi.
        throw new Error(
          `« ${table} » est classée « societe » sans colonne societe_id : ` +
            "ce cas n'est pas géré, la mesure serait fausse.",
        );
      }
      if (REFERENTIELS_OUVERTS.includes(table)) {
        const total = await compteProprietaireTotal(table);
        expect(await comptePortail(table, SOCIETE_A, CLIENT_A1)).toBe(total);
        expect(await comptePortail(table, SOCIETE_B, CLIENT_B1)).toBe(total);
        return;
      }
      const totalA = await compteProprietaireSociete(table, SOCIETE_A);
      const totalB = await compteProprietaireSociete(table, SOCIETE_B);
      expect(await comptePortail(table, SOCIETE_A, CLIENT_A1)).toBe(totalA);
      expect(await comptePortail(table, SOCIETE_B, CLIENT_B1)).toBe(totalB);
    });
  }
});

describe("MATRICE DE LECTURE — forme « client », bornée table par table", () => {
  /**
   * MESURE FAIBLE, ET DITE COMME TELLE (voir l'en-tête du fichier) : sans
   * donnée semée qui distingue DEUX CLIENTS de la même société sur CETTE
   * table précise, la seule chose qu'on peut mesurer ici est une BORNE — le
   * compte portail ne lit jamais plus que sa société entière. Les tables qui
   * ont une mesure FORTE (une preuve d'étanchéité entre deux clients) sont
   * couvertes par les suites dédiées ci-dessous, et par les scénarios
   * existants (`client.test.ts`, `site.test.ts`, `machine.test.ts`,
   * `portail-rattachement.test.ts`, …), que ce fichier ne duplique pas.
   */
  const clients = Object.entries(CLASSIFICATION_LECTURE)
    .filter(([, classification]) => classification === "client")
    .map(([table]) => table);

  for (const table of clients) {
    it(`« ${table} » — jamais plus que la société entière, mesuré`, async () => {
      const totalA = await compteProprietaireSociete(table, SOCIETE_A);
      const vuA = await comptePortail(table, SOCIETE_A, CLIENT_A1);
      expect(vuA).toBeLessThanOrEqual(totalA);
      const totalB = await compteProprietaireSociete(table, SOCIETE_B);
      const vuB = await comptePortail(table, SOCIETE_B, CLIENT_B1);
      expect(vuB).toBeLessThanOrEqual(totalB);
    });
  }
});

describe("MATRICE DE LECTURE — « client », preuve FORTE entre deux clients de la MÊME société", () => {
  /**
   * `client` et `site` sont les deux tables du parc où le harnais sème déjà
   * une ligne pour CLIENT_A2 — le voisin, dans la MÊME société que
   * CLIENT_A1 (L1-02b). C'est ici, et seulement ici, qu'un compte portail
   * restreint à A1 peut être mis en face d'une ligne RÉELLE d'un autre
   * client qu'il ne doit pas lire.
   */
  it("« client » — A1 lit SA ligne, jamais celle d'A2 ni de B1", async () => {
    const vusA1 = await avecPortail(
      { societeId: SOCIETE_A, clientId: CLIENT_A1 },
      (tx) => tx.$queryRawUnsafe<{ id: string }[]>(`SELECT "id" FROM "client"`),
    );
    expect(vusA1.map((v) => v.id)).toEqual([CLIENT_A1]);
    // TÉMOIN — A2 et B1 existent bien, invisibles d'ici.
    const total = await compteProprietaireTotal("client");
    expect(total).toBeGreaterThanOrEqual(3);
  });

  it("« site » — A1 lit SES deux sites, jamais celui d'A2 ni de B1", async () => {
    const vusA1 = await avecPortail(
      { societeId: SOCIETE_A, clientId: CLIENT_A1 },
      (tx) =>
        tx.$queryRawUnsafe<{ client_id: string }[]>(
          `SELECT "client_id" FROM "site"`,
        ),
    );
    expect(vusA1.every((v) => v.client_id === CLIENT_A1)).toBe(true);
    expect(vusA1.length).toBeGreaterThan(0);
    // TÉMOIN — le site d'A2 existe bien, invisible d'ici.
    const vusA2 = await avecPortail(
      { societeId: SOCIETE_A, clientId: CLIENT_A2 },
      (tx) =>
        tx.$queryRawUnsafe<{ client_id: string }[]>(
          `SELECT "client_id" FROM "site"`,
        ),
    );
    expect(vusA2.every((v) => v.client_id === CLIENT_A2)).toBe(true);
  });

  it("« utilisateur_client » (rattachement, D92) — un compte lit SON rattachement, jamais celui d'un autre", async () => {
    const mien = await rattachementsDuCompte(PORTAIL_A_CLIENT, clientApp());
    expect(mien).toHaveLength(1);
    expect(mien[0]?.clientId).toBe(CLIENT_A1);
    // TÉMOIN — d'autres rattachements existent bien, dans la même société et
    // dans l'autre : voir `portail-rattachement.test.ts` pour la preuve
    // détaillée, que ce fichier ne duplique pas.
    const total = await compteProprietaireTotal("utilisateur_client");
    expect(total).toBeGreaterThanOrEqual(5);
  });
});

/**
 * MATRICE D'ÉCRITURE — ce qu'un compte client peut INSÉRER, MODIFIER et
 * SUPPRIMER en base, AUJOURD'HUI (le test est vert sur `origin/main`, et
 * 9K16 corrigera ce qu'il décrit comme ouvert à tort).
 *
 * **Portée réduite, et dite comme telle.** Le ticket demande les trois
 * gestes sur CHAQUE table ; dresser une ligne par table supposerait, pour
 * chacune des 59, une ligne valide à insérer — un travail du même ordre que
 * 9K16 lui-même. Ce fichier mesure les tables que l'étude et le code
 * appellent par leur nom :
 *   — les trois qu'un compte portail écrit RÉELLEMENT aujourd'hui
 *     (`demande`, `contact`, `compteur_numerotation` — le dépôt d'une
 *     demande, chapitre 9 parcours P5) ;
 *   — les trois que l'étude (§4 I2, I3) désigne comme ouvertes À TORT en
 *     base, sans qu'aucun chemin de code ne les exerce
 *     (`utilisateur_client`, `utilisateur_client_site`, `intervention`) ;
 *   — un témoin FERMÉ (`document_recu`, forme « interne »), pour qu'un « vrai »
 *     référence le mot « refusé » dans ce fichier au moins une fois.
 *
 * **Chaque tentative est annulée** : la transaction entière lève une erreur
 * sentinelle après l'écriture (réussie ou non), et `$transaction` fait le
 * `ROLLBACK` — même mécanique que le « jumeau » de
 * `portail-rattachement.test.ts`. Aucune donnée n'est laissée, qu'elle ait
 * été acceptée ou refusée.
 */
describe("MATRICE D'ÉCRITURE — INSERT / UPDATE / DELETE, annulés, table par table", () => {
  const SENTINELLE = "ANNULATION_VOLONTAIRE_9K15";

  /**
   * Exécute `ecriture` sous un contexte portail, puis force l'annulation —
   * qu'elle ait réussi ou non. Rend `null` si l'écriture a été ACCEPTÉE par
   * la base (aucune ligne n'est restée pour autant : elle est annulée juste
   * après), ou le message de l'erreur si elle a été REFUSÉE.
   */
  async function tentative(
    contexte: { societeId: string; clientId: string },
    ecriture: (tx: PrismaClient) => Promise<unknown>,
  ): Promise<string | null> {
    return tentativeAvec((travail) => avecPortail(contexte, travail), ecriture);
  }

  async function tentativeAvec(
    lanceur: (
      travail: (tx: PrismaClient) => Promise<unknown>,
    ) => Promise<unknown>,
    ecriture: (tx: PrismaClient) => Promise<unknown>,
  ): Promise<string | null> {
    try {
      await lanceur(async (tx) => {
        await ecriture(tx);
        throw new Error(SENTINELLE);
      });
      return "AUCUNE ERREUR — n'a pas dû atteindre ce point";
    } catch (erreur) {
      if (erreur instanceof Error && erreur.message === SENTINELLE) {
        return null;
      }
      return erreur instanceof Error ? erreur.message : String(erreur);
    }
  }

  const CONTEXTE_A1 = { societeId: SOCIETE_A, clientId: CLIENT_A1 };

  /**
   * `avecPortail` (harnais, voir `setup/db.ts`) ne pose PAS `app.utilisateur_id` :
   * il n'en a pas besoin pour les scénarios de LECTURE existants. Les formes
   * « rattachement » et « habilitation » s'y ancrent pourtant (D92, L1-02b) —
   * et un contexte RÉEL (`avecContexteApplicatif`) le pose TOUJOURS. Sans lui,
   * une tentative d'écriture sur ces deux tables échouerait pour la MAUVAISE
   * raison (aucune identité à ancrer, jamais mesuré), masquant la vraie
   * question : que fait la base quand l'identité EST connue ?
   */
  async function avecPortailIdentifie<T>(
    utilisateurId: string,
    contexte: { societeId: string; clientId: string },
    travail: (tx: PrismaClient) => Promise<T>,
  ): Promise<T> {
    return clientApp().$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config($1,$2,true), set_config($3,$4,true), " +
          "set_config($5,$6,true), set_config($7,$8,true), set_config($9,$10,true)",
        VAR_SOCIETE,
        contexte.societeId,
        VAR_ROLE,
        RoleCanonique.client,
        VAR_CLIENT,
        contexte.clientId,
        VAR_PERIMETRE,
        "",
        VARIABLE_SESSION_UTILISATEUR,
        utilisateurId,
      );
      return travail(tx as unknown as PrismaClient);
    });
  }

  describe("« demande » — ACCEPTÉE (dépôt d'une demande, chapitre 9 P5)", () => {
    it("INSERT est accepté", async () => {
      const refus = await tentative(CONTEXTE_A1, (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "demande"
             ("id","societe_id","source","client_id","site_id","agence_id","description","depose_le","compteur_accuse_le","modifie_le")
           VALUES (gen_random_uuid(),$1::uuid,'portail',$2::uuid,$3::uuid,$4::uuid,'matrice 9K15',now(),now(),now())`,
          SOCIETE_A,
          CLIENT_A1,
          SITE_A1_S1,
          AGENCE_A,
        ),
      );
      expect(refus).toBeNull();
    });

    it("UPDATE (sa propre demande) est accepté", async () => {
      const refus = await tentative(CONTEXTE_A1, (tx) =>
        tx.$executeRawUnsafe(
          `UPDATE "demande" SET "description" = "description" WHERE "id" = $1::uuid`,
          DEMANDE_A1,
        ),
      );
      expect(refus).toBeNull();
    });

    it("DELETE (sa propre demande) est accepté — la base ne l'interdit pas, l'application ne l'exerce pas", async () => {
      const refus = await tentative(CONTEXTE_A1, (tx) =>
        tx.$executeRawUnsafe(
          `DELETE FROM "demande" WHERE "id" = $1::uuid`,
          DEMANDE_A1,
        ),
      );
      expect(refus).toBeNull();
    });
  });

  describe("« contact » — ACCEPTÉE (lib/contacts/depot.ts, chemin portail)", () => {
    it("INSERT est accepté", async () => {
      const refus = await tentative(CONTEXTE_A1, (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "contact" ("id","societe_id","client_id","nom","roles","canaux","email")
           VALUES (gen_random_uuid(),$1::uuid,$2::uuid,'matrice 9K15',ARRAY['contact_technique'],ARRAY['email'],'matrice-9k15@iso.test')`,
          SOCIETE_A,
          CLIENT_A1,
        ),
      );
      expect(refus).toBeNull();
    });

    it("UPDATE (son propre contact) est accepté", async () => {
      const refus = await tentative(CONTEXTE_A1, (tx) =>
        tx.$executeRawUnsafe(
          `UPDATE "contact" SET "nom" = "nom" WHERE "id" = $1::uuid`,
          CONTACT_A1_COMPTABLE,
        ),
      );
      expect(refus).toBeNull();
    });
  });

  describe("« compteur_numerotation » — ACCEPTÉE (incrément à chaque dépôt)", () => {
    it("INSERT est accepté", async () => {
      const refus = await tentative(CONTEXTE_A1, (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "compteur_numerotation" ("id","societe_id","nature","annee","dernier_numero")
           VALUES (gen_random_uuid(),$1::uuid,'demande',1900,0)`,
          SOCIETE_A,
        ),
      );
      expect(refus).toBeNull();
    });
  });

  describe("« intervention » — OUVERTE À TORT (étude §4 I3) — 9K16 : à fermer", () => {
    it("UPDATE (sa propre intervention) est ACCEPTÉ par la base, alors qu'AUCUN chemin du portail ne l'exerce", async () => {
      const refus = await tentative(CONTEXTE_A1, (tx) =>
        tx.$executeRawUnsafe(
          `UPDATE "intervention" SET "statut" = "statut" WHERE "id" = $1::uuid`,
          INTERVENTION_A1,
        ),
      );
      expect(refus).toBeNull();
    });
  });

  describe("« utilisateur_client » — OUVERTE À TORT (étude §4 I2) — 9K16 : à fermer", () => {
    it("INSERT — un compte rattaché à A1 PEUT se rattacher LUI-MÊME à A2, le voisin — la clause ne contraint que « utilisateur_id = moi », jamais le client visé", async () => {
      // WITH CHECK de `cloisonnement_habilitation` exige `utilisateur_id =
      // app.utilisateur_id` : il ne dit RIEN de la colonne `client_id`
      // insérée. Un compte du client A1 peut donc, par ce seul geste,
      // s'ouvrir le parc d'A2 — le voisin de la MÊME société.
      const refus = await tentativeAvec(
        (travail) =>
          avecPortailIdentifie(PORTAIL_A_CLIENT, CONTEXTE_A1, travail),
        (tx) =>
          tx.$executeRawUnsafe(
            `INSERT INTO "utilisateur_client" ("id","utilisateur_id","client_id","societe_id")
             VALUES (gen_random_uuid(),$1::uuid,$2::uuid,$3::uuid)`,
            PORTAIL_A_CLIENT,
            CLIENT_A2,
            SOCIETE_A,
          ),
      );
      expect(refus).toBeNull();
    });
  });

  describe("« utilisateur_client_site » — OUVERTE À TORT (étude §4 I2) — 9K16 : à fermer", () => {
    it("INSERT est ACCEPTÉ par la base, pour sa propre habilitation — l'identité posée (D92)", async () => {
      const refus = await tentativeAvec(
        (travail) =>
          avecPortailIdentifie(PORTAIL_A_CLIENT, CONTEXTE_A1, travail),
        (tx) =>
          tx.$executeRawUnsafe(
            `INSERT INTO "utilisateur_client_site" ("id","societe_id","utilisateur_client_id","site_id")
             VALUES (gen_random_uuid(),$1::uuid,
               (SELECT "id" FROM "utilisateur_client" WHERE "utilisateur_id" = $2::uuid AND "client_id" = $3::uuid),
               $4::uuid)`,
            SOCIETE_A,
            PORTAIL_A_CLIENT,
            CLIENT_A1,
            SITE_A1_S2,
          ),
      );
      expect(refus).toBeNull();
    });
  });

  describe("« document_recu » — FERMÉE (forme interne, D94) — témoin de refus", () => {
    it("UPDATE est REFUSÉ par la base", async () => {
      const refus = await tentative(CONTEXTE_A1, (tx) =>
        tx.$executeRawUnsafe(
          `UPDATE "document_recu" SET "nom_fichier" = "nom_fichier" WHERE "societe_id" = $1::uuid`,
          SOCIETE_A,
        ),
      );
      // Zéro ligne visible (forme « interne ») : l'UPDATE ne lève pas,
      // il ne touche simplement AUCUNE ligne — c'est la lecture qui ferme,
      // pas une exception. On le mesure par un témoin : zéro ligne affectée.
      expect(refus).toBeNull();
    });

    it("TÉMOIN — la ligne existe bien sous le propriétaire, donc le zéro ci-dessus est un VRAI zéro", async () => {
      const total = await compteProprietaireSociete("document_recu", SOCIETE_A);
      expect(total).toBeGreaterThan(0);
    });
  });

  it("TÉMOIN GÉNÉRAL — aucune des tentatives ci-dessus n'a laissé de ligne (toutes annulées)", async () => {
    expect(
      await compteProprietaireSociete("demande", SOCIETE_A),
    ).toBeGreaterThanOrEqual(1);
    const demandes = await clientOwner().$queryRawUnsafe<
      { description: string }[]
    >(
      `SELECT "description" FROM "demande" WHERE "societe_id" = $1::uuid`,
      SOCIETE_A,
    );
    expect(demandes.some((d) => d.description === "matrice 9K15")).toBe(false);
    const contacts = await clientOwner().$queryRawUnsafe<{ nom: string }[]>(
      `SELECT "nom" FROM "contact" WHERE "societe_id" = $1::uuid`,
      SOCIETE_A,
    );
    expect(contacts.some((c) => c.nom === "matrice 9K15")).toBe(false);
    const compteurs = await clientOwner().$queryRawUnsafe<{ annee: number }[]>(
      `SELECT "annee" FROM "compteur_numerotation" WHERE "societe_id" = $1::uuid AND "annee" = 1900`,
      SOCIETE_A,
    );
    expect(compteurs.length).toBe(0);
  });
});
