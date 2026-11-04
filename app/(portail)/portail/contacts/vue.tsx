import type { FicheContact } from "@/lib/contacts/depot";
import { ROLES_CONTACT, type RoleContact } from "@/lib/contacts/saisie";
import { t } from "@/lib/i18n/fr";

/**
 * L'ÉCRAN DES INTERLOCUTEURS DU PORTAIL (9J03-PORTAIL-CONTACTS, CLI-3).
 *
 * **Même gabarit visuel que le reste du portail** (`bg-app-surface
 * border-app-bord rounded-lg`, `text-13 font-bold`) — jamais les composants
 * `Carte`/`Badge`/`ActionPrimaire` du back-office : `app/(portail)/portail/
 * page.tsx` ne les emploie pas non plus, et un écran du portail ne ressemble
 * pas à une fiche interne.
 *
 * **Le choix de site ne propose que `siteOptions`** — les sites du PÉRIMÈTRE
 * du compte connecté (`parcDuClient`, déjà filtré par la politique RLS). Ce
 * n'est qu'une cohérence d'écran : la base referme quand même l'écriture si
 * la valeur soumise sort du périmètre (`WITH CHECK`, D97) — ce n'est jamais
 * la seule garde.
 *
 * **Le courriel est REQUIS, et ce n'est pas arbitraire ici.** Ce formulaire
 * ne soumet jamais `canaux` — comme celui du back-office — et le canal par
 * défaut est `email` (`CANAUX_IMPLEMENTES`, `lib/contacts/saisie.ts`) : CS43
 * exige donc un courriel pour TOUT contact que ce formulaire écrit.
 */

export type OptionSite = { readonly id: string; readonly libelle: string };

export function ListeContacts({
  contacts,
  siteOptions,
}: {
  readonly contacts: readonly FicheContact[];
  readonly siteOptions: readonly OptionSite[];
}) {
  return (
    <section className="flex flex-col gap-3">
      <p className="text-app-encre-faible text-13 font-bold">
        {t("contacts.bloc.titre")}
        {t("ponctuation.parenthese_ouvrante")}
        {contacts.length}
        {t("ponctuation.parenthese_fermante")}
      </p>
      {contacts.length === 0 ? (
        <p className="text-[13px] font-bold">{t("contacts.vide")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {contacts.map((contact) => (
            <LigneContact
              key={contact.id}
              contact={contact}
              siteOptions={siteOptions}
            />
          ))}
        </ul>
      )}

      <details>
        <summary className="border-app-bord bg-app-surface inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 py-2 text-13 font-bold [&::-webkit-details-marker]:hidden marker:hidden">
          {t("contacts.action.creer")}
        </summary>
        <div className="mt-2">
          <FormeContact
            action="/api/portail/contacts/creer"
            siteOptions={siteOptions}
            libelleAction={t("contacts.action.creer")}
          />
        </div>
      </details>
    </section>
  );
}

function LigneContact({
  contact,
  siteOptions,
}: {
  readonly contact: FicheContact;
  readonly siteOptions: readonly OptionSite[];
}) {
  return (
    <li
      data-contact={contact.id}
      className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3 text-[13px] font-bold"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span>{contact.nom}</span>
        <span className="text-app-encre-faible">
          {contact.roles
            .map((role) =>
              t(`contact.role.${role}` as `contact.role.${RoleContact}`),
            )
            .join(t("ponctuation.virgule"))}
        </span>
        {contact.actif ? null : (
          <span className="text-app-encre-faible">{t("contact.inactif")}</span>
        )}
      </div>
      <div className="text-app-encre-faible flex flex-wrap gap-x-4 gap-y-1 text-12 font-bold">
        <span>
          {contact.site_id === null
            ? t("contact.rattachement.client")
            : (siteOptions.find((site) => site.id === contact.site_id)
                ?.libelle ?? contact.site_id)}
        </span>
        {contact.fonction === null ? null : <span>{contact.fonction}</span>}
        {contact.telephone === null ? null : <span>{contact.telephone}</span>}
        {contact.mobile === null ? null : <span>{contact.mobile}</span>}
        {contact.email === null ? null : <span>{contact.email}</span>}
      </div>

      <details>
        <summary
          aria-label={`${t("contacts.action.modifier_fiche")} ${contact.nom}`}
          className="border-app-bord inline-flex w-fit cursor-pointer items-center rounded-md border px-3 py-1 text-12 font-bold [&::-webkit-details-marker]:hidden marker:hidden"
        >
          {t("contacts.action.modifier_fiche")}
        </summary>
        <div className="mt-2">
          <FormeContact
            action={`/api/portail/contacts/${contact.id}/modifier`}
            siteOptions={siteOptions}
            libelleAction={t("contacts.action.modifier")}
            contact={contact}
          />
        </div>
      </details>
    </li>
  );
}

function FormeContact({
  action,
  siteOptions,
  libelleAction,
  contact,
}: {
  readonly action: string;
  readonly siteOptions: readonly OptionSite[];
  readonly libelleAction: string;
  /** Absent à la création : les champs partent alors tous vides. */
  readonly contact?: FicheContact;
}) {
  return (
    <form
      action={action}
      method="post"
      className="border-app-bord bg-app-surface flex flex-col gap-2 rounded-lg border px-3.5 py-3"
    >
      <label className="flex flex-col gap-1 text-13 font-bold">
        {t("contact.rattachement")}
        <select
          name="site_id"
          defaultValue={contact?.site_id ?? ""}
          className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
        >
          <option value="">{t("contact.rattachement.client")}</option>
          {siteOptions.map((site) => (
            <option key={site.id} value={site.id}>
              {site.libelle}
            </option>
          ))}
        </select>
      </label>

      <Champ
        nom="nom"
        libelle={t("contact.nom")}
        valeur={contact?.nom ?? ""}
        requis
      />
      <div className="grid gap-2 md:grid-cols-2">
        <Champ
          nom="fonction"
          libelle={t("contact.fonction")}
          valeur={contact?.fonction ?? ""}
        />
        <Champ
          nom="telephone"
          libelle={t("contact.telephone")}
          valeur={contact?.telephone ?? ""}
        />
        <Champ
          nom="mobile"
          libelle={t("contact.mobile")}
          valeur={contact?.mobile ?? ""}
        />
        <Champ
          nom="email"
          libelle={t("contact.email")}
          valeur={contact?.email ?? ""}
          type="email"
          requis
          aide={t("contact.email.aide")}
        />
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className="text-12 font-bold">{t("contact.roles")}</legend>
        <div className="flex flex-wrap gap-3">
          {ROLES_CONTACT.map((role) => (
            <label
              key={role}
              className="flex items-center gap-1.5 text-13 font-bold"
            >
              <input
                type="checkbox"
                name="roles"
                value={role}
                defaultChecked={contact?.roles.includes(role) ?? false}
              />
              {t(`contact.role.${role}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <button
          type="submit"
          className="bg-app-marque text-app-marque-encre rounded-md px-3.5 py-1.5 text-13 font-bold"
        >
          {libelleAction}
        </button>
      </div>
    </form>
  );
}

function Champ({
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
        className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
      />
      {aide === undefined ? null : (
        <span className="text-app-encre-faible text-12 font-bold">{aide}</span>
      )}
    </label>
  );
}
