import { LARGEUR_UTILE_PX } from "@/lib/theme/apparence";

/**
 * LA LARGEUR UTILE — `.wrap` de la maquette, 1400 px (D95).
 *
 * *Mesuré le 11/09/2026 avant D95 : cinq écrans, cinq largeurs — 448, 672, 768,
 * 896 et 1024 px, et aucune n'était celle de la maquette.* Une largeur décidée
 * par chaque page est une largeur qui dérive.
 *
 * Elle vivait dans la mise en page RACINE, ce qui la posait aussi sous la barre
 * de navigation. R2-16 ayant rendu la barre au segment, la racine ne peut plus
 * porter le cadre : une barre pleine largeur ne se rend pas à l'intérieur d'un
 * conteneur centré. Le cadre est donc un composant, et chaque mise en page de
 * segment le rend — **une seule écriture des cinq valeurs, à un seul endroit**,
 * ce qui est exactement ce que la racine garantissait.
 */
export function LargeurUtile({
  className,
  children,
}: Readonly<{ className?: string; children: React.ReactNode }>) {
  return (
    <div
      className={`mx-auto w-full px-5 pt-6 pb-16 ${className ?? ""}`}
      style={{ maxWidth: `${LARGEUR_UTILE_PX}px` }}
    >
      {children}
    </div>
  );
}
