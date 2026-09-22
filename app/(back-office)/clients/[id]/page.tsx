import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { Page } from "@/components/mise-en-page/page";
import { ActionPrimaire } from "@/components/ui/action-primaire";
import { Pagination } from "@/components/ui/pagination";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
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
} from "@/lib/interventions/depot";
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

export default async function PageClient({
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
  const paramsResolus = await searchParams;
  const motif = paramsResolus.motif;
  const client = await lireClient(session.contexte, id);
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
      select: { id: true, libelle: true, commune: true, actif: true },
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

  const colonnesSites = [
    { cle: "libelle", libelle: t("site.libelle") },
    { cle: "commune", libelle: t("site.commune"), largeur: "200px" },
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
      sousTitre={ouTiret(client.code_externe)}
      actions={
        <Link href="/clients" className="text-app-encre-faible text-[12.5px]">
          {t("clients.retour")}
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
          {sites.map((site) => (
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
              </Cellule>
              <Cellule>{ouTiret(site.commune)}</Cellule>
            </tr>
          ))}
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
        contacts={contacts}
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
