"use client";

import { t } from "@/lib/i18n/fr";

/**
 * LE GESTE D'IMPRESSION DE L'AFFICHE D'INSTALLATION (9I00) — même mécanisme
 * que `ActionsBonIntervention`/`ImprimerRegistreVgp`, jamais une variante :
 * pose `print-affiche` sur `<body>` avant `window.print()`, et `app/
 * globals.css` isole `.zone-impression-affiche` sur cette seule classe.
 */
export function ImprimerAfficheInstallation() {
  return (
    <div className="flex justify-end print:hidden">
      <button
        type="button"
        onClick={() => {
          const nettoyer = () => {
            document.body.classList.remove("print-affiche");
            window.removeEventListener("afterprint", nettoyer);
          };
          window.addEventListener("afterprint", nettoyer);
          document.body.classList.add("print-affiche");
          window.print();
        }}
        className="bg-app-marque border-app-marque text-app-marque-encre inline-flex min-h-[32px] items-center justify-center rounded-md border px-[10px] py-[6px] text-[12px] font-bold"
      >
        {t("pwa.affiche.imprimer")}
      </button>
    </div>
  );
}
