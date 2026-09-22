import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RACINE } from "../outils/fichiers-source";

/**
 * CHAQUE GESTE DÉCLARÉ AU FLUX D'AMORÇAGE A SON ÉTAPE (AMORCAGE-2, 22/09/2026).
 *
 * Le flux « Amorcer une base » est fait de CASES : une case, une étape, un
 * `if`. C'est ce qui le rend jouable depuis un téléphone par quelqu'un qui n'a
 * pas de terminal — et CODIPLAN est destiné à être vendu : un acheteur n'aura
 * pas ce terminal. Deux gestes de la chaîne de mise en ligne n'avaient AUCUN
 * flux, mesuré par `grep` sur `.github/workflows/` : `pnpm feries:etendre`
 * (sans lui, le planning proposerait des créneaux un 1ᵉʳ mai — D46) et
 * `scripts/taux-initial.mts` (sans lui, aucune intervention ne se valorise).
 *
 * Ce gardien exige que toute case déclarée ait exactement une étape qui joue
 * une commande sous elle, et que toute étape se coche sur une case qui existe
 * — clos dans les DEUX sens : une case sans étape est un bouton qui ne fait
 * rien, une étape sans case est un geste qu'on ne peut pas refuser. La
 * POPULATION est dérivée du fichier de flux — les entrées de type booléen —,
 * jamais d'une liste tenue ici : un geste ajouté demain y entre ce jour-là.
 *
 * Puis deux exigences propres aux deux gestes ajoutés, confrontées aux SCRIPTS
 * qu'ils appellent plutôt que recopiées (§9, 01/09 — la force d'un gardien
 * vient des sources qu'il ne contrôle pas) : le taux horaire est un PRIX,
 * reçu en argument, sans aucune valeur par défaut (CLAUDE.md §8) ; les fériés
 * partent des AGENCES, et l'étape ne passe aucun territoire au script.
 *
 * Statique, et il l'annonce : il lit le fichier du flux, il ne peut pas dire ce
 * qu'un exécuteur fera.
 */
const FLUX = join(RACINE, ".github", "workflows", "amorcage-base.yml");
const SCRIPT_TAUX = join(RACINE, "scripts", "taux-initial.mts");
const SCRIPT_FERIES = join(RACINE, "scripts", "etendre-feries.mts");
const LECTURE_FERIES = join(RACINE, "scripts", "lib", "feries.ts");

function texteFlux(): string {
  const texte = readFileSync(FLUX, "utf8");
  // TÉMOIN : un fichier vide ou renommé rendrait toute assertion creuse.
  expect(
    texte.length,
    "amorcage-base.yml est vide ou introuvable : le gardien ne mesure rien",
  ).toBeGreaterThan(500);
  return texte;
}

type Entree = {
  readonly nom: string;
  readonly type: string;
  /** La valeur brute écrite après `default:`, telle que le YAML la porte. */
  readonly defaut: string;
};

/** Les entrées du `workflow_dispatch`, lues entre `inputs:` et `concurrency:`. */
function entrees(): Entree[] {
  const texte = texteFlux();
  const debut = texte.indexOf("    inputs:");
  const fin = texte.indexOf("\nconcurrency:");
  expect(debut, "le flux ne déclare plus d'entrées").toBeGreaterThan(0);
  expect(fin, "le flux n'a plus de bloc concurrency").toBeGreaterThan(debut);

  const bloc = texte.slice(debut, fin);
  const resultat: Entree[] = [];
  for (const morceau of bloc.split(/\n {6}(?=[a-z_]+:\s*\n)/).slice(1)) {
    const nom = morceau.match(/^([a-z_]+):/)?.[1];
    if (nom === undefined) continue;
    resultat.push({
      nom,
      type: morceau.match(/\n\s+type:\s*(\S+)/)?.[1] ?? "",
      defaut: morceau.match(/\n\s+default:\s*(.*)/)?.[1]?.trim() ?? "",
    });
  }
  return resultat;
}

/** Les étapes du flux, découpées sur leur tiret de tête. */
function etapes(): string[] {
  const texte = texteFlux();
  const debut = texte.indexOf("    steps:");
  expect(debut, "le flux ne porte plus d'étapes").toBeGreaterThan(0);
  return texte
    .slice(debut)
    .split(/\n {6}- /)
    .slice(1);
}

/**
 * Les seules LIGNES QUI S'EXÉCUTENT d'une étape — les commentaires retirés.
 * La coupure est « documentation contre exécution » (D50) : une note qui NOMME
 * ce qu'elle interdit ne le commet pas.
 */
function commandesDe(etape: string): string {
  return etape
    .split("\n")
    .filter((ligne) => !ligne.trim().startsWith("#"))
    .join("\n");
}

function conditionDe(etape: string): string {
  return (
    commandesDe(etape)
      .match(/\n\s+if:\s*(.*)/)?.[1]
      ?.trim() ?? ""
  );
}

/** Les cases : les entrées booléennes du flux — la population, dérivée. */
function gestes(): Entree[] {
  const cases = entrees().filter((e) => e.type === "boolean");
  // TÉMOIN : les deux gestes avec lesquels le flux est né. Sans eux, ce n'est
  // pas ce flux qu'on lit, ou la lecture des entrées est cassée.
  const noms = cases.map((c) => c.nom);
  expect(noms).toContain("poser_referentiels");
  expect(noms).toContain("creer_societe");
  return cases;
}

/** L'unique étape dont les commandes portent ce fragment. */
function etapeQuiJoue(fragment: string): string {
  const trouvees = etapes().filter((e) => commandesDe(e).includes(fragment));
  expect(
    trouvees.length,
    `aucune étape unique ne joue « ${fragment} » : le gardien ne mesure rien`,
  ).toBe(1);
  return trouvees[0] ?? "";
}

/** Rang d'une étape dans le flux, pour comparer des ordres. */
function rangDe(fragment: string): number {
  const rang = etapes().findIndex((e) => commandesDe(e).includes(fragment));
  expect(rang, `étape absente : « ${fragment} »`).toBeGreaterThanOrEqual(0);
  return rang;
}

describe("chaque geste déclaré au flux d'amorçage a son étape (amorcage-base.yml)", () => {
  it("chaque case a EXACTEMENT une étape qui joue une commande sous elle", () => {
    const sansEtape: string[] = [];
    const enDouble: string[] = [];
    for (const geste of gestes()) {
      const porteuses = etapes().filter(
        (e) =>
          conditionDe(e).includes(`inputs.${geste.nom}`) &&
          /\bpnpm\b/.test(commandesDe(e)),
      );
      if (porteuses.length === 0) sansEtape.push(geste.nom);
      if (porteuses.length > 1) enDouble.push(geste.nom);
    }
    expect(
      sansEtape,
      `case(s) déclarée(s) sans aucune étape — un bouton qui ne fait rien : ${sansEtape.join(", ")}`,
    ).toEqual([]);
    expect(
      enDouble,
      `case(s) portée(s) par plusieurs étapes qui jouent une commande : ${enDouble.join(", ")}`,
    ).toEqual([]);
  });

  it("une case décochée ne joue RIEN : la condition est la case, seule", () => {
    // La forme posée par le flux : `if: ${{ inputs.<case> }}`. Une condition
    // composée — un `||`, une négation — pourrait jouer le geste alors que la
    // case est décochée, et c'est le sens qui ne produit aucun signal.
    for (const geste of gestes()) {
      const porteuse = etapes().find(
        (e) =>
          conditionDe(e).includes(`inputs.${geste.nom}`) &&
          /\bpnpm\b/.test(commandesDe(e)),
      );
      expect(
        conditionDe(porteuse ?? ""),
        `« ${geste.nom} » : la condition n'est pas la case seule`,
      ).toBe(`\${{ inputs.${geste.nom} }}`);
    }
  });

  it("aucune étape ne se coche sur une case qui n'existe pas — clos dans les deux sens", () => {
    const declarees = new Set(entrees().map((e) => e.nom));
    const references = etapes()
      .flatMap((e) => [...conditionDe(e).matchAll(/inputs\.([a-z_]+)/g)])
      .map((m) => m[1] ?? "");
    // TÉMOIN : des conditions sont bien lues, sinon « toutes existent » est vide.
    expect(references.length).toBeGreaterThan(0);
    const orphelines = references.filter((nom) => !declarees.has(nom));
    expect(
      orphelines,
      `condition(s) sur une entrée que le flux ne déclare pas : ${orphelines.join(", ")}`,
    ).toEqual([]);
  });

  it("tout geste part DÉCOCHÉ, sauf les référentiels — des faits, rejouables sans dommage", () => {
    // Un geste qui écrit une société ou un prix ne s'exécute pas parce qu'on a
    // oublié de décocher : le défaut est « non ». Les référentiels de
    // plateforme sont la seule exception, et elle est nommée — `upsert` de
    // faits, aucun cliquet à protéger.
    for (const geste of gestes()) {
      expect(geste.defaut, `« ${geste.nom} » : la case part cochée`).toBe(
        geste.nom === "poser_referentiels" ? "true" : "false",
      );
    }
  });
});

describe("le taux horaire est un PRIX : reçu en argument, aucune valeur par défaut (§8)", () => {
  const script = () => readFileSync(SCRIPT_TAUX, "utf8");

  it("l'entrée « montant » n'a AUCUNE valeur : le flux ne décide pas d'un prix", () => {
    const montant = entrees().find((e) => e.nom === "montant");
    expect(montant, "aucune entrée « montant »").toBeDefined();
    expect(montant?.type).toBe("string");
    expect(
      montant?.defaut,
      "le montant porte une valeur par défaut : c'est un prix inventé par le flux",
    ).toBe('""');
  });

  it("l'étape reçoit le montant de la case, et REFUSE de partir quand il est vide", () => {
    const commandes = commandesDe(etapeQuiJoue("taux-initial.mts"));
    expect(commandes).toContain("MONTANT: ${{ inputs.montant }}");
    expect(commandes).toContain('--montant "$MONTANT"');
    // Le refus précède l'appel : un montant vide ne va pas jusqu'au script —
    // il refuserait aussi, mais en parlant d'un entier, pas d'un prix.
    const refus = commandes.indexOf('-z "$MONTANT"');
    const appel = commandes.indexOf("taux-initial.mts");
    expect(refus, "aucun refus sur un montant vide").toBeGreaterThan(0);
    expect(refus).toBeLessThan(appel);
    // Et aucun nombre n'est écrit à côté de l'argument : ce serait le défaut.
    expect(
      /--montant\s+"?\d/.test(commandes),
      "un nombre est écrit après --montant : le flux a inventé un prix",
    ).toBe(false);
  });

  it("les arguments passés sont EXACTEMENT ceux que le script lit", () => {
    // Confrontés au script, jamais recopiés : `argument(argv, "…")` est la
    // seule façon dont scripts/taux-initial.mts lit un argument.
    const lus = [...script().matchAll(/argument\(argv, "([a-z-]+)"\)/g)].map(
      (m) => m[1] ?? "",
    );
    const passes = [
      ...commandesDe(etapeQuiJoue("taux-initial.mts")).matchAll(
        /--([a-z][a-z-]*)/g,
      ),
    ].map((m) => m[1] ?? "");
    // TÉMOIN des deux côtés : deux listes vides seraient égales.
    expect(lus.length).toBeGreaterThan(0);
    expect(passes.length).toBeGreaterThan(0);
    expect([...new Set(passes)].sort()).toEqual([...new Set(lus)].sort());
  });

  it("le cliquet du script est armé sous le nom que le SCRIPT exporte", () => {
    const variable = script().match(
      /export const VARIABLE_CONFIRMATION = "([A-Z_]+)"/,
    )?.[1];
    expect(
      variable,
      "le script n'exporte plus sa variable de confirmation",
    ).toBeTruthy();
    expect(commandesDe(etapeQuiJoue("taux-initial.mts"))).toContain(
      `${variable}: "oui"`,
    );
  });

  it("la société est NOMMÉE par une entrée, jamais devinée : une seule société ne veut pas dire « celle-là »", () => {
    const commandes = commandesDe(etapeQuiJoue("taux-initial.mts"));
    expect(commandes).toContain("SOCIETE: ${{ inputs.societe }}");
    expect(commandes).toContain('--societe "$SOCIETE"');
    expect(entrees().find((e) => e.nom === "societe")?.defaut).toBe('""');
  });
});

describe("les fériés partent des AGENCES (D46) : l'étape ne nomme aucun territoire", () => {
  it("l'étape joue le script d'extension, et lui passe AUCUN argument", () => {
    const commandes = commandesDe(etapeQuiJoue("feries:etendre"));
    // Le script ne lit aucun argument, et c'est mesurable : il n'importe pas
    // `argument`. Un `--territoire` écrit ici serait un territoire inventé.
    expect(readFileSync(SCRIPT_FERIES, "utf8")).not.toContain("argument(argv");
    expect(
      /\s--[a-z]/.test(commandes),
      "l'étape passe un argument à un script qui n'en lit aucun",
    ).toBe(false);
  });

  it("l'étape vise la base DÉLIBÉRÉMENT, par la variable que la lecture regarde en premier", () => {
    // `urlBase()` a un ordre de préséance, et sa première variable est « la
    // seule façon de viser délibérément une base hébergée ». On la lit dans le
    // module plutôt que de la recopier.
    const lecture = readFileSync(LECTURE_FERIES, "utf8");
    const premiere = lecture
      .slice(lecture.indexOf("export function urlBase"))
      .match(/process\.env\.([A-Z_]+)/)?.[1];
    expect(premiere, "urlBase ne lit plus l'environnement").toBeTruthy();
    expect(commandesDe(etapeQuiJoue("feries:etendre"))).toContain(
      `${premiere}: \${{ env.DATABASE_URL }}`,
    );
  });

  it("l'étape vient APRÈS la société : une agence appartient à une société", () => {
    expect(rangDe("societe-initiale.mts")).toBeLessThan(
      rangDe("feries:etendre"),
    );
    expect(rangDe("societe-initiale.mts")).toBeLessThan(
      rangDe("taux-initial.mts"),
    );
  });

  it("sans agence, c'est le SCRIPT qui refuse en le nommant — l'étape relaie, elle n'invente pas", () => {
    // Le refus est dans le script, et il est nommé ici pour que le lecteur du
    // flux sache ce qu'il verra : ce gardien vérifie que la phrase existe
    // encore là où l'étape dit qu'elle est.
    expect(readFileSync(SCRIPT_FERIES, "utf8")).toContain(
      "Aucun territoire n'est rattaché à une agence",
    );
    expect(texteFlux()).toContain(
      "Aucun territoire n'est rattaché à une agence",
    );
  });
});
