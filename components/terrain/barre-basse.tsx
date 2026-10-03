"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icone } from "@/components/ui/icone";
import { t } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

import { ENTREES_BARRE_BASSE } from "./barre-basse-entrees";

/**
 * LA BARRE BASSE DU TERRAIN (QE-11, D161) — un écran par étape, deux
 * entrées seulement : « Journée » et « Profil ».
 *
 * ## CE N'EST PAS `BarreDeNavigation`, ET C'EST DÉLIBÉRÉ
 *
 * `ENTREES_TERRAIN` (`lib/navigation/entrees.ts`) reste VIDE (R5-01) — la
 * barre du HAUT du terrain n'en porte toujours aucune, et
 * `tests/unit/navigation/barre-du-terrain.test.tsx` le garde tel quel. Cette
 * barre BASSE est un second chrome, propre au terrain, fixé en pied d'écran :
 * `components/navigation/barre.tsx` ne la connaît pas, et elle ne connaît
 * pas la barre latérale ni ses entrées de domaine.
 *
 * ## « MACHINES » ET « SCANNER » NE SONT PAS ICI
 *
 * La maquette du 28/09 (`tTabs`, :5016) dessine quatre onglets ; celui-ci
 * n'en porte que deux. *Inventer un lien vers une page qui n'existe pas
 * encore est la faute que R5-01 a déjà nommée pour les entrées inertes* —
 * les deux autres onglets arriveront avec TP-PARC, et pas avant.
 *
 * ## LE CONTENU NE PASSE PAS SOUS CETTE BARRE
 *
 * `app/(mobile)/layout.tsx` réserve une marge basse égale à sa hauteur : une
 * barre fixe sans cette réserve masquerait la fin de chaque écran.
 */
export function BarreBasseDuTerrain() {
  const chemin = usePathname() ?? "";

  return (
    <nav
      aria-label={t("nav.libelle")}
      className="bg-app-surface border-app-bord fixed inset-x-0 bottom-0 z-50 flex h-[60px] border-t"
    >
      {ENTREES_BARRE_BASSE.map((entree) => {
        const actif = chemin === entree.chemin;
        return (
          <Link
            key={entree.cle}
            href={entree.chemin}
            aria-current={actif ? "page" : undefined}
            className={cn(
              "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 text-12 font-bold",
              actif ? "text-app-marque" : "text-app-encre-faible",
            )}
          >
            <Icone nom={entree.icone} />
            {t(entree.cle)}
          </Link>
        );
      })}
    </nav>
  );
}

/** La hauteur réservée par `app/(mobile)/layout.tsx` — une seule écriture (§9, 01/09). */
export const HAUTEUR_BARRE_BASSE_PX = 60;
