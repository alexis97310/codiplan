import { OptionsAgence, type AgenceOption } from "@/components/agences/options";
import { libelleChampObligatoire } from "@/lib/i18n/obligatoire";

import { aideAgenceUnique, libelleRattachement } from "../presentation";

/**
 * LE CHAMP DE RATTACHEMENT D'UN SITE NEUF (CS41, solde 9EP point 38) —
 * extrait de `/sites/nouveau` pour être éprouvé seul.
 *
 * **Aucune option présélectionnée sous deux agences actives ou plus** (D56) :
 * *« il n'existe aucune valeur par défaut qui ne soit pas un mensonge »*.
 * **Sous une seule agence active, CS41 la présélectionne**, avec l'aide qui
 * le dit — ce n'est alors plus un choix, il n'y a rien d'autre à choisir.
 */
export function ChampRattachement({
  agences,
  agenceGardee,
}: Readonly<{
  readonly agences: readonly AgenceOption[];
  /** La saisie gardée après un refus (CS42) — l'emporte sur la présélection CS41. */
  readonly agenceGardee: string;
}>) {
  const seuleAgenceActive = agences.length === 1 ? agences[0] : undefined;
  const agenceParDefaut =
    agenceGardee !== "" ? agenceGardee : (seuleAgenceActive?.id ?? "");

  return (
    <label className="flex flex-col gap-1 text-13 font-bold">
      {libelleChampObligatoire(libelleRattachement())}
      <select
        name="agence_id"
        required
        defaultValue={agenceParDefaut}
        className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
      >
        <option value="" disabled />
        <OptionsAgence agences={agences} />
      </select>
      {seuleAgenceActive === undefined ? null : (
        <span className="text-app-encre-faible text-12 font-bold">
          {aideAgenceUnique()}
        </span>
      )}
    </label>
  );
}
