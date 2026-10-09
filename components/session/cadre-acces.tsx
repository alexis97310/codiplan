import { Icone } from "@/components/ui/icone";
import { t } from "@/lib/i18n/fr";

/**
 * LE CADRE À DEUX COLONNES DES ÉCRANS SANS SESSION (D188, partie 5 ;
 * M:5433-5439, CSS `.auth-side` M:885-886).
 *
 * **La marque ne se répète pas ici** (décision GR17-M15, `marque-connexion.
 * spec.ts`) : elle reste celle que la page rend déjà, UNE SEULE FOIS,
 * au-dessus de ce cadre — ajouter une seconde `<a href="/">` romprait
 * `a[href="/"]` unique. La colonne gauche de la maquette porte la marque ;
 * cette version-ci ne la reprend pas, et c'est l'écart nommé par D188.
 *
 * Deux colonnes à partir de 1024 px ; sous ce seuil, la colonne gauche est
 * MASQUÉE (`.auth-side` disparaît en-dessous, M:885-886) — une seule
 * colonne, celle du formulaire.
 */
export function CadreAcces({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex flex-1 flex-col min-[1024px]:flex-row">
      <div className="bg-app-chrome-fond text-app-chrome-actif-encre hidden flex-col justify-center gap-6 px-10 py-12 min-[1024px]:flex min-[1024px]:w-[380px] min-[1024px]:shrink-0">
        <h2 className="text-18 font-bold">{t("connexion.cadre.titre")}</h2>
        <ul className="flex flex-col gap-3 text-sm">
          {(
            [
              "connexion.cadre.puce_planning",
              "connexion.cadre.puce_terrain",
              "connexion.cadre.puce_facturation",
            ] as const
          ).map((cle) => (
            <li key={cle} className="flex items-start gap-2">
              <Icone nom="check" className="mt-0.5 shrink-0" />
              <span>{t(cle)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
