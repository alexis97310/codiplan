import Link from "next/link";

import { Icone } from "@/components/ui/icone";
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
 * **`.l` et `.d` se rendent à 12 px, pas les 11 px de la maquette** — D138
 * (`docs/arbitrages.md`, 29/09/2026) : plancher de 12 px, amende D124 et D95.
 * Le gardien continue de lire 11 px sur la maquette ; c'est l'écart que D138
 * assume.
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
 *
 * ## `href` — LA TUILE CLIQUABLE (D140, TP-UX1-3, commit « tuile cliquable »)
 *
 * D140 (`docs/arbitrages.md:5055-5081`) : « Toutes les tuiles de chiffres sont
 * cliquables, avec un chevron ». La maquette du 28/09 les pose ainsi
 * (`tile()`, :1786-1793) — un `<a class="tile">` plutôt qu'un `<div>` dès
 * qu'un `href` existe, le CHEVRON en dernier (`.t-go`), jamais un second
 * lien accolé sous la tuile. **Sans `href`, le rendu est EXACTEMENT celui
 * d'avant ce commit** (`tests/unit/ui/composants-base.test.tsx` le garde) :
 * une tuile n'est cliquable que si l'appelant lui donne un chemin.
 *
 * `.tile .t-label{padding-right:22px}` (:186) — la place que laisse le
 * chevron sur le libellé, seulement quand il existe. `.tile .t-go{position:
 * absolute;top:15px;right:14px;color:var(--muted-2)}` (:190) puis
 * `a.tile:hover .t-go{color:var(--blue)}` (:191) — `--muted-2` n'a AUCUN
 * jeton (D124 ne le mesure pas ; valeur à fixer par Alexis), le chevron
 * hérite donc de l'encre courante au repos ; au survol, `group-hover:
 * text-app-marque` reprend `--blue`. Filet de 3 px, valeur à 27 px,
 * rembourrage — INCHANGÉS (déjà des écarts assumés à la maquette, voir plus
 * haut).
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
  href,
}: Readonly<{
  ton?: TonKpi;
  libelle: string;
  valeur: React.ReactNode;
  detail?: string;
  /** La liste EXACTE que ce chiffre compte (D140). Absent, la tuile reste inerte. */
  href?: string;
}>) {
  const classesRacine = cn(
    "bg-app-surface border-app-bord relative overflow-hidden rounded-lg border px-[16px] py-[15px] before:absolute before:inset-y-0 before:left-0 before:w-[3px]",
    href !== undefined && "group",
    CLASSES_FILET[ton],
  );
  const contenu = (
    <>
      <div
        className={cn(
          "text-app-encre-faible text-12 font-bold tracking-[0.6px] uppercase",
          href !== undefined && "pr-[22px]",
        )}
      >
        {libelle}
      </div>
      <div className="mt-[4px] mb-[2px] text-[27px] font-extrabold tracking-[-1px] tabular-nums">
        {valeur}
      </div>
      {detail === undefined ? null : (
        <div className="text-app-encre-faible text-12">{detail}</div>
      )}
    </>
  );

  if (href === undefined) {
    return <div className={classesRacine}>{contenu}</div>;
  }

  return (
    <Link href={href} className={classesRacine}>
      {contenu}
      <Icone
        nom="chev-r"
        taille={18}
        className="group-hover:text-app-marque absolute top-[15px] right-[14px]"
      />
    </Link>
  );
}
