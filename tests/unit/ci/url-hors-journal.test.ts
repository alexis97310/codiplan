import { execFileSync } from "node:child_process";
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

      const sortie = execFileSync("sed", ["-E", expression ?? ""], {
        input: entree,
        encoding: "utf8",
      });

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

  const sortie = execFileSync("sed", ["-E", expression ?? ""], {
    input: entree,
    encoding: "utf8",
  });
  expect(
    sortie.includes(hote),
    "l'expression laisse passer l'hébergeur : le message brut d'un pilote le nomme (D50)",
  ).toBe(false);
  expect(sortie).toContain("P1001");
});
