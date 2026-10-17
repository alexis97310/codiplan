"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/fr";
import { effacerCopie, lireCopie } from "@/lib/terrain/copie-locale";
import { compterEnAttente } from "@/lib/terrain/file-saisies";
import { envoyerFile } from "@/lib/terrain/envoi-file";

/** La seule route de déconnexion du dépôt — `app/api/session/deconnexion/route.ts`. */
const ACTION_DECONNEXION = "/api/session/deconnexion";

/** Un formulaire déjà confirmé ne repose plus la question (voir `requestSubmit` ci-dessous). */
const MARQUE_CONFIRME = "codiplanConfirmeDeconnexion";

type Confirmation = {
  readonly formulaire: HTMLFormElement;
  readonly identite: {
    readonly utilisateurId: string;
    readonly societeId: string;
  };
  readonly n: number;
};

/**
 * L'EFFACEMENT À LA DÉCONNEXION (point 6a de 9F4H1, décision n° 106
 * d'Alexis) — ET, DEPUIS 9F4H3-HORS-RESEAU-ENVOYER (point 3, décision
 * n° 105 : « rien ne se perd ») — LA CONFIRMATION quand des saisies
 * attendent encore d'être envoyées.
 *
 * ## POURQUOI UN ÉCOUTEUR GLOBAL, ET NON CINQ (toujours valable)
 *
 * Voir le docblock original : un écouteur délégué sur l'ACTION couvre tous
 * les formulaires de déconnexion mesurés, et ceux qu'un lot futur poserait.
 *
 * ## OÙ VIENT L'IDENTITÉ, SANS JAMAIS LIRE LA SESSION ICI
 *
 * Ce composant est monté à la RACINE (`app/layout.tsx`), qui ne lit jamais
 * `obtenirSession` — elle doit s'afficher sans compte ni base (`/`, `/sante`).
 * L'identité vient donc de la copie locale déjà posée par 9F4H1
 * (`lireCopie()`, qui porte `utilisateurId`/`societeId`) — pas d'un second
 * mécanisme pour la même donnée (§9, 01/09).
 *
 * ## LA FILE N'EST JAMAIS BLOQUÉE EN SILENCE
 *
 * Sans copie locale, ou sans rien en attente, le comportement d'avant ce
 * lot reste EXACT : `effacerCopie()`, et la déconnexion part sans jamais
 * être retardée. Seule une file NON VIDE intercepte l'envoi — et seulement
 * pour poser la question, jamais pour refuser la déconnexion elle-même.
 */
export function EffacementCopieADeconnexion() {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  useEffect(() => {
    function surSoumission(evenement: SubmitEvent): void {
      const formulaire = evenement.target;
      if (!(formulaire instanceof HTMLFormElement)) {
        return;
      }
      const action = new URL(formulaire.action, window.location.origin)
        .pathname;
      if (action !== ACTION_DECONNEXION) {
        return;
      }
      if (formulaire.dataset[MARQUE_CONFIRME] === "1") {
        // DÉJÀ CONFIRMÉ (voir `requestSubmit` ci-dessous) — `effacerCopie()`
        // est déjà partie AVANT la marque ; ne pas la rappeler ici évite un
        // second appel si le navigateur redispatche `submit` en resoumettant.
        return;
      }
      evenement.preventDefault();
      void lireCopie().then((copie) => {
        if (copie === null) {
          void effacerCopie();
          formulaire.dataset[MARQUE_CONFIRME] = "1";
          formulaire.requestSubmit();
          return;
        }
        const identite = {
          utilisateurId: copie.utilisateurId,
          societeId: copie.societeId,
        };
        void compterEnAttente(identite).then((n) => {
          if (n === 0) {
            void effacerCopie();
            formulaire.dataset[MARQUE_CONFIRME] = "1";
            formulaire.requestSubmit();
            return;
          }
          setConfirmation({ formulaire, identite, n });
        });
      });
    }
    document.addEventListener("submit", surSoumission);
    return () => document.removeEventListener("submit", surSoumission);
  }, []);

  if (confirmation === null) {
    return null;
  }
  // Capturée dans une CONSTANTE non nulle : les fonctions ci-dessous
  // s'exécutent au clic, pas à ce rendu — `confirmation` (la variable
  // d'état) resterait `Confirmation | null` pour TypeScript à ce moment-là.
  const confirmationActuelle = confirmation;

  async function envoyerDabord(): Promise<void> {
    if (!navigator.onLine) {
      return;
    }
    await envoyerFile(confirmationActuelle.identite);
    const n = await compterEnAttente(confirmationActuelle.identite);
    if (n === 0) {
      setConfirmation(null);
      return;
    }
    setConfirmation({ ...confirmationActuelle, n });
  }

  function deconnecterQuandMeme(): void {
    void effacerCopie();
    confirmationActuelle.formulaire.dataset[MARQUE_CONFIRME] = "1";
    confirmationActuelle.formulaire.requestSubmit();
    setConfirmation(null);
  }

  return (
    <div
      role="alertdialog"
      className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre fixed inset-x-0 bottom-0 z-50 flex flex-col gap-2 border-t px-4 py-3.5"
    >
      <p className="text-16 font-bold">
        {confirmation.n}{" "}
        {confirmation.n === 1
          ? t("terrain.deconnexion.saisies_non_envoyees_singulier")
          : t("terrain.deconnexion.saisies_non_envoyees_pluriel")}
      </p>
      {navigator.onLine ? (
        <Button
          type="button"
          size="lg"
          className="w-full text-16"
          onClick={() => void envoyerDabord()}
        >
          {t("terrain.deconnexion.envoyer_dabord")}
        </Button>
      ) : (
        <p className="text-16 font-bold">
          {t("terrain.deconnexion.hors_reseau")}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full text-16"
        onClick={deconnecterQuandMeme}
      >
        {t("terrain.deconnexion.deconnecter_quand_meme")}
      </Button>
    </div>
  );
}

/**
 * L'EFFACEMENT À L'ARRIVÉE SUR `/connexion` (point 6b) — un compte qui se
 * déconnecte atterrit ici (`app/api/session/deconnexion/route.ts`), mais
 * cette page est aussi la porte d'entrée BRUTE : quelqu'un qui tape l'URL
 * directement, ou dont la session a expiré sans passer par un bouton, ne
 * déclenche jamais l'écouteur ci-dessus. L'effacer ICI AUSSI referme ces deux
 * chemins avec un seul geste.
 *
 * **Inchangé par 9F4H3** : la file des saisies n'est PAS effacée ici — elle
 * n'est jamais touchée par un changement d'identité (voir `file-saisies.ts`),
 * seule la copie de CONSULTATION l'est.
 */
export function EffacementCopieALouverture() {
  useEffect(() => {
    void effacerCopie();
  }, []);

  return null;
}
