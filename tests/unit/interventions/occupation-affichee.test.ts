import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { t } from "@/lib/i18n/fr";

/**
 * JAMAIS LE POURCENTAGE SEUL — *demande d'exploitation du 10/09/2026*.
 *
 * ## Ce que ce gardien tient, et pourquoi il lit un FICHIER
 *
 * Le calcul est éprouvé ailleurs (`statistiques.test.ts`). Ici, la propriété
 * n'appartient pas au calcul : **elle appartient à l'écran.** Un module peut
 * rendre les deux termes du taux et un composant n'en afficher qu'un — et la
 * chose serait juste, testée, et fausse pour celui qui la lit.
 *
 * C'est la même famille que D56 : *un nombre dont la signification dépend
 * d'autre chose ne voyage jamais seul.* « 82 % » ne dit ni de quoi, ni sur
 * quelle période, ni calculé comment ; deux agences aux calendriers
 * différents produisent deux « 82 % » qui ne se comparent pas.
 *
 * ## Sa limite, annoncée
 *
 * Il lit le TEXTE du composant : un affichage assemblé à l'exécution lui
 * échappe, comme à tout motif statique (§9, 26/08, forme 6). Ce qu'il arrête
 * est la simplification bien intentionnée — *« le taux suffit, la formule
 * alourdit »* —, qui est la façon dont cette règle se perdra si elle se perd.
 */

const COMPOSANT = join(
  process.cwd(),
  "app/(back-office)/planning/statistiques.tsx",
);

function source(): string {
  return readFileSync(COMPOSANT, "utf8");
}

/**
 * Ce que le composant DOIT porter dès lors qu'il affiche un taux. Les clés sont
 * nommées telles qu'elles s'écrivent au dictionnaire : un renommage casse le
 * gardien, ce qui est le bon sens de défaillance — il se répare en le relisant.
 */
const INSEPARABLES = [
  "statistiques.heures_engagees",
  // LE TRAJET, depuis L3-05a : il est entré dans le NUMÉRATEUR, donc il entre
  // dans ce que l'écran doit montrer. *Un terme qui compte et qu'on n'affiche
  // pas rend le taux invérifiable*, et c'est précisément ce que cette liste
  // empêche depuis le 10/09.
  "statistiques.heures_trajet",
  "statistiques.heures_ouvrables",
  "statistiques.formule",
] as const;

describe("le taux d'occupation ne s'affiche jamais seul", () => {
  it("le composant qui appelle `tauxOccupation` porte les DEUX termes et la formule", () => {
    const texte = source();
    // Témoin d'abord : le gardien regarde bien un composant qui affiche un
    // taux. Un fichier qui n'en afficherait pas satisferait la règle sans rien
    // prouver (§9, 30/08).
    expect(texte).toContain("tauxOccupation");
    for (const cle of INSEPARABLES) {
      expect(texte, `le composant doit afficher ${cle}`).toContain(cle);
    }
  });

  it("LA MISE EN ÉCHEC : la simplification bien intentionnée est refusée", () => {
    // La faute telle qu'elle se commettrait — quelqu'un trouve la ligne
    // chargée et retire la formule, « puisque le taux se comprend ». On rejoue
    // le verdict du gardien sur ce texte-là, sans toucher au fichier.
    const ampute = source().replace(
      // La clé s'appelait `statistiques.separateur` : elle a été renommée
      // `ponctuation.separateur` le jour où la fiche d'intervention en a eu
      // besoin (L3-02) — *une clé nommée d'après son premier appelant devient
      // fausse au second*. **Et c'est ce gardien qui a nommé le renommage
      // incomplet** : son `expect(ampute).not.toBe(source())` refuse une
      // amputation qui n'ampute rien, et il a rougi sur-le-champ. Une mise en
      // échec dont le motif ne trouve plus sa cible ne viole plus rien
      // (§9, 11/09).
      /\$\{t\("ponctuation\.separateur"\)\}\$\{t\("statistiques\.formule"\)\}/g,
      "",
    );
    expect(ampute).not.toBe(source());
    expect(ampute).toContain("tauxOccupation");
    const manquantes = INSEPARABLES.filter((cle) => !ampute.includes(cle));
    expect(manquantes).toEqual(["statistiques.formule"]);
  });

  it("le refus d'un dénominateur inconnu ne se lit PAS « 0 % »", () => {
    // Le message doit dire ce qui manque et se distinguer d'un taux nul : deux
    // causes, deux corrections différentes. Un gardien du CONTENU, parce que
    // c'est le contenu qui trompe ici, pas la présence de la clé.
    const message = t("statistiques.sans_calendrier");
    expect(message).toContain("calendrier");
    expect(message.toLowerCase()).toContain("pas zéro pour cent");
    expect(source()).toContain("statistiques.sans_calendrier");
  });

  it("la formule NOMME ses trois termes — elle ne dit pas « voir plus haut »", () => {
    const formule = t("statistiques.formule");
    expect(formule).toContain("engagées");
    // LE TROISIÈME TERME (L3-05a) : le numérateur en porte deux depuis que le
    // trajet entre dans la charge. *Une formule qui n'énumère pas ce qu'elle
    // additionne est une formule fausse* — et c'est le pire endroit pour
    // l'être, puisqu'elle est là pour rendre le pourcentage vérifiable.
    expect(formule).toContain("trajet");
    expect(formule).toContain("ouvrables");
    // …et le cas voisin qui doit rester vert POUR SA PROPRE RAISON : le libellé
    // du taux, lui, n'a pas à porter la formule — c'est une étiquette.
    expect(t("statistiques.taux")).not.toContain("÷");
  });

  it("« 1 interventions » est refusé : le singulier a sa propre clé", () => {
    // Une faute que personne ne relit deux fois, et qu'aucune assertion
    // n'attrape — c'est l'image du planning qui l'a montrée, sur la ligne
    // d'une agence à une seule intervention.
    expect(t("statistiques.nombre_un")).toBe("intervention");
    expect(t("statistiques.nombre")).toBe("interventions");
    expect(source()).toContain("statistiques.nombre_un");
    expect(source()).toContain("statistiques.sans_duree_un");
  });

  it("« 0 % » ne s'affiche pas sur du temps engagé : la borne est dite", () => {
    expect(t("statistiques.taux_infime")).toContain("moins de 1");
    expect(source()).toContain("tauxArrondiAZeroMaisNonNul");
  });

  it("le TEMPS ENTRE DEUX LIEUX est dit non compté, et l'écran le porte", () => {
    // D107 l'exige : *le trajet inter-sites n'est pas compté, et l'application
    // doit le DIRE — pas l'approximer.* La phrase est un contenu, pas une
    // présence de clé : c'est le contenu qui trompe si elle se dilue.
    const phrase = t("statistiques.trajet_lecture");
    expect(phrase).toContain("premier");
    expect(phrase).toContain("dernier");
    expect(phrase.toLowerCase()).toContain("n'est pas compté");
    expect(source()).toContain("statistiques.trajet_lecture");
  });

  it("les journées SANS TRAJET CONNU sont dites, pas dissoutes", () => {
    // Même famille que les interventions sans durée : une journée vers les
    // Îles compte zéro minute de trajet, et sans la mention le taux
    // paraîtrait juste (§9, 06/09).
    expect(source()).toContain("statistiques.journees_sans_trajet");
    expect(source()).toContain("statistiques.journees_sans_trajet_une");
    expect(t("statistiques.journees_sans_trajet")).toContain("inconnu");
  });

  it("les interventions SANS DURÉE sont dites, pas dissoutes", () => {
    // Sans cette mention, un planning saisi sans durées afficherait un taux
    // bas et juste sur un technicien débordé (§9, 06/09).
    expect(source()).toContain("statistiques.sans_duree");
    expect(t("statistiques.sans_duree")).toContain("nombre");
  });
});
