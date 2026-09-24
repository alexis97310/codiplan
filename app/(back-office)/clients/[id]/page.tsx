import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { z } from "zod";

import { Page } from "@/components/mise-en-page/page";
import { ActionPrimaire, LienPrimaire } from "@/components/ui/action-primaire";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { peut } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import { dateCivile } from "@/lib/calendar/fuseau";
import {
  libelleCodeExterne,
  libelleCodeExterneDeLaSociete,
  lireClient,
} from "@/lib/clients";
import { contactsDuClient } from "@/lib/contacts/depot";
import {
  compterInterventionsDuClient,
  dernieresInterventionsDuClient,
  interventionsOuvertesDuClient,
  type LignePlanning,
} from "@/lib/interventions/depot";
import { nombreEquipementsActifsDuClient } from "@/lib/machines/depot";
import { equipementsParSite } from "@/lib/sites/depot";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { CLASSES_STATUT } from "@/lib/theme/statuts";

import { BlocContacts } from "../../contacts/presentation";
import {
  decompte,
  hrefDeLaPage,
  libellePage,
  ouTiret,
} from "../../presentation";
import { referenceAffichee } from "../../interventions/presentation";
import { compteurContrat, compteurEquipements } from "../../sites/presentation";

/**
 * LA FICHE D'UN CLIENT (14/09/2026, L1-01 rouvert par R3-12).
 *
 * ## CE QU'ELLE MONTRE, ET POURQUOI CHAQUE BLOC A ÉTÉ GARDÉ
 *
 * *« Les dernières interventions, c'est très exactement ce pour quoi un
 * directeur d'exploitation ouvre une fiche client. »* — l'arbitrage du
 * 14/09/2026. Les lieux d'intervention sont là pour la même raison que la
 * colonne de la liste : *ils disent où l'on intervient chez ce client.*
 *
 * ## LE BLOC « CONTACTS » (CONTACTS-1)
 *
 * `contact` existe en base depuis L1-03 — table, saisie Zod, dépôt, rôles et
 * canaux clos —, et jusqu'à ce ticket aucun écran ne permettait d'en saisir
 * un : le module était l'un des neuf que R3-12 mesurait comme sans chemin.
 * `lib/contacts/depot.ts` ouvre les trois écritures (création, modification,
 * bascule d'activité), et cette fiche montre TOUS les interlocuteurs du
 * client — les siens propres (`site_id` nul) et ceux de ses sites — puisque
 * *« qui appeler chez ce client »* ne se limite pas à un lieu. La fiche d'un
 * site, elle, ne montre que les siens.
 *
 * Un client sans interlocuteur dit son absence (`clients.fiche.contacts_vide`),
 * jamais un tableau vide (D88).
 *
 * ## AUCUNE SUPPRESSION SUR CET ÉCRAN, ET C'EST UNE DÉCISION
 *
 * `supprimerClient` existe, et elle échouerait presque toujours : tout ce qui
 * référence la fiche la retient (`ON DELETE RESTRICT` sur les sites, machines,
 * interventions, contacts, demandes). *Proposer un bouton qui échoue huit fois
 * sur dix est pire que de ne pas le proposer* — le geste réel est de rendre la
 * fiche inactive, et il est au formulaire.
 *
 * ## L'ÉTAT SE CHOISIT, IL NE SE DÉCOCHE PAS
 *
 * Une case à cocher décochée est **absente** du formulaire, et le schéma de
 * modification lit une absence comme « ne touche pas à cette colonne » : la
 * désactivation n'aurait jamais eu lieu, **et l'écran aurait affiché
 * « enregistré »**. *Un succès qui ne fait pas ce qu'on lui a demandé est pire
 * qu'un refus* (R2-20, sur les forfaits). Deux valeurs explicites ferment ce
 * chemin à la compilation du formulaire lui-même.
 *
 * ## AUCUNE COMPARAISON DE SOCIÉTÉ N'EST ÉCRITE ICI
 *
 * `lireClient` lit sous le contexte cloisonné, et la forme « parc » décide. Une
 * fiche hors périmètre et une fiche inexistante rendent LA MÊME chose — les
 * distinguer ferait un oracle (D35, D50).
 *
 * ## L'HISTORIQUE DES INTERVENTIONS EST PAGINÉ, PAS TRONQUÉ (HISTORIQUE-CLIENT-1)
 *
 * *Constat du 23/09/2026* : la fiche montrait douze lignes et aucun moyen
 * d'atteindre la treizième — la base porte 1751 interventions d'archive, et un
 * client qui en porte des dizaines avait toute sa relation ancienne invisible.
 * `page` vit dans l'URL, comme sur `/clients`, `/parc`, `/sites` et
 * `/interventions` (AT-07) : `dernieresInterventionsDuClient` borne CHAQUE
 * PAGE côté base (jamais un `slice` après coup, la faute que PARC-1 a
 * corrigée), et `compterInterventionsDuClient` compte le total FILTRÉ sur le
 * MÊME `where` — un total qui compterait autrement que ce qu'il pagine est la
 * faute nommée par le directeur d'exploitation le 16/09 sur `/clients`.
 *
 * **Rediriger vers `/interventions` pré-filtré sur le client a été écarté** :
 * mesuré le 23/09/2026, ce registre n'expose aucun filtre `client_id` — ni au
 * schéma (`RechercheInterventions`), ni au `where` (`filtreDesInterventions`)
 * — et il tait par défaut les clients INACTIFS (RG-PLA-08, D129), ce que la
 * fiche d'un client inactif ne fait jamais. Ajouter ce filtre aurait débordé
 * du territoire de ce ticket (`lib/interventions/saisie.ts`,
 * `app/(back-office)/interventions/page.tsx`) pour un résultat qui aurait dû
 * re-décider ce point. La pagination directe, elle, tient tout entière dans
 * `lib/interventions/depot.ts` et cette page, avec le composant `Pagination`
 * déjà partagé par les quatre écrans qui paginent.
 */

/** Combien d'interventions une PAGE de la fiche montre. */
const INTERVENTIONS_PAR_PAGE = 12;

/** `page` — un entier d'au moins 1 ; toute valeur absente ou invalide retombe sur la première. */
const schemaPage = z.coerce.number().int().min(1).catch(1);

/**
 * MÉMOÏSÉE PAR REQUÊTE (VISUEL-1, 23/09/2026) — `generateMetadata` et la page
 * elle-même lisent tous deux la même fiche ; `cache()` de React fait que Next
 * ne l'interroge qu'une fois par rendu, exactement comme `chromeDeLaRequete`
 * (`lib/navigation/chrome.ts`) le fait déjà pour la session.
 */
const lireClientCache = cache(lireClient);

/**
 * MÊME MÉMOÏSATION, POUR LA SESSION ELLE-MÊME — sans elle, `lireClientCache`
 * ne dédoublonnerait rien : `generateMetadata` et la page appelleraient
 * chacun `obtenirSession` séparément, et `contexte` serait un objet DIFFÉRENT
 * à chaque appel, ce qui casse la mémoïsation par égalité d'arguments de
 * `cache()`.
 */
const sessionCache = cache(async () => obtenirSession(await headers()));

/**
 * LE TITRE D'ONGLET PORTE LE NOM DU CLIENT (VISUEL-1) — *mesuré en
 * production le 23/09 : `document.title` valait « CODIPLAN » sur une fiche
 * client comme sur toutes les autres.* Une fiche inexistante ou hors
 * périmètre retombe sur le titre générique de la liste : `generateMetadata`
 * ne doit jamais lever, et `notFound()` reste le geste de la page elle-même.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const session = await sessionCache();
  if (session === null || session.contexte.societeId === null) {
    return { title: t("client.titre") };
  }
  const { id } = await params;
  const client = await lireClientCache(session.contexte, id);
  return { title: client?.raison_sociale ?? t("client.titre") };
}

export default async function PageClient({
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
  const client = await lireClientCache(session.contexte, id);
  if (client === null) {
    notFound();
  }
  const page = schemaPage.parse(
    typeof paramsResolus.page === "string" ? paramsResolus.page : undefined,
  );

  const libelleSociete = await libelleCodeExterneDeLaSociete(session.contexte);
  const sites = await avecContexteApplicatif(session.contexte, (tx) =>
    tx.site.findMany({
      where: { client_id: client.id },
      select: {
        id: true,
        libelle: true,
        commune: true,
        actif: true,
        // CONTRAT-SITE-1 (badge réutilisé, FICHE-360-1) et LISTES-1
        // (équipements par site) — les deux pastilles déjà écrites par
        // `app/(back-office)/sites/presentation.ts`, jamais redessinées ici.
        sous_contrat: true,
      },
      orderBy: [{ libelle: "asc" }, { id: "asc" }],
    }),
  );
  const contacts = await contactsDuClient(session.contexte, client.id);
  const [interventions, totalInterventions] = await Promise.all([
    dernieresInterventionsDuClient(
      session.contexte,
      client.id,
      INTERVENTIONS_PAR_PAGE,
      page,
    ),
    compterInterventionsDuClient(session.contexte, client.id),
  ]);
  const totalPagesInterventions = Math.max(
    1,
    Math.ceil(totalInterventions / INTERVENTIONS_PAR_PAGE),
  );

  // LA SYNTHÈSE EN TÊTE (FICHE-360-1) — uniquement des faits déjà en base.
  // « Dernière intervention » est une lecture À PART, bornée à UNE ligne,
  // jamais `interventions[0]` : celui-ci suit `page`, et la treizième page
  // afficherait alors la treizième plus récente comme si c'était la
  // dernière — la même faute qu'HISTORIQUE-CLIENT-1 a corrigée pour le
  // tableau lui-même.
  const [equipementsParSiteMap, interventionsOuvertes, derniereInterventionListe] =
    await Promise.all([
      equipementsParSite(session.contexte, sites),
      interventionsOuvertesDuClient(session.contexte, client.id),
      dernieresInterventionsDuClient(session.contexte, client.id, 1, 1),
    ]);
  const equipementsActifs = await nombreEquipementsActifsDuClient(
    session.contexte,
    client.id,
  );
  const derniereIntervention = derniereInterventionListe[0] ?? null;
  const sitesActifs = sites.filter((site) => site.actif).length;

  // « DONNEUR D'ORDRE » EN TÊTE (FICHE-360-1) — `roles` porte plusieurs
  // rôles à la fois (L1-03), et un `sort` par booléen reste STABLE (moteur
  // V8) : l'ordre relatif des autres contacts n'est jamais perturbé.
  const contactsTries = [...contacts].sort(
    (a, b) =>
      Number(b.roles.includes("donneur_ordre")) -
      Number(a.roles.includes("donneur_ordre")),
  );

  // LES ACTIONS EN CONTEXTE (FICHE-360-1) — visibles selon les MÊMES
  // capacités que les routes qu'elles ouvrent.
  const peutGererSite =
    session.contexte.role !== null &&
    peut(session.contexte.role, "gerer_client_site");
  const peutCreerIntervention =
    session.contexte.role !== null &&
    peut(session.contexte.role, "creer_demande");

  const colonnesSites = [
    { cle: "libelle", libelle: t("site.libelle") },
    { cle: "commune", libelle: t("site.commune"), largeur: "200px" },
    {
      cle: "equipements",
      libelle: t("clients.fiche.sites.equipements"),
      largeur: "160px",
    },
  ];
  const colonnesInterventions = [
    {
      cle: "reference",
      libelle: t("intervention.reference"),
      largeur: "140px",
    },
    { cle: "date", libelle: t("intervention.date"), largeur: "130px" },
    { cle: "type", libelle: t("intervention.type"), largeur: "170px" },
    // LE MOT IMPOSÉ, et non « Libellé » (constaté À L'IMAGE le 14/09/2026).
    // Dans le bloc des lieux, « Libellé » se comprend — le titre du bloc dit de
    // quoi il parle. Au milieu des interventions, la même colonne se lisait
    // « libellé de quoi ? ». *C'est le défaut du 09/09 : chaque moitié est
    // juste, leur RENCONTRE est fausse, et aucune assertion n'était formulée
    // pour l'attraper.* `mot("site")` se définit une fois (D5, D47).
    { cle: "site", libelle: mot("site") },
    { cle: "statut", libelle: t("intervention.statut"), largeur: "150px" },
  ];

  return (
    <Page
      chemin="/clients"
      titre={client.raison_sociale}
      // FIL D'ARIANE (FICHE-360-1) — `Clients › <client>` ; l'écran courant
      // n'est jamais un lien, voir `components/mise-en-page/page.tsx`.
      filAriane={[
        { libelle: t("fil_ariane.clients"), href: "/clients" },
        { libelle: client.raison_sociale },
      ]}
      sousTitre={ouTiret(client.code_externe)}
      actions={
        <>
          {peutGererSite ? (
            <LienPrimaire href={`/sites/nouveau?client=${client.id}`}>
              {t("clients.action.ajouter_site")}
            </LienPrimaire>
          ) : null}
          {peutCreerIntervention ? (
            // LIEN SIMPLE, PAS PRÉREMPLI (FICHE-360-1) — CHOIX EXPLICITE :
            // `ChampSiteEtMachines` (`interventions/nouvelle`) organise la
            // saisie autour du SITE, jamais du client ; le client s'y déduit
            // du site choisi. Préremplir depuis ici demanderait un second
            // mécanisme de prérempissage (par client plutôt que par site),
            // hors du périmètre de ce ticket — voir la passation.
            <LienPrimaire href="/interventions/nouvelle">
              {t("clients.action.ajouter_intervention")}
            </LienPrimaire>
          ) : null}
          <Link href="/clients" className="text-app-encre-faible text-[12.5px]">
            {t("clients.retour")}
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

      <BlocSyntheseClient
        sitesActifs={sitesActifs}
        equipements={equipementsActifs}
        interventionsOuvertes={interventionsOuvertes}
        derniereIntervention={derniereIntervention}
      />

      <form
        method="post"
        action={`/api/clients/${client.id}/modifier`}
        className="bg-app-surface border-app-bord flex flex-col gap-4 rounded-lg border px-4 py-4"
      >
        <h2 className="text-[15px] font-bold">{t("clients.fiche.identite")}</h2>
        <Champ
          nom="raison_sociale"
          libelle={t("client.raison_sociale")}
          valeur={client.raison_sociale}
        />
        <Champ
          nom="code_externe"
          libelle={libelleCodeExterne(libelleSociete)}
          valeur={client.code_externe ?? ""}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Champ
            nom="ridet"
            libelle={t("client.ridet")}
            valeur={client.ridet ?? ""}
          />
          <Champ
            nom="categorie"
            libelle={t("client.categorie")}
            valeur={client.categorie ?? ""}
          />
          <Champ
            nom="conditions_reglement"
            libelle={t("client.conditions_reglement")}
            valeur={client.conditions_reglement ?? ""}
          />
          <Champ
            nom="commercial_referent"
            libelle={t("client.commercial_referent")}
            valeur={client.commercial_referent ?? ""}
          />
        </div>

        {/* DEUX VALEURS EXPLICITES, jamais une case à cocher : une case
            décochée est absente du formulaire, et une absence se lit « ne
            touche pas à cette colonne ». */}
        <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
          {t("clients.etat")}
          <select
            name="actif"
            defaultValue={client.actif ? "true" : "false"}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
          >
            <option value="true">{t("clients.etat.actif")}</option>
            <option value="false">{t("clients.etat.inactif")}</option>
          </select>
          <span className="text-app-encre-faible text-[11px] font-normal">
            {t("clients.etat.aide")}
          </span>
        </label>

        <div>
          <ActionPrimaire>{t("clients.action.modifier")}</ActionPrimaire>
        </div>
      </form>

      <section className="bg-app-surface border-app-bord overflow-hidden rounded-lg border">
        <h2 className="border-app-bord border-b px-4 py-3 text-[15px] font-bold">
          {t("clients.fiche.sites")}
        </h2>
        <Tableau colonnes={colonnesSites} minimum="520px">
          {sites.length === 0 ? (
            <LignePleine colonnes={colonnesSites.length}>
              {t("clients.fiche.sites_vide")}
            </LignePleine>
          ) : null}
          {sites.map((site) => {
            // LES PASTILLES DE 40-PASTILLES-1/CONTRAT-SITE-1, RÉUTILISÉES
            // (FICHE-360-1) — même donnée, même ton, jamais redessinées :
            // `compteurEquipements`/`compteurContrat` de
            // `app/(back-office)/sites/presentation.ts`.
            const compteEquip = compteurEquipements(
              equipementsParSiteMap.get(site.id) ?? 0,
            );
            const compteContrat = compteurContrat(site.sous_contrat);
            return (
              <tr key={site.id}>
                <Cellule fort>
                  <Link href={`/sites/${site.id}`} className={CLASSES_LIEN}>
                    {site.libelle}
                  </Link>
                  {site.actif ? null : (
                    <span className="text-app-encre-faible block text-[10.5px]">
                      {t("sites.inactif")}
                    </span>
                  )}
                  {compteContrat === null ? null : (
                    <Badge ton={compteContrat.ton}>
                      {compteContrat.libelle}
                    </Badge>
                  )}
                </Cellule>
                <Cellule>{ouTiret(site.commune)}</Cellule>
                <Cellule>
                  <Badge ton={compteEquip.ton}>
                    {compteEquip.valeur} {compteEquip.libelle}
                  </Badge>
                </Cellule>
              </tr>
            );
          })}
        </Tableau>
      </section>

      <section
        data-bloc="historique-client"
        className="bg-app-surface border-app-bord overflow-hidden rounded-lg border"
      >
        <h2 className="border-app-bord border-b px-4 py-3 text-[15px] font-bold">
          {t("clients.fiche.interventions")}
        </h2>
        <Tableau colonnes={colonnesInterventions} minimum="820px">
          {totalInterventions === 0 ? (
            <LignePleine colonnes={colonnesInterventions.length}>
              {t("clients.fiche.interventions_vide")}
            </LignePleine>
          ) : null}
          {interventions.map((ligne) => (
            <tr key={ligne.id}>
              <Cellule mono>
                <Link
                  href={`/interventions/${ligne.id}?depuis=client`}
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
              <Cellule>{ligne.site.libelle}</Cellule>
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
        {totalInterventions === 0 ? null : (
          <div className="border-app-bord border-t px-4 py-3">
            <Pagination
              page={page}
              totalPages={totalPagesInterventions}
              libelleResultats={decompte(
                totalInterventions,
                t("interventions.resultat_un"),
                t("interventions.resultat"),
              )}
              libellePage={libellePage(page, totalPagesInterventions)}
              libellePrecedent={t("pagination.precedent")}
              libelleSuivant={t("pagination.suivant")}
              hrefPage={(p) => hrefDeLaPage(`/clients/${client.id}`, {}, p)}
            />
          </div>
        )}
      </section>

      <BlocContacts
        bloc="contacts-client"
        titre={t("clients.fiche.contacts")}
        texteVide={t("clients.fiche.contacts_vide")}
        contacts={contactsTries}
        clientId={client.id}
        retour={`/clients/${client.id}`}
        siteOptions={sites.map((site) => ({
          id: site.id,
          libelle: site.libelle,
        }))}
        siteFixe={null}
        montrerRattachement
      />
    </Page>
  );
}

function Champ({
  nom,
  libelle,
  valeur,
}: Readonly<{ nom: string; libelle: string; valeur: string }>) {
  return (
    <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
      {libelle}
      <input
        name={nom}
        defaultValue={valeur}
        className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
      />
    </label>
  );
}

/**
 * LA SYNTHÈSE EN TÊTE (FICHE-360-1) — même forme que `BlocSyntheseSite`
 * (`app/(back-office)/sites/[id]/page.tsx`), jamais une seconde écriture
 * de sa mise en page : uniquement des faits déjà en base, un compteur
 * inconnu s'écrit « — », jamais 0 (D88). `data-compteur` donne une prise
 * stable à une épreuve de bout en bout.
 */
function BlocSyntheseClient({
  sitesActifs,
  equipements,
  interventionsOuvertes,
  derniereIntervention,
}: Readonly<{
  sitesActifs: number;
  equipements: number;
  interventionsOuvertes: number;
  derniereIntervention: LignePlanning | null;
}>) {
  return (
    <div
      data-bloc="synthese-client"
      className="bg-app-surface border-app-bord flex flex-wrap gap-6 rounded-lg border px-4 py-3.5"
    >
      <div data-compteur="sites-actifs">
        <b className="block text-[16px] font-bold">{sitesActifs}</b>
        <span className="text-app-encre-faible text-[11px]">
          {t("clients.fiche.synthese.sites_actifs")}
        </span>
      </div>
      <div data-compteur="equipements">
        <b className="block text-[16px] font-bold">{equipements}</b>
        <span className="text-app-encre-faible text-[11px]">
          {t("clients.fiche.synthese.equipements")}
        </span>
      </div>
      <div data-compteur="interventions-ouvertes">
        <b className="block text-[16px] font-bold">{interventionsOuvertes}</b>
        <span className="text-app-encre-faible text-[11px]">
          {t("clients.fiche.synthese.interventions_ouvertes")}
        </span>
      </div>
      <div data-compteur="derniere-intervention">
        <b className="block text-[16px] font-bold">
          {derniereIntervention === null ? (
            ouTiret(null)
          ) : (
            <Link
              href={`/interventions/${derniereIntervention.id}?depuis=client`}
              className={CLASSES_LIEN}
            >
              {derniereIntervention.date_planifiee === null
                ? ouTiret(null)
                : dateCivile(derniereIntervention.date_planifiee)}{" "}
              · {t(`type_intervention.${derniereIntervention.type}`)}
            </Link>
          )}
        </b>
        <span className="text-app-encre-faible text-[11px]">
          {t("clients.fiche.synthese.derniere_intervention")}
        </span>
      </div>
    </div>
  );
}
