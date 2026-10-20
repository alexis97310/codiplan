import { beforeEach, describe, expect, it } from "vitest";

import {
  idsNouveaux,
  marquerOuverte,
  mettreAJourVues,
} from "@/lib/terrain/vues-locales";

/**
 * « NOUVELLE INTERVENTION » — LA MÉMOIRE LOCALE À L'APPAREIL (9F4H5-TERRAIN-
 * VIVANT, point 3). `idsNouveaux` est LA PART PURE (D-13) ; `mettreAJourVues`
 * et `marquerOuverte` sont éprouvées contre un `localStorage` factice
 * (jsdom en fournit un réel, suffisant ici — pas de double factice
 * nécessaire, à la différence d'IndexedDB).
 */
describe("idsNouveaux", () => {
  it("rien n'est nouveau au tout premier affichage (mémoire vide, connues === null)", () => {
    expect(idsNouveaux(null, ["a", "b"])).toEqual([]);
  });

  it("un id absent de « connues » est nouveau", () => {
    expect(idsNouveaux(new Set(["a"]), ["a", "b"])).toEqual(["b"]);
  });

  it("rien de nouveau quand tout est déjà connu", () => {
    expect(idsNouveaux(new Set(["a", "b"]), ["a", "b"])).toEqual([]);
  });
});

const UTILISATEUR_ID = "77777777-7777-7777-7777-777777777777";

describe("mettreAJourVues / marquerOuverte", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("le tout premier affichage ne marque rien en attente", () => {
    const resultat = mettreAJourVues(UTILISATEUR_ID, ["a", "b"]);
    expect(resultat.nouveaux).toEqual([]);
    expect(resultat.enAttente.size).toBe(0);
  });

  it("une intervention apparue APRÈS le premier affichage est en attente", () => {
    mettreAJourVues(UTILISATEUR_ID, ["a"]);
    const resultat = mettreAJourVues(UTILISATEUR_ID, ["a", "b"]);
    expect(resultat.nouveaux).toEqual(["b"]);
    expect(resultat.enAttente.has("b")).toBe(true);
  });

  it("l'attente SURVIT à un rafraîchissement qui ne change rien (pas encore ouverte)", () => {
    mettreAJourVues(UTILISATEUR_ID, ["a"]);
    mettreAJourVues(UTILISATEUR_ID, ["a", "b"]);
    const resultat = mettreAJourVues(UTILISATEUR_ID, ["a", "b"]);
    expect(resultat.enAttente.has("b")).toBe(true);
  });

  it("ouvrir la fiche efface l'attente, DE FAÇON PERSISTANTE", () => {
    mettreAJourVues(UTILISATEUR_ID, ["a"]);
    mettreAJourVues(UTILISATEUR_ID, ["a", "b"]);
    marquerOuverte(UTILISATEUR_ID, "b");
    const resultat = mettreAJourVues(UTILISATEUR_ID, ["a", "b"]);
    expect(resultat.enAttente.has("b")).toBe(false);
  });

  it("deux comptes, sur le même appareil, ne partagent pas leur mémoire", () => {
    const AUTRE_UTILISATEUR_ID = "88888888-8888-8888-8888-888888888888";
    mettreAJourVues(UTILISATEUR_ID, ["a"]);
    mettreAJourVues(AUTRE_UTILISATEUR_ID, ["a"]);
    // « b » est nouveau pour les DEUX comptes — si leur mémoire était
    // partagée, le second appel (sous l'autre compte) ne le détecterait
    // plus après le premier.
    const premier = mettreAJourVues(UTILISATEUR_ID, ["a", "b"]);
    const second = mettreAJourVues(AUTRE_UTILISATEUR_ID, ["a", "b"]);
    expect(premier.nouveaux).toEqual(["b"]);
    expect(second.nouveaux).toEqual(["b"]);
  });
});
