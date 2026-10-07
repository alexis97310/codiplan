"use client";

import { useId, useState } from "react";

import { t } from "@/lib/i18n/fr";

/**
 * LE BOUTON « ? » D'UN CHAMP (TP-UX5-1-FORMULAIRES, maquette du 28/09) —
 * montre UNE phrase déjà écrite dans `fr.ts`, jamais un texte composé ici.
 *
 * **44 px au téléphone** (R2-08) — même convention que `Choix`
 * (`components/ui/choix.tsx`) : la cible pleine sous 640 px, réduite au
 * bureau (`sm:`).
 *
 * **Le nom accessible se donne explicitement** — un bouton « ? » seul ne dit
 * rien au lecteur d'écran sur CE qu'il explique.
 */
export function AideChamp({
  nomAccessible,
  texte,
}: Readonly<{
  /** « Aide — <le champ concerné> », jamais « ? » seul. */
  nomAccessible: string;
  texte: string;
}>) {
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={nomAccessible}
        aria-expanded={ouvert}
        aria-describedby={ouvert ? id : undefined}
        onClick={() => setOuvert((precedent) => !precedent)}
        className="border-app-bord text-app-encre-faible flex h-11 w-11 flex-none items-center justify-center rounded-full border text-13 font-bold sm:h-5 sm:w-5"
      >
        {t("ui.aide_champ.symbole")}
      </button>
      {ouvert ? (
        <p
          id={id}
          role="status"
          className="bg-app-surface border-app-bord absolute top-full left-0 z-10 mt-1 w-56 rounded-md border p-2 text-12 font-bold shadow-lg"
        >
          {texte}
        </p>
      ) : null}
    </span>
  );
}
