import { cn } from "@/lib/utils";
import { CLASSES_TON } from "@/components/ui/badge";
import { t, type CleTraduction } from "@/lib/i18n/fr";
import { tonDePriorite } from "@/lib/theme/priorites";

/**
 * LA PUCE DE PRIORITÉ — `.prio` de la maquette du 28/09 (:1759, :167-171),
 * pour le registre et le planning (TP-UX1-3, commit « composants de base »).
 *
 * ## Les valeurs, lues et non approchées
 *
 * `.prio{display:inline-grid;place-items:center;min-width:30px;height:22px;
 * padding:0 6px;border-radius:6px;font-size:12px;font-weight:850;
 * letter-spacing:.02em}` (:167). `850` n'a pas de classe Tailwind : `800`
 * (`font-extrabold`) est la plus proche, le même écart que `Page` accepte déjà
 * pour `.eyebrow` (`components/mise-en-page/page.tsx`). **Rayon 6 px : AUCUN
 * jeton de rayon ne vaut 6** (10/12/14/18 seulement, D124) — cette puce n'en
 * porte donc aucun, plutôt que d'en approcher un qui ne vaudrait pas 6.
 *
 * ## LE MOT TOUJOURS, JAMAIS LE SEUL CODE (§5 de CLAUDE.md)
 *
 * La maquette compacte sa puce à `P1`, `P2`… (`prio()`, :1759, `full`
 * facultatif) — CE composant ne suit pas cette forme : `t("priorite.p1")` etc.
 * (`lib/i18n/fr.ts:2091-2094`) rendent déjà le mot complet
 * (« P1 — critique »), et une pastille qui ne montrerait que le code serait
 * une seconde forme du même sens, jamais une lecture de la maquette (§9,
 * 01/09).
 *
 * ## LA COULEUR VIENT DE GR5, JAMAIS DE `.prio.p1`…`.prio.p4`
 *
 * La maquette peint P1 en rouge PLEIN, P2 en orange, P3 en contour gris, P4 en
 * contour plus clair (:168-171) — mais `tonDePriorite` (`lib/theme/
 * priorites.ts`) porte déjà la correspondance tranchée par Alexis le
 * 26/09/2026 (GR5, audit du même jour, constat G6) : P1 rouge, P2 orange, P3
 * et P4 gris, PARTAGÉE par les cinq écrans qui affichent une priorité. *Une
 * seconde correspondance ici referait la faute que GR5 a fermée* — cette puce
 * emploie donc `CLASSES_TON[tonDePriorite(valeur)]` (les mêmes fonds/encres
 * que `Badge`), jamais le rouge plein ni les contours de la maquette.
 *
 * ## `court` — LE SIGLE SEUL, POUR UNE COLONNE DENSE (TP-UX3-1-REGISTRE-1)
 *
 * `planning.priorite_puce.p1`/`.p2` existent déjà pour la carte du planning,
 * mais s'arrêtent à deux valeurs — la carte n'y montre jamais P3 ni P4. Ce
 * composant a besoin des quatre : `priorite.court.p1`…`.p4`
 * (`lib/i18n/fr.ts`) lui sont propres, jamais réemployées depuis le
 * planning (§9, 01/09 — un sigle qui change pour l'un ne doit pas changer
 * pour l'autre sans le vouloir). `aria-label` et `title` portent toujours le
 * mot complet, pour qui ne voit ni la couleur ni la position.
 */
export function Priorite({
  valeur,
  court = false,
}: Readonly<{
  /** `p1` à `p4` — la même valeur que `PrioriteIntervention` du schéma. */
  valeur: string;
  court?: boolean;
}>) {
  const texteComplet = t(`priorite.${valeur}` as CleTraduction);
  const classes = cn(
    "inline-grid h-[22px] min-w-[30px] place-items-center px-[6px] text-12 font-extrabold tracking-[0.02em]",
    CLASSES_TON[tonDePriorite(valeur)],
  );
  if (!court) {
    return <span className={classes}>{texteComplet}</span>;
  }
  return (
    <span className={classes} aria-label={texteComplet} title={texteComplet}>
      {t(`priorite.court.${valeur}` as CleTraduction)}
    </span>
  );
}
