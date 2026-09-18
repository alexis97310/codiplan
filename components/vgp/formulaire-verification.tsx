import { t } from "@/lib/i18n/fr";
import { ORIGINES_VGP } from "@/lib/vgp/verification";

/**
 * LE FORMULAIRE D'UNE VÉRIFICATION VGP (lot A5+A7, second temps ; D114).
 *
 * ## L'ORIGINE N'A PAS DE DÉFAUT, ET C'EST ÉCRIT DANS LE `<select>`
 *
 * *Une origine par défaut serait une valeur probante inventée* — c'est la
 * phrase qui gouverne `lib/vgp/verification.ts`, reprise ici : l'option vide
 * est `disabled`, jamais choisie silencieusement. Les quatre valeurs sont
 * RATIFIÉES (D114) et lues depuis `ORIGINES_VGP`, jamais recopiées : une
 * cinquième valeur ajoutée un jour par migration apparaît ici d'elle-même.
 *
 * ## CE QUE CE FORMULAIRE NE PORTE PAS
 *
 * Aucun champ de document. `document_id` reste nul depuis cette saisie :
 * aucun sélecteur de document n'existe encore ailleurs dans le dépôt à
 * réutiliser (D88 §9, la classe `client`), et en inventer un ferait de ce
 * ticket un second lot. La ligne s'enregistre sans pièce jointe, comme une
 * `declaration_client` ou une `vignette_constatee` le font légitimement.
 */
export function FormulaireVerification({
  action,
}: {
  readonly action: string;
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
        {t("vgp.verifier.champ.date_verification")}
        <input
          name="date_verification"
          type="date"
          required
          className={champ}
        />
      </label>
      <label className={etiquette}>
        {t("vgp.verifier.champ.origine")}
        <select name="origine" required defaultValue="" className={champ}>
          <option value="" disabled>
            {t("vgp.verifier.champ.origine_aucune")}
          </option>
          {ORIGINES_VGP.map((origine) => (
            <option key={origine} value={origine}>
              {t(`vgp.origine_saisie.${origine}`)}
            </option>
          ))}
        </select>
      </label>
      <label className={etiquette}>
        {t("vgp.verifier.champ.organisme")}
        <input name="organisme" required className={champ} />
      </label>
      <label className={etiquette}>
        {t("vgp.verifier.champ.reference_rapport")}
        <input name="reference_rapport" className={champ} />
      </label>
      <label className={`${etiquette} sm:col-span-2`}>
        {t("vgp.verifier.champ.observations")}
        <textarea name="observations" rows={4} className={champ} />
      </label>
      <div className="sm:col-span-2">
        <button
          type="submit"
          className="bg-app-marque text-app-marque-encre rounded-md px-4 py-1.5 text-[13px] font-semibold"
        >
          {t("vgp.verifier.enregistrer")}
        </button>
      </div>
    </form>
  );
}
