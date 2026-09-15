import { BarreDeNavigation } from "@/components/navigation/barre";
import { chromeDeLaRequete } from "@/lib/navigation/chrome";
import { ENTREES_TERRAIN } from "@/lib/navigation/entrees";

/**
 * LE SEGMENT DU TERRAIN — l'application du technicien (R5-01, L3-08).
 *
 * ## Pourquoi un quatrième groupe de routes, et pas une route de plus
 *
 * R2-16 a posé la règle : **ce qui décide qu'un écran porte telle barre est le
 * RÉPERTOIRE où il vit, jamais une liste de chemins.** Une liste tenue à la
 * main oublie le prochain écran ; un répertoire ne s'oublie pas. Le terrain a
 * son chrome — une barre sans entrée (`ENTREES_TERRAIN`) —, il a donc son
 * groupe.
 *
 * ## LA LARGEUR UTILE N'EST PAS POSÉE ICI, ET C'EST TOUT L'ÉCART
 *
 * Les trois autres segments rendent `LargeurUtile` : un cadre de 1400 px,
 * centré, fait pour un back-office. **Cet écran se regarde à 390 px**, tenu
 * d'une main, souvent au soleil. Un conteneur calibré pour un écran de bureau
 * n'y change rien de visible et laisserait croire que la question a été posée.
 * Ce segment pose sa propre gouttière, et rien d'autre.
 *
 * ## Ce que cette mise en page NE FAIT PAS
 *
 * Elle n'accorde rien. `chromeDeLaRequete` ne lève jamais et ne lit aucun
 * droit : *une barre affichée n'est pas une permission* (R2-16). Le contrôle
 * est dans la page, qui redirige, et dans la politique, qui décide.
 */
export default async function MiseEnPageTerrain({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { theme, initiales } = await chromeDeLaRequete();

  return (
    <>
      <BarreDeNavigation
        theme={theme}
        initiales={initiales}
        entrees={ENTREES_TERRAIN}
        accueil="/terrain"
      />
      <div className="mx-auto w-full max-w-[720px] px-4 py-4">{children}</div>
    </>
  );
}
