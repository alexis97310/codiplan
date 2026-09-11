import type { Metadata } from "next";
import { headers } from "next/headers";

import { BarreDeNavigation } from "@/components/navigation/barre";
import { obtenirSession } from "@/lib/auth/session";
import { t } from "@/lib/i18n/fr";
import { initialesDuNom } from "@/lib/navigation/initiales";
import { APPARENCE_PAR_DEFAUT, LARGEUR_UTILE_PX } from "@/lib/theme/apparence";
import { themeDuContexte } from "@/lib/theme/session";
import { variablesCss } from "@/lib/theme/variables";

import "./globals.css";

export const metadata: Metadata = {
  title: t("app.nom"),
  description: t("app.description"),
};

/**
 * Mise en page racine — c'est ici que l'apparence du produit et la charte de la
 * société active sont posées (tickets L0-09 et D95).
 *
 * ## Deux couches de couleur, et elles ne se confondent pas
 *
 * **L'APPARENCE** est celle du produit : surfaces, bordures, encres, familles
 * de statut. Elle vient de `data-apparence`, posé ici, et ses valeurs sont
 * déclarées dans `app/globals.css`. Elle est la même pour tout le monde tant
 * qu'un second thème n'existe pas (D95).
 *
 * **LA CHARTE** est celle de la société active : deux couleurs, calculées côté
 * serveur à partir de la société de la session. Elle se pose par-dessus, en six
 * variables `--societe-*`, et ne touche que ce qui parle d'identité — la
 * pastille de la barre, aujourd'hui.
 *
 * Les deux partent avec le HTML : aucun script, aucun clignotement de couleur
 * au chargement, et rien à redéployer quand un client change ses couleurs.
 *
 * ## La largeur utile
 *
 * `1400 px`, celle de `.wrap` dans la maquette, et elle est posée ICI — pas
 * dans les écrans. *Mesuré le 11/09/2026 avant D95 : cinq écrans, cinq
 * largeurs — 448, 672, 768, 896 et 1024 px, et aucune n'était celle de la
 * maquette.* Une largeur décidée par chaque page est une largeur qui dérive.
 *
 * ## Une seule lecture de session par rendu
 *
 * La session est lue une fois, ici, et le thème en est DÉDUIT
 * (`themeDuContexte`). L'appel qui lisait la session pour son seul compte a
 * disparu : la barre a besoin du nom de la personne, le thème a besoin de la
 * société, et ce sont deux choses de la même lecture.
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
  const entetes = await headers();
  const session = await obtenirSession(entetes);
  const theme = await themeDuContexte(session?.contexte ?? null);

  return (
    <html lang="fr">
      <body
        className="min-h-dvh antialiased"
        data-apparence={APPARENCE_PAR_DEFAUT}
        data-theme={theme.origine}
        style={variablesCss(theme)}
      >
        <BarreDeNavigation
          theme={theme}
          initiales={initialesDuNom(session?.identite.nom)}
        />
        <div
          className="mx-auto w-full px-5 pt-6 pb-16"
          style={{ maxWidth: `${LARGEUR_UTILE_PX}px` }}
        >
          {children}
        </div>
      </body>
    </html>
  );
}
