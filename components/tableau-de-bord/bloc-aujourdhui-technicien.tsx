import { Avatar } from "@/components/ui/avatar";
import { Carte } from "@/components/ui/carte";
import { CLASSES_TON } from "@/components/ui/badge";
import { Priorite } from "@/components/ui/priorite";
import { CLASSES_STATUT, type StatutAffiche } from "@/lib/theme/statuts";
import { t, type CleTraduction } from "@/lib/i18n/fr";
import { motDansUnePhrase } from "@/lib/i18n/vocabulaire";
import type { Annuaire } from "@/lib/auth/annuaire";
import type { LigneOccupation } from "@/lib/interventions/occupation";

import { Statistiques } from "../../app/(back-office)/planning/statistiques";

/**
 * « AUJOURD'HUI, PAR TECHNICIEN » — `journeeCard()` de la maquette du 28/09
 * (:2795-2804), pour l'ADV et le responsable matériel
 * (9EG-TP-UX6-TABLEAU-DE-BORD-1).
 *
 * **LE TAUX NE S'AFFICHE JAMAIS SEUL** (demande d'exploitation du 10/09/2026,
 * D56 — *un nombre dont la signification dépend d'autre chose ne voyage
 * jamais seul*) : ce bloc ne calcule et n'affiche AUCUN pourcentage lui-même.
 * La liste nomme la personne, son agence et ses interventions du jour ; la
 * charge détaillée — numérateur, dénominateur, formule, dépassement — est
 * rendue par `Statistiques` (`app/(back-office)/planning/statistiques.tsx`),
 * le SEUL composant que `tests/unit/interventions/occupation-affichee.
 * test.ts` tient déjà aux quatre mentions inséparables. Écrire un second
 * affichage de taux ici referait, à l'identique, la faute que ce gardien
 * existe pour refuser — ÉCART NOMMÉ à la maquette (`meter()`, :2801), qui
 * dessine un taux par ligne sans ces mentions.
 */
export type LigneAujourdhuiTechnicien = {
  readonly technicienId: string;
  readonly nom: string;
  readonly agenceLibelle: string;
  readonly absent: boolean;
  readonly interventions: readonly {
    readonly id: string;
    readonly heure: string | null;
    readonly statut: string;
    readonly priorite: string;
    readonly clientNom: string;
  }[];
};

/** Le mot imposé « agence » ne s'écrit jamais au dictionnaire (D5, D47) : composé ici. */
function piedCarte(): string {
  return `${t("tableau_de_bord.bloc_aujourdhui_pied_prefixe")}${motDansUnePhrase("agence")}${t("tableau_de_bord.bloc_aujourdhui_pied_suffixe")}`;
}

export function BlocAujourdhuiParTechnicien({
  lignes,
  occupations,
  annuaire,
}: Readonly<{
  lignes: readonly LigneAujourdhuiTechnicien[];
  /** La charge détaillée de la même journée, pour `Statistiques` ci-dessous. */
  occupations: readonly LigneOccupation[];
  annuaire: Annuaire;
}>) {
  return (
    <Carte
      titre={t("tableau_de_bord.bloc_aujourdhui_titre")}
      icone="users"
      action={{
        libelle: t("tableau_de_bord.bloc_aujourdhui_action"),
        href: "/planning?vue=jour",
      }}
      pied={piedCarte()}
    >
      {lignes.map((ligne, index) => (
        <div
          key={`${ligne.technicienId}-${ligne.agenceLibelle}-${index}`}
          className="border-app-bord border-b px-[16px] py-[12px] last:border-b-0"
        >
          <div className="flex items-center gap-[10px]">
            <Avatar identifiant={ligne.technicienId} nom={ligne.nom} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-13 font-bold">{ligne.nom}</div>
              <div className="text-app-encre-faible truncate text-12 font-bold">
                {ligne.agenceLibelle}
                {t("ponctuation.point_median")}
                {ligne.interventions.length === 0
                  ? t("tableau_de_bord.bloc_aujourdhui_aucune")
                  : `${ligne.interventions.length} ${
                      ligne.interventions.length === 1
                        ? t("tableau_de_bord.bloc_aujourdhui_intervention_une")
                        : t("tableau_de_bord.bloc_aujourdhui_interventions")
                    }`}
              </div>
            </div>
            {ligne.absent ? (
              <span
                className={`rounded-full px-2 py-0.5 text-12 font-bold ${CLASSES_TON.gris}`}
              >
                {t("tableau_de_bord.bloc_aujourdhui_absent")}
              </span>
            ) : null}
          </div>
          {ligne.interventions.length === 0 ? null : (
            <ul className="mt-[8px] flex flex-col gap-[4px]">
              {ligne.interventions.map((intervention) => (
                <li
                  key={intervention.id}
                  className="flex items-center gap-[8px] text-12 font-bold"
                >
                  {intervention.heure === null ? null : (
                    <span className="w-[42px] shrink-0 tabular-nums">
                      {intervention.heure}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-12 font-bold ${CLASSES_STATUT[intervention.statut as StatutAffiche]}`}
                  >
                    {t(`statut.${intervention.statut}` as CleTraduction)}
                  </span>
                  {intervention.priorite === "p1" ||
                  intervention.priorite === "p2" ? (
                    <Priorite valeur={intervention.priorite} court />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate font-bold">
                    {intervention.clientNom}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      <div className="px-[16px] py-[12px]">
        <Statistiques lignes={occupations} annuaire={annuaire} />
      </div>
    </Carte>
  );
}
