import { ActionPrimaire } from "@/components/ui/action-primaire";
import { Button } from "@/components/ui/button";
import { ROLES_CONTACT, type RoleContact } from "@/lib/contacts/saisie";
import type { FicheContact } from "@/lib/contacts/depot";
import { t } from "@/lib/i18n/fr";

/**
 * LE BLOC DES INTERLOCUTEURS — partagé par la fiche client et la fiche site
 * (CONTACTS-1).
 *
 * **Les rôles rendus viennent de `ROLES_CONTACT`** (`lib/contacts/saisie.ts`),
 * jamais recopiés : la liste close vit à un seul endroit, celui qui la
 * valide.
 *
 * **Aucun canal n'est proposé à la saisie.** `CANAUX_IMPLEMENTES` n'en connaît
 * qu'un — courriel —, et le schéma le pose par défaut : montrer une case pour
 * un canal que rien ne sait servir promettrait un envoi qui ne partira jamais.
 *
 * **`retour` voyage dans chaque formulaire**, caché : c'est le chemin — fiche
 * client ou fiche site — d'où le bloc est rendu, et la route qui reçoit le
 * formulaire y revient telle quelle, saisie refusée comprise.
 */

export type OptionSite = { readonly id: string; readonly libelle: string };

/**
 * LA SAISIE GARDÉE APRÈS UN REFUS (9BR-TP-A4b-MESSAGES, CS46) — ce que
 * `versLeRetour` (`app/api/saisie-recue.ts`) reporte dans l'URL de retour.
 * Aucune coordonnée (courriel, téléphone, mobile) : question ouverte à
 * Alexis, voir la passation — elles sont à retaper.
 */
export type SaisieContactGardee = {
  readonly site_id?: string;
  readonly nom?: string;
  readonly fonction?: string;
  readonly roles?: readonly string[];
};

/**
 * LIT `saisieGardee` DEPUIS LES `searchParams` D'UNE FICHE — même lecture pour
 * la fiche client et la fiche site, jamais deux fois divergentes.
 * `undefined` hors refus, pour que `FormeCreationContact` retombe sur son
 * état vide habituel.
 */
export function saisieContactGardeeDepuis(
  params: Readonly<Record<string, string | string[] | undefined>>,
): SaisieContactGardee | undefined {
  const roleBrut = params.contact_role;
  const roles =
    roleBrut === undefined
      ? undefined
      : Array.isArray(roleBrut)
        ? roleBrut
        : [roleBrut];
  const siteId =
    typeof params.contact_site_id === "string"
      ? params.contact_site_id
      : undefined;
  const nom =
    typeof params.contact_nom === "string" ? params.contact_nom : undefined;
  const fonction =
    typeof params.contact_fonction === "string"
      ? params.contact_fonction
      : undefined;
  if (
    siteId === undefined &&
    nom === undefined &&
    fonction === undefined &&
    roles === undefined
  ) {
    return undefined;
  }
  return { site_id: siteId, nom, fonction, roles };
}

export function BlocContacts({
  titre,
  texteVide,
  bloc,
  contacts,
  clientId,
  retour,
  siteOptions,
  siteFixe,
  montrerRattachement,
  saisieGardee,
  peutEcrire,
}: {
  readonly titre: string;
  readonly texteVide: string;
  /** L'attribut `data-bloc`, pour les épreuves de rendu. */
  readonly bloc: string;
  readonly contacts: readonly FicheContact[];
  readonly clientId: string;
  readonly retour: string;
  /** Non nul sur la fiche CLIENT : le choix du rattachement est ouvert. */
  readonly siteOptions: readonly OptionSite[] | null;
  /** Le site de la fiche, sur la fiche SITE — `siteOptions` vaut alors `null`. */
  readonly siteFixe: string | null;
  /** Faux sur la fiche site : tous ses contacts sont déjà « de ce site ». */
  readonly montrerRattachement: boolean;
  /** Reprise après un refus de saisie (CS46) — absente hors refus. */
  readonly saisieGardee?: SaisieContactGardee;
  /**
   * D153 (03/10/2026, TP-S3, CS31) — un interlocuteur est un attribut du
   * client (CONTACTS-1), même capacité que lui : `gerer_client_site`. Sans
   * ce drapeau, le bloc reste lisible (RM, RS) mais ne rend aucun des trois
   * formulaires que la route refuserait déjà.
   */
  readonly peutEcrire: boolean;
}) {
  return (
    <section
      data-bloc={bloc}
      className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5"
    >
      <h2 className="text-[15px] font-bold">{titre}</h2>

      {contacts.length === 0 ? (
        <p className="text-app-encre-faible text-13 font-bold">{texteVide}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {contacts.map((contact) => (
            <LigneContact
              key={contact.id}
              contact={contact}
              retour={retour}
              siteOptions={siteOptions}
              montrerRattachement={montrerRattachement}
              peutEcrire={peutEcrire}
            />
          ))}
        </ul>
      )}

      {peutEcrire ? (
        <FormeCreationContact
          clientId={clientId}
          retour={retour}
          siteOptions={siteOptions}
          siteFixe={siteFixe}
          saisieGardee={saisieGardee}
        />
      ) : null}
    </section>
  );
}

function LigneContact({
  contact,
  retour,
  siteOptions,
  montrerRattachement,
  peutEcrire,
}: {
  readonly contact: FicheContact;
  readonly retour: string;
  readonly siteOptions: readonly OptionSite[] | null;
  readonly montrerRattachement: boolean;
  readonly peutEcrire: boolean;
}) {
  return (
    <li
      data-contact={contact.id}
      className="border-app-bord rounded-md border px-3 py-2.5"
    >
      <details>
        <summary className="flex flex-wrap items-center gap-2 text-13 font-bold">
          <span>{contact.nom}</span>
          {contact.fonction === null ? null : (
            <span className="text-app-encre-faible font-normal">
              {contact.fonction}
            </span>
          )}
          {contact.roles.map((role) => (
            <span
              key={role}
              className="bg-app-surface-creuse rounded px-1.5 py-0.5 text-12 font-bold"
            >
              {t(`contact.role.${role}` as `contact.role.${RoleContact}`)}
            </span>
          ))}
          {montrerRattachement ? (
            <span className="text-app-encre-faible font-normal">
              {contact.site_id === null
                ? t("contact.rattachement.client")
                : (siteOptions?.find((s) => s.id === contact.site_id)
                    ?.libelle ?? contact.site_id)}
            </span>
          ) : null}
          {contact.actif ? null : (
            <span className="text-app-encre-faible font-normal">
              {t("contact.inactif")}
            </span>
          )}
        </summary>

        <div className="mt-2 flex flex-col gap-2 text-13 font-bold">
          <p className="text-app-encre-faible">
            {[contact.telephone, contact.mobile, contact.email]
              .filter((v): v is string => v !== null)
              .join(t("ponctuation.point_median"))}
          </p>

          {peutEcrire ? (
            <>
              <form
                action={`/api/contacts/${contact.id}/modifier`}
                method="post"
                className="flex flex-col gap-2"
              >
                <input type="hidden" name="retour" value={retour} />
                <ChampContact
                  nom="nom"
                  libelle={t("contact.nom")}
                  valeur={contact.nom}
                />
                <div className="grid gap-2 md:grid-cols-2">
                  <ChampContact
                    nom="fonction"
                    libelle={t("contact.fonction")}
                    valeur={contact.fonction ?? ""}
                  />
                  <ChampContact
                    nom="telephone"
                    libelle={t("contact.telephone")}
                    valeur={contact.telephone ?? ""}
                  />
                  <ChampContact
                    nom="mobile"
                    libelle={t("contact.mobile")}
                    valeur={contact.mobile ?? ""}
                  />
                  <ChampContact
                    nom="email"
                    libelle={t("contact.email")}
                    valeur={contact.email ?? ""}
                    type="email"
                  />
                </div>
                <RolesContact roles={contact.roles} />
                <div>
                  <ActionPrimaire>
                    {t("contacts.action.modifier")}
                  </ActionPrimaire>
                </div>
              </form>

              <form
                action={`/api/contacts/${contact.id}/activite`}
                method="post"
              >
                <input type="hidden" name="retour" value={retour} />
                <input
                  type="hidden"
                  name="actif"
                  value={contact.actif ? "non" : "oui"}
                />
                <Button type="submit" variant="outline" size="sm">
                  {contact.actif
                    ? t("contacts.action.desactiver")
                    : t("contacts.action.activer")}
                </Button>
              </form>
            </>
          ) : null}
        </div>
      </details>
    </li>
  );
}

function FormeCreationContact({
  clientId,
  retour,
  siteOptions,
  siteFixe,
  saisieGardee,
}: {
  readonly clientId: string;
  readonly retour: string;
  readonly siteOptions: readonly OptionSite[] | null;
  readonly siteFixe: string | null;
  readonly saisieGardee?: SaisieContactGardee;
}) {
  return (
    <form
      action="/api/contacts/creer"
      method="post"
      className="border-app-bord flex flex-col gap-2 rounded-md border px-3 py-3"
    >
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="retour" value={retour} />
      {siteOptions === null ? (
        <input type="hidden" name="site_id" value={siteFixe ?? ""} />
      ) : (
        <label className="flex flex-col gap-1 text-13 font-bold">
          {t("contact.rattachement")}
          <select
            name="site_id"
            defaultValue={saisieGardee?.site_id ?? ""}
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
      )}

      <ChampContact
        nom="nom"
        libelle={t("contact.nom")}
        valeur={saisieGardee?.nom ?? ""}
      />
      <div className="grid gap-2 md:grid-cols-2">
        <ChampContact
          nom="fonction"
          libelle={t("contact.fonction")}
          valeur={saisieGardee?.fonction ?? ""}
        />
        <ChampContact
          nom="telephone"
          libelle={t("contact.telephone")}
          valeur=""
        />
        <ChampContact nom="mobile" libelle={t("contact.mobile")} valeur="" />
        <ChampContact
          nom="email"
          libelle={t("contact.email")}
          valeur=""
          type="email"
          aide={t("contact.email.aide")}
        />
      </div>
      <RolesContact roles={saisieGardee?.roles ?? []} />
      <div>
        <ActionPrimaire>{t("contacts.action.creer")}</ActionPrimaire>
      </div>
    </form>
  );
}

function RolesContact({ roles }: { readonly roles: readonly string[] }) {
  return (
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
              defaultChecked={roles.includes(role)}
            />
            {t(`contact.role.${role}`)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ChampContact({
  nom,
  libelle,
  valeur,
  type,
  aide,
}: {
  readonly nom: string;
  readonly libelle: string;
  readonly valeur: string;
  readonly type?: string;
  readonly aide?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-13 font-bold">
      {libelle}
      <input
        name={nom}
        type={type ?? "text"}
        defaultValue={valeur}
        className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
      />
      {aide === undefined ? null : (
        <span className="text-app-encre-faible text-12 font-bold">{aide}</span>
      )}
    </label>
  );
}
