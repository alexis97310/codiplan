import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { type FeuilleLue } from "@/lib/excel/classeur";
import { controlerFeuille } from "@/lib/excel/controle";
import {
  annulerLeLotDeModeles,
  annulerLeLotDeSites,
} from "@/lib/imports/annulation";
import {
  appliquerLeLotDeClients,
  appliquerLeLotDeModeles,
  appliquerLeLotDePrestations,
  appliquerLeLotDeSites,
} from "@/lib/imports/application";
import { enregistrerLeControle, typeDuLot } from "@/lib/imports/depot";
import {
  gabaritDuMarqueur,
  marqueurDu,
  type ParcsDImport,
} from "@/lib/imports/modeles";
import { indexerLesAgences } from "@/lib/imports/parc-agences";
import { indexerLesFamilles } from "@/lib/imports/parc-familles";
import { indexerLeParcClients } from "@/lib/imports/parc-clients";
import {
  PARC_VIDE,
  indexerLeParcCible,
  indexerLeParcModeles,
  indexerLeParcSites,
} from "@/lib/imports/parc-cibles";
import { applicationDuType } from "@/lib/imports/types-dimport";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { SOCIETE_A, SOCIETE_B, UTILISATEUR_INTERNE_A } from "./setup/fixtures";

/**
 * LES QUATRE TYPES QU'UN LOT SAIT DEVENIR (R6-01 ; I6, RG-IMP-05, D15).
 *
 * **C'est l'appelant de la chaîne ENTIÈRE**, pour les trois types que R6-01
 * ajoute : feuille → choix du gabarit par le MARQUEUR → contrôle contre le parc
 * de la CIBLE → lot en base → application → fiches réellement écrites →
 * annulation. *Une suite qui éprouve tous les maillons n'éprouve pas la chaîne*
 * (§9, 08/09).
 *
 * Tout passe par le chemin de PRODUCTION, sous le rôle applicatif restreint et
 * sous les politiques : aucun raccourci, aucune écriture posée en SQL.
 */

/**
 * **CE FICHIER REND LE SEMIS TEL QU'IL L'A TROUVÉ, et ce n'est pas une
 * politesse.** Le harnais d'isolation ne recrée pas la base entre deux
 * fichiers : *une fiche laissée derrière soi devient une ligne de plus dans le
 * décompte d'un autre scénario*, et celui-là échoue pour une raison qui n'est
 * pas la sienne — mesuré le 16/09/2026, onze scénarios rouges dans sept
 * fichiers, tous étrangers à l'import.
 *
 * Tout ce que ce fichier crée porte donc le préfixe `R6-`, et rien d'autre
 * n'est supprimé : *un nettoyage qui effacerait plus que ce qu'il a posé serait
 * la même faute, dans l'autre sens.*
 */
async function nettoyer(): Promise<void> {
  const owner = clientOwner();
  await owner.$executeRawUnsafe(
    `DELETE FROM "contact" WHERE "societe_id" = '${SOCIETE_A}' AND "nom" LIKE 'R6-%'`,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "site" WHERE "societe_id" = '${SOCIETE_A}' AND "libelle" LIKE 'R6-%'`,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "modele_materiel" WHERE "societe_id" = '${SOCIETE_A}' AND "reference" LIKE 'R6-%'`,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "prestation" WHERE "societe_id" = '${SOCIETE_A}' AND "code" LIKE 'R6-%'`,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "import_lot" WHERE "societe_id" = '${SOCIETE_A}' AND "nom_fichier" LIKE 'R6-%'`,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "agence" WHERE "societe_id" = '${SOCIETE_A}' AND "code" = 'R6KO'`,
  );
}

afterAll(async () => {
  await nettoyer();
  await fermerClients();
});

const SESSION = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const SESSION_B = { ...SESSION, societeId: SOCIETE_B };

async function parcs(): Promise<ParcsDImport> {
  return {
    clients: await indexerLeParcClients(SESSION, clientApp()),
    agences: await indexerLesAgences(SESSION, clientApp()),
    familles: await indexerLesFamilles(SESSION, clientApp()),
    // Les deux parents qu'un équipement désigne (R6-03) : ce fichier n'en
    // dépose aucun, et les passer garde l'appel fidèle à la route.
    sites: await indexerLeParcSites(SESSION, clientApp()),
    modeles: await indexerLeParcModeles(SESSION, clientApp()),
  };
}

/**
 * LE CHEMIN DE LA ROUTE DE CONTRÔLE, REJOUÉ (R6-01).
 *
 * **Le gabarit est choisi par le MARQUEUR, et le parc par le TYPE du gabarit**
 * — exactement comme `app/api/imports/controler/route.ts`. *Choisir le gabarit
 * ici à la main ferait éprouver une chaîne que personne n'emprunte*, et c'est
 * précisément la sélection que ce ticket ajoute.
 */
async function deposer(
  type: string,
  lignes: readonly (readonly string[])[],
): Promise<{ lotId: string; creations: number; modifications: number }> {
  const p = await parcs();
  const modele = gabaritDuMarqueur({ texte: `CODIPLAN-${type}-v1` }, p);
  if (modele === null) throw new Error(`aucun gabarit pour « ${type} »`);

  const feuille: FeuilleLue = {
    nom: type,
    lignes: [
      [{ texte: marqueurDu(modele) }],
      modele.colonnes.map((colonne) => ({ texte: colonne.nom })),
      ...lignes.map((ligne) => ligne.map((valeur) => ({ texte: valeur }))),
    ],
  };

  const parc =
    (await indexerLeParcCible(SESSION, modele.type, clientApp())) ?? PARC_VIDE;
  const controle = controlerFeuille(feuille, modele, parc);
  if (!controle.lisible) {
    throw new Error(
      `feuille illisible : ${JSON.stringify(controle.anomalies)}`,
    );
  }
  const { lotId } = await enregistrerLeControle(
    SESSION,
    { nom: `R6-${type}.xlsx`, type: modele.type, version: modele.version },
    controle.lignes,
    clientApp(),
  );
  return {
    lotId,
    creations: controle.lignes.filter((l) => l.action === "creation").length,
    modifications: controle.lignes.filter((l) => l.action === "modification")
      .length,
  };
}

async function compter(table: string, ou: string): Promise<number> {
  const [r] = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT count(*) AS n FROM "${table}" WHERE "societe_id" = '${SOCIETE_A}' AND ${ou}`,
  );
  return Number(r.n);
}

/* ════════════════════════════════════════════════════════════════════════
 * LES SITES
 * ════════════════════════════════════════════════════════════════════════ */

describe("un lot de SITES écrit des sites, et ses DEUX parents sont résolus", () => {
  it("traverse, et le site existe RÉELLEMENT en base", async () => {
    // LE TÉMOIN : il n'existe pas AVANT. *Sans lui, un site déjà présent ferait
    // passer l'application pour réussie sans qu'elle ait rien écrit* (§9, 30/08).
    expect(await compter("site", `"libelle" = 'R6-atelier'`)).toBe(0);

    const { lotId, creations } = await deposer("sites", [
      [
        "C-001",
        "DUCOS",
        "R6-atelier",
        "12 rue de la mesure",
        "Nouméa",
        "grand_noumea",
        "",
        "",
      ],
    ]);
    expect(creations).toBe(1);

    const resultat = await appliquerLeLotDeSites(SESSION, lotId, clientApp());
    expect(resultat.applique).toBe(true);
    if (!resultat.applique) return;
    expect(resultat.creations).toBe(1);

    const [site] = await clientOwner().$queryRawUnsafe<
      Array<{
        id: string;
        client_id: string;
        agence_id: string;
        commune: string;
      }>
    >(
      `SELECT "id", "client_id", "agence_id", "commune" FROM "site"
        WHERE "societe_id" = '${SOCIETE_A}' AND "libelle" = 'R6-atelier'`,
    );
    expect(site).toBeDefined();
    // **Les deux parents ont été RÉSOLUS**, l'un par son code externe, l'autre
    // par son code d'agence — et aucun des deux n'était dans une colonne
    // d'identifiant.
    expect(site.client_id).toBe("aaaaaaaa-0000-7000-8000-0000000000c1");
    expect(site.agence_id).toBe("aaaaaaaa-0000-7000-8000-0000000000e1");
    expect(site.commune).toBe("Nouméa");

    // LA LIGNE porte ce qu'elle a produit — et l'entité n'est plus « client » en
    // dur : c'est ce que l'annulation lira pour savoir quelle table restaurer.
    const [ligne] = await clientOwner().$queryRawUnsafe<
      Array<{ entite: string; entite_id: string }>
    >(
      `SELECT l."entite", l."entite_id" FROM "import_lot_ligne" l
        WHERE l."import_lot_id" = '${lotId}' AND l."entite_id" IS NOT NULL`,
    );
    expect(ligne.entite).toBe("site");
    expect(ligne.entite_id).toBe(site.id);
  });

  it("LE MÊME FICHIER REDÉPOSÉ est une MODIFICATION, jamais un doublon", async () => {
    // **C'est la mesure qui justifie `parc-cibles.ts`.** Avant R6-01, le parc
    // passé au contrôle était celui des CLIENTS quel que soit le type : la clé
    // `SITE-…` ne s'y trouvait jamais, *toute ligne ressortait en création*, et
    // un second dépôt du même fichier aurait fait un doublon par ligne —
    // exactement ce que RG-IMP-05 interdit.
    const { creations, modifications } = await deposer("sites", [
      [
        "C-001",
        "DUCOS",
        "R6-atelier",
        "12 rue de la mesure",
        "Nouméa",
        "grand_noumea",
        "",
        "",
      ],
    ]);
    expect(creations).toBe(0);
    expect(modifications).toBe(1);
    // ET LE TÉMOIN : il n'y en a toujours qu'un en base.
    expect(await compter("site", `"libelle" = 'R6-atelier'`)).toBe(1);
  });

  it("UNE MODIFICATION EST RÉELLEMENT ÉCRITE — et la première rédaction levait", async () => {
    // **CE SCÉNARIO COMBLE LE TROU QUI A LAISSÉ PASSER UN DÉFAUT.** Le scénario
    // d'idempotence ci-dessus lit le RAPPORT (0 création, 1 modification) et
    // s'arrête là : *il n'applique pas*. La première rédaction de
    // `appliquerLeLotDeSites` passait les deux parents à
    // `schemaModificationSite`, qui est `.strict()` — **toute modification
    // levait**, et le lot entier était perdu. Rien ne l'a dit avant une mesure.
    //
    // *C'est la leçon du 08/09 : une suite qui éprouve tous les maillons
    // n'éprouve pas la chaîne* — ici le maillon manquant était « appliquer une
    // MODIFICATION », entre le rapport et la base.
    const { lotId, modifications } = await deposer("sites", [
      [
        "C-001",
        "DUCOS",
        "R6-atelier",
        "12 rue de la mesure",
        "Koné",
        "nord",
        "Sonner au portail",
        "",
      ],
    ]);
    expect(modifications).toBe(1);

    const resultat = await appliquerLeLotDeSites(SESSION, lotId, clientApp());
    expect(resultat.applique).toBe(true);
    if (!resultat.applique) return;
    expect(resultat.modifications).toBe(1);

    const [site] = await clientOwner().$queryRawUnsafe<
      Array<{ commune: string; zone_geo: string; consignes_acces: string }>
    >(
      `SELECT "commune", "zone_geo", "consignes_acces" FROM "site"
        WHERE "societe_id" = '${SOCIETE_A}' AND "libelle" = 'R6-atelier'`,
    );
    expect(site.commune).toBe("Koné");
    expect(site.zone_geo).toBe("nord");
    expect(site.consignes_acces).toBe("Sonner au portail");
    // ET LE TÉMOIN : toujours un seul site, jamais un doublon.
    expect(await compter("site", `"libelle" = 'R6-atelier'`)).toBe(1);
  });

  it("UN IMPORT NE DÉPLACE PAS un site d'une agence à l'autre (D56)", async () => {
    // **Ce scénario garde une LIMITE, pas un verrou.** Le gabarit n'expose pas
    // « Temps de trajet » (`CHAMPS_SITES_ECARTES`, L1-09), et D56 refuse de
    // changer l'agence sans revoir ce nombre : *on n'exige pas qu'on mesure, on
    // exige qu'on DÉCIDE*, et un fichier ne décide pas.
    //
    // *Ce qui serait arrivé en passant `agence_id` quand même est mesuré* : le
    // `superRefine` de `schemaModificationSite` lève, et la levée emporte le
    // LOT ENTIER — une ligne d'agence mal remplie ferait perdre trois cents
    // fiches. **Ne pas le passer est donc le sens de défaillance choisi**, et
    // il est écrit là plutôt qu'observé un jour par surprise.
    // UNE SECONDE AGENCE chez A — sans elle, le scénario nommerait la même et
    // ne mesurerait rien. *Un décompte nul ressemble toujours à un sans-faute*
    // (§9, 30/08), et une agence inchangée ressemble à une agence qui ne bouge
    // pas parce qu'on le lui a demandé.
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "agence" ("id","societe_id","code","libelle","fuseau_horaire","territoire")
       VALUES ('aaaaaaaa-0000-7000-8000-0000000000e9','${SOCIETE_A}','R6KO','R6 Koné','Pacific/Noumea','NC')
       ON CONFLICT DO NOTHING`,
    );
    const [agence] = await clientOwner().$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "agence" WHERE "societe_id" = '${SOCIETE_A}' AND "code" = 'DUCOS'`,
    );

    // LE TÉMOIN : le site est bien rattaché à DUCOS avant, et la ligne nomme
    // R6KO — il y a donc réellement un déplacement à refuser.
    const [avant] = await clientOwner().$queryRawUnsafe<
      Array<{ agence_id: string }>
    >(
      `SELECT "agence_id" FROM "site"
        WHERE "societe_id" = '${SOCIETE_A}' AND "libelle" = 'R6-atelier'`,
    );
    expect(avant.agence_id).toBe(agence.id);

    const { lotId, modifications } = await deposer("sites", [
      ["C-001", "R6KO", "R6-atelier", "", "Nouméa", "grand_noumea", "", ""],
    ]);
    expect(modifications).toBe(1);
    const resultat = await appliquerLeLotDeSites(SESSION, lotId, clientApp());
    expect(resultat.applique).toBe(true);

    const [site] = await clientOwner().$queryRawUnsafe<
      Array<{ agence_id: string; commune: string }>
    >(
      `SELECT "agence_id", "commune" FROM "site"
        WHERE "societe_id" = '${SOCIETE_A}' AND "libelle" = 'R6-atelier'`,
    );
    // L'agence n'a pas bougé — et les AUTRES colonnes, elles, sont à jour :
    // *la ligne n'est pas ignorée, c'est le rattachement qui ne suit pas.*
    expect(site.agence_id).toBe(agence.id);
    expect(site.commune).toBe("Nouméa");
  });

  it("un parent INTROUVABLE est un rejet, et il ne bloque pas les autres", async () => {
    const { lotId, creations } = await deposer("sites", [
      ["C-001", "DUCOS", "R6-atelier-bis", "", "", "", "", ""],
      ["C-INEXISTANT", "DUCOS", "R6-atelier-fantome", "", "", "", "", ""],
      [
        "C-001",
        "AGENCE-INEXISTANTE",
        "R6-atelier-sans-agence",
        "",
        "",
        "",
        "",
        "",
      ],
    ]);
    expect(creations).toBe(1);

    const resultat = await appliquerLeLotDeSites(SESSION, lotId, clientApp());
    expect(resultat.applique).toBe(true);
    if (!resultat.applique) return;
    expect(resultat.creations).toBe(1);
    expect(await compter("site", `"libelle" = 'R6-atelier-fantome'`)).toBe(0);
    expect(await compter("site", `"libelle" = 'R6-atelier-sans-agence'`)).toBe(
      0,
    );
  });

  it("DEUX sites de même clé rendent la ligne AMBIGUË, donc rejetée", async () => {
    // **`site` n'a AUCUN index unique sur (client, libellé)** — mesuré le
    // 16/09/2026 dans `pg_indexes`. Deux fiches peuvent donc rendre la même
    // clé, et *l'ambiguïté est un fait du parc, jamais du fichier* (L1-08g) :
    // RG-IMP-05 veut alors un REJET, jamais une création qui ferait un
    // troisième doublon, ni une modification au hasard de l'ordre de lecture.
    const libelle = "R6-atelier-en-double";
    for (let i = 0; i < 2; i += 1) {
      await clientOwner().$executeRawUnsafe(
        `INSERT INTO "site" ("id","societe_id","client_id","agence_id","libelle")
         VALUES (gen_random_uuid(), '${SOCIETE_A}',
                 'aaaaaaaa-0000-7000-8000-0000000000c1',
                 'aaaaaaaa-0000-7000-8000-0000000000e1', '${libelle}')`,
      );
    }

    const { lotId, creations, modifications } = await deposer("sites", [
      ["C-001", "DUCOS", libelle, "", "Nouméa", "", "", ""],
    ]);
    expect(creations).toBe(0);
    expect(modifications).toBe(0);

    const [ligne] = await clientOwner().$queryRawUnsafe<
      Array<{ action: string; rejet_motif: string | null }>
    >(
      `SELECT "action", "rejet_motif" FROM "import_lot_ligne"
        WHERE "import_lot_id" = '${lotId}' AND "rang" = 3`,
    );
    expect(ligne.action).toBe("rejet");
    expect(ligne.rejet_motif).toBe("cle_ambigue");
    // LE TÉMOIN : les deux fiches sont intactes — rien n'a été écrasé.
    expect(await compter("site", `"libelle" = '${libelle}'`)).toBe(2);
  });

  it("l'annulation SUPPRIME ce que le lot avait créé", async () => {
    const { lotId } = await deposer("sites", [
      ["C-001", "DUCOS", "R6-atelier-a-defaire", "", "", "", "", ""],
    ]);
    await appliquerLeLotDeSites(SESSION, lotId, clientApp());
    expect(await compter("site", `"libelle" = 'R6-atelier-a-defaire'`)).toBe(1);

    const annule = await annulerLeLotDeSites(SESSION, lotId, clientApp());
    expect(annule.annule).toBe(true);
    if (!annule.annule) return;
    expect(annule.lignes.every((l) => l.defaite)).toBe(true);
    expect(await compter("site", `"libelle" = 'R6-atelier-a-defaire'`)).toBe(0);
  });

  it("l'annulation d'une MODIFICATION ne bute pas sur une agence que l'import n'a pas écrite", async () => {
    // **CE SCÉNARIO GARDE UN DÉFAUT QU'UNE RELECTURE A ATTRAPÉ, ET QUI N'AVAIT
    // AUCUN TEST.** L'annulation comparait les DEUX PARENTS pour toute ligne,
    // création comme modification. Or l'application n'écrit aucun des deux sur
    // une modification (D56) : *la comparaison aurait rendu « modifiée depuis »
    // sur un lot parfaitement défaisable*, et le motif aurait désigné un
    // coupable qui n'existe pas.
    //
    // *La population comparée suit donc l'ACTION* — c'est la règle de
    // `porteEncore` depuis L1-08j, inchangée : *l'import n'a pas écrit le
    // reste, il n'a rien à en dire.*
    const { lotId: pose } = await deposer("sites", [
      [
        "C-001",
        "DUCOS",
        "R6-atelier-defaisable",
        "",
        "Nouméa",
        "grand_noumea",
        "",
        "",
      ],
    ]);
    await appliquerLeLotDeSites(SESSION, pose, clientApp());

    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "agence" ("id","societe_id","code","libelle","fuseau_horaire","territoire")
       VALUES ('aaaaaaaa-0000-7000-8000-0000000000e9','${SOCIETE_A}','R6KO','R6 Koné','Pacific/Noumea','NC')
       ON CONFLICT DO NOTHING`,
    );
    // La ligne nomme une AUTRE agence — que l'application n'écrira pas.
    const { lotId, modifications } = await deposer("sites", [
      ["C-001", "R6KO", "R6-atelier-defaisable", "", "Koné", "nord", "", ""],
    ]);
    expect(modifications).toBe(1);
    await appliquerLeLotDeSites(SESSION, lotId, clientApp());

    const annule = await annulerLeLotDeSites(SESSION, lotId, clientApp());
    expect(annule.annule).toBe(true);
    if (!annule.annule) return;
    // **DÉFAITE, et non refusée** : l'agence du fichier n'entre pas dans la
    // comparaison, parce que l'import ne l'a pas écrite.
    expect(annule.lignes[0]?.motif).toBeUndefined();
    expect(annule.lignes[0]?.defaite).toBe(true);

    const [site] = await clientOwner().$queryRawUnsafe<
      Array<{ commune: string | null; zone_geo: string | null }>
    >(
      `SELECT "commune", "zone_geo" FROM "site"
        WHERE "societe_id" = '${SOCIETE_A}' AND "libelle" = 'R6-atelier-defaisable'`,
    );
    // `valeurs_avant` a été lue AVANT d'écrire (D15) : la fiche est rendue.
    expect(site.commune).toBe("Nouméa");
    expect(site.zone_geo).toBe("grand_noumea");
  });

  it("un site RÉFÉRENCÉ DEPUIS est refusé, jamais supprimé en cascade", async () => {
    const { lotId } = await deposer("sites", [
      ["C-001", "DUCOS", "R6-atelier-retenu", "", "", "", "", ""],
    ]);
    await appliquerLeLotDeSites(SESSION, lotId, clientApp());
    const [site] = await clientOwner().$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "site" WHERE "societe_id" = '${SOCIETE_A}' AND "libelle" = 'R6-atelier-retenu'`,
    );
    // Un contact s'y accroche — c'est l'une des six relations inverses.
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "contact" ("id","societe_id","client_id","site_id","nom","roles","canaux","email")
       VALUES (gen_random_uuid(), '${SOCIETE_A}', 'aaaaaaaa-0000-7000-8000-0000000000c1',
               '${site.id}', 'R6-retenu', ARRAY['comptabilite'], ARRAY['email'], 'retenu@a1.test')`,
    );

    const annule = await annulerLeLotDeSites(SESSION, lotId, clientApp());
    expect(annule.annule).toBe(true);
    if (!annule.annule) return;
    expect(annule.lignes[0]?.defaite).toBe(false);
    expect(annule.lignes[0]?.motif).toBe("referencee_depuis");
    // **JAMAIS DE SUPPRESSION EN CASCADE** (I6) : le site et son contact sont là.
    expect(await compter("site", `"libelle" = 'R6-atelier-retenu'`)).toBe(1);
  });
});

/* ════════════════════════════════════════════════════════════════════════
 * LES MODÈLES ET LES PRESTATIONS
 * ════════════════════════════════════════════════════════════════════════ */

describe("un lot de MODÈLES écrit des modèles, sans toucher aux colonnes de VGP", () => {
  it("traverse, et le modèle existe RÉELLEMENT en base", async () => {
    expect(await compter("modele_materiel", `"reference" = 'R6-XYZ'`)).toBe(0);

    const { lotId } = await deposer("modeles", [
      ["COMP", "MarqueR6", "R6-XYZ", "180", ""],
    ]);
    const resultat = await appliquerLeLotDeModeles(SESSION, lotId, clientApp());
    expect(resultat.applique).toBe(true);
    if (!resultat.applique) return;
    expect(resultat.creations).toBe(1);

    const [modele] = await clientOwner().$queryRawUnsafe<
      Array<{
        famille_id: string;
        periodicite_jours: number | null;
        vgp_periodicite_mois: number | null;
        vgp_reference_texte: string | null;
      }>
    >(
      `SELECT "famille_id", "periodicite_jours", "vgp_periodicite_mois", "vgp_reference_texte"
         FROM "modele_materiel"
        WHERE "societe_id" = '${SOCIETE_A}' AND "reference" = 'R6-XYZ'`,
    );
    expect(modele.famille_id).toBe("aaaaaaaa-0000-7000-8000-0000000000f0");
    // L'ENTRETIEN du constructeur est écrit…
    expect(modele.periodicite_jours).toBe(180);
    // …et la périodicité RÉGLEMENTAIRE ne l'est PAS (L9-03, L9-04, L9-06).
    // *Les mêler ferait facturer un entretien pour une vérification légale.*
    expect(modele.vgp_periodicite_mois).toBeNull();
    expect(modele.vgp_reference_texte).toBeNull();
  });

  it("LE MÊME FICHIER REDÉPOSÉ est une MODIFICATION, jamais un doublon", async () => {
    const { creations, modifications } = await deposer("modeles", [
      ["COMP", "MarqueR6", "R6-XYZ", "200", ""],
    ]);
    expect(creations).toBe(0);
    expect(modifications).toBe(1);
  });

  it("l'annulation REND le modèle à ce qu'il portait", async () => {
    const { lotId } = await deposer("modeles", [
      ["COMP", "MarqueR6", "R6-XYZ", "365", ""],
    ]);
    await appliquerLeLotDeModeles(SESSION, lotId, clientApp());
    const lire = async () => {
      const [m] = await clientOwner().$queryRawUnsafe<
        Array<{ periodicite_jours: number | null }>
      >(
        `SELECT "periodicite_jours" FROM "modele_materiel"
          WHERE "societe_id" = '${SOCIETE_A}' AND "reference" = 'R6-XYZ'`,
      );
      return m.periodicite_jours;
    };
    expect(await lire()).toBe(365);

    const annule = await annulerLeLotDeModeles(SESSION, lotId, clientApp());
    expect(annule.annule).toBe(true);
    // `valeurs_avant` a été lue AVANT d'écrire (D15) : elle porte 180.
    expect(await lire()).toBe(180);
  });
});

describe("un lot de PRESTATIONS écrit des prestations, et AUCUN montant", () => {
  it("traverse, et la famille FACULTATIVE se distingue de l'introuvable", async () => {
    const { lotId, creations } = await deposer("prestations", [
      ["R6-A", "Prestation sans famille", "", "60", ""],
      ["R6-B", "Prestation avec famille", "COMP", "90", ""],
      ["R6-C", "Prestation famille inconnue", "PAS-UNE-FAMILLE", "30", ""],
    ]);
    // **VIDE n'est pas INTROUVABLE** : la première passe, la troisième est
    // rejetée. *Confondre les deux ferait rejeter la moitié d'un catalogue.*
    expect(creations).toBe(2);

    const resultat = await appliquerLeLotDePrestations(
      SESSION,
      lotId,
      clientApp(),
    );
    expect(resultat.applique).toBe(true);
    if (!resultat.applique) return;
    expect(resultat.creations).toBe(2);

    const [sans] = await clientOwner().$queryRawUnsafe<
      Array<{ famille_id: string | null; duree_standard_min: number | null }>
    >(
      `SELECT "famille_id", "duree_standard_min" FROM "prestation"
        WHERE "societe_id" = '${SOCIETE_A}' AND "code" = 'R6-A'`,
    );
    expect(sans.famille_id).toBeNull();
    expect(sans.duree_standard_min).toBe(60);
    expect(await compter("prestation", `"code" = 'R6-C'`)).toBe(0);
  });
});

/* ════════════════════════════════════════════════════════════════════════
 * CE QUE LE MAUVAIS AIGUILLAGE FAISAIT — MESURÉ, PUIS FERMÉ
 * ════════════════════════════════════════════════════════════════════════ */

describe("le type du lot décide, et rien d'autre", () => {
  it("un lot d'une AUTRE société n'a pas de type — donc aucune application", async () => {
    const { lotId } = await deposer("sites", [
      ["C-001", "DUCOS", "R6-atelier-cloisonne", "", "", "", "", ""],
    ]);
    // Sous la société B, le lot de A est INTROUVABLE. *Les distinguer ferait un
    // oracle* (D35, D50) — et c'est le même `null` qu'un identifiant inventé.
    expect(await typeDuLot(SESSION_B, lotId, clientApp())).toBeNull();
    expect(
      await typeDuLot(
        SESSION_B,
        "aaaaaaaa-0000-7000-8000-00000000dead",
        clientApp(),
      ),
    ).toBeNull();
    // LE TÉMOIN : sous SA société, il en a bien un — sans quoi les deux `null`
    // ci-dessus ne diraient rien du cloisonnement.
    expect(await typeDuLot(SESSION, lotId, clientApp())).toBe("sites");
  });

  it("l'aiguillage rend l'application DU TYPE, et `null` pour les contacts", async () => {
    const { lotId } = await deposer("sites", [
      ["C-001", "DUCOS", "R6-atelier-aiguille", "", "", "", "", ""],
    ]);
    const type = await typeDuLot(SESSION, lotId, clientApp());
    expect(type).toBe("sites");
    expect(applicationDuType(type as string)?.appliquer).toBe(
      appliquerLeLotDeSites,
    );
    // **Les contacts n'ont pas de dépôt** (`SANS_APPLICATION`) : la route ne
    // trouve rien à appeler, et l'écran ne montre pas le bouton.
    expect(applicationDuType("contacts")).toBeNull();
  });

  it("LE DÉFAUT MESURÉ le 16/09/2026 : un lot de sites confié aux CLIENTS", async () => {
    // **Ce scénario ne garde pas une réparation : il garde la MESURE.** La route
    // appelait `appliquerLeLotDeClients` sans lire `type_import`, et les deux
    // branches ne se ressemblaient pas — c'est la seconde qui coûtait.
    const creation = await deposer("sites", [
      ["C-001", "DUCOS", "R6-atelier-confie", "", "", "", "", ""],
    ]);
    // Sur des CRÉATIONS : `schemaCreationClient` LÈVE, la transaction est
    // annulée, rien n'est écrit, le lot reste `controle`. Un désagrément.
    await expect(
      appliquerLeLotDeClients(SESSION, creation.lotId, clientApp()),
    ).rejects.toThrow();
    const [apres] = await clientOwner().$queryRawUnsafe<
      Array<{ statut: string }>
    >(`SELECT "statut" FROM "import_lot" WHERE "id" = '${creation.lotId}'`);
    expect(apres.statut).toBe("controle");

    // Sur des MODIFICATIONS : **aucune levée**. Le lot passe à `applique` en
    // n'ayant rien écrit — *le silence a exactement la forme du succès* (§9,
    // 31/08), et le lot est BRÛLÉ : le cliquet ne se rouvre pas.
    await appliquerLeLotDeSites(SESSION, creation.lotId, clientApp());
    const modification = await deposer("sites", [
      ["C-001", "DUCOS", "R6-atelier-confie", "", "Nouméa", "", "", ""],
    ]);
    expect(modification.modifications).toBe(1);
    const brule = await appliquerLeLotDeClients(
      SESSION,
      modification.lotId,
      clientApp(),
    );
    expect(brule.applique).toBe(true);
    if (!brule.applique) return;
    expect(brule.creations).toBe(0);
    expect(brule.modifications).toBe(0);
    const [etat] = await clientOwner().$queryRawUnsafe<
      Array<{ statut: string; applique_le: Date | null }>
    >(
      `SELECT "statut", "applique_le" FROM "import_lot" WHERE "id" = '${modification.lotId}'`,
    );
    expect(etat.statut).toBe("applique");
    expect(etat.applique_le).not.toBeNull();

    // **ET CE QUI FERME** : l'aiguillage que la route lit désormais n'aurait
    // jamais appelé celle-là. *C'est le TÉMOIN du scénario* — sans lui, il
    // montrerait un défaut sans montrer qu'il est hors d'atteinte.
    const type = await typeDuLot(SESSION, modification.lotId, clientApp());
    expect(applicationDuType(type as string)?.appliquer).toBe(
      appliquerLeLotDeSites,
    );
  });
});
