"use client";

import { useEffect } from "react";
import Link from "next/link";

import { ActionPrimaire } from "@/components/ui/action-primaire";
import { Carte } from "@/components/ui/carte";
import { t } from "@/lib/i18n/fr";

import "./globals.css";

/**
 * L'ERREUR GLOBALE — quand la mise en page RACINE elle-même lève (AV-11).
 *
 * `error.tsx` ne couvre pas ce cas : il s'insère À L'INTÉRIEUR de la mise en
 * page racine, qui reste rendue au-dessus de lui. Une exception levée par
 * `app/layout.tsx` — la lecture de session pour la charte, par exemple —
 * n'a donc PAS de mise en page au-dessus d'elle pour l'accueillir, et c'est le
 * cas que Next réserve à `global-error.tsx` : il REMPLACE la racine, et doit
 * donc porter ses propres `<html>` et `<body>`, et importer sa propre feuille
 * de style — rien de ce que `app/layout.tsx` pose ne lui parvient.
 *
 * **Il ne suppose ni session, ni société, ni charte.** Les jetons `--app-*`
 * restent lisibles : `app/globals.css` les déclare aussi sous `:root`, sans
 * exiger l'attribut que la racine pose d'ordinaire.
 *
 * **Le lien de retour reste `next/link`**, jamais `useRouter` : le geste utile
 * ici est une NAVIGATION, `Link` la fait sans condition supplémentaire, et
 * `eslint-plugin-next` refuse justement l'ancre nue vers une route interne.
 */
export default function ErreurGlobale({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="min-h-dvh antialiased">
        <div className="flex min-h-dvh items-center justify-center px-5 py-16">
          <Carte
            titre={t("etat.erreur_globale.titre")}
            className="w-full max-w-md"
          >
            <div className="flex flex-col items-center gap-4 px-4 py-8 text-center">
              <p className="text-app-encre-faible text-[13px]">
                {t("etat.erreur_globale.description")}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <ActionPrimaire type="button" onClick={reset}>
                  {t("etat.reessayer")}
                </ActionPrimaire>
                <Link
                  href="/"
                  className="text-app-marque text-[13px] font-semibold"
                >
                  {t("etat.retour_accueil")}
                </Link>
              </div>
            </div>
          </Carte>
        </div>
      </body>
    </html>
  );
}
