import { describe, expect, it } from "vitest";

import { t } from "@/lib/i18n/fr";
import { PORTES_PARAMETRAGE } from "@/lib/navigation/portes-parametrage";

/**
 * 9EWD2-PARAMETRES-HUB-ISOLATION — CHAQUE TITRE ET DESCRIPTION DU HUB,
 * FIGÉS CONTRE LE TEXTE DE LA MAQUETTE
 * (`docs/propositions/ergonomie-2026-09-28/maquette-toutes-pages.html`,
 * M:4381-4395).
 *
 * **Pourquoi un test séparé de `portes-sections.test.ts`** : celui-là
 * éprouve le RANGEMENT (sections, doublons) ; celui-ci éprouve le TEXTE —
 * mot pour mot, y compris le rendu de `titreCompose`/`resumeCompose`, qui ne
 * s'écrit jamais en dur dans `lib/i18n/fr.ts` (D5/D47).
 *
 * **« Tarifs » REJOINT ce fichier depuis 9EWE-PARAMETRES-TARIFS-PAGE-UNIQUE**
 * (décisions n° 97 et n° 98 d'Alexis, 13/10/2026) : la maquette dessine une
 * seule carte fusionnée (PA-08) ; le hub en porte désormais une seule aussi.
 * Le montant et la date du taux en vigueur, que la maquette compose DANS la
 * description, vivent dans la pastille-décompte séparée (`decompteTarifs`) —
 * ce fichier ne fige que la partie STATIQUE du texte.
 */
function porte(chemin: string) {
  const trouvee = PORTES_PARAMETRAGE.find((p) => p.chemin === chemin);
  if (trouvee === undefined) {
    throw new Error(`porte introuvable : ${chemin}`);
  }
  return trouvee;
}

function texteAffiche(p: ReturnType<typeof porte>): {
  readonly titre: string;
  readonly resume: string;
} {
  return {
    titre: p.titreCompose ? p.titreCompose() : t(p.titre),
    resume: p.resumeCompose ? p.resumeCompose() : t(p.resume),
  };
}

describe("le hub « Paramètres » reprend la maquette mot pour mot (M:4381-4395)", () => {
  it("Tarifs — « Taux horaire et forfaits » (M:4381-4382, sans la partie dynamique de la pastille-décompte)", () => {
    expect(texteAffiche(porte("/parametres/tarifs"))).toEqual({
      titre: "Tarifs",
      resume: "Taux horaire et forfaits",
    });
  });

  it("Trajets par zone — « Le trajet aller depuis l'agence, zone par zone »", () => {
    expect(texteAffiche(porte("/parametres/trajets"))).toEqual({
      titre: "Trajets par zone",
      resume: "Le trajet aller depuis l'agence, zone par zone",
    });
  });

  it("Prestations — « Ce que l'on sait faire, et sa durée standard »", () => {
    expect(texteAffiche(porte("/parametres/prestations"))).toEqual({
      titre: "Prestations",
      resume: "Ce que l'on sait faire, et sa durée standard",
    });
  });

  it("Agences — « Horaires, jours fériés travaillés et ponts »", () => {
    expect(texteAffiche(porte("/parametres/agences"))).toEqual({
      titre: "Agences",
      resume: "Horaires, jours fériés travaillés et ponts",
    });
  });

  it("Équipe et accès — « Techniciens, comptes de bureau, liens d'accès »", () => {
    expect(texteAffiche(porte("/parametres/equipe"))).toEqual({
      titre: "Équipe et accès",
      resume: "Techniciens, comptes de bureau, liens d'accès",
    });
  });

  it("Habilitations — « Le référentiel, et sa durée de validité »", () => {
    expect(texteAffiche(porte("/parametres/habilitations"))).toEqual({
      titre: "Habilitations",
      resume: "Le référentiel, et sa durée de validité",
    });
  });

  it("Référentiel matériel — « Familles (avec leur régime VGP) et modèles »", () => {
    expect(texteAffiche(porte("/parametres/materiel"))).toEqual({
      titre: "Référentiel matériel",
      resume: "Familles (avec leur régime VGP) et modèles",
    });
  });

  it("Imports Excel — « Contrôler un fichier, puis l'appliquer une seule fois »", () => {
    expect(texteAffiche(porte("/imports"))).toEqual({
      titre: "Imports Excel",
      resume: "Contrôler un fichier, puis l'appliquer une seule fois",
    });
  });

  it("Données à compléter — « Ce qui fausse la charge, la facturation ou les courriels »", () => {
    expect(texteAffiche(porte("/parametres/donnees"))).toEqual({
      titre: "Données à compléter",
      resume: "Ce qui fausse la charge, la facturation ou les courriels",
    });
  });
});
