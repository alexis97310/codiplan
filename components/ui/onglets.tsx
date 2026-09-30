import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * LES ONGLETS — `.tabs`/`.tab` de la maquette du 28/09 (`tabs()`, :1800-1804,
 * :224-231), pour le registre des interventions (`ONGLETS_REGISTRE`,
 * `app/(back-office)/interventions/page.tsx`) et pour le planning.
 *
 * ## Les valeurs, lues et non approchées
 *
 * `.tab{height:44px;padding:0 12px;...font-weight:700;font-size:var(--fs-md)
 * ;border-bottom:2px solid transparent;margin-bottom:-1px}` (:225) —
 * `--fs-md` vaut 14 px (:37) ; `.tab.active{color:var(--blue);
 * border-bottom-color:var(--blue)}` (:227) — le soulignement de 2 px est
 * `--app-marque`. `.tab .count{min-width:22px;height:20px;padding:0 7px;
 * border-radius:999px;background:var(--line-2);color:var(--gray-ink);
 * font-size:12px;font-weight:750}` (:229) — `750` n'a pas de classe
 * Tailwind ; `--line-2`/`--gray-ink` sont `app-bord-faible`/`app-gris-encre`
 * (D124). `.tab.active .count{background:var(--blue-2);color:var(--blue-ink)}`
 * (:230) — `app-bleu-fond`/`-encre`. `.tab .count.hot{background:var(
 * --red-2);color:var(--red-ink)}` (:231) — `app-rouge-fond`/`-encre`.
 *
 * **`.tab .count.hot` l'emporte sur `.tab.active .count`** : les deux règles
 * portent la même spécificité (trois classes), et `.hot` est écrite APRÈS
 * dans la feuille de style — la cascade la fait gagner. Cette pièce reprend
 * donc le même ordre de priorité : `alerte` avant `actif`.
 *
 * L'onglet ACTIF (`aria-current="page"`) est décidé par l'appelant — jamais
 * par une comparaison de chemin ici, qui referait ce que chaque écran sait
 * déjà (`ONGLETS_REGISTRE`, `criteres.data.vue`).
 */
export type EtatOnglet = {
  readonly libelle: string;
  readonly href: string;
  /** Absent, aucun compteur ne s'affiche — jamais un zéro muet inventé ici. */
  readonly compte?: number;
  readonly actif?: boolean;
  /** Le compteur seul change de ton — jamais l'onglet entier (§9, 01/09). */
  readonly alerte?: boolean;
};

export function Onglets({
  libelleAria,
  elements,
}: Readonly<{
  libelleAria: string;
  elements: readonly EtatOnglet[];
}>) {
  return (
    <nav
      aria-label={libelleAria}
      className="border-app-bord flex gap-0.5 overflow-x-auto border-b"
    >
      {elements.map((element) => (
        <Onglet key={element.href} element={element} />
      ))}
    </nav>
  );
}

function Onglet({ element }: Readonly<{ element: EtatOnglet }>) {
  const { libelle, href, compte, actif = false, alerte = false } = element;
  return (
    <Link
      href={href}
      aria-current={actif ? "page" : undefined}
      className={cn(
        "-mb-px flex h-[44px] items-center gap-2 border-b-2 px-[12px] text-14 font-bold whitespace-nowrap",
        actif
          ? "border-app-marque text-app-marque"
          : "border-transparent text-app-encre-faible",
      )}
    >
      {libelle}
      {compte === undefined ? null : (
        <span
          className={cn(
            "inline-grid h-[20px] min-w-[22px] place-items-center rounded-full px-[7px] text-12 font-bold",
            alerte
              ? "bg-app-rouge-fond text-app-rouge-encre"
              : actif
                ? "bg-app-bleu-fond text-app-bleu-encre"
                : "bg-app-bord-faible text-app-gris-encre",
          )}
        >
          {compte}
        </span>
      )}
    </Link>
  );
}
