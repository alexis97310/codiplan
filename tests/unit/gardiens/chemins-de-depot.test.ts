import { describe, expect, it } from "vitest";

import {
  cheminsDesDepots,
  cheminsDesModules,
  estModuleDeDepot,
  FONCTIONS_SANS_CHEMIN,
  fonctionsExportees,
  MODULES_SANS_CHEMIN,
  resoudre,
} from "../../../scripts/lib/chemins-de-depot";

/**
 * R3-12 — LA MARQUE `LIVRÉ` SE POSE SUR UNE COUCHE, ET PAS SUR UN CHEMIN.
 *
 * ## Ce que ce gardien rend mesurable
 *
 * Les marques du 10/09 ont été posées sur *la prose du ticket, **l'existence du
 * module dans `lib/`**, et l'existence de la table en base.* Les trois prouvent
 * qu'une couche a été écrite ; **aucune ne prouve qu'un humain l'atteigne**, et
 * la relecture honnête de L1-01 est passée à côté pour cette raison exacte.
 *
 * *Une règle écrite dans un document que personne ne relit au bon moment n'est
 * pas un gardien : elle en a la forme, et elle ne produit aucun signal quand on
 * l'oublie* (§9, 12/09). Celui-ci produit le signal.
 *
 * ## Les DEUX directions, et la seconde est celle qu'on oublie
 *
 * Un gardien est un prédicat à deux directions (§9, 11/09) : *il rougit quand il
 * doit*, et *il ne reste vert que quand il le doit*. Les scénarios ci-dessous
 * couvrent les deux — une fonction sans chemin ni motif fait échouer, **et** une
 * exemption dont la fonction a retrouvé un appelant fait échouer aussi. La
 * seconde est la direction permissive, celle qui ne produit jamais de signal
 * toute seule : *une exemption qui ne protège plus rien survit à ce qu'elle
 * exemptait, et le jour où une fonction du même nom reviendra elle héritera
 * d'une exemption que personne ne lui a accordée* (§9, 31/08).
 *
 * ## Ce qu'il NE prétend pas faire
 *
 * Il juge les fonctions des modules `lib/<domaine>/depot*.ts`, et rien d'autre :
 * un module sans dépôt lui échappe à la maille fine — c'est la maille LARGE,
 * celle des modules, qui le rattrape. Il ne dit rien de la **qualité** d'un
 * chemin : une fonction appelée depuis un écran mort compte comme atteinte.
 */

const chemins = cheminsDesDepots();
const modules = cheminsDesModules();

const cle = (e: { module: string; fonction: string }) =>
  `${e.module}#${e.fonction}`;

describe("R3-12 — les chemins vers les fonctions de dépôt", () => {
  it("TÉMOIN — la population n'est pas vide, et elle vient du dépôt", () => {
    // *Un décompte nul ressemble toujours à un sans-faute* (§9, 30/08). Sans ce
    // témoin, une erreur de motif dans `estModuleDeDepot` rendrait zéro
    // fonction et le gardien passerait au vert sur rien.
    expect(chemins.length).toBeGreaterThan(30);
    expect(modules.length).toBeGreaterThan(15);
  });

  it("TÉMOIN — la fermeture transitive ATTEINT réellement quelque chose", () => {
    // Le second témoin, et il porte sur le MÉCANISME : si la résolution des
    // imports était cassée, TOUT serait « sans chemin » et la liste
    // d'exemptions deviendrait la population entière — un gardien qui hurle
    // n'est pas meilleur qu'un gardien muet (§9, 11/09).
    const atteintes = chemins.filter((c) => c.appelants.length > 0);
    expect(atteintes.length).toBeGreaterThan(20);
    // ET UNE FONCTION ATTEINTE DE PROCHE EN PROCHE, pas seulement en direct :
    // c'est ce qui distingue une fermeture transitive d'un `grep` sur `app/`.
    expect(
      modules.some((m) => m.atteintPar.some((a) => a.startsWith("("))),
    ).toBe(true);
  });

  it("toute fonction de dépôt est ATTEINTE, ou nommée avec son motif", () => {
    const orphelines = chemins.filter((c) => c.appelants.length === 0).map(cle);
    const declarees = new Set(FONCTIONS_SANS_CHEMIN.map(cle));
    const sansMotif = orphelines.filter((k) => !declarees.has(k));

    expect(
      sansMotif,
      "une fonction de dépôt n'a AUCUN chemin depuis app/ et ne figure pas " +
        "dans FONCTIONS_SANS_CHEMIN. Une couche qu'aucun humain n'atteint " +
        "n'est pas une fonctionnalité : ou bien un écran l'appelle, ou bien " +
        "elle est nommée avec le travail qui l'ouvrira.",
    ).toEqual([]);
  });

  it("aucune exemption ne survit à son objet — adossement dans les deux sens", () => {
    // LES DEUX FORMES DE RUINE D'UNE EXEMPTION, et la seconde est silencieuse.
    const existantes = new Set(chemins.map(cle));
    const atteintes = new Set(
      chemins.filter((c) => c.appelants.length > 0).map(cle),
    );

    const fantomes = FONCTIONS_SANS_CHEMIN.map(cle).filter(
      (k) => !existantes.has(k),
    );
    expect(
      fantomes,
      "une exemption nomme une fonction qui n'existe pas : elle n'exempte " +
        "plus rien, et la prochaine fonction qui reprendra ce nom héritera " +
        "d'une exemption que personne ne lui a accordée (§9, 31/08).",
    ).toEqual([]);

    const inutiles = FONCTIONS_SANS_CHEMIN.map(cle).filter((k) =>
      atteintes.has(k),
    );
    expect(
      inutiles,
      "une exemption nomme une fonction qui a RETROUVÉ un appelant : elle se " +
        "retire. C'est le sens que le gardien garde — la liste ne rétrécit " +
        "pas sans qu'un chemin existe, et elle ne garde pas d'entrée devenue " +
        "sans objet.",
    ).toEqual([]);
  });

  it("tout motif est écrit, et aucun n'est vide", () => {
    // *Un motif n'est pas une excuse, c'est une échéance.* Un motif vide ne se
    // vérifie pas et ne se retire jamais.
    const muettes = [...FONCTIONS_SANS_CHEMIN, ...MODULES_SANS_CHEMIN].filter(
      (e) => e.motif.trim().length < 20,
    );
    expect(muettes).toEqual([]);
  });

  it("la liste des MODULES sans chemin est close dans les deux sens", () => {
    const observes = modules
      .filter((m) => m.atteintPar.length === 0)
      .map((m) => m.module)
      .sort();
    const declares = MODULES_SANS_CHEMIN.map((m) => m.module).sort();
    expect(
      observes,
      "la liste des modules qu'aucun chemin n'atteint a divergé du dépôt. " +
        "Un module qui gagne un chemin en SORT ; un module qui en perd un y " +
        "ENTRE, avec son motif.",
    ).toEqual(declares);
  });

  it("le cas qui doit rester VERT pour sa propre raison", () => {
    // *À côté de chaque cas qui doit rougir, un cas qui doit rester vert POUR
    // SA PROPRE RAISON* (§9, 11/09). Ici : une fonction de dépôt réellement
    // appelée depuis une route, nommée plutôt que comptée — si la résolution
    // des imports confondait deux modules, ce couple précis tomberait.
    const creerSite = chemins.find(
      (c) => c.module === "lib/sites/depot.ts" && c.fonction === "creerSite",
    );
    expect(creerSite?.appelants).toContain("app/api/sites/creer/route.ts");
    // ET SON VOISIN QUI NE DOIT PAS L'ÊTRE : `supprimerSite` est dans le même
    // fichier, exporté de la même façon, et n'a aucun appelant. La paire tombe
    // dès que le gardien confond « le module est importé » et « la fonction est
    // appelée ».
    const supprimerSite = chemins.find(
      (c) =>
        c.module === "lib/sites/depot.ts" && c.fonction === "supprimerSite",
    );
    expect(supprimerSite?.appelants).toEqual([]);
  });

  it("le motif de module reconnaît un dépôt et refuse ses voisins", () => {
    expect(estModuleDeDepot("lib/sites/depot.ts")).toBe(true);
    expect(estModuleDeDepot("lib/tarification/depot-forfaits.ts")).toBe(true);
    // LES VOISINS QUI DOIVENT RESTER DEHORS : un fichier de règle, un fichier
    // de test, et un dépôt d'un autre étage de l'arborescence.
    expect(estModuleDeDepot("lib/sites/zones.ts")).toBe(false);
    expect(estModuleDeDepot("tests/isolation/depot.ts")).toBe(false);
    expect(estModuleDeDepot("lib/depot.ts")).toBe(false);
  });

  it("la lecture des exports et la résolution des imports sont éprouvées", () => {
    const source = [
      "export function nue() {}",
      "export async function attendue() {}",
      "export const constante = 1;",
      "function privee() {}",
    ].join("\n");
    // Les deux formes qu'un dépôt écrit, et les deux qu'il n'écrit pas.
    expect(fonctionsExportees(source)).toEqual(["nue", "attendue"]);

    // La résolution reconnaît l'alias ET le chemin relatif, et rend `null` sur
    // un paquet externe — sans quoi `node_modules` entrerait dans l'arbre.
    expect(resoudre("app/x/page.tsx", "@/lib/sites/depot")).toBe(
      "lib/sites/depot.ts",
    );
    expect(resoudre("lib/sites/depot.ts", "./zones")).toBe(
      "lib/sites/zones.ts",
    );
    expect(resoudre("app/x/page.tsx", "next/navigation")).toBeNull();
  });
});
