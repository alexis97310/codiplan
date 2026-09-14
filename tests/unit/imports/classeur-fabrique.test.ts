import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { lireClasseur } from "@/lib/excel/classeur";
import { controlerFeuille } from "@/lib/excel/controle";
import { MODELE_CLIENTS, marqueurDu } from "@/lib/imports/modeles";

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
