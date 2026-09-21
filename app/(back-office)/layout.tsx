import { LargeurUtile } from "@/components/mise-en-page/largeur-utile";
import {
  BandeauMobile,
  FournisseurNavigationMobile,
} from "@/components/navigation/bandeau-mobile";
import { BarreDeNavigation } from "@/components/navigation/barre";
import { chromeDeLaRequete } from "@/lib/navigation/chrome";
import { ENTREES } from "@/lib/navigation/entrees";

/**
 * LE SEGMENT DU BACK-OFFICE — les écrans de travail, et ceux-là portent la
 * barre de navigation (R2-16).
 *
 * Elle vivait dans la mise en page racine depuis D95, où elle coiffait tout, y
 * compris les quatre écrans d'authentification et les deux écrans sans compte.
 * Elle est rendue ici, au segment, parce que c'est le segment qui sait s'il y a
 * une session à naviguer.
 *
 * **La barre reste du CHROME et n'accorde rien.** Un écran qui exige une
 * session continue de la demander lui-même et de rediriger ; une entrée de la
 * barre n'est jamais masquée pour cause de droit, ce que
 * `lib/navigation/entrees.ts` écrit — masquer serait une seconde lecture d'un
 * critère que la politique porte déjà, et c'est celle qui vieillit sans rougir.
 *
 * **DEPUIS D121, LA BARRE EST UNE COLONNE, PAS UN EN-TÊTE** : elle occupe la
 * hauteur de la fenêtre à gauche du contenu plutôt que sa largeur au-dessus.
 * Ce fichier pose donc la ligne flexible qui les met côte à côte — c'est tout
 * ce que ce changement de forme demande ici, `BarreDeNavigation` portant le
 * reste (sa propre largeur, son propre défilement).
 *
 * **SOUS 901 PX, LA COLONNE SORT DE L'ÉCRAN (COQUE-375)** : mesuré au
 * navigateur sur le site en ligne à 375 px, elle y occupait 272 px sur une
 * fenêtre de 375, avant même la gouttière — 63 px de contenu utile restants.
 * `FournisseurNavigationMobile` porte l'état d'ouverture que
 * `BarreDeNavigation` (l'aside, dans `components/navigation/barre.tsx`) et
 * `BandeauMobile` (le déclencheur ci-dessous) partagent tous deux ; il enrobe
 * l'ensemble parce que ni l'un ni l'autre ne peut recevoir de l'autre une
 * fonction depuis CE fichier, un composant SERVEUR. `<BarreDeNavigation
 * entrees={ENTREES} …/>` reste écrit ici en toutes lettres — c'est ce texte
 * que lit le gardien statique de R2-16
 * (`tests/unit/app/barre-par-segment.test.ts`).
 */
export default async function MiseEnPageBackOffice({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { theme, initiales } = await chromeDeLaRequete();

  return (
    <FournisseurNavigationMobile>
      <div className="flex min-h-dvh">
        <BarreDeNavigation
          theme={theme}
          initiales={initiales}
          entrees={ENTREES}
          accueil="/planning"
        />
        <div className="min-w-0 flex-1">
          <BandeauMobile />
          <LargeurUtile>{children}</LargeurUtile>
        </div>
      </div>
    </FournisseurNavigationMobile>
  );
}
