import { LargeurUtile } from "@/components/mise-en-page/largeur-utile";

/**
 * LE SEGMENT DES ÉCRANS QUI PRÉCÈDENT LA SESSION (R2-16).
 *
 * Six écrans y habitent : `/`, `/sante`, `/connexion`, `/connexion/code`,
 * `/enrolement`, `/premier-acces`. Ils ont une chose en commun, et c'est celle
 * qui décide : **au moment où ils s'affichent, il n'y a pas de session** — donc
 * rien à naviguer, et personne dont afficher les initiales.
 *
 * **Ce segment est la RÈGLE ELLE-MÊME, et c'est pour cela qu'il existe.**
 * L'acceptation de R2-16 le demande en toutes lettres : *la règle est portée
 * par la mise en page du segment et non par une liste de chemins tenue à la
 * main — une liste oublierait le prochain écran d'authentification.* Un
 * répertoire ne s'oublie pas : il se choisit au moment où l'on crée le fichier,
 * et `tests/unit/app/barre-par-segment.test.ts` refuse une page qui n'habiterait
 * aucun des trois segments.
 *
 * **Ce n'est PAS un contrôle d'accès**, et rien ici ne doit le laisser croire.
 * `/arrivee` est un écran d'après-session qui vit dans `(back-office)` ; ce qui
 * lui donne ou lui refuse ses données, ce sont les politiques et
 * `exigerContexteActif`, jamais le groupe de routes qui l'héberge.
 *
 * **Aucune lecture ici.** `/sante` traverse ce fichier, et son contrat est de
 * s'afficher avec une base injoignable : une mise en page qui lirait quoi que
 * ce soit le lui retirerait.
 */
export default function MiseEnPageSansSession({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // LA HAUTEUR EST TENUE ICI, ET C'EST CE QUI PERMET AUX PAGES DE CENTRER
  // SANS DÉBORDER (R2-09). *Mesuré le 11/09/2026 : `min-h-dvh` posé sur la
  // page, à l'intérieur d'un cadre qui porte 88 px de gouttière verticale,
  // donnait un document de 1088 px dans une fenêtre de 1000 — une page de
  // connexion qui défile de 88 px pour rien.* La hauteur vient donc du
  // segment, et les pages n'ont qu'à occuper ce qui reste.
  return (
    <div className="flex min-h-dvh flex-col">
      <LargeurUtile className="flex flex-1 flex-col">{children}</LargeurUtile>
    </div>
  );
}
