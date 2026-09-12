import { readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n/fr";
import {
  PREFIXE_VOCABULAIRE,
  VOCABULAIRE,
  definition,
  mot,
  type NotionImposee,
  motDansUnePhrase,
} from "@/lib/i18n/vocabulaire";

import { RACINE } from "../outils/fichiers-source";

/**
 * Gardien du vocabulaire imposé (CLAUDE.md §3, arbitrages D5 et D47, ticket
 * L0-11) : **« agence » et « site » ne s'écrivent qu'à un seul endroit**.
 *
 * **Ce qu'il répare.** D5 a tranché que Ducos, Koné et Dolbeau sont des agences
 * CODIMA et non des sites clients. D47 a dû revenir corriger deux règles du
 * chapitre 10 qui disaient « site » en désignant des agences — non par
 * négligence, mais parce que D5 corrigeait le glossaire et laissait les règles.
 * La leçon de D47 est étroite et utile : **un arbitrage qui corrige un mot doit
 * dire où ce mot est écrit.** Ce gardien répond une fois pour toutes, du côté
 * du code : le mot est écrit sous les clés `vocabulaire.*`, et nulle part
 * ailleurs. Une correction future n'a donc qu'un endroit à visiter.
 *
 * **La règle, et ce qui la rend mécanique.** Toute chaîne littérale de
 * `lib/i18n/fr.ts` est lue — celles des entrées du dictionnaire comme celles
 * des constantes du fichier — et aucune ne peut porter les mots imposés, sauf
 * sous une clé préfixée `vocabulaire.`. Un libellé qui doit parler d'une agence
 * se compose donc à son point d'usage, depuis `mot("agence")`.
 *
 * **La limite, annoncée comme celle du gardien de D50.** Aucun gardien ne peut
 * savoir laquelle des deux notions un auteur voulait désigner : écrire
 * `mot("site")` là où il fallait `mot("agence")` reste possible, et reste faux.
 * Ce qui est garanti est plus étroit, et c'est exactement ce que D47 réparait —
 * le mot juste existe à un seul endroit, il y est défini, et sa définition
 * nomme ce qu'il n'est pas.
 */

const CHEMIN_DICTIONNAIRE = "lib/i18n/fr.ts";

/** Les mots imposés, sous toutes leurs flexions courantes. */
const MOTS_IMPOSES = /\b(?:agences?|sites?)\b/i;

/** Une chaîne littérale du dictionnaire, et l'entrée qui la porte. */
type Litteral = { readonly cle: string | null; readonly texte: string };

/**
 * Toutes les chaînes littérales du fichier, chacune rattachée à l'entrée du
 * dictionnaire qui la contient — ou à `null` si elle vit hors du dictionnaire,
 * dans une constante du fichier par exemple. Une clé n'est jamais rattachée à
 * elle-même : c'est un nom d'entrée, pas un libellé.
 */
export function litterauxDuDictionnaire(source: string): Litteral[] {
  const arbre = ts.createSourceFile(
    CHEMIN_DICTIONNAIRE,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  /** L'entrée de premier niveau du dictionnaire qui contient ce nœud. */
  const cleDe = (noeud: ts.Node): string | null => {
    for (let courant = noeud.parent; courant; courant = courant.parent) {
      if (
        ts.isPropertyAssignment(courant) &&
        ts.isObjectLiteralExpression(courant.parent) &&
        ts.isStringLiteral(courant.name)
      ) {
        return courant.name.text;
      }
    }
    return null;
  };

  const litteraux: Litteral[] = [];
  const visiter = (noeud: ts.Node): void => {
    const estNomDEntree =
      noeud.parent &&
      ts.isPropertyAssignment(noeud.parent) &&
      noeud.parent.name === noeud;

    if (
      !estNomDEntree &&
      (ts.isStringLiteral(noeud) ||
        ts.isNoSubstitutionTemplateLiteral(noeud) ||
        ts.isTemplateHead(noeud) ||
        ts.isTemplateMiddle(noeud) ||
        ts.isTemplateTail(noeud))
    ) {
      litteraux.push({ cle: cleDe(noeud), texte: noeud.text });
    }
    ts.forEachChild(noeud, visiter);
  };

  ts.forEachChild(arbre, visiter);
  return litteraux;
}

/** Les écarts à la règle : les littéraux qui écrivent un mot imposé ailleurs. */
export function ecartsDeVocabulaire(source: string): string[] {
  return litterauxDuDictionnaire(source)
    .filter(
      (litteral) =>
        MOTS_IMPOSES.test(litteral.texte) &&
        !(litteral.cle?.startsWith(PREFIXE_VOCABULAIRE) ?? false),
    )
    .map(
      (litteral) =>
        `${litteral.cle ?? "(hors dictionnaire)"} — « ${litteral.texte.trim()} »`,
    );
}

const SOURCE_REELLE = readFileSync(join(RACINE, CHEMIN_DICTIONNAIRE), "utf8");

const NOTIONS: NotionImposee[] = ["agence", "site"];

describe("le vocabulaire imposé est défini une fois (D5, D47)", () => {
  /** Le TÉMOIN : sans littéraux lus, la règle serait verte sans rien regarder. */
  it("lit réellement les chaînes du dictionnaire", () => {
    const litteraux = litterauxDuDictionnaire(SOURCE_REELLE);
    expect(litteraux.length).toBeGreaterThan(10);

    const porteurs = litteraux.filter((litteral) =>
      MOTS_IMPOSES.test(litteral.texte),
    );
    expect(
      porteurs.length,
      "aucune chaîne du dictionnaire ne porte les mots imposés : " +
        "le motif ne reconnaît donc rien de réel",
    ).toBeGreaterThanOrEqual(2);
    expect(
      porteurs.every((litteral) =>
        litteral.cle?.startsWith(PREFIXE_VOCABULAIRE),
      ),
    ).toBe(true);
  });

  it("aucune autre entrée du dictionnaire n'écrit « agence » ni « site »", () => {
    expect(
      ecartsDeVocabulaire(SOURCE_REELLE),
      "un mot imposé est écrit hors des entrées « vocabulaire.* » : il s'y " +
        "définit une fois, et se compose ailleurs depuis mot(notion)",
    ).toEqual([]);
  });

  it("chaque notion porte son mot, son pluriel et sa définition", () => {
    for (const notion of NOTIONS) {
      const terme = VOCABULAIRE[notion];
      expect(fr[terme.libelle].trim().length).toBeGreaterThan(0);
      expect(fr[terme.pluriel].trim().length).toBeGreaterThan(0);
      expect(fr[terme.definition].trim().length).toBeGreaterThan(20);
      expect(terme.libelle.startsWith(PREFIXE_VOCABULAIRE)).toBe(true);
    }
    expect(mot("agence")).not.toBe(mot("site"));
    expect(mot("agence", true)).not.toBe(mot("agence"));
  });

  /**
   * La DISTINCTION est écrite, pas seulement affirmée. C'est le cœur de D5 :
   * « ces deux mots ne sont jamais interchangeables ». Chaque définition doit
   * donc nommer l'autre notion pour dire ce qu'elle n'est pas — un lecteur qui
   * arrive sur l'une trouve l'autre sans avoir à la chercher.
   */
  it("chaque définition nomme la notion avec laquelle elle ne s'échange pas", () => {
    for (const notion of NOTIONS) {
      const autre = VOCABULAIRE[notion].jamais;
      expect(autre, `${notion} ne peut pas s'exclure elle-même`).not.toBe(
        notion,
      );
      expect(VOCABULAIRE[autre].jamais).toBe(notion);
      expect(
        definition(notion).toLowerCase(),
        `la définition de « ${notion} » ne dit pas qu'elle n'est pas ` +
          `une « ${autre} »`,
      ).toContain(mot(autre).toLowerCase());
    }
  });
});

describe("le gardien du vocabulaire éprouvé sur les six formes (§9)", () => {
  /** Greffe une entrée dans le dictionnaire RÉEL, juste avant sa fermeture. */
  function greffer(entree: string): string {
    const greffe = SOURCE_REELLE.replace(
      "} as const;",
      `  ${entree}\n} as const;`,
    );
    expect(greffe, `greffe inopérante : ${entree}`).not.toBe(SOURCE_REELLE);
    return greffe;
  }

  it("forme 1 — GRAPHIE : casse, flexion, apostrophe, position dans la phrase", () => {
    const fautes = [
      '"planning.titre": "Agence",',
      '"planning.titre": "agence",',
      '"planning.titre": "AGENCES",',
      '"planning.titre": "Planning de l\'agence",',
      '"planning.titre": "Sites du client",',
      '"planning.titre": "Fermeture du site le 24",',
    ];
    for (const faute of fautes) {
      expect(
        ecartsDeVocabulaire(greffer(faute)),
        `non détecté : ${faute}`,
      ).not.toEqual([]);
    }
  });

  it("forme 2 — ENVELOPPE : gabarit, concaténation, constante du fichier", () => {
    const fautes = [
      '"planning.titre": `Planning de l\'agence ${1}`,',
      '"planning.titre": "Planning de l\'" + "agence",',
    ];
    for (const faute of fautes) {
      expect(
        ecartsDeVocabulaire(greffer(faute)),
        `non détecté : ${faute}`,
      ).not.toEqual([]);
    }

    // Le littéral posé HORS du dictionnaire, dans une constante du fichier :
    // il est lu aussi, et rattaché à « (hors dictionnaire) ».
    const horsEntree = SOURCE_REELLE.replace(
      "export const fr = {",
      'const LIBELLE = "Agence";\nexport const fr = {',
    );
    expect(horsEntree).not.toBe(SOURCE_REELLE);
    expect(ecartsDeVocabulaire(horsEntree)).toEqual([
      "(hors dictionnaire) — « Agence »",
    ]);
  });

  it("forme 3 — DEUX TEMPS : le mot recopié dans une constante, puis référencé", () => {
    // C'est l'état final qui compte : déplacer le mot dans une constante ne le
    // sort pas du fichier, et une SECONDE définition du mot est exactement ce
    // que « défini une fois » interdit.
    const deuxTemps = SOURCE_REELLE.replace(
      "export const fr = {",
      'const MOT = "Agence";\nexport const fr = {',
    ).replace("} as const;", '  "planning.titre": MOT,\n} as const;');
    expect(deuxTemps).not.toBe(SOURCE_REELLE);
    expect(ecartsDeVocabulaire(deuxTemps)).not.toEqual([]);
  });

  it("forme 4 — L'EXEMPTION elle-même : un préfixe, pas une ressemblance", () => {
    // (a) Le droit d'écrire le mot vient du PRÉFIXE de la clé. Une clé qui
    //     contient « vocabulaire » ailleurs qu'au début n'en hérite pas.
    expect(
      ecartsDeVocabulaire(greffer('"aide.vocabulaire": "Liste des agences",')),
    ).not.toEqual([]);

    // (b) Une entrée licite dans le même fichier ne fait pas entrer la faute
    //     avec elle : le dictionnaire réel PORTE déjà les entrées du
    //     vocabulaire, et la faute greffée à côté est prise quand même.
    expect(ecartsDeVocabulaire(SOURCE_REELLE)).toEqual([]);
    expect(
      ecartsDeVocabulaire(greffer('"planning.titre": "Toutes les agences",')),
    ).toEqual(["planning.titre — « Toutes les agences »"]);

    // (c) Le nom d'une ENTRÉE n'est pas un libellé : « vocabulaire.agence » est
    //     une clé, elle ne compte pas comme une écriture du mot.
    expect(
      litterauxDuDictionnaire(SOURCE_REELLE).some(
        (litteral) => litteral.texte === "vocabulaire.agence",
      ),
    ).toBe(false);
  });

  it("forme 5 — LA FORME VOISINE, greffée dans le dictionnaire réel", () => {
    // Ce qu'un correcteur bien intentionné écrit le jour où le lot 1 ajoute
    // ses écrans : un libellé de plus, avec le mot dedans. Greffé dans le vrai
    // fichier, jamais dans un fichier fabriqué.
    const voisines = [
      '"site.ferme": "Site fermé à cette heure",',
      '"agence.selection": "Choisir une agence",',
      '"planning.colonne": "Agence de rattachement",',
    ];
    for (const voisine of voisines) {
      expect(
        ecartsDeVocabulaire(greffer(voisine)),
        `non détectée : ${voisine}`,
      ).not.toEqual([]);
    }
  });

  it("forme 6 — CE QUI RESTE HORS DE PORTÉE, et le gardien le dit", () => {
    // (a) LA LIMITE PRINCIPALE, et elle est irréductible : le gardien ne sait
    //     pas laquelle des deux notions l'auteur voulait désigner. C'est
    //     précisément la faute de D47, et aucune lecture statique ne la voit —
    //     seule une relecture humaine le peut.
    expect(mot("site")).toBe(fr["vocabulaire.site"]);

    // (b) Un SYNONYME n'est pas gouverné : « établissement » passe, et c'est
    //     voulu — la définition de l'agence s'en sert pour se dire.
    expect(
      ecartsDeVocabulaire(greffer('"planning.titre": "Établissement",')),
    ).toEqual([]);

    // (c) Le mot écrit dans un COMPOSANT ne relève pas de ce gardien-ci : s'il
    //     atteint l'écran, c'est celui des chaînes visibles qui le prend ; s'il
    //     nomme une variable ou une colonne, il est à sa place.
    expect(ecartsDeVocabulaire("const agence = lireAgence();")).toEqual([]);
  });
});

/**
 * LE MOT AU MILIEU D'UNE PHRASE — et c'est une IMAGE qui l'a demandé.
 *
 * *Mesuré le 13/09/2026 sur la capture du portail :* l'écran affichait
 * **« appelez votre Agence »** et **« Votre Agence vous les transmet »**, avec
 * une capitale au milieu d'une phrase. Le dictionnaire porte le mot sous sa
 * forme d'ÉTIQUETTE — celle d'un en-tête de colonne ou d'un titre d'écran —, et
 * c'est la bonne forme là où il servait jusqu'ici.
 *
 * **Aucune assertion n'aurait pu l'attraper.** Le gardien du vocabulaire
 * vérifie que le mot ne s'écrit nulle part ailleurs ; il ne lit pas la phrase
 * où il tombe. *C'est exactement le §9 du 09/09 : un défaut invisible à toute
 * assertion et évident sur une image.*
 *
 * **La correction se fait au RENDU, jamais au dictionnaire** : une seconde
 * entrée « agence en minuscule » serait une seconde écriture du même mot, et
 * elle divergerait au premier renommage (D5, D47).
 */
describe("un mot imposé se glisse aussi au milieu d'une phrase", () => {
  it("il y descend en minuscule initiale", () => {
    // AUCUN LITTÉRAL : le mot attendu se DÉRIVE de `mot()`, jamais recopié —
    // une chaîne visible écrite dans un test est une chaîne hors dictionnaire
    // (L0-11), et elle deviendrait fausse au premier renommage.
    for (const notion of ["agence", "site"] as const) {
      const etiquette = mot(notion);
      expect(etiquette.charAt(0)).toBe(etiquette.charAt(0).toUpperCase());
      expect(motDansUnePhrase(notion).charAt(0)).toBe(
        etiquette.charAt(0).toLowerCase(),
      );
    }
  });

  it("et le pluriel suit la même règle", () => {
    expect(motDansUnePhrase("site", true)).toBe(
      mot("site", true).toLowerCase(),
    );
    expect(motDansUnePhrase("agence", true).charAt(0)).toBe(
      mot("agence", true).charAt(0).toLowerCase(),
    );
  });

  it("SEULE la première lettre descend — le reste du mot est intact", () => {
    // Le cas qui doit rester vrai pour sa propre raison : `toLowerCase()` sur
    // le mot entier perdrait les capitales internes d'un terme composé futur,
    // et personne ne le verrait tant qu'aucun n'existe.
    for (const notion of ["agence", "site"] as const) {
      expect(motDansUnePhrase(notion).slice(1)).toBe(mot(notion).slice(1));
    }
  });
});
