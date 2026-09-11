import { LargeurUtile } from "@/components/mise-en-page/largeur-utile";
import { BarreDeNavigation } from "@/components/navigation/barre";
import { chromeDeLaRequete } from "@/lib/navigation/chrome";

/**
 * LE SEGMENT DU PORTAIL CLIENT (R2-16).
 *
 * Il porte la barre parce qu'il vient APRÈS une session : R2-16 ne traite que
 * les écrans qui la précèdent, et déplacer le portail par la même occasion
 * aurait été un changement que rien n'a mesuré.
 *
 * **Ce que la mesure dit, et qui n'est PAS tranché ici** : les onze entrées de
 * la barre viennent de la maquette, qui est une maquette de back-office —
 * « Planning », « Techniciens », « Facturation ». Un compte de portail les voit
 * donc aujourd'hui, toutes inertes. Ce n'est pas une fuite de cloisonnement
 * (aucune ne mène à une route servie, et une entrée inerte n'est pas un lien),
 * c'est la même faute de lecture que R2-16 corrige un segment plus loin, et
 * elle touche CE QU'UN CLIENT VOIT — donc elle appartient à Alexis (§1 du
 * protocole de session). Elle est portée au backlog sous R2-17.
 */
export default async function MiseEnPagePortail({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { theme, initiales } = await chromeDeLaRequete();

  return (
    <>
      <BarreDeNavigation theme={theme} initiales={initiales} />
      <LargeurUtile>{children}</LargeurUtile>
    </>
  );
}
