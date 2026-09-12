import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RACINE } from "../outils/fichiers-source";

/**
 * L'URL DE PREMIER ACCÈS NE VA PLUS AU JOURNAL (12/09/2026).
 *
 * Le flux imprimait l'URL, et il le DISAIT en tête : *« elle entre dans le
 * journal d'exécution, lisible par quiconque a accès en lecture à ce dépôt »*.
 * Ce qui rendait la chose acceptable était une condition — *« le dépôt est
 * PRIVÉ »* — qui tient à un **attribut du dépôt**, lequel change d'un clic. Et
 * le clic ne publie pas seulement l'avenir : **il publie le passé**, jeton
 * compris. C'est la même famille que la mise en garde du README sur la
 * planification nocturne : *une garantie qui repose sur un attribut extérieur
 * à la chose garantie s'écrit là où l'on change cet attribut* — et, quand on
 * peut, se remplace par une garantie qui ne dépend plus de lui.
 *
 * Ce gardien est statique et il l'annonce : il lit le fichier du flux, il ne
 * peut pas dire ce qu'un exécuteur fera. Ce qu'il refuse est le retour de la
 * faute telle qu'elle se commettrait — un `tee`, ou un `cat` de la sortie
 * brute.
 */
const FLUX = join(RACINE, ".github", "workflows", "premier-compte.yml");

/** Le fichier de sortie BRUTE : il porte l'URL, et ne se rend jamais. */
const BRUTE = "/tmp/amorcage.txt";
/** Le fichier EXPURGÉ : la seule chose que le flux ait le droit de rendre. */
const EXPURGE = "/tmp/amorcage-expurge.txt";

function flux(): string {
  const texte = readFileSync(FLUX, "utf8");
  // TÉMOIN : un fichier vide ou renommé rendrait toute assertion creuse.
  expect(
    texte.length,
    "le flux est vide ou introuvable : le gardien ne mesure rien",
  ).toBeGreaterThan(500);
  return texte;
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

/**
 * L'unique étape portant ce nom.
 *
 * La sélection se fait sur le NOM et non sur un fragment de commande : le
 * résumé CITE la commande de réémission dans sa consigne de récupération, si
 * bien qu'un fragment en désigne deux. Un critère de sélection ambigu est un
 * gardien qui mesure la mauvaise étape.
 */
function etapeNommee(nom: string): string {
  const trouvees = etapes().filter((e) => e.startsWith(`name: ${nom}`));
  expect(
    trouvees.length,
    `aucune étape nommée « ${nom} » : le gardien ne mesure rien`,
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

const OUVERTURE = "Ouvrir la première identité";
const RESUME = "Reporter la sortie EXPURGÉE dans le résumé";

describe("l'URL de premier accès n'atteint ni le journal ni le résumé", () => {
  it("la sortie du script va dans un FICHIER, jamais dans le journal", () => {
    const commandes = commandesDe(etapeNommee(OUVERTURE));
    expect(commandes).toContain(`> ${BRUTE} 2>&1`);
    // La faute telle qu'elle se commettait : `| tee`. Elle rend l'URL à
    // l'instant où elle est produite — trop tard pour la masquer.
    expect(
      /\|\s*tee\b/.test(commandes),
      "la sortie brute repasse par « tee » : elle atteint de nouveau le journal",
    ).toBe(false);
  });

  it("le flux masque toute URL AVANT de rendre quoi que ce soit", () => {
    const commandes = commandesDe(etapeNommee(OUVERTURE));
    expect(commandes).toContain("::add-mask::");
    const rangMasque = commandes.indexOf("::add-mask::");
    const rangRendu = commandes.indexOf(`cat ${EXPURGE}`);
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
    const commandes = commandesDe(etapeNommee(RESUME));
    // Le sens qui doit rester VERT pour SA PROPRE raison : l'expurgé est bien lu.
    expect(commandes).toContain(`cat ${EXPURGE}`);
    // Le sens qui doit ROUGIR : la brute ne l'est pas.
    expect(
      commandes.includes(`cat ${BRUTE}`),
      "le résumé recopie la sortie brute : il a la même visibilité que le journal",
    ).toBe(false);
  });

  it("l'EXPURGÉ est réellement PRODUIT — sans quoi on garde un fichier que personne n'écrit", () => {
    expect(commandesDe(etapeNommee(OUVERTURE))).toContain(`> ${EXPURGE}`);
  });

  it("l'expression d'expurgation RETIRE une URL réellement formée", () => {
    // On ne compare pas une chaîne : on fait PRONONCER l'expression du flux,
    // telle qu'elle y est écrite. Une expression juste-en-apparence qui ne
    // mordrait pas passerait une comparaison de texte.
    const expression = flux().match(/sed -E '([^']+)'/)?.[1];
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
});
