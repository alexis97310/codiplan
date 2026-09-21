"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { t } from "@/lib/i18n/fr";

/**
 * LE DÉCLENCHEUR MOBILE DE LA COLONNE (COQUE-375) — arbitrage du directeur
 * d'exploitation rendu le 21/09/2026, mesuré au navigateur sur le site en
 * ligne à 375 px : `<aside>` porte une largeur FIXE de 272 px
 * (`components/navigation/barre.tsx`), sans la moindre classe responsive, et
 * le back-office comme le portail — les deux appellent la même barre — n'ont
 * pas de déclencheur pour la refermer sous ce seuil. Le terrain n'est pas
 * concerné : sa liste d'entrées est vide (R5-01), il ne rend jamais cette
 * colonne.
 *
 * ## LE SEUIL EST CELUI DÉJÀ ÉPROUVÉ, PAS UN NOUVEAU
 *
 * `901px` (`min-[901px]:`) est le point de rupture de
 * `components/ui/maitre-detail.tsx`, tenu jusqu'à 390 px par
 * `tests/e2e/parc.spec.ts`. La consigne du ticket est explicite : ne pas
 * inventer un second système de points de rupture.
 *
 * ## POURQUOI UN CONTEXTE, ET NON UNE PROPRIÉTÉ
 *
 * La colonne (`BarreDeNavigation`, dans `<aside>`) et ce bandeau sont deux
 * FRÈRES posés par `layout.tsx` — un composant SERVEUR, qui ne peut porter
 * aucun `useState` et ne peut pas non plus transmettre une fonction entre
 * deux composants client qu'il se contente d'assembler. `FournisseurNavigationMobile`
 * est le seul point commun des deux : `layout.tsx` continue d'écrire
 * `<BarreDeNavigation entrees={ENTREES} …/>` en toutes lettres — c'est ce que
 * lit le gardien statique de R2-16 (`tests/unit/app/barre-par-segment.test.ts`)
 * — et n'a besoin de rien savoir de plus que ce fournisseur existe.
 */
type EtatNavigationMobile = {
  readonly ouvert: boolean;
  readonly ouvrir: () => void;
  readonly fermer: () => void;
};

const SANS_FOURNISSEUR: EtatNavigationMobile = {
  ouvert: false,
  ouvrir: () => {},
  fermer: () => {},
};

const CONTEXTE_NAVIGATION_MOBILE =
  createContext<EtatNavigationMobile>(SANS_FOURNISSEUR);

/**
 * Consommé par `BarreDeNavigation` (pour l'aside) et par `BandeauMobile`
 * (pour le bouton) — la SEULE source de l'état d'ouverture.
 *
 * La valeur par défaut (`SANS_FOURNISSEUR`) sert le terrain : sa mise en page
 * ne pose aucun `FournisseurNavigationMobile`, et `BarreDeNavigation` y
 * bascule de toute façon sur `BarreHorizontaleVide` avant de lire ce
 * contexte (`entrees` y est toujours vide, R5-01).
 */
export function useNavigationMobile(): EtatNavigationMobile {
  return useContext(CONTEXTE_NAVIGATION_MOBILE);
}

/** Porte l'état « ouvert » du tiroir, partagé entre les deux frères ci-dessus. */
export function FournisseurNavigationMobile({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [ouvert, setOuvert] = useState(false);
  const pathname = usePathname();

  // Une navigation referme le tiroir : sans cela il resterait ouvert
  // par-dessus l'écran qu'on vient d'atteindre, cachant ce qu'on est venu
  // voir.
  useEffect(() => {
    setOuvert(false);
  }, [pathname]);

  return (
    <CONTEXTE_NAVIGATION_MOBILE.Provider
      value={{
        ouvert,
        ouvrir: () => setOuvert(true),
        fermer: () => setOuvert(false),
      }}
    >
      {children}
    </CONTEXTE_NAVIGATION_MOBILE.Provider>
  );
}

/**
 * LE BANDEAU LUI-MÊME — mince, sur téléphone uniquement (masqué dès 901 px),
 * portant le bouton d'ouverture et le titre de l'écran (décision du
 * directeur d'exploitation, COQUE-375).
 *
 * ## LE TITRE VIENT DU DOM, JAMAIS D'UNE SECONDE LISTE
 *
 * `components/mise-en-page/page.tsx` écrit déjà UN SEUL `<h1>` par écran —
 * la source unique du titre d'un écran. Une carte chemin → titre tenue ici à
 * la main serait une SECONDE lecture d'un même critère, et elle diverge en
 * silence dès le premier écran qui change son titre sans passer par ce
 * fichier (§9 du CLAUDE.md). Ce bandeau lit donc le DOM plutôt que de
 * deviner : un `MutationObserver` reprend le texte du premier `<h1>` du
 * document dès qu'il paraît — le rendu en flux le dépose parfois APRÈS la
 * première peinture (voir le commentaire de `tests/e2e/ecrans-largeur-utile.spec.ts`
 * sur ce point).
 */
export function BandeauMobile() {
  const { ouvert, ouvrir } = useNavigationMobile();
  const pathname = usePathname();
  const [titre, setTitre] = useState("");

  useEffect(() => {
    const lireLeTitre = () => {
      setTitre(document.querySelector("main h1")?.textContent?.trim() ?? "");
    };
    lireLeTitre();
    const observateur = new MutationObserver(lireLeTitre);
    observateur.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => observateur.disconnect();
  }, [pathname]);

  return (
    <header className="bg-app-surface border-app-bord sticky top-0 z-20 flex h-[52px] items-center gap-3 border-b px-4 min-[901px]:hidden">
      <button
        type="button"
        onClick={ouvrir}
        aria-controls="colonne-navigation"
        aria-expanded={ouvert}
        aria-label={t("nav.ouvrir_le_menu")}
        className="text-app-marque -ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
      >
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M3 5h14M3 10h14M3 15h14" />
        </svg>
      </button>
      <span className="truncate text-[15px] font-bold">{titre}</span>
    </header>
  );
}
