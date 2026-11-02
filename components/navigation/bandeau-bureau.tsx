import { MenuCreer } from "@/components/navigation/menu-creer";
import { RechercheGlobale } from "@/components/navigation/recherche-globale";
import { Role } from "@/lib/auth/roles";

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
 *
 * **LA RECHERCHE N'EST PAS RENDUE AU TECHNICIEN (9G8G, D221)** — ses quatre
 * groupes (`lib/navigation/recherche-globale.ts`) portent des liens vers
 * `/clients/…`, `/sites/…`, `/parc/…`, `/interventions/…`, que ce rôle n'a
 * plus le droit d'atteindre depuis `/absences?declarer=1`, sa seule porte
 * dans ce segment. Ne pas MONTER `<RechercheGlobale>` du tout (plutôt que de
 * la masquer en CSS) retire aussi ses raccourcis globaux (`Ctrl K`, `/`) :
 * cachée sous 901 px, elle restait sinon active clavier, sous le volet.
 *
 * **`z-30`, PAS `z-20` (9IC-CORRECTIFS-COURTS, réserve du solde 593)** — les
 * cellules figées du planning (`sticky left-0 z-20`, vues Jour/Mois/Semaine,
 * `app/(back-office)/planning/page.tsx`) et `BandeauDeplacementDiffere`
 * (`components/planning/pose.tsx`) posent elles aussi `z-20`. Deux éléments
 * `position: sticky` ou `absolute` à Z ÉGAL se départagent par l'ORDRE DU
 * DOM : celui qui vient APRÈS peint par-dessus l'autre. Ce bandeau est
 * monté AVANT le contenu de la page (`app/(back-office)/layout.tsx`), donc
 * AVANT le tableau du planning — à `z-20` égal, une cellule figée qui défile
 * jusqu'à hauteur du bandeau passait donc PAR-DESSUS lui plutôt que dessous,
 * au défilement vertical de la page. `z-30` tranche sans ambiguïté, sans
 * toucher au planning : la cellule figée reste, elle, au-dessus des cases
 * ordinaires de sa propre grille (`z-10`), relation que ce changement ne
 * touche pas.
 */
export function BandeauBureau({ role }: Readonly<{ role: Role | null }>) {
  return (
    <header className="bg-app-surface border-app-bord sticky top-0 z-30 hidden min-[901px]:flex min-h-[64px] items-center gap-3 border-b px-5 py-2.5">
      {role === Role.technicien ? null : <RechercheGlobale />}
      <div className="ml-auto flex shrink-0 items-center">
        <MenuCreer role={role} />
      </div>
    </header>
  );
}
