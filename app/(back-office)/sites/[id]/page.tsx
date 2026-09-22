import Link from "next/link";
import { Page } from "@/components/mise-en-page/page";
import { OptionsAgence } from "@/components/agences/options";
import { ActionPrimaire } from "@/components/ui/action-primaire";
import { Button } from "@/components/ui/button";
import { Cellule, Tableau } from "@/components/ui/tableau";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { obtenirSession } from "@/lib/auth/session";
import { dateCivile } from "@/lib/calendar/fuseau";
import { contactsDuSite } from "@/lib/contacts/depot";
import { avecContexteApplicatif } from "@/lib/db/client";
import {
  exigencesDuSite,
  listerHabilitations,
  type LigneExigence,
} from "@/lib/habilitations/depot";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import {
  dernieresInterventionsDuSite,
  type LigneIntervention,
} from "@/lib/interventions/depot";
import { libellesDesSites, lireSite } from "@/lib/sites/depot";
import { ZONES_GEOGRAPHIQUES } from "@/lib/sites/zones";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { CLASSES_STATUT } from "@/lib/theme/statuts";

import { BlocContacts } from "../../contacts/presentation";
import { ouTiret } from "../../presentation";
import { referenceAffichee } from "../../interventions/presentation";
import { libelleRattachement } from "../presentation";

/**
 * LA FICHE D'UN LIEU D'INTERVENTION (L3-16, D75).
 *
 * ## LE REFUS DE D56 EST RENDU ICI, ET IL EST NOMMÉ
 *
 * *« Changer le rattachement sans revoir le temps de trajet est refusé à
 * l'écran avec le message de D56 »* — c'est l'acceptation du ticket. Le refus
 * vient de **deux endroits qui ne se recouvrent pas** : la saisie Zod, qui le
 * rend avec son champ ; et le déclencheur `site_trajet_suit_agence`, qui le
 * rend à l'import Excel et à une correction faite à la main. *Aucun des deux ne
 * remplace l'autre*, et cet écran ne fait que rendre lisible le premier.
 *
 * **Le motif ne nomme ni l'ancien rattachement ni le nouveau** : un refus a le
 * droit d'être lisible, jamais d'être informatif (D50).
 *
 * ## Le temps de trajet ne s'affiche jamais sans son origine
 *
 * Le libellé complet du champ — *« depuis le rattachement »* — est celui du
 * dictionnaire, et l'aide dit ce que la donnée n'est PAS : *elle sert au calcul
 * de charge et aux tournées, jamais à la facturation* (D74). **Un appelant qui
 * l'additionnerait aux heures facturerait le déplacement deux fois.**
 *
 * ## Aucune comparaison de société n'est écrite ici
 *
 * `lireSite` lit sous le contexte cloisonné, et la forme « parc » décide. Une
 * fiche hors périmètre et une fiche inexistante rendent LA MÊME chose — les
 * distinguer ferait un oracle (D35, D50).
 *
 * ## LES EXIGENCES D'HABILITATION (ÉQUIPE-2)
 *
 * `lib/habilitations/affectation.ts` applique RG-PLA-04 depuis L1-04 — un
 * technicien sans l'habilitation BLOQUANTE d'un site est refusé à
 * l'affectation — et `lib/interventions/depot.ts` l'appelle réellement, à
 * l'affectation comme au déplacement. Mais rien ne pouvait déclarer ce qu'un
 * site EXIGE : cette fiche est le seul écran qui connaisse déjà le site
 * concerné, donc le seul endroit d'où la déclaration puisse partir.
 *
 * ## LES DERNIÈRES INTERVENTIONS (HISTORIQUE-SITE-1)
 *
 * *« Qu'est-ce qu'on a déjà fait chez ce client, à cet endroit ? »* — c'est la
 * question qu'on se pose AVANT de planifier, et cette fiche n'y répondait pas :
 * les 1751 interventions d'archive reprises le 22/09/2026 sont rattachées à
 * des sites, et il fallait passer machine par machine. La lecture est BORNÉE
 * CÔTÉ BASE (`dernieresInterventionsDuSite`, sur le modèle de PARC-1 — jamais
 * un `slice` après coup), et la borne est ÉCRITE à côté du tableau. Un lieu
 * sans aucune intervention dit son absence, comme le bloc des habilitations.
 *
 * ## LES INTERLOCUTEURS DU SITE (CONTACTS-1)
 *
 * `contactsDuSite` ne rend QUE les contacts rattachés à CE site — jamais ceux
 * du client sans site, ni ceux d'un autre site du même client : la fiche
 * client, elle, montre tous les interlocuteurs du client. La création fixe
 * `site_id` à celui de cette fiche (champ caché) : depuis cet écran, on ne
 * saisit jamais un contact « du client » par erreur.
 */

/** Combien d'interventions la fiche montre. Une borne d'affichage, jamais un cloisonnement. */
const INTERVENTIONS_MONTREES = 12;

export default async function PageSite({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }

  const { id } = await params;
  const motif = (await searchParams).motif;
  const site = await lireSite(session.contexte, id);
  if (site === null) {
    notFound();
  }
  const libelles = await libellesDesSites(session.contexte, [site]);
  // Les agences de la société, pour que le rattachement soit MODIFIABLE : sans
  // cela, l'exigence de D56 serait vraie et inatteignable depuis cet écran.
  const agences = await avecContexteApplicatif(session.contexte, (tx) =>
    tx.agence.findMany({
      select: { id: true, libelle: true, code: true },
      orderBy: [{ libelle: "asc" }, { id: "asc" }],
    }),
  );
  const exigences = await exigencesDuSite(session.contexte, site.id);
  const habilitations = (await listerHabilitations(session.contexte)).filter(
    (habilitation) => habilitation.actif,
  );
  const contacts = await contactsDuSite(session.contexte, site.id);
  const interventions = await dernieresInterventionsDuSite(
    session.contexte,
    site.id,
    INTERVENTIONS_MONTREES,
  );

  return (
    <Page
      chemin="/sites"
      titre={site.libelle}
      sousTitre={libelles.clients.get(site.client_id) ?? ""}
      actions={
        <Link href="/sites" className="text-app-encre-faible text-[12.5px]">
          {t("sites.retour")}
        </Link>
      }
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          data-motif={motif}
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(motif)}
        </p>
      ) : null}

      <form
        method="post"
        action={`/api/sites/${site.id}/modifier`}
        className="bg-app-surface border-app-bord flex flex-col gap-4 rounded-lg border px-4 py-4"
      >
        <Champ
          nom="libelle"
          libelle={t("site.libelle")}
          valeur={site.libelle}
        />
        <Champ
          nom="commune"
          libelle={t("site.commune")}
          valeur={site.commune ?? ""}
        />

        <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
          {t("site.zone_geo")}
          <select
            name="zone_geo"
            defaultValue={site.zone_geo ?? ""}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
          >
            <option value="" />
            {ZONES_GEOGRAPHIQUES.map((zone) => (
              <option key={zone} value={zone}>
                {t(`site.zone.${zone}`)}
              </option>
            ))}
          </select>
        </label>

        {/*
          LE RATTACHEMENT ET LE TEMPS DE TRAJET SONT CÔTE À CÔTE, et ce n'est
          pas une disposition : *un nombre dont la signification dépend d'une
          autre colonne ne voyage jamais seul* (D56). Les séparer à l'écran
          ferait saisir l'un sans voir l'autre, c'est-à-dire exactement la faute
          que le refus attrape ensuite.
        */}
        <div className="border-app-bord grid gap-4 rounded-md border px-3.5 py-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-[12.5px] font-semibold md:col-span-2">
            {libelleRattachement()}
            <select
              name="agence_id"
              defaultValue={site.agence_id}
              className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
            >
              <OptionsAgence agences={agences} />
            </select>
          </label>
          <Champ
            nom="temps_trajet_min"
            libelle={t("site.temps_trajet_min")}
            valeur={
              site.temps_trajet_min === null
                ? ""
                : String(site.temps_trajet_min)
            }
            aide={t("site.temps_trajet_min.aide")}
          />
        </div>

        <Champ
          nom="consignes_acces"
          libelle={t("site.consignes_acces")}
          valeur={site.consignes_acces ?? ""}
        />

        <div>
          <ActionPrimaire>{t("sites.action.modifier")}</ActionPrimaire>
        </div>
      </form>

      <BlocExigences
        siteId={site.id}
        exigences={exigences}
        habilitations={habilitations}
      />

      <BlocContacts
        bloc="contacts-site"
        titre={t("sites.fiche.contacts")}
        texteVide={t("sites.fiche.contacts_vide")}
        contacts={contacts}
        clientId={site.client_id}
        retour={`/sites/${site.id}`}
        siteOptions={null}
        siteFixe={site.id}
        montrerRattachement={false}
      />

      <BlocInterventions
        interventions={interventions}
        borne={INTERVENTIONS_MONTREES}
      />
    </Page>
  );
}

function Champ({
  nom,
  libelle,
  valeur,
  aide,
}: Readonly<{
  nom: string;
  libelle: string;
  valeur: string;
  aide?: string;
}>) {
  return (
    <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
      {libelle}
      <input
        name={nom}
        defaultValue={valeur}
        className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
      />
      {aide === undefined ? null : (
        <span className="text-app-encre-faible text-[11px] font-normal">
          {aide}
        </span>
      )}
    </label>
  );
}

/**
 * LES EXIGENCES D'HABILITATION DE CE SITE (ÉQUIPE-2).
 *
 * « Bloquant » retire le technicien du choix à l'affectation ; non bloquant
 * n'avertit qu'après coup — c'est tout RG-PLA-04, et cet écran ne fait que le
 * DÉCLARER, jamais le juger : `lib/habilitations/affectation.ts` reste seul à
 * décider, à l'affectation comme au déplacement.
 */
function BlocExigences({
  siteId,
  exigences,
  habilitations,
}: {
  readonly siteId: string;
  readonly exigences: readonly LigneExigence[];
  readonly habilitations: readonly {
    readonly id: string;
    readonly code: string;
    readonly libelle: string;
  }[];
}) {
  return (
    <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
      <h2 className="text-[14px] font-bold">{t("habilitations.site.titre")}</h2>

      {exigences.length === 0 ? (
        <p className="text-app-encre-faible text-[12.5px]">
          {t("habilitations.site.aucune")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {exigences.map((exigence) => (
            <li
              key={exigence.id}
              className="flex flex-wrap items-center gap-2 text-[12.5px]"
            >
              <span className="font-mono font-bold">{exigence.code}</span>
              <span className="text-app-encre-faible">{exigence.libelle}</span>
              <span
                className={
                  exigence.bloquant
                    ? "text-app-rouge-encre font-semibold"
                    : "text-app-encre-faible"
                }
              >
                {exigence.bloquant
                  ? t("habilitations.site.bloquant")
                  : t("habilitations.site.avertissement")}
              </span>
              <form
                action={`/api/habilitations/exigences/${exigence.id}/retirer`}
                method="post"
              >
                <input type="hidden" name="site_id" value={siteId} />
                <Button type="submit" variant="outline" size="sm">
                  {t("habilitations.retirer")}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {habilitations.length === 0 ? (
        <p className="text-app-encre-faible text-[12px]">
          {t("habilitations.site.rien_a_exiger")}
        </p>
      ) : (
        <form
          action="/api/habilitations/exigences/creer"
          method="post"
          className="flex flex-wrap items-end gap-2"
        >
          <input type="hidden" name="site_id" value={siteId} />
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`${siteId}-habilitation`}
              className="text-app-encre-faible text-[11px]"
            >
              {t("habilitations.site.exiger")}
            </label>
            <select
              id={`${siteId}-habilitation`}
              name="habilitation_id"
              required
              defaultValue=""
              className="border-app-bord bg-app-surface min-w-44 rounded-md border px-2 py-1 text-[12.5px]"
            >
              <option value="" disabled>
                {t("habilitations.site.choisir")}
              </option>
              {habilitations.map((habilitation) => (
                <option key={habilitation.id} value={habilitation.id}>
                  {habilitation.code}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-1.5 pb-1 text-[12.5px]">
            <input type="checkbox" name="bloquant" defaultChecked />
            {t("habilitations.site.bloquant_case")}
          </label>
          <Button type="submit" variant="outline" size="sm">
            {t("habilitations.site.exiger_action")}
          </Button>
        </form>
      )}
    </section>
  );
}

/**
 * LES DERNIÈRES INTERVENTIONS DE CE SITE (HISTORIQUE-SITE-1).
 *
 * Les colonnes sont celles déjà servies pour une ligne de planning sur la
 * fiche client — référence, date, type, statut —, moins le lieu : c'est le
 * titre de cette page. **La borne est écrite**, avec son nombre, parce qu'un
 * tableau qui s'arrête sans le dire se lit comme « c'est tout ». **Un site sans
 * aucune intervention n'affiche pas un tableau vide** : il le dit, comme
 * `habilitations.site.aucune` juste au-dessus (D88).
 */
function BlocInterventions({
  interventions,
  borne,
}: {
  readonly interventions: readonly LigneIntervention[];
  readonly borne: number;
}) {
  const colonnes = [
    {
      cle: "reference",
      libelle: t("intervention.reference"),
      largeur: "160px",
    },
    { cle: "date", libelle: t("intervention.date"), largeur: "140px" },
    { cle: "type", libelle: t("intervention.type") },
    { cle: "statut", libelle: t("intervention.statut"), largeur: "170px" },
  ];
  return (
    <section
      data-bloc="historique-site"
      className="bg-app-surface border-app-bord overflow-hidden rounded-lg border"
    >
      <div className="border-app-bord flex flex-col gap-0.5 border-b px-4 py-3">
        <h2 className="text-[14px] font-bold">
          {t("sites.fiche.interventions")}
        </h2>
        {interventions.length === 0 ? null : (
          <p className="text-app-encre-faible text-[12px]">
            {borneEcrite(borne)}
          </p>
        )}
      </div>
      {interventions.length === 0 ? (
        <p className="text-app-encre-faible px-4 py-3 text-[12.5px]">
          {t("sites.fiche.interventions_vide")}
        </p>
      ) : (
        <Tableau colonnes={colonnes} minimum="640px">
          {interventions.map((ligne) => (
            <tr key={ligne.id}>
              <Cellule mono>
                <Link
                  href={`/interventions/${ligne.id}`}
                  className={CLASSES_LIEN}
                >
                  {referenceAffichee(ligne)}
                </Link>
              </Cellule>
              <Cellule>
                {ligne.date_planifiee === null
                  ? ouTiret(null)
                  : dateCivile(ligne.date_planifiee)}
              </Cellule>
              <Cellule>{t(`type_intervention.${ligne.type}`)}</Cellule>
              <Cellule>
                <span
                  className={`${CLASSES_STATUT[ligne.statut]} rounded px-1.5 py-0.5 text-[11px] font-bold`}
                >
                  {t(`statut.${ligne.statut}`)}
                </span>
              </Cellule>
            </tr>
          ))}
        </Tableau>
      )}
    </section>
  );
}

/** « Au plus 12 interventions, … » — le nombre est composé par l'écran, jamais écrit dans le dictionnaire. */
function borneEcrite(borne: number): string {
  return `${t("sites.fiche.interventions_borne_prefixe")} ${borne} ${t("sites.fiche.interventions_borne_suffixe")}`;
}
