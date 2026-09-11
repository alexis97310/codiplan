import type { Metadata, Viewport } from "next";

import { EnregistrementServiceWorker } from "@/components/pwa/enregistrement";
import { t } from "@/lib/i18n/fr";
import { chromeDeLaRequete } from "@/lib/navigation/chrome";
import { APPARENCE_PAR_DEFAUT } from "@/lib/theme/apparence";
import { COULEUR_MARQUE } from "@/lib/theme/manifeste";
import { variablesCss } from "@/lib/theme/variables";

import "./globals.css";

export const metadata: Metadata = {
  title: t("app.nom"),
  description: t("app.description"),
  // La couleur de la barre du système sur mobile. Elle vient du manifeste, et
  // de lui seul : *deux endroits où l'on écrit la couleur du produit finissent
  // par en écrire deux différentes* (§9, 01/09).
  manifest: "/manifest.webmanifest",
};

/**
 * La couleur que le navigateur applique à sa propre barre. Elle est SÉPARÉE de
 * `metadata` parce que Next l'exige ainsi, et elle est LUE du manifeste.
 */
export const viewport: Viewport = {
  themeColor: COULEUR_MARQUE,
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
 * Elle n'est plus posée ici (R2-16) : une barre pleine largeur ne se rend pas à
 * l'intérieur d'un conteneur centré. Elle est passée dans un composant,
 * `components/mise-en-page/largeur-utile.tsx`, que les trois mises en page de
 * segment rendent — une seule écriture, comme avant.
 *
 * ## LA BARRE DE NAVIGATION N'EST PLUS ICI (R2-16)
 *
 * Elle y était depuis D95, et elle coiffait donc AUSSI `/connexion`,
 * `/premier-acces`, `/enrolement`, `/sante` et `/` — *onze entrées dont dix
 * inertes au-dessus d'un formulaire de connexion, avec une pastille d'identité
 * vide par construction.* Ce n'est pas un défaut de sécurité : la barre n'a
 * jamais été un contrôle d'accès, et `lib/navigation/entrees.ts` l'écrit. C'est
 * un défaut de lecture, et c'est le premier écran qu'un acheteur voit.
 *
 * **La règle est portée par le SEGMENT, jamais par une liste de chemins.** Une
 * liste tenue à la main oublierait le prochain écran d'authentification ; un
 * répertoire ne s'oublie pas, il se choisit au moment où l'on crée le fichier.
 * Trois groupes, et chaque page en habite exactement un :
 * `(sans-session)` sans barre, `(back-office)` et `(portail)` avec.
 * `tests/unit/app/barre-par-segment.test.ts` en dérive la population du
 * répertoire `app/` et refuse une page qui n'habiterait aucun des trois.
 *
 * ## Une seule lecture de session par rendu
 *
 * La racine a besoin de la société pour la charte ; la mise en page du segment
 * a besoin du nom pour la pastille. Une mise en page ne transmet rien à celles
 * qu'elle englobe : les deux appellent donc `chromeDeLaRequete`, qui est
 * mémoïsée par requête et ne lit la session qu'UNE fois par rendu.
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
  // LA MISE EN PAGE RACINE NE LÈVE JAMAIS, et ce n'est pas une précaution :
  // elle est traversée par `/` et par `/sante`, deux écrans dont le contrat est
  // de s'afficher sans compte et sans base. Un appel nu à `obtenirSession` les
  // a fait rendre 500 le 11/09 — mesuré, le serveur n'a jamais démarré.
  const { theme } = await chromeDeLaRequete();

  return (
    <html lang="fr">
      <body
        className="min-h-dvh antialiased"
        data-apparence={APPARENCE_PAR_DEFAUT}
        data-theme={theme.origine}
        style={variablesCss(theme)}
      >
        {children}
        {/*
          LE SERVICE WORKER S'ENREGISTRE ICI, à la racine (L3-06) : il sert la
          COQUILLE et non un écran, et le poser dans un segment l'attacherait à
          un groupe de routes. Il ne rend rien et n'échoue jamais bruyamment —
          *pas de hors-ligne vaut mieux qu'une application qui refuse de
          s'afficher.*
        */}
        <EnregistrementServiceWorker />
      </body>
    </html>
  );
}
