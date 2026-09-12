import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import * as dictionnaire from "@/lib/i18n";

import {
  SURFACE_DECRAN,
  empreintePhotographiee,
  estDeLaSurface,
  etatDeLaSurface,
  rapportDeLaSurface,
} from "../../../scripts/lib/surface-decran";
import { RACINE, fichiersSource } from "../outils/fichiers-source";
import { accesseursDictionnaire, analyser } from "../outils/rendu-visible";

/**
 * LA SURFACE D'ÉCRAN EST DÉDUITE, PAS DÉCLARÉE (R1-02).
 *
 * `SURFACE_DECRAN` est une liste écrite à la main, et *une liste close qui a
 * l'autorité d'une décision et le contenu d'un oubli est pire qu'une liste
 * ouverte* (§9, 20/08). Ce gardien renverse la charge : **la population vient
 * du dépôt** — tout fichier portant l'une des trois marques de rendu — et la
 * liste n'est qu'une déclaration confrontée à elle. Un écran écrit demain dans
 * un répertoire que personne n'a prévu fait rougir ce fichier le jour même.
 *
 * ## CE QUE LES SCÉNARIOS ÉPROUVENT, DANS LES DEUX DIRECTIONS
 *
 * Un gardien est un prédicat à deux directions (§9, 11/09) : *il rougit quand
 * il doit*, et *il ne reste vert que quand il le doit*. Les deux sont ici — un
 * fichier de rendu hors surface rougit, et un fichier de métier hors surface
 * reste vert POUR SA PROPRE RAISON, parce qu'il ne restitue rien.
 */

const ACCESSEURS = accesseursDictionnaire(
  dictionnaire as unknown as Record<string, unknown>,
);

/**
 * Tout fichier du dépôt qui RESTITUE, hors épreuves.
 *
 * `tests/` est retiré, et c'est le seul retrait : un scénario de rendu porte
 * la marque « interroge l'écran » sans être un écran. *Il n'est pas exempté,
 * il n'est pas de la surface* — la nuance compte, une exemption se rouvre par
 * argument, une définition non.
 */
const FICHIERS_QUI_RESTITUENT = fichiersSource(["."])
  .map((fichier) => analyser(fichier.chemin, fichier.contenu, ACCESSEURS))
  .filter((analyse) => analyse.marques.length > 0)
  .filter((analyse) => !analyse.chemin.startsWith("tests/"))
  .map((analyse) => analyse.chemin);

describe("la surface d'écran est DÉDUITE du dépôt", () => {
  it("TÉMOIN — le dépôt porte bien des fichiers qui restituent", () => {
    // Un décompte nul ressemble toujours à un sans-faute (§9, 30/08) : sans ce
    // témoin, une analyse devenue aveugle rendrait ce gardien vert et muet.
    expect(FICHIERS_QUI_RESTITUENT.length).toBeGreaterThan(20);
  });

  it("chaque fichier qui RESTITUE tombe sous un préfixe de la liste", () => {
    const orphelins = FICHIERS_QUI_RESTITUENT.filter(
      (chemin) => !estDeLaSurface(chemin),
    );
    expect(
      orphelins,
      "ces fichiers rendent quelque chose qu'une capture photographie, et " +
        "aucune portion de SURFACE_DECRAN ne les couvre : une prise de vue " +
        "les traverserait sans que la commande `pnpm captures:etat` le dise",
    ).toEqual([]);
  });

  // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON (§9, 11/09). Un module de
  // métier n'est PAS de la surface, et la liste doit refuser de l'y faire
  // entrer — sans quoi « surface d'écran » finirait par vouloir dire « le
  // dépôt », et le verdict ne dirait plus rien.
  it("un module de MÉTIER n'est pas de la surface, tout écran qu'il alimente", () => {
    expect(estDeLaSurface("lib/interventions/statistiques.ts")).toBe(false);
    expect(estDeLaSurface("lib/vgp/registre.ts")).toBe(false);
    expect(estDeLaSurface("prisma/schema.prisma")).toBe(false);
    // Et pourtant `statistiques.ts` décide du taux que le planning AFFICHE :
    // c'est la limite que le module annonce lui-même, écrite plutôt que tue.
    expect(FICHIERS_QUI_RESTITUENT).not.toContain(
      "lib/interventions/statistiques.ts",
    );
  });

  it("un préfixe qui ne désigne RIEN n'est pas une portion de surface", () => {
    // L'ADOSSEMENT (§9, 31/08) : une entrée qui ne s'applique à personne ne
    // fait rougir personne, et le premier répertoire qui reprendra ce nom en
    // héritera sans que quiconque l'ait décidé.
    for (const portion of SURFACE_DECRAN) {
      const chemin = join(RACINE, portion.prefixe);
      expect(existsSync(chemin), `${portion.prefixe} ne désigne rien`).toBe(
        true,
      );
      if (portion.prefixe.endsWith("/")) {
        const habitants = fichiersSource(
          [portion.prefixe],
          [".ts", ".tsx", ".css"],
        );
        expect(
          habitants.length,
          `${portion.prefixe} est vide — il exempte toujours et ne couvre plus rien`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("chaque portion DIT pourquoi elle en est", () => {
    expect(SURFACE_DECRAN.length).toBeGreaterThan(0);
    for (const portion of SURFACE_DECRAN) {
      expect(portion.motif.length, portion.prefixe).toBeGreaterThan(40);
    }
  });

  it("les portions DÉCLARÉES sont bien celles qu'aucune marque ne désigne", () => {
    // Le sens qu'on oublie : une portion rangée « declaree » alors que des
    // fichiers y portent une marque ferait croire qu'elle repose sur son motif
    // seul, quand elle est en réalité tenue par la déduction.
    for (const portion of SURFACE_DECRAN.filter(
      (p) => p.origine === "declaree",
    )) {
      const restituants = FICHIERS_QUI_RESTITUENT.filter((c) =>
        c.startsWith(portion.prefixe),
      );
      if (portion.prefixe === "app/globals.css") {
        continue; // couverte par `app/`, nommée pour que son motif soit LU.
      }
      expect(
        restituants,
        `${portion.prefixe} est déclarée « declaree » et porte des fichiers de rendu`,
      ).toEqual([]);
    }
  });
});

describe("le verdict a TROIS valeurs, et jamais deux", () => {
  it("aucun fichier de surface changé — identique", () => {
    const etat = etatDeLaSurface("a".repeat(40), [
      "docs/backlog.md",
      "lib/vgp/registre.ts",
      "prisma/schema.prisma",
    ]);
    expect(etat.etat).toBe("identique");
  });

  it("un seul fichier de surface suffit à changer le verdict", () => {
    const etat = etatDeLaSurface("a".repeat(40), [
      "docs/backlog.md",
      "lib/i18n/fr.ts",
    ]);
    expect(etat.etat).toBe("change");
    if (etat.etat !== "change") return;
    expect(etat.fichiers).toEqual(["lib/i18n/fr.ts"]);
  });

  it("« indécidable » NE se lit PAS « rien n'a changé »", () => {
    // C'est tout l'objet du troisième état : un dépôt cloné en profondeur 1
    // rendrait une liste vide, et « je ne sais pas » passerait pour « à jour ».
    // *Mesuré le 12/09/2026 : ce clone-ci était superficiel, et la commande a
    // rendu INDÉCIDABLE à sa première exécution réelle.*
    const rapport = rapportDeLaSurface({
      etat: "indecidable",
      pourquoi: "le commit b8c3f76 n'existe pas dans ce clone",
    });
    expect(rapport).toContain("INDÉCIDABLE");
    expect(rapport).toContain("Aucune comparaison n'a eu lieu");
    expect(rapport).not.toContain("AUCUN FICHIER DE RESTITUTION N'A CHANGÉ");
  });

  it("le rapport ÉCRIT ce que le verdict ne dit pas", () => {
    // *Le verdict dit « aucun fichier de restitution n'a changé », jamais
    // « l'écran est identique ».* Sans cette phrase, un lecteur conclurait que
    // le planning affiche la même chose alors que le calcul du taux a bougé.
    const rapport = rapportDeLaSurface(etatDeLaSurface("b".repeat(40), []));
    expect(rapport).toContain("ne dit PAS que les écrans sont identiques");
  });

  it("chaque ligne du rapport dit de quel côté du miroir elle vient", () => {
    // §9, 06/09 : un chiffre attendu présenté parmi les observations se lit
    // comme une observation. La liste des portions est ANNONCÉE comme telle.
    const rapport = rapportDeLaSurface(etatDeLaSurface("c".repeat(40), []));
    expect(rapport).toContain("Ce qui est tenu pour SURFACE D'ÉCRAN");
    for (const portion of SURFACE_DECRAN) {
      expect(rapport).toContain(portion.prefixe);
    }
  });
});

describe("l'empreinte se LIT dans le README, elle ne se recopie pas", () => {
  it("elle se lit dans le README RÉEL — le format n'a pas dérivé", () => {
    // *La commande casserait en silence le jour où la prise de vue change la
    // forme du tableau*, et personne ne le verrait avant d'en avoir besoin.
    // Ce scénario est ce qui confronte le lecteur à l'écrivain.
    const readme = readFileSync(
      join(RACINE, "docs", "captures", "README.md"),
      "utf8",
    );
    const lue = empreintePhotographiee(readme);
    expect(
      lue,
      "docs/captures/README.md ne porte plus d'empreinte lisible",
    ).not.toBeNull();
    expect(lue).toMatch(/^[0-9a-f]{40}$/);
  });

  it("une empreinte ABSENTE est un refus, jamais une chaîne vide", () => {
    // Une empreinte vide comparerait le dépôt à rien et rendrait « identique ».
    expect(empreintePhotographiee("# Captures\n\npas d'empreinte ici")).toBe(
      null,
    );
  });

  it("une empreinte COURTE est refusée — sept caractères ne désignent pas", () => {
    expect(
      empreintePhotographiee("| **Commit photographié** | `b8c3f76` — lu |"),
    ).toBe(null);
  });
});
