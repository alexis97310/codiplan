import Link from "next/link";

import { Carte } from "@/components/ui/carte";
import { Icone } from "@/components/ui/icone";
import { t } from "@/lib/i18n/fr";

/**
 * « PRÊTS EN RETARD » AU TABLEAU DE BORD (9L61-PRET-2-ECRANS-BUREAU, D287) —
 * même patron que `BlocDonneesACompleter` : une `Carte` à compteur, une
 * ligne par prêt, un lien vers l'intervention qui l'a motivé.
 */
export type LignePretEnRetard = {
  readonly id: string;
  readonly interventionId: string;
  readonly appareilDesignation: string;
  readonly dateRetourPrevueLibelle: string;
};

export function BlocPretsEnRetard({
  lignes,
}: Readonly<{ lignes: readonly LignePretEnRetard[] }>) {
  return (
    <Carte
      titre={t("tableau_de_bord.prets_en_retard.titre")}
      icone="alert"
      compte={lignes.length}
    >
      {lignes.length === 0 ? (
        <p className="text-app-encre-faible px-[16px] py-[12px] text-13 font-bold">
          {t("tableau_de_bord.prets_en_retard.vide")}
        </p>
      ) : (
        <div data-bloc="prets-en-retard-liste">
          {lignes.map((ligne) => (
            <Link
              key={ligne.id}
              href={`/interventions/${ligne.interventionId}`}
              className="border-app-bord flex items-center gap-[10px] border-b px-[16px] py-[12px] text-13 font-bold last:border-b-0"
            >
              <span className="bg-app-orange-fond text-app-orange-encre flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full">
                <Icone nom="alert" taille={16} />
              </span>
              <span className="min-w-0 flex-1 truncate">
                {ligne.appareilDesignation}
              </span>
              <span className="text-app-encre-faible shrink-0">
                {ligne.dateRetourPrevueLibelle}
              </span>
              <Icone nom="chev-r" taille={16} />
            </Link>
          ))}
        </div>
      )}
    </Carte>
  );
}
