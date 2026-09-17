import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n/fr";
import {
  ECARTS_MAQUETTE,
  ENTREES,
  entreeActive,
  estGroupe,
  feuilles,
} from "@/lib/navigation/entrees";

/**
 * LA BARRE DE NAVIGATION EST CONFRONTÉE À LA MAQUETTE, jamais recopiée d'elle
 * (D95, D121).
 *
 * **Depuis D121, la source de la LISTE et de L'ORDRE change.**
 * `docs/maquette/CODIPLAN_Maquette.html` reste la source des couleurs et de la
 * disposition des écrans (D95, inchangé) ; elle cesse de faire foi sur la
 * FORME et le CONTENU du menu, dont
 * `docs/maquette/codiplan-maquette-complete.html` est désormais la source —
 * une colonne latérale, trois titres de domaine, quatorze destinations
 * TOUTES visibles (D121, « LE CONSTAT »). **Deux fichiers, deux questions** :
 * confondre l'un pour l'autre serait exactement la faute que D121 nomme pour
 * l'éviter.
 *
 * **La population ne vient pas du code, elle vient du document.** Le gardien
 * lit la colonne `<aside class="sidebar">`, en extrait les boutons `.nav-link`
 * et les titres `.nav-group`, et exige que `ENTREES` — titres de domaine et
 * destinations une fois les groupes ouverts (`feuilles`) — porte exactement
 * la même LISTE, dans le même ORDRE. C'est plus strict que la confrontation
 * d'avant D121 (un ENSEMBLE, sans ordre) : la maquette dessinant désormais un
 * vrai menu plutôt qu'un catalogue d'écrans, son ordre a un sens qu'elle
 * n'avait pas encore.
 *
 * **Les deux sens sont gardés.** Une entrée ajoutée au code sans l'être à la
 * maquette échoue ; une entrée ajoutée à la maquette sans l'être au code
 * échoue aussi.
 *
 * **UN GROUPE PEUT DÉSORMAIS PORTER UN TITRE NEUF (N-07).** D118 interdisait
 * qu'un titre de groupe soit un mot neuf parce que ce titre était un
 * `<summary>` cliquable — un contrôle qu'on aurait pu confondre avec une
 * destination inventée. **Ce motif n'existe plus** : un titre de domaine est
 * un `<div>` de texte, jamais un lien, jamais un bouton (voir
 * `GroupeNavigation`, `lib/navigation/entrees.ts`, pour l'écrit complet de
 * cette décision). La garde qui le remplace est plus directe et ne s'assouplit
 * sur rien : le titre doit être l'un des TROIS noms de domaine mesurés sur la
 * maquette, ni plus ni moins — et c'est exactement ce que la comparaison de
 * LISTE ET D'ORDRE ci-dessous vérifie, sans test séparé à maintenir en double.
 */

const MAQUETTE = readFileSync(
  join(process.cwd(), "docs/maquette/codiplan-maquette-complete.html"),
  "utf8",
);

/** La colonne de navigation seule, avant le pied (société, personne). */
function colonneDeNavigation(): string {
  const bloc =
    /<aside class="sidebar"[^>]*>([\s\S]*?)<div class="sidebar-foot">/.exec(
      MAQUETTE,
    );
  if (bloc === null) {
    throw new Error(
      "la colonne `.sidebar` est introuvable dans " +
        "docs/maquette/codiplan-maquette-complete.html — le document a changé " +
        "de forme, et ce gardien ne mesure plus rien",
    );
  }
  return bloc[1];
}

/** Les libellés des boutons `.nav-link`, dans l'ordre où la maquette les écrit. */
function destinationsDeLaMaquette(): string[] {
  return [
    ...colonneDeNavigation().matchAll(
      /<button class="nav-link[^"]*"[^>]*>(?:<span class="nav-icon">[^<]*<\/span>)?([^<]+)<\/button>/g,
    ),
  ].map((m) => m[1].replaceAll("&amp;", "&").trim());
}

/** Les titres `.nav-group`, dans l'ordre où la maquette les écrit. */
function domainesDeLaMaquette(): string[] {
  return [
    ...colonneDeNavigation().matchAll(/<div class="nav-group">([^<]+)<\/div>/g),
  ].map((m) => m[1].replaceAll("&amp;", "&").trim());
}

describe("la barre de navigation dit ce que la maquette dit (D121)", () => {
  it("a réellement lu une colonne — le témoin de non-vacuité", () => {
    // Zéro bouton lu ressemblerait trait pour trait à « les deux listes
    // s'accordent ». C'est la faute du 10/09 : deux côtés aveugles ensemble
    // s'accordent parfaitement, et la comparaison porte sur rien.
    expect(destinationsDeLaMaquette().length).toBe(14);
    expect(domainesDeLaMaquette().length).toBe(3);
    // TROIS domaines de premier niveau (D121) ; QUATORZE destinations une
    // fois les groupes ouverts.
    expect(ENTREES.length).toBe(3);
    expect(feuilles(ENTREES).length).toBe(14);
  });

  it("les DESTINATIONS s'accordent — la LISTE ET L'ORDRE (D121)", () => {
    expect(feuilles(ENTREES).map((e) => fr[e.cle])).toEqual(
      destinationsDeLaMaquette(),
    );
  });

  it("les TROIS DOMAINES s'accordent — la LISTE ET L'ORDRE (N-07)", () => {
    // C'est ici, et nulle part ailleurs, que la règle du libellé neuf se
    // vérifie : un domaine renommé ou un domaine de plus ferait rougir cette
    // seule assertion, dans les deux sens.
    for (const entree of ENTREES) {
      expect(estGroupe(entree), entree.cle).toBe(true);
    }
    expect(ENTREES.map((e) => fr[e.cle])).toEqual(domainesDeLaMaquette());
  });

  it("chaque entrée, feuille ou domaine, a sa clé au dictionnaire", () => {
    for (const entree of ENTREES) {
      expect(Object.hasOwn(fr, entree.cle), entree.cle).toBe(true);
    }
    for (const feuille of feuilles(ENTREES)) {
      expect(Object.hasOwn(fr, feuille.cle), feuille.cle).toBe(true);
    }
  });

  it("une entrée sans écran nomme le travail qui l'ouvrira", () => {
    const inertes = feuilles(ENTREES).filter((e) => e.chemin === null);
    // Le témoin : il EN RESTE. Le jour où il n'en reste plus, c'est ce
    // scénario qu'il faudra retirer, et il le dira.
    expect(inertes.length).toBeGreaterThan(0);
    for (const entree of inertes) {
      expect(entree.ouvertePar, entree.cle).toBeTruthy();
    }
  });

  it("une entrée AVEC écran ne prétend pas être à venir", () => {
    for (const entree of feuilles(ENTREES).filter((e) => e.chemin !== null)) {
      expect(entree.ouvertePar, entree.cle).toBeUndefined();
    }
  });

  it("les écarts à la maquette sont exactement ceux qui ont été décidés — VIDE depuis D121", () => {
    // Le seul écart jamais nommé, « Fiche machine » (D98), écartait un bouton
    // que l'ANCIENNE maquette (un catalogue d'écrans) listait à tort. La
    // maquette désormais confrontée ne le dessine plus du tout : mesuré
    // destination par destination, il n'y a plus rien à écarter (D121).
    // Garder l'ancienne ligne ferait échouer le test suivant, qui exige
    // qu'un écart s'adosse à un libellé réellement présent dans CETTE
    // maquette.
    expect(ECARTS_MAQUETTE).toEqual([]);
  });

  it("chaque écart, s'il en existe un jour, est ADOSSÉ à un libellé réel", () => {
    const dansLaMaquette = new Set(destinationsDeLaMaquette());
    for (const ecart of ECARTS_MAQUETTE) {
      expect(dansLaMaquette.has(ecart.libelle), ecart.libelle).toBe(true);
      expect(ecart.motif, ecart.libelle).toBeTruthy();
    }
  });
});

describe("l'entrée allumée suit le chemin, et par préfixe de segment", () => {
  it("allume l'entrée exacte", () => {
    expect(entreeActive("/planning")?.cle).toBe("nav.planning");
    expect(entreeActive("/portail")?.cle).toBe("nav.portail_client");
  });

  it("reste allumée dans un sous-écran — c'est là qu'on en a le plus besoin", () => {
    expect(entreeActive("/interventions/nouvelle")?.cle).toBe(
      "nav.interventions",
    );
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
