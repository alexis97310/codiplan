import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ajouterSaisie,
  CLE_MOTIF_FORMAT_INCONNU,
  compterEnAttente,
  contientSaisiesDuneAutreIdentite,
  differencePrestations,
  listerFile,
  listerFilePourIntervention,
  retirerSaisieCoalescable,
  type Geste,
} from "@/lib/terrain/file-saisies";

import {
  ecrireEntreeBrute,
  installerIndexedDBFactice,
} from "./aide-indexeddb-factice";

/**
 * LA FILE DES SAISIES (9F4H3A-FILE-SANS-PERTE, points 1 et 2) — sous le
 * double IndexedDB de `aide-indexeddb-factice.ts` : jsdom n'implémente pas
 * IndexedDB (voir `copie-locale.test.ts`), et ces épreuves ont besoin d'un
 * aller-retour RÉEL (écrire, relire, coalescer) pour éprouver la coalescence
 * atomique et le retrait après un envoi en ligne — un simple « ne lève
 * jamais » ne les distinguerait pas d'un bogue qui perd la saisie en
 * silence.
 */

const IDENTITE = { utilisateurId: "u1", societeId: "s1" };

let restaurer: () => void;

beforeEach(() => {
  restaurer = installerIndexedDBFactice();
});

afterEach(() => {
  restaurer();
});

describe("ajouterSaisie — coalescence atomique (point 1)", () => {
  it("une seconde saisie du même type sur la même intervention remplace la première", async () => {
    await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i1",
      geste: { type: "rapport", commentaire: "A", suite: "" },
    });
    await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i1",
      geste: { type: "rapport", commentaire: "AB", suite: "" },
    });
    const file = await listerFilePourIntervention("i1", IDENTITE);
    expect(file).toHaveLength(1);
    expect(file[0].geste).toEqual({
      type: "rapport",
      commentaire: "AB",
      suite: "",
    });
  });

  it("compteur et photo ne coalescent jamais — ils s'empilent", async () => {
    await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i1",
      geste: { type: "compteur", action: "demarrer" },
    });
    await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i1",
      geste: { type: "compteur", action: "arreter" },
    });
    const file = await listerFilePourIntervention("i1", IDENTITE);
    expect(file).toHaveLength(2);
  });

  it("la coalescence ne touche jamais une AUTRE intervention", async () => {
    await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i1",
      geste: { type: "rapport", commentaire: "A", suite: "" },
    });
    await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i2",
      geste: { type: "rapport", commentaire: "B", suite: "" },
    });
    expect(await compterEnAttente(IDENTITE)).toBe(2);
  });

  // TÉLÉPHONE PARTAGÉ (point 1, 9F4H3AC) — la coalescence ne regarde jamais
  // que l'intervention et le type ; sans l'identité dans la clé, la saisie
  // du compte B effacerait en silence celle du compte A.
  it("la coalescence ne touche jamais une AUTRE identité, même intervention et même type", async () => {
    const A = { utilisateurId: "uA", societeId: "s1" };
    const B = { utilisateurId: "uB", societeId: "s1" };
    await ajouterSaisie({
      ...A,
      interventionId: "i1",
      geste: { type: "rapport", commentaire: "De A", suite: "" },
    });
    await ajouterSaisie({
      ...B,
      interventionId: "i1",
      geste: { type: "rapport", commentaire: "De B", suite: "" },
    });
    const fileA = await listerFilePourIntervention("i1", A);
    const fileB = await listerFilePourIntervention("i1", B);
    expect(fileA).toHaveLength(1);
    expect(fileA[0].geste).toEqual({
      type: "rapport",
      commentaire: "De A",
      suite: "",
    });
    expect(fileB).toHaveLength(1);
    expect(fileB[0].geste).toEqual({
      type: "rapport",
      commentaire: "De B",
      suite: "",
    });
  });

  it("une seconde saisie de la MÊME identité continue de remplacer la première", async () => {
    await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i1",
      geste: { type: "rapport", commentaire: "A", suite: "" },
    });
    await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i1",
      geste: { type: "rapport", commentaire: "AB", suite: "" },
    });
    expect(await listerFilePourIntervention("i1", IDENTITE)).toHaveLength(1);
  });

  // LA RECHERCHE DE COALESCENCE LIT INDEXEDDB BRUT, SANS PASSER PAR
  // `gesteReconnu` (point 3, 9F4H6C-FILE-ROBUSTESSE) — une entrée voisine au
  // geste absent ou nul ne doit jamais faire lever `ajouterSaisie` d'une
  // AUTRE saisie, coalescable ou non.
  it("une saisie coalescable s'ajoute sans lever, même quand une AUTRE entrée de la même intervention a un geste `null`", async () => {
    await ecrireEntreeBrute({
      id: "00000000-0000-7000-8000-000000000001",
      interventionId: "i1",
      ...IDENTITE,
      instantAppareil: new Date().toISOString(),
      geste: null,
      motifRefus: null,
    });

    await expect(
      ajouterSaisie({
        ...IDENTITE,
        interventionId: "i1",
        geste: { type: "rapport", commentaire: "A", suite: "" },
      }),
    ).resolves.toEqual(expect.objectContaining({ gardee: true }));

    const file = await listerFilePourIntervention("i1", IDENTITE);
    expect(file).toHaveLength(2);
  });
});

describe("retirerSaisieCoalescable — la dernière valeur gagne (point 1, C1)", () => {
  it("A en file, AB envoyé en ligne : la file est vide pour ce type", async () => {
    await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i1",
      geste: { type: "rapport", commentaire: "A", suite: "" },
    });
    // « AB » part EN LIGNE (jamais par la file) — seul le retrait est
    // éprouvé ici, l'envoi réseau lui-même est hors de la responsabilité de
    // ce module.
    await retirerSaisieCoalescable({
      ...IDENTITE,
      interventionId: "i1",
      type: "rapport",
    });
    expect(await listerFilePourIntervention("i1", IDENTITE)).toHaveLength(0);
  });

  it("ne retire rien si la file ne porte pas ce type", async () => {
    await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i1",
      geste: { type: "prestations", ajouterIds: ["p1"], retirerIds: [] },
    });
    await retirerSaisieCoalescable({
      ...IDENTITE,
      interventionId: "i1",
      type: "rapport",
    });
    expect(await listerFilePourIntervention("i1", IDENTITE)).toHaveLength(1);
  });

  it("ne retire pas une entrée plus RÉCENTE que l'envoi en ligne", async () => {
    await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i1",
      geste: { type: "rapport", commentaire: "A", suite: "" },
      instantAppareil: new Date(Date.now() + 60_000).toISOString(),
    });
    await retirerSaisieCoalescable({
      ...IDENTITE,
      interventionId: "i1",
      type: "rapport",
    });
    expect(await listerFilePourIntervention("i1", IDENTITE)).toHaveLength(1);
  });

  // ÉCRITE PENDANT L'ENVOI (point 2, 9F4H3AC) — `pasApresInstant`, relevé
  // AVANT l'appel réseau et transmis explicitement, ne doit jamais retirer
  // une entrée dont l'horodatage lui est POSTÉRIEUR, même si cette entrée a
  // été écrite avant que la réponse ne revienne.
  it("garde une entrée écrite PENDANT l'envoi, postérieure à `pasApresInstant`", async () => {
    const avantEnvoi = new Date().toISOString();
    await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i1",
      geste: {
        type: "rapport",
        commentaire: "Écrite pendant l'envoi",
        suite: "",
      },
      instantAppareil: new Date(Date.now() + 5_000).toISOString(),
    });
    await retirerSaisieCoalescable({
      ...IDENTITE,
      interventionId: "i1",
      type: "rapport",
      pasApresInstant: avantEnvoi,
    });
    expect(await listerFilePourIntervention("i1", IDENTITE)).toHaveLength(1);
  });

  it("retire une entrée dont l'horodatage est ANTÉRIEUR ou égal à `pasApresInstant` fourni", async () => {
    const instantEntree = "2026-10-18T03:00:00.000Z";
    await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i1",
      geste: { type: "rapport", commentaire: "A", suite: "" },
      instantAppareil: instantEntree,
    });
    await retirerSaisieCoalescable({
      ...IDENTITE,
      interventionId: "i1",
      type: "rapport",
      pasApresInstant: "2026-10-18T03:00:01.000Z",
    });
    expect(await listerFilePourIntervention("i1", IDENTITE)).toHaveLength(0);
  });

  it("ne lève jamais quand une AUTRE entrée de la même intervention a un geste absent ou nul (point 3, 9F4H6C-FILE-ROBUSTESSE)", async () => {
    await ecrireEntreeBrute({
      id: "00000000-0000-7000-8000-000000000002",
      interventionId: "i1",
      ...IDENTITE,
      instantAppareil: new Date().toISOString(),
      geste: null,
      motifRefus: null,
    });
    await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i1",
      geste: { type: "rapport", commentaire: "A", suite: "" },
    });

    await expect(
      retirerSaisieCoalescable({
        ...IDENTITE,
        interventionId: "i1",
        type: "rapport",
      }),
    ).resolves.toBeUndefined();

    const file = await listerFilePourIntervention("i1", IDENTITE);
    expect(file).toHaveLength(1);
    expect(file[0].motifRefus).toBe(CLE_MOTIF_FORMAT_INCONNU);
  });
});

describe("ajouterSaisie — une transaction ABANDONNÉE est un échec (point 5, 9F4H3AC)", () => {
  it("rend gardee:false sur `onabort`, jamais une promesse qui ne se résout pas", async () => {
    restaurer();
    restaurer = installerIndexedDBFactice({ enAbandon: true });
    const resultat = await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i1",
      geste: { type: "rapport", commentaire: "A", suite: "" },
    });
    expect(resultat).toEqual({ gardee: false });
  });
});

describe("contientSaisiesDuneAutreIdentite (addendum 3)", () => {
  it("rend vrai quand une autre identité a des saisies gardées", async () => {
    await ajouterSaisie({
      utilisateurId: "u2",
      societeId: "s2",
      interventionId: "i1",
      geste: { type: "rapport", commentaire: "A", suite: "" },
    });
    expect(await contientSaisiesDuneAutreIdentite(IDENTITE)).toBe(true);
  });

  it("rend faux quand seule l'identité courante a des saisies", async () => {
    await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i1",
      geste: { type: "rapport", commentaire: "A", suite: "" },
    });
    expect(await contientSaisiesDuneAutreIdentite(IDENTITE)).toBe(false);
  });
});

describe("ajouterSaisie — jamais « gardée » sans preuve (point 2, C2)", () => {
  it("rend gardee:false quand IndexedDB est en panne", async () => {
    restaurer();
    restaurer = installerIndexedDBFactice({ enPanne: true });
    const resultat = await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i1",
      geste: { type: "rapport", commentaire: "A", suite: "" },
    });
    expect(resultat).toEqual({ gardee: false });
  });

  it("rend gardee:true, avec l'id, quand l'écriture réussit", async () => {
    const resultat = await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i1",
      geste: { type: "rapport", commentaire: "A", suite: "" },
    });
    expect(resultat.gardee).toBe(true);
    expect(typeof (resultat as { id: string }).id).toBe("string");
  });

  it("réutilise l'id fourni, pour que la file reprenne l'opération du premier essai (point 3, C7)", async () => {
    const id = "01234567-89ab-7cde-8f01-234567890abc";
    const resultat = await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i1",
      geste: { type: "compteur", action: "demarrer" },
      id,
      instantAppareil: "2026-10-18T03:00:00.000Z",
    });
    expect(resultat).toEqual({ gardee: true, id });
    const file = await listerFile(IDENTITE);
    expect(file[0].id).toBe(id);
    expect(file[0].instantAppareil).toBe("2026-10-18T03:00:00.000Z");
  });
});

describe("gesteReconnu à la lecture — l'ancien format n'est jamais gelé (9F4H6B-FILE-ANCIEN-FORMAT, point 1)", () => {
  it("une entrée `{prestationIds}` (avant 9F4H6A) devient `{ajouterIds, retirerIds:[]}` — AJOUTS seuls", async () => {
    await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i1",
      geste: {
        type: "prestations",
        prestationIds: ["p1", "p2"],
      } as unknown as Geste,
    });
    const file = await listerFilePourIntervention("i1", IDENTITE);
    expect(file).toHaveLength(1);
    expect(file[0].geste).toEqual({
      type: "prestations",
      ajouterIds: ["p1", "p2"],
      retirerIds: [],
    });
    expect(file[0].motifRefus).toBeNull();
  });

  it("la forme courante `{ajouterIds, retirerIds}` traverse sans changement", async () => {
    await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i1",
      geste: { type: "prestations", ajouterIds: ["p1"], retirerIds: ["p2"] },
    });
    const file = await listerFilePourIntervention("i1", IDENTITE);
    expect(file[0].geste).toEqual({
      type: "prestations",
      ajouterIds: ["p1"],
      retirerIds: ["p2"],
    });
  });

  it("une forme de prestations qui n'a ni l'ancien ni le nouveau format reste en file avec le motif NEUF", async () => {
    await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i1",
      geste: { type: "prestations" } as unknown as Geste,
    });
    const file = await listerFilePourIntervention("i1", IDENTITE);
    expect(file).toHaveLength(1);
    expect(file[0].motifRefus).toBe(CLE_MOTIF_FORMAT_INCONNU);
  });

  it("un type de geste entièrement inconnu reste en file avec le même motif, jamais perdu", async () => {
    await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i1",
      geste: { type: "mystere" } as unknown as Geste,
    });
    const file = await listerFilePourIntervention("i1", IDENTITE);
    expect(file).toHaveLength(1);
    expect(file[0].motifRefus).toBe(CLE_MOTIF_FORMAT_INCONNU);
  });

  it("un geste `null` ou absent reste en file avec le même motif, et ne lève jamais en le relisant (point 3, 9F4H6C-FILE-ROBUSTESSE)", async () => {
    await ecrireEntreeBrute({
      id: "00000000-0000-7000-8000-000000000003",
      interventionId: "i1",
      ...IDENTITE,
      instantAppareil: new Date().toISOString(),
      geste: null,
      motifRefus: null,
    });
    await ecrireEntreeBrute({
      id: "00000000-0000-7000-8000-000000000004",
      interventionId: "i2",
      ...IDENTITE,
      instantAppareil: new Date().toISOString(),
      // `geste` ABSENT DU TOUT, pas seulement `null` — un enregistrement
      // écrit par une version antérieure qui n'aurait jamais posé ce champ.
      motifRefus: null,
    });

    const fileI1 = await listerFilePourIntervention("i1", IDENTITE);
    expect(fileI1).toHaveLength(1);
    expect(fileI1[0].motifRefus).toBe(CLE_MOTIF_FORMAT_INCONNU);
    // LIRE `.type` NE LÈVE JAMAIS, MÊME SUR UN GESTE PARTI DE `null` — c'est
    // précisément ce que `trieeParPipeline` (`envoi-file.ts`) et les
    // relecteurs d'écran font sans jamais vérifier d'abord.
    expect(() => fileI1[0].geste.type).not.toThrow();

    const fileI2 = await listerFilePourIntervention("i2", IDENTITE);
    expect(fileI2).toHaveLength(1);
    expect(fileI2[0].motifRefus).toBe(CLE_MOTIF_FORMAT_INCONNU);
    expect(() => fileI2[0].geste.type).not.toThrow();
  });
});

describe("differencePrestations — jamais l'ensemble (9F4H6A, point 2)", () => {
  it("une case cochée en plus : ajoutee, rien retiré", () => {
    expect(differencePrestations(new Set(["A"]), new Set(["A", "C"]))).toEqual({
      ajouterIds: ["C"],
      retirerIds: [],
    });
  });

  it("une case décochée : retirée, rien ajouté", () => {
    expect(differencePrestations(new Set(["A"]), new Set())).toEqual({
      ajouterIds: [],
      retirerIds: ["A"],
    });
  });

  it("aucun changement : les deux listes sont vides", () => {
    expect(differencePrestations(new Set(["A"]), new Set(["A"]))).toEqual({
      ajouterIds: [],
      retirerIds: [],
    });
  });

  it("une prestation inconnue de la base (ajoutée par un autre appareil) n'apparaît jamais", () => {
    // `baseConnue` ignore totalement « B » — la différence ne la cite ni en
    // ajout ni en retrait, qu'elle soit ou non dans `voulues`.
    expect(differencePrestations(new Set(["A"]), new Set(["C"]))).toEqual({
      ajouterIds: ["C"],
      retirerIds: ["A"],
    });
  });
});
