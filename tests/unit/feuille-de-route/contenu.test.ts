import { describe, expect, it } from "vitest";

import { SECTIONS_FEUILLE_DE_ROUTE } from "@/lib/feuille-de-route/contenu";

/**
 * 9K25A-FEUILLE-DE-ROUTE-AUDIT-TECHNICIEN — la section « Application
 * technicien — audit du 10/11/2026 » et ses éléments sont bien dans le
 * module de données, mot pour mot (CLAUDE.md §5 point 5 : ce sont des
 * CONTENUS, pas des clés du dictionnaire).
 *
 * 9L30-FEUILLE-DE-ROUTE-22-11 (22/11/2026) : trois des neuf éléments d'origine
 * — B1/M1, B2/M3 (D241, D242, 9K26/9K27) et m10a (9L04H) — sont livrés et ont
 * migré vers « Livré depuis le 31/10 » ; les six qui restaient à trancher ou
 * à écrire gardaient leur texte mot pour mot.
 *
 * 9L33-MAJORATION-REGLAGE-SOCIETE (23/11/2026, séance de décisions
 * d'Alexis) : M2 a été tranché (« on garde un seul écran ») et a migré vers
 * la section « Décisions prises » — cinq éléments restaient ici.
 *
 * 9L36-ANNULER-DEMARRAGE-10S (23/11/2026) : M9 est livré (D282) et a migré
 * vers « Livré depuis le 31/10 » — quatre éléments restent ici.
 *
 * 9L37-CASES-26PX-TERRAIN (23/11/2026, séance de décisions d'Alexis) : m11
 * (couleurs) et m12 (cases à 26 px) ont été tranchés séparément — m12 est
 * livré et a migré vers « Livré depuis le 31/10 », m11 est NON RETENU et a
 * migré vers « Décisions prises » — trois éléments restent ici.
 */
describe("la section « Application technicien — audit du 10/11/2026 »", () => {
  const section = SECTIONS_FEUILLE_DE_ROUTE.find(
    (s) => s.titre === "Application technicien — audit du 10/11/2026",
  );

  it("existe", () => {
    expect(section).toBeDefined();
  });

  it("porte ses trois éléments restants, mot pour mot", () => {
    expect(section?.elements.map((e) => e.titre)).toEqual([
      "M8 — Ma journée : tri par priorité puis par date, carte « À faire maintenant » (maquette 01-journee).",
      "P6 — Compléter le catalogue des prestations par l'import avant la mise en service (geste d'exploitation ; maquette 03-rapport).",
      "m8, m10b et m13 — En-tête sur une ligne ; « Se déconnecter » et « Installer l'application » dans Profil ; pastille « En ligne / Hors ligne · saisies en attente » (maquettes 01-journee et 07-profil).",
    ]);
  });

  it("porte les statuts attendus", () => {
    expect(section?.elements.map((e) => e.statut)).toEqual([
      "a_ecrire",
      "a_ecrire",
      "a_ecrire",
    ]);
  });
});
