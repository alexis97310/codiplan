"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Icone } from "@/components/ui/icone";
import { t } from "@/lib/i18n/fr";

/**
 * LE MENU « ⋯ » GÉNÉRIQUE (9ES-TP-UX4-3-FICHE-GESTES-1, décision n° 63
 * d'Alexis du 08/10/2026) — le patron derrière le menu « Plus d'actions » de
 * l'en-tête de la fiche intervention (maquette, `icon: "more"`).
 *
 * **Même patron qu'un menu déjà existant** (`MenuCreer`,
 * `components/navigation/menu-creer.tsx`) : Escape et le clic hors du menu
 * le ferment, posés à la main parce que CE menu n'est PAS un `<dialog>`
 * (contrairement à `Dialogue`) — un `role="menu"` ordinaire, pour qu'un
 * geste de ce menu puisse ensuite ouvrir un vrai dialogue sans l'imbriquer
 * dans un `<dialog>` déjà ouvert.
 *
 * **Les entrées sont laissées à l'appelant** (`enfants`, reçoit `fermer`) :
 * un lien (« Bon d'intervention ») ou le déclencheur d'un `Dialogue`
 * (« Annuler… ») s'y posent de la même façon, chacun avec `role="menuitem"`.
 */
export function MenuPlus({
  enfants,
}: Readonly<{
  readonly enfants: (fermer: () => void) => ReactNode;
}>) {
  const [ouvert, setOuvert] = useState(false);
  const conteneurRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ouvert) {
      return;
    }
    function surClicExterieur(evenement: MouseEvent): void {
      if (!conteneurRef.current?.contains(evenement.target as Node)) {
        setOuvert(false);
      }
    }
    function surTouche(evenement: KeyboardEvent): void {
      if (evenement.key === "Escape") {
        setOuvert(false);
      }
    }
    document.addEventListener("mousedown", surClicExterieur);
    document.addEventListener("keydown", surTouche);
    return () => {
      document.removeEventListener("mousedown", surClicExterieur);
      document.removeEventListener("keydown", surTouche);
    };
  }, [ouvert]);

  return (
    <div ref={conteneurRef} className="relative shrink-0">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={t("ui.menu_plus.titre")}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        onClick={() => setOuvert((v) => !v)}
      >
        <Icone nom="more" taille={18} />
      </Button>
      {!ouvert ? null : (
        <div
          role="menu"
          aria-label={t("ui.menu_plus.titre")}
          className="border-app-bord bg-app-surface absolute top-full right-0 z-40 mt-1.5 w-[220px] rounded-lg border p-1.5 shadow-xl"
        >
          {enfants(() => setOuvert(false))}
        </div>
      )}
    </div>
  );
}
