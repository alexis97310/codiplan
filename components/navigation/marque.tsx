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

/**
 * LA MARQUE DES ÉCRANS D'ACCÈS (D188, 9EWB3-CONNEXION-MAQUETTE) — un seul
 * `<a href="/">`, dont l'apparence bascule à 1024 px plutôt que de s'en
 * ajouter un second (`marque-connexion.spec.ts` : un seul `a[href="/"]`
 * attendu, quel que soit le viewport). Blanche, posée sur le panneau sombre
 * de `CadreAcces` à partir de 1024 px ; sombre sur fond clair, en haut du
 * formulaire, en dessous — exactement le même nœud DOM dans les deux cas,
 * seules ses classes répondent au point de rupture.
 */
export function MarqueAcces({ accueil }: { readonly accueil: string }) {
  return (
    <Link
      href={accueil}
      className="flex shrink-0 items-center gap-2.5 px-5 pt-6 min-[1024px]:bg-app-chrome-fond min-[1024px]:px-12 min-[1024px]:pt-12"
    >
      <span
        aria-hidden
        className="border-b-app-accent h-0 w-0 border-r-[11px] border-b-[19px] border-l-[11px] border-r-transparent border-l-transparent"
      />
      <span className="leading-tight">
        <span className="text-[18px] font-extrabold tracking-tight min-[1024px]:text-app-chrome-actif-encre">
          {t("nav.marque_debut")}
          <span className="text-app-marque min-[1024px]:text-app-chrome-lien">
            {t("nav.marque_fin")}
          </span>
        </span>
        <span className="text-app-encre-faible block text-12 font-bold tracking-[1.5px] min-[1024px]:text-app-chrome-encre-faible">
          {t("nav.marque_metier")}
        </span>
      </span>
    </Link>
  );
}
