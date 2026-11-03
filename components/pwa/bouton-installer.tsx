"use client";

import { useEffect, useState } from "react";

import { Carte } from "@/components/ui/carte";
import { Icone } from "@/components/ui/icone";
import { t } from "@/lib/i18n/fr";

import { useInstallationPwa } from "./magasin-installation";

/** La bannière iOS, refermée une fois, reste refermée SUR CET APPAREIL (même contrat try/catch que `components/navigation/barre.tsx`). */
const CLE_BANNIERE_IOS_REFERMEE = "codiplan.pwa.banniere_ios_refermee";

export function BoutonInstallerCodiplan() {
  const { etat, installer } = useInstallationPwa();
  const [banniereRefermee, setBanniereRefermee] = useState(true);

  useEffect(() => {
    try {
      setBanniereRefermee(
        window.localStorage.getItem(CLE_BANNIERE_IOS_REFERMEE) === "1",
      );
    } catch {
      setBanniereRefermee(false);
    }
  }, []);

  if (etat === "deja_installee") {
    return null;
  }

  if (etat === "android_chrome") {
    return (
      <button
        type="button"
        onClick={() => void installer?.()}
        className="border-app-bord bg-app-surface inline-flex min-h-11 items-center justify-center rounded-md border px-3 py-2 text-16 font-bold"
      >
        {t("pwa.installer.bouton")}
      </button>
    );
  }

  if (etat === "ios_safari") {
    if (banniereRefermee) {
      return null;
    }
    return (
      <Carte
        titre={t("pwa.installer.ios.titre")}
        enTeteDroite={
          <button
            type="button"
            aria-label={t("pwa.installer.ios.fermer")}
            onClick={() => {
              setBanniereRefermee(true);
              try {
                window.localStorage.setItem(CLE_BANNIERE_IOS_REFERMEE, "1");
              } catch {
                // La page fonctionne sans mémoire — voir l'entête de ce fichier.
              }
            }}
            className="text-app-encre-faible shrink-0"
          >
            <Icone nom="x" />
          </button>
        }
      >
        <ol className="text-app-encre-faible flex list-inside list-decimal flex-col gap-1 p-3.5 text-16 font-bold">
          <li>{t("pwa.installer.ios.etape1")}</li>
          <li>{t("pwa.installer.ios.etape2")}</li>
        </ol>
      </Carte>
    );
  }

  return (
    <p className="text-app-encre-faible text-16 font-bold">
      {t("pwa.installer.autre")}
    </p>
  );
}
