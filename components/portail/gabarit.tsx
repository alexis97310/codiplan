/**
 * LE GABARIT PARTAGÉ DES FORMULAIRES DU PORTAIL (I7, 9K06-PORTAIL-COMPTE-
 * TELEPHONE).
 *
 * **Pourquoi `text-base sm:text-[13px]`.** Safari iOS zoome la page à la mise
 * au point de tout champ FOCALISABLE dont la taille de police calculée est
 * sous 16 px — mesuré sur les champs du portail, tous posés en 13 px. Sous
 * 640 px (`sm` de Tailwind), ils passent à 16 px (`text-base`) ; au-delà, la
 * densité de bureau du reste du portail revient.
 *
 * **Pourquoi `min-h-11` sur les boutons et les dépliants.** 44 px est la
 * cible tactile déjà posée ailleurs au portail (`/portail/page.tsx`,
 * `components/ui/choix.tsx`, `components/planning/pose.tsx`) — ce fichier ne
 * l'invente pas, il l'étend aux boutons de formulaire et aux `<summary>`
 * qui ouvrent un dépliant, qui n'avaient reçu ni l'un ni l'autre.
 *
 * **Une classe PARTAGÉE, jamais reprise écran par écran** (§9) : avant ce
 * ticket, `contacts/vue.tsx` et `demandes/vue.tsx` portaient chacun leur
 * propre chaîne de classes, verte aujourd'hui, divergente au premier écran
 * qui l'oublierait.
 */

export const CLASSE_CHAMP_PORTAIL =
  "border-app-bord rounded-md border px-3 py-1.5 text-base sm:text-[13px] font-bold";

export const CLASSE_BOUTON_PORTAIL =
  "bg-app-marque text-app-marque-encre inline-flex min-h-11 items-center justify-center rounded-md px-3.5 py-1.5 text-13 font-bold";

export const CLASSE_DEPLIANT_PORTAIL =
  "border-app-bord bg-app-surface inline-flex min-h-11 w-fit cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 py-2 text-13 font-bold [&::-webkit-details-marker]:hidden marker:hidden";

/** Un champ texte du portail, étiqueté — même gabarit visuel partout. */
export function ChampPortail({
  nom,
  libelle,
  valeur,
  type,
  requis,
  aide,
}: {
  readonly nom: string;
  readonly libelle: string;
  readonly valeur: string;
  readonly type?: string;
  readonly requis?: boolean;
  readonly aide?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-13 font-bold">
      {libelle}
      <input
        name={nom}
        type={type ?? "text"}
        defaultValue={valeur}
        required={requis ?? false}
        className={CLASSE_CHAMP_PORTAIL}
      />
      {aide === undefined ? null : (
        <span className="text-app-encre-faible text-12 font-bold">{aide}</span>
      )}
    </label>
  );
}

/**
 * Un numéro de téléphone AFFICHÉ — toujours en lien `tel:` (I7) : un numéro lu
 * sur un téléphone se compose d'un geste, il ne se recopie pas.
 */
export function LienTelephone({ numero }: { readonly numero: string }) {
  return <a href={`tel:${numero}`}>{numero}</a>;
}
