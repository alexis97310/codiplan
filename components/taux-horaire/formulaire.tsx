import { t } from "@/lib/i18n/fr";

/**
 * LE FORMULAIRE DE SAISIE D'UNE SUCCESSION DE TAUX (TAUX-1).
 *
 * **Il n'écrit rien à lui seul.** Il pose le montant et la date d'effet ; la
 * route qui le reçoit renvoie vers l'écran de confirmation, qui seul mène à
 * l'écriture — voir `app/api/parametres/taux-horaire/creer/route.ts`.
 */
export function FormulaireTaux({ action }: { readonly action: string }) {
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
        {t("taux_horaire.champ.montant")}
        <input
          name="montant_mineur"
          type="number"
          min={1}
          step={1}
          required
          className={champ}
        />
      </label>
      <label className={etiquette}>
        {t("taux_horaire.champ.date_effet")}
        <input name="date_effet" type="date" required className={champ} />
      </label>
      <div className="sm:col-span-2">
        <button
          type="submit"
          className="bg-app-marque text-app-marque-encre rounded-md px-4 py-1.5 text-[13px] font-semibold"
        >
          {t("taux_horaire.continuer")}
        </button>
      </div>
    </form>
  );
}
