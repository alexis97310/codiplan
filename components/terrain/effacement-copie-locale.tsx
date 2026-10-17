"use client";

import { useEffect } from "react";

import { effacerCopie } from "@/lib/terrain/copie-locale";

/** La seule route de déconnexion du dépôt — `app/api/session/deconnexion/route.ts`. */
const ACTION_DECONNEXION = "/api/session/deconnexion";

/**
 * L'EFFACEMENT À LA DÉCONNEXION (point 6a, décision n° 106 d'Alexis,
 * 14/10/2026) — un seul écouteur, délégué sur `document`, plutôt que cinq
 * composants posés à la main sur les cinq formulaires MESURÉS
 * (`app/(sans-session)/enrolement/page.tsx`, `app/(sans-session)/connexion/
 * code/page.tsx`, `app/(mobile)/terrain/profil/page.tsx`, et les deux formes
 * de `components/navigation/barre.tsx`).
 *
 * ## POURQUOI UN ÉCOUTEUR GLOBAL, ET NON CINQ
 *
 * Les cinq emplacements d'aujourd'hui partagent une seule chose, et c'est
 * elle qui compte : ils soumettent tous vers `/api/session/deconnexion`. Un
 * écouteur délégué sur l'ACTION, posé une fois à la racine, couvre les cinq
 * — et couvre aussi un SIXIÈME formulaire de déconnexion qu'un lot futur
 * poserait sans savoir que ce ticket existe. Cinq composants nommés auraient
 * exigé qu'on les retrouve tous ; une liste tenue à la main est précisément
 * ce que ce dépôt refuse ailleurs (CLAUDE.md §6, »jamais une liste à
 * compléter, donc aucune liste à oublier«).
 *
 * ## `submit`, PAS `click`
 *
 * Un bouton de déconnexion est un `<button type="submit">` dans un
 * `<form>` natif (jamais un lien — `barre.tsx` l'explique : « une
 * déconnexion est une ÉCRITURE »). L'événement `submit` capture donc TOUTE
 * façon de déclencher l'envoi (clic, touche Entrée), là où `click` en
 * manquerait une.
 *
 * ## ELLE NE BLOQUE JAMAIS L'ENVOI
 *
 * `effacerCopie()` n'appelle jamais `preventDefault` : la déconnexion reste
 * un formulaire natif, qui fonctionne même sans JavaScript (même exigence que
 * le reste de l'authentification). L'effacement est au mieux — IndexedDB est
 * rapide, mais une page qui se décharge avant la fin de l'écriture ne doit
 * jamais empêcher la déconnexion elle-même.
 */
export function EffacementCopieADeconnexion() {
  useEffect(() => {
    function surSoumission(evenement: SubmitEvent) {
      const formulaire = evenement.target;
      if (!(formulaire instanceof HTMLFormElement)) {
        return;
      }
      const action = new URL(formulaire.action, window.location.origin)
        .pathname;
      if (action === ACTION_DECONNEXION) {
        void effacerCopie();
      }
    }
    document.addEventListener("submit", surSoumission);
    return () => document.removeEventListener("submit", surSoumission);
  }, []);

  return null;
}

/**
 * L'EFFACEMENT À L'ARRIVÉE SUR `/connexion` (point 6b) — un compte qui se
 * déconnecte atterrit ici (`app/api/session/deconnexion/route.ts`), mais
 * cette page est aussi la porte d'entrée BRUTE : quelqu'un qui tape l'URL
 * directement, ou dont la session a expiré sans passer par un bouton, ne
 * déclenche jamais l'écouteur ci-dessus. L'effacer ICI AUSSI referme ces deux
 * chemins avec un seul geste.
 */
export function EffacementCopieALouverture() {
  useEffect(() => {
    void effacerCopie();
  }, []);

  return null;
}
