import { cn } from "@/lib/utils";

/**
 * LE GABARIT D'ÉCRAN — titre, sous-titre, actions (AT-04).
 *
 * ## Pourquoi ce composant, maintenant
 *
 * *Chaque écran du back-office a écrit son propre `<h1>`* : `text-[22px]
 * font-extrabold tracking-tight` ici, sans `tracking` là, un `<p>` de
 * sous-titre parfois séparé par `gap-5` du flux, parfois par une marge. Rien
 * ne divergeait au point de casser un test, et c'est exactement pourquoi rien
 * ne l'a signalé : *une mise en page recopiée à la main devient fausse en
 * silence le jour où l'originale bouge* (§9, 01/09). C'est le défaut nommé par
 * le directeur d'exploitation — « certaines pages ne reprennent pas la mise en
 * page de la maquette » — et sa cause n'est pas un écran raté, c'est l'absence
 * d'un vocabulaire commun.
 *
 * ## Les valeurs, lues et non approchées
 *
 * `docs/maquette/CODIPLAN_Maquette.html` : `h1{font-size:22px;font-weight:800;
 * letter-spacing:-.4px;margin-bottom:3px}` et
 * `.sub{color:var(--gris);font-size:13px;margin-bottom:20px}`. Un gardien
 * confronte ces deux règles au texte de ce fichier
 * (`tests/unit/ui/composants-maquette.test.ts`) — la même discipline que
 * `tests/unit/navigation/entrees.test.ts` applique à la barre.
 *
 * ## Ce qu'il ne fait pas
 *
 * Il ne pose pas la largeur utile — `LargeurUtile` la pose déjà, à la racine du
 * segment (R2-16) — et il ne pose aucune couleur : `text-app-encre-faible` est
 * un jeton, jamais `var(--gris)` recopié.
 */
export function Page({
  titre,
  sousTitre,
  actions,
  className,
  children,
}: Readonly<{
  titre: string;
  sousTitre?: string;
  /** Le bandeau de droite — un décompte, une action. Jamais un bouton de création (§2). */
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}>) {
  return (
    <main className={cn("flex flex-col gap-5", className)}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-[3px] text-[22px] font-extrabold tracking-[-0.4px]">
            {titre}
          </h1>
          {sousTitre === undefined ? null : (
            <p className="text-app-encre-faible mb-[20px] text-[13px]">
              {sousTitre}
            </p>
          )}
        </div>
        {actions === undefined ? null : (
          <div className="flex flex-wrap items-center gap-3">{actions}</div>
        )}
      </header>
      {children}
    </main>
  );
}
