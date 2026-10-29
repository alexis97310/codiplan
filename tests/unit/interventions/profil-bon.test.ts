import { describe, expect, it } from "vitest";

import { t } from "@/lib/i18n/fr";
import {
  profilDuBon,
  TUILES_BON,
  type TuileBon,
} from "@/lib/interventions/profil-bon";
import { TYPES_INTERVENTION } from "@/lib/interventions/saisie";

/**
 * LE PROFIL D'AFFICHAGE DU BON (9I7-BON-INTERVENTION-EN-TUILES, point 2 bis).
 *
 * Une fonction PURE : aucune base, aucun calcul de montant. Ce qu'elle doit
 * garantir — un profil pour CHAQUE nature, jamais sept tuiles sans l'une
 * d'elles ni une tuile en double.
 */

const GROUPE_PREVENTIF = new Set([
  "preventif_contrat",
  "preventif_hors_contrat",
  "controle_reglementaire",
]);

describe("profilDuBon — exhaustif sur les neuf natures du chapitre 11.2", () => {
  it.each(TYPES_INTERVENTION)(
    "%s porte un profil avec les sept tuiles, chacune une seule fois",
    (type) => {
      const profil = profilDuBon(type);
      expect(profil.ordreTuiles).toHaveLength(TUILES_BON.length);
      expect(new Set(profil.ordreTuiles)).toEqual(new Set(TUILES_BON));
    },
  );

  it.each(TYPES_INTERVENTION)(
    "%s — le titre du document compose « Bon d'intervention — <nature> », jamais un libellé inventé",
    (type) => {
      const profil = profilDuBon(type);
      expect(profil.titreDocument).toBe(
        `${t("intervention.bon.titre")}${t("ponctuation.separateur")}${t(`type_intervention.${type}`)}`,
      );
    },
  );

  it("préventifs et contrôle réglementaire : « prestations » vient juste après « materiel »", () => {
    for (const type of TYPES_INTERVENTION) {
      if (!GROUPE_PREVENTIF.has(type)) {
        continue;
      }
      const profil = profilDuBon(type);
      const indexMateriel = profil.ordreTuiles.indexOf("materiel");
      const indexPrestations = profil.ordreTuiles.indexOf("prestations");
      expect(indexPrestations).toBe(indexMateriel + 1);
    }
  });

  it("curatif, garantie, reprise et les autres natures : « commentaires » vient juste après « intervention »", () => {
    for (const type of TYPES_INTERVENTION) {
      if (GROUPE_PREVENTIF.has(type)) {
        continue;
      }
      const profil = profilDuBon(type);
      const indexIntervention = profil.ordreTuiles.indexOf(
        "intervention" satisfies TuileBon,
      );
      const indexCommentaires = profil.ordreTuiles.indexOf("commentaires");
      expect(indexCommentaires).toBe(indexIntervention + 1);
    }
  });
});
