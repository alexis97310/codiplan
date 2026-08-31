import { describe, expect, it } from "vitest";

import {
  ecartsBattement,
  heuresEcoulees,
  HEURES_MAX_SANS_NUIT,
  rapportBattement,
  type ObservationBattement,
} from "../../scripts/lib/battement";

/**
 * Le BATTEMENT de la vérification nocturne (ticket R0-a, écart É12).
 *
 * Le contrôle lui-même interroge l'API de GitHub ; sa RÈGLE est pure, et c'est
 * elle qu'on éprouve ici, sur des états fabriqués — même montage que l'horizon
 * des fériés et celui des partitions.
 *
 * **Ce que ces scénarios doivent prouver, et qui n'est pas évident :** que le
 * battement échoue sur les DEUX pannes qui se ressemblent — le flux désactivé
 * et le flux actif qui ne produit plus — et qu'il échoue aussi quand il n'a
 * RIEN VU. Ce dernier cas est le plus important : une planification arrêtée et
 * un jeton aveugle produisent la même absence, et l'absence est exactement ce à
 * quoi ressemble le succès.
 */

/** Un état sain : flux actif, nuit d'il y a six heures. */
function sain(
  surcharge: Partial<ObservationBattement> = {},
): ObservationBattement {
  return {
    flux: "ci.yml",
    etat: "active",
    executionsPlanifiees: 11,
    dernierePlanifiee: "2026-08-31T15:06:29Z",
    maintenant: "2026-08-31T21:06:29Z",
    ...surcharge,
  };
}

describe("le battement de la vérification nocturne (R0-a, É12)", () => {
  it("un flux actif dont la dernière nuit est récente ne signale rien", () => {
    expect(ecartsBattement(sain())).toEqual([]);
  });

  it("TÉMOIN : zéro exécution planifiée est un ÉCHEC, jamais un succès", () => {
    // Le cas capital. Une planification arrêtée et un jeton aveugle produisent
    // la même absence — et un décompte nul ressemble toujours à un sans-faute
    // (§9, 30/08). Le contrôle doit dire qu'il n'a rien établi.
    const ecarts = ecartsBattement(
      sain({ executionsPlanifiees: 0, dernierePlanifiee: null }),
    );

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("aucune exécution PLANIFIÉE");
    expect(ecarts[0]).toContain("n'a rien prouvé");
  });

  it("la DÉSACTIVATION POUR INACTIVITÉ est nommée, avec sa cause", () => {
    // La règle des 60 jours de GitHub. Elle ne vise que les dépôts publics :
    // la voir signifie que le dépôt vient de le devenir, et c'est ce que le
    // message doit dire plutôt que « flux inactif ».
    const ecarts = ecartsBattement(sain({ etat: "disabled_inactivity" }));

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("DÉSACTIVÉ PAR GITHUB");
    expect(ecarts[0]).toContain("60 jours");
    expect(ecarts[0]).toContain("PUBLICS");
  });

  it("une désactivation MANUELLE est signalée aussi, sans être confondue", () => {
    const ecarts = ecartsBattement(sain({ etat: "disabled_manually" }));

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("n'est pas actif");
    expect(ecarts[0]).not.toContain("60 jours");
  });

  it("un flux ACTIF qui ne produit plus est refusé — l'état ne suffit pas", () => {
    // La panne que le seul `state` ne verrait pas : quota épuisé, cron cassé
    // par une modification, panne prolongée. Le flux reste « active » et rien
    // ne tourne.
    const ecarts = ecartsBattement(
      sain({
        dernierePlanifiee: "2026-08-25T15:06:29Z",
        maintenant: "2026-08-31T21:06:29Z",
      }),
    );

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("a donc cessé de produire");
    expect(ecarts[0]).toContain("AUCUN échec");
  });

  it("le seuil est une frontière, pas une zone floue", () => {
    const bord = (heures: number) =>
      ecartsBattement(
        sain({
          dernierePlanifiee: "2026-08-30T00:00:00Z",
          maintenant: new Date(
            Date.parse("2026-08-30T00:00:00Z") + heures * 3_600_000,
          ).toISOString(),
        }),
      );

    expect(bord(HEURES_MAX_SANS_NUIT)).toEqual([]);
    expect(bord(HEURES_MAX_SANS_NUIT + 1)).toHaveLength(1);
  });

  it("les DEUX signaux se cumulent — un flux désactivé ET muet le dit deux fois", () => {
    // Ils ne sont pas redondants : un flux peut être actif et muet, désactivé
    // et récemment actif. Les deux motifs doivent pouvoir apparaître ensemble.
    const ecarts = ecartsBattement(
      sain({
        etat: "disabled_inactivity",
        dernierePlanifiee: "2026-07-01T15:06:29Z",
        maintenant: "2026-08-31T21:06:29Z",
      }),
    );

    expect(ecarts).toHaveLength(2);
    expect(ecarts.join("\n")).toContain("DÉSACTIVÉ PAR GITHUB");
    expect(ecarts.join("\n")).toContain("cessé de produire");
  });

  it("une observation qui se CONTREDIT n'est pas traitée comme un succès", () => {
    // Des exécutions comptées, aucune date : l'API a répondu quelque chose
    // qu'on ne sait pas lire. Conclure au vert serait le pire des choix.
    const ecarts = ecartsBattement(sain({ dernierePlanifiee: null }));

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("se contredit");
  });

  it("des horodatages illisibles font échouer, jamais passer", () => {
    const ecarts = ecartsBattement(sain({ dernierePlanifiee: "hier soir" }));

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("illisibles");
  });

  it("`heuresEcoulees` compte des heures, et refuse ce qu'elle ne lit pas", () => {
    expect(heuresEcoulees("2026-08-31T00:00:00Z", "2026-08-31T12:00:00Z")).toBe(
      12,
    );
    expect(heuresEcoulees("pas une date", "2026-08-31T12:00:00Z")).toBeNull();
  });

  it("le rapport porte le témoin, pas seulement le verdict", () => {
    // Le décompte d'exécutions apparaît dans le journal : un contrôle vert sur
    // zéro observation doit se voir à la lecture, pas seulement à l'échec.
    const rapport = rapportBattement(sain());

    expect(rapport).toContain("exécutions planifiées   : 11");
    expect(rapport).toContain("témoin");
    expect(rapport).toContain("active");
  });
});
