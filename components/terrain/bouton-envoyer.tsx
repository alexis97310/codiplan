"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/fr";
import { compterEnAttente } from "@/lib/terrain/file-saisies";
import { envoyerFile } from "@/lib/terrain/envoi-file";

/** `Envoyer (3)` — composé hors du JSX, où aucun littéral n'est admis (L0-11). */
function libelleEnvoyer(n: number): string {
  return `${t("terrain.file.envoyer")} (${n})`;
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

  const rafraichirCompte = useCallback(() => {
    void compterEnAttente({ utilisateurId, societeId }).then(setEnAttente);
  }, [utilisateurId, societeId]);

  useEffect(() => {
    setEnLigne(navigator.onLine);
    rafraichirCompte();
    const surLigne = () => setEnLigne(true);
    const surHorsLigne = () => setEnLigne(false);
    window.addEventListener("online", surLigne);
    window.addEventListener("offline", surHorsLigne);
    return () => {
      window.removeEventListener("online", surLigne);
      window.removeEventListener("offline", surHorsLigne);
    };
  }, [rafraichirCompte]);

  async function onClick(): Promise<void> {
    setEnEnvoi(true);
    setToutEnvoye(false);
    await envoyerFile({ utilisateurId, societeId }, rafraichirCompte);
    const reste = await compterEnAttente({ utilisateurId, societeId });
    setEnAttente(reste);
    setEnEnvoi(false);
    setToutEnvoye(reste === 0);
    router.refresh();
  }

  if (enEnvoi) {
    return (
      <Button type="button" size="lg" className="w-full text-16" disabled>
        {t("terrain.file.envoi_en_cours")}
      </Button>
    );
  }

  if (enAttente > 0 && enLigne) {
    return (
      <Button
        type="button"
        size="lg"
        className="w-full text-16"
        onClick={() => void onClick()}
      >
        {libelleEnvoyer(enAttente)}
      </Button>
    );
  }

  if (toutEnvoye) {
    return (
      <p role="status" className="text-app-vert-encre text-16 font-bold">
        {t("terrain.file.tout_envoye")}
      </p>
    );
  }

  return null;
}
