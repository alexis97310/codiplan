"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { ActionPrimaire } from "@/components/ui/action-primaire";
import { Button } from "@/components/ui/button";
import { Carte } from "@/components/ui/carte";
import { t } from "@/lib/i18n/fr";

/**
 * L'ERREUR — posée à la racine de `app/` (AV-11).
 *
 * Elle remplace la PAGE BLANCHE qu'un écran cassé rendait jusqu'ici : Next
 * insère un `error.tsx` à la place du segment qui a levé, et cette limite
 * catch-tout est la seule à couvrir tous les segments sans que chacun écrive
 * la sienne.
 *
 * **Elle ne montre AUCUNE trace technique** — pas même celle que `error`
 * porte : le message d'une exception n'est pas destiné à un humain (tête de
 * `lib/i18n/fr.ts`), et une exception applicative peut porter un message qui
 * révélerait ce que l'appelant n'a pas le droit de lire (D50). Elle ne journalise
 * `error` qu'en console — un canal de développeur, jamais l'écran.
 *
 * **Deux gestes, tous deux actionnés par un humain** : réessayer le rendu du
 * segment (`reset`, fourni par Next), ou revenir à l'écran précédent. Aucun
 * délai, aucun réessai automatique — personne n'a fixé ces valeurs (§8).
 */
export default function Erreur({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-16">
      <Carte titre={t("etat.erreur.titre")} className="w-full max-w-md">
        <div className="flex flex-col items-center gap-4 px-4 py-8 text-center">
          <p className="text-app-encre-faible text-[13px]">
            {t("etat.erreur.description")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <ActionPrimaire type="button" onClick={reset}>
              {t("etat.reessayer")}
            </ActionPrimaire>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              {t("etat.retour_arriere")}
            </Button>
          </div>
        </div>
      </Carte>
    </div>
  );
}
