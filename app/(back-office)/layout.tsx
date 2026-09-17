import { LargeurUtile } from "@/components/mise-en-page/largeur-utile";
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
 */
export default async function MiseEnPageBackOffice({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { theme, initiales } = await chromeDeLaRequete();

  return (
    <div className="flex min-h-dvh">
      <BarreDeNavigation
        theme={theme}
        initiales={initiales}
        entrees={ENTREES}
        accueil="/planning"
      />
      <div className="min-w-0 flex-1">
        <LargeurUtile>{children}</LargeurUtile>
      </div>
    </div>
  );
}
