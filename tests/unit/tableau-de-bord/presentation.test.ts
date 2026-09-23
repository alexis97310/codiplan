import { describe, expect, it } from "vitest";

import {
  ancienNombreEnAttente,
  detailEnAttenteDePiece,
  detailInterventionsDuJour,
  etatVgpAPrevoir,
  interventionsDuJour,
  nonAffecteesAujourdHui,
  prioritesAPlanifier,
  techniciensIndisponibles,
} from "../../../app/(back-office)/tableau-de-bord/presentation";
import { t } from "@/lib/i18n/fr";

/**
 * CE QUE LE TABLEAU DE BORD COMPOSE (AV-10).
 *
 * ## LA PAIRE DU §9 (11/09) EST TENUE PARTOUT ICI
 *
 * *« À côté de chaque cas qui doit rougir, un cas qui doit rester vert POUR SA
 * PROPRE RAISON. »*
 */

const DEBUT = new Date("2026-09-16T00:00:00.000Z");
const FIN = new Date("2026-09-17T00:00:00.000Z");
const VEILLE = new Date("2026-09-15T00:00:00.000Z");

describe("les interventions DU JOUR excluent la file d'attente", () => {
  it("écarte les lignes SANS date, que `listerPlanning` rend quand même", () => {
    // *`listerPlanning` rend AUSSI la file d'attente, quelle que soit la
    // fenêtre demandée* : c'est exactement ce qu'un compte « aujourd'hui » ne
    // doit pas inclure.
    const lignes = [
      { date_planifiee: null, technicien_id: "t1" },
      { date_planifiee: DEBUT, technicien_id: "t2" },
    ];
    expect(interventionsDuJour(lignes, DEBUT, FIN)).toEqual([lignes[1]]);
  });

  it("écarte une ligne d'un AUTRE jour", () => {
    const lignes = [{ date_planifiee: VEILLE, technicien_id: "t1" }];
    expect(interventionsDuJour(lignes, DEBUT, FIN)).toEqual([]);
  });

  it("LE CAS QUI DOIT RESTER VERT : une ligne pile sur le début du jour compte", () => {
    const lignes = [{ date_planifiee: DEBUT, technicien_id: "t1" }];
    expect(interventionsDuJour(lignes, DEBUT, FIN)).toEqual(lignes);
  });

  it("la borne haute est EXCLUSIVE, comme dans `listerPlanning`", () => {
    const lignes = [{ date_planifiee: FIN, technicien_id: "t1" }];
    expect(interventionsDuJour(lignes, DEBUT, FIN)).toEqual([]);
  });
});

describe("le détail « non affectée(s) » sous le KPI du jour", () => {
  it("est ABSENT plutôt qu'à zéro", () => {
    // *Un détail qui affiche toujours quelque chose finit par ne plus se
    // lire* (§9, 06/09) — « 0 non affectée » ne dit rien qu'un lecteur ait
    // besoin de lire.
    const lignes = [{ date_planifiee: DEBUT, technicien_id: "t1" }];
    expect(nonAffecteesAujourdHui(lignes)).toBe(0);
    expect(detailInterventionsDuJour(lignes)).toBeUndefined();
  });

  it("accorde le singulier", () => {
    const lignes = [{ date_planifiee: DEBUT, technicien_id: null }];
    expect(detailInterventionsDuJour(lignes)).toBe(
      `1 ${t("tableau_de_bord.non_affectee_une")}`,
    );
  });

  it("accorde le pluriel", () => {
    const lignes = [
      { date_planifiee: DEBUT, technicien_id: null },
      { date_planifiee: DEBUT, technicien_id: null },
    ];
    expect(detailInterventionsDuJour(lignes)).toBe(
      `2 ${t("tableau_de_bord.non_affectees")}`,
    );
  });
});

describe("l'ancienneté « en attente de pièce »", () => {
  it("compte STRICTEMENT au-delà du seuil, pas à l'égalité", () => {
    // *Le seuil est écrit une fois* (SEUIL_ANCIENNETE_JOURS = 30) : une fiche
    // à exactement 30 jours n'est pas encore « depuis plus de 30 jours ».
    const lignes = [{ ancienneteJours: 30 }, { ancienneteJours: 31 }];
    expect(ancienNombreEnAttente(lignes)).toBe(1);
  });

  it("le détail est ABSENT quand rien ne dépasse le seuil", () => {
    const lignes = [{ ancienneteJours: 2 }, { ancienneteJours: 30 }];
    expect(detailEnAttenteDePiece(lignes)).toBeUndefined();
  });

  it("le détail NOMME le compte et le seuil, comme la maquette l'écrit", () => {
    const lignes = [{ ancienneteJours: 45 }, { ancienneteJours: 3 }];
    const detail = detailEnAttenteDePiece(lignes);
    expect(detail).toContain("1");
    expect(detail).toContain(t("tableau_de_bord.en_attente_detail_suffixe"));
  });
});

describe("les techniciens indisponibles se comptent par PERSONNE", () => {
  it("ne compte pas deux fois la même personne bloquée deux fois", () => {
    // *Deux blocages qui se chevauchent sur la même personne ne comptent
    // qu'une fois.*
    const absences = [{ utilisateur_id: "p1" }, { utilisateur_id: "p1" }];
    expect(techniciensIndisponibles(absences)).toBe(1);
  });

  it("LE CAS QUI DOIT RESTER VERT : deux personnes distinctes comptent deux fois", () => {
    const absences = [{ utilisateur_id: "p1" }, { utilisateur_id: "p2" }];
    expect(techniciensIndisponibles(absences)).toBe(2);
  });

  it("une liste vide rend zéro, jamais une exception", () => {
    expect(techniciensIndisponibles([])).toBe(0);
  });
});

describe("« Priorités opérationnelles » : une P1 à planifier se lit comme urgente (TABLEAU-1)", () => {
  const REFERENCE = (ligne: { id: string; numero: number | null }) =>
    `Local-${ligne.id}`;

  it("le rang PORTE la priorité, jamais une position (« 01 »)", () => {
    // *Mesuré le 23/09/2026 : une fiche P1 — critique s'affichait « 01
    // Intervention à planifier », indiscernable d'une P4 en dixième
    // position.*
    const lignes = [
      {
        id: "a",
        numero: 1,
        priorite: "p1",
        client: { raison_sociale: "CALEBAM" },
      },
    ];
    const elements = prioritesAPlanifier(lignes, REFERENCE);
    expect(elements[0]?.rang).toBe("P1");
  });

  it("TRI P1 > P2 > P3 > P4 — une P1 remonte en tête, même arrivée en dernier", () => {
    const lignes = [
      { id: "p4", numero: 1, priorite: "p4", client: { raison_sociale: "A" } },
      { id: "p2", numero: 2, priorite: "p2", client: { raison_sociale: "B" } },
      { id: "p1", numero: 3, priorite: "p1", client: { raison_sociale: "C" } },
    ];
    const elements = prioritesAPlanifier(lignes, REFERENCE);
    expect(elements.map((e) => e.rang)).toEqual(["P1", "P2", "P4"]);
  });

  it("À PRIORITÉ ÉGALE, l'ordre reçu (déjà daté par `listerPlanning`) est conservé — tri STABLE", () => {
    const lignes = [
      {
        id: "ancienne",
        numero: 1,
        priorite: "p2",
        client: { raison_sociale: "Ancienne" },
      },
      {
        id: "recente",
        numero: 2,
        priorite: "p2",
        client: { raison_sociale: "Récente" },
      },
    ];
    const elements = prioritesAPlanifier(lignes, REFERENCE);
    expect(elements.map((e) => e.href)).toEqual([
      "/interventions/ancienne",
      "/interventions/recente",
    ]);
  });
});

describe("« VGP à prévoir » distingue le zéro mesuré du registre vierge (lot AV-14)", () => {
  // LA FORME A CHANGÉ LE 22/09/2026 (VGP-2) : le compte n'est plus UN chiffre
  // mais TROIS voies (dépassées, à venir, sans information) — voir
  // `vgp-trois-voies.test.ts`. Ce que ce bloc garde n'a pas bougé : au moins
  // une vérification → les comptes se lisent tels quels, même à zéro ; aucune
  // → « non calculé », jamais un zéro.
  const RIEN = { depassees: 0, aVenir: 0, sansInformation: 0 };

  it("LE CAS QUI DOIT RESTER VERT : au moins une vérification enregistrée → le compte se lit tel quel, même à zéro", () => {
    expect(etatVgpAPrevoir(true, RIEN)).toEqual({ calcule: true, ...RIEN });
    expect(
      etatVgpAPrevoir(true, { depassees: 0, aVenir: 6, sansInformation: 0 }),
    ).toEqual({ calcule: true, depassees: 0, aVenir: 6, sansInformation: 0 });
  });

  it("AUCUNE vérification jamais enregistrée → non calculé, quel que soit le compte reçu", () => {
    // `compterAPrevoir` ne peut rendre que des voies datées nulles dans ce cas
    // (voir sa propre note), mais la fonction ne le suppose pas : elle obéit
    // au drapeau.
    expect(etatVgpAPrevoir(false, RIEN)).toEqual({ calcule: false });
  });
});
