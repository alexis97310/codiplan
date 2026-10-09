import Link from "next/link";

import { Carte } from "@/components/ui/carte";
import { Icone } from "@/components/ui/icone";
import { t } from "@/lib/i18n/fr";

import { Jauge } from "./jauge";

/** Le minimum qu'une étape de « Mise en route » porte pour être affichée. */
export type EtapeAffichee = {
  readonly fait: boolean;
  readonly libelle: string;
  readonly href: string;
};

/**
 * « MISE EN ROUTE » — administrateur de société (`miseEnRoute`, maquette
 * :2828-2836, PU-1 ; 9EG-TP-UX6-TABLEAU-DE-BORD-2).
 */
export function BlocMiseEnRoute({
  etiquette,
  pourcentage,
  etapes,
}: Readonly<{
  etiquette: string;
  pourcentage: number;
  etapes: readonly EtapeAffichee[];
}>) {
  return (
    <Carte titre={t("tableau_de_bord.mise_en_route_titre")} icone="flag">
      <div className="px-[16px] pt-[2px] pb-[10px]">
        <Jauge etiquette={etiquette} pourcentage={pourcentage} />
      </div>
      <div data-bloc="mise-en-route-liste">
        {etapes.map((etape, index) => (
          <Link
            key={etape.href + index}
            href={etape.href}
            className="border-app-bord flex items-center gap-[10px] border-b px-[16px] py-[12px] text-13 font-bold last:border-b-0"
          >
            <span
              className={
                etape.fait
                  ? "bg-app-vert-fond text-app-vert-encre flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
                  : "bg-app-surface-creuse text-app-encre-faible flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
              }
            >
              {etape.fait ? (
                <Icone nom="check" taille={16} />
              ) : (
                <span className="text-12 font-bold">{index + 1}</span>
              )}
            </span>
            <span className="min-w-0 flex-1 truncate">{etape.libelle}</span>
            <Icone nom="chev-r" taille={16} />
          </Link>
        ))}
      </div>
    </Carte>
  );
}
