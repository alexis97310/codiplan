/**
 * LE DÉCOMPTE EN LECTURE — `.kpi-mini` de la maquette du 28/09
 * (9EC-TP-UX3-E-ABSENCES, D175), pour `/absences`.
 *
 * ## CE QU'IL N'EST PAS
 *
 * **Jamais une tuile cliquable.** `Kpi` (`components/ui/kpi.tsx`) porte déjà
 * le chevron et le lien de D140 — « toutes les tuiles de chiffres sont
 * cliquables » — mais D140 lui-même est borné par D140 (TP-UX1-3) et D136 : ce
 * décompte-ci reste délibérément en LECTURE SEULE (QE-13b, D175), aucun href,
 * aucun chevron. Un second composant plutôt qu'un `Kpi` sans `href` : la
 * géométrie diffère (`.kpi-mini` n'a ni filet de couleur ni casse majuscule),
 * et confondre les deux ferait porter à l'un les classes de l'autre le jour
 * où l'un des deux change (§9, 01/09).
 *
 * ## Les valeurs, lues et non approchées
 *
 * `.kpi-mini{background:var(--surface-2);border:1px solid var(--line-2);
 * border-radius:12px;padding:12px 14px}` (:638) — `--surface-2`/`--line-2`
 * sont `app-surface-creuse`/`app-bord-faible` (D124). `.kpi-mini span{
 * font-size:12px;color:var(--gray-ink)}` (:639) — casse NORMALE, contrairement
 * à `.kpi .l` (`Kpi`) qui est en capitales. `.kpi-mini b{font-size:22px;
 * display:block;margin:2px 0}` (:639) ; `.kpi-mini small{color:var(--muted)}`
 * (:640) — `app-encre-faible`.
 *
 * **`22px` n'a pas de classe dans l'échelle typographique** (`--text-12` …
 * `--text-28`, D143) : `text-24` est la plus proche, le même écart que D143
 * accepte déjà ailleurs plutôt que d'ajouter un littéral `text-[22px]` hors
 * échelle.
 */
export function DecompteLecture({
  libelle,
  valeur,
  detail,
}: Readonly<{
  libelle: string;
  valeur: React.ReactNode;
  detail?: string;
}>) {
  return (
    <div className="bg-app-surface-creuse border-app-bord-faible rounded-md border px-[14px] py-[12px]">
      <span className="text-app-gris-encre text-12 font-bold">{libelle}</span>
      <b className="my-[2px] block text-24 font-extrabold tabular-nums">
        {valeur}
      </b>
      {detail === undefined ? null : (
        <small className="text-app-encre-faible text-12 font-bold">
          {detail}
        </small>
      )}
    </div>
  );
}
