import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Gardien de l'ARBORESCENCE du CLAUDE.md §6 — « Organisation du code ».
 *
 * **Pourquoi il existe.** Le §6 ÉNUMÈRE : il liste les modules de `lib/` un par
 * ligne, avec ce que chacun porte. Une énumération non gardée est une liste qui
 * dérive — c'est la leçon du 20/08 sur les listes closes, et le §6 n'y échappe
 * pas parce qu'il est en prose. Le ticket L1-01 a créé `lib/clients/` et a dû
 * l'y ajouter à la main ; rien n'aurait signalé l'oubli.
 *
 * **UN SEUL SENS EST GARDÉ, et il faut dire lequel.** Tout répertoire qui
 * EXISTE sous `lib/` doit être énuméré au §6. Le sens inverse — un module
 * énuméré qui n'existe pas — ne l'est PAS, et ce n'est pas un oubli : le §6
 * annonce aussi ce qui viendra. `sync/`, `excel/` et `pdf/` y figurent depuis
 * L0-01 et n'existeront qu'aux lots 3, 1 et 3. Les exiger ferait échouer la
 * vérification sur un dépôt parfaitement sain, et la « réparation » serait de
 * retirer du §6 le plan qu'il porte.
 *
 * Le mode de défaillance réel est donc bien celui qui est gardé : **un module
 * créé sans être déclaré**. Un module supprimé sans être retiré du §6 laisse
 * une ligne d'intention, ce que le §6 assume déjà.
 *
 * **Le périmètre s'arrête à `lib/`, et c'est une limite du PARSEUR, pas un
 * choix de rigueur.** Le §6 y écrit un module par ligne, ce qui se lit sans
 * ambiguïté. Les autres branches ne s'y prêtent pas : `app/` énumère des
 * groupes de routes qui n'existent pas encore, `tests/` en met trois sur une
 * ligne, et `docs/` mêle fichiers et répertoires. Un parseur qui prétendrait
 * les lire toutes se tromperait sur les continuations de description — la ligne
 * « jamais de conversion : elle vit dans reporting/ » n'annonce aucun
 * répertoire.
 */

/** Le §6, tel qu'il est écrit, et le bloc de code qu'il contient. */
function arborescence(): string {
  const claude = readFileSync(join(process.cwd(), "CLAUDE.md"), "utf8");
  const section = /## 6\. Organisation du code[\s\S]*?```([\s\S]*?)```/.exec(
    claude,
  );
  if (section === null) {
    throw new Error(
      "Le §6 du CLAUDE.md ne contient plus de bloc d'arborescence : le gardien " +
        "ne peut plus le lire, et son silence ne prouverait rien.",
    );
  }
  return section[1] ?? "";
}

/**
 * Les modules que le §6 énumère sous `lib/`.
 *
 * La règle de lecture est volontairement étroite : on entre dans la branche à
 * la ligne `lib/`, on en sort à la première ligne non indentée, et seul le
 * PREMIER mot d'une ligne indentée compte — s'il se termine par `/`, c'est un
 * module ; sinon, c'est la suite d'une description.
 */
export function modulesEnumeres(bloc: string): string[] {
  const lignes = bloc.split("\n");
  const depart = lignes.findIndex((ligne) => /^lib\/\s*$/.test(ligne));
  if (depart === -1) {
    throw new Error(
      "La branche « lib/ » a disparu du §6 : le gardien n'a plus rien à " +
        "confronter, et une population vide passerait pour un sans-faute.",
    );
  }

  const modules: string[] = [];
  for (const ligne of lignes.slice(depart + 1)) {
    if (ligne.trim().length === 0) continue;
    if (!/^\s/.test(ligne)) break;
    const premier = ligne.trim().split(/\s+/)[0] ?? "";
    if (premier.endsWith("/")) {
      modules.push(premier.slice(0, -1));
    }
  }
  return modules;
}

/** Les répertoires qui existent réellement sous `lib/`. */
export function modulesSurDisque(): string[] {
  return readdirSync(join(process.cwd(), "lib"), { withFileTypes: true })
    .filter((entree) => entree.isDirectory())
    .map((entree) => entree.name)
    .sort();
}

/** Modules présents sur le disque et absents du §6. */
export function ecartsArborescence(
  enumeres: readonly string[],
  surDisque: readonly string[],
): string[] {
  return surDisque
    .filter((module) => !enumeres.includes(module))
    .map(
      (module) =>
        `« lib/${module}/ » existe et n'est pas énuméré au §6 du CLAUDE.md. ` +
        "Le §6 est une carte : une carte qui ment est le même défaut qu'une " +
        "procédure fausse — on lui fait confiance, et elle est lue par ceux " +
        "qui connaissent le moins le projet. Un ticket qui ajoute un module " +
        "l'y déclare avec le reste.",
    );
}

describe("le §6 du CLAUDE.md énumère les modules qui existent", () => {
  const enumeres = modulesEnumeres(arborescence());
  const surDisque = modulesSurDisque();

  it("le gardien a réellement lu les deux côtés", () => {
    // Deux témoins. Un bloc introuvable lève déjà ; une branche vide des deux
    // côtés rendrait un écart vide qui ressemblerait à un sans-faute (§9, 30/08).
    expect(enumeres.length).toBeGreaterThanOrEqual(8);
    expect(surDisque.length).toBeGreaterThanOrEqual(5);
    // Et il lit bien des NOMS de modules, pas des mots de description.
    expect(enumeres).toContain("db");
    expect(enumeres).toContain("i18n");
  });

  it("chaque module présent sur le disque y est déclaré", () => {
    expect(ecartsArborescence(enumeres, surDisque)).toEqual([]);
  });

  it("`lib/clients/` — le module qui a motivé ce gardien — y est", () => {
    expect(surDisque).toContain("clients");
    expect(enumeres).toContain("clients");
  });

  it("ÉPREUVE : un module créé sans être déclaré est refusé", () => {
    // La faute telle qu'elle se commettra : L1-08 crée `lib/excel/`… qui est
    // déjà annoncé. Prenons donc un module que le §6 n'annonce PAS.
    const ecarts = ecartsArborescence(enumeres, [...surDisque, "notifications"]);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("lib/notifications/");
    expect(ecarts[0]).toContain("§6");
  });

  it("un module ANNONCÉ mais pas encore écrit ne fait PAS échouer", () => {
    // La limite, éprouvée plutôt qu'affirmée : `sync/`, `excel/` et `pdf/` sont
    // au §6 depuis L0-01 et n'existent pas. Un gardien qui les réclamerait
    // rendrait le §6 incapable d'annoncer le plan.
    const annoncesNonEcrits = enumeres.filter(
      (module) => !surDisque.includes(module),
    );

    expect(annoncesNonEcrits.length).toBeGreaterThan(0);
    expect(ecartsArborescence(enumeres, surDisque)).toEqual([]);
  });

  it("ÉPREUVE : un §6 vidé de sa branche `lib/` lève plutôt que de passer", () => {
    // Sans cela, supprimer l'arborescence rendrait le gardien vert : il
    // n'énumérerait plus rien, et rien ne manquerait à rien.
    expect(() => modulesEnumeres("app/\n  api/\n")).toThrow(/lib\//);
  });
});
