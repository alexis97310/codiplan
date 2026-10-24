import Link from "next/link";

import { Icone, type NomIcone } from "@/components/ui/icone";
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
 * **`.more` se rend à 12 px, pas les 11 px de la maquette** — D138
 * (`docs/arbitrages.md`, 29/09/2026) : plancher de 12 px, amende D124 et D95.
 * Le gardien continue de lire 11 px sur la maquette ; c'est l'écart que D138
 * assume.
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
 *
 * ## `icone`, `compte`, `pied` — FACULTATIFS (9EG-TP-UX6-TABLEAU-DE-BORD-1)
 *
 * `card()` de la maquette pose une icône avant le titre et un compteur après
 * (`card-h`, :1796) ainsi qu'un pied de carte (`card-f`, :1798). **Absents,
 * le rendu reste EXACTEMENT celui d'avant ce ticket** — `demandes` et
 * `absences`, les deux appelants existants, ne les passent jamais.
 *
 * ## `variante="enTete"` — LA SECONDE MESURE, PAS UNE INVENTION (9G9A, 22/10/2026)
 *
 * `.card-head` de `codiplan-maquette-complete.html` (confronté par
 * `tests/unit/ui/composants-maquette.test.ts`, bloc « CarteListe ») mesure
 * `15px`/`padding:16px 18px` — DIFFÉRENT du `.card h2` ci-dessus (`14px`/
 * `14px 16px`), parce que les deux viennent de DEUX fichiers de maquette
 * (D125). `CarteEnTete` (`components/ui/maitre-detail.tsx`) portait cette
 * seconde mesure dans un second composant ; l'audit du 21/10/2026 (9G9A) a
 * compté TROIS composants de « carte à en-tête » pour ce qui n'est qu'une
 * carte avec deux mesures d'en-tête possibles. `variante="enTete"` ramène la
 * seconde mesure ICI, sans en inventer une troisième ni en effacer aucune :
 * `CarteEnTete` est désormais un simple alias d'import de ce composant
 * (`app/(back-office)/parc/[id]/page.tsx`), `sousTitre` et `bloc` repris tels
 * quels.
 */
export function Carte({
  titre,
  idTitre,
  sousTitre,
  icone,
  compte,
  action,
  enTeteDroite,
  id,
  bloc,
  variante = "standard",
  className,
  pied,
  children,
}: Readonly<{
  titre?: string;
  /**
   * L'`id` du `<h2>` du titre, pour un `aria-labelledby` posé ailleurs dans
   * la carte (ex. un formulaire dont le champ se lit par le titre plutôt
   * que par un `label` visible en double) — distinct de `id`, qui vise le
   * `<section>` pour une ancre (9G9C, intervention / note interne).
   */
  idTitre?: string;
  /** Sous le titre, en-tête `enTete` (`.card-head p`, N-12). */
  sousTitre?: string;
  icone?: NomIcone;
  /** Le compteur après le titre (`card-h .count`, maquette :1796). */
  compte?: number;
  action?: { readonly libelle: string; readonly href: string };
  /**
   * À DROITE DE L'EN-TÊTE, QUAND CE N'EST PAS UN LIEN (D122) — le filtre de
   * « Priorités opérationnelles » (9EG-TP-UX6-TABLEAU-DE-BORD-1) est un
   * `<select>`, jamais un lien : `action` reste réservé à `card()` (:1796,
   * `.more`, toujours un lien). Les deux ne coexistent pas chez un même
   * appelant.
   */
  enTeteDroite?: React.ReactNode;
  /** Pour une ancre — `<a href="#modeles">` (AT-04). Aucun rôle visuel. */
  id?: string;
  /** Le marqueur `data-bloc`, repris de `CarteEnTete` (N-11). */
  bloc?: string;
  /**
   * `"enTete"` reprend la mesure de `.card-head` (`codiplan-maquette-
   * complete.html`) plutôt que `.card h2` — voir la note ci-dessus. Absente,
   * la carte garde EXACTEMENT son rendu d'avant ce prop.
   *
   * `"imbriquee"` (9G9D, 25/10/2026) — SANS bordure ni rayon : pour le
   * regroupement interne d'une carte qui en contient déjà une (ex. le bloc
   * de confirmation du taux horaire, posé DANS la carte « Poser un nouveau
   * taux »). Une carte dans une carte ne porte jamais deux bordures — voir
   * la note de tête.
   */
  variante?: "standard" | "enTete" | "imbriquee";
  className?: string;
  /** Le pied de carte (`card-f`, maquette :1798). */
  pied?: React.ReactNode;
  children: React.ReactNode;
}>) {
  return (
    <section
      id={id}
      data-bloc={bloc}
      className={cn(
        variante === "imbriquee"
          ? "bg-app-surface overflow-hidden"
          : "bg-app-surface border-app-bord overflow-hidden rounded-lg border",
        className,
      )}
    >
      {titre === undefined ? null : (
        <div
          className={cn(
            "border-app-bord flex items-center justify-between gap-3 border-b",
            variante === "enTete"
              ? "px-[18px] py-[16px]"
              : "px-[16px] py-[14px]",
          )}
        >
          <div>
            <h2
              id={idTitre}
              className={cn(
                "flex items-center gap-2 font-bold",
                variante === "enTete" ? "text-[15px]" : "text-[14px]",
              )}
            >
              {icone === undefined ? null : <Icone nom={icone} taille={18} />}
              {titre}
              {compte === undefined ? null : (
                <span className="text-app-encre-faible text-12 font-bold">
                  {compte}
                </span>
              )}
            </h2>
            {sousTitre === undefined ? null : (
              <p className="text-app-encre-faible mt-[3px] text-13 font-bold">
                {sousTitre}
              </p>
            )}
          </div>
          {action === undefined ? null : (
            <Link
              href={action.href}
              className="text-app-marque text-12 font-bold whitespace-nowrap"
            >
              {action.libelle}
            </Link>
          )}
          {enTeteDroite}
        </div>
      )}
      {children}
      {pied === undefined ? null : (
        <div className="border-app-bord text-app-encre-faible border-t px-[16px] py-[10px] text-12 font-bold">
          {pied}
        </div>
      )}
    </section>
  );
}
