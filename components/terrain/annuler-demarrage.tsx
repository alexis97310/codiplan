"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import {
  decalageHorloge,
  instantAppareil,
  secondesEcoulees,
} from "@/lib/terrain/compteur-vivant";
import {
  ajouterSaisie,
  EVENEMENT_FILE_MODIFIEE,
  listerFilePourIntervention,
  nouvelleOperation,
  retirerSaisie,
} from "@/lib/terrain/file-saisies";

/** Dix secondes — le même nombre que le serveur juge (9L36, D282). La marge
 * réseau du serveur n'est PAS reproduite ici : un compte à rebours qui irait
 * jusqu'à treize mentirait sur ce que « dix secondes » promet à l'écran. */
const DIX_SECONDES = 10;

/**
 * « ANNULER LE DÉMARRAGE », PENDANT DIX SECONDES (9L36-ANNULER-DEMARRAGE-
 * 10S, décision d'Alexis du 23/11/2026, point 8 ; D282).
 *
 * UN SEUL COMPOSANT POUR LES DEUX CAS, jamais deux : un démarrage ENCORE en
 * file (coupure en cours, ou avant que « Envoyer » n'ait réussi) s'annule en
 * la retirant — `retirerSaisie`, AUCUN appel réseau, même régime que
 * `GesteSuppressionPhoto` sur une photo pas encore partie. Un démarrage déjà
 * CONFIRMÉ par le serveur (`segmentDebutServeur`) pose le geste `annuler_
 * demarrage`, envoyé comme tout autre geste du compteur — et REPART EN FILE
 * s'il échoue à partir, pour que le serveur juge au moment de le recevoir.
 *
 * Le compte à rebours est purement informatif : c'est le SERVEUR qui referme
 * la fenêtre, avec sa propre marge réseau (`peutAnnulerLeDemarrage`,
 * `lib/interventions/compteur.ts`) — ce composant ne fait jamais confiance à
 * sa propre horloge pour refuser, seulement pour savoir quand se taire.
 */
export function BoutonAnnulerDemarrage({
  interventionId,
  utilisateurId,
  societeId,
  segmentDebutServeur,
  instantServeur,
}: {
  readonly interventionId: string;
  readonly utilisateurId: string;
  readonly societeId: string;
  /** Le départ du segment ouvert, VU DU SERVEUR — `null` si rien ne tourne
   * ici (serveur), même si un démarrage local est encore en file. */
  readonly segmentDebutServeur: Date | null;
  /** L'heure lue côté SERVEUR au rendu de la fiche — sert à corriger
   * `segmentDebutServeur` de l'horloge de CET appareil, jamais `instantLocal`
   * (déjà celle de l'appareil, rien à corriger). */
  readonly instantServeur: Date | null;
}) {
  const router = useRouter();
  const [decalageMs] = useState(() =>
    decalageHorloge(instantServeur, instantAppareil()),
  );
  const [entreeLocale, setEntreeLocale] = useState<{
    readonly id: string;
    readonly instantAppareil: string;
  } | null>(null);
  const [enEnvoi, setEnEnvoi] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [secondesRestantes, setSecondesRestantes] = useState(DIX_SECONDES);

  useEffect(() => {
    function relire(): void {
      void listerFilePourIntervention(interventionId, {
        utilisateurId,
        societeId,
      }).then((entrees) => {
        const derniere = entrees
          .filter(
            (e): e is typeof e & { geste: { type: "compteur" } } =>
              e.geste.type === "compteur",
          )
          .at(-1);
        setEntreeLocale(
          derniere !== undefined && derniere.geste.action === "demarrer"
            ? { id: derniere.id, instantAppareil: derniere.instantAppareil }
            : null,
        );
      });
    }
    relire();
    window.addEventListener(EVENEMENT_FILE_MODIFIEE, relire);
    return () => window.removeEventListener(EVENEMENT_FILE_MODIFIEE, relire);
  }, [interventionId, utilisateurId, societeId]);

  // LA SAISIE LOCALE L'EMPORTE, même doctrine que `BoutonCompteurTerrain` :
  // un démarrage encore en file est celui qu'on annule, jamais celui — ou
  // l'absence — que le serveur affirmait au dernier rendu.
  // `debutMs`, UN NOMBRE, JAMAIS L'OBJET `Date` LUI-MÊME, EN DÉPENDANCE
  // (react-hooks/exhaustive-deps) — `new Date(...)` change d'identité à
  // chaque rendu même quand la valeur ne change pas, ce qui relancerait
  // l'intervalle à chaque seconde au lieu d'une fois par départ réel.
  const debutMs =
    entreeLocale !== null
      ? new Date(entreeLocale.instantAppareil).getTime()
      : (segmentDebutServeur?.getTime() ?? null);
  // Décalage appliqué seulement au départ SERVEUR : `instantLocal` est déjà
  // l'heure de cet appareil (voir le docblock de `secondesEcoulees`).
  const decalageAppliqueMs = entreeLocale !== null ? 0 : decalageMs;

  useEffect(() => {
    if (debutMs === null) {
      return;
    }
    const depart = new Date(debutMs);
    function tic(): void {
      const ecoule = secondesEcoulees({
        depart,
        minutesFermees: 0,
        decalageHorlogeMs: decalageAppliqueMs,
        maintenant: instantAppareil(),
      });
      setSecondesRestantes(Math.max(0, Math.ceil(DIX_SECONDES - ecoule)));
    }
    tic();
    const identifiant = setInterval(tic, 1000);
    return () => clearInterval(identifiant);
  }, [debutMs, decalageAppliqueMs]);

  if (debutMs === null || secondesRestantes <= 0) {
    return null;
  }

  async function onClick(): Promise<void> {
    setEnEnvoi(true);
    setRefus(null);
    // FABRIQUÉ AVANT L'ENVOI, UNE SEULE FOIS (même doctrine que `compteur-
    // terrain.tsx`, L0-08) — réutilisé par la file si la requête échoue à
    // partir, jamais une seconde lecture de l'horloge dans le `catch`.
    const operation = nouvelleOperation();
    try {
      // DÉMARRAGE ENCORE EN FILE : AUCUN APPEL RÉSEAU (voir le docblock).
      if (entreeLocale !== null) {
        await retirerSaisie(entreeLocale.id);
        return;
      }
      const corps = new FormData();
      corps.set("geste", "annuler_demarrage");
      corps.set("operation_id", operation.id);
      corps.set("instant_appareil", operation.instantAppareil);
      const reponseServeur = await fetch(
        `/api/terrain/${interventionId}/compteur`,
        {
          method: "POST",
          body: corps,
          headers: { Accept: "application/json" },
        },
      );
      const resultat = (await reponseServeur.json()) as {
        readonly ok: boolean;
        readonly motif: string | null;
      };
      if (resultat.ok) {
        router.refresh();
        return;
      }
      setRefus(resultat.motif);
    } catch {
      // LA COUPURE : le geste repart en file, le serveur jugera à sa
      // réception (point 3 du ticket) — même régime que `demarrer`/`arreter`.
      await ajouterSaisie({
        interventionId,
        utilisateurId,
        societeId,
        geste: { type: "compteur", action: "annuler_demarrage" },
        id: operation.id,
        instantAppareil: operation.instantAppareil,
      });
    } finally {
      setEnEnvoi(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-11 w-full text-16"
        disabled={enEnvoi}
        onClick={() => void onClick()}
      >
        {t("terrain.compteur.annuler_demarrage.bouton")} {secondesRestantes}{" "}
        {t("terrain.compteur.annuler_demarrage.secondes")}
      </Button>
      {refus === null ? null : (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3 py-2 text-16 font-bold"
        >
          {estCleTraduction(refus) ? t(refus) : refus}
        </p>
      )}
    </div>
  );
}
