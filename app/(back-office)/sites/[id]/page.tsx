import type { Metadata } from "next";

import Link from "next/link";
import { Page } from "@/components/mise-en-page/page";
import { OptionsAgence } from "@/components/agences/options";
import { ActionPrimaire, LienPrimaire } from "@/components/ui/action-primaire";
import { Badge, type TonBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cellule, Tableau } from "@/components/ui/tableau";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { z } from "zod";

import type { ContexteSession } from "@/lib/auth/contexte";
import { peut } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import {
  dateCivile,
  instantDuJour,
  jourDe,
  maintenant,
  schemaFuseau,
} from "@/lib/calendar/fuseau";
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
  interventionsOuvertesDuSite,
  type LigneIntervention,
} from "@/lib/interventions/depot";
import {
  equipementsActifsDuSite,
  EQUIPEMENTS_PAR_PAGE_SITE,
  type LigneEquipementSite,
} from "@/lib/machines/depot";
import { libellesDesSites, lireSite } from "@/lib/sites/depot";
import { ZONES_GEOGRAPHIQUES } from "@/lib/sites/zones";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { CLASSES_STATUT } from "@/lib/theme/statuts";
import { prochaineEcheanceDuSite } from "@/lib/vgp/registre";

import { Pagination } from "@/components/ui/pagination";

import { BlocContacts } from "../../contacts/presentation";
import {
  decompte,
  hrefDeLaPage,
  libellePage,
  ouTiret,
} from "../../presentation";
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

/** `page` du bloc « Équipements du site » — un entier d'au moins 1, comme sur `/clients/[id]`. */
const schemaPage = z.coerce.number().int().min(1).catch(1);

/**
 * MÉMOÏSÉE PAR REQUÊTE (VISUEL-1, 23/09/2026) — voir le même commentaire sur
 * `lireClientCache` dans `app/(back-office)/clients/[id]/page.tsx`.
 */
const lireSiteCache = cache((contexte: ContexteSession, id: string) =>
  lireSite(contexte, id),
);

/** MÊME MÉMOÏSATION, POUR LA SESSION — voir `clients/[id]/page.tsx`. */
const sessionCache = cache(async () => obtenirSession(await headers()));

/** LE TITRE D'ONGLET PORTE LE NOM DU LIEU (VISUEL-1) — voir `clients/[id]`. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const session = await sessionCache();
  if (session === null || session.contexte.societeId === null) {
    return { title: t("vocabulaire.site.pluriel") };
  }
  const { id } = await params;
  const site = await lireSiteCache(session.contexte, id);
  return { title: site?.libelle ?? t("vocabulaire.site.pluriel") };
}

export default async function PageSite({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await sessionCache();
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }

  const { id } = await params;
  const paramsResolus = await searchParams;
  const motif = paramsResolus.motif;
  const site = await lireSiteCache(session.contexte, id);
  if (site === null) {
    notFound();
  }
  // `page` — LE BLOC « ÉQUIPEMENTS DU SITE » (FICHE-360-1), la seule
  // pagination de cette fiche.
  const page = schemaPage.parse(
    typeof paramsResolus.page === "string" ? paramsResolus.page : undefined,
  );
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

  // LA SYNTHÈSE EN TÊTE (FICHE-360-1) — uniquement des faits déjà en base :
  // équipements du site, interventions ouvertes, dernière intervention (déjà
  // lue ci-dessus, `interventions[0]`, triée « la plus récente en premier »),
  // et la prochaine échéance VGP SI le registre la connaît déjà.
  const equipements = await equipementsActifsDuSite(
    session.contexte,
    site.id,
    page,
  );
  const interventionsOuvertes = await interventionsOuvertesDuSite(
    session.contexte,
    site.id,
  );
  // LE FUSEAU EST UNE DONNÉE, JAMAIS UN LITTÉRAL (L0-08) — même lecture que
  // `/vgp` : l'échéance déduite est une `@db.Date`, posée à minuit UTC, et la
  // comparer à l'instant plutôt qu'à la civile du jour ferait tomber une
  // échéance du jour même sous zéro dès que l'horloge dépasse minuit UTC.
  const societe = await avecContexteApplicatif(session.contexte, (tx) =>
    tx.societe.findFirst({
      where: { id: session.contexte.societeId as string },
      select: { fuseau_horaire: true },
    }),
  );
  const fuseau = schemaFuseau.parse(societe?.fuseau_horaire);
  const aujourdHui = instantDuJour(jourDe(maintenant(fuseau).local));
  const prochaineVgp = await prochaineEcheanceDuSite(
    session.contexte,
    site.id,
    aujourdHui,
  );

  // CONTRAT-SITE-1 — la MÊME capacité que le reste de la modification du site,
  // lue depuis la matrice (`peut(role, capacité)`), jamais une comparaison de
  // rôle inventée ici : un rôle qui ne peut pas modifier la fiche ne voit pas
  // la case active, exactement comme `peutQualifierAffecter` le fait déjà sur
  // la fiche intervention.
  const peutModifierSite =
    session.contexte.role !== null &&
    peut(session.contexte.role, "gerer_client_site");
  // LES ACTIONS EN CONTEXTE (FICHE-360-1) — visibles selon les MÊMES
  // capacités que les routes qu'elles ouvrent (`exigerCapacite` de
  // `app/api/interventions/creer/route.ts` et `app/api/machines/creer/route.ts`).
  const peutCreerIntervention =
    session.contexte.role !== null &&
    peut(session.contexte.role, "creer_demande");
  const peutGererMachine =
    session.contexte.role !== null &&
    peut(session.contexte.role, "gerer_machine");

  return (
    <Page
      chemin="/sites"
      titre={site.libelle}
      // FIL D'ARIANE (FICHE-360-1) — `Clients › <client> › <site>`. Le
      // client hors périmètre n'aurait pas de libellé (`libellesDesSites` lit
      // sous le même contexte cloisonné), mais un site lu ici a déjà un
      // client lisible par construction (clé étrangère `(societe_id,
      // client_id)`, voir `lib/sites/depot.ts`).
      filAriane={[
        { libelle: t("fil_ariane.clients"), href: "/clients" },
        {
          libelle: libelles.clients.get(site.client_id) ?? "",
          href: `/clients/${site.client_id}`,
        },
        { libelle: site.libelle },
      ]}
      // LE CLIENT MÈNE À SA FICHE (LIENS-1) — même raisonnement que les liens
      // ajoutés ailleurs par ce ticket : `site.client_id` est déjà lu ici, et
      // un client hors périmètre ne serait pas lu par `libellesDesSites` non
      // plus (le lien mènerait alors au même refus que partout, D35, D50).
      sousTitre={
        <Link href={`/clients/${site.client_id}`} className={CLASSES_LIEN}>
          {libelles.clients.get(site.client_id) ?? ""}
        </Link>
      }
      actions={
        <>
          {peutCreerIntervention ? (
            <LienPrimaire href={`/interventions/nouvelle?site=${site.id}`}>
              {t("sites.action.ajouter_intervention")}
            </LienPrimaire>
          ) : null}
          {peutGererMachine ? (
            <LienPrimaire
              href={`/parc/nouvelle?client=${site.client_id}&site=${site.id}`}
            >
              {t("sites.action.ajouter_machine")}
            </LienPrimaire>
          ) : null}
          <Link href="/sites" className="text-app-encre-faible text-[12.5px]">
            {t("sites.retour")}
          </Link>
        </>
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

      <BlocSyntheseSite
        equipements={equipements.total}
        interventionsOuvertes={interventionsOuvertes}
        derniereIntervention={interventions[0] ?? null}
        prochaineVgp={prochaineVgp}
      />

      {/* L'ÉTAT EN LECTURE (CONTRAT-SITE-1) — visible de TOUT rôle qui
          atteint la fiche, à la différence de la case ci-dessous : « Sous
          contrat de maintenance » quand c'est vrai, RIEN quand ce ne l'est
          pas — jamais un « Non » ou un tiret sous un fait qui n'a rien à
          dire. */}
      {site.sous_contrat ? (
        <p className="text-[12.5px]">
          <Badge ton="orange">{t("site.sous_contrat")}</Badge>
        </p>
      ) : null}

      <BlocEquipements
        equipements={equipements.lignes}
        total={equipements.total}
        page={page}
        siteId={site.id}
        peutCreerIntervention={peutCreerIntervention}
      />

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

        {/* LA CASE ACTIVE (CONTRAT-SITE-1) — n'existe dans le formulaire que
            pour un rôle qui peut modifier la fiche : `peutModifierSite` lit
            la MÊME capacité que la route POST. Un rôle sans elle ne voit donc
            jamais une case qu'il ne pourrait pas soumettre. */}
        {peutModifierSite ? (
          <label className="flex items-center gap-1.5 text-[12.5px] font-medium">
            {/* LA SENTINELLE DÉCOCHÉE — une case à cocher DÉCOCHÉE n'envoie
                RIEN dans `FormData`, à la différence de tout autre champ de
                ce formulaire. Sans ce champ caché, décocher la case et
                enregistrer laisserait `sous_contrat` absent de la requête,
                et la route le lirait comme « ne touche pas à cette colonne »
                — exactement l'inverse du geste posé. */}
            <input type="hidden" name="sous_contrat" value="0" />
            <input
              type="checkbox"
              name="sous_contrat"
              value="1"
              defaultChecked={site.sous_contrat}
            />
            {t("site.sous_contrat")}
          </label>
        ) : null}

        <div>
          <ActionPrimaire>{t("sites.action.modifier")}</ActionPrimaire>
        </div>
      </form>
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
 * LA SYNTHÈSE EN TÊTE (FICHE-360-1) — uniquement des faits déjà en base ;
 * un compteur inconnu s'écrit « — », jamais 0 (le même principe que
 * `ouTiret`, D88). `data-compteur` donne une prise stable à une épreuve de
 * bout en bout, comme `CarteEntite` le fait déjà pour les cartes de liste.
 */
function BlocSyntheseSite({
  equipements,
  interventionsOuvertes,
  derniereIntervention,
  prochaineVgp,
}: Readonly<{
  equipements: number;
  interventionsOuvertes: number;
  derniereIntervention: LigneIntervention | null;
  prochaineVgp: Date | null;
}>) {
  return (
    <div
      data-bloc="synthese-site"
      className="bg-app-surface border-app-bord flex flex-wrap gap-6 rounded-lg border px-4 py-3.5"
    >
      <div data-compteur="equipements">
        <b className="block text-[16px] font-bold">{equipements}</b>
        <span className="text-app-encre-faible text-[11px]">
          {t("sites.fiche.synthese.equipements")}
        </span>
      </div>
      <div data-compteur="interventions-ouvertes">
        <b className="block text-[16px] font-bold">{interventionsOuvertes}</b>
        <span className="text-app-encre-faible text-[11px]">
          {t("sites.fiche.synthese.interventions_ouvertes")}
        </span>
      </div>
      <div data-compteur="derniere-intervention">
        <b className="block text-[16px] font-bold">
          {derniereIntervention === null ? (
            ouTiret(null)
          ) : (
            <Link
              href={`/interventions/${derniereIntervention.id}?depuis=site`}
              className={CLASSES_LIEN}
            >
              {derniereIntervention.date_planifiee === null
                ? ouTiret(null)
                : dateCivile(derniereIntervention.date_planifiee)}
              {t("ponctuation.point_median")}
              {t(`type_intervention.${derniereIntervention.type}`)}
            </Link>
          )}
        </b>
        <span className="text-app-encre-faible text-[11px]">
          {t("sites.fiche.synthese.derniere_intervention")}
        </span>
      </div>
      <div data-compteur="vgp-prochaine">
        <b className="block text-[16px] font-bold">
          {prochaineVgp === null ? ouTiret(null) : dateCivile(prochaineVgp)}
        </b>
        <span className="text-app-encre-faible text-[11px]">
          {t("sites.fiche.synthese.vgp_prochaine")}
        </span>
      </div>
    </div>
  );
}

/**
 * LES TONS DE STATUT D'UNE MACHINE — recopiés de `TONS_STATUT`
 * (`app/(back-office)/parc/[id]/page.tsx`), jamais une seconde palette : les
 * trois statuts ACTIFS (`equipementsActifsDuSite` exclut les trois autres)
 * gardent le même ton qu'ailleurs dans le parc.
 */
const TON_STATUT_MACHINE: Record<string, TonBadge> = {
  en_service: "vert",
  en_panne: "rouge",
  arretee: "orange",
  remplacee: "gris",
  ferraillee: "gris",
  fusionnee: "gris",
};

/** Recopié de `statutAffiche` (`/parc`) — même dictionnaire, même repli. */
function statutMachineAffiche(statut: string): string {
  const cle = `statut_machine.${statut}`;
  return estCleTraduction(cle) ? t(cle) : statut;
}

/**
 * LES ÉQUIPEMENTS DU SITE (FICHE-360-1) — le constat qui ouvre le ticket :
 * *« depuis un site on ne voit pas ses machines »*. Seules les machines
 * ACTIVES (`equipementsActifsDuSite`, `lib/machines/depot.ts`) ; une ligne
 * mène à sa fiche et propose « + Intervention », déjà préremplie SITE ET
 * MACHINE (LIENS-1). Paginé à 50 — `EQUIPEMENTS_PAR_PAGE_SITE` — avec le
 * total écrit, comme `BlocInterventions` juste en dessous.
 */
function BlocEquipements({
  equipements,
  total,
  page,
  siteId,
  peutCreerIntervention,
}: Readonly<{
  equipements: readonly LigneEquipementSite[];
  total: number;
  page: number;
  siteId: string;
  peutCreerIntervention: boolean;
}>) {
  const colonnes = [
    { cle: "famille", libelle: t("sites.fiche.equipements.colonne_famille") },
    {
      cle: "materiel",
      libelle: t("sites.fiche.equipements.colonne_materiel"),
    },
    { cle: "serie", libelle: t("sites.fiche.equipements.colonne_serie") },
    { cle: "statut", libelle: t("sites.fiche.equipements.colonne_statut") },
    { cle: "action", libelle: t("sites.fiche.equipements.colonne_action") },
  ];
  const totalPages = Math.max(1, Math.ceil(total / EQUIPEMENTS_PAR_PAGE_SITE));
  return (
    <section
      data-bloc="equipements-site"
      className="bg-app-surface border-app-bord overflow-hidden rounded-lg border"
    >
      <h2 className="border-app-bord border-b px-4 py-3 text-[14px] font-bold">
        {t("sites.fiche.equipements")}
      </h2>
      {equipements.length === 0 ? (
        <p className="text-app-encre-faible px-4 py-3 text-[12.5px]">
          {t("sites.fiche.equipements_vide")}
        </p>
      ) : (
        <Tableau colonnes={colonnes} minimum="720px">
          {equipements.map((machine) => (
            <tr key={machine.id}>
              <Cellule>{machine.familleLibelle}</Cellule>
              <Cellule fort>
                <Link href={`/parc/${machine.id}`} className={CLASSES_LIEN}>
                  {machine.marque} {machine.reference}
                </Link>
              </Cellule>
              <Cellule mono>{machine.numeroSerie}</Cellule>
              <Cellule>
                <Badge ton={TON_STATUT_MACHINE[machine.statut] ?? "gris"}>
                  {statutMachineAffiche(machine.statut)}
                </Badge>
              </Cellule>
              <Cellule>
                {peutCreerIntervention ? (
                  <Link
                    href={`/interventions/nouvelle?site=${siteId}&machine=${machine.id}`}
                    className={CLASSES_LIEN}
                  >
                    {t("sites.action.ajouter_intervention")}
                  </Link>
                ) : null}
              </Cellule>
            </tr>
          ))}
        </Tableau>
      )}
      {total === 0 ? null : (
        <div className="border-app-bord border-t px-4 py-3">
          <Pagination
            page={page}
            totalPages={totalPages}
            libelleResultats={decompte(
              total,
              t("sites.fiche.equipement_resultat_un"),
              t("sites.fiche.equipement_resultat"),
            )}
            libellePage={libellePage(page, totalPages)}
            libellePrecedent={t("pagination.precedent")}
            libelleSuivant={t("pagination.suivant")}
            hrefPage={(p) => hrefDeLaPage(`/sites/${siteId}`, {}, p)}
          />
        </div>
      )}
    </section>
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
                  href={`/interventions/${ligne.id}?depuis=site`}
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
