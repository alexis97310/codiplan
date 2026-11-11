import { describe, expect, it } from "vitest";

import { SECTIONS_FEUILLE_DE_ROUTE } from "@/lib/feuille-de-route/contenu";

/**
 * 9K25A-FEUILLE-DE-ROUTE-AUDIT-TECHNICIEN — la section « Application
 * technicien — audit du 10/11/2026 » et ses neuf éléments sont bien dans le
 * module de données, mot pour mot (CLAUDE.md §5 point 5 : ce sont des
 * CONTENUS, pas des clés du dictionnaire).
 */
describe("la section « Application technicien — audit du 10/11/2026 »", () => {
  const section = SECTIONS_FEUILLE_DE_ROUTE.find(
    (s) => s.titre === "Application technicien — audit du 10/11/2026",
  );

  it("existe", () => {
    expect(section).toBeDefined();
  });

  it("porte ses neuf éléments, mot pour mot", () => {
    expect(section?.elements.map((e) => e.titre)).toEqual([
      "B1 et M1 — Fin d'intervention : l'alerte « signature non recueillie » part au responsable SAV, sinon à tout le bureau ; l'administrateur est prévenu quand il n'y a aucun responsable SAV ; le technicien voit deux messages distincts (maquette 06-terminer).",
      "B2 et M3 — « Terminer » exige le commentaire ; la confirmation dit ce qui manque et y conduit, en plein écran, avec le temps à jour (maquette 06-terminer).",
      "M2 — Fiche en quatre étapes (Infos, Rapport, Photos, Signature) avec une barre d'action fixe : à trancher, la règle actuelle est un seul écran (maquettes 02 à 05).",
      "M8 — Ma journée : tri par priorité puis par date, carte « À faire maintenant » (maquette 01-journee).",
      "M9 — « Annuler le démarrage » pendant 10 secondes : à trancher, le retour d'« en cours » vers « affectée » n'existe pas et le compteur fait foi (maquette 02-infos).",
      "P6 — Compléter le catalogue des prestations par l'import avant la mise en service (geste d'exploitation ; maquette 03-rapport).",
      "m8, m10b et m13 — En-tête sur une ligne ; « Se déconnecter » et « Installer l'application » dans Profil ; pastille « En ligne / Hors ligne · saisies en attente » (maquettes 01-journee et 07-profil).",
      "m10a — Signature : zone agrandie, nom du signataire prérempli avec le contact sur place (maquette 05-signature).",
      "m11 et m12 — Bleu pour l'état actif, rouge réservé à l'erreur ; cases de 26 px : à trancher, les couleurs et la taille du texte du terrain sont déjà décidées (maquette 03-rapport).",
    ]);
  });

  it("porte les statuts attendus", () => {
    expect(section?.elements.map((e) => e.statut)).toEqual([
      "pret",
      "pret",
      "decision",
      "a_ecrire",
      "decision",
      "a_ecrire",
      "a_ecrire",
      "a_ecrire",
      "decision",
    ]);
  });
});
