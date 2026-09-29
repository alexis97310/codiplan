import { describe, expect, it } from "vitest";

import { statutDuTaux } from "@/app/(back-office)/parametres/taux-horaire/presentation";
import { t } from "@/lib/i18n/fr";

/**
 * LE STATUT D'UN ANCIEN TAUX — « Remplacé le ... » (PA-11, audit du
 * 28/09/2026).
 *
 * *Aucune lecture neuve de « quel taux s'applique »* : cette fonction ne fait
 * que DÉRIVER, depuis `enVigueurDepuis` (déjà rendu par `tauxEnVigueur`) et
 * l'ordre `date_effet desc` de la page, la date à laquelle chaque ancien taux
 * a été remplacé — celle du taux qui le précède dans la liste.
 */

type Ligne = { readonly date_effet: Date };

function ligne(iso: string): Ligne {
  return { date_effet: new Date(`${iso}T00:00:00.000Z`) };
}

describe("statutDuTaux — le statut de chaque ligne d'historique", () => {
  it("trois lignes, en vigueur la première — la 2e et la 3e sont remplacées par leur prédécesseur", () => {
    const lignes = [
      ligne("2026-09-01"),
      ligne("2024-01-01"),
      ligne("2020-01-01"),
    ];
    const enVigueurDepuis = ligne("2026-09-01").date_effet.getTime();
    expect(statutDuTaux(lignes, enVigueurDepuis)).toEqual([
      t("taux_horaire.en_vigueur"),
      "Remplacé le 01/09/2026",
      "Remplacé le 01/01/2024",
    ]);
  });

  it("une ligne dont la date est future (postérieure à enVigueurDepuis) reste vide", () => {
    const lignes = [ligne("2027-01-01"), ligne("2026-09-01")];
    const enVigueurDepuis = ligne("2026-09-01").date_effet.getTime();
    expect(statutDuTaux(lignes, enVigueurDepuis)).toEqual([
      null,
      t("taux_horaire.en_vigueur"),
    ]);
  });

  it("enVigueurDepuis nul — aucune ligne n'a de statut", () => {
    const lignes = [ligne("2026-09-01"), ligne("2024-01-01")];
    expect(statutDuTaux(lignes, null)).toEqual([null, null]);
  });

  it("une seule ligne, en vigueur — aucun prédécesseur à citer", () => {
    const lignes = [ligne("2026-09-01")];
    const enVigueurDepuis = ligne("2026-09-01").date_effet.getTime();
    expect(statutDuTaux(lignes, enVigueurDepuis)).toEqual([
      t("taux_horaire.en_vigueur"),
    ]);
  });
});
