import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { cloturerIntervention } from "@/lib/interventions/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  MACHINE_A1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * LE TOTAL HORS TAXES D'UNE CLÔTURE (L2-09a).
 *
 * **Deux totaux étaient FAUX, et de deux manières opposées** :
 *
 * 1. le **forfait de déplacement** n'entrait dans aucun total, alors que
 *    `intervention.forfait_deplacement_id` le désignait depuis D84 ;
 * 2. une intervention **au forfait** se clôturait à **ZÉRO** — *un montant nul
 *    écrit là où il faut lire « je ne sais pas encore ».*
 *
 * Ce fichier les mesure **à travers la chaîne de production** : la clôture lit
 * le taux, lit le forfait, compose, et **écrit en base**. Les scénarios
 * unitaires de `tests/unit/tarification/composition.test.ts` éprouvent la règle ;
 * celui-ci éprouve qu'elle est réellement appelée — *une suite qui éprouve tous
 * les maillons n'éprouve pas la chaîne* (§9, 08/09).
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

/** La devise de la société A, telle que le harnais la sème. */
const DEVISE = "XPF";

const TAUX_MINEUR = BigInt(9000);
const FORFAIT_MINEUR = BigInt(3500);
const TEMPS_REEL_MIN = 120;

const jetables: string[] = [];
const techniciensPoses: string[] = [];

/**
 * UN CRÉNEAU ENTIÈREMENT DANS L'OUVERTURE, et la date n'est pas quelconque.
 *
 * `CALENDRIER_A` n'ouvre que le **lundi de 8 h à 12 h** (fixture du harnais).
 * Le 14 septembre 2026 est un lundi ; 9 h – 11 h à Nouméa (UTC+11) y tombe
 * entièrement. *La majoration vaut donc ZÉRO — un zéro VÉRITABLE —, et les
 * totaux de ce fichier restent exactement ceux qu'ils mesuraient avant L2-09b.*
 *
 * **C'est pour cela que le décor est enrichi plutôt que les assertions
 * assouplies** : la majoration est un argument obligatoire depuis L2-09b, et
 * une intervention sans technicien ni créneau ne peut plus être valorisée
 * entièrement. Le décor devient COMPLET ; aucune assertion ne perd de force, et
 * une s'ajoute — le supplément est nul, et il est constaté.
 */
const CRENEAU_DEBUT = "2026-09-14T09:00:00+11:00";
const CRENEAU_FIN = "2026-09-14T11:00:00+11:00";

/** Le technicien affecté, rattaché à l'agence dont on lit le calendrier (D13). */
const TECHNICIEN = UTILISATEUR_PAR_ROLE.technicien;

/**
 * Un taux en vigueur, sans lequel la clôture refuse (et c'est une autre règle).
 *
 * **Il est RETIRÉ en sortie de scénario**, et ce n'est pas de la politesse :
 * `taux-initial.test.ts` porte un témoin « la table naît vide », et vitest ne
 * garantit aucun ordre entre fichiers. *Un décor laissé derrière soi fait
 * rougir le voisin, et le voisin a raison* — mesuré, trois de ses scénarios
 * sont tombés avant que celui-ci nettoie.
 */
const tauxPoses: string[] = [];

async function poserLeTaux(): Promise<void> {
  const id = uuidv7();
  tauxPoses.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "taux_horaire" ("id","societe_id","date_effet","montant_mineur","devise_code")
     VALUES ('${id}', '${SOCIETE_A}', DATE '2020-01-01', ${TAUX_MINEUR}, '${DEVISE}')
     ON CONFLICT DO NOTHING`,
  );
}

/**
 * Un forfait de déplacement, et son identifiant.
 *
 * **Les deux axes de condition valent `NULL`, pas le tableau vide** — c'est la
 * forme que la base admet : `condition_multivaluee_valide` refuse un tableau
 * vide et n'accepte que `NULL` ou un ensemble non vide. *Un forfait sans
 * condition s'applique partout, et c'est le cas majoritaire (L1-06).*
 */
async function poserUnForfait(): Promise<string> {
  const id = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "forfait" ("id","societe_id","code","libelle","type","rang",
       "montant_mineur","devise_code","zone_geo","type_intervention","cumulable_temps","actif")
     VALUES ('${id}', '${SOCIETE_A}', 'DEP-${id.slice(-6)}', 'Déplacement', 'deplacement',
             ${Math.floor(Math.random() * 100000)}, ${FORFAIT_MINEUR}, '${DEVISE}',
             NULL, NULL, true, true)`,
  );
  return id;
}

/** Une intervention prête à clôturer, dans le mode donné. */
async function interventionAClore(
  mode: string,
  forfaitId: string | null,
): Promise<string> {
  const id = uuidv7();
  jetables.push(id);
  await poserLeTechnicien();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id","societe_id","client_id","site_id","agence_id",
       "type","statut","mode_valorisation","forfait_deplacement_id",
       "technicien_id","creneau_debut","creneau_fin","modifie_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", '${AGENCE_A}',
            'curatif', 'en_cours', '${mode}'::"ModeValorisation",
            ${forfaitId === null ? "NULL" : `'${forfaitId}'`},
            '${TECHNICIEN}', '${CRENEAU_DEBUT}'::timestamptz,
            '${CRENEAU_FIN}'::timestamptz, now()
       FROM "intervention" WHERE "statut" = 'planifiee' AND "societe_id" = '${SOCIETE_A}' LIMIT 1`,
  );
  // ~~RG-INT-01 : une curative ne démarre pas sans machine (L2-08a).~~ **La
  // règle est retirée par D120** — une intervention peut porter sur autre chose
  // qu'un équipement. La machine reste rattachée ici : *le décor d'une
  // valorisation n'a aucune raison de changer parce qu'une garde a disparu*,
  // et la garder éprouve au passage que le rattachement ne gêne pas.
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention_machine" ("id","societe_id","intervention_id","machine_id","modifie_le")
     VALUES ('${uuidv7()}', '${SOCIETE_A}', '${id}', '${MACHINE_A1}', now())`,
  );

  // ── LE COMPTEUR A TOURNÉ, ET C'EST DÉSORMAIS LA CONDITION DE LA CLÔTURE ──
  //
  // D120 : *le compteur du technicien est la seule source du temps.* Une
  // intervention sur laquelle aucun segment n'a tourné ne se clôture plus —
  // le décor doit donc porter un vrai segment, et non une valeur posée à la
  // main. **`temps_mesure_min` est écrit ensuite, et la base VÉRIFIE qu'il
  // vaut la somme des segments** : si ce décor mentait, la ligne suivante
  // serait refusée.
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "segment_travail" ("id","societe_id","intervention_id","utilisateur_id","debut","fin","modifie_le")
     VALUES ('${uuidv7()}', '${SOCIETE_A}', '${id}', '${TECHNICIEN}',
             '${CRENEAU_DEBUT}'::timestamptz,
             '${CRENEAU_DEBUT}'::timestamptz + interval '${TEMPS_REEL_MIN} minutes',
             now())`,
  );
  await clientOwner().$executeRawUnsafe(
    `UPDATE "intervention" SET "temps_mesure_min" = ${TEMPS_REEL_MIN} WHERE "id" = '${id}'`,
  );
  return id;
}

/**
 * LE RATTACHEMENT DU TECHNICIEN À SON AGENCE (L3-01a).
 *
 * *Sans lui, la majoration rend « technicien absent » et le total devient
 * inconnu* — ce qui est le bon comportement, et pas le décor de ces
 * scénarios-ci : ils mesurent le forfait et le mode, pas l'absence de
 * rattachement.
 */
async function poserLeTechnicien(): Promise<void> {
  const id = uuidv7();
  const pose = await clientOwner().$executeRawUnsafe(
    `INSERT INTO "technicien" ("id","societe_id","utilisateur_id","agence_id","modifie_le")
     VALUES ('${id}', '${SOCIETE_A}', '${TECHNICIEN}', '${AGENCE_A}', now())
     ON CONFLICT DO NOTHING`,
  );
  if (pose > 0) {
    techniciensPoses.push(id);
  }
}

afterEach(async () => {
  for (const id of techniciensPoses.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "technicien" WHERE "id" = '${id}'`,
    );
  }
  for (const id of jetables.splice(0)) {
    // LES SEGMENTS D'ABORD, ET C'EST LA TABLE QUI L'EXIGE : `segment_travail`
    // référence l'intervention en `ON DELETE RESTRICT` — *une intervention ne
    // se supprime pas en laissant le temps qu'on y a passé* (D120). Le décor
    // se démonte donc dans l'ordre inverse de son montage.
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = '${id}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${id}'`,
    );
  }
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "forfait" WHERE "code" LIKE 'DEP-%'`,
  );
  for (const id of tauxPoses.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "taux_horaire" WHERE "id" = '${id}'`,
    );
  }
});

describe("le forfait de déplacement entre dans le total (RG-INT-07, D77)", () => {
  it("au temps passé, le montant ÉCRIT vaut la main-d'œuvre PLUS le forfait", async () => {
    await poserLeTaux();
    const forfaitId = await poserUnForfait();
    const id = await interventionAClore("temps_passe", forfaitId);

    const resultat = await cloturerIntervention(
      SESSION,
      { intervention_id: id, temps_valide_min: TEMPS_REEL_MIN },
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
    if (!resultat.accepte) return;

    // 120 minutes au taux horaire, plus le forfait.
    const mainDoeuvre = (TAUX_MINEUR * BigInt(TEMPS_REEL_MIN)) / BigInt(60);
    expect(resultat.fiche.mainDoeuvre?.valeur).toBe(mainDoeuvre);
    expect(resultat.fiche.forfaitDeplacement?.valeur).toBe(FORFAIT_MINEUR);
    expect(resultat.fiche.totalHT?.valeur).toBe(mainDoeuvre + FORFAIT_MINEUR);
    // LE TÉMOIN DU DÉCOR : le créneau tombe entièrement dans l'ouverture, donc
    // la majoration vaut ZÉRO et le total ci-dessus est complet. *Sans cette
    // assertion, un décor devenu hors ouverture ferait échouer le total sans
    // qu'on sache si c'est le forfait ou le supplément qui a bougé.*
    expect(resultat.fiche.majoration?.valeur).toBe(BigInt(0));

    // ET LA BASE PORTE LE MÊME MONTANT. *Un résultat rendu à l'appelant n'est
    // pas un montant figé : c'est la colonne qui sera relue demain.*
    const [enBase] = await clientOwner().$queryRawUnsafe<
      Array<{ montant_ht: bigint | null }>
    >(`SELECT "montant_ht" FROM "intervention" WHERE "id" = '${id}'`);
    expect(enBase?.montant_ht).toBe(mainDoeuvre + FORFAIT_MINEUR);
  });

  it("SANS forfait applicable, le total vaut la main-d'œuvre seule — et c'est un PRIX", async () => {
    // *« En l'absence de forfait applicable, non facturé »* (D11). Le témoin est
    // l'ÉCART avec le scénario ci-dessus : sans lui, une clôture qui ignorerait
    // le forfait passerait celui-ci et échouerait l'autre sans qu'on sache
    // lequel des deux ment.
    await poserLeTaux();
    const id = await interventionAClore("temps_passe", null);

    const resultat = await cloturerIntervention(
      SESSION,
      { intervention_id: id, temps_valide_min: TEMPS_REEL_MIN },
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
    if (!resultat.accepte) return;

    const mainDoeuvre = (TAUX_MINEUR * BigInt(TEMPS_REEL_MIN)) / BigInt(60);
    expect(resultat.fiche.totalHT?.valeur).toBe(mainDoeuvre);
    expect(resultat.fiche.forfaitDeplacement).toBeNull();
    expect(resultat.fiche.motifTotalInconnu).toBeNull();
  });
});

describe("un total inconnu s'écrit NULL, jamais zéro", () => {
  it("au forfait, la clôture n'écrit AUCUN montant — et dit ce qui manque", async () => {
    // *La faute d'origine écrivait `montant_ht = null` mais rendait `0` à
    // l'écran, qui affichait « Total hors taxes : 0 ».* Zéro est une réponse :
    // il dit « cela ne coûte rien » là où il faut lire « je ne sais pas
    // encore », rien ne sélectionnant de forfait de PRESTATION.
    await poserLeTaux();
    const forfaitId = await poserUnForfait();
    const id = await interventionAClore("forfait", forfaitId);

    const resultat = await cloturerIntervention(
      SESSION,
      { intervention_id: id, temps_valide_min: TEMPS_REEL_MIN },
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
    if (!resultat.accepte) return;

    expect(resultat.fiche.totalHT).toBeNull();
    expect(resultat.fiche.motifTotalInconnu).toBe(
      "intervention.total.forfait_de_prestation_absent",
    );
    // Le forfait de déplacement reste LISIBLE : il est connu, le taire aussi
    // ferait perdre une information qu'on a.
    expect(resultat.fiche.forfaitDeplacement?.valeur).toBe(FORFAIT_MINEUR);

    const [enBase] = await clientOwner().$queryRawUnsafe<
      Array<{ montant_ht: bigint | null; devise_code: string | null }>
    >(
      `SELECT "montant_ht", "devise_code" FROM "intervention" WHERE "id" = '${id}'`,
    );
    expect(enBase?.montant_ht).toBeNull();
    // Et ce n'est PAS un zéro déguisé.
    expect(enBase?.montant_ht).not.toBe(BigInt(0));
    expect(enBase?.devise_code).toBeNull();
  });

  it("le MÊME décor au temps passé écrit un montant — le null vient bien du MODE", async () => {
    // Le cas qui doit rester vert POUR SA PROPRE RAISON (§9, 11/09) : sans lui,
    // une clôture qui n'écrirait JAMAIS de montant passerait le scénario
    // ci-dessus.
    await poserLeTaux();
    const forfaitId = await poserUnForfait();
    const id = await interventionAClore("temps_passe", forfaitId);

    await cloturerIntervention(
      SESSION,
      { intervention_id: id, temps_valide_min: TEMPS_REEL_MIN },
      clientApp(),
    );
    const [enBase] = await clientOwner().$queryRawUnsafe<
      Array<{ montant_ht: bigint | null }>
    >(`SELECT "montant_ht" FROM "intervention" WHERE "id" = '${id}'`);
    expect(enBase?.montant_ht).not.toBeNull();
  });
});
