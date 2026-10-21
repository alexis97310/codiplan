import { MarqueAcces } from "@/components/navigation/marque";
import { Icone } from "@/components/ui/icone";
import { t } from "@/lib/i18n/fr";

const PUCES = [
  "connexion.cadre.puce_planning",
  "connexion.cadre.puce_terrain",
  "connexion.cadre.puce_facturation",
] as const;

/**
 * LE CADRE À DEUX COLONNES DES ÉCRANS SANS SESSION (D188, partie 5 ;
 * M:5433-5439, CSS `.auth`/`.auth-side` M:512-518, 885-886), REPRIS BORD À
 * BORD par 9EWB3-CONNEXION-MAQUETTE.
 *
 * ## Pourquoi `absolute inset-0`, et pas un simple `w-full`
 *
 * La mise en page du segment (`app/(sans-session)/layout.tsx`) enveloppe tout
 * écran dans `LargeurUtile` — 1400 px de large au plus, avec ses propres
 * marges (D95). Un enfant NORMAL de ce conteneur ne peut jamais dépasser
 * cette largeur ni ces marges : c'est exactement la faute mesurée avant ce
 * ticket (`CadreAcces` plafonné à 380 px, jamais à 50 %). Un enfant
 * POSITIONNÉ, lui, se mesure contre son ANCÊTRE POSITIONNÉ le plus proche —
 * ici le `<div className="relative …">` du layout, qui n'a lui-même ni
 * largeur maximale ni marge. `absolute inset-0` y occupe donc exactement la
 * hauteur et la largeur du segment, quelle que soit la largeur de
 * `LargeurUtile` posée entre les deux.
 *
 * ## La marque : UN SEUL nœud, jamais deux
 *
 * `MarqueAcces` est un item de grille à part, PAS niché dans le panneau : à
 * moins de 1024 px le panneau disparaît (`hidden`) et la marque reste seule
 * en première ligne, au-dessus du formulaire ; à partir de 1024 px, la marque
 * ET le panneau se partagent la même colonne (`col-start-1`), l'une en
 * première ligne, l'autre en seconde — visuellement un seul bloc sombre,
 * tenu par deux éléments de grille qui portent chacun `bg-app-chrome-fond`.
 * Un second `<a href="/">` romprait `marque-connexion.spec.ts`.
 */
export function CadreAcces({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="bg-background absolute inset-0 grid grid-rows-[auto_1fr] min-[1024px]:grid-cols-2">
      <MarqueAcces accueil="/" />

      <div className="text-app-chrome-actif-encre bg-app-chrome-fond col-start-1 row-start-2 hidden flex-col justify-center gap-6 px-12 pb-12 min-[1024px]:flex">
        <h2 className="text-28 max-w-[18ch] leading-tight font-bold">
          {t("connexion.cadre.titre")}
        </h2>
        <ul className="flex flex-col gap-3 text-16">
          {PUCES.map((cle) => (
            <li key={cle} className="flex items-start gap-2">
              <Icone nom="check" className="text-app-vert-fond mt-1 shrink-0" />
              <span>{t(cle)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* `bg-app-surface` — `.auth{background:#fff}` de la maquette (audit du
          21/10/2026, 9G9B) : sans lui, ce panneau reprenait `bg-background`
          de `CadreAcces` (le fond gris de la page), et un champ qui porte la
          même couleur y devenait quasi invisible. */}
      <div className="bg-app-surface col-start-1 row-start-2 flex flex-col overflow-y-auto px-5 pb-10 min-[1024px]:col-start-2 min-[1024px]:row-start-1 min-[1024px]:row-span-2 min-[1024px]:px-16 min-[1024px]:py-10">
        {children}
      </div>
    </div>
  );
}
