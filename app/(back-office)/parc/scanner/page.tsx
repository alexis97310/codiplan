import type { Metadata } from "next";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { RefusAcces } from "@/components/ui/refus-acces";
import { ScannerQr } from "@/components/machines/scanner-qr";
import { resoudreScanBureau } from "@/components/machines/scan-qr-bureau";
import { peutPleinement } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import { t } from "@/lib/i18n/fr";

export const metadata: Metadata = { title: t("machine.scanner.titre") };

/**
 * LE LECTEUR DE QR CODE, CÔTÉ BUREAU (9G10-SCANNER-QR-APPLI, D144 d'Alexis).
 *
 * Même garde, au même niveau, que ce que `/parc` exige déjà pour s'ouvrir —
 * `consulter_parc_complet`, niveau COMPLET — jamais une seconde capacité
 * inventée pour ce seul écran (§9, 01/09). `resoudreScanBureau` revérifie le
 * même critère sous l'action : cette page ne garde rien que l'action ne
 * garderait pas elle-même, elle évite seulement d'y envoyer un rôle qu'on
 * sait déjà insuffisant.
 */
export default async function PageScannerBureau() {
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

  if (!peutPleinement(contexte.role, "consulter_parc_complet")) {
    return (
      <Page chemin="/parc" titre={t("machine.scanner.titre")}>
        <RefusAcces />
      </Page>
    );
  }

  return (
    <Page chemin="/parc" titre={t("machine.scanner.titre")}>
      <ScannerQr resoudre={resoudreScanBureau} />
    </Page>
  );
}
