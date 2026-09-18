import { t } from "@/lib/i18n/fr";
import { ZONES_GEOGRAPHIQUES } from "@/lib/sites/zones";
import { TYPES_FORFAIT } from "@/lib/tarification/forfaits";

/**
 * LE FORMULAIRE D'UN FORFAIT — écrit UNE fois, rendu deux (R2-20).
 *
 * La création et la modification portent **les mêmes champs**, avec les mêmes
 * bornes. Deux formulaires les auraient portés deux fois, et *la seconde
 * écriture d'un même critère diverge en silence* (§9, 01/09) — ici la
 * divergence se serait vue au pire moment : un champ accepté à la création et
 * refusé à la modification, sans que rien ne le dise.
 *
 * ## LES CONDITIONS NE SONT PAS TOUTES OFFERTES, et c'est écrit
 *
 * **Seule la ZONE est saisissable.** La famille de matériel demanderait une
 * liste de familles — et le semis n'en pose aucune (R3-10) ; le type
 * d'intervention est l'axe **inerte** de RG-TAR-06, qu'aucune énumération ne
 * porte encore (L1-06). *Offrir un champ qui ne peut rien contenir est une
 * place réservée, c'est-à-dire une décision prise par personne.*
 *
 * ## « TOUTES LES ZONES » EST UNE VALEUR, PAS UN VIDE
 *
 * L'option est nommée, et elle vaut la chaîne vide — que la route traduit en
 * `null`, seule forme que la base accepte pour « aucune condition ». *Un
 * `<select>` sans option pour ce cas obligerait à deviner qu'il faut ne rien
 * choisir, et le cas majoritaire serait le plus difficile à saisir.*
 */
export function FormulaireForfait({
  action,
  defauts,
}: {
  readonly action: string;
  readonly defauts?: {
    readonly code: string;
    readonly libelle: string;
    readonly type: string;
    readonly rang: number;
    readonly montant_mineur: string;
    readonly zone_geo: readonly string[];
    readonly cumulable_temps: boolean;
    readonly actif: boolean;
  };
}) {
  const champ =
    "border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal";
  const etiquette = "flex flex-col gap-1 text-[12.5px] font-semibold";

  return (
    <form
      method="post"
      action={action}
      className="bg-app-surface border-app-bord grid gap-4 rounded-lg border px-4 py-4 sm:grid-cols-2"
    >
      <label className={etiquette}>
        {t("forfaits.champ.code")}
        <input
          name="code"
          required
          defaultValue={defauts?.code ?? ""}
          className={champ}
        />
      </label>
      <label className={etiquette}>
        {t("forfaits.champ.libelle")}
        <input
          name="libelle"
          required
          defaultValue={defauts?.libelle ?? ""}
          className={champ}
        />
      </label>
      <label className={etiquette}>
        {t("forfaits.champ.type")}
        <select
          name="type"
          required
          defaultValue={defauts?.type ?? ""}
          className={champ}
        >
          <option value="" disabled />
          {TYPES_FORFAIT.map((type) => (
            <option key={type} value={type}>
              {t(`type_forfait.${type}`)}
            </option>
          ))}
        </select>
      </label>
      <label className={etiquette}>
        {t("forfaits.champ.rang")}
        <input
          name="rang"
          type="number"
          min={1}
          step={1}
          required
          defaultValue={defauts?.rang ?? ""}
          className={champ}
        />
      </label>
      <label className={etiquette}>
        {t("forfaits.champ.montant")}
        <input
          name="montant_mineur"
          type="number"
          min={0}
          step={1}
          required
          defaultValue={defauts?.montant_mineur ?? ""}
          className={champ}
        />
      </label>
      <label className={etiquette}>
        {t("forfaits.champ.zone")}
        <select
          name="zone_geo"
          defaultValue={defauts?.zone_geo[0] ?? ""}
          className={champ}
        >
          {/* « Toutes les zones » est une VALEUR nommée — voir l'en-tête. */}
          <option value="">{t("forfaits.champ.zone_aucune")}</option>
          {ZONES_GEOGRAPHIQUES.map((zone) => (
            <option key={zone} value={zone}>
              {t(`zone.${zone}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-[12.5px] font-semibold">
        <input
          name="cumulable_temps"
          type="checkbox"
          defaultChecked={defauts?.cumulable_temps ?? false}
        />
        {t("forfaits.champ.cumulable")}
      </label>
      <label className="flex items-center gap-2 text-[12.5px] font-semibold">
        <input
          name="actif"
          type="checkbox"
          defaultChecked={defauts?.actif ?? true}
        />
        {t("forfaits.champ.actif")}
      </label>
      <div className="sm:col-span-2">
        <button
          type="submit"
          className="bg-app-marque text-app-marque-encre rounded-md px-4 py-1.5 text-[13px] font-semibold"
        >
          {t("forfaits.enregistrer")}
        </button>
      </div>
    </form>
  );
}
