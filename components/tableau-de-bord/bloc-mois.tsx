import type { TypeIntervention } from "@prisma/client";

import { Carte } from "@/components/ui/carte";
import { t, type CleTraduction } from "@/lib/i18n/fr";

/**
 * « <MOIS ANNÉE>, AU JJ/MM » — direction (`moisCard`, maquette :2823-2826 ;
 * 9EG-TP-UX6-TABLEAU-DE-BORD-2). **Aucune somme, aucune heure** — trois
 * décomptes (créées, clôturées, par nature), jamais un montant ni un temps
 * mesuré (9DT, D170).
 */
export function BlocMois({
  titre,
  creees,
  cloturees,
  parNature,
}: Readonly<{
  titre: string;
  creees: number;
  cloturees: number;
  parNature: readonly {
    readonly type: TypeIntervention;
    readonly compte: number;
  }[];
}>) {
  const max = Math.max(1, ...parNature.map((ligne) => ligne.compte));
  return (
    <Carte
      titre={titre}
      icone="chart"
      action={{ libelle: t("nav.indicateurs_du_mois"), href: "/indicateurs" }}
    >
      <div className="grid grid-cols-2 gap-3 p-[16px]">
        <KpiMini
          libelle={t("tableau_de_bord.bloc_mois_creees")}
          valeur={creees}
        />
        <KpiMini
          libelle={t("tableau_de_bord.bloc_mois_cloturees")}
          valeur={cloturees}
        />
      </div>
      <p className="text-app-encre-faible border-app-bord border-t px-[16px] py-[8px] text-12 font-bold tracking-[0.4px] uppercase">
        {t("tableau_de_bord.bloc_mois_par_nature")}
      </p>
      <div
        data-bloc="mois-par-nature"
        className="flex flex-col gap-2 px-[16px] pb-[14px]"
      >
        {parNature.map((ligne) => (
          <div
            key={ligne.type}
            className="flex items-center gap-2 text-13 font-bold"
          >
            <span className="w-28 shrink-0 truncate">
              {t(`type_intervention.${ligne.type}` as CleTraduction)}
            </span>
            <span className="bg-app-surface-creuse h-[8px] flex-1 overflow-hidden rounded-full">
              <span
                className="bg-app-marque block h-full rounded-full"
                style={{ width: `${Math.round((ligne.compte / max) * 100)}%` }}
              />
            </span>
            <span className="w-6 shrink-0 text-right">{ligne.compte}</span>
          </div>
        ))}
      </div>
    </Carte>
  );
}

function KpiMini({
  libelle,
  valeur,
}: Readonly<{ libelle: string; valeur: number }>) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-app-encre-faible text-12 font-bold">{libelle}</span>
      <span className="text-18 font-extrabold">{valeur}</span>
    </div>
  );
}
