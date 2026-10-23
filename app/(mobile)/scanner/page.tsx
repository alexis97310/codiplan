import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ScannerQr } from "@/components/machines/scanner-qr";
import { resoudreScanTerrain } from "@/components/machines/scan-qr-terrain";
import { niveau } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import { t } from "@/lib/i18n/fr";

export const metadata: Metadata = { title: t("machine.scanner.titre") };

/**
 * LE LECTEUR DE QR CODE, CÔTÉ TERRAIN (9G10-SCANNER-QR-APPLI, D144 d'Alexis).
 *
 * **Hors de `app/(mobile)/terrain/**`, délibérément** : le territoire de ce
 * lot restreint ce répertoire à l'entrée qui y mène (le bouton « Scanner »
 * de « Ma journée »), jamais à un écran de plus dedans. Cette page vit dans
 * le même GROUPE de routes `(mobile)` — elle porte donc le même chrome
 * (`app/(mobile)/layout.tsx` décide par répertoire, R2-16), calibré pour un
 * écran tenu d'une main, sans jamais ouvrir `app/(mobile)/terrain/`.
 *
 * Même garde que `/terrain` lui-même — un rôle à accès COMPLET sur
 * `consulter_parc_complet` est un rôle de bureau, renvoyé avec un refus
 * NOMMÉ plutôt qu'un redirect muet (même raison que `ReserveAuxTechniciens`,
 * dupliquée ici plutôt qu'importée : `app/(mobile)/terrain/page.tsx` ne
 * l'exporte pas, et l'exporter pour ce seul usage coûterait plus qu'une
 * poignée de lignes répétées, §9).
 */
export default async function PageScannerTerrain() {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null || session.contexte.role === null) {
    redirect("/arrivee");
  }
  const contexte = {
    ...session.contexte,
    societeId: session.contexte.societeId,
    role: session.contexte.role,
  };

  const acces = niveau(contexte.role, "consulter_parc_complet");
  if (acces === "complet") {
    return <ReserveAuxTechniciens />;
  }
  if (acces === "aucun") {
    redirect("/arrivee");
  }

  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-24 font-extrabold tracking-tight">
          {t("machine.scanner.titre")}
        </h1>
      </header>
      <ScannerQr resoudre={resoudreScanTerrain} />
    </main>
  );
}

/** Même forme que son homonyme de `app/(mobile)/terrain/page.tsx` — voir l'en-tête. */
function ReserveAuxTechniciens() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div
        role="status"
        className="border-app-bord bg-app-surface flex max-w-sm flex-col gap-2 rounded-lg border px-4 py-6 text-center"
      >
        <h1 className="text-16 font-bold">{t("terrain.reserve.titre")}</h1>
        <p className="text-app-encre-faible text-16 font-bold">
          {t("terrain.reserve.description")}
        </p>
        <Link href="/planning" className="text-app-marque mt-2 underline">
          {t("terrain.reserve.retour")}
        </Link>
      </div>
    </div>
  );
}
