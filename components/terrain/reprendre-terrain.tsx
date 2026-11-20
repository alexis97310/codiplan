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

import { DeclencheurBarreAction } from "./barre-action-terrain";

/**
 * « REPRENDRE » (9L08C-TERRAIN-REPRENDRE-SUSPENSION, décision d'Alexis du
 * 16/11/2026, option 2) — le technicien affecté reprend lui-même, depuis la
 * fiche terrain, une intervention qu'il a suspendue. Même patron que
 * `BoutonSuspendreTerrain` : capable de file hors réseau (ou dans la
 * coquille `/terrain-hors-reseau`, `sansSession`), un seul geste, un refus
 * serveur affiché à la place du bouton plutôt qu'un bouton qu'il suffirait
 * d'insister.
 *
 * **AUCUNE SAISIE** — la confirmation ne fait que RAPPELER le motif de la
 * suspension en cours (et, pour « J'attends une pièce », la référence et la
 * date) ; `peutReprendre` rend le statut que le créneau dicte (L2-10), rien
 * que ce geste n'a à nommer lui-même.
 *
 * Ne se rend QUE sur une intervention `suspendue` — un autre statut n'a rien
 * à reprendre (voir `peutReprendre`, D160) : le bouton « Suspendre »
 * (`BoutonSuspendreTerrain`) et celui-ci ne se recouvrent jamais.
 */
export function BoutonReprendreTerrain({
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

  // RELU AU MONTAGE ET À CHAQUE MODIFICATION DE LA FILE — même patron que
  // `BoutonSuspendreTerrain` : `BoutonEnvoyer` peut vider la file par un
  // envoi réussi, sans que ce bouton le sache autrement.
  useEffect(() => {
    function relire(): void {
      void listerFilePourIntervention(interventionId, {
        utilisateurId,
        societeId,
      }).then((entrees) => {
        setEnFile(entrees.some((e) => e.geste.type === "reprendre"));
      });
    }
    relire();
    window.addEventListener(EVENEMENT_FILE_MODIFIEE, relire);
    return () => window.removeEventListener(EVENEMENT_FILE_MODIFIEE, relire);
  }, [interventionId, utilisateurId, societeId]);

  if (statut !== "suspendue") {
    return null;
  }

  // UN MESSAGE, JAMAIS UN BOUTON DANS LA BARRE (voir le docblock de
  // `BarreActionTerrain` : elle ne porte que des boutons) — tant que cette
  // entrée attend le réseau, aucun second clic ne doit la doubler.
  if (enFile) {
    return (
      <p className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3 py-2 text-16 font-bold">
        {t("terrain.file.en_attente_envoi")}
      </p>
    );
  }

  async function garderEnFile(): Promise<boolean> {
    const operation = nouvelleOperation();
    const resultat = await ajouterSaisie({
      interventionId,
      utilisateurId,
      societeId,
      geste: { type: "reprendre" },
      id: operation.id,
      instantAppareil: operation.instantAppareil,
    });
    return resultat.gardee;
  }

  async function onConfirmer(fermer: () => void): Promise<void> {
    setEnEnvoi(true);
    setEchecGarde(false);
    setRefusServeur(null);

    async function repli(): Promise<void> {
      const gardee = await garderEnFile();
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
      const reponseServeur = await fetch(
        `/api/terrain/${interventionId}/reprendre`,
        {
          method: "POST",
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
      // DANS LA COQUILLE SEULEMENT (même garde que `BoutonSuspendreTerrain`)
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
        <DeclencheurBarreAction>
          <Button
            type="button"
            size="lg"
            className="h-14 w-full text-16"
            onClick={ouvrir}
          >
            {t("terrain.reprendre.bouton")}
          </Button>
        </DeclencheurBarreAction>
      )}
      titre={t("terrain.reprendre.titre")}
      enfants={() => (
        <div className="flex flex-col gap-3">
          <p className="text-16 font-medium">
            {t("intervention.suspension.piece")}
            {t("ponctuation.deux_points")}{" "}
            {pieceAttendueRef ?? motifSuspension ?? t("terrain.inconnu")}
          </p>
          {dateDispoPrevue === null ? null : (
            <p className="text-16 font-medium">
              {t("intervention.suspension.date_dispo")}
              {t("ponctuation.deux_points")}{" "}
              {dateCivile(new Date(dateDispoPrevue))}
            </p>
          )}
          <p className="text-app-encre-faible text-12 font-bold">
            {t("terrain.reprendre.aide")}
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
            disabled={enEnvoi}
            onClick={() => void onConfirmer(fermer)}
          >
            {t("terrain.reprendre.confirmer")}
          </Button>
        </>
      )}
    />
  );
}
