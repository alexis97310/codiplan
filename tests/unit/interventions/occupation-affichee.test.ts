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
      /\$\{t\("statistiques\.separateur"\)\}\$\{t\("statistiques\.formule"\)\}/g,
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

  it("la formule NOMME ses deux termes — elle ne dit pas « voir plus haut »", () => {
    const formule = t("statistiques.formule");
    expect(formule).toContain("engagées");
    expect(formule).toContain("ouvrables");
    // …et le cas voisin qui doit rester vert POUR SA PROPRE RAISON : le libellé
    // du taux, lui, n'a pas à porter la formule — c'est une étiquette.
    expect(t("statistiques.taux")).not.toContain("÷");
  });

  it("les interventions SANS DURÉE sont dites, pas dissoutes", () => {
    // Sans cette mention, un planning saisi sans durées afficherait un taux
    // bas et juste sur un technicien débordé (§9, 06/09).
    expect(source()).toContain("statistiques.sans_duree");
    expect(t("statistiques.sans_duree")).toContain("nombre");
  });
});
