"use client";

import { t } from "@/lib/i18n/fr";

/**
 * LE GESTE D'IMPRESSION DU BON (lot 16, BON-1) — même mécanisme que
 * `ActionsQrMachine` (`components/machines/actions-qr.tsx`), jamais une
 * variante : ce composant pose `print-bon` sur `<body>` avant
 * `window.print()`, et `app/globals.css` isole `.zone-impression-bon` sur
 * cette seule classe. `afterprint` la retire à la fermeture de la boîte de
 * dialogue plutôt qu'un délai arbitraire.
 *
 * Un seul petit composant client, limité à ce geste : la page du bon reste un
 * composant serveur, comme le reste du dépôt.
 */
export function ActionsBonIntervention() {
  return (
    <div className="flex justify-end print:hidden">
      <button
        type="button"
        data-bloc="bon-imprimer"
        onClick={() => {
          const nettoyer = () => {
            document.body.classList.remove("print-bon");
            window.removeEventListener("afterprint", nettoyer);
          };
          window.addEventListener("afterprint", nettoyer);
          document.body.classList.add("print-bon");
          window.print();
        }}
        className="bg-app-marque border-app-marque text-app-marque-encre inline-flex min-h-[32px] items-center justify-center rounded-md border px-[10px] py-[6px] text-[12px] font-bold"
      >
        {t("intervention.bon.imprimer")}
      </button>
    </div>
  );
}
