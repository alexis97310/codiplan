import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RACINE } from "../outils/fichiers-source";

/**
 * LES QUATRE BORNES DE L'AMENDEMENT DU §12 (D116, 12/09/2026).
 *
 * ## CE QUE CE GARDIEN TIENT, ET CE QU'IL N'EST PAS
 *
 * D116 laisse une migration atteindre la base de démonstration **sans main**.
 * La décision ne vaut que par ses quatre bornes, et *une règle écrite dans un
 * document que personne ne relit au bon moment n'est pas un gardien : elle en a
 * exactement la forme, et elle ne produit aucun signal quand on l'oublie*
 * (§9, 12/09 — la faute même que D116 répare). Les bornes sont donc ici.
 *
 * **Il est STATIQUE et il l'annonce** : il lit le fichier du flux, il ne peut
 * pas dire ce qu'un exécuteur fera. C'est la forme 6 du §9 du 26/08, et elle
 * s'applique ici avec une force particulière — la MESURE qui la complète est
 * l'exécution réelle du flux, qui ne se joue pas dans `verify`.
 */
const FLUX = join(RACINE, ".github", "workflows", "db-migrate.yml");

function flux(): string {
  return readFileSync(FLUX, "utf8");
}

/** Les lignes EXÉCUTABLES du flux — les commentaires ne gardent rien. */
function executables(): string[] {
  return flux()
    .split("\n")
    .filter((ligne) => !ligne.trim().startsWith("#"));
}

/** Les étapes du flux, découpées sur leur tiret de tête. */
function etapes(): string[] {
  const texte = flux();
  const debut = texte.indexOf("    steps:");
  expect(
    debut,
    "le flux ne porte plus d'étapes : rien n'est mesuré",
  ).toBeGreaterThan(0);
  return texte
    .slice(debut)
    .split(/\n      - /)
    .slice(1);
}

/** L'étape dont la commande contient ce fragment. Lève si elle n'existe pas. */
function etapeQuiJoue(fragment: string): string {
  const trouvees = etapes().filter((e) => e.includes(fragment));
  expect(
    trouvees.length,
    `aucune étape ne joue « ${fragment} » : le gardien ne mesure rien`,
  ).toBe(1);
  return trouvees[0] ?? "";
}

describe("TÉMOIN — le flux est bien celui qu'on croit lire", () => {
  it("il porte des étapes, et l'une d'elles migre", () => {
    expect(etapes().length).toBeGreaterThan(5);
    expect(flux()).toContain("prisma migrate deploy");
  });
});

describe("BORNE 4 — elle ne se déclenche que si prisma/migrations/ a changé", () => {
  it("le déclencheur est un push sur main, RESTREINT par paths", () => {
    const texte = flux();
    expect(texte).toContain("push:");
    expect(texte).toContain("branches: [main]");
    expect(texte).toContain('- "prisma/migrations/**"');
  });

  it("le SEED n'est PAS un déclencheur — D116 n'automatise que le SCHÉMA", () => {
    // *Le cas qui doit rester vert pour sa propre raison* : un gardien qui
    // exigerait « prisma/** » serait vert aussi, et il décrirait une
    // automatisation qui réécrit des données de démonstration à chaque commit.
    const declencheurs = flux().slice(
      flux().indexOf("push:"),
      flux().indexOf("workflow_dispatch:"),
    );
    expect(declencheurs).not.toContain("seed");
    expect(declencheurs).not.toContain('"prisma/**"');
  });
});

describe("BORNE 1 — la production n'est JAMAIS atteinte automatiquement", () => {
  it("la cible est CALCULÉE, jamais héritée d'une entrée vide", () => {
    // Sur un `push`, `inputs.cible` vaut la chaîne vide : un `if` qui ne teste
    // que la production choisirait la démonstration — LE BON RÉSULTAT PAR LE
    // MAUVAIS CHEMIN, et une garantie qui tient à une valeur vide cesse le jour
    // où elle ne l'est plus (la faute mesurée le 09/09).
    const etape = etapeQuiJoue("BORNE 1");
    expect(etape).toContain("github.event_name");
    expect(etape).toContain("workflow_dispatch");
    expect(etape).toContain("cible=demonstration");
  });

  it("et le chemin automatique REFUSE explicitement la production", () => {
    const etape = etapeQuiJoue("BORNE 1");
    expect(etape).toMatch(
      /automatique[\s\S]*"oui"[\s\S]*cible[\s\S]*!=[\s\S]*demonstration/,
    );
    expect(etape).toContain("exit 1");
  });

  it("plus AUCUNE étape ne lit `inputs.cible` — une seule lecture du critère", () => {
    // §9, 01/09 : deux lectures d'un même critère divergent en silence. La
    // cible se décide UNE fois, dans l'étape ci-dessus, et les autres étapes
    // lisent sa sortie. Une étape restée sur `inputs.cible` se comporterait
    // comme si la cible était vide sur le chemin automatique.
    const fautives = executables()
      .filter((l) => l.includes("inputs.cible"))
      .filter((l) => !l.includes("CIBLE_DEMANDEE"));
    expect(
      fautives,
      "ces lignes lisent l'entrée brute au lieu de la cible décidée",
    ).toEqual([]);
  });
});

describe("BORNE 2 — la purge n'est JAMAIS automatique", () => {
  it("elle exige un workflow_dispatch, EN PLUS de sa case", () => {
    const etape = etapeQuiJoue("purge-demonstration.mts");
    expect(etape).toContain("github.event_name == 'workflow_dispatch'");
    expect(etape).toContain("inputs.reinitialiser_demo");
  });

  it("la condition d'événement ne suffit PAS à elle seule, et réciproquement", () => {
    // Les deux moitiés sont exigées ensemble : une purge conditionnée au seul
    // événement partirait à chaque déclenchement manuel, et une purge
    // conditionnée à la seule case tiendrait à ce qu'une entrée soit absente —
    // c'est-à-dire à une valeur vide.
    const etape = etapeQuiJoue("purge-demonstration.mts");
    const condition = /if:\s*\$\{\{([\s\S]+?)\}\}/.exec(etape)?.[1] ?? "";
    expect(condition).toContain("&&");
    expect(condition).toContain("workflow_dispatch");
    expect(condition).toContain("reinitialiser_demo");
  });
});

describe("BORNE 3 — l'automatique refuse une base qui n'est plus une fiction", () => {
  it("le refus est joué, et sur le chemin automatique SEUL", () => {
    const etape = etapeQuiJoue("refus-si-donnees-reelles.mts");
    expect(etape).toContain("steps.cible.outputs.automatique == 'oui'");
  });

  it("il précède la MIGRATION — après, refuser ne sert plus à rien", () => {
    const texte = flux();
    const refus = texte.indexOf("refus-si-donnees-reelles.mts");
    const migre = texte.indexOf("run: pnpm prisma migrate deploy");
    expect(refus).toBeGreaterThan(0);
    expect(migre).toBeGreaterThan(0);
    expect(
      refus,
      "le refus est écrit APRÈS la migration : il constaterait un schéma déjà changé",
    ).toBeLessThan(migre);
  });

  it("et il précède aussi la PURGE et le SEED", () => {
    const texte = flux();
    const refus = texte.indexOf("refus-si-donnees-reelles.mts");
    expect(refus).toBeLessThan(texte.indexOf("purge-demonstration.mts"));
    expect(refus).toBeLessThan(texte.indexOf("run: pnpm db:seed"));
  });
});

describe("ELLE DIT CE QU'ELLE A FAIT — une automatisation muette ne s'audite pas", () => {
  it("les migrations posées entrent au résumé d'exécution", () => {
    const etape = etapeQuiJoue("Migrations appliquées par cette exécution");
    expect(etape).toContain("GITHUB_STEP_SUMMARY");
  });

  it("le résumé est une DIFFÉRENCE, mesurée avant et après", () => {
    // *Une ligne qui ne peut pas bouger sous une faute n'est pas une
    // observation* (§9, 06/09) : recopier `prisma/migrations/` rendrait le même
    // texte que la migration ait abouti ou non.
    const texte = flux();
    const avant = texte.indexOf("migrations-avant.txt");
    const migre = texte.indexOf("run: pnpm prisma migrate deploy");
    const apres = texte.indexOf("migrations-apres.txt");
    expect(avant).toBeGreaterThan(0);
    expect(avant).toBeLessThan(migre);
    expect(apres).toBeGreaterThan(migre);
    expect(etapeQuiJoue("Migrations appliquées par cette exécution")).toContain(
      "comm -13",
    );
  });

  it("« AUCUNE » est un résultat ÉCRIT, jamais un silence", () => {
    // Une exécution qui n'a rien appliqué parce que la base était à jour et une
    // qui n'a rien appliqué parce qu'elle a échoué ne se corrigent pas au même
    // endroit — et un résumé vide se lit comme la première.
    const etape = etapeQuiJoue("Migrations appliquées par cette exécution");
    expect(etape).toContain("**Aucune.**");
    expect(etape).toContain("if: always()");
  });
});
