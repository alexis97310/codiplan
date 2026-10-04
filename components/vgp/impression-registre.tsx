"use client";

import { t } from "@/lib/i18n/fr";

/**
 * « IMPRIMER POUR CE CLIENT » — LE GESTE D'UN REGISTRE GROUPÉ (MO-12, UX9-c,
 * D166).
 *
 * **MÊME MÉCANISME que `ActionsBonIntervention`/`ActionsQrMachine`** — une
 * classe `print-vgp` posée sur `<body>` avant `window.print()`,
 * `app/globals.css` isolant `.zone-impression-vgp` sur cette seule classe,
 * `:has()` écarté pour la même raison déjà mesurée (voir le commentaire de
 * `print-qr`) — **avec une différence, nommée ici** : `/vgp` groupé pose
 * PLUSIEURS zones `.zone-impression-vgp`, une par client, alors que le bon et
 * le QR n'en posent jamais qu'une.
 *
 * **La résolution tient en une masquage IMPÉRATIF des AUTRES zones** —
 * `hidden` (Tailwind, `display:none`) l'emporte sur `visibility:visible`
 * quel que soit l'ordre des deux règles : la zone ciblée reste donc la SEULE
 * visible à l'impression, sans qu'aucune règle CSS n'ait besoin de savoir
 * QUEL client a été choisi. `afterprint` retire la classe du corps ET la
 * classe `hidden` des zones écartées, à l'identique du nettoyage déjà fait
 * par les deux composants cités.
 */
export function ImprimerRegistreVgp({
  clientId,
}: Readonly<{ clientId: string }>) {
  return (
    <button
      type="button"
      data-bloc="vgp-imprimer-client"
      onClick={() => {
        const zones = document.querySelectorAll<HTMLElement>(
          "[data-zone-impression-vgp]",
        );
        const cible = document.querySelector<HTMLElement>(
          `[data-zone-impression-vgp="${clientId}"]`,
        );
        if (cible === null) {
          return;
        }
        const autres = [...zones].filter((zone) => zone !== cible);
        for (const zone of autres) {
          zone.classList.add("hidden");
        }
        const nettoyer = () => {
          for (const zone of autres) {
            zone.classList.remove("hidden");
          }
          document.body.classList.remove("print-vgp");
          window.removeEventListener("afterprint", nettoyer);
        };
        window.addEventListener("afterprint", nettoyer);
        document.body.classList.add("print-vgp");
        window.print();
      }}
      className="border-app-bord bg-app-surface inline-flex min-h-[32px] items-center justify-center rounded-md border px-[10px] py-[6px] text-[12px] font-bold"
    >
      {t("vgp.impression.imprimer_client")}
    </button>
  );
}
