import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * L9-05 — AUCUNE PÉRIODICITÉ EN DUR DANS LE CODE DU LOT 9.
 *
 * ## Pourquoi ce gardien existe
 *
 * La périodicité des vérifications dépend du matériel ET du texte applicable.
 * **La Nouvelle-Calédonie a son propre code du travail**, et la solution sera
 * vendue sur d'autres territoires. *C'est une donnée saisie par un humain*,
 * comme le taux horaire (D68) et la majoration hors ouverture — le §8 du
 * CLAUDE.md interdit d'inventer un délai.
 *
 * ## CE QU'IL REGARDE, ET POURQUOI PAS PLUS LARGE
 *
 * Tout littéral numérique de `lib/vgp/`, **moins une liste close de conversions
 * d'unité**. Un gardien plus large — « aucun nombre nulle part » — refuserait
 * `0`, `1` et les index de tableau, et son taux de fausses alertes conduirait à
 * ne plus le lire : *un gardien qu'on ignore coûte plus qu'il ne rapporte*
 * (§9, 11/09). La liste est donc étroite et **adossée** : chaque conversion
 * qu'elle nomme doit exister dans le code, sans quoi l'exemption survit à ce
 * qu'elle protégeait (§9, 31/08).
 *
 * ## SA LIMITE, ANNONCÉE
 *
 * Il lit du TEXTE. Une durée assemblée à l'exécution — `6 * unMois` calculé
 * depuis une constante ailleurs — lui échappe, comme la forme 6 du §9 (26/08)
 * échappe à tout motif statique. Ce qu'il arrête est la constante écrite en
 * clair, c'est-à-dire la faute telle qu'elle se commettrait.
 */

const RACINE = join(process.cwd(), "lib/vgp");

/**
 * LES CONVERSIONS D'UNITÉ, liste close et adossée.
 *
 * Une conversion d'unité n'est pas une périodicité : `86 400 000` dit combien de
 * millisecondes fait un jour, ce qui est vrai partout et pour tout le monde. Une
 * périodicité dit tous les combien un matériel se vérifie — ce qui dépend d'un
 * texte, d'un territoire et d'un matériel.
 */
const CONVERSIONS: readonly { valeur: string; ou: string }[] = [
  { valeur: "86_400_000", ou: "information.ts" },
];

/** Les littéraux qu'aucune règle métier ne peut porter : structure, pas durée. */
const NEUTRES = new Set(["0", "1"]);

function fichiersDuLot(): string[] {
  return readdirSync(RACINE)
    .filter((nom) => nom.endsWith(".ts"))
    .map((nom) => join(RACINE, nom));
}

/** Le code seul : les commentaires expliquent, ils n'exécutent pas (§9, 26/08). */
function codeSansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

describe("L9-05 — aucune durée écrite en dur dans `lib/vgp/`", () => {
  it("la population n'est pas vide — sans quoi le gardien ne regarde rien", () => {
    // TÉMOIN. Un répertoire vide ou renommé rendrait ce contrôle vert sans
    // qu'il ait rien lu : c'est la vacuité du §9 (30/08), et elle ne se
    // signale jamais toute seule.
    expect(fichiersDuLot().length).toBeGreaterThan(0);
  });

  it("chaque conversion exemptée EXISTE — l'exemption est adossée", () => {
    // Une exemption qui ne protège plus rien survit en silence, et le premier
    // fichier qui reprendra ce nom héritera d'une exemption que personne ne lui
    // a accordée (§9, 31/08).
    expect(CONVERSIONS.length).toBeGreaterThan(0);
    for (const conversion of CONVERSIONS) {
      const source = readFileSync(join(RACINE, conversion.ou), "utf8");
      expect(source).toContain(conversion.valeur);
    }
  });

  it("aucun littéral numérique hors conversions d'unité", () => {
    const exemptes = new Set(CONVERSIONS.map((c) => c.valeur));
    const fautes: string[] = [];

    for (const fichier of fichiersDuLot()) {
      const code = codeSansCommentaires(readFileSync(fichier, "utf8"));
      for (const [index, ligne] of code.split("\n").entries()) {
        for (const trouve of ligne.matchAll(/\b\d[\d_]*\b/g)) {
          const valeur = trouve[0];
          if (exemptes.has(valeur) || NEUTRES.has(valeur)) {
            continue;
          }
          fautes.push(
            `${fichier.replace(process.cwd() + "/", "")}:${index + 1} — ` +
              `littéral « ${valeur} » : une périodicité ne s'écrit pas dans le ` +
              "code (L9-05). Elle est saisie par un humain, avec le texte qui " +
              "la fonde.",
          );
        }
      }
    }

    expect(fautes).toEqual([]);
  });

  it("ÉPREUVE — une périodicité réellement écrite est refusée", () => {
    // Le gardien est éprouvé sur la faute telle qu'elle se commettrait : un
    // « en général c'est douze mois » glissé dans une valeur par défaut. Le cas
    // fabriqué prouve que le motif sait mordre (§9, 21/08).
    const faute = "const PERIODICITE_PAR_DEFAUT_MOIS = 12;";
    const trouves = [
      ...codeSansCommentaires(faute).matchAll(/\b\d[\d_]*\b/g),
    ].map((m) => m[0]);
    expect(trouves).toContain("12");
    expect(NEUTRES.has("12")).toBe(false);
  });

  it("ÉPREUVE — la faute écrite dans un COMMENTAIRE ne compte pas", () => {
    // La seule coupure légitime est « documentation contre exécution » (§9,
    // 26/08) : un commentaire qui CITE une périodicité — « le texte NC dit
    // douze mois » — explique, il n'exécute pas.
    const documentation =
      "// le texte de référence parle de 12 mois\nconst a = 0;";
    const trouves = [
      ...codeSansCommentaires(documentation).matchAll(/\b\d[\d_]*\b/g),
    ].map((m) => m[0]);
    expect(trouves).not.toContain("12");
  });
});
