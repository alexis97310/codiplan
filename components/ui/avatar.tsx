import { initialesDuNom } from "@/lib/navigation/initiales";
import { cn } from "@/lib/utils";

/**
 * L'AVATAR — `.av` de la maquette du 28/09 (`avatar()`, :1763), posé pour la
 * première fois ici (9EC-TP-UX3-E-ABSENCES, constat 11) ; `Avatar` et
 * `AvatarClaire` de `components/navigation/barre.tsx` restent LOCAUX à la
 * barre, territoire de 9DU, et ce composant ne les touche pas.
 *
 * ## UNE TEINTE PAR PERSONNE, STABLE (décision 28 du pilote, 05/10/2026)
 *
 * La maquette peint l'avatar en blanc sur une couleur pleine (`color:#fff`,
 * :384) — huit couleurs choisies par `t.color`, une DONNÉE de démonstration
 * que ce dépôt n'a pas. Alexis tranche : une teinte par personne, calculée
 * depuis son identifiant (hachage simple, déterministe — même identifiant,
 * même teinte, à chaque rendu), parmi une liste FERMÉE de jetons EXISTANTS
 * (`app/globals.css`), jamais une couleur nouvelle (D124). Le rouge en est
 * exclu — il porte déjà deux sens, la marque et l'alerte
 * (`components/ui/action-primaire.tsx`) — et le gris reste réservé à une
 * personne inconnue, jamais tiré au hasard dans la liste.
 *
 * ## Les valeurs, lues et non approchées
 *
 * `.av{width:28px;height:28px;border-radius:50%;...font-size:12px;
 * font-weight:850}` (:384) — `850` n'a pas de classe Tailwind, `font-extrabold`
 * (800) est la plus proche, le même écart que `Page` accepte déjà pour
 * `.eyebrow`.
 *
 * **`24px` PORTE `text-12`, PAS `text-[11px]`** — D138 (plancher de 12 px,
 * `docs/arbitrages.md`, 29/09/2026) : aucune taille de ce dépôt ne descend
 * sous ce plancher, quelle que soit la taille de la pastille qui la porte.
 */
export type TailleAvatar = 24 | 28 | 32;

const CLASSES_TAILLE: Record<TailleAvatar, string> = {
  24: "size-[24px] text-12 font-extrabold",
  28: "size-[28px] text-12 font-extrabold",
  32: "size-[32px] text-13 font-extrabold",
};

/** Liste FERMÉE — bleu, vert, orange, violet. Rouge exclu (danger) ; gris réservé à « personne inconnue ». */
const TEINTES_PERSONNE = ["bleu", "vert", "orange", "violet"] as const;
export type TeintePersonne = (typeof TEINTES_PERSONNE)[number];

const CLASSES_TEINTE: Record<TeintePersonne, string> = {
  bleu: "bg-app-bleu-fond text-app-bleu-encre",
  vert: "bg-app-vert-fond text-app-vert-encre",
  orange: "bg-app-orange-fond text-app-orange-encre",
  violet: "bg-app-violet-fond text-app-violet-encre",
};

const CLASSE_PERSONNE_INCONNUE = "bg-app-gris-fond text-app-gris-encre";

/**
 * LA TEINTE D'UNE PERSONNE — un hachage simple, déterministe : même
 * identifiant, même teinte, à chaque rendu, quel que soit l'écran qui
 * l'affiche.
 */
export function teintePersonne(identifiant: string): TeintePersonne {
  let somme = 0;
  for (let index = 0; index < identifiant.length; index += 1) {
    somme = (somme + identifiant.charCodeAt(index)) % TEINTES_PERSONNE.length;
  }
  return TEINTES_PERSONNE[somme];
}

export function Avatar({
  identifiant,
  nom,
  taille = 28,
}: Readonly<{
  /** `null` — « personne inconnue » (teinte grise), jamais un hachage sur une chaîne vide. */
  identifiant: string | null;
  nom: string | null | undefined;
  taille?: TailleAvatar;
}>) {
  const initiales = initialesDuNom(nom) ?? "";
  const classesTeinte =
    identifiant === null
      ? CLASSE_PERSONNE_INCONNUE
      : CLASSES_TEINTE[teintePersonne(identifiant)];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full tracking-[0.02em]",
        CLASSES_TAILLE[taille],
        classesTeinte,
      )}
    >
      {initiales}
    </span>
  );
}
