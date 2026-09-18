import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * LA CARTE — `.card` de la maquette (AT-04).
 *
 * ## Les valeurs, lues et non approchées
 *
 * `docs/maquette/CODIPLAN_Maquette.html` :
 * `.card{background:var(--blanc);border:1px solid var(--bord);
 * border-radius:10px}` ; `.card h2{font-size:14px;font-weight:700;
 * padding:14px 16px;border-bottom:1px solid var(--bord);display:flex;
 * align-items:center;justify-content:space-between}` ; `.card h2 .more{
 * font-size:11px;color:var(--bleu);font-weight:600}`. Un gardien confronte ces
 * trois règles au texte de ce fichier
 * (`tests/unit/ui/composants-maquette.test.ts`).
 *
 * **Le rayon n'est plus mesuré ici, depuis D124.** `border-radius:10px`
 * ci-dessus est la disposition MESURÉE de `CODIPLAN_Maquette.html`, mais la
 * VALEUR du jeton de rayon vient désormais de `--radius` (`app/globals.css`),
 * lui-même mesuré sur `codiplan-maquette-complete.html` — `14px` aujourd'hui.
 * `rounded-lg` ci-dessous n'écrit donc plus un nombre : il lit `--radius-lg`,
 * qui vaut `--radius` (`@theme inline`), et suit sa valeur sans qu'aucun
 * fichier d'écran ne bouge.
 *
 * ## Ce qu'elle ne fait pas
 *
 * **Elle ne rembourre pas son contenu.** La maquette écrit `.pad{padding:16px}`
 * comme une classe à part, posée sur un `<div>` INTÉRIEUR quand il en faut un
 * — un tableau, lui, va jusqu'au bord. *Rembourrer ici forcerait tout contenu
 * à ce choix*, et c'est exactement ce que `Tableau` refuse déjà en s'adossant
 * directement à la carte.
 *
 * L'action n'est JAMAIS un bouton de création : `.more` de la maquette est
 * toujours un lien qui MÈNE, jamais un geste qui écrit (§2 de `ActionPrimaire`).
 */
export function Carte({
  titre,
  action,
  id,
  className,
  children,
}: Readonly<{
  titre?: string;
  action?: { readonly libelle: string; readonly href: string };
  /** Pour une ancre — `<a href="#modeles">` (AT-04). Aucun rôle visuel. */
  id?: string;
  className?: string;
  children: React.ReactNode;
}>) {
  return (
    <section
      id={id}
      className={cn(
        "bg-app-surface border-app-bord overflow-hidden rounded-lg border",
        className,
      )}
    >
      {titre === undefined ? null : (
        <h2 className="border-app-bord flex items-center justify-between gap-3 border-b px-[16px] py-[14px] text-[14px] font-bold">
          <span>{titre}</span>
          {action === undefined ? null : (
            <Link
              href={action.href}
              className="text-app-marque text-[11px] font-semibold whitespace-nowrap"
            >
              {action.libelle}
            </Link>
          )}
        </h2>
      )}
      {children}
    </section>
  );
}
