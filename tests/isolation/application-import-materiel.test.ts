import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { type FeuilleLue } from "@/lib/excel/classeur";
import { controlerFeuille } from "@/lib/excel/controle";
import {
  annulerLeLotDeEquipements,
  annulerLeLotDeFamilles,
} from "@/lib/imports/annulation";
import {
  appliquerLeLotDeEquipements,
  appliquerLeLotDeFamilles,
} from "@/lib/imports/application";
import { enregistrerLeControle } from "@/lib/imports/depot";
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

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { SOCIETE_A, SOCIETE_B, UTILISATEUR_INTERNE_A } from "./setup/fixtures";

/**
 * LA CHAÎNE DU MATÉRIEL, DE LA FEUILLE À LA FICHE (R6-03 ; I6, D6, L9-03/04).
 *
 * **C'est l'appelant de la chaîne ENTIÈRE**, pour les deux types que R6-03
 * ajoute : feuille → choix du gabarit par le MARQUEUR → contrôle contre le parc
 * de la CIBLE → lot en base → application → fiches réellement écrites →
 * annulation. *Une suite qui éprouve tous les maillons n'éprouve pas la chaîne*
 * (§9, 08/09).
 *
 * Tout passe par le chemin de PRODUCTION, sous le rôle applicatif restreint et
 * sous les politiques : aucun raccourci, aucune écriture posée en SQL. **Les
 * relectures, elles, sont faites en SQL sous le PROPRIÉTAIRE** — ce qu'un
 * scénario doit constater est ce que la BASE porte, jamais ce que le code
 * affirme avoir écrit (§4 du protocole).
 *
 * **CE FICHIER REND LE SEMIS TEL QU'IL L'A TROUVÉ.** Le harnais ne recrée pas
 * la base entre deux fichiers : *une fiche laissée derrière soi devient une
 * ligne de plus dans le décompte d'un autre scénario*, et celui-là échoue pour
 * une raison qui n'est pas la sienne — onze scénarios rouges dans sept fichiers
 * l'ont montré le 16/09/2026. Tout ce que ce fichier crée porte le préfixe
 * `R6M-`, et rien d'autre n'est supprimé : *un nettoyage qui effacerait plus
 * que ce qu'il a posé serait la même faute, dans l'autre sens.*
 */
async function nettoyer(): Promise<void> {
  const owner = clientOwner();
  await owner.$executeRawUnsafe(
    `DELETE FROM "machine" WHERE "societe_id" = '${SOCIETE_A}' AND ("numero_serie" LIKE 'R6M-%' OR "reference_interne" LIKE 'R6M-%')`,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "famille_materiel" WHERE "societe_id" = '${SOCIETE_A}' AND "code" LIKE 'R6M-%'`,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "import_lot" WHERE "societe_id" = '${SOCIETE_A}' AND "nom_fichier" LIKE 'R6M-%'`,
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
    sites: await indexerLeParcSites(SESSION, clientApp()),
    modeles: await indexerLeParcModeles(SESSION, clientApp()),
  };
}

/**
 * LE CHEMIN DE LA ROUTE DE CONTRÔLE, REJOUÉ — marqueur puis parc de la cible.
 *
 * *Choisir le gabarit ici à la main ferait éprouver une chaîne que personne
 * n'emprunte.*
 */
async function deposer(
  type: string,
  lignes: readonly (readonly string[])[],
): Promise<{
  lotId: string;
  creations: number;
  modifications: number;
  motifs: readonly (string | undefined)[];
}> {
  const modele = gabaritDuMarqueur(
    { texte: `CODIPLAN-${type}-v1` },
    await parcs(),
  );
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
    { nom: `R6M-${type}.xlsx`, type: modele.type, version: modele.version },
    controle.lignes,
    clientApp(),
  );
  return {
    lotId,
    creations: controle.lignes.filter((l) => l.action === "creation").length,
    modifications: controle.lignes.filter((l) => l.action === "modification")
      .length,
    motifs: controle.lignes.map((l) => l.rejetMotif),
  };
}

type LigneFamille = {
  id: string;
  code: string;
  libelle: string;
  assujettissement_vgp: string;
  vgp_periodicite_mois: number | null;
  vgp_reference_texte: string | null;
};

async function lireFamille(code: string): Promise<LigneFamille | undefined> {
  const [f] = await clientOwner().$queryRawUnsafe<LigneFamille[]>(
    `SELECT "id", "code", "libelle", "assujettissement_vgp"::text AS "assujettissement_vgp",
            "vgp_periodicite_mois", "vgp_reference_texte"
       FROM "famille_materiel"
      WHERE "societe_id" = '${SOCIETE_A}' AND "code" = '${code}'`,
  );
  return f;
}

type LigneMachine = {
  id: string;
  numero_serie: string;
  reference_interne: string | null;
  complet: boolean;
  source_creation: string;
  qr_token: string;
  numero: number | null;
  site_id: string;
  client_id: string;
  modele_id: string;
};

async function lireMachine(serie: string): Promise<LigneMachine | undefined> {
  const [m] = await clientOwner().$queryRawUnsafe<LigneMachine[]>(
    `SELECT "id", "numero_serie", "reference_interne", "complet",
            "source_creation"::text AS "source_creation", "qr_token", "numero",
            "site_id", "client_id", "modele_id"
       FROM "machine"
      WHERE "societe_id" = '${SOCIETE_A}' AND "numero_serie" = '${serie}'`,
  );
  return m;
}

/* ════════════════════════════════════════════════════════════════════════
 * LES FAMILLES — la racine de l'enchaînement, et le lot 9 avec elle
 * ════════════════════════════════════════════════════════════════════════ */

const TEXTE_VGP = "Code du travail NC, art. Lp. 261-1";

describe("un lot de FAMILLES écrit l'assujettissement, relu en SQL", () => {
  it("traverse, et les trois colonnes de VGP sont RÉELLEMENT en base", async () => {
    // LE TÉMOIN : elles n'existent pas AVANT. *Sans lui, une famille déjà
    // présente ferait passer l'application pour réussie sans qu'elle ait rien
    // écrit* (§9, 30/08).
    expect(await lireFamille("R6M-PONT")).toBeUndefined();
    expect(await lireFamille("R6M-OUTIL")).toBeUndefined();

    const { lotId, creations } = await deposer("familles", [
      ["R6M-PONT", "R6M Ponts élévateurs", "soumis", "6", TEXTE_VGP],
      // **Aucune déclaration** : celle-ci doit naître « à déterminer ».
      ["R6M-OUTIL", "R6M Outillage", "", "", ""],
    ]);
    expect(creations).toBe(2);

    const resultat = await appliquerLeLotDeFamilles(
      SESSION,
      lotId,
      clientApp(),
    );
    expect(resultat.applique).toBe(true);
    if (!resultat.applique) return;
    expect(resultat.creations).toBe(2);

    const pont = await lireFamille("R6M-PONT");
    expect(pont).toBeDefined();
    expect(pont?.assujettissement_vgp).toBe("soumis");
    // **La périodicité est en MOIS**, et son texte l'accompagne : L9-04 exige
    // les deux, et la base le refuserait sans eux.
    expect(pont?.vgp_periodicite_mois).toBe(6);
    expect(pont?.vgp_reference_texte).toBe(TEXTE_VGP);

    // **L'ÉTAT HONNÊTE, RELU EN SQL ET JAMAIS SUPPOSÉ.** Une famille dont le
    // fichier ne dit rien naît `a_determiner` — *« on n'a pas regardé » n'est
    // pas « non soumise »*, et elle apparaît le jour même dans
    // `/vgp/a-determiner`.
    const outil = await lireFamille("R6M-OUTIL");
    expect(outil?.assujettissement_vgp).toBe("a_determiner");
    expect(outil?.vgp_periodicite_mois).toBeNull();
    expect(outil?.vgp_reference_texte).toBeNull();

    // LA LIGNE porte ce qu'elle a produit : c'est ce que l'annulation lira pour
    // savoir quelle table restaurer.
    const [ligne] = await clientOwner().$queryRawUnsafe<
      Array<{ entite: string; entite_id: string }>
    >(
      `SELECT "entite", "entite_id" FROM "import_lot_ligne"
        WHERE "import_lot_id" = '${lotId}' AND "entite_id" IS NOT NULL
        ORDER BY "rang" LIMIT 1`,
    );
    expect(ligne.entite).toBe("famille_materiel");
    expect(ligne.entite_id).toBe(pont?.id);
  });

  it("LE MÊME FICHIER REDÉPOSÉ est une MODIFICATION, jamais un doublon", async () => {
    // **C'est la mesure qui justifie `indexerLeParcFamilles`.** Sans index de
    // cible, la clé `FAMILLE-…` ne serait dans aucun parc : *toute ligne
    // ressortirait en création*, et un second dépôt ferait un doublon par
    // ligne — ce que RG-IMP-05 interdit, et sans aucune erreur.
    const { lotId, creations, modifications } = await deposer("familles", [
      ["R6M-PONT", "R6M Ponts élévateurs — corrigé", "soumis", "12", TEXTE_VGP],
    ]);
    expect(creations).toBe(0);
    expect(modifications).toBe(1);

    const resultat = await appliquerLeLotDeFamilles(
      SESSION,
      lotId,
      clientApp(),
    );
    expect(resultat.applique).toBe(true);
    if (!resultat.applique) return;
    expect(resultat.modifications).toBe(1);

    const pont = await lireFamille("R6M-PONT");
    expect(pont?.libelle).toBe("R6M Ponts élévateurs — corrigé");
    expect(pont?.vgp_periodicite_mois).toBe(12);
    // ET LE TÉMOIN : une seule fiche, jamais deux.
    const [{ n }] = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS n FROM "famille_materiel"
        WHERE "societe_id" = '${SOCIETE_A}' AND "code" = 'R6M-PONT'`,
    );
    expect(Number(n)).toBe(1);
  });

  it("UNE MODIFICATION QUI NE MODIFIE RIEN N'EST PAS UNE MODIFICATION (point 1, 16/09/2026)", async () => {
    // La MÊME ligne que le dépôt précédent, à l'identique : la famille porte
    // déjà exactement ces valeurs, VGP comprise.
    const { lotId, modifications } = await deposer("familles", [
      ["R6M-PONT", "R6M Ponts élévateurs — corrigé", "soumis", "12", TEXTE_VGP],
    ]);
    expect(modifications).toBe(1);

    const resultat = await appliquerLeLotDeFamilles(
      SESSION,
      lotId,
      clientApp(),
    );
    expect(resultat.applique).toBe(true);
    if (!resultat.applique) return;
    expect(resultat.modifications).toBe(0);
    expect(resultat.inchangees).toBe(1);
  });

  it("« soumis » sans sa périodicité est REJETÉ, et rien n'est écrit (L9-04)", async () => {
    const { lotId, creations, motifs } = await deposer("familles", [
      ["R6M-LEVAGE", "R6M Levage", "soumis", "", TEXTE_VGP],
    ]);
    expect(creations).toBe(0);
    expect(motifs).toEqual(["saisie_refusee"]);

    // Le lot s'applique — il n'a simplement aucune ligne à écrire : *une ligne
    // rejetée n'entre pas, et le lot n'en est pas moins clos.*
    const resultat = await appliquerLeLotDeFamilles(
      SESSION,
      lotId,
      clientApp(),
    );
    expect(resultat.applique).toBe(true);
    if (resultat.applique) expect(resultat.creations).toBe(0);
    expect(await lireFamille("R6M-LEVAGE")).toBeUndefined();
  });

  it("l'ANNULATION refuse une famille dont l'assujettissement a changé depuis", async () => {
    // **C'est le scénario qui justifie que `porteEncore` sache comparer un
    // ENTIER et un `NULL`** (R6-03). Sans cela, l'annulation d'un lot de
    // familles aurait refusé CHAQUE ligne — un motif juste dans sa forme, qui
    // désigne un coupable inexistant ; et dans l'autre sens, ne PAS comparer
    // ces colonnes ferait supprimer une famille dont quelqu'un vient de
    // déclarer l'assujettissement, emportant une déclaration que L9-07 veut
    // retrouvable.
    expect(await lireFamille("R6M-GRUE")).toBeUndefined();
    const { lotId } = await deposer("familles", [
      ["R6M-GRUE", "R6M Grues", "", "", ""],
    ]);
    expect(
      (await appliquerLeLotDeFamilles(SESSION, lotId, clientApp())).applique,
    ).toBe(true);
    const avant = await lireFamille("R6M-GRUE");
    expect(avant?.assujettissement_vgp).toBe("a_determiner");

    // QUELQU'UN EXAMINE LA FAMILLE et la déclare soumise — le travail même que
    // le registre VGP attend.
    await clientOwner().$executeRawUnsafe(
      `UPDATE "famille_materiel"
          SET "assujettissement_vgp" = 'soumis', "vgp_periodicite_mois" = 12,
              "vgp_reference_texte" = '${TEXTE_VGP}'
        WHERE "id" = '${avant?.id}'`,
    );

    const annulation = await annulerLeLotDeFamilles(
      SESSION,
      lotId,
      clientApp(),
    );
    expect(annulation.annule).toBe(true);
    if (!annulation.annule) return;
    expect(annulation.lignes).toHaveLength(1);
    expect(annulation.lignes[0]?.defaite).toBe(false);
    expect(annulation.lignes[0]?.motif).toBe("modifiee_depuis");
    // **ET LA FICHE EST INTACTE** : *défaire le travail de quelqu'un serait
    // pire que ne rien défaire.*
    const apres = await lireFamille("R6M-GRUE");
    expect(apres?.assujettissement_vgp).toBe("soumis");
    expect(apres?.vgp_periodicite_mois).toBe(12);
  });

  it("l'ANNULATION défait une création que personne n'a touchée", async () => {
    // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON (§9, 11/09) : si
    // l'annulation refusait toujours, le scénario précédent passerait aussi.
    expect(await lireFamille("R6M-NACEL")).toBeUndefined();
    const { lotId } = await deposer("familles", [
      ["R6M-NACEL", "R6M Nacelles", "soumis", "12", TEXTE_VGP],
    ]);
    expect(
      (await appliquerLeLotDeFamilles(SESSION, lotId, clientApp())).applique,
    ).toBe(true);
    expect(await lireFamille("R6M-NACEL")).toBeDefined();

    const annulation = await annulerLeLotDeFamilles(
      SESSION,
      lotId,
      clientApp(),
    );
    expect(annulation.annule).toBe(true);
    if (!annulation.annule) return;
    expect(annulation.lignes[0]?.defaite).toBe(true);
    expect(await lireFamille("R6M-NACEL")).toBeUndefined();
  });

  it("un lot d'une AUTRE société rend le même refus qu'un lot introuvable", async () => {
    const { lotId } = await deposer("familles", [
      ["R6M-SCIE", "R6M Scies", "", "", ""],
    ]);
    // *Les distinguer ferait un oracle* (D35, D50).
    const depuisB = await appliquerLeLotDeFamilles(
      SESSION_B,
      lotId,
      clientApp(),
    );
    expect(depuisB.applique).toBe(false);
    if (!depuisB.applique) expect(depuisB.motif).toBe("lot_introuvable");
    expect(await lireFamille("R6M-SCIE")).toBeUndefined();
  });
});

/* ════════════════════════════════════════════════════════════════════════
 * LES ÉQUIPEMENTS — trois parents, et les quatre obligatoires de D6
 * ════════════════════════════════════════════════════════════════════════ */

/** Une ligne du gabarit « equipements », dans l'ordre de ses colonnes. */
function equipement(
  serie: string,
  reference = "",
  site = "Site A1-1",
  marque = "Ravaglioli",
  modele = "KPX-337",
): readonly string[] {
  return ["C-001", site, marque, modele, serie, reference, "", ""];
}

describe("un lot d'ÉQUIPEMENTS écrit des machines, et les TROIS parents sont résolus", () => {
  it("traverse, et la machine existe RÉELLEMENT en base", async () => {
    expect(await lireMachine("R6M-10326169")).toBeUndefined();

    const { lotId, creations } = await deposer("equipements", [
      equipement("R6M-10326169"),
    ]);
    expect(creations).toBe(1);

    const resultat = await appliquerLeLotDeEquipements(
      SESSION,
      lotId,
      clientApp(),
    );
    expect(resultat.applique).toBe(true);
    if (!resultat.applique) return;
    expect(resultat.creations).toBe(1);

    const machine = await lireMachine("R6M-10326169");
    expect(machine).toBeDefined();
    // **Les trois parents de D6 ont été RÉSOLUS**, et aucun n'était dans une
    // colonne d'identifiant technique (I10).
    expect(machine?.client_id).toBe("aaaaaaaa-0000-7000-8000-0000000000c1");
    expect(machine?.site_id).toBe("aaaaaaaa-0000-7000-8000-00000000551a");
    expect(machine?.modele_id).toBe("aaaaaaaa-0000-7000-8000-0000000000f9");
    // Une série lisible : la fiche est COMPLÈTE, et `complet` est déduit.
    expect(machine?.complet).toBe(true);
    // **Le CHEMIN pose la provenance**, jamais le fichier.
    expect(machine?.source_creation).toBe("import");
    // `qr_token` est TIRÉ (D71) ; `numero` reste NUL — le compteur par société
    // appartient à la synchronisation (lot 3), et rien ne l'attribue encore.
    expect(machine?.qr_token).toMatch(/^[A-Z2-7]{26}$/);
    expect(machine?.numero).toBeNull();
  });

  it("une plaque ILLISIBLE entre à COMPLÉTER, elle n'est pas rejetée (D6)", async () => {
    const { lotId, creations } = await deposer("equipements", [
      equipement("", "R6M-MAC-0128"),
    ]);
    expect(creations).toBe(1);
    expect(
      (await appliquerLeLotDeEquipements(SESSION, lotId, clientApp())).applique,
    ).toBe(true);

    // **`SN-INCONNU-<référence>`, composé par la clé de rapprochement** et non
    // par une seconde règle — et `complet = false`, DÉDUIT du numéro (§6).
    const machine = await lireMachine("SN-INCONNU-R6M-MAC-0128");
    expect(machine).toBeDefined();
    expect(machine?.complet).toBe(false);
    expect(machine?.reference_interne).toBe("R6M-MAC-0128");
  });

  it("le SITE d'une AUTRE société est introuvable — avec son témoin sur la même feuille", async () => {
    // « Site B1-1 » EXISTE en base, chez la société B. *Le cloisonnement passe
    // par le PARC : aucune comparaison de société n'est écrite dans le
    // gabarit*, et c'est la politique qui prononce. Le témoin est la ligne
    // suivante — un libellé de la société A, sur la même feuille, qui passe.
    const { creations, motifs } = await deposer("equipements", [
      equipement("R6M-HORS-SOCIETE", "", "Site B1-1"),
      equipement("R6M-TEMOIN-SITE"),
    ]);
    expect(motifs).toEqual(["site_introuvable", undefined]);
    expect(creations).toBe(1);
  });

  it("le MODÈLE introuvable porte SON motif, distinct de celui du site", async () => {
    const { motifs } = await deposer("equipements", [
      equipement("R6M-SANS-MODELE", "", "Site A1-1", "Ravaglioli", "KPX-999"),
      equipement("R6M-TEMOIN-MODELE"),
    ]);
    // *« Parent introuvable » sur une ligne qui en désigne trois envoie
    // chercher dans trois référentiels.*
    expect(motifs).toEqual(["modele_introuvable", undefined]);
  });

  it("LE MÊME FICHIER REDÉPOSÉ est une MODIFICATION, jamais un doublon", async () => {
    const { lotId, creations, modifications } = await deposer("equipements", [
      [
        "C-001",
        "Site A1-1",
        "Ravaglioli",
        "KPX-337",
        "R6M-10326169",
        "",
        "Travée 3",
        "",
      ],
    ]);
    expect(creations).toBe(0);
    expect(modifications).toBe(1);

    const resultat = await appliquerLeLotDeEquipements(
      SESSION,
      lotId,
      clientApp(),
    );
    expect(resultat.applique).toBe(true);
    if (!resultat.applique) return;
    expect(resultat.modifications).toBe(1);

    const [{ n }] = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS n FROM "machine"
        WHERE "societe_id" = '${SOCIETE_A}' AND "numero_serie" = 'R6M-10326169'`,
    );
    expect(Number(n)).toBe(1);
    const [{ localisation }] = await clientOwner().$queryRawUnsafe<
      Array<{ localisation: string }>
    >(
      `SELECT "localisation" FROM "machine"
        WHERE "societe_id" = '${SOCIETE_A}' AND "numero_serie" = 'R6M-10326169'`,
    );
    expect(localisation).toBe("Travée 3");
  });

  it("UNE MODIFICATION QUI NE MODIFIE RIEN N'EST PAS UNE MODIFICATION (point 1, 16/09/2026)", async () => {
    // La MÊME ligne que le dépôt précédent, à l'identique.
    const { lotId, modifications } = await deposer("equipements", [
      [
        "C-001",
        "Site A1-1",
        "Ravaglioli",
        "KPX-337",
        "R6M-10326169",
        "",
        "Travée 3",
        "",
      ],
    ]);
    expect(modifications).toBe(1);

    const resultat = await appliquerLeLotDeEquipements(
      SESSION,
      lotId,
      clientApp(),
    );
    expect(resultat.applique).toBe(true);
    if (!resultat.applique) return;
    expect(resultat.modifications).toBe(0);
    expect(resultat.inchangees).toBe(1);
  });

  it("l'ANNULATION défait une création, et la machine disparaît", async () => {
    expect(await lireMachine("R6M-A-DEFAIRE")).toBeUndefined();
    const { lotId } = await deposer("equipements", [
      equipement("R6M-A-DEFAIRE"),
    ]);
    expect(
      (await appliquerLeLotDeEquipements(SESSION, lotId, clientApp())).applique,
    ).toBe(true);
    expect(await lireMachine("R6M-A-DEFAIRE")).toBeDefined();

    const annulation = await annulerLeLotDeEquipements(
      SESSION,
      lotId,
      clientApp(),
    );
    expect(annulation.annule).toBe(true);
    if (!annulation.annule) return;
    expect(annulation.lignes[0]?.defaite).toBe(true);
    expect(await lireMachine("R6M-A-DEFAIRE")).toBeUndefined();
  });

  it("l'ANNULATION refuse une machine dont la plaque a été corrigée depuis", async () => {
    // *`complet` est DÉDUIT du numéro de série*, si bien qu'une divergence dit
    // qu'on a relevé la plaque — **exactement le travail que la file de
    // complétion demande**, et qu'une suppression effacerait.
    const { lotId } = await deposer("equipements", [
      equipement("", "R6M-MAC-0224"),
    ]);
    expect(
      (await appliquerLeLotDeEquipements(SESSION, lotId, clientApp())).applique,
    ).toBe(true);
    const avant = await lireMachine("SN-INCONNU-R6M-MAC-0224");
    expect(avant?.complet).toBe(false);

    await clientOwner().$executeRawUnsafe(
      `UPDATE "machine" SET "numero_serie" = 'R6M-RELEVE-0224', "complet" = true
        WHERE "id" = '${avant?.id}'`,
    );

    const annulation = await annulerLeLotDeEquipements(
      SESSION,
      lotId,
      clientApp(),
    );
    expect(annulation.annule).toBe(true);
    if (!annulation.annule) return;
    expect(annulation.lignes[0]?.defaite).toBe(false);
    expect(annulation.lignes[0]?.motif).toBe("modifiee_depuis");
    // LA FICHE EST INTACTE, et le relevé du technicien est conservé.
    const apres = await lireMachine("R6M-RELEVE-0224");
    expect(apres).toBeDefined();
    expect(apres?.complet).toBe(true);
  });
});
