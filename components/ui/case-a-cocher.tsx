import { cn } from "@/lib/utils";

/**
 * LA RÈGLE PARTAGÉE DES CASES À 26 PX DU TERRAIN (9L37, décision d'Alexis du
 * 23/11/2026 — « seulement les cases de 26 px, couleurs inchangées »).
 * Exportée ici plutôt que recopiée : `CocheRonde` (`checklist-terrain.tsx`)
 * s'y réfère pour son cercle visuel, afin qu'une seule valeur gouverne les
 * deux cases rondes ou carrées du terrain.
 */
export const CLASSE_CASE_TERRAIN_26PX = "size-[26px]";

/**
 * LA CASE À COCHER DES ÉCRANS DE PARAMÉTRAGE (CG8, constat C-G10).
 *
 * Huit `<input type="checkbox">` natifs, chacun recopié dans son `<label>`,
 * n'offraient sous 768 px qu'une cible de la taille du glyphe rendu par le
 * navigateur — mesurée sous la cible tactile de 44 px que ce constat exige.
 * Cette écriture unique porte la cible sur le `<label>` : `min-h-11 min-w-11`
 * sous 768 px, effacés par `md:min-h-0 md:min-w-0` — le rendu bureau ne
 * change pas. `className` porte les classes de mise en page de l'appelant
 * (`flex items-center gap-…`) et compose avec la cible via `cn`, jamais ne la
 * remplace.
 *
 * Aucune règle de gestion n'est touchée : `name`, `value` et
 * `defaultChecked` sont transmis tels quels, ce que les routes lisaient
 * avant continue de l'être à l'identique.
 *
 * ## `checked`/`onChange` — CONTROLÉE, DEPUIS TP-UX3-1-REGISTRE-2
 *
 * La sélection du registre (`components/ui/barre-selection.tsx`) a besoin
 * d'une case dont l'état COCHÉ vit dans un état React partagé (le compte de
 * la barre de sélection), jamais dans le DOM seul. `checked`/`onChange`
 * s'ajoutent donc, COMPATIBLES : absents, la case reste exactement ce
 * qu'elle était — non contrôlée, `defaultChecked` pour tout état initial.
 *
 * ## `libelleVisible` — LA CASE SANS TEXTE À CÔTÉ, DEPUIS TP-UX3-1-REGISTRE-2
 *
 * Une case de ligne du registre ne porte aucun texte visible — son sens se
 * lit dans la colonne. `libelle` reste OBLIGATOIRE : c'est l'`aria-label`, et
 * sans lui la case resterait muette pour un lecteur d'écran.
 *
 * ## `caseTerrain26px` — LA CASE À 26 PX, TERRAIN SEULEMENT (9L37)
 *
 * Sans glyphe natif dimensionné, une case à cocher nue reste à la taille par
 * défaut du navigateur, sous les 26 px visuels que la fiche terrain épurée
 * exige depuis le 23/11/2026 (décision d'Alexis, « seulement les cases de
 * 26 px, couleurs inchangées »). Ce drapeau pose `size-[26px]` sur l'`<input>`
 * lui-même, JAMAIS par défaut : les huit écrans de paramétrage qui partagent
 * ce composant (CG8) gardent leur rendu actuel à l'identique, intact.
 */
export function CaseACocher({
  name,
  value,
  defaultChecked,
  checked,
  onChange,
  libelle,
  libelleVisible = true,
  className,
  disabled = false,
  caseTerrain26px = false,
}: Readonly<{
  name: string;
  value?: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: () => void;
  libelle: string;
  libelleVisible?: boolean;
  className?: string;
  disabled?: boolean;
  caseTerrain26px?: boolean;
}>) {
  return (
    <label className={cn("min-h-11 min-w-11 md:min-h-0 md:min-w-0", className)}>
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-label={libelleVisible ? undefined : libelle}
        className={caseTerrain26px ? CLASSE_CASE_TERRAIN_26PX : undefined}
      />
      {libelleVisible ? libelle : null}
    </label>
  );
}
