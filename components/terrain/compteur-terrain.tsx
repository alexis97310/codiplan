"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { type Fuseau } from "@/lib/calendar/fuseau";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import type { StatutIntervention } from "@/lib/interventions/saisie";
import {
  demarrerActiviteTerrain,
  terminerActiviteTerrain,
} from "@/lib/terrain/activite-saisie";
import {
  decalageHorloge,
  instantAppareil,
} from "@/lib/terrain/compteur-vivant";
import {
  ajouterSaisie,
  EVENEMENT_FILE_MODIFIEE,
  listerFilePourIntervention,
  nouvelleOperation,
  signalerCompteurDemarreEnLigne,
} from "@/lib/terrain/file-saisies";
import { instantAppareilCale } from "@/lib/terrain/heure-calee";

import { CompteurVivant } from "./compteur-vivant";
import { heureLocale } from "./presentation";

/**
 * UNE FONCTION, JAMAIS UN `const` AU TEXTE CALCULÉ PAR TERNAIRE — même piège
 * que documenté en tête de `rapport-automatique.tsx` (gardien L0-11) : un
 * `t("...")` niché dans une ternaire affectée à un `const` s'y résout avec un
 * contexte vide, et la CLÉ elle-même serait signalée comme une chaîne écrite
 * en dur plutôt que reconnue comme un accès au dictionnaire.
 */
function libelleDuBouton(
  iciEffectif: boolean,
  actionLocale: "demarrer" | "arreter" | null,
  enPause: boolean,
): string {
  if (iciEffectif) {
    return t("terrain.compteur.pause");
  }
  if (actionLocale === null && enPause) {
    return t("terrain.compteur.reprendre");
  }
  return t("terrain.compteur.demarrer");
}

/**
 * LE BOUTON DU COMPTEUR, CAPABLE DE FILE (9F4H3-HORS-RESEAU-ENVOYER, point 1)
 * — REMPLACE le `<form action=… method="post">` posé par le ticket R5-02
 * (D119), qui ne survivait pas à une coupure réseau : un formulaire natif
 * hors ligne échoue dans le navigateur, sans que rien ne garde le geste.
 *
 * ## LA DERNIÈRE SAISIE LOCALE L'EMPORTE SUR `ici` DU SERVEUR
 *
 * `ici`/`enPause` sont la vérité SERVEUR au moment du rendu. Si une saisie
 * « démarrer »/« arrêter » est déjà en file pour cette intervention (coupure
 * en cours, ou rechargement avant que « Envoyer » n'ait réussi), c'est ELLE
 * qui décide du prochain geste et du libellé — sinon un second clic
 * proposerait encore « Démarrer » après un démarrage déjà mis en file.
 *
 * ## L'HEURE ENVOYÉE AU SERVEUR, CALÉE SUR LA SIENNE (9F4H5A-HEURE-CALEE-
 * SERVEUR, D132) — `instantServeur` (l'heure lue côté serveur au rendu de la
 * fiche, DÉJÀ passée au compteur vivant par la page — voir `lib/terrain/
 * compteur-vivant.ts`) sert à mesurer, UNE SEULE FOIS au montage, l'écart
 * entre elle et l'horloge de CET appareil (`decalageHorloge`). Chaque essai
 * — « Mettre en pause » comme « Démarrer » — corrige alors l'heure qu'il
 * envoie par cet écart s'il dépasse une minute (`instantAppareilCale`),
 * AVANT le tout premier essai, pour que la file (coupure en cours) renvoie
 * EXACTEMENT la même valeur, jamais une seconde lecture de l'horloge (voir
 * le docblock de `nouvelleOperation`, et celui d'`arreterLeCompteur` sur le
 * rejeu par l'instant exact). Le serveur, lui, n'est pas touché : les
 * bornes de `verifierInstantAppareil` (D115-1, 9F4H4D) restent exactement
 * les mêmes.
 */
export function BoutonCompteurTerrain({
  interventionId,
  utilisateurId,
  societeId,
  statut,
  ici,
  enPause,
  fuseau,
  instantServeur = null,
  sansSession = false,
}: {
  readonly interventionId: string;
  readonly utilisateurId: string;
  readonly societeId: string;
  /** Le statut SERVEUR au moment du rendu — sert uniquement à savoir si ce
   * « Démarrer » ROUVRE une intervention déjà « Terminée » (D220, décision
   * d'Alexis du 21/10/2026) : la question ne se pose que dans ce cas. */
  readonly statut: StatutIntervention;
  readonly ici: boolean;
  readonly enPause: boolean;
  readonly fuseau: Fuseau;
  /** L'heure lue côté SERVEUR au rendu de la fiche — `null` dans la
   * coquille `/terrain-hors-reseau` (`sansSession`), où aucune session, et
   * donc aucune heure serveur, n'existe jamais : le décalage y reste nul,
   * et l'heure envoyée est celle du téléphone, inchangée. */
  readonly instantServeur?: Date | null;
  /** LA COQUILLE `/terrain-hors-reseau` (9F4H4D, point 2) — aucune session
   * n'y existe jamais : un refus serveur `"auth.refus"` (D-12,
   * `lib/auth/porte.ts`) n'y dit alors rien de plus qu'une coupure réseau, et
   * le geste part dans la MÊME file, sous la MÊME identité (l'instantané),
   * plutôt que d'afficher un refus que « Vos saisies sont gardées… »
   * (`consultation-hors-reseau.tsx`) contredirait. Ailleurs — `/terrain/[id]`,
   * une session RÉELLE —, ce même motif reste un refus affiché : une session
   * qui expire en cours de visite n'est pas une coupure réseau. */
  readonly sansSession?: boolean;
}) {
  const router = useRouter();
  // MESURÉ UNE SEULE FOIS, AU MONTAGE (voir le docblock ci-dessus) — jamais
  // recalculé à chaque essai : un décalage qui bougerait entre le premier
  // essai et un renvoi par la file ferait varier la valeur envoyée, et
  // casserait le rejeu par l'instant exact d'`arreterLeCompteur`.
  const [decalageMs] = useState(() =>
    decalageHorloge(instantServeur, instantAppareil()),
  );
  const [actionLocale, setActionLocale] = useState<
    "demarrer" | "arreter" | null
  >(null);
  const [instantLocal, setInstantLocal] = useState<string | null>(null);
  const [enEnvoi, setEnEnvoi] = useState(false);
  // JAMAIS « GARDÉ » SANS PREUVE (point 2, 9F4H3A) — posé quand `ajouterSaisie`
  // échoue réellement à écrire dans IndexedDB : le geste n'a alors nulle
  // part où attendre, et l'écran ne doit pas laisser croire le contraire.
  const [echecGarde, setEchecGarde] = useState(false);
  // UN REFUS SERVEUR EN LIGNE, EN CLAIR (point 5, C6) — jusqu'ici ce
  // composant ne montrait RIEN quand le serveur répondait `ok:false` (ex. un
  // compteur déjà ouvert ailleurs, détecté entre le rendu et le clic) : le
  // bouton se réactivait, sans que le technicien sache pourquoi rien n'avait
  // changé.
  const [refusServeur, setRefusServeur] = useState<string | null>(null);
  // LA QUESTION AVANT DE ROUVRIR (D220, décision d'Alexis du 21/10/2026) —
  // même patron inline que la confirmation de « Terminer »
  // (`rapport-automatique.tsx`) : un geste d'écran de plus, jamais un second
  // aller-retour réseau.
  const [confirmationReouvertureOuverte, setConfirmationReouvertureOuverte] =
    useState(false);

  // RELU AU MONTAGE ET À CHAQUE MODIFICATION DE LA FILE (point 5, C6) —
  // `BoutonEnvoyer`, ailleurs sur la même page, peut vider la file par un
  // envoi réussi ; sans cet écouteur, ce bouton restait figé sur son dernier
  // état local jusqu'à un rechargement complet de la page.
  useEffect(() => {
    function relire(): void {
      void listerFilePourIntervention(interventionId, {
        utilisateurId,
        societeId,
      }).then((entrees) => {
        const compteurs = entrees.filter(
          (e): e is typeof e & { geste: { type: "compteur" } } =>
            e.geste.type === "compteur",
        );
        const derniere = compteurs.at(-1);
        if (derniere === undefined) {
          setActionLocale(null);
          setInstantLocal(null);
          return;
        }
        setActionLocale(derniere.geste.action);
        setInstantLocal(derniere.instantAppareil);
      });
    }
    relire();
    window.addEventListener(EVENEMENT_FILE_MODIFIEE, relire);
    return () => window.removeEventListener(EVENEMENT_FILE_MODIFIEE, relire);
  }, [interventionId, utilisateurId, societeId]);

  const iciEffectif = actionLocale === null ? ici : actionLocale === "demarrer";
  const gesteSuivant: "demarrer" | "arreter" = iciEffectif
    ? "arreter"
    : "demarrer";
  const libelle = libelleDuBouton(iciEffectif, actionLocale, enPause);
  // ROUVRIR, PAS DÉMARRER (D220) — seul le cas « Terminée » pose la
  // question ; une « À planifier »/« Planifiée »/« Affectée » qui démarre
  // pour la première fois n'a rien à rouvrir.
  const reouvertureDuneIntervention =
    gesteSuivant === "demarrer" && statut === "terminee";

  async function onClick(): Promise<void> {
    // JAMAIS DE RAFRAÎCHISSEMENT AUTOMATIQUE PENDANT CET ENVOI (point 2,
    // 9F4H5-TERRAIN-VIVANT) — `RafraichissementAutomatique` lit ce jeton
    // avant de rafraîchir ; la minuterie `finally` ci-dessous le retire
    // quoi qu'il arrive (succès, refus, ou mise en file).
    const jeton = `compteur-${interventionId}`;
    demarrerActiviteTerrain(jeton);
    setEnEnvoi(true);
    setEchecGarde(false);
    setRefusServeur(null);
    // UN IDENTIFIANT DÈS LE PREMIER ESSAI (point 3, C7) — fabriqué AVANT cet
    // envoi, jamais après son échec : en « lie-fi » (la requête aboutit, mais
    // la réponse se perd), le serveur a déjà ouvert/fermé le segment sous CET
    // `operation_id` ; un renvoi par la file qui en fabriquerait un second
    // ne retrouverait pas le même segment, et le second geste serait refusé
    // (« déjà en cours » / « aucun en cours ») sans jamais pouvoir repartir.
    const operation = nouvelleOperation();
    // CALÉE SUR LE SERVEUR AVANT LE TOUT PREMIER ESSAI (9F4H5A, voir le
    // docblock ci-dessus) — `instantAppareilEnvoye` remplace partout
    // `operation.instantAppareil` en aval : le corps POSTÉ, la file en cas
    // de coupure, et l'affichage « hors réseau depuis… ».
    const instantAppareilEnvoye = instantAppareilCale({
      instantAppareil: new Date(operation.instantAppareil),
      decalageHorlogeMs: decalageMs,
    }).toISOString();
    const corps = new FormData();
    corps.set("geste", gesteSuivant);
    corps.set("operation_id", operation.id);
    corps.set("instant_appareil", instantAppareilEnvoye);
    async function garderEnFile(): Promise<void> {
      const resultat = await ajouterSaisie({
        interventionId,
        utilisateurId,
        societeId,
        geste: { type: "compteur", action: gesteSuivant },
        id: operation.id,
        instantAppareil: instantAppareilEnvoye,
      });
      if (resultat.gardee) {
        setActionLocale(gesteSuivant);
        setInstantLocal(instantAppareilEnvoye);
      } else {
        setEchecGarde(true);
      }
    }
    try {
      const reponseServeur = await fetch(
        `/api/terrain/${interventionId}/compteur`,
        {
          method: "POST",
          body: corps,
          headers: { Accept: "application/json" },
        },
      );
      let resultat: { readonly ok: boolean; readonly motif: string | null };
      try {
        resultat = (await reponseServeur.json()) as {
          readonly ok: boolean;
          readonly motif: string | null;
        };
      } catch {
        // UNE RÉPONSE REÇUE, MAIS ILLISIBLE — SEULEMENT SI ELLE VIENT DE
        // L'APPLICATION (point 2, 9H4-FINITIONS-AVANT-AUDIT) — le point 8 de
        // 9G5 traitait TOUTE erreur de lecture comme une page d'erreur 500
        // de CETTE route, donc jamais une coupure. Mais un 502/504 de
        // passerelle (load balancer, proxy) n'est posé par aucune route de
        // cette application, et un corps interrompu en cours de transfert
        // (portail captif, coupure pendant la lecture) n'a pas forcément
        // atteint l'application non plus — avant ce point, les deux
        // partaient dans cette branche, affichant un refus alors que le
        // geste n'avait peut-être jamais été vu du serveur. Seul le statut
        // 500 — celui que CETTE route pose sur une exception non rattrapée —
        // reste reconnu comme une réponse de l'application ; le reste repart
        // en file, comme une coupure réseau.
        if (reponseServeur.status === 500) {
          setRefusServeur("terrain.compteur.reponse_invalide");
          return;
        }
        await garderEnFile();
        return;
      }
      if (resultat.ok) {
        // LE SIGNAL, AVANT `router.refresh()` (D220) — ce dernier reste
        // posé, mais la section « Terminer » (`RapportTerrainAutomatique`)
        // n'attend plus son aller-retour pour savoir que le compteur tourne.
        if (gesteSuivant === "demarrer") {
          signalerCompteurDemarreEnLigne({ interventionId });
        }
        router.refresh();
        return;
      }
      // DANS LA COQUILLE SEULEMENT (point 2, 9F4H4D) — un refus
      // d'authentification (`"auth.refus"`, D-12) n'y est jamais affiché
      // comme un refus : aucune session n'y existe, et c'est exactement le
      // cas qu'une coupure réseau couvre déjà. Voir le docblock de
      // `sansSession`.
      if (sansSession && resultat.motif === "auth.refus") {
        await garderEnFile();
        return;
      }
      // UN REFUS SERVEUR EN LIGNE (point 5, C6) — la requête a abouti, le
      // serveur a tranché non : ce n'est jamais une mise en file (rien n'a
      // échoué à PARTIR), seulement un motif à nommer à la place du silence.
      setRefusServeur(resultat.motif);
    } catch {
      await garderEnFile();
    } finally {
      setEnEnvoi(false);
      terminerActiviteTerrain(jeton);
    }
  }

  return (
    <>
      {confirmationReouvertureOuverte ? (
        <div className="flex flex-col gap-2">
          <p className="text-16 font-bold">
            {t("terrain.compteur.reouverture.titre")}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1 text-16"
              onClick={() => setConfirmationReouvertureOuverte(false)}
            >
              {t("terrain.compteur.reouverture.non")}
            </Button>
            <Button
              type="button"
              size="lg"
              className="flex-1 text-16"
              disabled={enEnvoi}
              onClick={() => {
                setConfirmationReouvertureOuverte(false);
                void onClick();
              }}
            >
              {t("terrain.compteur.reouverture.oui")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          size="lg"
          className="w-full text-16"
          disabled={enEnvoi}
          onClick={() => {
            if (reouvertureDuneIntervention) {
              setConfirmationReouvertureOuverte(true);
              return;
            }
            void onClick();
          }}
        >
          {libelle}
        </Button>
      )}
      {refusServeur === null ? null : (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3 py-2 text-16 font-bold"
        >
          {estCleTraduction(refusServeur) ? t(refusServeur) : refusServeur}
        </p>
      )}
      {echecGarde ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3 py-2 text-16 font-bold"
        >
          {t("terrain.file.echec_gardee")}
        </p>
      ) : null}
      {actionLocale === null || instantLocal === null ? null : (
        <p
          role="status"
          className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3 py-2 text-16 font-bold"
        >
          {actionLocale === "demarrer"
            ? t("terrain.compteur.hors_reseau_depuis")
            : t("terrain.compteur.hors_reseau_arrete")}{" "}
          {heureLocale(new Date(instantLocal), fuseau)}{" "}
          {t("terrain.compteur.heure_appareil")}
          {actionLocale === "demarrer" ? (
            // LE COMPTEUR QUI DÉFILE, HORS RÉSEAU (point 1, 9F4H5-TERRAIN-
            // VIVANT) — le départ est `instantLocal`, l'heure de L'APPAREIL
            // (déjà nommée comme telle ci-dessus) : aucune heure serveur
            // n'existe ici, donc aucun décalage à corriger (voir le docblock
            // de `lib/terrain/compteur-vivant.ts`).
            <>
              {" "}
              <CompteurVivant depart={new Date(instantLocal)} />
            </>
          ) : null}
        </p>
      )}
    </>
  );
}
