import type { Metadata } from "next";
import { headers } from "next/headers";

import { BandeauSociete } from "@/components/theme/bandeau-societe";
import { t } from "@/lib/i18n/fr";
import { themeDeLaSession } from "@/lib/theme/session";
import { variablesCss } from "@/lib/theme/variables";

import "./globals.css";

export const metadata: Metadata = {
  title: t("app.nom"),
  description: t("app.description"),
};

/**
 * Mise en page racine — c'est ici que la charte de la société active est posée
 * (ticket L0-09).
 *
 * Les variables CSS partent avec le HTML, calculées CÔTÉ SERVEUR à partir de la
 * société active de la session : aucun script, aucun clignotement de couleur au
 * chargement, et rien à redéployer quand un client change ses couleurs — elles
 * sont en base.
 *
 * Le bandeau d'identité vit ici plutôt que dans une page : il est du CHROME,
 * commun à toutes les routes, et il se sert du thème déjà lu pour le document.
 * Une seule lecture cloisonnée par rendu.
 *
 * Lire les en-têtes rend le rendu dynamique, et c'est la conséquence assumée :
 * la charte dépend de la session, elle ne peut donc pas être figée à la
 * compilation. Une session sans société active reçoit le thème neutre.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = await themeDeLaSession(await headers());

  return (
    <html lang="fr">
      <head>
        {/* DEUX balises SÉPARÉES, et c'est délibéré (charte, §Polices) : une
            seule requête portant les deux familles fait perdre les DEUX quand
            elle échoue. Séparées, l'échec de l'une laisse l'autre. Le repli
            — 'Helvetica Neue', Arial — est nommé dans app/globals.css. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo+Narrow:wght@400..700&display=swap"
        />
      </head>
      <body
        className="min-h-dvh antialiased"
        data-origine-theme={theme.origine}
        style={variablesCss(theme)}
      >
        <div className="mx-auto max-w-5xl px-6 pt-6">
          <BandeauSociete theme={theme} />
        </div>
        {children}
      </body>
    </html>
  );
}
