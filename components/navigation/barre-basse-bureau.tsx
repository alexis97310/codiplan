"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icone } from "@/components/ui/icone";
import type { Role } from "@/lib/auth/roles";
import { t } from "@/lib/i18n/fr";
import { entreeActive, entreeVisible, ENTREES } from "@/lib/navigation/entrees";
import { cn } from "@/lib/utils";

import { useNavigationMobile } from "./bandeau-mobile";
import { ENTREES_BARRE_BASSE_BUREAU } from "./barre-basse-bureau-entrees";

/**
 * LA BARRE BASSE DU BUREAU, AU TÉLÉPHONE (QE-6a, 9DV-TP-NAV4-TELEPHONE-
 * GLOSSAIRE, décision 9 du pilote du 03/10/2026, D172) — Accueil, Planning,
 * Interventions, Parc, puis « Plus », sous 901 px (COQUE-375, même seuil que
 * `BandeauMobile`).
 *
 * **HOMONYMIE AVEC LE TERRAIN, ET C'EST POURQUOI CE FICHIER PORTE CE NOM-CI**
 * (et non `barre-basse.tsx`) : `components/terrain/barre-basse.tsx` existe
 * déjà (QE-11, D161) et n'a rien à voir avec celle-ci — deux écrans, deux
 * chromes, un seul mot pour les nommer aurait fait collision.
 *
 * **« Plus » OUVRE LE TIROIR COMPLET, LE MÊME QUE LE BOUTON DU BANDEAU
 * MOBILE** — `useNavigationMobile()` (`bandeau-mobile.tsx`) est déjà la seule
 * source de cet état, partagée par `BarreDeNavigation` (l'aside) et
 * `BandeauMobile` (le déclencheur du haut) : ce bouton est un TROISIÈME
 * consommateur du même contexte, jamais un second tiroir à maintenir en
 * accord avec le premier.
 *
 * **FILTRÉES PAR CAPACITÉ, COMME LE MENU** — `entreeVisible` relit
 * `CAPACITE_REQUISE` de `lib/navigation/entrees.ts`, la même matrice que la
 * barre latérale pour les mêmes quatre destinations : jamais une seconde
 * lecture du même critère (§9, 01/09). Les colonnes qu'une capacité retire
 * restent vides (la grille garde ses cinq colonnes, « Plus » toujours dans
 * la dernière) — « Plus » reste affiché même si les quatre tombent : le
 * tiroir qu'il ouvre porte d'autres destinations que ces quatre-ci.
 *
 * **LE CONTENU NE PASSE PAS SOUS CETTE BARRE** : `app/(back-office)/
 * layout.tsx` réserve une marge basse égale à sa hauteur (64 px, mesurée sur
 * `.bottom-nav` de `docs/propositions/ergonomie-2026-09-28/
 * maquette-toutes-pages.html:935`).
 */
export function BarreBasseBureau({
  role,
}: Readonly<{ readonly role: Role | null }>) {
  const chemin = usePathname() ?? "";
  const { ouvert, ouvrir } = useNavigationMobile();

  const entrees = ENTREES_BARRE_BASSE_BUREAU.filter((entree) =>
    entreeVisible(entree.cleCapacite, role),
  );

  return (
    <nav
      aria-label={t("nav.libelle")}
      className="bg-app-surface border-app-bord fixed inset-x-0 bottom-0 z-50 grid h-16 grid-cols-5 border-t min-[901px]:hidden"
    >
      {entrees.map((entree) => {
        const actif = entreeActive(chemin, ENTREES)?.cle === entree.cleCapacite;
        return (
          <Link
            key={entree.chemin}
            href={entree.chemin}
            aria-current={actif ? "page" : undefined}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center gap-0.5 text-12 font-bold",
              actif ? "text-app-marque" : "text-app-encre-faible",
            )}
          >
            <Icone nom={entree.icone} />
            {t(entree.cleLibelle)}
          </Link>
        );
      })}
      {/* Rempli l'une des cinq colonnes manquantes quand une capacité en retire
          une — la grille reste à cinq colonnes fixes (`grid-cols-5`), « Plus »
          toujours dans la dernière. */}
      {Array.from({ length: 4 - entrees.length }).map((_, index) => (
        <span key={`vide-${index}`} aria-hidden />
      ))}
      <button
        type="button"
        onClick={ouvrir}
        aria-controls="colonne-navigation"
        aria-expanded={ouvert}
        className="text-app-encre-faible flex min-h-11 flex-col items-center justify-center gap-0.5 text-12 font-bold"
      >
        <Icone nom="menu" />
        {t("nav.barre_basse.plus")}
      </button>
    </nav>
  );
}
