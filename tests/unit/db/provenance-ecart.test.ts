import { describe, expect, it } from "vitest";

import { MIGRATIONS_ATTENDUES } from "@/lib/db/migrations-attendues";
import type { TentativeMigration } from "@/lib/db/sante";
import {
  PROVENANCE_NON_MESUREE,
  provenanceDesEcarts,
} from "../../../scripts/lib/provenance-ecart";

/**
 * R1-01 — LA VEILLE DIT D'OÙ VIENT UN ÉCART, AU LIEU DE L'AFFIRMER.
 *
 * *Mesuré le 10/09/2026 sur l'exécution `34493977325`, et rejoué le 12/09 sur
 * `34708986360` : le gabarit affirmait « ce sont des gestes passés à la main »
 * sur une alarme où la veille n'avait rien observé du tout.*
 *
 * Les deux verdicts sont éprouvés, et le second est tout le ticket : celui qui
 * NE conclut PAS au geste manuel.
 */

const appliquee = (nom: string): TentativeMigration => ({
  nom,
  debut: new Date("2026-09-01T00:00:00Z"),
  finie: true,
  annulee: false,
});

describe("la provenance d'un écart est mesurée, jamais affirmée", () => {
  it("base à jour : le geste manuel est la seule explication restante", () => {
    const provenance = provenanceDesEcarts(MIGRATIONS_ATTENDUES.map(appliquee));

    expect(provenance.aJour).toBe(true);
    expect(provenance.phrase).toMatch(/geste passé à la main/);
    expect(provenance.phrase).toMatch(/TOUTES les migrations/);
  });

  it("base en retard : la phrase NE conclut PAS au geste manuel", () => {
    const [premiere, ...suivantes] = MIGRATIONS_ATTENDUES;
    expect(
      premiere,
      "le dépôt doit porter au moins une migration",
    ).toBeDefined();

    const provenance = provenanceDesEcarts(suivantes.map(appliquee));

    expect(provenance.aJour).toBe(false);
    // LA MOITIÉ QUI COMPTE : la phrase fixe est absente.
    expect(provenance.phrase).not.toMatch(/geste passé à la main/);
    expect(provenance.phrase).toMatch(/1 migration\(s\) en retard/);
    expect(provenance.phrase).toMatch(/DB migrate & seed/);
    expect(provenance.phrase).toMatch(/AVANT de conclure/);
    expect(provenance.phrase).toContain(premiere!);
  });

  it("migration EN ÉCHEC : le geste nommé est le déblocage, jamais la seule migration", () => {
    // Une migration en échec BLOQUE les suivantes : envoyer migrer d'abord
    // enverrait jouer un geste qui ne peut pas aboutir.
    const enEchec: TentativeMigration = {
      nom: MIGRATIONS_ATTENDUES[0]!,
      debut: new Date("2026-09-02T00:00:00Z"),
      finie: false,
      annulee: false,
    };
    const provenance = provenanceDesEcarts([
      ...MIGRATIONS_ATTENDUES.map(appliquee),
      enEchec,
    ]);

    expect(provenance.aJour).toBe(false);
    expect(provenance.phrase).toMatch(/DB resolve/);
    expect(provenance.phrase).not.toMatch(/geste passé à la main/);
  });

  it("non mesurée : la phrase ne se lit PAS comme « rien en retard »", () => {
    // Une provenance vide se lirait comme une mesure rassurante — le silence
    // qui a exactement la forme du succès (§9, 31/08).
    expect(PROVENANCE_NON_MESUREE).toMatch(/n'a PAS été mesuré/);
    expect(PROVENANCE_NON_MESUREE).not.toMatch(/geste passé à la main/);
  });
});
