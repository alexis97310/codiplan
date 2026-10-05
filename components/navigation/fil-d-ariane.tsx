import Link from "next/link";

import { t } from "@/lib/i18n/fr";
import { CLASSES_LIEN } from "@/lib/theme/apparence";

export type ElementFilAriane = {
  readonly libelle: string;
  readonly href?: string;
};

/**
 * LE FIL D'ARIANE PARTAGÉ (9DR-TP-NAV2-RETOURS-FIL, D168) — extrait de
 * `components/mise-en-page/page.tsx`, qui le portait seul depuis FICHE-360-1
 * pour les deux fiches client et site. La décision 9 du 03/10/2026 (D168) le
 * remet sur TOUTES les fiches et les sous-pages de Paramètres, et revient
 * sur son retrait par D122 (qui l'avait remplacé par un simple « eyebrow »
 * de domaine — toujours en place, séparément, voir `mise-en-page/page.tsx`).
 *
 * ## AU TÉLÉPHONE (< 901 px), LE FIL DEVIENT « ‹ PARENT »
 *
 * Même seuil que `bandeau-mobile.tsx` et `ui/maitre-detail.tsx`. Le chevron
 * est un `::before` posé en CSS (`before:content-['‹']`), jamais une
 * troisième écriture du caractère dans `lib/i18n/fr.ts` — gardé par
 * `tests/unit/i18n/chevron-retour.test.ts`, qui interdit « ‹ » dans le
 * dictionnaire hors une exemption nommée. La forme vient de la maquette
 * `docs/propositions/ergonomie-2026-09-28/maquette-toutes-pages.html`
 * (`.crumbs>a:nth-last-child(3)::before{content:"‹"}`) : les deux blocs
 * ci-dessous existent tous les deux dans le DOM, et seule la classe
 * responsive décide lequel se voit — aucun état client, aucun `useState`,
 * parce que `Page` reste un composant SERVEUR.
 *
 * Chaque lien porte `min-h-[32px]` (99B-FICHE-MACHINE, 25/09/2026) : la
 * fiche machine avait sa PROPRE zone cliquable à cette taille sur son
 * ancien retour, retiré par ce même ticket — la reprendre ici, au lieu de
 * la laisser retomber au texte seul, évite de redéfaire ce que 99B avait
 * corrigé.
 */
export function FilAriane({
  elements,
}: Readonly<{ elements: readonly ElementFilAriane[] }>) {
  if (elements.length === 0) {
    return null;
  }
  // LE PARENT IMMÉDIAT — l'avant-dernier maillon ; le dernier est toujours
  // l'écran courant, jamais un lien.
  const parent =
    elements.length >= 2 ? elements[elements.length - 2] : undefined;

  return (
    <nav
      aria-label={t("navigation.fil_ariane")}
      className="text-app-encre-faible flex flex-wrap items-center gap-1 text-[12px] font-bold"
    >
      {parent === undefined || parent.href === undefined ? null : (
        <Link
          href={parent.href}
          className={`${CLASSES_LIEN} before:content-['‹'] inline-flex min-h-[32px] items-center gap-1 min-[901px]:hidden`}
        >
          {parent.libelle}
        </Link>
      )}
      <span className="hidden flex-wrap items-center gap-1 min-[901px]:flex">
        {elements.map((entree, index) => (
          <span key={index} className="flex items-center gap-1">
            {index === 0 ? null : (
              <span aria-hidden="true">{t("fil_ariane.separateur")}</span>
            )}
            {entree.href === undefined ? (
              <span aria-current="page">{entree.libelle}</span>
            ) : (
              <Link
                href={entree.href}
                className={`${CLASSES_LIEN} inline-flex min-h-[32px] items-center`}
              >
                {entree.libelle}
              </Link>
            )}
          </span>
        ))}
      </span>
    </nav>
  );
}
