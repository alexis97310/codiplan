import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  APPARENCES,
  CLASSES_LIEN,
  variableDuJeton,
} from "@/lib/theme/apparence";
import { SEUIL_TEXTE } from "@/lib/theme/contraste";
import { rapportDeContraste } from "@/lib/theme/couleur";

import {
  fichiersSource,
  RACINE,
  sansCommentaires,
} from "../outils/fichiers-source";

/**
 * UN LIEN SE VOIT AU REPOS — pas seulement sous le curseur (14/09/2026).
 *
 * ## Ce qui a été mesuré, et pourquoi aucune assertion ne pouvait le voir
 *
 * La fiche machine existe et la référence du parc y mène. **La personne qui a
 * ouvert l'écran a conclu « pas de fiche machines disponible ».** Le lien était
 * habillé `underline-offset-2 hover:underline` : *rien ne le distinguait du
 * texte voisin*, et sur un téléphone, faute de survol, rien ne l'aurait jamais
 * distingué.
 *
 * Un scénario de rendu aurait trouvé le `<a>`, son `href` et son libellé, et
 * serait passé au vert. *C'est l'espèce du §9 (09/09) : un défaut invisible à
 * toute assertion et évident sur une image* — parce que la règle manquante,
 * « un lien doit se voir », est une propriété de ce que l'œil rencontre, pas
 * d'une valeur qu'on interroge.
 *
 * Ce fichier est ce que cette image a permis d'écrire.
 *
 * ## Ce qu'il tient, en trois moitiés indépendantes
 *
 *   1. **LA RÈGLE** — tout ce qui se souligne au survol se distingue déjà au
 *      repos. Énoncée en PROPRIÉTÉ et non en liste d'exemptions : il n'y a donc
 *      aucune liste à tenir, ni à voir rouiller (§9, 31/08).
 *   2. **LE DOMICILE** — un seul habillage, dans `lib/theme/apparence.ts`. Le
 *      défaut était PARTAGÉ par six liens ; *le corriger à un seul endroit
 *      aurait laissé les cinq autres.*
 *   3. **LA LISIBILITÉ** — la couleur du lien tient les 4,5:1 de WCAG 2.1
 *      (1.4.3 AA) dans CHAQUE apparence, contre la surface comme contre le
 *      fond. Un rôle juste sur un thème et illisible sur l'autre rendrait le
 *      lien invisible là où personne ne regarde.
 */

const ECRANS = fichiersSource(["app", "components"]);

/** Ce qui, dans une classe, rend un lien visible SANS survol. */
const MARQUES_AU_REPOS = [
  // Le soulignement permanent — c'est la moitié que la faute avait perdue :
  // `underline-offset-2` règle un soulignement qui n'existait pas.
  /(^|[\s`"'{])underline([\s`"'}]|$)/,
  // Ou une encre propre : un lien coloré se voit sans être souligné.
  /text-app-marque|text-app-accent|text-primary/,
];

describe("LA RÈGLE — ce qui se souligne au survol se voit déjà au repos", () => {
  it("TÉMOIN — le périmètre n'est pas vide, et il porte bien des liens", () => {
    // *Un décompte nul ressemble toujours à un sans-faute* (§9, 30/08) : sans
    // ce témoin, un parcours qui ne lirait aucun fichier passerait au vert.
    expect(ECRANS.length).toBeGreaterThan(20);
    expect(
      ECRANS.filter((f) => f.contenu.includes("<Link")).length,
    ).toBeGreaterThan(3);
  });

  it("aucun `hover:underline` n'est le SEUL signe qu'un lien existe", () => {
    const fautifs: string[] = [];
    for (const fichier of ECRANS) {
      const code = sansCommentaires(fichier.contenu);
      for (const ligne of classesPortant(code, "hover:underline")) {
        if (!MARQUES_AU_REPOS.some((marque) => marque.test(ligne))) {
          fautifs.push(`${fichier.chemin} → ${ligne.trim()}`);
        }
      }
    }
    expect(
      fautifs,
      "un lien qui n'apparaît qu'au survol n'existe pas sur un téléphone",
    ).toEqual([]);
  });
});

/**
 * Les fragments de classe d'un fichier qui contiennent un motif.
 *
 * La découpe se fait à la LIGNE plutôt qu'à l'attribut : Prettier décide de la
 * mise en forme, et un gardien qui supposerait une graphie d'attribut rougirait
 * au premier reformatage (§9, 26/08, forme 1). Une expression composée sur
 * plusieurs lignes est donc traitée en joignant la ligne à ses voisines.
 */
function classesPortant(code: string, motif: string): readonly string[] {
  const lignes = code.split("\n");
  const trouvees: string[] = [];
  for (const [rang, ligne] of lignes.entries()) {
    if (!ligne.includes(motif)) continue;
    trouvees.push(
      [lignes[rang - 1] ?? "", ligne, lignes[rang + 1] ?? ""].join(" "),
    );
  }
  return trouvees;
}

describe("LE DOMICILE — un seul habillage, et il est employé", () => {
  it("`CLASSES_LIEN` porte les DEUX moitiés : le soulignement ET l'encre", () => {
    expect(CLASSES_LIEN).toMatch(/(^|\s)underline(\s|$)/);
    expect(CLASSES_LIEN).toContain("text-app-marque");
  });

  it("il est employé par TOUS les liens qui l'étaient de travers", () => {
    // Les six liens que la mesure du 14/09 a trouvés au régime `hover` seul.
    // *La liste est le CONTRAT de la réparation* : un septième lien écrit
    // demain sans elle est arrêté par la règle ci-dessus, pas par ce compte.
    //
    // **Elle S'ALLONGE quand un écran nouveau porte l'habillage, et c'est le
    // bon sens de mise à jour** : l'assertion reste une ÉGALITÉ, si bien
    // qu'aucun écran ne peut y entrer ni en sortir sans qu'on le décide.
    // *L'assouplir en « contient au moins » ferait taire le RETRAIT, qui est
    // le sens dangereux* — c'est lui qui rendrait les liens invisibles sur un
    // téléphone, et lui seul. Les deux écrans clients y sont entrés le
    // 14/09/2026 avec la fiche et la liste.
    const porteurs = ECRANS.filter((f) => f.contenu.includes("CLASSES_LIEN"));
    expect(porteurs.map((f) => f.chemin).sort()).toEqual([
      "app/(back-office)/clients/[id]/page.tsx",
      "app/(back-office)/clients/page.tsx",
      // Les deux écrans d'import y sont entrés le 14/09/2026 avec L1-11 : le
      // journal des chargements mène à un lot, et le lot revient aux imports.
      "app/(back-office)/imports/[id]/page.tsx",
      "app/(back-office)/imports/page.tsx",
      // Les deux écrans D'INTERVENTIONS y sont entrés le 16/09/2026 avec N-01 :
      // la fiche quitte `/planning/{id}` pour `/interventions/{id}`, et la
      // liste ouvre le registre que l'entrée de navigation attendait.
      "app/(back-office)/interventions/[id]/page.tsx",
      "app/(back-office)/interventions/page.tsx",
      // Les deux écrans d'horaires y sont entrés le 14/09/2026 avec R3-13 : le
      // tableau des établissements mène à la fiche d'un calendrier, et la fiche
      // revient au tableau.
      // Renommé `[calendrier]` → `[id]` par AGENCE-1 (21/09/2026) : Next.js
      // exige un seul nom de segment dynamique par position, et
      // `/parametres/agences/[id]/modifier` partage cette position.
      "app/(back-office)/parametres/agences/[id]/page.tsx",
      "app/(back-office)/parametres/agences/page.tsx",
      // LE RÉFÉRENTIEL MATÉRIEL y est entré le 16/09/2026 avec AT-04 : le
      // décompte de modèles d'une famille mène à leur table, plus bas sur le
      // même écran.
      "app/(back-office)/parametres/materiel/page.tsx",
      // LA FICHE MACHINE y entre le 18/09/2026 avec N-11 : la référence d'une
      // intervention de l'historique mène à sa fiche, comme au registre.
      "app/(back-office)/parc/[id]/page.tsx",
      "app/(back-office)/parc/page.tsx",
      "app/(back-office)/planning/page.tsx",
      "app/(back-office)/sites/page.tsx",
      // LE TABLEAU DE BORD (AV-10) y entre le 16/09/2026 : la référence d'une
      // intervention du jour mène à sa fiche, comme au registre.
      "app/(back-office)/tableau-de-bord/page.tsx",
      "app/(back-office)/vgp/page.tsx",
      // Les deux écrans du TERRAIN y sont entrés le 15/09/2026 avec R5-01 et
      // R5-02, et c'est là que l'habillage compte le plus : *un lien visible
      // au seul SURVOL n'existe pas sur un téléphone*, et ces deux écrans-là
      // ne se regardent que sur un téléphone.
      "app/(mobile)/terrain/[id]/page.tsx",
      "app/(mobile)/terrain/page.tsx",
      // LA PAGINATION PARTAGÉE (AT-07, 17/09/2026) y entre avec les liens
      // « page précédente »/« page suivante » des quatre écrans qui paginent
      // désormais — clients, parc, sites, interventions.
      "components/ui/pagination.tsx",
    ]);
  });
});

const STYLE = readFileSync(join(RACINE, "app", "globals.css"), "utf8");

/** La valeur d'un jeton dans une apparence, lue dans la feuille de style. */
function jetonDe(
  apparence: string,
  jeton: "marque" | "surface" | "fond",
): string {
  const debut = STYLE.indexOf(`[data-apparence="${apparence}"]`);
  const ouvrante = STYLE.indexOf("{", debut);
  const bloc = STYLE.slice(ouvrante, STYLE.indexOf("\n}", ouvrante));
  const trouve = new RegExp(`${variableDuJeton(jeton)}\\s*:\\s*([^;]+);`).exec(
    bloc,
  );
  expect(trouve, `${apparence} ne déclare pas ${jeton}`).not.toBeNull();
  return trouve![1]!.trim();
}

describe("LA LISIBILITÉ — 4,5:1 dans chaque apparence (WCAG 2.1, 1.4.3 AA)", () => {
  it("TÉMOIN — il y a bien plus d'une apparence à éprouver", () => {
    // Une seule rendrait ce bloc vrai par vacuité : c'est le raisonnement de
    // `deux-apparences.test.ts`, et il vaut ici mot pour mot.
    expect(APPARENCES.length).toBeGreaterThanOrEqual(2);
  });

  for (const apparence of APPARENCES) {
    it(`« ${apparence} » — l'encre du lien se lit sur la surface ET sur le fond`, () => {
      const marque = jetonDe(apparence, "marque");
      for (const support of ["surface", "fond"] as const) {
        expect(
          rapportDeContraste(marque, jetonDe(apparence, support)),
          `${marque} sur le ${support} de « ${apparence} »`,
        ).toBeGreaterThanOrEqual(SEUIL_TEXTE);
      }
    });
  }
});
