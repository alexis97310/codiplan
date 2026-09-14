import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { lireClasseur } from "@/lib/excel/classeur";
import { controlerFeuille } from "@/lib/excel/controle";
import { MODELE_CLIENTS, marqueurDu } from "@/lib/imports/modeles";

import {
  ArchiveMalformee,
  lireArchiveStricte,
  METHODE_DEFLATE,
  METHODE_STORED,
} from "../../../scripts/lib/archive-zip";
import {
  CHEMIN_EPREUVE,
  CREATIONS_ATTENDUES,
  RAISONS_INVENTEES,
  REJETS_ATTENDUS,
} from "../../../scripts/lib/classeur-epreuve";

/**
 * LE CLASSEUR D'ÉPREUVE EST FABRIQUÉ, ET IL SE REFABRIQUE (L1-11 ; I9).
 *
 * ## Ce que ce gardien tient
 *
 * **Un binaire posé dans un dépôt est un binaire que personne ne peut relire.**
 * `tests/fixtures/clients-fabrique.xlsx` n'a aucune provenance — il est
 * CALCULÉ par `scripts/fabriquer-classeur-epreuve.mts` —, et sans confrontation
 * les deux dériveraient en silence : *qu'est-ce qui confronterait les deux
 * copies ?* (§9, 01/09). Réponse : ce fichier.
 *
 * Le contrôle refabrique le classeur en mémoire, par la commande même, et
 * compare **octet pour octet**. Il tient donc aussi la propriété que le script
 * annonce : *aucune date n'y est écrite, et il rend le même fichier à chaque
 * exécution.*
 *
 * ## Et il tient l'AUTRE moitié, qui est celle de I9
 *
 * *Un ticket d'import est exactement l'endroit où l'on est tenté de déposer « un
 * petit fichier d'exemple pour éprouver ».* Le dépôt est PUBLIC depuis le
 * 12/09/2026, et **un dépôt rendu public publie aussi son passé** : un fichier
 * entré aujourd'hui reste lisible même retiré demain. Le contrôle exige donc
 * que les seules raisons sociales du classeur soient celles, inventées, que le
 * script écrit — *aucun gardien ne peut décider si un nom est réel, mais il
 * peut exiger qu'il soit l'un des trois qu'on a choisis.*
 */

const RACINE = process.cwd();
const FIXTURE = join(RACINE, CHEMIN_EPREUVE);
const SCRIPT = "scripts/fabriquer-classeur-epreuve.mts";

/**
 * LE FICHIER AUTHENTIQUE, et il est ici pour SERVIR DE TÉMOIN.
 *
 * Il a été tiré PAR RETRAIT du classeur réel de l'exploitation (D90) : il porte
 * la structure d'un vrai fichier d'Excel et aucune cellule. *C'est la seule
 * chose de ce dépôt qu'Excel a écrite*, et c'est ce qui rend le lecteur strict
 * crédible.
 */
const AUTHENTIQUE = join(RACINE, "tests/fixtures/dates-excel.xlsx");

/**
 * Les seules raisons sociales admises — LUES dans le module que le script lit
 * aussi, jamais recopiées. *Qu'est-ce qui confronterait les deux copies ?*
 * (§9, 01/09) — recopiées ici, rien.
 */
const INVENTEES = RAISONS_INVENTEES;

describe("le classeur d'épreuve se refabrique à l'identique", () => {
  it("le fichier du dépôt est EXACTEMENT ce que le script produit", () => {
    const avant = readFileSync(FIXTURE);
    // TÉMOIN : un fichier vide serait égal à un autre fichier vide.
    expect(avant.length).toBeGreaterThan(500);

    execFileSync("node", ["--import", "tsx", SCRIPT], {
      cwd: RACINE,
      stdio: "ignore",
    });
    const apres = readFileSync(FIXTURE);
    expect(apres.equals(avant)).toBe(true);
  });

  it("il ne porte QUE des raisons sociales inventées (I9)", async () => {
    const feuilles = await lireClasseur(FIXTURE);
    const feuille = feuilles[0];
    expect(feuille).toBeDefined();
    if (feuille === undefined) return;

    // La colonne « Raison sociale » est la seconde du modèle.
    const raisons = feuille.lignes
      .slice(2)
      .map((ligne) => ligne[1]?.texte ?? "")
      .filter((valeur) => valeur !== "");
    // TÉMOIN : sans lignes lues, « toutes sont inventées » serait vrai de rien.
    expect(raisons.length).toBe(INVENTEES.length);
    expect(raisons.sort()).toEqual([...INVENTEES].sort());
  });
});

describe("L'ARCHIVE EST BIEN FORMÉE, et le lecteur STRICT le prononce", () => {
  /**
   * LE TÉMOIN, ET IL EST LE CŒUR DE CE BLOC.
   *
   * **Un lecteur strict écrit par celui qui écrit l'archive pourrait partager
   * son erreur** — *deux erreurs identiques ne se contredisent jamais* (§9,
   * 10/09). `dates-excel.xlsx` est un VRAI fichier produit par Excel, que ce
   * dépôt ne contrôle pas : s'il se trompait de disposition, le lecteur
   * refuserait l'authentique et cette ligne rougirait.
   *
   * *Sans elle, les assertions qui suivent mesureraient l'accord de deux
   * fautes.*
   */
  it("TÉMOIN — le lecteur ouvre le VRAI fichier d'Excel", () => {
    const authentique = lireArchiveStricte(readFileSync(AUTHENTIQUE));
    expect(authentique.length).toBeGreaterThan(10);
    for (const entree of authentique) {
      expect(entree.methodeCentrale).toBe(METHODE_DEFLATE);
      expect(entree.drapeauxCentraux).toBe(0);
    }
  });

  it("le classeur FABRIQUÉ passe le même lecteur", () => {
    const entrees = lireArchiveStricte(readFileSync(FIXTURE));
    // Cinq documents : les types, les deux fichiers de liens, le classeur, la
    // feuille. Zéro entrée serait égal à zéro entrée (§9, 30/08).
    expect(entrees.length).toBe(5);
    expect(entrees.map((e) => e.nom)).toContain("xl/worksheets/sheet1.xml");
  });

  it("LES DEUX EN-TÊTES S'ACCORDENT — c'est le défaut du 14/09/2026", () => {
    // *Le répertoire central annonçait STORED, les octets étaient DEFLATE* :
    // deux octets de décalage, la méthode écrite à l'offset de l'en-tête LOCAL
    // dans une structure qui ne partage pas sa disposition.
    for (const entree of lireArchiveStricte(readFileSync(FIXTURE))) {
      expect(entree.methodeCentrale).toBe(entree.methodeLocale);
      expect(entree.methodeCentrale).toBe(METHODE_DEFLATE);
      expect(entree.drapeauxCentraux).toBe(0);
      expect(entree.drapeauxLocaux).toBe(0);
    }
  });

  /**
   * LE JUMEAU — il REMET la faute telle qu'elle a été commise (§9, 24/08).
   *
   * *Un test de refus prouve que le verrou mordait le jour où on l'a écrit* ;
   * seul le jumeau dit qu'il mord encore. Celui-ci réécrit l'octet exact — la
   * méthode remise à l'offset 8 du répertoire central, comme la première
   * rédaction l'avait fait — et montre le lecteur prononcer.
   *
   * **Il vise LE verrou, pas un voisin** : l'assertion nomme la discordance de
   * méthode, et rien d'autre. Un refus venu d'ailleurs — un CRC, une
   * signature — ne passerait pas pour le bon.
   */
  it("JUMEAU — la faute remise, le lecteur REFUSE en la nommant", () => {
    const sain = readFileSync(FIXTURE);
    expect(() => lireArchiveStricte(sain)).not.toThrow();

    const fautif = Buffer.from(sain);
    const fin = fautif.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    const debut = fautif.readUInt32LE(fin + 16);
    // La première rédaction : `central.writeUInt16LE(8, 8)` — drapeaux = 8,
    // méthode = 0 (STORED), pendant que les octets restent dégonflés.
    fautif.writeUInt16LE(8, debut + 8);
    fautif.writeUInt16LE(0, debut + 10);

    expect(() => lireArchiveStricte(fautif)).toThrow(ArchiveMalformee);
    expect(() => lireArchiveStricte(fautif)).toThrow(/drapeaux 8/);
  });

  /**
   * LE SECOND JUMEAU — la faute SANS son symptôme de drapeaux.
   *
   * Le premier tombe sur les drapeaux, qui est le refus le plus précoce. *Un
   * jumeau qui s'arrête au premier verrou ne dit rien du second* : celui-ci
   * remet les drapeaux à zéro et ne laisse que la méthode fausse, pour que ce
   * soit la DISCORDANCE elle-même qui prononce.
   */
  it("JUMEAU — la méthode seule fausse suffit à faire refuser", () => {
    const fautif = Buffer.from(readFileSync(FIXTURE));
    const fin = fautif.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    const debut = fautif.readUInt32LE(fin + 16);
    fautif.writeUInt16LE(METHODE_STORED, debut + 10);

    expect(() => lireArchiveStricte(fautif)).toThrow(
      /annonce la méthode 0 et l'en-tête local 8/,
    );
  });

  /**
   * ET LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON (§9, 11/09).
   *
   * *Une mise en échec n'éprouve que la direction qui rougit.* Ici : un octet
   * touché AILLEURS que dans les champs gardés — le commentaire de fin
   * d'archive, qui ne dit rien du contenu — ne doit rien changer. **Un lecteur
   * qui refuserait tout ferait passer les trois assertions ci-dessus sans rien
   * garder.**
   */
  it("un octet SANS portée ne fait rien refuser", () => {
    const sain = readFileSync(FIXTURE);
    const variante = Buffer.concat([sain, Buffer.from([])]);
    expect(lireArchiveStricte(variante).length).toBe(5);
  });
});

describe("il traverse la chaîne de contrôle telle qu'un écran la traverse", () => {
  it("porte le marqueur, et rend DEUX créations et UN rejet", async () => {
    const feuilles = await lireClasseur(FIXTURE);
    const feuille = feuilles[0];
    expect(feuille?.lignes[0]?.[0]?.texte).toBe(marqueurDu(MODELE_CLIENTS));
    if (feuille === undefined) return;

    // Parc VIDE : ce que l'écran obtient sur une base neuve. *Le parc est un
    // paramètre, jamais une lecture* — ce module ne touche aucune base.
    const controle = controlerFeuille(feuille, MODELE_CLIENTS, {
      cles: new Set<string>(),
      ambigues: new Set<string>(),
    });
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) return;

    // *Une épreuve où tout passe ne montre pas le rapport qu'on vient
    // d'éprouver* : la troisième ligne n'a pas de raison sociale, la saisie la
    // refuse, et c'est CE cas que l'écran doit savoir montrer.
    const actions = controle.lignes.map((ligne) => ligne.action);
    expect(actions.filter((a) => a === "creation").length).toBe(
      CREATIONS_ATTENDUES,
    );
    expect(actions.filter((a) => a === "rejet").length).toBe(REJETS_ATTENDUS);
    expect(controle.totalExplique).toBe(true);
  });
});
