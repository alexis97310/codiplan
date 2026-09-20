import { describe, expect, it } from "vitest";

import { estExpiree } from "@/app/(back-office)/parametres/equipe/presentation";
import { jourDe, versLocal, type Fuseau } from "@/lib/calendar/fuseau";
import type { LigneAttribution } from "@/lib/habilitations/depot";

/**
 * D-13 — LE BADGE D'EXPIRATION COMPARE UN JOUR LOCAL, JAMAIS LE JOUR UTC.
 *
 * `estExpiree` comparait le jour UTC de `date_expiration` au jour UTC de
 * `maintenant(fuseau).instant` — un `Date` que le fuseau n'a jamais touché
 * (`new Date(Date.now())`). À Nouméa (UTC+11), de minuit à onze heures du
 * matin locales, le jour UTC est encore celui de la veille : une attribution
 * expirée hier localement s'affichait « valide » pendant onze heures.
 *
 * ## L'instant choisi, et pourquoi il diverge VRAIMENT
 *
 * `2026-09-19T14:00:00Z` + 11 h (Pacific/Noumea) = `2026-09-20T01:00` : le
 * jour UTC est le 19, le jour local est déjà le 20. La première assertion ne
 * suppose pas cette divergence, elle la CONSTATE.
 */
describe("estExpiree — jour local, pas jour UTC (D-13)", () => {
  const fuseau: Fuseau = "Pacific/Noumea";
  const instant = new Date("2026-09-19T14:00:00.000Z");
  const local = versLocal(instant, fuseau);

  it("l'instant choisi diverge réellement entre jour UTC et jour à Nouméa", () => {
    expect(instant.getUTCDate()).toBe(19);
    expect(local.jour).toBe(20);
  });

  const attributionExpireeHierLocale: LigneAttribution = {
    id: "attribution-test",
    habilitation_id: "habilitation-test",
    code: "B0",
    libelle: "Conduite de nacelle",
    date_obtention: new Date(Date.UTC(2020, 0, 1)),
    // Le 19 septembre 2026 — « hier », vu depuis le jour local (le 20).
    date_expiration: new Date(Date.UTC(2026, 8, 19)),
  };

  it("est EXPIRÉE quand on compare au jour LOCAL (le correctif)", () => {
    expect(estExpiree(attributionExpireeHierLocale, jourDe(local))).toBe(true);
  });

  it("un test qui tomberait aussi avec l'ancien code ne prouverait rien : celui-ci tombe sur `.instant`", () => {
    // Ce que l'ANCIEN code produisait : le jour UTC de `.instant`, jamais
    // touché par le fuseau — reproduit ici sans passer par `estExpiree` deux
    // fois avec la même forme, pour que la régression soit visible si
    // quelqu'un réintroduit `.instant`.
    const jourUTCDeLInstant = {
      annee: instant.getUTCFullYear(),
      mois: instant.getUTCMonth() + 1,
      jour: instant.getUTCDate(),
    };
    expect(estExpiree(attributionExpireeHierLocale, jourUTCDeLInstant)).toBe(
      false,
    );
  });
});
