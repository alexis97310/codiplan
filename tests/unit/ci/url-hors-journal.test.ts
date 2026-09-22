import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RACINE } from "../outils/fichiers-source";

/**
 * AUCUNE URL N'ATTEINT UN JOURNAL D'EXÉCUTION (12/09/2026).
 *
 * Le flux du premier compte imprimait l'URL de premier accès, et il le DISAIT
 * en tête : *« elle entre dans le journal d'exécution, lisible par quiconque a
 * accès en lecture à ce dépôt »*. Ce qui rendait la chose acceptable était une
 * condition — *« le dépôt est PRIVÉ »* — qui tient à un **attribut du dépôt**,
 * lequel change d'un clic. Et le clic ne publie pas seulement l'avenir : **il
 * publie le passé**, jeton compris. C'est la même famille que la mise en garde
 * du README sur la planification nocturne : *une garantie qui repose sur un
 * attribut extérieur à la chose garantie s'écrit là où l'on change cet
 * attribut* — et, quand on peut, se remplace par une garantie qui ne dépend
 * plus de lui.
 *
 * LA POPULATION EST DE DEUX FLUX, ET LE SECOND N'IMPRIME PAS DE SECRET
 * VOLONTAIREMENT. « Amorcer une base » rend un UUID de ligne, qui n'en est pas
 * un ; ce qu'il peut rendre SANS L'AVOIR VOULU en est un — le script relance
 * toute erreur qu'il ne reconnaît pas, et le message brut d'un pilote nomme
 * l'hébergeur et la région (D50). La faute a la même forme des deux côtés, et
 * une règle écrite pour un seul fichier laisse l'autre au premier ticket venu.
 *
 * Ce gardien est statique et il l'annonce : il lit les fichiers de flux, il ne
 * peut pas dire ce qu'un exécuteur fera. Ce qu'il refuse est le retour de la
 * faute telle qu'elle se commettrait — un `tee`, ou un `cat` de la sortie
 * brute.
 */
type Flux = {
  /** Le fichier de flux, sous `.github/workflows/`. */
  readonly fichier: string;
  /** L'étape privilégiée, celle dont la sortie porte le risque. */
  readonly ouverture: string;
  /** L'étape qui recopie au résumé — même visibilité que le journal. */
  readonly resume: string;
  /** Le fichier de sortie BRUTE : il porte l'URL, et ne se rend jamais. */
  readonly brute: string;
  /** Le fichier EXPURGÉ : la seule chose que le flux ait le droit de rendre. */
  readonly expurge: string;
};

const FLUX: readonly Flux[] = [
  {
    fichier: "premier-compte.yml",
    ouverture: "Ouvrir la première identité",
    resume: "Reporter la sortie EXPURGÉE dans le résumé",
    brute: "/tmp/amorcage.txt",
    expurge: "/tmp/amorcage-expurge.txt",
  },
  {
    fichier: "amorcage-base.yml",
    ouverture: "Ouvrir la première société",
    resume: "Reporter l'identifiant de la société",
    brute: "/tmp/societe.txt",
    expurge: "/tmp/societe-expurge.txt",
  },
  // Les deux gestes ajoutés le 22/09/2026 (AMORCAGE-2) appellent des scripts
  // qui relancent tels quels ce qu'ils ne reconnaissent pas — la faute a la
  // même forme, et la population la suit plutôt que de la laisser au premier
  // ticket venu.
  {
    fichier: "amorcage-base.yml",
    ouverture: "Poser le premier taux horaire",
    resume: "Reporter le taux horaire posé",
    brute: "/tmp/taux.txt",
    expurge: "/tmp/taux-expurge.txt",
  },
  {
    fichier: "amorcage-base.yml",
    ouverture: "Étendre l'horizon des jours fériés",
    resume: "Reporter l'horizon des fériés",
    brute: "/tmp/feries.txt",
    expurge: "/tmp/feries-expurge.txt",
  },
];

function texteDe(flux: Flux): string {
  const texte = readFileSync(
    join(RACINE, ".github", "workflows", flux.fichier),
    "utf8",
  );
  // TÉMOIN : un fichier vide ou renommé rendrait toute assertion creuse.
  expect(
    texte.length,
    `${flux.fichier} est vide ou introuvable : le gardien ne mesure rien`,
  ).toBeGreaterThan(500);
  return texte;
}

/** Les étapes du flux, découpées sur leur tiret de tête. */
function etapes(flux: Flux): string[] {
  const texte = texteDe(flux);
  const debut = texte.indexOf("    steps:");
  expect(
    debut,
    `${flux.fichier} ne porte plus d'étapes : rien n'est mesuré`,
  ).toBeGreaterThan(0);
  return texte
    .slice(debut)
    .split(/\n      - /)
    .slice(1);
}

/**
 * L'unique étape portant ce nom.
 *
 * La sélection se fait sur le NOM et non sur un fragment de commande : le
 * résumé CITE la commande de réémission dans sa consigne de récupération, si
 * bien qu'un fragment en désigne deux. Un critère de sélection ambigu est un
 * gardien qui mesure la mauvaise étape.
 */
function etapeNommee(flux: Flux, nom: string): string {
  const trouvees = etapes(flux).filter((e) => e.startsWith(`name: ${nom}`));
  expect(
    trouvees.length,
    `${flux.fichier} : aucune étape nommée « ${nom} » : le gardien ne mesure rien`,
  ).toBe(1);
  return trouvees[0] ?? "";
}

/**
 * Les seules LIGNES QUI S'EXÉCUTENT d'une étape — les commentaires retirés.
 *
 * La coupure légitime est « documentation contre exécution » (D50, et le §9 du
 * 26/08 sur les six formes) : une note qui NOMME la faute qu'elle interdit ne
 * la commet pas. Ce gardien a d'abord échoué sur sa propre note — « un `tee`
 * rendait l'URL… » —, ce qui est la démonstration qu'un périmètre non coupé
 * mesure le texte au lieu du geste.
 */
function commandesDe(etape: string): string {
  return etape
    .split("\n")
    .filter((ligne) => !ligne.trim().startsWith("#"))
    .join("\n");
}

/**
 * PRONONCE une commande `s` de `sed -E` — en JavaScript, sans le binaire.
 *
 * **Pourquoi pas `sed` lui-même.** Ce gardien l'appelait par `execFileSync`,
 * et il n'existe pas sous Windows : mesuré le 22/09/2026, `spawnSync sed
 * ENOENT` sur un poste où le dépôt venait d'être cloné (PORTABILITE-1). Un
 * gardien qui exige un binaire Unix ne garde rien sur la moitié des postes
 * auxquels ce dépôt est destiné.
 *
 * **Ce qu'il traduit, et ce qu'il REFUSE.** Une commande `s<d>motif<d>rempl<d>
 * drapeaux`, où le motif est une expression rationnelle étendue (ERE) : les
 * classes POSIX `[:space:]` et voisines deviennent leur équivalent
 * JavaScript, `&` et `\1` du remplacement deviennent `$&` et `$1`. Tout ce
 * qu'il ne sait pas traduire à l'identique — un autre verbe que `s`, un
 * drapeau autre que `g`/`i`, une classe inconnue, un échappement de lettre
 * dont le sens diverge entre les deux moteurs — est un REFUS qui lève, jamais
 * une traduction approchée : *une traduction approchée qui laisse passer le
 * jeton fait rougir, ce qui se voit ; une qui le retire pour une autre raison
 * que celle du flux fait passer, ce qui ne se voit pas.*
 *
 * **Et il porte son témoin d'indépendance** : là où `sed` est présent — en CI,
 * qui est là où le flux s'exécute réellement —, sa sortie est confrontée à
 * celle du binaire sur les expressions mêmes des deux flux (§9, 01/09 : la
 * force vient d'une source qu'on ne contrôle pas).
 */
const CLASSES_POSIX: Readonly<Record<string, string>> = {
  "[:space:]": "\\s",
  "[:blank:]": " \\t",
  "[:alnum:]": "A-Za-z0-9",
  "[:alpha:]": "A-Za-z",
  "[:digit:]": "0-9",
  "[:upper:]": "A-Z",
  "[:lower:]": "a-z",
  "[:punct:]": "!-/:-@\\[-`{-~",
};

export function prononcerSed(commande: string, entree: string): string {
  const verbe = commande[0];
  const delimiteur = commande[1];
  if (verbe !== "s" || delimiteur === undefined || delimiteur === "\\") {
    throw new Error(`commande sed non prononçable : « ${commande} »`);
  }
  if (commande.includes(`\\${delimiteur}`)) {
    throw new Error(
      `délimiteur échappé dans la commande, non prononçable : « ${commande} »`,
    );
  }
  const parties = commande.slice(2).split(delimiteur);
  if (parties.length !== 3) {
    throw new Error(
      `commande sed non prononçable — attendu s${delimiteur}motif` +
        `${delimiteur}remplacement${delimiteur}drapeaux : « ${commande} »`,
    );
  }
  const [motif = "", remplacement = "", drapeaux = ""] = parties;
  if (!/^[gi]*$/.test(drapeaux)) {
    throw new Error(`drapeaux sed non prononçables : « ${drapeaux} »`);
  }

  let motifJs = motif;
  for (const [classe, equivalent] of Object.entries(CLASSES_POSIX)) {
    motifJs = motifJs.split(classe).join(equivalent);
  }
  if (/\[:[a-z]+:\]/.test(motifJs)) {
    throw new Error(`classe POSIX inconnue dans le motif : « ${motif} »`);
  }
  // Un échappement de lettre n'a pas le même sens dans les deux moteurs (`\d`
  // est une classe ici et la lettre « d » là) — sauf les six que GNU sed
  // partage avec JavaScript. Le reste est refusé plutôt que deviné.
  const lettreEchappee = /\\([A-Za-z])/.exec(motifJs);
  if (lettreEchappee !== null && !/^[sSwWbB]$/.test(lettreEchappee[1] ?? "")) {
    throw new Error(
      `échappement non portable dans le motif : « \\${lettreEchappee[1]} »`,
    );
  }

  // Le remplacement : `&` de sed est `$&` ici, `\1` est `$1`, et un `$`
  // littéral s'écrit `$$`. Un `\` suivi d'autre chose qu'un chiffre, `&` ou
  // `\` est refusé : `\n` ne veut pas dire la même chose des deux côtés.
  const remplacementJs = remplacement.replace(
    /\\(.)|&|\$/g,
    (jeton: string, echappe: string | undefined) => {
      if (jeton === "&") return "$&";
      if (jeton === "$") return "$$";
      if (echappe !== undefined && /^[0-9]$/.test(echappe))
        return `$${echappe}`;
      if (echappe === "&" || echappe === "\\") return echappe;
      throw new Error(
        `échappement non prononçable dans le remplacement : « \\${echappe} »`,
      );
    },
  );

  return entree.replace(new RegExp(motifJs, drapeaux), remplacementJs);
}

describe.each(FLUX)(
  "aucune URL n'atteint le journal ni le résumé — $fichier",
  (flux) => {
    it("la sortie du script va dans un FICHIER, jamais dans le journal", () => {
      const commandes = commandesDe(etapeNommee(flux, flux.ouverture));
      expect(commandes).toContain(`> ${flux.brute} 2>&1`);
      // La faute telle qu'elle se commettait : `| tee`. Elle rend l'URL à
      // l'instant où elle est produite — trop tard pour la masquer.
      expect(
        /\|\s*tee\b/.test(commandes),
        "la sortie brute repasse par « tee » : elle atteint de nouveau le journal",
      ).toBe(false);
    });

    it("le flux masque toute URL AVANT de rendre quoi que ce soit", () => {
      const commandes = commandesDe(etapeNommee(flux, flux.ouverture));
      expect(commandes).toContain("::add-mask::");
      const rangMasque = commandes.indexOf("::add-mask::");
      const rangRendu = commandes.indexOf(`cat ${flux.expurge}`);
      expect(rangMasque, "aucun masque n'est posé").toBeGreaterThan(0);
      expect(
        rangRendu,
        "rien n'est rendu : le gardien ne mesure rien",
      ).toBeGreaterThan(0);
      expect(
        rangMasque,
        "le masque est posé APRÈS le rendu : il ne vaut que pour la suite du journal",
      ).toBeLessThan(rangRendu);
    });

    it("le résumé lit l'EXPURGÉ, et jamais la sortie brute", () => {
      const commandes = commandesDe(etapeNommee(flux, flux.resume));
      // Le sens qui doit rester VERT pour SA PROPRE raison : l'expurgé est bien lu.
      expect(commandes).toContain(`cat ${flux.expurge}`);
      // Le sens qui doit ROUGIR : la brute ne l'est pas.
      expect(
        commandes.includes(`cat ${flux.brute}`),
        "le résumé recopie la sortie brute : il a la même visibilité que le journal",
      ).toBe(false);
    });

    it("l'EXPURGÉ est réellement PRODUIT — sans quoi on garde un fichier que personne n'écrit", () => {
      expect(commandesDe(etapeNommee(flux, flux.ouverture))).toContain(
        `> ${flux.expurge}`,
      );
    });

    it("l'expression d'expurgation RETIRE une URL réellement formée", () => {
      // On ne compare pas une chaîne : on fait PRONONCER l'expression du flux,
      // telle qu'elle y est écrite. Une expression juste-en-apparence qui ne
      // mordrait pas passerait une comparaison de texte.
      const expression = texteDe(flux).match(/sed -E '([^']+)'/)?.[1];
      expect(
        expression,
        "aucune expression d'expurgation dans le flux : rien n'est mesuré",
      ).toBeTruthy();

      const jeton = "p9gpzGk106zEKx4mkx4YuN2G";
      const entree = [
        "  URL DE PREMIER ACCÈS — imprimée UNE FOIS, jamais relisible :",
        `  https://codiplan.example.com/api/auth/reset-password/${jeton}?callbackURL=%2Fpremier-acces`,
        "  À transmettre hors bande.",
      ].join("\n");

      // TÉMOIN INVERSE : le jeton est bien dans l'entrée. Deux absences
      // seraient égales, et la mesure serait creuse.
      expect(entree).toContain(jeton);

      const sortie = prononcerSed(expression ?? "", entree);

      expect(
        sortie.includes(jeton),
        "l'expression laisse passer le jeton : elle n'expurge rien",
      ).toBe(false);
      expect(
        sortie.includes("https://"),
        "l'expression laisse passer l'URL",
      ).toBe(false);
      // Et elle ne mange pas le reste : une expurgation qui vide tout serait
      // « sûre » et illisible, donc contournée au premier incident.
      expect(sortie).toContain("À transmettre hors bande.");
    });
  },
);

/**
 * LE SENS QUI DOIT ROUGIR POUR SA PROPRE RAISON — la chaîne de connexion.
 *
 * Le flux d'amorçage ne rend aucun jeton volontairement ; ce qu'il peut rendre
 * est un message de pilote, et celui-ci nomme l'hébergeur sous une forme que
 * `https?://` ne reconnaît pas. Une expression écrite pour les seules URL web
 * passerait les quatre épreuves ci-dessus et laisserait fuir exactement ce
 * qu'elle est là pour retenir.
 */
it("l'expurgation d'« Amorcer une base » retire une chaîne de connexion PostgreSQL", () => {
  const flux = FLUX[1];
  if (flux === undefined) throw new Error("population vide");
  const expression = texteDe(flux).match(/sed -E '([^']+)'/)?.[1];
  expect(expression, "aucune expression d'expurgation").toBeTruthy();

  const hote = "ep-exemple-123456.ap-southeast-2.exemple.tech";
  const entree = `Error: P1001 — impossible de joindre postgresql://codiplan:motdepasse@${hote}/base?sslmode=require`;
  expect(entree).toContain(hote);

  const sortie = prononcerSed(expression ?? "", entree);
  expect(
    sortie.includes(hote),
    "l'expression laisse passer l'hébergeur : le message brut d'un pilote le nomme (D50)",
  ).toBe(false);
  expect(sortie).toContain("P1001");
});

/**
 * LE PRONONCEUR EST ÉPROUVÉ, sinon il serait le trou du gardien.
 *
 * Il remplace un binaire par une traduction, et *une traduction se croit
 * fidèle jusqu'à ce qu'on la confronte* (§9, 10/09 : deux erreurs identiques
 * ne se contredisent jamais). Trois épreuves : ce qu'il rend sur des cas dont
 * la sortie est écrite à la main ; ce qu'il REFUSE, parce qu'un refus qui lève
 * vaut mieux qu'une approximation silencieuse ; et, là où `sed` existe, la
 * confrontation au binaire lui-même sur les expressions RÉELLES des deux flux.
 */
describe("le prononceur de `sed -E` est éprouvé", () => {
  it("traduit les classes POSIX, le `&` et les groupes comme sed les lit", () => {
    expect(prononcerSed("s#a[[:space:]]+b#(&)#g", "a  b a\tb ab")).toBe(
      "(a  b) (a\tb) ab",
    );
    expect(
      prononcerSed("s/([[:digit:]]+)-([a-z]+)/\\2-\\1/", "12-ab 34-cd"),
    ).toBe("ab-12 34-cd");
    // Sans `g`, une seule occurrence ; avec `i`, la casse est ignorée.
    expect(prononcerSed("s/x/y/", "xx")).toBe("yx");
    expect(prononcerSed("s/x/y/gi", "xX")).toBe("yy");
    // Un `$` littéral du remplacement reste un `$` : JavaScript lui donnerait
    // un sens que sed n'a pas.
    expect(prononcerSed("s/a/$1/", "a")).toBe("$1");
  });

  it("REFUSE ce qu'il ne sait pas traduire à l'identique, au lieu de deviner", () => {
    const refus = [
      "y/abc/xyz/", // un autre verbe que `s`
      "s#a#b#p", // un drapeau qui change la sortie
      "s#[[:xdigit:]]+#x#g", // une classe qu'il ne connaît pas
      "s#\\d+#x#g", // `\d` : chiffre ici, lettre « d » pour sed
      "s#a#b", // une commande tronquée
      "s#a\\#b#c#", // le délimiteur échappé
      "s#a#\\n#", // un échappement de remplacement au sens divergent
    ];
    for (const commande of refus) {
      expect(() => prononcerSed(commande, "abc"), commande).toThrow();
    }
  });

  it("LE CAS QUI DOIT ROUGIR POUR SA PROPRE RAISON : une expression trop étroite laisse passer", () => {
    // Le gardien ne serait rien si le prononceur retirait le jeton pour une
    // autre raison que l'expression. Ici l'expression du flux « premier compte »
    // (`https?://`) est appliquée à une chaîne PostgreSQL : elle doit la laisser
    // intacte, et c'est le sens qui fait rougir l'épreuve d'« Amorcer une base ».
    const etroite = "s#https?://[^[:space:]]+#(URL RETIRÉE)#g";
    const entree = "postgresql://codiplan:motdepasse@hote.exemple/base";
    expect(prononcerSed(etroite, entree)).toBe(entree);
  });

  /**
   * TÉMOIN D'INDÉPENDANCE — confronté au VRAI `sed` quand il est là.
   *
   * La CI tourne sous Linux, où les deux flux s'exécutent : c'est là que la
   * confrontation compte, et là qu'elle joue toujours. Sur un poste sans
   * `sed`, l'épreuve est SAUTÉE et le dit — elle ne passe pas au vert.
   */
  const sedDisponible = (() => {
    try {
      return spawnSync("sed", ["--version"]).error === undefined;
    } catch {
      return false;
    }
  })();

  it.skipIf(!sedDisponible)(
    "rend, sur les expressions réelles des deux flux, exactement ce que le binaire rend",
    () => {
      const entrees = [
        "  https://codiplan.example.com/api/auth/reset-password/p9gpzGk106zEKx4mkx4YuN2G?callbackURL=%2Fpremier-acces\n  À transmettre hors bande.",
        "Error: P1001 — impossible de joindre postgresql://codiplan:motdepasse@ep-exemple-123456.ap-southeast-2.exemple.tech/base?sslmode=require",
        "deux http://a.b/c et https://d.e/f, et un ftp://g.h/i sur\nune seconde ligne sans URL",
      ];
      let confrontations = 0;
      for (const flux of FLUX) {
        const expression = texteDe(flux).match(/sed -E '([^']+)'/)?.[1] ?? "";
        expect(expression).not.toBe("");
        for (const entree of entrees) {
          const binaire = spawnSync("sed", ["-E", expression], {
            input: entree,
            encoding: "utf8",
          });
          expect(binaire.status, binaire.stderr).toBe(0);
          expect(
            prononcerSed(expression, entree),
            `${expression} ⟵ ${entree}`,
          ).toBe(binaire.stdout);
          confrontations += 1;
        }
      }
      // Témoin de non-vacuité : chaque étape de la population, sur chaque
      // entrée — DÉRIVÉ, depuis que la population a grandi (AMORCAGE-2).
      expect(FLUX.length).toBeGreaterThan(0);
      expect(confrontations).toBe(FLUX.length * entrees.length);
    },
  );
});
