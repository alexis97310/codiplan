"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import {
  demarrerActiviteTerrain,
  terminerActiviteTerrain,
} from "@/lib/terrain/activite-saisie";
import {
  compterEnAttente,
  contientSaisiesDuneAutreIdentite,
  EVENEMENT_FILE_MODIFIEE,
  listerFile,
  retirerSaisieRefusee,
} from "@/lib/terrain/file-saisies";
import { envoyerFile } from "@/lib/terrain/envoi-file";

/** Un seul jeton : ce bouton n'existe qu'une fois par page (point 2, 9F4H5-TERRAIN-VIVANT). */
const JETON_ENVOI = "bouton-envoyer";

/** Le texte d'un motif de refus — ou la clé elle-même si le dictionnaire l'ignore. */
function texteDuMotif(motifCle: string | null): string {
  if (motifCle === null) {
    return t("terrain.file.refus_generique");
  }
  return estCleTraduction(motifCle) ? t(motifCle) : motifCle;
}

/** `Envoyer (3)` — composé hors du JSX, où aucun littéral n'est admis (L0-11). */
function libelleEnvoyer(n: number): string {
  return `${t("terrain.file.envoyer")} (${n})`;
}

/** `En attente d'envoi (3)` — même patron que `libelleEnvoyer` (point 5, C6). */
function libelleEnAttente(n: number): string {
  return `${t("terrain.file.en_attente_envoi")} (${n})`;
}

type SaisieRefusee = { readonly id: string; readonly motifCle: string };

/**
 * UNE SAISIE REFUSÉE, AVEC SON RETRAIT (9F4H6C-FILE-ROBUSTESSE, point 4,
 * décision n° 142 d'Alexis) — le motif ne suffit plus seul : le technicien
 * peut désormais retirer CETTE saisie précise, jamais sans confirmation
 * explicite (« Retirer cette saisie ? Elle ne sera pas envoyée. »), jamais
 * par défaut. Un geste d'écran par entrée, propre à elle : deux refus
 * affichés ensemble ne partagent jamais la même confirmation ouverte.
 */
function LigneRefus({
  saisie,
  onRetirer,
  desactive,
}: {
  readonly saisie: SaisieRefusee;
  readonly onRetirer: (id: string, motifCle: string) => void;
  readonly desactive: boolean;
}) {
  const [confirmationOuverte, setConfirmationOuverte] = useState(false);
  return (
    <div
      role="status"
      className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre flex flex-col gap-2 rounded-md border px-3 py-2 text-16 font-bold"
    >
      <p>{texteDuMotif(saisie.motifCle)}</p>
      {confirmationOuverte ? (
        <div className="flex flex-col gap-2">
          <p>{t("terrain.file.retirer_confirmation")}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1 text-16"
              disabled={desactive}
              onClick={() => setConfirmationOuverte(false)}
            >
              {t("terrain.file.retirer_revenir")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="lg"
              className="flex-1 text-16"
              disabled={desactive}
              onClick={() => {
                setConfirmationOuverte(false);
                onRetirer(saisie.id, saisie.motifCle);
              }}
            >
              {t("terrain.file.retirer_confirmer")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full text-16"
          disabled={desactive}
          onClick={() => setConfirmationOuverte(true)}
        >
          {t("terrain.file.retirer_bouton")}
        </Button>
      )}
    </div>
  );
}

/**
 * LES REFUS, EN CLAIR (point 2 : « au premier refus, l'envoi de CETTE
 * intervention s'arrête, la saisie refusée reste dans la file avec le motif
 * affiché en clair »).
 *
 * **`desactive` (BAS, 9F4H6D-PRESTATIONS-SANS-PERTE, point 5)** — vrai
 * PENDANT un envoi (`enEnvoi`) : un « Retirer » confirmé alors que
 * `envoyerFile` rejoue CETTE MÊME entrée en arrière-plan courrait après un
 * état qui vient de changer sous lui. Désactivé, jamais caché — le motif
 * reste lisible pendant l'envoi.
 */
function RefusEnClair({
  refus,
  onRetirer,
  desactive,
}: {
  readonly refus: readonly SaisieRefusee[];
  readonly onRetirer: (id: string, motifCle: string) => void;
  readonly desactive: boolean;
}) {
  if (refus.length === 0) {
    return null;
  }
  return (
    <>
      {refus.map((saisie) => (
        <LigneRefus
          key={saisie.id}
          saisie={saisie}
          onRetirer={onRetirer}
          desactive={desactive}
        />
      ))}
    </>
  );
}

/** Addendum 3 du pilote, point 5 (C3) — voir `autreIdentite` plus bas. */
function AutreIdentite({ visible }: { readonly visible: boolean }) {
  if (!visible) {
    return null;
  }
  return (
    <p
      role="status"
      className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3 py-2 text-16 font-bold"
    >
      {t("terrain.file.autre_identite")}
    </p>
  );
}

/**
 * LE BOUTON « ENVOYER » (9F4H3-HORS-RESEAU-ENVOYER, point 2 ; décision n° 105
 * d'Alexis : PAS D'ENVOI AUTOMATIQUE) — posé sur « Ma journée » ET sur
 * chaque fiche (même composant pour les deux, §9 du 01/09 : un même fait
 * affiché par deux rendus diverge en silence). Il envoie TOUTE la file de
 * cette identité, jamais seulement celle de l'intervention où il est posé —
 * une fiche peut ainsi faire partir une saisie restée en attente sur une
 * AUTRE intervention.
 */
export function BoutonEnvoyer({
  utilisateurId,
  societeId,
}: {
  readonly utilisateurId: string;
  readonly societeId: string;
}) {
  const router = useRouter();
  const [enAttente, setEnAttente] = useState(0);
  const [enLigne, setEnLigne] = useState(true);
  const [enEnvoi, setEnEnvoi] = useState(false);
  const [toutEnvoye, setToutEnvoye] = useState(false);
  const [refus, setRefus] = useState<readonly SaisieRefusee[]>([]);
  // DES SAISIES D'UNE AUTRE IDENTITÉ, SUR CET APPAREIL (addendum 3 du
  // pilote, point 5, C3) — jamais envoyées sous la session courante ; la
  // clé existe depuis 9F4H3 mais n'était référencée nulle part.
  const [autreIdentite, setAutreIdentite] = useState(false);

  const rafraichirCompte = useCallback(() => {
    void compterEnAttente({ utilisateurId, societeId }).then(setEnAttente);
  }, [utilisateurId, societeId]);

  const rafraichirAutreIdentite = useCallback(() => {
    void contientSaisiesDuneAutreIdentite({ utilisateurId, societeId }).then(
      setAutreIdentite,
    );
  }, [utilisateurId, societeId]);

  // LES REFUS, EN CLAIR (point 2 : « au premier refus, l'envoi de CETTE
  // intervention s'arrête, la saisie refusée reste dans la file avec le
  // motif affiché en clair ») — une entrée par intervention refusée, celle
  // où `envoyerFile` s'est arrêtée.
  const rafraichirRefus = useCallback(() => {
    void listerFile({ utilisateurId, societeId }).then((entrees) => {
      setRefus(
        entrees
          .filter((e) => e.motifRefus !== null)
          .map((e) => ({ id: e.id, motifCle: e.motifRefus as string })),
      );
    });
  }, [utilisateurId, societeId]);

  /**
   * LE RETRAIT EXPLICITE (point 4, décision n° 142) — après confirmation
   * SEULEMENT (`LigneRefus`). Rafraîchit aussi le compte en attente : une
   * saisie refusée retirée quitte la file, `compterEnAttente` doit le
   * refléter immédiatement, pas seulement au prochain « Envoyer ».
   */
  const retirerCetteSaisie = useCallback(
    (id: string, motifCle: string) => {
      void retirerSaisieRefusee(id, motifCle).then(() => {
        rafraichirRefus();
        rafraichirCompte();
      });
    },
    [rafraichirRefus, rafraichirCompte],
  );

  useEffect(() => {
    setEnLigne(navigator.onLine);
    rafraichirCompte();
    rafraichirRefus();
    rafraichirAutreIdentite();
    const surLigne = () => setEnLigne(true);
    const surHorsLigne = () => setEnLigne(false);
    function surFileModifiee(): void {
      rafraichirCompte();
      rafraichirRefus();
      rafraichirAutreIdentite();
    }
    window.addEventListener("online", surLigne);
    window.addEventListener("offline", surHorsLigne);
    window.addEventListener(EVENEMENT_FILE_MODIFIEE, surFileModifiee);
    return () => {
      window.removeEventListener("online", surLigne);
      window.removeEventListener("offline", surHorsLigne);
      window.removeEventListener(EVENEMENT_FILE_MODIFIEE, surFileModifiee);
    };
  }, [rafraichirCompte, rafraichirRefus, rafraichirAutreIdentite]);

  async function onClick(): Promise<void> {
    demarrerActiviteTerrain(JETON_ENVOI);
    setEnEnvoi(true);
    setToutEnvoye(false);
    try {
      await envoyerFile({ utilisateurId, societeId }, rafraichirCompte);
      const reste = await compterEnAttente({ utilisateurId, societeId });
      setEnAttente(reste);
      rafraichirRefus();
      setEnEnvoi(false);
      setToutEnvoye(reste === 0);
      router.refresh();
    } finally {
      terminerActiviteTerrain(JETON_ENVOI);
    }
  }

  if (enEnvoi) {
    return (
      <>
        <AutreIdentite visible={autreIdentite} />
        <RefusEnClair refus={refus} onRetirer={retirerCetteSaisie} desactive />
        <Button type="button" size="lg" className="w-full text-16" disabled>
          {t("terrain.file.envoi_en_cours")}
        </Button>
      </>
    );
  }

  if (enAttente > 0 && enLigne) {
    return (
      <>
        <AutreIdentite visible={autreIdentite} />
        <RefusEnClair
          refus={refus}
          onRetirer={retirerCetteSaisie}
          desactive={false}
        />
        <Button
          type="button"
          size="lg"
          className="w-full text-16"
          onClick={() => void onClick()}
        >
          {libelleEnvoyer(enAttente)}
        </Button>
      </>
    );
  }

  // HORS RÉSEAU, LA FILE RESTE VISIBLE (point 5, C6) — jusqu'ici, rien ne
  // montrait « en attente d'envoi » tant que le réseau n'était pas revenu :
  // un technicien hors réseau depuis une heure ne voyait aucune trace de ce
  // que le téléphone garde pour lui.
  if (enAttente > 0) {
    return (
      <>
        <AutreIdentite visible={autreIdentite} />
        <RefusEnClair
          refus={refus}
          onRetirer={retirerCetteSaisie}
          desactive={false}
        />
        <p
          role="status"
          className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3 py-2 text-16 font-bold"
        >
          {libelleEnAttente(enAttente)}
        </p>
      </>
    );
  }

  if (toutEnvoye) {
    return (
      <>
        <AutreIdentite visible={autreIdentite} />
        <p role="status" className="text-app-vert-encre text-16 font-bold">
          {t("terrain.file.tout_envoye")}
        </p>
      </>
    );
  }

  return (
    <>
      <AutreIdentite visible={autreIdentite} />
      <RefusEnClair
        refus={refus}
        onRetirer={retirerCetteSaisie}
        desactive={false}
      />
    </>
  );
}
