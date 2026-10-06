import Link from "next/link";

import { Icone } from "@/components/ui/icone";
import { t } from "@/lib/i18n/fr";

/**
 * LE VOLET — `.drawer`/`openDrawer` de la maquette du 28/09
 * (9EC-TP-UX3-E-ABSENCES, D175) : un panneau latéral de 440 px, plein écran
 * au téléphone, piloté entièrement par l'URL — jamais de JavaScript client.
 *
 * ## POURQUOI UN COMPOSANT SERVEUR, ET PAS `Tiroir` DU PLANNING
 *
 * `components/planning/tiroir.tsx` s'ouvre par délégation d'événements,
 * parce que le planning ne doit pas se recharger pour afficher un résumé
 * chargé à part (`fetch`). Ce volet n'a pas ce problème : il s'ouvre et se
 * ferme par un paramètre de l'URL (`?declarer=1`/`?apercu=1`), exactement
 * comme le formulaire qu'il remplace le faisait déjà — un lien ordinaire
 * suffit, et `app/(back-office)/absences/page.tsx` reste un composant
 * SERVEUR de bout en bout.
 *
 * ## Les valeurs, lues et non approchées
 *
 * `.drawer{position:fixed;top:0;right:0;bottom:0;width:440px;
 * background:var(--bg)}` et `@media (max-width:600px){.drawer{width:100vw}}`
 * (:401, :944) — `w-[min(440px,100vw)]` rend les deux règles en une seule
 * classe plutôt que de dupliquer une media query déjà écrite ailleurs
 * (`CLASSES_FEUILLE_BASSE`).
 */
export function Volet({
  surtitre,
  titre,
  hrefFermer,
  pied,
  children,
}: Readonly<{
  surtitre: string;
  titre: string;
  hrefFermer: string;
  pied?: React.ReactNode;
  children: React.ReactNode;
}>) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <Link
        href={hrefFermer}
        aria-hidden="true"
        tabIndex={-1}
        className="bg-app-encre/40 absolute inset-0"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="volet-titre"
        className="bg-app-surface relative z-10 flex h-full w-[min(440px,100vw)] flex-col shadow-xl"
      >
        <div className="border-app-bord flex items-start justify-between gap-3 border-b px-4 py-3.5">
          <div className="min-w-0">
            <div className="text-app-marque mb-[2px] text-12 font-extrabold tracking-[0.09em] uppercase">
              {surtitre}
            </div>
            <h2 id="volet-titre" className="text-16 font-bold">
              {titre}
            </h2>
          </div>
          <Link
            href={hrefFermer}
            aria-label={t("volet.fermer")}
            className="text-app-encre-faible shrink-0"
          >
            <Icone nom="x" />
          </Link>
        </div>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3.5">
          {children}
        </div>
        {pied === undefined ? null : (
          <div className="border-app-bord flex justify-end gap-2 border-t px-4 py-3.5">
            {pied}
          </div>
        )}
      </aside>
    </div>
  );
}
