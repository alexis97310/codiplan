import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import * as dictionnaire from "@/lib/i18n";

import { RACINE, fichiersSource } from "../outils/fichiers-source";
import {
  type Analyse,
  type ChaineVisible,
  type Marque,
  accesseursDictionnaire,
  analyser,
} from "../outils/rendu-visible";

/**
 * Gardien du ticket L0-11 : **aucune chaîne visible écrite hors du
 * dictionnaire**.
 *
 * **Ce qu'une chaîne en dur coûte.** D26 tranche que le français est en dur en
 * V1, et pose la seule contrainte qui coûte zéro aujourd'hui et évite la
 * réécriture plus tard : rien de visible n'est écrit dans un composant.
 * Recopier « Planning » dans une page, c'est décider que l'ajout d'une langue
 * consistera à parcourir deux cents composants — et, bien avant cela, que deux
 * écrans nommeront la même chose de deux façons. C'est la même faute que le
 * fuseau en dur et que `code_winpro` : un paramétrage transformé en constante
 * de compilation.
 *
 * **LA COUPURE** — ce qui doit passer par le dictionnaire et ce qui ne le doit
 * pas — est écrite une fois, en tête de `lib/i18n/fr.ts`, et pas ici : elle est
 * une règle du produit, pas une propriété de ce gardien. En deux mots : ce
 * qu'un humain lit en se servant de l'application y passe ; ce qu'un
 * développeur ou une machine lit — message de gardien, exception technique,
 * trace, erreur de migration, libellé de test — n'y passe pas.
 *
 * **CE QUI DÉCIDE QU'UN FICHIER EST CONCERNÉ SE DÉDUIT, IL NE S'ÉNUMÈRE PAS.**
 * Le gardien part de TOUT le dépôt — pas d'une liste de répertoires de rendu,
 * qu'un ticket ultérieur aurait oublié de compléter, comme la liste des tables
 * de I1 l'avait été trois fois. Un fichier est concerné s'il porte l'une des
 * trois marques de `rendu-visible.ts`, et chacune est un fait du cadre
 * technique : il contient du JSX, il exporte les `metadata` de Next.js, ou il
 * interroge l'écran. Une page écrite demain est concernée le jour où elle est
 * écrite, sans que personne ne revienne inscrire son répertoire quelque part.
 *
 * **Il n'y a donc AUCUNE liste d'exemptions.** `lib/i18n/fr.ts` porte des
 * centaines de chaînes et n'est pas exempté : il ne rend rien, ne déclare pas
 * de métadonnées, n'interroge pas l'écran. Le seul « laissez-passer » est une
 * référence au dictionnaire dans un emplacement visible, et il est lui-même
 * déduit — des fonctions et objets réellement exportés par `lib/i18n`, résolus
 * à travers les alias d'import du fichier examiné.
 *
 * **Éprouvé selon les six formes du §9 du CLAUDE.md**, dont les trois que le
 * ticket nomme parce qu'un correcteur bien intentionné les écrit vraiment : la
 * chaîne dans un attribut, la chaîne concaténée, le texte d'un test de rendu.
 * Le verdict de chaque forme est un scénario ci-dessous, pas une opinion. La
 * sixième passe, et le gardien le dit lui-même.
 */

const ACCESSEURS = accesseursDictionnaire(
  dictionnaire as unknown as Record<string, unknown>,
);

/** Tout le dépôt. Les répertoires ignorés le sont par `fichiersSource`. */
const ANALYSES: Analyse[] = fichiersSource(["."]).map((fichier) =>
  analyser(fichier.chemin, fichier.contenu, ACCESSEURS),
);

const CONCERNES = ANALYSES.filter((analyse) => analyse.marques.length > 0);

/** Analyse un extrait fabriqué, sous le nom de fichier qui décide du dialecte. */
function extrait(code: string, chemin = "app/essai.tsx"): ChaineVisible[] {
  return [...analyser(chemin, code, ACCESSEURS).chaines];
}

/** Le texte des chaînes visibles d'un extrait. */
function textes(code: string, chemin?: string): string[] {
  return extrait(code, chemin).map((chaine) => chaine.texte);
}

/** Lit un fichier réel du dépôt — pour les greffes de la forme 5. */
function reel(chemin: string): string {
  return readFileSync(join(RACINE, chemin), "utf8");
}

const IMPORT_DICTIONNAIRE = 'import { fr, t } from "@/lib/i18n";\n';

describe("aucune chaîne visible hors du dictionnaire (L0-11)", () => {
  /**
   * Le TÉMOIN. Un décompte nul ressemble toujours à un sans-faute (§9) : si le
   * parcours ne lisait rien, ou si aucune des trois marques ne reconnaissait
   * jamais rien, la règle ci-dessous serait verte sans avoir rien regardé.
   */
  it("parcourt le dépôt, et chacune des trois marques voit un fichier réel", () => {
    expect(ANALYSES.length).toBeGreaterThan(100);
    expect(CONCERNES.length).toBeGreaterThan(4);

    const observees = new Set<Marque>(
      CONCERNES.flatMap((analyse) => analyse.marques),
    );
    const attendues: Marque[] = [
      "rend du JSX",
      "exporte des métadonnées",
      "interroge l'écran",
    ];
    for (const marque of attendues) {
      expect(
        observees.has(marque),
        `aucun fichier du dépôt ne porte la marque « ${marque} » : ` +
          "le gardien ne la vérifie donc sur rien",
      ).toBe(true);
    }
  });

  it("aucun emplacement visible ne porte de chaîne écrite en dur", () => {
    const fautes = CONCERNES.flatMap((analyse) =>
      analyse.chaines.map(
        (chaine) =>
          `${analyse.chemin}:${chaine.ligne} — ${chaine.emplacement} : « ${chaine.texte} »`,
      ),
    );

    expect(
      fautes,
      "une chaîne visible est écrite hors du dictionnaire (D26) : tout ce " +
        "qu'un humain lit passe par lib/i18n/fr.ts, y compris le texte " +
        "attendu par un test de rendu",
    ).toEqual([]);
  });
});

describe("le gardien éprouvé sur les six formes équivalentes (§9)", () => {
  it("forme 1 — GRAPHIE : guillemets, casse, retours à la ligne, gabarits", () => {
    const fautes = [
      "<h1>Planning</h1>",
      "<h1>PLANNING</h1>",
      "<h1>\n  Planning\n  des interventions\n</h1>",
      '<h1>{"Planning"}</h1>',
      "<h1>{'Planning'}</h1>",
      "<h1>{`Planning`}</h1>",
      '<img alt="Photo de la machine" />',
      "<img alt='Photo de la machine' />",
      "<>Planning</>",
    ];
    for (const faute of fautes) {
      expect(textes(faute), `non détecté : ${faute}`).not.toEqual([]);
    }
  });

  it("forme 2 — ENVELOPPE : attribut, concaténation, gabarit, tableau, appel", () => {
    // Les trois formes que le ticket nomme sont ici : l'attribut, la
    // concaténation, et le texte d'un test de rendu (dernière ligne).
    const fautes = [
      '<button title="Enregistrer" />',
      '<button aria-label="Fermer la fenêtre" />',
      '<p>{"Bonjour " + prenom}</p>',
      "<p>{`Bonjour ${prenom}`}</p>",
      '<p>{["Bonjour", prenom].join(" ")}</p>',
      '<p>{formater("Bonjour")}</p>',
      '<p>{actif ? "En cours" : "Terminée"}</p>',
      '<div dangerouslySetInnerHTML={{ __html: "<b>Bonjour</b>" }} />',
      'screen.getByText("Bonjour");',
      'expect(page.getByRole("heading", { name: "Bonjour" }));',
      'await expect(page).toHaveTitle("CODIPLAN");',
    ];
    for (const faute of fautes) {
      expect(textes(faute), `non détecté : ${faute}`).not.toEqual([]);
    }

    // Le périmètre ne retire JAMAIS les chaînes littérales — c'est là, et
    // presque uniquement là, qu'un libellé s'écrit. La seule coupure que
    // l'analyse s'autorise est « documentation contre exécution » : un
    // commentaire n'est pas un nœud de l'arbre, et ne peut rien afficher.
    expect(
      textes(
        `${IMPORT_DICTIONNAIRE}<p>{/* Affiche « Planning » */ t("app.nom")}</p>;`,
      ),
    ).toEqual([]);
  });

  it("forme 3 — DEUX TEMPS : la chaîne déclarée ici, affichée là", () => {
    // C'est l'ÉTAT FINAL qui compte, pas le verbe qui l'installe : une
    // constante remontée en tête de fichier reste une chaîne visible.
    const fautes = [
      'const TITRE = "Planning";\n<h1>{TITRE}</h1>;',
      "const TITRE = `Planning`;\n<h1>{TITRE}</h1>;",
      'const LIBELLES = { titre: "Planning" };\n<h1>{LIBELLES.titre}</h1>;',
      'const AIDE = "Fermer";\n<button aria-label={AIDE} />;',
      'const ATTENDU = "Planning";\nscreen.getByText(ATTENDU);',
    ];
    for (const faute of fautes) {
      expect(textes(faute), `non détecté : ${faute}`).not.toEqual([]);
    }
  });

  it("forme 4 — L'EXEMPTION elle-même : elle ne fait entrer aucune faute", () => {
    // (a) Il n'y a pas d'exemption de FICHIER. Importer le dictionnaire ne
    //     couvre pas le reste du fichier : la faute posée à côté est prise.
    expect(textes(`${IMPORT_DICTIONNAIRE}<h1>{t("app.nom")}</h1>;`)).toEqual(
      [],
    );
    expect(
      textes(
        `${IMPORT_DICTIONNAIRE}<h1>{t("app.nom")}</h1>;\n<p>Planning</p>;`,
      ),
    ).toEqual(["Planning"]);

    // (b) L'exemption suit l'IMPORT, pas le nom. Un alias est reconnu…
    expect(
      textes(
        'import { t as traduire } from "@/lib/i18n/fr";\n<h1>{traduire("app.nom")}</h1>;',
      ),
    ).toEqual([]);
    //     …et la faute écrite dans le même fichier reste prise.
    expect(
      textes(
        'import { t as traduire } from "@/lib/i18n/fr";\n' +
          '<h1>{traduire("app.nom")}</h1>;\n<p>Planning</p>;',
      ),
    ).toEqual(["Planning"]);

    // (c) Une fonction locale nommée `t`, sans import du dictionnaire, ne
    //     donne aucun droit : c'est le laissez-passer le plus facile à
    //     fabriquer, et il ne passe pas.
    expect(
      textes('function t(x) { return x; }\n<h1>{t("Planning")}</h1>;'),
    ).toEqual(["Planning"]);

    // (d) Le chemin d'import est RÉSOLU, pas comparé : la forme voisine que
    //     seul un fichier du répertoire peut écrire est reconnue (leçon du
    //     21/08 sur `./paques`), et un module homonyme ailleurs ne l'est pas.
    expect(
      textes(
        'import { t } from "./fr";\n<h1>{t("app.nom")}</h1>;',
        "lib/i18n/essai.tsx",
      ),
    ).toEqual([]);
    expect(
      textes(
        'import { t } from "../i18n/fr";\n<h1>{t("app.nom")}</h1>;',
        "lib/theme/essai.tsx",
      ),
    ).toEqual([]);
    expect(
      textes('import { t } from "@/lib/i18nautre";\n<h1>{t("Planning")}</h1>;'),
    ).toEqual(["Planning"]);

    // (e) Les accesseurs sont DÉDUITS du module : ce que `lib/i18n` exporte
    //     réellement, et rien d'autre.
    expect([...ACCESSEURS.fonctions].sort()).toEqual([
      "definition",
      "mot",
      "t",
    ]);
    expect([...ACCESSEURS.objets]).toContain("fr");
  });

  it("forme 5 — LA FORME VOISINE, greffée dans les fichiers réels", () => {
    // Ce qu'un correcteur BIEN INTENTIONNÉ écrit — « c'est un mot, je le mets
    // là » — greffé dans les quatre fichiers où la faute se commettrait
    // vraiment : une page, un composant, la mise en page qui porte les
    // métadonnées, et les deux tests de rendu. Jamais dans un fichier fabriqué.
    const greffes: ReadonlyArray<[string, string, string]> = [
      ["app/page.tsx", '{t("accueil.titre")}', "CODIPLAN"],
      [
        "app/page.tsx",
        '{t("accueil.action")}',
        '{"Consulter la documentation"}',
      ],
      [
        "app/page.tsx",
        'variant="outline"',
        'variant="outline" title="Documentation"',
      ],
      ["app/layout.tsx", 'title: t("app.nom")', 'title: "CODIPLAN"'],
      [
        "components/theme/bandeau-societe.tsx",
        "{theme.nom}",
        '{theme.nom ?? "Société inconnue"}',
      ],
      [
        "components/theme/bandeau-societe.tsx",
        'className="text-base font-semibold tracking-tight"',
        'className="text-base font-semibold tracking-tight" aria-label="Nom de la société"',
      ],
      [
        "tests/unit/accueil.test.tsx",
        'name: fr["accueil.titre"]',
        'name: "CODIPLAN"',
      ],
      ["tests/e2e/accueil.spec.ts", 'fr["accueil.titre"]', '"CODIPLAN"'],
    ];

    for (const [chemin, avant, apres] of greffes) {
      const source = reel(chemin);
      expect(textes(source, chemin), `${chemin} n'est pas propre`).toEqual([]);

      const greffe = source.replace(avant, apres);
      expect(greffe, `greffe inopérante sur ${chemin} : « ${avant} »`).not.toBe(
        source,
      );
      expect(
        textes(greffe, chemin),
        `greffe non détectée sur ${chemin} : « ${apres} »`,
      ).not.toEqual([]);
    }
  });

  it("forme 5 bis — la MARQUE aussi se vérifie sur le fichier réel", () => {
    // Le dictionnaire porte toutes les chaînes du produit et n'est pas
    // concerné : il ne rend rien. Ce n'est pas une exemption, c'est une
    // déduction — et elle bascule le jour où le fichier se met à rendre.
    const chemin = "lib/i18n/fr.ts";
    const source = reel(chemin);
    expect(analyser(chemin, source, ACCESSEURS).marques).toEqual([]);

    const devenuComposant = `${source}\nexport function Aide() {\n  return <p>Aide</p>;\n}\n`;
    const analyse = analyser("lib/i18n/fr.tsx", devenuComposant, ACCESSEURS);
    expect(analyse.marques).toContain("rend du JSX");
    expect(analyse.chaines.map((chaine) => chaine.texte)).toEqual(["Aide"]);
  });

  it("forme 6 — CE QUI RESTE HORS DE PORTÉE, et le gardien le dit", () => {
    // Un gardien statique arrête la correction bien intentionnée, pas un
    // contournement décidé — ni ce qui n'est simplement pas lisible dans le
    // fichier. Ces quatre écritures passent, et c'est la limite annoncée.
    const horsPortee = [
      // (a) Le texte VIENT D'AILLEURS. Le gardien lit là où le texte est écrit
      //     à l'écran, jamais d'où il vient : une chaîne exportée par un module
      //     et affichée ici lui est invisible. C'est le cas de `NOM_NEUTRE`
      //     (lib/theme/theme.ts), que ce ticket ramène au dictionnaire À LA
      //     MAIN, faute de pouvoir l'y contraindre.
      'import { NOM } from "./constantes";\n<h1>{NOM}</h1>;',
      // (b) Un LIBELLÉ PASSÉ EN PROPRIÉTÉ à un composant. Le nom d'une
      //     propriété est libre : aucune liste statique ne peut distinguer
      //     `libelle="Planning"` de `variant="outline"`. La parade n'est pas un
      //     gardien mais un TYPE — un composant qui affiche du texte reçoit une
      //     `CleTraduction`, jamais une `string`, et le compilateur refuse
      //     alors le littéral.
      '<Badge libelle="Planning" />',
      // (c) Le rendu SANS JSX : `createElement` n'est pas de la syntaxe JSX, le
      //     fichier peut donc ne porter aucune marque.
      'createElement("h1", null, "Planning");',
      // (d) L'assemblage délibéré, comme pour le gardien de D50 — celui qui
      //     n'écrit plus aucune chaîne. La concaténation et le tableau, eux,
      //     sont pris (forme 2) : ce qui reste hors de portée exige d'exécuter
      //     le code, pas de le lire.
      "<h1>{String.fromCharCode(80, 108, 97, 110)}</h1>;",
    ];
    for (const [index, contournement] of horsPortee.entries()) {
      expect(
        textes(contournement),
        `la limite (${"abcd"[index]}) n'en est plus une`,
      ).toEqual([]);
    }
  });

  it("ne crie pas sur ce qui n'atteint pas l'écran", () => {
    const licites = [
      // Des classes, des rôles, des attributs techniques, une URL.
      '<div className="flex items-center gap-4 rounded-lg px-4 py-3" />',
      '<html lang="fr" data-origine-theme="defaut" />',
      '<a href="https://exemple.test/docs" download />',
      '<Button asChild variant="outline" size="sm" />',
      // Le premier argument d'une requête par rôle est un RÔLE ARIA.
      'screen.getByRole("heading", { level: 1 });',
      'await expect(page.locator("html")).toHaveAttribute("lang", "fr");',
      // Une donnée reste une donnée : le nom d'une société vient de la base.
      "<span>{theme.nom}</span>",
      "screen.getByText(SOCIETE_A.raison_sociale);",
      // Un message technique n'est pas de l'écran (l'autre bord de la coupure).
      'throw new Error("societe_id manquant dans le contexte RLS");',
      'console.warn("partition par défaut non vide");',
      // Une clé du dictionnaire n'est pas un libellé.
      'import { t } from "@/lib/i18n";\n<h1>{t("accueil.titre")}</h1>;',
      'import { fr } from "@/lib/i18n";\nscreen.getByText(fr["accueil.socle"]);',
      // Les espaces significatifs du JSX.
      '<p>{t}{" "}{u}</p>',
    ];
    for (const licite of licites) {
      expect(textes(licite), `faux positif : ${licite}`).toEqual([]);
    }
  });
});
