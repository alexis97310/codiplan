import { describe, expect, it } from "vitest";

import {
  GABARITS_DE_DEPART,
  gabaritDeDepart,
} from "@/lib/checklists/gabarits-de-depart";
import { schemaPointChecklist } from "@/lib/checklists/saisie";

/**
 * 9K20-CHECKLIST-DUPLIQUER-DEPART, étendu au ticket 9K30A-CHECKLIST-
 * GABARITS-VALIDES — VINGT-SIX gabarits validés par Alexis (atelier des
 * 10/11 et 11/11/2026), recopiés TEL QUEL. Ce fichier éprouve la FORME de
 * chacun — nombre de points, ordre sans trou ni doublon, types de réponse
 * conformes au schéma, aucun choix vide — et garde en détail le gabarit
 * « pont 2 colonnes électromécanique » (G01), qui n'a pas changé depuis
 * 9K20.
 */

const GABARIT_PONT_2_COLONNES_EM =
  "pont-2-colonnes-electromecanique-entretien-preventif";

const POINTS_REMISE_AU_CLIENT = [
  "Essai complet réalisé en présence du client",
  "Utilisateurs formés : utilisation, sécurités, entretien courant",
  "Notice et déclaration de conformité remises",
  "N° de série relevé, fiche machine à jour, étiquette QR posée",
  "Zone nettoyée, emballages évacués",
  "Réserves ou remarques du client",
];

describe("GABARITS_DE_DEPART — les gabarits validés", () => {
  // La source (`gabarits-valides-11-11.md`) porte 14 codes d'entretien (G00
  // à G13) et 12 codes d'installation (I00 à I11) = 26 au total, dont G01
  // existait déjà (9K20) : 25 NOUVEAUX rejoignent la liste par ce ticket.
  // Le ticket parlait de « 24 gabarits nouveaux » — un écart avec la source,
  // que ce commit suit (« recopie-le TEL QUEL ») plutôt que la prose du
  // ticket, et signale en passation.
  it("porte exactement vingt-six gabarits, chacun avec un identifiant unique", () => {
    expect(GABARITS_DE_DEPART).toHaveLength(26);
    const ids = GABARITS_DE_DEPART.map((gabarit) => gabarit.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("chaque gabarit porte AU MOINS un point, ordonné 1..N sans trou ni doublon", () => {
    for (const gabarit of GABARITS_DE_DEPART) {
      expect(gabarit.points.length).toBeGreaterThan(0);
      expect(gabarit.points.map((p) => p.ordre)).toEqual(
        Array.from({ length: gabarit.points.length }, (_, i) => i + 1),
      );
    }
  });

  it("chaque point de chaque gabarit est conforme au schéma de publication", () => {
    for (const gabarit of GABARITS_DE_DEPART) {
      for (const point of gabarit.points) {
        const verdict = schemaPointChecklist.safeParse(point);
        expect(
          verdict.success,
          `${gabarit.id} — ${JSON.stringify(verdict.error?.issues)}`,
        ).toBe(true);
      }
    }
  });

  it("AUCUNE tolérance, aucune valeur chiffrée — seule l'unité des mesures est posée", () => {
    for (const gabarit of GABARITS_DE_DEPART) {
      for (const point of gabarit.points) {
        if (point.typeReponse !== "valeur_mesuree") continue;
        expect(point.unite, gabarit.id).toBeTruthy();
        expect(point.toleranceMin, gabarit.id).toBeUndefined();
        expect(point.toleranceMax, gabarit.id).toBeUndefined();
      }
    }
  });

  it("un choix à cocher ne porte jamais une liste vide ni un doublon", () => {
    for (const gabarit of GABARITS_DE_DEPART) {
      for (const point of gabarit.points) {
        if (point.typeReponse !== "choix_dans_une_liste") continue;
        expect(point.choix.length, gabarit.id).toBeGreaterThan(0);
        expect(new Set(point.choix).size, gabarit.id).toBe(point.choix.length);
      }
    }
  });

  it("chaque gabarit d'installation (id en « -installation ») se termine par le bloc « Remise au client »", () => {
    const gabaritsInstallation = GABARITS_DE_DEPART.filter((gabarit) =>
      gabarit.id.endsWith("-installation"),
    );
    // Les douze gabarits d'installation de la source (I00 à I11).
    expect(gabaritsInstallation).toHaveLength(12);
    for (const gabarit of gabaritsInstallation) {
      const derniers = gabarit.points.slice(-6);
      expect(
        derniers.map((p) => p.libelle),
        gabarit.id,
      ).toEqual(POINTS_REMISE_AU_CLIENT);
      expect(derniers.every((p) => p.section === "Remise au client")).toBe(
        true,
      );
    }
  });

  it("typesSuggeres : les entretiens suggèrent les deux préventifs, les installations suggèrent « installation »", () => {
    for (const gabarit of GABARITS_DE_DEPART) {
      if (gabarit.id.endsWith("-installation")) {
        expect(gabarit.typesSuggeres, gabarit.id).toEqual(["installation"]);
      } else {
        expect(gabarit.typesSuggeres, gabarit.id).toEqual([
          "preventif_contrat",
          "preventif_hors_contrat",
        ]);
      }
    }
  });

  it("rattachementSuggere est un TEXTE, jamais un identifiant — les deux génériques n'en ont aucun", () => {
    const generiques = GABARITS_DE_DEPART.filter((gabarit) =>
      gabarit.id.startsWith("generique-"),
    );
    expect(generiques).toHaveLength(2);
    for (const gabarit of generiques) {
      expect(gabarit.rattachementSuggere).toBeNull();
    }
    for (const gabarit of GABARITS_DE_DEPART) {
      if (gabarit.rattachementSuggere === null) continue;
      expect(typeof gabarit.rattachementSuggere).toBe("string");
    }
  });

  it("gabaritDeDepart retrouve chaque gabarit par son identifiant, undefined sinon", () => {
    for (const gabarit of GABARITS_DE_DEPART) {
      expect(gabaritDeDepart(gabarit.id)).toBe(gabarit);
    }
    expect(gabaritDeDepart("inconnu")).toBeUndefined();
  });
});

describe("le gabarit « pont 2 colonnes électromécanique » (G01, 9K20) — inchangé", () => {
  const gabarit = gabaritDeDepart(GABARIT_PONT_2_COLONNES_EM);

  it("porte exactement quinze points, et son libellé n'a pas changé", () => {
    expect(gabarit?.libelle).toBe(
      "Entretien préventif — pont 2 colonnes électromécanique jusqu'à 3 t",
    );
    expect(gabarit?.points).toHaveLength(15);
  });

  it("exactement deux mesures, toutes deux en millimètres", () => {
    const mesures = (gabarit?.points ?? []).filter(
      (p) => p.typeReponse === "valeur_mesuree",
    );
    expect(mesures).toHaveLength(2);
    for (const point of mesures) {
      expect(point.typeReponse === "valeur_mesuree" && point.unite).toBe("mm");
    }
  });

  it("six points obligatoires exactement — les autres facultatifs", () => {
    const obligatoires = (gabarit?.points ?? []).filter((p) => p.obligatoire);
    expect(obligatoires).toHaveLength(6);
  });
});
