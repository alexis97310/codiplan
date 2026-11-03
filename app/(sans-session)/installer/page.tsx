import type { Metadata } from "next";

import { headers } from "next/headers";
import Link from "next/link";

import { detecterPlateforme } from "@/lib/pwa/installation";
import { t } from "@/lib/i18n/fr";

export const metadata: Metadata = { title: t("pwa.page_installer.titre") };

/**
 * LA PAGE PUBLIQUE D'INSTALLATION (9I00, demande d'Alexis du 31/10/2026) —
 * sans session, AUCUNE donnée de société : un technicien qui n'a pas encore
 * de compte, ou quelqu'un qui scanne l'affiche imprimée de `/parametres/
 * equipe`, atterrit ici avant même de savoir qu'un compte lui est destiné.
 *
 * `headers().get("user-agent")` plutôt que `beforeinstallprompt` capté côté
 * client (`components/pwa/magasin-installation.tsx`) : cette page EXPLIQUE un
 * geste, elle ne le déclenche jamais, et un visiteur qui n'a encore rien
 * cliqué n'a capté aucun évènement — voir `detecterPlateforme`.
 */
export default async function PageInstaller() {
  const userAgent = (await headers()).get("user-agent") ?? "";
  const plateforme = detecterPlateforme(userAgent);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("pwa.page_installer.titre")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("pwa.page_installer.accroche")}
        </p>
      </header>

      {plateforme === "android" ? (
        <section className="border-app-bord bg-app-surface flex flex-col gap-2 rounded-lg border p-4">
          <h2 className="text-base font-bold">
            {t("pwa.page_installer.android.titre")}
          </h2>
          <ol className="text-app-encre-faible flex list-inside list-decimal flex-col gap-1 text-sm">
            <li>{t("pwa.page_installer.android.etape1")}</li>
            <li>{t("pwa.page_installer.android.etape2")}</li>
          </ol>
        </section>
      ) : plateforme === "ios" ? (
        <section className="border-app-bord bg-app-surface flex flex-col gap-2 rounded-lg border p-4">
          <h2 className="text-base font-bold">
            {t("pwa.page_installer.ios.titre")}
          </h2>
          <ol className="text-app-encre-faible flex list-inside list-decimal flex-col gap-1 text-sm">
            <li>{t("pwa.installer.ios.etape1")}</li>
            <li>{t("pwa.installer.ios.etape2")}</li>
          </ol>
        </section>
      ) : (
        <p className="text-app-encre-faible text-sm">
          {t("pwa.installer.autre")}
        </p>
      )}

      <Link
        href="/connexion"
        className="text-app-marque text-sm font-bold underline"
      >
        {t("pwa.page_installer.connexion")}
      </Link>
    </main>
  );
}
