import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n/fr";
import { ENTREES, entreeActive } from "@/lib/navigation/entrees";

/**
 * LA BARRE DE NAVIGATION EST CONFRONTÉE À LA MAQUETTE, jamais recopiée d'elle
 * (D95).
 *
 * **La population ne vient pas du code, elle vient du document.** Le gardien lit
 * `docs/maquette/CODIPLAN_Maquette.html`, en extrait les boutons de `.nav`, et exige que
 * la liste du dépôt dise exactement la même chose — libellés ET ordre. C'est la
 * parade du §9 (01/09) appliquée ici : *une liste close recopiée « pour la
 * lisibilité » devient fausse le jour où la première grandit, sans rougir.*
 * Rien ici ne recopie : la maquette est une source que ce fichier ne contrôle
 * pas.
 *
 * **Les deux sens sont gardés.** Une entrée ajoutée au code sans l'être à la
 * maquette échoue ; une entrée ajoutée à la maquette sans l'être au code échoue
 * aussi — et c'est le sens qu'on oublie, parce qu'il ne casse aucun écran.
 */

const MAQUETTE = readFileSync(
  join(process.cwd(), "docs/maquette/CODIPLAN_Maquette.html"),
  "utf8",
);

/** Les libellés des boutons de la barre, dans l'ordre où la maquette les écrit. */
function libellesDeLaMaquette(): string[] {
  const bloc = /<div class="nav">([\s\S]*?)<\/div>/.exec(MAQUETTE);
  if (bloc === null) {
    throw new Error(
      "la barre `.nav` est introuvable dans docs/maquette/CODIPLAN_Maquette.html — " +
        "le document a changé de forme, et ce gardien ne mesure plus rien",
    );
  }
  return [...bloc[1].matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map((m) =>
    m[1].replaceAll("&amp;", "&").trim(),
  );
}

describe("la barre de navigation dit ce que la maquette dit", () => {
  it("a réellement lu une barre — le témoin de non-vacuité", () => {
    // Zéro bouton lu ressemblerait trait pour trait à « les deux listes
    // s'accordent ». C'est la faute du 10/09 : deux côtés aveugles ensemble
    // s'accordent parfaitement, et la comparaison porte sur rien.
    expect(libellesDeLaMaquette().length).toBe(11);
    expect(ENTREES.length).toBe(11);
  });

  it("les onze libellés et leur ordre s'accordent, des deux côtés", () => {
    expect(ENTREES.map((e) => fr[e.cle])).toEqual(libellesDeLaMaquette());
  });

  it("chaque entrée a sa clé au dictionnaire", () => {
    for (const entree of ENTREES) {
      expect(Object.hasOwn(fr, entree.cle), entree.cle).toBe(true);
    }
  });

  it("une entrée sans écran nomme le travail qui l'ouvrira", () => {
    const inertes = ENTREES.filter((e) => e.chemin === null);
    // Le témoin : il EN RESTE. Le jour où il n'en reste plus, c'est ce
    // scénario qu'il faudra retirer, et il le dira.
    expect(inertes.length).toBeGreaterThan(0);
    for (const entree of inertes) {
      expect(entree.ouvertePar, entree.cle).toBeTruthy();
    }
  });

  it("une entrée AVEC écran ne prétend pas être à venir", () => {
    // Le sens qu'on oublie : un `ouvertePar` laissé derrière un écran livré
    // ne casse rien et ment doucement.
    for (const entree of ENTREES.filter((e) => e.chemin !== null)) {
      expect(entree.ouvertePar, entree.cle).toBeUndefined();
    }
  });
});

describe("l'entrée allumée suit le chemin, et par préfixe de segment", () => {
  it("allume l'entrée exacte", () => {
    expect(entreeActive("/planning")?.cle).toBe("nav.planning");
    expect(entreeActive("/portail")?.cle).toBe("nav.portail_client");
  });

  it("reste allumée dans un sous-écran — c'est là qu'on en a le plus besoin", () => {
    expect(entreeActive("/planning/nouvelle")?.cle).toBe("nav.planning");
    expect(entreeActive("/parametres/agences")?.cle).toBe(
      "nav.societes_tarifs",
    );
    expect(entreeActive("/parametres/forfaits")?.cle).toBe(
      "nav.societes_tarifs",
    );
  });

  it("le préfixe est borné au SEGMENT — et c'est le cas qui piège", () => {
    // `startsWith` nu allumerait « Planning » sur `/planningX`. La faute ne se
    // verrait jamais : il n'existe aucune route de ce nom AUJOURD'HUI.
    expect(entreeActive("/planningX")).toBeNull();
    expect(entreeActive("/parametresX/agences")).toBeNull();
  });

  it("hors des écrans de la barre, rien n'est allumé", () => {
    expect(entreeActive("/connexion")).toBeNull();
    expect(entreeActive("")).toBeNull();
    expect(entreeActive("/")).toBeNull();
  });
});
