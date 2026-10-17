"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import {
  compterEnAttente,
  EVENEMENT_FILE_MODIFIEE,
  listerFile,
} from "@/lib/terrain/file-saisies";
import { envoyerFile } from "@/lib/terrain/envoi-file";

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

/**
 * LES REFUS, EN CLAIR (point 2 : « au premier refus, l'envoi de CETTE
 * intervention s'arrête, la saisie refusée reste dans la file avec le motif
 * affiché en clair »).
 */
function RefusEnClair({ refus }: { readonly refus: readonly string[] }) {
  if (refus.length === 0) {
    return null;
  }
  return (
    <>
      {refus.map((motifCle, index) => (
        <p
          key={index}
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3 py-2 text-16 font-bold"
        >
          {texteDuMotif(motifCle)}
        </p>
      ))}
    </>
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
  const [refus, setRefus] = useState<readonly string[]>([]);

  const rafraichirCompte = useCallback(() => {
    void compterEnAttente({ utilisateurId, societeId }).then(setEnAttente);
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
          .map((e) => e.motifRefus as string),
      );
    });
  }, [utilisateurId, societeId]);

  useEffect(() => {
    setEnLigne(navigator.onLine);
    rafraichirCompte();
    rafraichirRefus();
    const surLigne = () => setEnLigne(true);
    const surHorsLigne = () => setEnLigne(false);
    function surFileModifiee(): void {
      rafraichirCompte();
      rafraichirRefus();
    }
    window.addEventListener("online", surLigne);
    window.addEventListener("offline", surHorsLigne);
    window.addEventListener(EVENEMENT_FILE_MODIFIEE, surFileModifiee);
    return () => {
      window.removeEventListener("online", surLigne);
      window.removeEventListener("offline", surHorsLigne);
      window.removeEventListener(EVENEMENT_FILE_MODIFIEE, surFileModifiee);
    };
  }, [rafraichirCompte, rafraichirRefus]);

  async function onClick(): Promise<void> {
    setEnEnvoi(true);
    setToutEnvoye(false);
    await envoyerFile({ utilisateurId, societeId }, rafraichirCompte);
    const reste = await compterEnAttente({ utilisateurId, societeId });
    setEnAttente(reste);
    rafraichirRefus();
    setEnEnvoi(false);
    setToutEnvoye(reste === 0);
    router.refresh();
  }

  if (enEnvoi) {
    return (
      <>
        <RefusEnClair refus={refus} />
        <Button type="button" size="lg" className="w-full text-16" disabled>
          {t("terrain.file.envoi_en_cours")}
        </Button>
      </>
    );
  }

  if (enAttente > 0 && enLigne) {
    return (
      <>
        <RefusEnClair refus={refus} />
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

  if (toutEnvoye) {
    return (
      <p role="status" className="text-app-vert-encre text-16 font-bold">
        {t("terrain.file.tout_envoye")}
      </p>
    );
  }

  return <RefusEnClair refus={refus} />;
}
