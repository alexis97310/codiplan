import { cn } from "@/lib/utils";

/**
 * LES ICÔNES — SVG maison, aucune dépendance (D139, `docs/arbitrages.md:5029`).
 *
 * ## Une planche, jamais une icône par balise recopiée
 *
 * D139 (29/09/2026) tranche : « des icônes au trait, dessinées pour CODIPLAN,
 * dans le menu et les boutons — aucune bibliothèque ajoutée », servies par CE
 * composant et une planche unique. Les formes sont transcrites depuis
 * `ICONS` de `docs/propositions/ergonomie-2026-09-28/maquette-toutes-pages.html`
 * (:1624-1729, 104 icônes au total) — cette planche n'en porte que celles dont
 * ce dépôt a besoin aujourd'hui : les sept du chevron de tuile, de la bande de
 * décomptes et des messages (TP-UX1-3, commit « composants de base »), les
 * onze du menu (commit « icônes du menu »), puis `globe` — « Portail client »
 * (décision d'Alexis du 30/09/2026, point 15 ; D144 ; voir
 * `components/navigation/barre.tsx`).
 *
 * **Aucune licence n'est écrite pour elles** : la maquette ne nomme qu'une
 * licence, celle de la police Inter (:9) — les icônes elle-même sont un
 * dessin maison, « trait 1,8 — aucune dépendance » (:1623).
 *
 * ## Les valeurs, lues et non approchées
 *
 * `.ico{width:18px;height:18px;...;stroke:currentColor;fill:none;
 * stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}` ; `.ico.s`
 * 16 px, `.ico.lg` 22 px, `.ico.xl` 28 px (:56-57). `ic()` (:1730) pose
 * `aria-hidden="true"` et `focusable="false"` — une icône ne porte jamais son
 * propre sens, elle illustre un libellé déjà lu par ailleurs.
 *
 * **`size-[…px]` plutôt que `w-[…px] h-[…px]`** : c'est la classe que
 * `components/ui/button.tsx` (`[&_svg:not([class*='size-'])]:size-4`)
 * détecte pour NE PAS imposer sa propre taille par défaut — une icône posée
 * dans un bouton garde la taille choisie ici, jamais `size-4` (16 px, la
 * taille shadcn générique).
 */
export type NomIcone =
  | "chev-r"
  | "check"
  | "info"
  | "alert"
  | "alert-circle"
  | "check-circle"
  | "inbox"
  | "home"
  | "calendar"
  | "clipboard"
  | "user-off"
  | "building"
  | "pin"
  | "machine"
  | "shield"
  | "settings"
  | "upload"
  | "phone"
  | "globe"
  | "user"
  | "chart";

/** La liste, à plat — pour un gardien qui itère « chaque icône », jamais une seconde énumération. */
export const NOMS_ICONES: readonly NomIcone[] = [
  "chev-r",
  "check",
  "info",
  "alert",
  "alert-circle",
  "check-circle",
  "inbox",
  "home",
  "calendar",
  "clipboard",
  "user-off",
  "building",
  "pin",
  "machine",
  "shield",
  "settings",
  "upload",
  "phone",
  "globe",
  "user",
  "chart",
];

export type TailleIcone = 16 | 18 | 22 | 28;

const CLASSES_TAILLE: Record<TailleIcone, string> = {
  16: "size-[16px]",
  18: "size-[18px]",
  22: "size-[22px]",
  28: "size-[28px]",
};

/**
 * LA PLANCHE — une forme par icône, transcrite depuis `ICONS` de la maquette.
 *
 * Chacune est le même contour, élément pour élément, attribut pour attribut :
 * `tests/unit/ui/icone.test.tsx` confronte cette planche au document, jamais
 * l'inverse.
 */
const FORMES: Record<NomIcone, React.ReactNode> = {
  "chev-r": <path d="m9 18 6-6-6-6" />,
  check: <path d="M20 6 9 17l-5-5" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 16v-4.5M12 8h.01" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  "alert-circle": (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 7.5v5M12 16h.01" />
    </>
  ),
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  inbox: (
    <>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z" />
    </>
  ),
  home: (
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
      <path d="M16 2.5v4M8 2.5v4M3 10h18" />
    </>
  ),
  clipboard: (
    <>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M8 11h8M8 15h5" />
    </>
  ),
  "user-off": (
    <>
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-1.5A4.5 4.5 0 0 1 7.5 15h3" />
      <path d="m16 15 5 5M21 15l-5 5" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="2.5" width="16" height="19" rx="1.5" />
      <path d="M9 21.5v-4h6v4M8 6.5h2M14 6.5h2M8 10.5h2M14 10.5h2M8 14.5h2M14 14.5h2" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  machine: (
    <>
      <rect x="3" y="7" width="18" height="11" rx="2" />
      <path d="M7 18v3M17 18v3M7 7V4h10v3" />
      <circle cx="12" cy="12.5" r="2.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  upload: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m17 8-5-5-5 5M12 3v12" />
    </>
  ),
  phone: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <path d="M11 18h2" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M2.5 12h19M12 2.5a14.5 14.5 0 0 1 0 19M12 2.5a14.5 14.5 0 0 0 0 19" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </>
  ),
  // « Indicateurs du mois » (9DT-TP-MOD2-INDICATEURS-DONNEES, QT-20) —
  // `chart` de la planche `ICONS` (:1685).
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 6-7" />
    </>
  ),
};

export function Icone({
  nom,
  taille = 18,
  className,
}: Readonly<{
  nom: NomIcone;
  taille?: TailleIcone;
  className?: string;
}>) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      stroke="currentColor"
      fill="none"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(CLASSES_TAILLE[taille], "shrink-0", className)}
    >
      {FORMES[nom]}
    </svg>
  );
}
