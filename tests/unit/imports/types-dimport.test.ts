import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  TYPES_DIMPORT,
  cleDuMotif,
  cleDuStatut,
} from "../../../app/(back-office)/imports/types";
import { estCleTraduction } from "@/lib/i18n/fr";
import { TYPES_PUBLIES } from "@/lib/imports/modeles";
import { INDEX_DE_CIBLE } from "@/lib/imports/parc-cibles";
import { APPLICATIONS, SANS_APPLICATION } from "@/lib/imports/types-dimport";

/**
 * LES TYPES D'IMPORT, ET CE QU'ON SAIT EN FAIRE (L1-11).
 *
 * ## Ce que ce gardien remplace
 *
 * La première rédaction portait le drapeau `complet` **écrit à la main**, avec
 * sa limite annoncée : *« le jour où un second type devient applicable, cette
 * ligne ment jusqu'à ce qu'on la corrige, et rien ne le dira ».* C'est
 * exactement la liste close que le §9 refuse de laisser tenir à la main — et
 * elle est **dérivable**, puisque les fonctions d'application sont dans le
 * dépôt.
 *
 * Le gardien confronte donc l'écran à `lib/imports/`, une source qu'il ne
 * contrôle pas et qui ne se plie pas à ce qu'il déclare (§9, 01/09). *Le jour
 * où `appliquerLeLotDeContacts` sera écrite, ce gardien rougira le jour même.*
 *
 * ## Sa limite, annoncée
 *
 * Il reconnaît une fonction d'application à son NOM — `appliquerLeLotDe<Type>`.
 * Une fonction baptisée autrement lui échappe : c'est la forme 6 du §9 (26/08),
 * qu'aucun motif statique n'arrête. *Ce qu'il arrête est l'oubli, jamais le
 * contournement décidé.*
 */

const RACINE = process.cwd();
const MODULES = join(RACINE, "lib/imports");

/** Les fonctions `<verbe>LeLotDe<Type>` que les sources de `lib/imports/` portent. */
function typesDuVerbe(verbe: "appliquer" | "annuler"): ReadonlySet<string> {
  const trouves = new Set<string>();
  const motif = new RegExp(
    `export\\s+async\\s+function\\s+${verbe}LeLotDe(\\w+)\\s*\\(`,
    "g",
  );
  for (const fichier of readdirSync(MODULES)) {
    if (!fichier.endsWith(".ts")) continue;
    const source = readFileSync(join(MODULES, fichier), "utf8");
    for (const m of source.matchAll(motif)) {
      trouves.add(m[1].toLowerCase());
    }
  }
  return trouves;
}

/** Les types que le dépôt sait APPLIQUER, lus dans les sources. */
function typesApplicables(): ReadonlySet<string> {
  return typesDuVerbe("appliquer");
}

describe("la liste des types dit la vérité sur ce qu'on sait appliquer", () => {
  it("a réellement lu des modules et des fonctions", () => {
    // TÉMOIN DE NON-VACUITÉ : zéro fonction trouvée rendrait « aucun type
    // complet », et l'assertion suivante serait verte sans rien regarder.
    expect(readdirSync(MODULES).length).toBeGreaterThan(3);
    expect(typesApplicables().size).toBeGreaterThan(0);
    expect(TYPES_DIMPORT.length).toBeGreaterThanOrEqual(5);
  });

  it("`complet` s'accorde avec les fonctions que `lib/imports/` porte", () => {
    const applicables = typesApplicables();
    const declares = TYPES_DIMPORT.filter((type) => type.complet).map(
      (type) => type.cle,
    );
    expect([...declares].sort()).toEqual([...applicables].sort());
  });

  it("les types INCOMPLETS sont NOMMÉS, jamais absents de la liste", () => {
    // *Un écran qui accepterait un fichier de contacts en montrerait le rapport
    // et ne saurait rien en faire.* Les taire serait pire : ils existent, leurs
    // gabarits existent, et le silence ferait croire qu'ils n'ont pas été
    // pensés — la faute de D88, une couche plus haut.
    //
    // **LA LISTE N'EST PLUS ÉCRITE ICI** (R6-01). La rédaction précédente
    // nommait quatre types en toutes lettres, et *elle a rougi le jour même où
    // trois d'entre eux sont devenus applicables* — ce qui est exactement ce
    // qu'on attendait d'elle. Mais la corriger à la main la remettrait dans le
    // même état : la population vient donc de `SANS_APPLICATION`, et
    // l'assertion porte sur l'ACCORD des deux listes.
    const incomplets = TYPES_DIMPORT.filter((type) => !type.complet).map(
      (type) => type.cle,
    );
    expect(incomplets.sort()).toEqual(Object.keys(SANS_APPLICATION).sort());
  });

  it("chaque type porte des clés que le dictionnaire connaît", () => {
    for (const type of TYPES_DIMPORT) {
      expect(estCleTraduction(type.detail)).toBe(true);
      // Le titre est une clé OU un mot imposé, jamais ni l'un ni l'autre.
      if (type.titre === null) {
        expect(type.vocabulaire).toBeDefined();
      } else {
        expect(estCleTraduction(type.titre)).toBe(true);
      }
    }
  });
});

describe("un code que le dictionnaire ignore ne se traduit pas", () => {
  it("les statuts connus rendent une clé, les autres rendent `null`", () => {
    // Les trois valeurs de `StatutImportLot` au chapitre 11.
    for (const statut of ["controle", "applique", "annule"]) {
      const cle = cleDuStatut(statut);
      expect(cle).not.toBeNull();
      expect(cle !== null && estCleTraduction(cle)).toBe(true);
    }
    // *Un statut inconnu s'affiche en CODE plutôt que traduit à la volée* : ce
    // serait du texte technique rendu à un humain (L0-11).
    expect(cleDuStatut("brouillon")).toBeNull();
  });

  it("les motifs de rejet suivent la même règle", () => {
    for (const motif of [
      "saisie_refusee",
      "parent_introuvable",
      "cle_ambigue",
    ]) {
      const cle = cleDuMotif(motif);
      expect(cle).not.toBeNull();
      expect(cle !== null && estCleTraduction(cle)).toBe(true);
    }
    expect(cleDuMotif("autre_chose")).toBeNull();
  });
});

/**
 * LA TABLE QUE LES ROUTES LISENT, FERMÉE DANS LES DEUX SENS (R6-01).
 *
 * L1-08i refusait *« une liste close de plus, tenue à la main, que le prochain
 * type oublierait »*. Ces quatre assertions sont ce qui l'empêche d'en être
 * une : **aucune des sources qu'elles confrontent n'appartient à
 * `types-dimport.ts`** — ni les gabarits, ni le texte des modules, ni les index
 * de cible (§9, 01/09).
 */
describe("la table des applications ne peut pas oublier un type", () => {
  it("a réellement observé quelque chose", () => {
    // TÉMOIN. *Un décompte nul ressemble toujours à un sans-faute* (§9, 30/08) :
    // trois listes vides s'accorderaient parfaitement.
    expect(TYPES_PUBLIES.length).toBeGreaterThanOrEqual(5);
    expect(Object.keys(APPLICATIONS).length).toBeGreaterThan(0);
    expect(Object.keys(SANS_APPLICATION).length).toBeGreaterThan(0);
  });

  it("couvre EXACTEMENT les gabarits publiés — ni plus, ni moins", () => {
    const couverts = [
      ...Object.keys(APPLICATIONS),
      ...Object.keys(SANS_APPLICATION),
    ].sort();
    expect(couverts).toEqual([...TYPES_PUBLIES].sort());
  });

  it("un type ne peut pas être dans les DEUX listes", () => {
    // *« On sait l'appliquer » et « on ne sait pas » ne se recouvrent pas*, et
    // sans cette assertion l'égalité ci-dessus se satisferait d'un doublon
    // compensé par un oubli.
    for (const type of Object.keys(APPLICATIONS)) {
      expect(SANS_APPLICATION[type]).toBeUndefined();
    }
  });

  it("chaque application déclarée existe RÉELLEMENT dans les sources", () => {
    expect(Object.keys(APPLICATIONS).sort()).toEqual(
      [...typesDuVerbe("appliquer")].sort(),
    );
  });

  it("chaque application déclarée a son ANNULATION, et réciproquement", () => {
    // *Une application sans annulation livrerait la moitié de I6.* Le type
    // `ApplicationDeLot` l'exige déjà à la compilation ; ceci l'exige contre
    // les SOURCES, où une fonction pourrait exister sans être déclarée.
    expect([...typesDuVerbe("annuler")].sort()).toEqual(
      [...typesDuVerbe("appliquer")].sort(),
    );
  });

  it("chaque type applicable a un INDEX DE CIBLE", () => {
    // **Sans index de cible, toute ligne ressort en CRÉATION** : le second
    // import du même fichier ferait un doublon par ligne, ce que RG-IMP-05
    // interdit. *Et cela ne produit aucune erreur* — c'est pourquoi un gardien
    // est le seul endroit où cela se voit.
    for (const type of Object.keys(APPLICATIONS)) {
      expect(INDEX_DE_CIBLE[type]).toBeDefined();
    }
  });

  it("chaque type SANS application porte un motif qui dit quelque chose", () => {
    // *Un champ écarté sans motif est un champ oublié, et rien ne les
    // distingue* — la règle des `CHAMPS_*_ECARTES`, appliquée ici.
    for (const [type, motif] of Object.entries(SANS_APPLICATION)) {
      expect(motif.trim().length).toBeGreaterThan(20);
      expect(APPLICATIONS[type]).toBeUndefined();
    }
  });

  it("reste vert POUR SA PROPRE RAISON, et pas par ressemblance", () => {
    // §9, 11/09 : *à côté de chaque cas qui doit rougir, un cas qui doit rester
    // vert POUR SA PROPRE RAISON.* La lecture des sources reconnaît une
    // fonction à son nom ; ces deux-là lui ressemblent et n'en sont pas.
    expect(typesDuVerbe("appliquer").has("clients")).toBe(true);
    // `appliquerLesLignes` n'est pas `appliquerLeLotDeLignes` : un motif trop
    // lâche l'attraperait et déclarerait un type « lignes » qui n'existe pas.
    expect(typesDuVerbe("appliquer").has("lignes")).toBe(false);
    expect(typesDuVerbe("annuler").has("lignes")).toBe(false);
  });
});
