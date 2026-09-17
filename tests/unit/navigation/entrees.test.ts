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
 * (D95) — sur ses DESTINATIONS depuis D118, plus sur leur ordre ni leur
 * regroupement.
 *
 * **La population ne vient pas du code, elle vient du document.** Le gardien lit
 * `docs/maquette/CODIPLAN_Maquette.html`, en extrait les boutons de `.nav`, et
 * exige que les feuilles du dépôt — `ENTREES` une fois ses groupes ouverts —
 * portent exactement le même ENSEMBLE de libellés. C'est la parade du §9
 * (01/09) appliquée ici : *une liste close recopiée « pour la lisibilité »
 * devient fausse le jour où la première grandit, sans rougir.* Rien ici ne
 * recopie : la maquette est une source que ce fichier ne contrôle pas.
 *
 * **Pourquoi un ENSEMBLE, et non plus un ORDRE, depuis D118.** L'amendement
 * dit : « la confrontation à la maquette devient une confrontation de
 * destinations plutôt que d'entrées ». Regrouper « Interventions » sous
 * « Planning » et faire passer « Portail client » avant « Sociétés & tarifs »
 * change l'ordre SANS changer ce que la barre ouvre — et c'est exactement ce
 * que ce gardien doit laisser passer, tout en continuant de refuser qu'une
 * destination soit ajoutée ou disparaisse en silence.
 *
 * **Les deux sens sont gardés.** Une entrée ajoutée au code sans l'être à la
 * maquette échoue ; une entrée ajoutée à la maquette sans l'être au code échoue
 * aussi — et c'est le sens qu'on oublie, parce qu'il ne casse aucun écran.
 *
 * **ET UN ÉCART EST ADMIS, NOMMÉMENT — jamais par un assouplissement (D98).**
 * D95 autorise l'écart à la maquette pourvu qu'il s'écrive avec sa mesure et le
 * point où elle est muette. La comparaison retire donc les libellés de
 * `ECARTS_MAQUETTE` et **rien d'autre** : elle reste stricte sur tout le reste,
 * et cette liste est exigée à l'identique ci-dessous — l'y ajouter une seconde
 * entrée fait rougir, ce qui force l'arbitrage au lieu de le contourner.
 *
 * *Trois vérifications, et la troisième est celle qu'on oublie :* l'écart est
 * ADOSSÉ — la maquette porte réellement ce libellé, sans quoi il n'écarte plus
 * rien (§9, 31/08) ; il est ABSENT du code — un écart qu'on écarterait tout en
 * le gardant serait un écart qui ne sert à rien ; et la liste est CLOSE.
 *
 * **ET UN GROUPE N'INVENTE AUCUN LIBELLÉ (D118).** Son titre doit être celui
 * d'UN DE SES ENFANTS — jamais un mot neuf comme « Paramètres », que
 * `docs/propositions/navigation.html` propose sans qu'aucune clé ne le porte.
 * Sans cette règle, rien n'empêcherait d'introduire silencieusement un
 * libellé que personne n'a encore arrêté.
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

/** Les écarts, tels qu'ils sont ATTENDUS — écrits ici pour être lus. */
const ECARTS_ATTENDUS = ["Fiche machine"];

/** Les libellés de la maquette, moins les écarts nommés (D98). */
function libellesAttendus(): string[] {
  const ecartes = new Set(ECARTS_MAQUETTE.map((e) => e.libelle));
  return libellesDeLaMaquette().filter((libelle) => !ecartes.has(libelle));
}

describe("la barre de navigation dit ce que la maquette dit", () => {
  it("a réellement lu une barre — le témoin de non-vacuité", () => {
    // Zéro bouton lu ressemblerait trait pour trait à « les deux listes
    // s'accordent ». C'est la faute du 10/09 : deux côtés aveugles ensemble
    // s'accordent parfaitement, et la comparaison porte sur rien.
    expect(libellesDeLaMaquette().length).toBe(11);
    // SIX entrées de premier niveau (D118) ; DIX destinations une fois les
    // groupes ouverts — le même compte qu'avant l'amendement.
    expect(ENTREES.length).toBe(6);
    expect(feuilles(ENTREES).length).toBe(10);
  });

  it("les DESTINATIONS s'accordent — l'ensemble, plus l'ordre ni le regroupement (D118)", () => {
    expect([...feuilles(ENTREES).map((e) => fr[e.cle])].sort()).toEqual(
      [...libellesAttendus()].sort(),
    );
  });

  it("chaque entrée, feuille ou groupe, a sa clé au dictionnaire", () => {
    for (const entree of ENTREES) {
      expect(Object.hasOwn(fr, entree.cle), entree.cle).toBe(true);
    }
    for (const feuille of feuilles(ENTREES)) {
      expect(Object.hasOwn(fr, feuille.cle), feuille.cle).toBe(true);
    }
  });

  it("un groupe n'invente aucun libellé — son titre est celui d'un de ses enfants (D118)", () => {
    // Ce qui interdit d'introduire silencieusement un mot neuf comme
    // « Paramètres » : `docs/propositions/navigation.html` le propose et le
    // signale lui-même comme non tranché.
    for (const entree of ENTREES) {
      if (!estGroupe(entree)) continue;
      expect(
        entree.enfants.some((enfant) => enfant.cle === entree.cle),
        entree.cle,
      ).toBe(true);
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

  it("les écarts à la maquette sont exactement ceux qui ont été décidés", () => {
    // Le motif de `CABLAGE_ATTENDU` : la liste est exigée à l'identique, donc
    // un écart de plus fait rougir. C'est ce qui force l'arbitrage — sans quoi
    // « la maquette fait foi » s'éroderait d'une entrée à la fois, et chaque
    // retrait paraîtrait raisonnable pris isolément.
    expect(ECARTS_MAQUETTE.map((e) => e.libelle)).toEqual(ECARTS_ATTENDUS);
    for (const ecart of ECARTS_MAQUETTE) {
      expect(ecart.motif, ecart.libelle).toBeTruthy();
    }
  });

  it("chaque écart est ADOSSÉ à un libellé que la maquette porte vraiment", () => {
    // Le sens silencieux. Un écart qui ne désigne plus rien — la maquette
    // renommée, l'entrée retirée du document — n'écarte plus rien : il
    // continue d'exister, il ne protège plus personne, et rien ne le dit. Le
    // jour où il faudra le retirer, c'est ce scénario qui le nommera.
    const dansLaMaquette = new Set(libellesDeLaMaquette());
    for (const ecart of ECARTS_MAQUETTE) {
      expect(dansLaMaquette.has(ecart.libelle), ecart.libelle).toBe(true);
    }
  });

  it("un écart est réellement SORTI de la barre — la paire qui doit rester verte pour sa raison", () => {
    // §9 (11/09) : à côté du cas qui doit rougir, un cas qui doit rester vert
    // POUR SA PROPRE RAISON. « Fiche machine » est absent ET « Parc machines »
    // est présent — si la comparaison confondait les deux libellés, la paire
    // tomberait.
    const rendus = feuilles(ENTREES).map((e) => fr[e.cle]);
    for (const ecart of ECARTS_MAQUETTE) {
      expect(rendus, ecart.libelle).not.toContain(ecart.libelle);
    }
    expect(rendus).toContain("Parc machines");
  });

  it("une entrée AVEC écran ne prétend pas être à venir", () => {
    // Le sens qu'on oublie : un `ouvertePar` laissé derrière un écran livré
    // ne casse rien et ment doucement.
    for (const entree of feuilles(ENTREES).filter((e) => e.chemin !== null)) {
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
