import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  cloturerIntervention,
  lireFicheIntervention,
} from "@/lib/interventions/depot";

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

/**
 * Une intervention prête à clôturer, dans le mode donné.
 *
 * `type` vaut `curatif` par défaut (le témoin facturable de ce fichier) —
 * RG-INT-09/RG-INT-11 l'éprouvent explicitement avec `garantie` et
 * `recensement` (voir plus bas), sans changer aucun appel existant.
 */
async function interventionAClore(
  mode: string,
  forfaitId: string | null,
  creneau: { readonly debut: string; readonly fin: string } = {
    debut: CRENEAU_DEBUT,
    fin: CRENEAU_FIN,
  },
  type: string = "curatif",
): Promise<string> {
  const id = uuidv7();
  jetables.push(id);
  await poserLeTechnicien();
  // INSÉRÉE DIRECTEMENT « TERMINEE » (D160, 9DF-TP-CY2-MATRICE-D8) :
  // `cloturerIntervention` n'accepte plus que ce statut (QT-4, D8 à la
  // lettre) — l'INSERT, hors de toute garde `UPDATE`, pose le FAIT sans
  // emprunter de transition.
  // RAPPORT VALIDÉ POSÉ AU MÊME GESTE (RG-INT-03, D278, 9H1) : ce fichier
  // éprouve la VALORISATION, pas la validation du rapport — posée à part
  // dans `rapport-valide-avant-cloture.test.ts`.
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id","societe_id","client_id","site_id","agence_id",
       "type","statut","mode_valorisation","forfait_deplacement_id",
       "technicien_id","creneau_debut","creneau_fin","rapport_valide_par","rapport_valide_le","modifie_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", '${AGENCE_A}',
            '${type}', 'terminee', '${mode}'::"ModeValorisation",
            ${forfaitId === null ? "NULL" : `'${forfaitId}'`},
            '${TECHNICIEN}', '${creneau.debut}'::timestamptz,
            '${creneau.fin}'::timestamptz, '${TECHNICIEN}', now(), now()
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
    `INSERT INTO "segment_travail" ("id","societe_id","intervention_id","utilisateur_id","nom_technicien_affiche","debut","fin","modifie_le")
     VALUES ('${uuidv7()}', '${SOCIETE_A}', '${id}', '${TECHNICIEN}',
             (SELECT "nom" FROM "utilisateur" WHERE "id" = '${TECHNICIEN}'),
             '${creneau.debut}'::timestamptz,
             '${creneau.debut}'::timestamptz + interval '${TEMPS_REEL_MIN} minutes',
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

/**
 * 9I8A1-REPRISE-9I8A, décision A d'Alexis (31/10/2026) — LA DÉCOMPOSITION
 * EST FIGÉE À LA CLÔTURE, et ne se recalcule JAMAIS pour une intervention
 * déjà close, quel que soit le réglage de société ensuite.
 */
describe("9I8A1-REPRISE-9I8A — la décomposition est FIGÉE à la clôture", () => {
  const REGLE_PAR_DEFAUT_DB = {
    facturation_plancher_min: 60,
    facturation_palier_min: 30,
    facturation_seuil_palier_min: 5,
  };

  afterEach(async () => {
    // Quoi que le scénario ait réglé sur SOCIETE_A, elle ressort au défaut —
    // même discipline que `regle-arrondi-societe.test.ts`.
    await clientOwner().societe.update({
      where: { id: SOCIETE_A },
      data: REGLE_PAR_DEFAUT_DB,
    });
  });

  it("la clôture écrit valorisation_figee, cohérente avec ce qu'elle rend", async () => {
    await poserLeTaux();
    const id = await interventionAClore("temps_passe", null);

    const resultat = await cloturerIntervention(
      SESSION,
      { intervention_id: id, temps_valide_min: TEMPS_REEL_MIN },
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
    if (!resultat.accepte) return;

    const [enBase] = await clientOwner().$queryRawUnsafe<
      Array<{ valorisation_figee: Record<string, unknown> | null }>
    >(`SELECT "valorisation_figee" FROM "intervention" WHERE "id" = '${id}'`);
    expect(enBase?.valorisation_figee).not.toBeNull();
    const figee = enBase?.valorisation_figee;
    expect(figee?.minutesFacturees).toBe(resultat.fiche.minutesFacturees);
    expect(figee?.regle).toEqual({
      plancherMinutes: 60,
      palierMinutes: 30,
      seuilPalierMinutes: 5,
    });
  });

  it("un changement du réglage de société APRÈS clôture ne change RIEN à la fiche déjà close", async () => {
    await poserLeTaux();
    const id = await interventionAClore("temps_passe", null);

    const resultat = await cloturerIntervention(
      SESSION,
      { intervention_id: id, temps_valide_min: TEMPS_REEL_MIN },
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
    if (!resultat.accepte) return;

    // La société change son plancher APRÈS la clôture — bien au-delà des 120
    // minutes réelles de cette intervention (D'où TEMPS_REEL_MIN), pour
    // qu'une différence, si elle apparaissait, soit indiscutable : un
    // recalcul EN DIRECT avec ce nouveau plancher donnerait 150, jamais 120.
    await clientOwner().societe.update({
      where: { id: SOCIETE_A },
      data: { facturation_plancher_min: 150 },
    });

    const fiche = await lireFicheIntervention(SESSION, id, clientApp());
    expect(fiche?.valorisation?.minutesFacturees).toBe(
      resultat.fiche.minutesFacturees,
    );
    expect(fiche?.valorisation?.totalHT?.valeur).toBe(
      resultat.fiche.totalHT?.valeur,
    );
    expect(fiche?.ligne.montant_ht).toBe(resultat.fiche.ligne.montant_ht);
  });

  it("une intervention clôturée SANS décomposition figée (avant cette migration) relit avec la règle HISTORIQUE, jamais le réglage de société", async () => {
    // « Avant cette migration » ne se SIMULE pas en figeant puis en
    // effaçant : une intervention clôturée ne se modifie plus (I5/D160, le
    // déclencheur `intervention_cycle_de_vie` refuse jusqu'au propriétaire).
    // Elle s'INSÈRE directement déjà close, `valorisation_figee` jamais
    // posée — exactement ce qu'une ligne d'avant cette migration porte.
    await poserLeTaux();
    const id = uuidv7();
    jetables.push(id);
    await poserLeTechnicien();
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "intervention" ("id","societe_id","client_id","site_id","agence_id",
         "type","statut","mode_valorisation","technicien_id",
         "temps_valide_min","temps_valide_par","temps_valide_le",
         "rapport_valide_par","rapport_valide_le","cloturee_le","modifie_le")
       SELECT '${id}', "societe_id", "client_id", "site_id", '${AGENCE_A}',
              'curatif', 'cloturee', 'temps_passe'::"ModeValorisation",
              '${TECHNICIEN}', ${TEMPS_REEL_MIN}, '${TECHNICIEN}', now(),
              NULL, now(), now(), now()
         FROM "intervention" WHERE "statut" = 'planifiee' AND "societe_id" = '${SOCIETE_A}' LIMIT 1`,
    );

    // Un réglage de société TRÈS différent de l'historique (60/15/1) : si la
    // fiche le lisait par erreur, le résultat vaudrait 200, pas 120.
    await clientOwner().societe.update({
      where: { id: SOCIETE_A },
      data: {
        facturation_plancher_min: 200,
        facturation_palier_min: 10,
        facturation_seuil_palier_min: 1,
      },
    });

    const fiche = await lireFicheIntervention(SESSION, id, clientApp());
    // 120 minutes, règle HISTORIQUE (60/15/1) : ceil(120/15)×15 = 120,
    // max(120, 60) = 120 — inchangé depuis toujours pour ce cas.
    expect(fiche?.valorisation?.minutesFacturees).toBe(120);
    expect(fiche?.valorisation?.regle).toEqual({
      plancherMinutes: 60,
      palierMinutes: 15,
      seuilPalierMinutes: 1,
    });
  });
});

/**
 * LE POURCENTAGE DE MAJORATION EST CELUI RÉGLÉ PAR LA SOCIÉTÉ (RG-INT-08,
 * décision d'Alexis du 10/11/2026) — plus de +50 % en dur. Même doctrine de
 * figeage que 9I8A1-REPRISE-9I8A ci-dessus : le pourcentage qui a servi à
 * la clôture ne bouge plus, quel que soit le réglage de société ensuite.
 */
describe("RG-INT-08 — le pourcentage de majoration est RÉGLÉ PAR LA SOCIÉTÉ, et FIGÉ à la clôture", () => {
  /**
   * UN CRÉNEAU ENTIÈREMENT HORS OUVERTURE, le même lundi que `CRENEAU_DEBUT`
   * ci-dessus mais l'après-midi — `CALENDRIER_A` n'ouvre que 8 h – 12 h. Toute
   * la main-d'œuvre tombe donc dans l'assiette (D108), ce qui rend le
   * pourcentage directement lisible sur le supplément.
   */
  const CRENEAU_HORS_OUVERTURE = {
    debut: "2026-09-14T14:00:00+11:00",
    fin: "2026-09-14T16:00:00+11:00",
  };

  afterEach(async () => {
    // Quoi que le scénario ait réglé sur SOCIETE_A, elle ressort au défaut du
    // harnais (`tests/isolation/setup/global.ts`) — même discipline que le
    // bloc 9I8A1-REPRISE-9I8A ci-dessus pour `facturation_plancher_min`.
    await clientOwner().societe.update({
      where: { id: SOCIETE_A },
      data: { majoration_hors_ouverture_pct: "50" },
    });
  });

  it("une société à 25 % — le supplément vaut le quart de la main-d'œuvre, jamais la moitié de D12", async () => {
    await poserLeTaux();
    await clientOwner().societe.update({
      where: { id: SOCIETE_A },
      data: { majoration_hors_ouverture_pct: "25.00" },
    });
    const id = await interventionAClore(
      "temps_passe",
      null,
      CRENEAU_HORS_OUVERTURE,
    );

    const resultat = await cloturerIntervention(
      SESSION,
      { intervention_id: id, temps_valide_min: TEMPS_REEL_MIN },
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
    if (!resultat.accepte) return;

    const mainDoeuvre = (TAUX_MINEUR * BigInt(TEMPS_REEL_MIN)) / BigInt(60);
    // Créneau ENTIÈREMENT hors ouverture : l'assiette est la main-d'œuvre
    // entière, et 25 % de celle-ci est directement le supplément.
    expect(resultat.fiche.majoration?.valeur).toBe(mainDoeuvre / BigInt(4));
  });

  it("une intervention close À 25 % garde son montant quand la société passe ensuite à 60 % (aucune donnée de production ni montant deviné)", async () => {
    await poserLeTaux();
    await clientOwner().societe.update({
      where: { id: SOCIETE_A },
      data: { majoration_hors_ouverture_pct: "25.00" },
    });
    const id = await interventionAClore(
      "temps_passe",
      null,
      CRENEAU_HORS_OUVERTURE,
    );
    const resultat = await cloturerIntervention(
      SESSION,
      { intervention_id: id, temps_valide_min: TEMPS_REEL_MIN },
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
    if (!resultat.accepte) return;
    const majorationFigee = resultat.fiche.majoration?.valeur;

    // La société change son réglage BIEN APRÈS la clôture — à 60 %, très
    // loin des 25 % qui ont servi à facturer : si la fiche recalculait en
    // direct, le supplément passerait de 4 500 à 10 800.
    await clientOwner().societe.update({
      where: { id: SOCIETE_A },
      data: { majoration_hors_ouverture_pct: "60.00" },
    });

    const fiche = await lireFicheIntervention(SESSION, id, clientApp());
    expect(fiche?.valorisation?.majoration?.valeur).toBe(majorationFigee);
    expect(fiche?.ligne.montant_ht).toBe(resultat.fiche.ligne.montant_ht);
  });
});

/**
 * RG-INT-09, RG-INT-11 (décision d'Alexis du 10/11/2026) — UNE GARANTIE OU
 * UN RECENSEMENT NE GÉNÈRE AUCUN MONTANT CLIENT. Mesuré sur `81894e0` : ces
 * deux types valorisaient et écrivaient un total comme n'importe quel autre
 * — le même décor que ci-dessus (taux, forfait, créneau dans l'ouverture)
 * suffit à le prouver puisqu'il PRODUIRAIT un total non nul pour un témoin
 * facturable.
 */
describe("garantie et recensement n'écrivent jamais de montant client (RG-INT-09, RG-INT-11)", () => {
  it.each(["garantie", "recensement"] as const)(
    "une clôture %s écrit montant_ht et devise_code à NULL",
    async (type) => {
      await poserLeTaux();
      const forfaitId = await poserUnForfait();
      const id = await interventionAClore(
        "temps_passe",
        forfaitId,
        undefined,
        type,
      );

      const resultat = await cloturerIntervention(
        SESSION,
        { intervention_id: id, temps_valide_min: TEMPS_REEL_MIN },
        clientApp(),
      );
      expect(resultat.accepte).toBe(true);
      if (!resultat.accepte) return;

      expect(resultat.fiche.ligne.montant_ht).toBeNull();
      expect(resultat.fiche.ligne.devise_code).toBeNull();

      // La fiche relue ensuite confirme ce qui a été ÉCRIT en base, jamais
      // un recalcul qui diffèrerait de ce que la clôture a réellement posé.
      const fiche = await lireFicheIntervention(SESSION, id, clientApp());
      expect(fiche?.ligne.montant_ht).toBeNull();
      expect(fiche?.ligne.devise_code).toBeNull();
    },
  );

  it("un témoin curatif, même décor, écrit bien un montant non nul", async () => {
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

    expect(resultat.fiche.ligne.montant_ht).not.toBeNull();
    expect(resultat.fiche.ligne.devise_code).toBe(DEVISE);
  });
});
