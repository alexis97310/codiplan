import { describe, expect, it } from "vitest";

import {
  texteCalendriers,
  titreCalendriers,
} from "@/app/(back-office)/planning/presentation";
import { t } from "@/lib/i18n/fr";
import { motDansUnePhrase } from "@/lib/i18n/vocabulaire";

/**
 * LA BANNIÈRE « CALENDRIERS D'AGENCE RESPECTÉS » NE NOMME PLUS UNE AGENCE
 * INACTIVE (AGENCE-ACTIVE, AA-5).
 *
 * `texteCalendriers` filtre elle-même sur `actif` — voir son en-tête
 * (`app/(back-office)/planning/presentation.ts`) : `pourGrille`/`pourJournee`
 * restent l'index de consultation complet, et c'est cette seule fonction de
 * présentation qui décide qui figure dans la bannière.
 */
describe("texteCalendriers — une agence inactive n'est jamais nommée", () => {
  it("une active et une inactive → seule l'active est nommée", () => {
    const texte = texteCalendriers([
      {
        libelle: "Ducos",
        joursOuverts: [1, 2, 3, 4, 5],
        calendrierConnu: true,
        actif: true,
      },
      {
        libelle: "Dolbeau",
        joursOuverts: [1, 2, 3, 4, 5],
        calendrierConnu: true,
        actif: false,
      },
    ]);

    expect(texte).toContain("Ducos");
    expect(texte).not.toContain("Dolbeau");
  });

  it("toutes inactives → la bannière ne nomme personne, mais garde son aide", () => {
    const texte = texteCalendriers([
      {
        libelle: "Ducos",
        joursOuverts: [1, 2, 3, 4, 5],
        calendrierConnu: true,
        actif: false,
      },
    ]);

    expect(texte).toBe(`. ${t("planning.calendriers_aide")}`);
  });

  it("toutes actives → aucune n'est retirée (témoin, pas de sur-filtrage)", () => {
    const texte = texteCalendriers([
      {
        libelle: "Ducos",
        joursOuverts: [1, 2, 3, 4, 5],
        calendrierConnu: true,
        actif: true,
      },
      {
        libelle: "Koné",
        joursOuverts: [],
        calendrierConnu: true,
        actif: true,
      },
    ]);

    expect(texte).toContain("Ducos");
    expect(texte).toContain("Koné");
  });
});

describe("titreCalendriers — témoin, composé hors du JSX", () => {
  it("compose le mot imposé « agence » dans le titre", () => {
    expect(titreCalendriers()).toBe(
      `${t("planning.calendriers_titre_prefixe")}${motDansUnePhrase("agence")} ${t("planning.calendriers_titre_suffixe")}`,
    );
  });
});
