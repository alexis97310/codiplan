import type { Fuseau } from "@/lib/calendar/fuseau";
import type { LigneDemande } from "@/lib/demandes/depot";
import type { StatutDemande } from "@/lib/demandes/saisie";
import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import type { MachineDuPortail, SiteDuPortail } from "@/lib/portail/depot";

import {
  dateCourteLocale,
  identifiantDeLaDemande,
  type TempsParEtatPortail,
} from "./presentation";

/**
 * L'ÉCRAN DES DEMANDES DU PORTAIL (9J04-PORTAIL-DEMANDES, CLI-4).
 *
 * **Même gabarit visuel que le reste du portail** (`bg-app-surface
 * border-app-bord rounded-lg`, `text-13 font-bold`) — jamais les composants
 * `Carte`/`Badge`/`ActionPrimaire` du back-office, même décision que
 * `app/(portail)/portail/contacts/vue.tsx`.
 *
 * **Le formulaire ne propose QU'UNE SEULE nature de demande, générique**
 * (CLI-4.2) : aucun champ « type d'intervention » — `Demande` n'en porte
 * aucun, cette distinction n'intervient qu'à la qualification par l'ADV.
 *
 * **Le site n'est JAMAIS saisi en même temps qu'une machine** (CLI-4.1) :
 * les deux champs sont dans le MÊME formulaire, mais la route (`/api/portail
 * /demandes/creer`) ignore le lieu soumis dès qu'une machine est choisie —
 * le site est alors DÉDUIT de cette machine. Ce n'est qu'une cohérence
 * d'écran : la base referme quand même si le lieu soumis sort du périmètre
 * (`WITH CHECK`, D102) — ce n'est jamais la seule garde.
 */

export function ListeDemandes({
  demandes,
  sites,
  machines,
  fuseau,
  idNouvelleDemande,
  tempsParEtatParDemande,
}: {
  readonly demandes: readonly LigneDemande[];
  readonly sites: readonly SiteDuPortail[];
  readonly machines: readonly MachineDuPortail[];
  readonly fuseau: Fuseau;
  readonly idNouvelleDemande: string;
  readonly tempsParEtatParDemande: ReadonlyMap<string, TempsParEtatPortail>;
}) {
  const siteParId = new Map(sites.map((site) => [site.id, site.libelle]));
  const machineParId = new Map(
    machines.map((machine) => [machine.id, machine]),
  );

  return (
    <section className="flex flex-col gap-3">
      <p className="text-app-encre-faible text-13 font-bold">
        {t("portail.demandes.bloc.titre")}
        {t("ponctuation.parenthese_ouvrante")}
        {demandes.length}
        {t("ponctuation.parenthese_fermante")}
      </p>
      {demandes.length === 0 ? (
        <p className="text-[13px] font-bold">{t("portail.demandes.vide")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {demandes.map((demande) => (
            <LigneDemandeVue
              key={demande.id}
              demande={demande}
              siteParId={siteParId}
              machineParId={machineParId}
              fuseau={fuseau}
              tempsParEtat={tempsParEtatParDemande.get(demande.id)}
            />
          ))}
        </ul>
      )}

      <details>
        <summary className="border-app-bord bg-app-surface inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 py-2 text-13 font-bold [&::-webkit-details-marker]:hidden marker:hidden">
          {t("portail.demandes.action.deposer")}
        </summary>
        <div className="mt-2">
          <FormeDemande
            id={idNouvelleDemande}
            sites={sites}
            machines={machines}
          />
        </div>
      </details>
    </section>
  );
}

function LigneDemandeVue({
  demande,
  siteParId,
  machineParId,
  fuseau,
  tempsParEtat,
}: {
  readonly demande: LigneDemande;
  readonly siteParId: ReadonlyMap<string, string>;
  readonly machineParId: ReadonlyMap<string, MachineDuPortail>;
  readonly fuseau: Fuseau;
  readonly tempsParEtat: TempsParEtatPortail | undefined;
}) {
  const machine =
    demande.machine_id === null
      ? undefined
      : machineParId.get(demande.machine_id);
  return (
    <li
      data-demande={demande.id}
      className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3 text-[13px] font-bold"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span>{identifiantDeLaDemande(demande.numero, demande.annee)}</span>
        <span className="text-app-encre-faible">
          {t(
            `demande.statut.${demande.statut}` as `demande.statut.${StatutDemande}`,
          )}
        </span>
        <span className="text-app-encre-faible">
          {dateCourteLocale(demande.depose_le, fuseau)}
        </span>
      </div>
      <div className="text-app-encre-faible flex flex-wrap gap-x-4 gap-y-1 text-12 font-bold">
        <span>
          {mot("site")}
          {t("ponctuation.deux_points")}
          {siteParId.get(demande.site_id) ?? demande.site_id}
        </span>
        <span>
          {machine === undefined
            ? t("portail.demandes.ligne.sans_machine")
            : `${t("portail.machine.serie")}${t("ponctuation.deux_points")}${machine.numeroSerie}`}
        </span>
      </div>
      <p>{demande.description}</p>
      <div className="border-app-bord flex flex-col gap-1.5 border-t pt-2 text-12 font-bold">
        <span className="text-app-encre-faible">
          {t("portail.demandes.temps_par_etat.titre")}
        </span>
        {tempsParEtat === undefined || tempsParEtat.lignes.length === 0 ? (
          <span className="text-app-encre-faible">
            {t("portail.demandes.temps_par_etat.aucune")}
          </span>
        ) : (
          <ul className="flex flex-col gap-1">
            {tempsParEtat.lignes.map((ligne) => (
              <li key={ligne.libelle} className="flex justify-between gap-3">
                <span>
                  {ligne.libelle}
                  {!ligne.enCours ? null : (
                    <>
                      {t("ponctuation.parenthese_ouvrante")}
                      {t("portail.demandes.temps_par_etat.en_cours_suffixe")}
                      {t("ponctuation.parenthese_fermante")}
                    </>
                  )}
                </span>
                <span className="text-app-encre-faible">{ligne.duree}</span>
              </li>
            ))}
          </ul>
        )}
        {tempsParEtat?.indisponibleAvant === undefined ||
        tempsParEtat.indisponibleAvant === null ? null : (
          <span className="text-app-encre-faible">
            {tempsParEtat.indisponibleAvant}
          </span>
        )}
      </div>
    </li>
  );
}

function FormeDemande({
  id,
  sites,
  machines,
}: {
  readonly id: string;
  readonly sites: readonly SiteDuPortail[];
  readonly machines: readonly MachineDuPortail[];
}) {
  return (
    <form
      action="/api/portail/demandes/creer"
      method="post"
      className="border-app-bord bg-app-surface flex flex-col gap-2 rounded-lg border px-3.5 py-3"
    >
      <input type="hidden" name="id" value={id} />

      <label className="flex flex-col gap-1 text-13 font-bold">
        {t("portail.demandes.champ.machine")}
        <select
          name="machine_id"
          defaultValue=""
          className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
        >
          <option value="">{t("portail.demandes.champ.machine.aucune")}</option>
          {machines.map((machine) => (
            <option key={machine.id} value={machine.id}>
              {machine.numeroSerie}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-13 font-bold">
        {t("portail.demandes.champ.site")}
        <select
          name="site_id"
          defaultValue=""
          className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
        >
          <option value="">{t("portail.demandes.champ.site.choisir")}</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.libelle}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-13 font-bold">
        {t("portail.demandes.champ.description")}
        <textarea
          name="description"
          required
          rows={3}
          className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
        />
      </label>

      <div>
        <button
          type="submit"
          className="bg-app-marque text-app-marque-encre rounded-md px-3.5 py-1.5 text-13 font-bold"
        >
          {t("portail.demandes.action.deposer")}
        </button>
      </div>
    </form>
  );
}
