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
 * **LES DEUX SENS SONT GARDÉS, et c'est la marque `(prévu)` qui le permet.**
 * La première rédaction n'en gardait qu'un — tout module qui existe doit être
 * énuméré — parce que le §6 mêlait deux choses de nature différente : ce qui
 * EST et ce qui est PLANIFIÉ. `sync/`, `excel/` et `pdf/` y figurent depuis
 * L0-01 et n'existent pas ; les exiger aurait fait échouer la vérification sur
 * un dépôt sain, et la « réparation » aurait été de retirer du §6 le plan qu'il
 * porte.
 *
 * Le sens non gardé était pourtant un vrai trou : un module déclaré qui
 * n'existera jamais ne se remarque pas, et ces trois-là traînaient depuis
 * L0-01. La marque `(prévu)` sépare les deux natures, et les deux sens
 * deviennent alors gardables :
 *
 *   1. tout module ÉNUMÉRÉ et NON marqué `(prévu)` doit exister ;
 *   2. tout module qui EXISTE doit être énuméré ;
 *   3. et un module marqué `(prévu)` qui EXISTE est un écart lui aussi — la
 *      marque est devenue fausse le jour où le module a été écrit, et c'est le
 *      ticket qui l'écrit qui doit la retirer.
 *
 * Le plan reste dans le §6, où il a sa place ; il cesse de se faire passer pour
 * un état.
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
  // AT-05 (16/09/2026) : le §6 a été détaché vers `docs/constitution/`, sans
  // qu'une ligne change — titre « ## 6. » compris, précisément pour que ce
  // motif continue de mordre. Seul le CHEMIN bouge.
  const claude = readFileSync(
    join(process.cwd(), "docs", "constitution", "organisation-du-code.md"),
    "utf8",
  );
  const section = /## 6\. Organisation du code[\s\S]*?```([\s\S]*?)```/.exec(
    claude,
  );
  if (section === null) {
    throw new Error(
      "Le §6 (docs/constitution/organisation-du-code.md) ne contient plus de " +
        "bloc d'arborescence : le gardien " +
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
export type ModuleEnumere = {
  readonly nom: string;
  /** La ligne porte-t-elle la marque `(prévu)` ? */
  readonly prevu: boolean;
};

/** La marque, écrite une fois — les messages d'écart la citent. */
export const MARQUE_PREVU = "(prévu)";

export function modulesEnumeres(bloc: string): ModuleEnumere[] {
  const lignes = bloc.split("\n");
  const depart = lignes.findIndex((ligne) => /^lib\/\s*$/.test(ligne));
  if (depart === -1) {
    throw new Error(
      "La branche « lib/ » a disparu du §6 : le gardien n'a plus rien à " +
        "confronter, et une population vide passerait pour un sans-faute.",
    );
  }

  const modules: ModuleEnumere[] = [];
  for (const ligne of lignes.slice(depart + 1)) {
    if (ligne.trim().length === 0) continue;
    if (!/^\s/.test(ligne)) break;
    const mots = ligne.trim().split(/\s+/);
    const premier = mots[0] ?? "";
    if (premier.endsWith("/")) {
      modules.push({
        nom: premier.slice(0, -1),
        // La marque est cherchée sur la ligne de DÉCLARATION seule, jamais sur
        // les lignes de description qui suivent : une description qui
        // contiendrait le mot ne doit pas marquer le entree.
        prevu: mots.slice(1).join(" ").startsWith(MARQUE_PREVU),
      });
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

/**
 * Écarts entre l'énumération du §6 et le système de fichiers — DANS LES DEUX
 * SENS, plus la marque devenue fausse.
 */
export function ecartsArborescence(
  enumeres: readonly ModuleEnumere[],
  surDisque: readonly string[],
): string[] {
  const ecarts: string[] = [];
  const nomsEnumeres = enumeres.map((entree) => entree.nom);

  // Sens 1 — il existe et n'est pas déclaré.
  for (const nom of surDisque) {
    if (!nomsEnumeres.includes(nom)) {
      ecarts.push(
        `« lib/${nom}/ » existe et n'est pas énuméré au §6 ` +
        `(docs/constitution/organisation-du-code.md). ` +
          "Le §6 est une carte : une carte qui ment est le même défaut qu'une " +
          "procédure fausse — on lui fait confiance, et elle est lue par ceux " +
          "qui connaissent le moins le projet. Un ticket qui ajoute un module " +
          "l'y déclare avec le reste.",
      );
    }
  }

  for (const entree of enumeres) {
    const existe = surDisque.includes(entree.nom);

    // Sens 2 — il est déclaré comme EXISTANT et n'existe pas.
    if (!existe && !entree.prevu) {
      ecarts.push(
        `« lib/${entree.nom}/ » est énuméré au §6 sans la marque ` +
          `« ${MARQUE_PREVU} » et n'existe pas. Le §6 dit deux choses de ` +
          "nature différente — ce qui est, et ce qui est planifié : sans la " +
          "marque, le plan se fait passer pour un état, et un module annoncé " +
          "qui n'arrivera jamais ne se remarque pas.",
      );
    }

    // Sens 3 — la marque a survécu au module qu'elle annonçait.
    if (existe && entree.prevu) {
      ecarts.push(
        `« lib/${entree.nom}/ » porte la marque « ${MARQUE_PREVU} » au §6 et ` +
          "existe pourtant. La marque est devenue fausse le jour où le module " +
          "a été écrit : c'est le ticket qui l'écrit qui la retire, avec le " +
          "reste de sa documentation.",
      );
    }
  }

  return ecarts;
}

describe("le §6 du CLAUDE.md et le disque s'accordent, dans les deux sens", () => {
  const enumeres = modulesEnumeres(arborescence());
  const surDisque = modulesSurDisque();
  const noms = enumeres.map((entree) => entree.nom);

  it("le gardien a réellement lu les deux côtés", () => {
    // Trois témoins. Un bloc introuvable lève déjà ; une branche vide des deux
    // côtés rendrait un écart vide qui ressemblerait à un sans-faute (§9,
    // 30/08). Et si AUCUNE ligne ne portait la marque, le troisième sens ne
    // serait jamais exercé — la marque doit donc exister quelque part.
    expect(enumeres.length).toBeGreaterThanOrEqual(8);
    expect(surDisque.length).toBeGreaterThanOrEqual(5);
    expect(enumeres.filter((entree) => entree.prevu).length).toBeGreaterThan(0);
    expect(noms).toContain("db");
    expect(noms).toContain("i18n");
  });

  it("les deux sens s'accordent, et la marque ne ment pas", () => {
    expect(ecartsArborescence(enumeres, surDisque)).toEqual([]);
  });

  it("`lib/clients/` — le module qui a motivé ce gardien — y est, sans marque", () => {
    expect(surDisque).toContain("clients");
    expect(
      enumeres.find((entree) => entree.nom === "clients")?.prevu,
    ).toBe(false);
  });

  it("les modules marqués sont exactement ceux qui n'existent pas encore", () => {
    // La propriété qui rend les deux sens gardables, énoncée directement.
    const prevus = enumeres
      .filter((entree) => entree.prevu)
      .map((entree) => entree.nom)
      .sort();
    const absents = noms.filter((nom) => !surDisque.includes(nom)).sort();

    expect(prevus).toEqual(absents);
  });

  it("ÉPREUVE : un module créé sans être déclaré est refusé", () => {
    const ecarts = ecartsArborescence(enumeres, [
      ...surDisque,
      "notifications",
    ]);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("lib/notifications/");
    expect(ecarts[0]).toContain("§6");
  });

  it("ÉPREUVE : un module déclaré SANS marque et absent est refusé", () => {
    // Le sens que la première rédaction ne gardait pas, et le trou qu'il
    // ferme : un module annoncé qui n'arrivera jamais ne se remarque pas.
    const ecarts = ecartsArborescence(
      [...enumeres, { nom: "fantome", prevu: false }],
      surDisque,
    );

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("lib/fantome/");
    expect(ecarts[0]).toContain(MARQUE_PREVU);
  });

  it("ÉPREUVE : un module marqué `(prévu)` qui EXISTE est refusé", () => {
    // Le troisième sens : la marque a survécu au module qu'elle annonçait.
    // C'est ce qui arrivera à `excel/` au ticket L1-08 si personne n'y pense.
    const ecarts = ecartsArborescence(
      enumeres.map((entree) =>
        entree.nom === "clients" ? { ...entree, prevu: true } : entree,
      ),
      surDisque,
    );

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("lib/clients/");
    expect(ecarts[0]).toContain("devenue fausse");
  });

  it("un module marqué et absent ne fait PAS échouer — le plan garde sa place", () => {
    // La limite, éprouvée plutôt qu'affirmée : `sync/`, `excel/` et `pdf/` sont
    // au §6 depuis L0-01 et n'existent pas. Le §6 doit pouvoir annoncer un
    // plan sans que la vérification tombe.
    const marquesAbsents = enumeres.filter(
      (entree) => entree.prevu && !surDisque.includes(entree.nom),
    );

    expect(marquesAbsents.length).toBeGreaterThan(0);
    expect(ecartsArborescence(enumeres, surDisque)).toEqual([]);
  });

  it("ÉPREUVE : un §6 vidé de sa branche `lib/` lève plutôt que de passer", () => {
    expect(() => modulesEnumeres("app/\n  api/\n")).toThrow(/lib\//);
  });
});
