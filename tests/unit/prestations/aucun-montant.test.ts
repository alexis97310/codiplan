import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { schemaPrestation } from "@/lib/prestations/saisie";

/**
 * D109 — UNE PRESTATION PORTE UNE DURÉE, JAMAIS UN TAUX.
 * D113 — ET ELLE NE DÉSIGNE AUCUN FORFAIT.
 *
 * ## LE COMPORTEMENT GARDÉ, et il en fait DEUX
 *
 * 1. **Aucune colonne de montant sur `prestation`.** *Deux endroits qui portent
 *    un prix, c'est une préséance à inventer et une seconde historisation à
 *    tenir, pour rien* — et la seconde serait fausse le jour où un tarif change,
 *    ce que RG-TAR-04 interdit.
 * 2. **Aucun lien vers `forfait`.** Le pont de D109 passe par l'INTERVENTION,
 *    qui reçoit le forfait par les trois axes de RG-TAR-06. Une clé étrangère
 *    ici aurait fait naître la question « et si le forfait désigné ne s'applique
 *    pas à la zone ? », qu'il aurait fallu arbitrer d'avance.
 *
 * ## POURQUOI UN GARDIEN PLUTÔT QU'UNE RELECTURE
 *
 * *La faute telle qu'elle se commettrait* n'est pas malveillante : quelqu'un
 * lira le §7 du cahier des charges — qui a porté « taux applicable » pendant
 * trois semaines — et ajoutera la colonne de bonne foi. **Le texte est corrigé
 * et barré ; le gardien est ce qui reste quand le texte n'est pas relu.**
 *
 * ## SA LIMITE, ANNONCÉE
 *
 * Il lit le MODÈLE Prisma et le SCHÉMA de saisie, par leur texte. Une colonne
 * ajoutée par une migration sans passer par `schema.prisma` lui échapperait —
 * comme à tout motif statique (§9, 26/08, forme 6). *Le dépôt n'a aucun chemin
 * de ce genre* : Prisma refuserait la dérive au premier `migrate`.
 */

const SCHEMA = readFileSync(
  join(process.cwd(), "prisma/schema.prisma"),
  "utf8",
);

/**
 * Le CORPS du modèle `Prestation`, sans son commentaire de tête.
 *
 * La coupure est délibérée et c'est elle qui rend le gardien utilisable : le
 * commentaire PARLE de taux et de forfait — il explique pourquoi ils n'y sont
 * pas —, et un gardien qui le lirait rougirait sur la phrase qui énonce la
 * règle. *Un gardien bruyant cesse d'être lu* (§9, 11/09).
 */
function modelePrestation(): string {
  const trouve = /model Prestation \{[\s\S]*?\n\}/.exec(SCHEMA);
  return trouve?.[0] ?? "";
}

/**
 * Le COMMENTAIRE de tête, qui doit exister et qui doit, lui, nommer la règle.
 *
 * *C'est la trace de D109 à l'endroit où on la cherchera* : quelqu'un qui lit le
 * schéma et se demande où est passé le taux doit trouver la réponse là, et non
 * dans un arbitrage qu'il faudrait savoir chercher.
 */
function docPrestation(): string {
  const trouve = /((?:^\/\/\/.*\n)+)model Prestation \{/m.exec(SCHEMA);
  return trouve?.[1] ?? "";
}

/**
 * Les mots qui trahissent un montant, quelle que soit la graphie.
 *
 * `taux` y est, et c'est le mot du §7 corrigé. `mineur` aussi : c'est la forme
 * ENTIÈRE des montants du dépôt (`montant_mineur` sur `taux_horaire`), et elle
 * passerait sous le radar d'une recherche du seul mot « montant ».
 */
const MOTS_D_ARGENT = [
  "montant",
  "taux",
  "prix",
  "tarif",
  "mineur",
  "devise",
  "forfait",
];

function forme(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

describe("le catalogue des prestations ne porte aucun prix", () => {
  it("TÉMOIN — le modèle existe, et il porte bien sa durée", () => {
    // Un motif qui ne trouve rien satisferait toutes les assertions suivantes
    // sans rien regarder (§9, 30/08).
    const modele = modelePrestation();
    expect(modele).toContain('@@map("prestation")');
    expect(modele).toContain("duree_standard_min");
  });

  it("AUCUNE COLONNE du modèle ne nomme un montant ni un forfait", () => {
    // Les lignes de COLONNE seules : les commentaires `///` du modèle PARLENT
    // de taux et de forfait — ils expliquent pourquoi ils n'y sont pas —, et un
    // gardien qui les lirait rougirait sur la phrase qui énonce la règle.
    // *C'est la leçon du §9 du 11/09 : un gardien bruyant cesse d'être lu.*
    const colonnes = modelePrestation()
      .split("\n")
      .filter((ligne) => /^\s{2}[a-z_]+\s/.test(ligne));
    expect(colonnes.length).toBeGreaterThanOrEqual(8);
    for (const colonne of colonnes) {
      const lu = forme(colonne);
      for (const mot of MOTS_D_ARGENT) {
        expect(lu, `« ${colonne.trim()} » nomme « ${mot} »`).not.toContain(mot);
      }
    }
  });

  it("LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON — les commentaires, eux, en parlent", () => {
    // Sans cette moitié, « aucune occurrence » serait aussi bien la preuve que
    // le gardien lit un texte vide. Le modèle DOIT expliquer pourquoi le taux
    // n'y est pas — c'est la trace de D109 à l'endroit où on la cherchera.
    expect(forme(docPrestation())).toContain("jamais un taux");
    // …et le commentaire existe vraiment : un motif qui ne trouve rien rendrait
    // une chaîne vide, que `toContain` refuserait pour la mauvaise raison.
    expect(docPrestation().length).toBeGreaterThan(200);
  });

  it("le SCHÉMA DE SAISIE n'accepte aucun champ de montant", () => {
    // La seconde porte : un montant refusé en base et accepté par Zod serait un
    // champ qui voyage jusqu'au dépôt avant d'être rejeté par un `500`.
    const saisie = schemaPrestation.safeParse({
      code: "ENT-PONT",
      libelle: "Entretien annuel pont élévateur",
      montant_mineur: 12_000,
      taux_horaire: 7000,
      forfait_id: "0192f0a0-0000-7000-8000-000000000001",
    });
    expect(saisie.success).toBe(true);
    // Zod ÉCARTE les champs inconnus plutôt que de les refuser, et c'est le
    // comportement voulu — mais il ne doit surtout pas les CONSERVER.
    expect(Object.keys(saisie.data ?? {})).not.toContain("montant_mineur");
    expect(Object.keys(saisie.data ?? {})).not.toContain("taux_horaire");
    expect(Object.keys(saisie.data ?? {})).not.toContain("forfait_id");
  });
});

describe("la durée standard, et les trois états qu'elle distingue", () => {
  it("nulle quand personne ne l'a estimée", () => {
    const lu = schemaPrestation.parse({ code: "D", libelle: "Diagnostic" });
    expect(lu.duree_standard_min).toBeNull();
  });

  it("ZÉRO est refusé — une prestation qui dure zéro minute n'en est pas une", () => {
    expect(
      schemaPrestation.safeParse({
        code: "D",
        libelle: "Diagnostic",
        duree_standard_min: 0,
      }).success,
    ).toBe(false);
  });

  it("LE CAS QUI DOIT RESTER VERT — une durée positive passe", () => {
    expect(
      schemaPrestation.parse({
        code: "D",
        libelle: "Diagnostic",
        duree_standard_min: 90,
      }).duree_standard_min,
    ).toBe(90);
  });
});

describe("le module de prestations ne parle jamais d'argent", () => {
  it("aucun fichier de `lib/prestations/` n'importe la tarification", () => {
    // *Un seul endroit où l'argent est écrit* : si ce module devait un jour
    // composer un montant, il le ferait en important `lib/tarification/` ou
    // `lib/money/` — et c'est cet import-là qui doit rougir, pas le montant.
    const racine = join(process.cwd(), "lib/prestations");
    const fichiers = readdirSync(racine);
    expect(fichiers.length).toBeGreaterThan(0);
    for (const fichier of fichiers) {
      const texte = readFileSync(join(racine, fichier), "utf8");
      const imports = texte
        .split("\n")
        .filter((ligne) => ligne.startsWith("import "));
      expect(imports.join("\n")).not.toContain("lib/tarification");
      expect(imports.join("\n")).not.toContain("lib/money");
    }
  });
});
