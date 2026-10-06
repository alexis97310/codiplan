import { MenuCreer } from "@/components/navigation/menu-creer";
import { RechercheGlobale } from "@/components/navigation/recherche-globale";
import type { Role } from "@/lib/auth/roles";

/**
 * LE BANDEAU DU BUREAU (QE-3, 9DU-TP-NAV3-RECHERCHE-RAIL, D171) — la
 * recherche globale et le menu « Créer », au-dessus du contenu, DÈS 901 PX.
 *
 * ## Le symétrique de `BandeauMobile`, jamais le même bandeau
 *
 * `BandeauMobile` (`min-[901px]:hidden`) porte le déclencheur du tiroir et le
 * titre de l'écran, lu dans le DOM — un rôle de COQUE, nécessaire tant que la
 * colonne latérale sort de l'écran. Celui-ci (`hidden min-[901px]:flex`) ne
 * sert qu'à partir du moment où la colonne reste en place : deux bandeaux
 * distincts, jamais un seul qui déciderait de sa propre forme par CSS seul,
 * pour ne pas répéter le piège nommé par `BandeauMobile` (lire le DOM plutôt
 * que porter un titre à la main).
 *
 * **Composant SERVEUR** — il n'assemble que deux composants déjà clients
 * (`RechercheGlobale`, `MenuCreer`), sans son propre état.
 */
export function BandeauBureau({ role }: Readonly<{ role: Role | null }>) {
  return (
    <header className="bg-app-surface border-app-bord sticky top-0 z-20 hidden min-[901px]:flex min-h-[64px] items-center gap-3 border-b px-5 py-2.5">
      <RechercheGlobale />
      <div className="ml-auto flex shrink-0 items-center">
        <MenuCreer role={role} />
      </div>
    </header>
  );
}
