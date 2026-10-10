import { ActionPrimaire } from "@/components/ui/action-primaire";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icone } from "@/components/ui/icone";
import { ROLES_CONTACT, type RoleContact } from "@/lib/contacts/saisie";
import type { FicheContact } from "@/lib/contacts/depot";
import { t } from "@/lib/i18n/fr";
import { CLASSES_LIEN } from "@/lib/theme/apparence";

/**
 * LE BLOC DES INTERLOCUTEURS — partagé par la fiche client et la fiche site
 * (CONTACTS-1), AU GABARIT DE FICHE DU 28/09 (QE-9, QE-13a ;
 * 9EF-TP-UX4-2-FICHES-2, D192).
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
 *
 * ## CE QUI CHANGE AVEC LE GABARIT (D192)
 *
 * Le titre et son compte sont composés UNE SEULE FOIS, ici (`contacts.bloc.
 * titre`) — l'écran appelant ne nomme plus « Contacts » d'un côté et
 * « Interlocuteurs » de l'autre. Téléphone, mobile et courriel sont des liens
 * `tel:`/`mailto:` VISIBLES sans ouvrir la fiche : ils ne vivaient plus dans
 * le `<details>` caché. Le crayon qui ouvre les deux formulaires existants
 * (modifier, activité) est un `<summary>` À LUI SEUL — jamais le reste de la
 * ligne, qui porterait alors de vrais liens dans une zone cliquable pour
 * autre chose.
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

/** Le rôle que `destinataireClient` (`lib/avertissements/planification.ts`) interroge — même valeur, jamais recopiée au hasard. */
const ROLE_DONNEUR_ORDRE: RoleContact = "donneur_ordre";

export function BlocContacts({
  bloc,
  contacts,
  clientId,
  retour,
  siteOptions,
  siteFixe,
  montrerRattachement,
  saisieGardee,
  peutEcrire,
  destinataireId,
}: {
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
  /**
   * LE CONTACT QUE `destinataireClient` A DÉJÀ RETENU (CS45, D165) — `id` du
   * contact qui reçoit les courriels de planification, ou `null` si aucun.
   * CALCULÉ PAR L'ÉCRAN APPELANT, jamais recalculé ici (D192) : ce bloc ne
   * connaît ni le site, ni l'ordre de préséance site/client de
   * `destinataireClient`.
   */
  readonly destinataireId: string | null;
}) {
  return (
    <section
      data-bloc={bloc}
      className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5"
    >
      <h2 className="text-[15px] font-bold">
        {t("contacts.bloc.titre")}
        {t("ponctuation.parenthese_ouvrante")}
        {contacts.length}
        {t("ponctuation.parenthese_fermante")}
      </h2>

      {contacts.length === 0 ? (
        <p className="text-app-encre-faible text-13 font-bold">
          {t("contacts.vide")}
        </p>
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
              estDestinataire={contact.id === destinataireId}
            />
          ))}
        </ul>
      )}

      {peutEcrire ? (
        <details open={saisieGardee !== undefined}>
          <summary className="border-app-bord inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-13 font-bold [&::-webkit-details-marker]:hidden marker:hidden">
            <Icone nom="plus" taille={16} />
            {t("contacts.action.creer")}
          </summary>
          <div className="mt-2">
            <FormeCreationContact
              clientId={clientId}
              retour={retour}
              siteOptions={siteOptions}
              siteFixe={siteFixe}
              saisieGardee={saisieGardee}
            />
          </div>
        </details>
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
  estDestinataire,
}: {
  readonly contact: FicheContact;
  readonly retour: string;
  readonly siteOptions: readonly OptionSite[] | null;
  readonly montrerRattachement: boolean;
  readonly peutEcrire: boolean;
  /** `true` — ce contact est CELUI que `destinataireClient` a retenu (D192). */
  readonly estDestinataire: boolean;
}) {
  const telephoneHref =
    contact.telephone === null
      ? null
      : `tel:${contact.telephone.replaceAll(/\s+/g, "")}`;
  const mobileHref =
    contact.mobile === null
      ? null
      : `tel:${contact.mobile.replaceAll(/\s+/g, "")}`;
  const emailHref = contact.email === null ? null : `mailto:${contact.email}`;
  const estDonneurOrdre = contact.roles.includes(ROLE_DONNEUR_ORDRE);

  return (
    <li
      data-contact={contact.id}
      className="border-app-bord flex flex-col gap-2 rounded-md border px-3 py-2.5"
    >
      <div className="flex items-start gap-2">
        <Avatar identifiant={contact.id} nom={contact.nom} taille={32} />
        <div className="min-w-0 flex-1 break-words text-13 font-bold">
          <div className="flex flex-wrap items-center gap-2">
            <span>{contact.nom}</span>
            {contact.roles.map((role) => (
              <Badge
                key={role}
                ton={role === ROLE_DONNEUR_ORDRE ? "bleu" : "gris"}
              >
                {t(`contact.role.${role}` as `contact.role.${RoleContact}`)}
              </Badge>
            ))}
            {contact.actif ? null : (
              <span className="text-app-encre-faible font-normal">
                {t("contact.inactif")}
              </span>
            )}
          </div>
          {contact.fonction === null ? null : (
            <p className="text-app-encre-faible mt-0.5 font-normal">
              {contact.fonction}
            </p>
          )}
          {montrerRattachement ? (
            <p className="text-app-encre-faible mt-0.5 font-normal">
              {contact.site_id === null
                ? t("contact.rattachement.client")
                : (siteOptions?.find((s) => s.id === contact.site_id)
                    ?.libelle ?? contact.site_id)}
            </p>
          ) : null}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {telephoneHref === null ? null : (
              <a href={telephoneHref} className={CLASSES_LIEN}>
                {contact.telephone}
              </a>
            )}
            {mobileHref === null ? null : (
              <a href={mobileHref} className={CLASSES_LIEN}>
                {contact.mobile}
              </a>
            )}
            {emailHref === null ? null : (
              <a href={emailHref} className={CLASSES_LIEN}>
                {contact.email}
              </a>
            )}
          </div>
          {estDonneurOrdre && contact.actif ? (
            estDestinataire ? (
              <p className="text-app-encre-faible mt-0.5 font-normal">
                {t("contacts.destinataire_courriels")}
              </p>
            ) : contact.email === null ? (
              <p className="text-app-orange-encre mt-0.5 font-normal">
                {t("contacts.destinataire_sans_courriel")}
              </p>
            ) : null
          ) : null}
        </div>
      </div>

      {peutEcrire ? (
        <details>
          <summary
            aria-label={`${t("contacts.action.modifier_fiche")} ${contact.nom}`}
            className="border-app-bord inline-flex size-8 cursor-pointer items-center justify-center rounded-md border [&::-webkit-details-marker]:hidden marker:hidden"
          >
            <Icone nom="edit" taille={16} />
          </summary>

          <div className="mt-2 flex flex-col gap-2 text-13 font-bold">
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
                <ActionPrimaire>{t("contacts.action.modifier")}</ActionPrimaire>
              </div>
            </form>

            <form action={`/api/contacts/${contact.id}/activite`} method="post">
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
          </div>
        </details>
      ) : null}
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
