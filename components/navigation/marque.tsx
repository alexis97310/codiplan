import Link from "next/link";

import { t } from "@/lib/i18n/fr";

/**
 * LA MARQUE CLAIRE — triangle, « CODI »+« PLAN », « SAV », sur fond clair.
 *
 * Sortie de `barre.tsx` (GR17-M15) : le bandeau du terrain la rendait déjà,
 * et le segment `(sans-session)` — qui n'affiche aucun chrome, aucune
 * navigation — en a besoin pour la même raison que lui, avant que la moindre
 * société ne soit connue. Rendu IDENTIQUE aux deux endroits.
 */
export function MarqueClaire({ accueil }: { readonly accueil: string }) {
  return (
    <Link href={accueil} className="flex flex-shrink-0 items-center gap-2.5">
      <span
        aria-hidden
        className="border-b-app-accent h-0 w-0 border-r-[11px] border-b-[19px] border-l-[11px] border-r-transparent border-l-transparent"
      />
      <span className="leading-tight">
        <span className="text-[18px] font-extrabold tracking-tight">
          {t("nav.marque_debut")}
          <span className="text-app-marque">{t("nav.marque_fin")}</span>
        </span>
        <span className="text-app-encre-faible block text-12 font-bold tracking-[1.5px]">
          {t("nav.marque_metier")}
        </span>
      </span>
    </Link>
  );
}
