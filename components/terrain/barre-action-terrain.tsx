"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { t } from "@/lib/i18n/fr";

import { HAUTEUR_BARRE_BASSE_PX } from "./barre-basse";

const ConteneurBarreAction = createContext<HTMLDivElement | null>(null);

/**
 * LA BARRE D'ACTION FIXE DE LA FICHE TERRAIN (9L04G-TERRAIN-BARRE-FIXE-
 * TERMINER, décision d'Alexis du 13/11/2026) — le geste qui fait avancer
 * l'intervention (« Suspendre »/« Terminer » en cours, « Démarrer » avant,
 * l'action que D220 autorise après « Terminée ») reste joignable SANS
 * défiler, au-dessus de la barre basse (`z-50`,
 * `components/terrain/barre-basse.tsx`) — SOUS la feuille plein écran de
 * confirmation « Terminer » (`z-[60]`, `rapport-automatique.tsx`), qui doit
 * continuer à la couvrir entièrement.
 *
 * **Un conteneur, jamais un second état** — `BoutonCompteurTerrain`,
 * `BoutonSuspendreTerrain` et le déclencheur « Terminer » de
 * `RapportTerrainAutomatique` restent chacun seul maître de SA logique
 * (file hors réseau, refus serveur, confirmation) ; seul l'EMPLACEMENT
 * visuel de leur bouton change, par un portail vers ce conteneur — jamais un
 * état remonté ici qui pourrait diverger de celui que chaque composant garde
 * déjà (§9, 01/09).
 *
 * `empty:hidden` efface la barre (et sa bordure) quand aucun bouton n'y a
 * porté — une intervention SUSPENDUE n'a aujourd'hui aucun geste terrain à y
 * proposer (voir la passation : « Reprendre » depuis le terrain reste à
 * faire, même patron que D236 pour « Suspendre »).
 */
export function BarreActionTerrain({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [noeud, setNoeud] = useState<HTMLDivElement | null>(null);
  return (
    <ConteneurBarreAction.Provider value={noeud}>
      {children}
      <div
        ref={setNoeud}
        role="group"
        aria-label={t("terrain.barre_action.libelle")}
        className="bg-app-surface border-app-bord fixed inset-x-0 z-[55] flex gap-2 border-t px-4 py-2 empty:hidden empty:border-none"
        style={{ bottom: HAUTEUR_BARRE_BASSE_PX }}
      />
    </ConteneurBarreAction.Provider>
  );
}

/**
 * Porte SES enfants (un bouton d'action, jamais un message ni un formulaire
 * — ceux-là restent affichés là où ils sont, en contexte) vers la barre fixe
 * qui entoure la fiche. Rendu inline, inchangé, si aucune ne l'entoure (une
 * page sans `BarreActionTerrain`, ou un test qui monte le composant seul).
 */
export function DeclencheurBarreAction({
  children,
}: {
  readonly children: ReactNode;
}) {
  const noeud = useContext(ConteneurBarreAction);
  if (noeud === null) {
    return <>{children}</>;
  }
  return createPortal(children, noeud);
}
