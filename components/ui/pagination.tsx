import Link from "next/link";

import { CLASSES_LIEN } from "@/lib/theme/apparence";

/**
 * LA PAGINATION D'UNE LISTE — un total, et deux liens (AT-07).
 *
 * ## Pourquoi un composant plutôt que quatre fois le même bloc
 *
 * `/clients`, `/parc`, `/sites` et `/interventions` posent tous la même
 * question sous leur tableau : combien de fiches correspondent à la
 * recherche, et comment voir la suite. *Quatre écritures d'un même critère
 * divergeraient en silence* (§9, 01/09) — celle-ci, écrite une fois, ne peut
 * pas.
 *
 * ## Aucune chaîne n'est écrite ici
 *
 * Comme `Kpi` et `Page`, ce composant reçoit des libellés DÉJÀ COMPOSÉS :
 * l'écran appelant résout ses clés du dictionnaire et compose ses nombres
 * (`app/(back-office)/presentation.ts`), et ce fichier ne fait que les poser.
 * Le gardien des chaînes visibles (L0-11) lit un fichier qui porte du JSX en
 * entier ; il ne pourrait pas distinguer une clé résolue d'un mot en dur.
 *
 * ## L'ÉTAT VIT DANS L'URL, jamais dans ce composant
 *
 * `hrefPage` construit l'URL de chaque page à partir des paramètres de
 * recherche COURANTS : un lien vers la page 3 d'une recherche filtrée doit
 * pouvoir se partager et rendre exactement la même chose au chargement.
 * Aucun état de composant, aucun JavaScript côté client.
 */
export function Pagination({
  page,
  totalPages,
  libelleResultats,
  libellePage,
  libellePrecedent,
  libelleSuivant,
  hrefPage,
}: Readonly<{
  page: number;
  totalPages: number;
  libelleResultats: string;
  libellePage: string;
  libellePrecedent: string;
  libelleSuivant: string;
  hrefPage: (page: number) => string;
}>) {
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 text-[11.5px]">
      <p className="text-app-encre-faible">{libelleResultats}</p>
      {totalPages <= 1 ? null : (
        <div className="flex flex-wrap items-center gap-3">
          {page > 1 ? (
            <Link href={hrefPage(page - 1)} className={CLASSES_LIEN}>
              {libellePrecedent}
            </Link>
          ) : (
            <span className="text-app-encre-faible">{libellePrecedent}</span>
          )}
          <span className="text-app-encre-faible">{libellePage}</span>
          {page < totalPages ? (
            <Link href={hrefPage(page + 1)} className={CLASSES_LIEN}>
              {libelleSuivant}
            </Link>
          ) : (
            <span className="text-app-encre-faible">{libelleSuivant}</span>
          )}
        </div>
      )}
    </nav>
  );
}
