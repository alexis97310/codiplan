"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialogue } from "@/components/ui/dialogue";
import { dateCivile } from "@/lib/calendar/fuseau";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import type { StatutIntervention } from "@/lib/interventions/saisie";
import {
  ajouterSaisie,
  EVENEMENT_FILE_MODIFIEE,
  listerFilePourIntervention,
  nouvelleOperation,
} from "@/lib/terrain/file-saisies";

const CLASSES_CHAMP =
  "border-input bg-background w-full min-w-0 rounded-md border px-3 py-2 font-normal";

/**
 * « J'ATTENDS UNE PIÈCE » (9K13-TERRAIN-ATTENTE-PIECE, décision d'Alexis du
 * 09/11/2026) — référence et date de disponibilité, TOUJOURS ENSEMBLE
 * (RG-INT-06) : ce geste ne porte qu'un seul sens, jamais une suspension
 * générale sans pièce (celle-là reste au bureau, `DialogueSuspendre`).
 *
 * **Capable de file, comme `BoutonCompteurTerrain`** — hors réseau (ou dans
 * la coquille `/terrain-hors-reseau`, `sansSession`), le geste est gardé sur
 * l'appareil plutôt que refusé, et repart avec « Envoyer ».
 *
 * **LE MOTIF N'EST JAMAIS SAISI ICI** — un texte fixe
 * (`terrain.suspendre.motif_auto`) remplit la colonne que RG-INT-06 exige
 * toujours, sans demander au technicien de retaper ce que le bouton dit
 * déjà.
 *
 * **TROIS ÉTATS, JAMAIS DEUX** — déjà suspendue (la pièce attendue
 * s'affiche, en lecture), en file (un envoi attend déjà le réseau), ou le
 * bouton. Statut différent de `en_cours` et non suspendue : rien ne
 * s'affiche, comme `peutSuspendre` (D160) l'exige déjà côté serveur.
 */
export function BoutonSuspendreTerrain({
  interventionId,
  utilisateurId,
  societeId,
  statut,
  motifSuspension,
  pieceAttendueRef,
  dateDispoPrevue,
  sansSession = false,
}: {
  readonly interventionId: string;
  readonly utilisateurId: string;
  readonly societeId: string;
  readonly statut: StatutIntervention;
  readonly motifSuspension: string | null;
  readonly pieceAttendueRef: string | null;
  readonly dateDispoPrevue: string | null;
  readonly sansSession?: boolean;
}) {
  const router = useRouter();
  const [enFile, setEnFile] = useState(false);
  const [enEnvoi, setEnEnvoi] = useState(false);
  const [echecGarde, setEchecGarde] = useState(false);
  const [refusServeur, setRefusServeur] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [date, setDate] = useState("");

  // RELU AU MONTAGE ET À CHAQUE MODIFICATION DE LA FILE (même patron que
  // `BoutonCompteurTerrain`) — `BoutonEnvoyer` peut vider la file par un
  // envoi réussi, sans que ce bouton le sache autrement.
  useEffect(() => {
    function relire(): void {
      void listerFilePourIntervention(interventionId, {
        utilisateurId,
        societeId,
      }).then((entrees) => {
        setEnFile(entrees.some((e) => e.geste.type === "suspendre"));
      });
    }
    relire();
    window.addEventListener(EVENEMENT_FILE_MODIFIEE, relire);
    return () => window.removeEventListener(EVENEMENT_FILE_MODIFIEE, relire);
  }, [interventionId, utilisateurId, societeId]);

  if (statut === "suspendue") {
    return (
      <p className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3 py-2 text-16 font-bold">
        {t("intervention.suspension.piece")}
        {t("ponctuation.deux_points")}{" "}
        {pieceAttendueRef ?? motifSuspension ?? t("terrain.inconnu")}
        {dateDispoPrevue === null ? null : (
          <>
            {t("ponctuation.separateur")}
            {t("intervention.suspension.date_dispo")}
            {t("ponctuation.deux_points")}{" "}
            {dateCivile(new Date(dateDispoPrevue))}
          </>
        )}
      </p>
    );
  }

  if (statut !== "en_cours") {
    return null;
  }

  if (enFile) {
    return (
      <p className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3 py-2 text-16 font-bold">
        {t("terrain.file.en_attente_envoi")}
      </p>
    );
  }

  async function garderEnFile(
    motif: string,
    ref: string,
    dateChoisie: string,
  ): Promise<boolean> {
    const operation = nouvelleOperation();
    const resultat = await ajouterSaisie({
      interventionId,
      utilisateurId,
      societeId,
      geste: {
        type: "suspendre",
        motif,
        pieceAttendueRef: ref,
        dateDispoPrevue: dateChoisie,
      },
      id: operation.id,
      instantAppareil: operation.instantAppareil,
    });
    return resultat.gardee;
  }

  async function onConfirmer(fermer: () => void): Promise<void> {
    const ref = reference.trim();
    const dateChoisie = date.trim();
    if (ref.length === 0 || dateChoisie.length === 0) {
      return;
    }
    setEnEnvoi(true);
    setEchecGarde(false);
    setRefusServeur(null);
    const motif = t("terrain.suspendre.motif_auto");

    async function repli(): Promise<void> {
      const gardee = await garderEnFile(motif, ref, dateChoisie);
      setEnEnvoi(false);
      if (!gardee) {
        setEchecGarde(true);
        return;
      }
      setEnFile(true);
      fermer();
    }

    if (!navigator.onLine || sansSession) {
      await repli();
      return;
    }
    try {
      const corps = new FormData();
      corps.set("motif", motif);
      corps.set("piece_attendue_ref", ref);
      corps.set("date_dispo_prevue", dateChoisie);
      const reponseServeur = await fetch(
        `/api/terrain/${interventionId}/suspendre`,
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
        setEnEnvoi(false);
        fermer();
        router.refresh();
        return;
      }
      // DANS LA COQUILLE SEULEMENT (même garde que `BoutonCompteurTerrain`)
      // — aucune session n'y existe jamais, un refus d'authentification n'y
      // dit rien de plus qu'une coupure réseau.
      if (sansSession && resultat.motif === "auth.refus") {
        await repli();
        return;
      }
      setEnEnvoi(false);
      setRefusServeur(resultat.motif);
    } catch {
      await repli();
    }
  }

  return (
    <Dialogue
      declencheur={(ouvrir) => (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full text-16"
          onClick={ouvrir}
        >
          {t("terrain.suspendre.bouton")}
        </Button>
      )}
      titre={t("terrain.suspendre.bouton")}
      enfants={() => (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("intervention.suspension.piece")}
            <input
              className={CLASSES_CHAMP}
              value={reference}
              maxLength={120}
              onChange={(evenement) => setReference(evenement.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("intervention.suspension.date_dispo")}
            <input
              type="date"
              className={CLASSES_CHAMP}
              value={date}
              onChange={(evenement) => setDate(evenement.target.value)}
            />
          </label>
          <p className="text-app-encre-faible text-12 font-bold">
            {t("terrain.suspendre.aide")}
          </p>
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
        </div>
      )}
      pied={(fermer) => (
        <>
          <Button type="button" variant="outline" size="sm" onClick={fermer}>
            {t("ui.dialogue.fermer")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={
              enEnvoi ||
              reference.trim().length === 0 ||
              date.trim().length === 0
            }
            onClick={() => void onConfirmer(fermer)}
          >
            {t("terrain.suspendre.enregistrer")}
          </Button>
        </>
      )}
    />
  );
}
