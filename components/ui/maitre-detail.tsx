import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * LE MAÎTRE-DÉTAIL — `.master-detail` de `codiplan-maquette-complete.html`,
 * la disposition liste-à-gauche / fiche-à-droite que D122 adopte comme
 * VOCABULAIRE et que D125 étend à la disposition entière des écrans que la
 * maquette dessine (N-10).
 *
 * ## Les valeurs, lues et non approchées
 *
 * `.master-detail{display:grid;grid-template-columns:minmax(360px,.85fr)
 * minmax(430px,1.15fr);gap:16px}`, repliée à une colonne sous 900px
 * (`@media(max-width:900px)`). Un gardien confronte ces mesures au texte de
 * ce fichier (`tests/unit/ui/composants-maquette.test.ts`).
 *
 * **Le premier écran à l'employer est `/parc`** (N-10) ; `/parc/[id]` ne le
 * touche pas (N-11, une proposition à la fois).
 *
 * ## Deux couleurs REPRISES, jamais ajoutées
 *
 * La ligne sélectionnée de la maquette porte un fond `#f2f8fd` et un liseré
 * `var(--blue)` — deux valeurs que D124 n'a pas mesurées, et que ce ticket ne
 * mesure pas non plus : « aucun jeton de couleur ne bouge » (N-10, §6). Le
 * liseré reprend donc `--app-marque` (c'est `--blue` lui-même, D122) et le
 * fond reprend `--app-bleu-fond`, le jeton pâle le plus proche déjà posé —
 * une approximation ASSUMÉE plutôt qu'un neuvième jeton pour un seul état.
 */
export function MaitreDetail({
  liste,
  apercu,
}: Readonly<{
  liste: React.ReactNode;
  apercu: React.ReactNode;
}>) {
  return (
    <div
      data-bloc="maitre-detail"
      className="grid grid-cols-1 gap-4 min-[901px]:grid-cols-[minmax(360px,.85fr)_minmax(430px,1.15fr)]"
    >
      {liste}
      {apercu}
    </div>
  );
}

/**
 * LA CARTE DE GAUCHE — `.card.machine-list`, avec son `.card-head` propre
 * (15px, `padding:16px 18px`) : une forme DIFFÉRENTE du `.card h2` de
 * `CODIPLAN_Maquette.html` que `Carte` porte déjà (14px, `14px 16px`) — deux
 * fichiers, et ici c'est le second qui dessine ce bloc précis (D125).
 *
 * `max-height:680px;overflow:auto` porte sur la carte ENTIÈRE dans la
 * maquette, en-tête compris : reproduit à l'identique plutôt que raffiné en
 * un en-tête collant qu'elle ne dessine pas.
 */
export function CarteListe({
  titre,
  compte,
  children,
}: Readonly<{
  titre: string;
  compte: string;
  children: React.ReactNode;
}>) {
  return (
    <section
      data-bloc="liste-machines"
      className="bg-app-surface border-app-bord max-h-[680px] overflow-auto rounded-lg border"
    >
      <div className="border-app-bord-faible flex items-center justify-between gap-3 border-b px-[18px] py-[16px]">
        <h2 className="text-[15px] font-bold">{titre}</h2>
        <span className="text-app-encre-faible text-[12px]">{compte}</span>
      </div>
      {children}
    </section>
  );
}

/**
 * UNE LIGNE DU MAÎTRE-DÉTAIL — `.machine-row` : un `<Link>`, jamais un
 * `<button>`. La maquette pose un `<button data-machine="...">` parce que sa
 * sélection vit dans une variable JavaScript ; ici la sélection vit dans
 * l'URL (`/parc?machine=<id>`, tranché par le ticket N-10) — un lien est ce
 * qui MÈNE quelque part, et changer de ligne change bien d'adresse.
 */
export function RangeeMaitreDetail({
  href,
  selectionnee,
  titre,
  sousTitre,
  badge,
}: Readonly<{
  href: string;
  selectionnee: boolean;
  titre: string;
  sousTitre: string;
  badge: React.ReactNode;
}>) {
  return (
    <Link
      href={href}
      aria-current={selectionnee ? "true" : undefined}
      className={cn(
        "border-app-bord-faible bg-app-surface hover:bg-app-bleu-fond grid grid-cols-[1fr_auto] items-center gap-2 border-b px-[16px] py-[14px] text-left",
        selectionnee &&
          "bg-app-bleu-fond shadow-[inset_4px_0_0_0_var(--app-marque)]",
      )}
    >
      <div>
        <h3 className="mb-[4px] text-[14px] font-bold">{titre}</h3>
        <p className="text-app-encre-faible text-[12px]">{sousTitre}</p>
      </div>
      {badge}
    </Link>
  );
}

/**
 * `.card` AVEC SON `.card-head` — `codiplan-maquette-complete.html` (N-11).
 *
 * **Presque un jumeau de `CarteListe` ci-dessus, et c'est délibéré plutôt
 * qu'une négligence.** Les deux mesurent le MÊME `.card-head` de la maquette
 * (15px, `padding:16px 18px`) ; `CarteListe` reste réservée à la carte
 * « Résultats » de `/parc`, que N-11 n'a pas le droit de retoucher (une
 * proposition à la fois). Celle-ci généralise l'en-tête à une ACTION
 * arbitraire — un bouton « + Intervention », pas seulement un compte muet —
 * pour les cartes « Identité et rattachement » et « Historique des
 * interventions » de la fiche machine. *Recopier une forme pour ne pas
 * toucher l'écran qui la porte déjà est la même retenue que `referenceMachine`
 * assume ailleurs dans ce dépôt.*
 */
export function CarteEnTete({
  titre,
  action,
  children,
  /** Le marqueur `data-bloc` — chaque appelant nomme SON bloc (N-11). */
  bloc = "carte-en-tete",
}: Readonly<{
  titre: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  bloc?: string;
}>) {
  return (
    <section
      data-bloc={bloc}
      className="bg-app-surface border-app-bord rounded-lg border"
    >
      <div className="border-app-bord-faible flex items-center justify-between gap-3 border-b px-[18px] py-[16px]">
        <h2 className="text-[15px] font-bold">{titre}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * L'APERÇU DE DROITE — `.detail-hero` puis `.detail-body`.
 *
 * `.machine-symbol` reprend `--radius` (`rounded-lg`, D124) plutôt que le
 * `14px` littéral de la maquette : une coïncidence de valeur, jamais une
 * seconde mesure du même rayon.
 */
export function DetailHero({
  symbole,
  reference,
  titre,
  badge,
  action,
}: Readonly<{
  /** La lettre de `.machine-symbol` — résolue par l'appelant (L0-11). */
  symbole: string;
  reference: string;
  titre: string;
  badge: React.ReactNode;
  action: React.ReactNode;
}>) {
  return (
    <div
      data-bloc="apercu-hero"
      className="border-app-bord flex items-start justify-between gap-4 border-b p-[21px]"
    >
      <div className="flex gap-[13px]">
        <div className="bg-app-bleu-fond text-app-marque grid h-[58px] w-[58px] flex-none place-items-center rounded-lg text-[26px] font-black">
          {symbole}
        </div>
        <div>
          <div className="text-app-encre-faible font-mono text-[12px]">
            {reference}
          </div>
          <h2 className="mt-[3px] mb-[6px] text-[18px] font-extrabold">
            {titre}
          </h2>
          {badge}
        </div>
      </div>
      {action}
    </div>
  );
}

export function DetailBody({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div data-bloc="apercu-kv" className="p-[19px]">
      {children}
    </div>
  );
}

/** `.kv` — deux colonnes, chaque paire séparée par un filet. */
export function Kv({
  children,
  bloc,
}: Readonly<{ children: React.ReactNode; bloc?: string }>) {
  return (
    <dl data-bloc={bloc} className="grid grid-cols-2 gap-x-[18px] gap-y-0">
      {children}
    </dl>
  );
}

export function KvLigne({
  dt,
  dd,
}: Readonly<{ dt: string; dd: React.ReactNode }>) {
  return (
    <div className="border-app-bord-faible border-b py-[11px]">
      <dt className="text-app-encre-faible text-[11px] font-extrabold uppercase">
        {dt}
      </dt>
      <dd className="mt-[3px] font-bold">{dd}</dd>
    </div>
  );
}

/** `.timeline` — la frise verticale des « Derniers événements ». */
export function Timeline({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      data-bloc="apercu-timeline"
      className="border-app-bord mt-[18px] border-l-2 pl-[20px]"
    >
      {children}
    </div>
  );
}

export function TimelineItem({
  titre,
  detail,
}: Readonly<{ titre: string; detail: string }>) {
  return (
    <div className="relative pb-[17px] pl-[13px] last:pb-0">
      <span className="bg-app-marque ring-app-bleu-fond absolute top-[4px] left-[-26px] h-[10px] w-[10px] rounded-full ring-4" />
      <p className="text-[13px] font-bold">{titre}</p>
      <p className="text-app-encre-faible mt-[2px] text-[12px]">{detail}</p>
    </div>
  );
}

/** `.card.empty` — l'état vide du maître-détail, avec son bouton de reprise. */
export function CarteVide({
  titre,
  detail,
  action,
}: Readonly<{
  titre: string;
  detail: string;
  action: React.ReactNode;
}>) {
  return (
    <div
      data-bloc="etat-vide"
      className="bg-app-surface border-app-bord rounded-lg border px-[20px] py-[38px] text-center"
    >
      <b className="mb-[5px] block text-[16px]">{titre}</b>
      <span className="text-app-encre-faible">{detail}</span>
      <div className="mt-[15px]">{action}</div>
    </div>
  );
}
