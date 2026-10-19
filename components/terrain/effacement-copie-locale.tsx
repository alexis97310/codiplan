"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/fr";
import { effacerCopie, lireCopie } from "@/lib/terrain/copie-locale";
import {
  compterEnAttente,
  compterEnAttenteToutesIdentites,
  EVENEMENT_FILE_MODIFIEE,
} from "@/lib/terrain/file-saisies";
import { envoyerFile } from "@/lib/terrain/envoi-file";

type Identite = { readonly utilisateurId: string; readonly societeId: string };

/** La seule route de déconnexion du dépôt — `app/api/session/deconnexion/route.ts`. */
const ACTION_DECONNEXION = "/api/session/deconnexion";

/** Un formulaire déjà confirmé ne repose plus la question (voir `requestSubmit` ci-dessous). */
const MARQUE_CONFIRME = "codiplanConfirmeDeconnexion";

type Confirmation = {
  readonly formulaire: HTMLFormElement;
  /**
   * `null` quand l'instantané de consultation est absent (9F4H4C) — la file
   * peut quand même compter des saisies (voir `compterEnAttenteToutesIdentites`),
   * mais sans identité connue « Envoyer d'abord » ne peut pas être proposé.
   */
  readonly identite: Identite | null;
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
 * Sans rien en attente, le comportement d'avant ce lot reste EXACT :
 * `effacerCopie()`, et la déconnexion part sans jamais être retardée. Seule
 * une file NON VIDE intercepte l'envoi — et seulement pour poser la
 * question, jamais pour refuser la déconnexion elle-même.
 *
 * ## SANS INSTANTANÉ, LA FILE EST COMPTÉE QUAND MÊME (9F4H4C)
 *
 * *Mesuré : `tests/e2e/offline/9f4h3a-file-sans-perte.spec.ts`, deux clics
 * sur cinq rouges sur `origin/main` inchangé — l'écriture de l'instantané
 * dépend d'un `fetch` réseau qui court contre `context.setOffline`, et peut
 * donc ne jamais atteindre IndexedDB avant la déconnexion, même avec des
 * saisies en file.* `lireCopie() === null` ne voulait dire QUE « pas de copie
 * de CONSULTATION » ; ce lot cesse de le lire comme « pas de SAISIE non
 * envoyée ». Sans instantané, `compterEnAttenteToutesIdentites()` compte la
 * file ENTIÈRE de l'appareil (l'identité qui l'a écrite reste inconnue sans
 * lire la session, voir ci-dessus) : une file non vide pose la même question,
 * mais sans bouton « Envoyer d'abord » — l'envoi a besoin de CETTE identité,
 * qu'on n'a pas.
 *
 * ## LA DÉCISION D'INTERCEPTER EST PRISE SANS ATTENDRE INDEXEDDB
 *
 * *Mesuré (régression de la première version de ce lot) : `tests/e2e/
 * interventions-2.spec.ts`, « la note interne… », cliquait « Se déconnecter »
 * puis naviguait `page.goto("/connexion")` dans la foulée — exactement ce
 * qu'un humain rapide ferait aussi. `evenement.preventDefault()` suivi d'une
 * lecture IndexedDB (async) avant un `requestSubmit()` ouvrait une fenêtre où
 * DEUX navigations partaient en même temps (celle du test, celle que ce
 * composant relançait un instant plus tard) : Chromium abandonne alors l'une
 * des deux, `net::ERR_ABORTED`.* La file et l'identité sont donc tenues à
 * jour en PERMANENCE par un effet séparé (au montage, et à chaque
 * `EVENEMENT_FILE_MODIFIEE`) ; l'écouteur `submit` ne fait qu'une LECTURE
 * D'ÉTAT déjà en mémoire (`etatRef`) — synchrone, sans détour par IndexedDB
 * au moment du clic, DÈS QUE cette première lecture a eu le temps d'arriver.
 *
 * ## LA FENÊTRE ENTRE LE MONTAGE ET CETTE PREMIÈRE LECTURE (9F4H4C)
 *
 * *Mesuré : `tests/e2e/offline/9f4h3a-file-sans-perte.spec.ts`, « captures
 * (point 7) », rouge puis flaky — un clic sur « Déconnexion » qui arrive
 * avant que le premier `lireCopie()`/`compterEnAttente()` du montage ait
 * résolu trouve `pretRef.current` à `false` : `etatRef` ne vaut alors rien
 * (ni « lu, vide » ni « lu, non vide »), et la question de D115-3 ne peut pas
 * être tranchée. La sauter serait perdre une confirmation due ; attendre
 * INCONDITIONNELLEMENT rouvrirait l'ERR_ABORTED ci-dessus pour CHAQUE clic.
 * La fenêtre est donc fermée par le seul cas qui la pose : `pretRef`
 * distingue « pas encore lu » de « lu et vide », et SEUL ce premier cas
 * attend `premiereLecturePromesseRef` avant de trancher — rejouant alors la
 * marque déjà posée (`requestSubmit`) si la file est vide, ou la question si
 * elle ne l'est pas. Une fois la première lecture arrivée (le cas commun,
 * déjà résolu avant le clic dans toutes les épreuves mesurées), le chemin
 * reste exactement celui d'avant : synchrone, sans attente.
 */
export function EffacementCopieADeconnexion() {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const etatRef = useRef<{
    readonly identite: Identite | null;
    readonly n: number;
  }>({ identite: null, n: 0 });
  const pretRef = useRef(false);
  const premiereLecturePromesseRef = useRef<Promise<void> | null>(null);

  const rafraichirEtat = useCallback((): Promise<void> => {
    return lireCopie().then((copie) => {
      if (copie === null) {
        // SANS INSTANTANÉ (9F4H4C) — l'identité de la file reste inconnue,
        // mais elle peut quand même contenir des saisies sur CET appareil
        // (voir le docblock du composant) : les compter plutôt que de
        // supposer la file vide.
        return compterEnAttenteToutesIdentites().then((n) => {
          etatRef.current = { identite: null, n };
          pretRef.current = true;
        });
      }
      const identite = {
        utilisateurId: copie.utilisateurId,
        societeId: copie.societeId,
      };
      return compterEnAttente(identite).then((n) => {
        etatRef.current = { identite, n };
        pretRef.current = true;
      });
    });
  }, []);

  useEffect(() => {
    premiereLecturePromesseRef.current = rafraichirEtat();
    function surModification(): void {
      void rafraichirEtat();
    }
    window.addEventListener(EVENEMENT_FILE_MODIFIEE, surModification);
    return () =>
      window.removeEventListener(EVENEMENT_FILE_MODIFIEE, surModification);
  }, [rafraichirEtat]);

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
      if (!pretRef.current) {
        // PAS ENCORE LU (voir docblock ci-dessus) — on bloque CE `submit`, on
        // attend la PREMIÈRE lecture, puis on rejoue la décision avec la
        // marque déjà en place pour ne jamais redemander.
        evenement.preventDefault();
        void (premiereLecturePromesseRef.current ?? Promise.resolve()).then(
          () => {
            const { identite, n } = etatRef.current;
            if (n === 0) {
              void effacerCopie();
              formulaire.dataset[MARQUE_CONFIRME] = "1";
              formulaire.requestSubmit();
              return;
            }
            setConfirmation({ formulaire, identite, n });
          },
        );
        return;
      }
      const { identite, n } = etatRef.current;
      if (n === 0) {
        // COMPORTEMENT D'AVANT CE LOT, À L'IDENTIQUE — rien ne retarde ni
        // n'intercepte la déconnexion.
        void effacerCopie();
        return;
      }
      evenement.preventDefault();
      setConfirmation({ formulaire, identite, n });
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
    const identite = confirmationActuelle.identite;
    if (identite === null || !navigator.onLine) {
      return;
    }
    await envoyerFile(identite);
    const n = await compterEnAttente(identite);
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
      {confirmation.identite === null ? null : navigator.onLine ? (
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
