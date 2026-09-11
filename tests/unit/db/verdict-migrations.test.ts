import { describe, expect, it } from "vitest";

import {
  verdictDesMigrations,
  type TentativeMigration,
} from "../../../lib/db/sante";

/**
 * L'ÉTAT D'UNE MIGRATION EST CELUI DE SA DERNIÈRE TENTATIVE.
 *
 * ## La faute rejouée ici
 *
 * `_prisma_migrations` porte **une ligne par ESSAI**, pas une par migration.
 * *Mesuré le 11/09/2026 en rejouant la panne sur un PostgreSQL jetable : après
 * `migrate resolve --rolled-back` puis `migrate deploy`, la table porte deux
 * lignes pour `20260913160000_suspension_l2_10` — annulée à 22:32:06, appliquée
 * à 22:32:09.*
 *
 * La sonde cherchait une tentative non appliquée **n'importe où** dans la
 * table. Elle trouvait l'annulée, et répondait « non » sur une base à jour.
 *
 * > Hier elle disait OUI sans mesurer, aujourd'hui NON sans mesurer. *Une
 * > alarme qui hurle à tort désapprend à lire les alarmes aussi sûrement qu'une
 * > alarme muette.*
 *
 * ## Les deux directions
 *
 * Chaque cas qui doit rendre « non » est doublé d'un cas qui doit rendre
 * « OUI POUR SA PROPRE RAISON (§9, 11/09) — la direction permissive est celle
 * qui ne produit aucun signal, et c'est exactement celle où la sonde d'hier
 * avait menti.
 */

const T0 = new Date("2026-09-11T22:32:00Z");

function tentative(
  nom: string,
  { debut = T0, finie = true, annulee = false } = {},
): TentativeMigration {
  return { nom, debut, finie, annulee };
}

/** Décalage en secondes depuis T0 — l'ordre des tentatives se lit là. */
function apres(secondes: number): Date {
  return new Date(T0.getTime() + secondes * 1000);
}

describe("verdict des migrations", () => {
  it("une base complète rend « à jour »", () => {
    const verdict = verdictDesMigrations(
      [tentative("1_a"), tentative("2_b")],
      ["1_a", "2_b"],
    );

    expect(verdict).toEqual({ aJour: true });
  });

  // ── LE DÉFAUT DU 11/09, ET SON JUMEAU ────────────────────────────────────

  it("ANNULÉE PUIS RÉAPPLIQUÉE rend « à jour » — c'est la faute réparée", () => {
    const verdict = verdictDesMigrations(
      [
        tentative("1_a"),
        // L'ordre d'ARRIVÉE est délibérément l'inverse de l'ordre du temps :
        // la fonction doit lire `debut`, jamais la position dans le tableau.
        tentative("2_b", { debut: apres(9), finie: true, annulee: false }),
        tentative("2_b", { debut: apres(6), finie: false, annulee: true }),
      ],
      ["1_a", "2_b"],
    );

    expect(verdict).toEqual({ aJour: true });
  });

  // LE CAS QUI DOIT RENDRE « NON » POUR SA PROPRE RAISON : la même paire de
  // lignes dans l'AUTRE ordre chronologique — appliquée puis annulée — décrit
  // une base dont la migration a été retirée après coup. Un verdict qui
  // regarderait « une tentative appliquée existe-t-elle ? » dirait « à jour »
  // et se tromperait, sans jamais rougir.
  it("APPLIQUÉE PUIS ANNULÉE rend « non » — l'ordre du temps décide, pas la présence", () => {
    const verdict = verdictDesMigrations(
      [
        tentative("1_a"),
        tentative("2_b", { debut: apres(6), finie: true, annulee: false }),
        tentative("2_b", { debut: apres(9), finie: false, annulee: true }),
      ],
      ["1_a", "2_b"],
    );

    expect(verdict).toMatchObject({ aJour: false, nom: "2_b", echec: false });
  });

  // ── LES TROIS ÉTATS, ET JAMAIS DEUX ──────────────────────────────────────

  it("une migration ANNULÉE et non rejouée rend « non » SANS être un échec", () => {
    // Elle se rejoue toute seule au déploiement suivant : le geste est
    // « migrer », pas « débloquer ».
    const verdict = verdictDesMigrations(
      [tentative("1_a"), tentative("2_b", { finie: false, annulee: true })],
      ["1_a", "2_b"],
    );

    expect(verdict).toMatchObject({ aJour: false, nom: "2_b", echec: false });
  });

  it("une migration EN ÉCHEC rend « non » AVEC l'échec — elle bloque les suivantes", () => {
    const verdict = verdictDesMigrations(
      [tentative("1_a"), tentative("2_b", { finie: false, annulee: false })],
      ["1_a", "2_b"],
    );

    expect(verdict).toMatchObject({ aJour: false, nom: "2_b", echec: true });
  });

  // L'ORDRE DU MOTIF N'EST PAS ARBITRAIRE : une migration en échec empêche
  // d'appliquer celles qui manquent. Nommer l'absence d'abord enverrait jouer
  // un geste qui ne peut pas aboutir.
  it("l'ÉCHEC est nommé avant l'ABSENCE, parce qu'il l'empêche", () => {
    const verdict = verdictDesMigrations(
      [
        tentative("1_a"),
        tentative("2_b", { finie: false, annulee: false }),
        // 3_c n'a aucune ligne : jamais tentée.
      ],
      ["1_a", "2_b", "3_c"],
    );

    expect(verdict).toMatchObject({ aJour: false, nom: "2_b", echec: true });
  });

  // Une migration en échec que le code déployé n'attend PAS verrouille quand
  // même la base : c'est PostgreSQL et Prisma qui refusent, pas le code.
  it("une migration EN ÉCHEC hors de l'attendu rend « non » quand même", () => {
    const verdict = verdictDesMigrations(
      [
        tentative("1_a"),
        tentative("9_future", { finie: false, annulee: false }),
      ],
      ["1_a"],
    );

    expect(verdict).toMatchObject({
      aJour: false,
      nom: "9_future",
      echec: true,
    });
  });

  // Le miroir du précédent : une migration APPLIQUÉE que le code n'attend pas
  // n'est pas un incident — la base est simplement en avance sur le paquet
  // déployé, ce qui arrive à chaque déploiement.
  it("une migration APPLIQUÉE hors de l'attendu rend « à jour »", () => {
    const verdict = verdictDesMigrations(
      [tentative("1_a"), tentative("9_future")],
      ["1_a"],
    );

    expect(verdict).toEqual({ aJour: true });
  });

  // ── LES DÉCOMPTES ────────────────────────────────────────────────────────

  it("le nombre d'absentes est celui des absentes, et le nom est la PREMIÈRE", () => {
    const verdict = verdictDesMigrations(
      [tentative("1_a")],
      ["1_a", "2_b", "3_c"],
    );

    expect(verdict).toMatchObject({ aJour: false, nom: "2_b", nombre: 2 });
  });

  // TÉMOIN : une base vierge n'est pas « à jour ». Un verdict qui partirait de
  // la table plutôt que de l'attendu rendrait « à jour » ici, sur une base qui
  // ne porte rien.
  it("une table VIDE rend « non » — et non « à jour »", () => {
    const verdict = verdictDesMigrations([], ["1_a"]);

    expect(verdict).toMatchObject({ aJour: false, nom: "1_a", nombre: 1 });
  });
});
