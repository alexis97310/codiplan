"use client";

import { useEffect, useState } from "react";

import { t } from "@/lib/i18n/fr";
import {
  compterEnAttente,
  EVENEMENT_FILE_MODIFIEE,
} from "@/lib/terrain/file-saisies";
import { cn } from "@/lib/utils";

/** `3 saisie(s) en attente` — composé hors du JSX (L0-11). */
function libelleSaisiesEnAttente(n: number): string {
  return `${n} ${t("terrain.reseau.saisie_attente")}`;
}

/**
 * `En ligne` ou `Hors ligne`, suivi de `· N saisie(s) en attente` dès que la
 * file n'est pas vide — jamais sans le compte, même en ligne (point 4,
 * 9L42-TERRAIN-ENTETE-PROFIL-PASTILLE) : un envoi qui échoue répétitivement
 * laisse des saisies en attente alors que le réseau est revenu.
 */
export function libellePastilleReseau(
  enLigne: boolean,
  enAttente: number,
): string {
  const etat = enLigne
    ? t("terrain.reseau.en_ligne")
    : t("terrain.reseau.hors_ligne");
  if (enAttente === 0) {
    return etat;
  }
  return `${etat}${t("ponctuation.point_median")}${libelleSaisiesEnAttente(enAttente)}`;
}

/**
 * LA PASTILLE RÉSEAU DU TERRAIN (audit du 10/11/2026, m13 ; maquettes
 * 01-journee et 07-profil) — posée à côté du titre de « Ma journée » et de
 * « Profil », MÊME SOURCE que le bouton « Envoyer »
 * (`components/terrain/bouton-envoyer.tsx`) : `compterEnAttente` et
 * `EVENEMENT_FILE_MODIFIEE` de `lib/terrain/file-saisies.ts`, jamais une
 * seconde lecture du même fait (§9, 01/09).
 *
 * ## POURQUOI PAS VERT, STYLE ÉPURÉ (décision d'Alexis du 13/11/2026)
 *
 * `app/globals.css` (`[data-zone="terrain"]`) réserve le vert à une RÉPONSE
 * DONNÉE — jamais un état qui change seul, hors de tout geste. « En ligne »
 * reste donc neutre ; seul l'état qui demande une action (hors réseau, ou une
 * file qui ne se vide pas) reprend l'ambre déjà posé par `BandeauReseau` et
 * `BoutonEnvoyer` (`border-app-orange-bord bg-app-orange-fond
 * text-app-orange-encre`), jamais une seconde palette pour le même fait.
 *
 * L'état n'est jamais donné par la seule couleur : le mot « En ligne » /
 * « Hors ligne » porte l'information, le point n'est que décoratif
 * (`aria-hidden`).
 */
export function PastilleReseau({
  utilisateurId,
  societeId,
}: {
  readonly utilisateurId: string;
  readonly societeId: string;
}) {
  const [enLigne, setEnLigne] = useState(true);
  const [enAttente, setEnAttente] = useState(0);

  useEffect(() => {
    setEnLigne(navigator.onLine);
    const rafraichirCompte = () => {
      void compterEnAttente({ utilisateurId, societeId }).then(setEnAttente);
    };
    rafraichirCompte();
    const surLigne = () => setEnLigne(true);
    const surHorsLigne = () => setEnLigne(false);
    window.addEventListener("online", surLigne);
    window.addEventListener("offline", surHorsLigne);
    window.addEventListener(EVENEMENT_FILE_MODIFIEE, rafraichirCompte);
    return () => {
      window.removeEventListener("online", surLigne);
      window.removeEventListener("offline", surHorsLigne);
      window.removeEventListener(EVENEMENT_FILE_MODIFIEE, rafraichirCompte);
    };
  }, [utilisateurId, societeId]);

  const attention = !enLigne || enAttente > 0;

  return (
    <span
      role="status"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-13 font-bold whitespace-nowrap",
        attention
          ? "border-app-orange-bord bg-app-orange-fond text-app-orange-encre border"
          : "bg-app-surface-creuse text-app-encre-faible",
      )}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
      />
      {libellePastilleReseau(enLigne, enAttente)}
    </span>
  );
}
