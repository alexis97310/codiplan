import { describe, expect, it } from "vitest";

import {
  libelleFuseau,
  libelleTerritoire,
} from "@/app/(back-office)/parametres/agences/presentation";

/**
 * 9G6-FORMULAIRES, point 6 — TERRITOIRE ET FUSEAU EN LIBELLÉS LISIBLES.
 *
 * `libelleFuseau` ne porte NI décalage UTC ni tri par territoire : les deux
 * exigeraient soit `new Date()`/`Intl.DateTimeFormat` hors de
 * `lib/calendar/fuseau.ts` (gardien `sans-date-courante-implicite`), soit un
 * identifiant IANA écrit en dur (gardien `sans-fuseau-en-dur`) — voir
 * l'en-tête du fichier testé.
 */
describe("libelleTerritoire — un code connu devient lisible, un code inconnu reste lui-même", () => {
  it("NC devient Nouvelle-Calédonie", () => {
    expect(libelleTerritoire("NC")).toBe("Nouvelle-Calédonie");
  });

  it("FR devient France métropolitaine", () => {
    expect(libelleTerritoire("FR")).toBe("France métropolitaine");
  });

  it("un code encore inconnu du produit reste affiché tel quel", () => {
    expect(libelleTerritoire("QM")).toBe("QM");
  });
});

describe("libelleFuseau — le nom de ville, jamais l'identifiant IANA brut", () => {
  it("Pacific/Noumea devient Nouméa, avec son accent", () => {
    expect(libelleFuseau("Pacific/Noumea")).toBe("Nouméa");
  });

  it("Europe/Paris devient Paris", () => {
    expect(libelleFuseau("Europe/Paris")).toBe("Paris");
  });

  it("un tiret bas devient un espace (America/New_York)", () => {
    expect(libelleFuseau("America/New_York")).toBe("New York");
  });
});
