import { Carte } from "@/components/ui/carte";
import { t } from "@/lib/i18n/fr";
import type { Annuaire } from "@/lib/auth/annuaire";
import type { LigneOccupation } from "@/lib/interventions/occupation";

import { Statistiques } from "../../app/(back-office)/planning/statistiques";

/**
 * « CHARGE DES 4 PROCHAINES SEMAINES » — `charge4Card()` de la maquette du
 * 28/09 (:2811-2817), responsable matériel seulement
 * (9EG-TP-UX6-TABLEAU-DE-BORD-1).
 *
 * **LE TAUX NE S'AFFICHE JAMAIS SEUL** (D56, `tests/unit/interventions/
 * occupation-affichee.test.ts`) — ÉCART NOMMÉ à la maquette, qui dessine un
 * tableau compact (une colonne par semaine, un pourcentage par case,
 * `cell()` :2813). Ce bloc rend à la place, pour chaque semaine, le MÊME
 * composant `Statistiques` que « Aujourd'hui, par technicien » et que le
 * planning : un taux PAR TECHNICIEN, jamais un taux d'équipe (D111, R2-13),
 * toujours accompagné du numérateur, du dénominateur et de la formule.
 */
export type SemaineDeCharge = {
  readonly numero: number;
  readonly occupations: readonly LigneOccupation[];
  /** Les techniciens actifs absents toute la semaine — une liste de noms, jamais une mesure de charge. */
  readonly absentsNoms: readonly string[];
};

export function BlocCharge4Semaines({
  semaines,
  annuaire,
}: Readonly<{
  readonly semaines: readonly SemaineDeCharge[];
  readonly annuaire: Annuaire;
}>) {
  return (
    <Carte
      titre={t("tableau_de_bord.bloc_charge4_titre")}
      icone="bars"
      action={{
        libelle: t("tableau_de_bord.bloc_charge4_action"),
        href: "/planning",
      }}
      pied={t("tableau_de_bord.bloc_charge4_pied")}
    >
      <div className="flex flex-col gap-3 px-[16px] py-[12px]">
        {semaines.map((semaine) => (
          <div key={semaine.numero} className="flex flex-col gap-2">
            <h3 className="text-13 font-bold">
              {t("tableau_de_bord.bloc_charge4_colonne_semaine_prefixe")}
              {semaine.numero}
            </h3>
            {semaine.absentsNoms.length === 0 ? null : (
              <p className="text-app-encre-faible text-12 font-bold">
                {t("tableau_de_bord.bloc_charge4_absent")}
                {t("ponctuation.deux_points")}
                {semaine.absentsNoms.join(t("ponctuation.virgule"))}
              </p>
            )}
            <Statistiques lignes={semaine.occupations} annuaire={annuaire} />
          </div>
        ))}
      </div>
    </Carte>
  );
}
