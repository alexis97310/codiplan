"use client";

import { t } from "@/lib/i18n/fr";

/**
 * LES DEUX GESTES DU NAVIGATEUR DE LA CARTE QR — copier, imprimer (N-11, §4).
 *
 * **Un seul petit composant client, nommé et limité à ces deux gestes** —
 * jamais un `"use client"` posé sur la page entière : `app/(back-office)/
 * parc/[id]/page.tsx` reste un composant serveur comme le reste du dépôt, et
 * seuls ces deux boutons ont besoin du navigateur (le presse-papiers, et
 * `window.print()`).
 *
 * **`identifiant` est la RÉFÉRENCE affichée, jamais le jeton QR.** Copier
 * l'identifiant copie ce que l'étiquette montre en clair sous le QR — D71 est
 * la même garantie que `components/ui/qr-code.tsx` tient déjà pour le rendu :
 * le secret n'a rien à faire dans ce composant non plus.
 */
export function ActionsQrMachine({
  identifiant,
}: Readonly<{ identifiant: string }>) {
  return (
    <div className="mt-[15px] flex justify-center gap-2 print:hidden">
      <button
        type="button"
        data-bloc="qr-copier"
        onClick={() => {
          void navigator.clipboard?.writeText(identifiant);
        }}
        className="border-app-bord bg-app-surface inline-flex min-h-[32px] items-center justify-center rounded-md border px-[10px] py-[6px] text-[12px] font-bold"
      >
        {t("machine.qr.copier_id")}
      </button>
      <button
        type="button"
        data-bloc="qr-imprimer"
        onClick={() => {
          window.print();
        }}
        className="bg-app-marque border-app-marque text-app-marque-encre inline-flex min-h-[32px] items-center justify-center rounded-md border px-[10px] py-[6px] text-[12px] font-bold"
      >
        {t("machine.qr.imprimer")}
      </button>
    </div>
  );
}
