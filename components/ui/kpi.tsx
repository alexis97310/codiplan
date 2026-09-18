import { cn } from "@/lib/utils";

/**
 * LE KPI — `.kpi` de la maquette (AT-04) : un filet de couleur à gauche, un
 * libellé, une valeur, un détail.
 *
 * ## Pourquoi ce composant arrive avec l'écran du parc, et non avec les sept
 * autres pièces
 *
 * *La maquette pose QUATRE KPI en bandeau sur l'écran du parc* — c'est le
 * directeur d'exploitation qui l'a mesuré, l'écran en ligne n'en avait aucun.
 * Le besoin n'est apparu qu'en reconstruisant cet écran ; `.kpi` est pourtant
 * une pièce de la maquette au même titre que `.card` ou `.b`, et ce fichier
 * suit la même discipline que les sept autres : confronté, jamais recopié.
 *
 * ## Les valeurs, lues et non approchées
 *
 * `docs/maquette/CODIPLAN_Maquette.html` :
 * `.kpi{padding:15px 16px;border-radius:10px}` avec un filet
 * `::before{width:3px}` collé au bord gauche ; `.kpi .l{font-size:11px;
 * text-transform:uppercase;letter-spacing:.6px;font-weight:700}` ;
 * `.kpi .v2{font-size:27px;font-weight:800;letter-spacing:-1px;
 * margin:4px 0 2px}` ; `.kpi .d{font-size:11px}`. Un gardien confronte ces
 * règles au texte de ce fichier
 * (`tests/unit/ui/composants-maquette.test.ts`).
 *
 * **Le rayon fait exception, depuis D124** : `border-radius:10px` ci-dessus
 * est la disposition mesurée sur `CODIPLAN_Maquette.html`, mais la VALEUR du
 * jeton vient de `--radius` (`app/globals.css`, mesuré sur
 * `codiplan-maquette-complete.html` — `14px`) ; `rounded-lg` lit
 * `--radius-lg`, jamais un nombre écrit à côté.
 *
 * ## LE TON, jamais une couleur
 *
 * La maquette décline `.kpi` en quatre filets — nu (bleu), `.r` (rouge), `.v`
 * (vert), `.o` (orange) —, les mêmes quatre couleurs que `Badge`. Ce
 * composant reprend le même principe : un TON, jamais une valeur hexadécimale
 * (`lib/theme/apparence.ts`, gardé par `tests/unit/theme/sans-couleur-en-dur`).
 *
 * **Le rouge du filet est `--app-rouge-bord`, jamais `--app-accent`.** Les
 * deux valent la même teinte dans la maquette — c'est elle qui nomme `--rouge`
 * une seule fois —, mais `--app-accent` porte déjà DEUX sens dans ce dépôt : la
 * marque et l'alerte (`components/ui/action-primaire.tsx`, gardé par
 * `tests/unit/theme/action-primaire.test.ts`). *Un troisième sens sur la même
 * couleur est une couleur qui ne dit plus rien* — un KPI est une DONNÉE, pas
 * une alerte ni la marque, et il rejoint donc la famille que `Badge` et
 * `CLASSES_BLOC` (`lib/theme/statuts.ts`) emploient déjà pour ce rôle.
 */
export type TonKpi = "bleu" | "rouge" | "vert" | "orange";

const CLASSES_FILET: Record<TonKpi, string> = {
  bleu: "before:bg-app-marque",
  rouge: "before:bg-app-rouge-bord",
  vert: "before:bg-app-vert-plein",
  orange: "before:bg-app-orange-bord",
};

export function Kpi({
  ton = "bleu",
  libelle,
  valeur,
  detail,
}: Readonly<{
  ton?: TonKpi;
  libelle: string;
  valeur: React.ReactNode;
  detail?: string;
}>) {
  return (
    <div
      className={cn(
        "bg-app-surface border-app-bord relative overflow-hidden rounded-lg border px-[16px] py-[15px] before:absolute before:inset-y-0 before:left-0 before:w-[3px]",
        CLASSES_FILET[ton],
      )}
    >
      <div className="text-app-encre-faible text-[11px] font-bold tracking-[0.6px] uppercase">
        {libelle}
      </div>
      <div className="mt-[4px] mb-[2px] text-[27px] font-extrabold tracking-[-1px]">
        {valeur}
      </div>
      {detail === undefined ? null : (
        <div className="text-app-encre-faible text-[11px]">{detail}</div>
      )}
    </div>
  );
}
