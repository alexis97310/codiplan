import { LargeurUtile } from "@/components/mise-en-page/largeur-utile";
import {
  BandeauMobile,
  FournisseurNavigationMobile,
} from "@/components/navigation/bandeau-mobile";
import { BarreDeNavigation } from "@/components/navigation/barre";
import { chromeDeLaRequete } from "@/lib/navigation/chrome";
import { ENTREES_PORTAIL } from "@/lib/navigation/entrees";

/**
 * LE SEGMENT DU PORTAIL CLIENT (R2-16).
 *
 * Il porte la barre parce qu'il vient APRÈS une session : R2-16 ne traite que
 * les écrans qui la précèdent, et déplacer le portail par la même occasion
 * aurait été un changement que rien n'a mesuré.
 *
 * **IL PORTE SA PROPRE BARRE DEPUIS D97**, et c'est tout l'objet de R2-17. Il
 * rendait celle du back-office — onze entrées venues d'une maquette de
 * back-office, « Planning », « Techniciens », « Facturation », toutes inertes
 * pour un compte de portail. *Ce n'était pas une fuite de cloisonnement —
 * aucune ne mène à une route servie, et une entrée inerte n'est pas un lien —
 * mais une fuite de LECTURE : un client y apprenait l'existence d'outils qui ne
 * sont pas les siens, et une entrée de menu renseigne par sa seule existence.*
 *
 * **Le point de retour change avec la barre**, et c'est la moitié qu'on
 * oublierait : la marque menait à `/planning`, que ce compte ne peut pas ouvrir
 * (D10). Elle mène ici à `/portail`.
 *
 * **DEPUIS D121, LA BARRE EST UNE COLONNE** : voir le commentaire équivalent
 * de `(back-office)/layout.tsx` pour le motif — même mise en page flexible,
 * seule la liste d'entrées diffère.
 *
 * **SOUS 901 PX, ELLE SORT DE L'ÉCRAN COMME CELLE DU BACK-OFFICE (COQUE-375)**
 * — même défaut mesuré (272 px sur 375, les deux coques appelant la même
 * `BarreDeNavigation`), même remède : voir le commentaire équivalent de
 * `(back-office)/layout.tsx` pour le motif du `FournisseurNavigationMobile`.
 */
export default async function MiseEnPagePortail({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { theme, initiales } = await chromeDeLaRequete();

  return (
    <FournisseurNavigationMobile>
      <div className="flex min-h-dvh">
        <BarreDeNavigation
          theme={theme}
          initiales={initiales}
          entrees={ENTREES_PORTAIL}
          accueil="/portail"
        />
        <div className="min-w-0 flex-1">
          <BandeauMobile />
          <LargeurUtile>{children}</LargeurUtile>
        </div>
      </div>
    </FournisseurNavigationMobile>
  );
}
