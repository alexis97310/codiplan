import type { Metadata } from "next";

import Link from "next/link";

import { t } from "@/lib/i18n/fr";

export const metadata: Metadata = { title: t("scanner.hors_reseau.titre") };

/**
 * `/scanner-hors-reseau` — LA COQUILLE SANS DONNÉE DU SCANNER
 * (9I1-SCANNER-HORS-RESEAU, décision A d'Alexis, 28/10/2026).
 *
 * ## PUBLIQUE, ET IDENTIQUE POUR TOUT LE MONDE — C'EST LE CRITÈRE D'ADMISSION
 * DU SERVICE WORKER
 *
 * Même règle que `/sante`, `/connexion` et `/terrain-hors-reseau`
 * (`public/sw.js`, en-tête) : *une route entre dans la coquille si elle est
 * identique pour tout le monde.* Cette page ne lit NI session NI base, et ne
 * tente AUCUNE capacité hors réseau nouvelle (pas de caméra, pas de résolution
 * locale des QR) — « rien de plus qu'une page honnête ».
 *
 * ## ATTEINTE PAR LE REPLI DU SCANNER, JAMAIS PAR LA MISE EN CACHE DE
 * `/scanner` LUI-MÊME
 *
 * Le service worker sert CETTE page à la place de `/scanner` et
 * `/parc/scanner` quand leur réseau échoue (`estRepliScanner`), sur le même
 * modèle que `estRepliTerrain` — ni l'une ni l'autre de ces deux routes
 * authentifiées n'entre jamais dans `COQUILLE`.
 */
export default function PageScannerHorsReseau() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6">
      <header>
        <h1 className="text-24 font-extrabold tracking-tight">
          {t("scanner.hors_reseau.titre")}
        </h1>
      </header>
      <p
        role="status"
        className="border-app-bord bg-app-surface text-app-encre-faible rounded-lg border px-4 py-6 text-center text-16 font-bold"
      >
        {t("scanner.hors_reseau.message")}
      </p>
      <Link href="/terrain" className="text-16 font-bold underline">
        {t("terrain.retour")}
      </Link>
    </main>
  );
}
