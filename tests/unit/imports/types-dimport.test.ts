import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  TYPES_DIMPORT,
  cleDuMotif,
  cleDuStatut,
} from "../../../app/(back-office)/imports/types";
import { estCleTraduction } from "@/lib/i18n/fr";

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

/** Les types que le dépôt sait APPLIQUER, lus dans les sources. */
function typesApplicables(): ReadonlySet<string> {
  const trouves = new Set<string>();
  for (const fichier of readdirSync(MODULES)) {
    if (!fichier.endsWith(".ts")) continue;
    const source = readFileSync(join(MODULES, fichier), "utf8");
    for (const m of source.matchAll(
      /export\s+async\s+function\s+appliquerLeLotDe(\w+)\s*\(/g,
    )) {
      trouves.add(m[1].toLowerCase());
    }
  }
  return trouves;
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

  it("les quatre autres sont NOMMÉS, jamais absents de la liste", () => {
    // *Un écran qui accepterait un fichier de contacts en montrerait le rapport
    // et ne saurait rien en faire.* Les taire serait pire : ils existent, leurs
    // gabarits existent, et le silence ferait croire qu'ils n'ont pas été
    // pensés — la faute de D88, une couche plus haut.
    const incomplets = TYPES_DIMPORT.filter((type) => !type.complet);
    expect(incomplets.length).toBe(4);
    expect(incomplets.map((type) => type.cle).sort()).toEqual([
      "contacts",
      "modeles",
      "prestations",
      "sites",
    ]);
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
