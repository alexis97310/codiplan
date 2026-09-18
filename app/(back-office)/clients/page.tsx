import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LienPrimaire } from "@/components/ui/action-primaire";
import { Badge } from "@/components/ui/badge";
import { BarreDeFiltres } from "@/components/ui/barre-de-filtres";
import { CarteEntite, GrilleCartesEntites } from "@/components/ui/carte-entite";
import { Page } from "@/components/mise-en-page/page";
import { Pagination } from "@/components/ui/pagination";
import { obtenirSession } from "@/lib/auth/session";
import {
  compterSansCodeExterne,
  libelleCodeExterneDeLaSociete,
  rechercherClients,
  sitesParClient,
  type FicheClient,
  type SitesDUnClient,
} from "@/lib/clients";
// `compterClients` est importé DIRECTEMENT depuis le dépôt, et non depuis le
// barrel ci-dessus (AT-07) : `scripts/lib/chemins-de-depot.ts` (R3-12) trace
// les chemins fonction par fonction en résolvant chaque spécification
// d'import vers UN fichier — un barrel s'y résout en `lib/clients/index.ts`,
// jamais en `lib/clients/depot.ts`, si bien qu'un import par le barrel
// laisserait cette fonction orpheline aux yeux du gardien alors qu'elle a un
// appelant réel. `compterSansCodeExterne` et `libelleCodeExterneDeLaSociete`
// suivent déjà ce chemin direct ailleurs (`tableau-de-bord/page.tsx`).
import { compterClients } from "@/lib/clients/depot";
import { schemaRechercheClient } from "@/lib/clients/saisie";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { CLASSES_LIEN } from "@/lib/theme/apparence";

import { decompte, hrefDeLaPage, libellePage } from "../presentation";
import {
  codeEtCommune,
  compteurSites,
  referentClient,
  titreSansCode,
} from "./presentation";

/**
 * L'ÉCRAN « CLIENTS » — la liste et la recherche (14/09/2026, ticket L1-01
 * rouvert par R3-12).
 *
 * ## CE QUE CE TICKET RÉPARE, ET IL NE RÉPARE PAS UNE COUCHE
 *
 * L1-01 était marqué `LIVRÉ` : la table, la saisie Zod, le dépôt et ses six
 * fonctions existent depuis le 08/09. **Et personne ne pouvait atteindre un
 * client** — zéro route, zéro écran, un seul appelant dans tout le dépôt
 * (`rechercherClients`, depuis le sélecteur de l'écran de création d'un site).
 * *Un module qui existe prouve qu'une couche a été écrite ; il ne prouve pas
 * qu'un humain l'atteigne*, et c'est le critère que R3-12 a amendé.
 *
 * ## LES DEUX CHEMINS, ET ILS NE FONT PAS DOUBLE EMPLOI
 *
 * *« Neuf fois sur dix on arrive à un client en partant d'une machine ou d'un
 * lieu qu'on regardait déjà. Mais on ne peut pas créer un client depuis une
 * machine qui n'existe pas encore, d'où la liste. »* — l'arbitrage du
 * 14/09/2026. La LISTE se rejoint depuis « Sociétés & tarifs », et c'est de là
 * que part la création ; la FICHE se rejoint aussi depuis les colonnes
 * « Client » du parc et des sites, devenues des liens.
 *
 * **La barre de navigation ne bouge pas.** Elle est close à onze entrées,
 * confrontées à la maquette libellés et ordre compris (D95) ; une douzième la
 * ferait rougir *à raison*. Aucune ligne de ce ticket ne la touche.
 *
 * ## DEPUIS N-08 (D123) : DES CARTES, PAS UN TABLEAU
 *
 * Mesuré dans `docs/maquette/codiplan-maquette-complete.html` : `clients()` et
 * `sites()` sont les DEUX SEULS écrans à dessiner `entity-card` — tout écran
 * transactionnel (interventions, VGP, paramètres…) reste un `<table>` (D123).
 * Un client est un référentiel qu'on consulte pour ce qu'il EST, jamais pour
 * une file d'actions à traiter : la carte, pas le tableau. **Le CONTACT que la
 * maquette montre sur chaque carte n'est PAS repris** — la fiche client dit
 * déjà, depuis L1-03, qu'aucun écran ne permet d'en saisir un
 * (`docs/constitution/organisation-du-code.md`, module `clients/`) ; l'afficher
 * ici aurait montré une donnée que personne ne peut corriger. **La bande de
 * compteurs ne montre que ce que le dépôt compte déjà** — les lieux
 * d'intervention, via `sitesParClient` (AT-07) — jamais un compte de machines
 * ou d'interventions par client, qu'aucune fonction de dépôt ne calcule
 * aujourd'hui (D123, « CE QUE ÇA COÛTE »).
 *
 * ## UN SEUL COMPTEUR, ET IL NOMME UN GESTE
 *
 * Trois autres ont été retirés — total, actifs, inactifs. *Ils se lisent déjà
 * dans le tableau, chacun coûte une requête, et un compteur qu'on regarde sans
 * jamais agir dessus apprend à ne plus lire les compteurs* (§9, 11/09). Celui
 * qui reste dit combien de fiches un import ne saura pas rapprocher
 * (RG-IMP-05), c'est-à-dire combien demandent un geste.
 *
 * **Son titre ne contient pas le mot « Winpro »** : il se compose depuis
 * `societe.libelle_code_externe` (D29). *Nommer d'après l'outil d'un seul
 * client est le défaut du 19/08.*
 *
 * ## LE CLOISONNEMENT N'EST PAS ÉCRIT ICI
 *
 * `client` est de forme « parc » — société, `app.client_id`, périmètre de sites
 * (D10, D22). Un compte de portail ne verrait que le sien **sans qu'une ligne
 * de cet écran le sache**, et une comparaison écrite ici serait une seconde
 * lecture d'un critère que la base porte déjà — celle qui vieillit sans rougir.
 *
 * ## LA PAGINATION (AT-07, 17/09/2026)
 *
 * 619 clients existent aujourd'hui ; la liste les rendait tous. `limite`
 * (50) borne désormais chaque PAGE, jamais la recherche : `compterClients`
 * compte le total FILTRÉ, par la même `filtreDeRecherche` que la liste — un
 * total qui compterait autrement que ce qu'il pagine est la faute nommée par
 * le directeur d'exploitation le 16/09 (« 50 clients » sous une liste qui en
 * compte 619). L'état de la page vit dans l'URL (`searchParams.page`), et une
 * recherche relancée y revient d'elle-même : le formulaire ne porte pas de
 * champ `page`.
 */

export default async function PageClients({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }

  const params = await searchParams;
  const motif = params.motif;
  // LA RECHERCHE PASSE PAR ZOD, comme toute entrée serveur (§2) : une chaîne
  // d'URL est une entrée, et `safeParse` la refuse plutôt que de la croire.
  // `limite` n'est PLUS forcée à 200 : elle retombe sur son défaut (50), la
  // taille d'une PAGE désormais, jamais celle d'un unique chargement (AT-07).
  const criteres = schemaRechercheClient.safeParse({
    texte: typeof params.q === "string" ? params.q : "",
    etat: typeof params.etat === "string" ? params.etat : undefined,
    page: typeof params.page === "string" ? params.page : undefined,
  });

  const clients = criteres.success
    ? await rechercherClients(session.contexte, criteres.data)
    : [];
  // LE COMPTEUR PORTE SUR LA RECHERCHE, LE TABLEAU SUR LA PAGE — et c'est la
  // seule chose qui les sépare. Le CRITÈRE, lui, n'a qu'une écriture :
  // `filtreDeRecherche`, que les deux appellent (§9, 01/09).
  const sansCode = criteres.success
    ? await compterSansCodeExterne(session.contexte, criteres.data)
    : 0;
  // LE TOTAL DE LA PAGINATION — la MÊME `filtreDeRecherche` que la liste et
  // que le compteur ci-dessus, jamais une troisième lecture du critère
  // (AT-07).
  const totalFiltre = criteres.success
    ? await compterClients(session.contexte, criteres.data)
    : 0;
  const totalPages = Math.max(
    1,
    Math.ceil(totalFiltre / (criteres.success ? criteres.data.limite : 1)),
  );
  const sites = await sitesParClient(session.contexte, clients);
  const libelleSociete = await libelleCodeExterneDeLaSociete(session.contexte);

  return (
    <Page
      chemin="/clients"
      titre={t("client.titre")}
      sousTitre={t("clients.sous_titre")}
      actions={
        <LienPrimaire href="/clients/nouveau">
          {t("clients.creer")}
        </LienPrimaire>
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

      {/* LE SEUL COMPTEUR. Il dit ce qu'il compte et sur quoi il porte —
          *un chiffre dont on ne sait pas sur quoi il porte est un chiffre
          qu'on lit de travers* (§9, 06/09). */}
      <section className="bg-app-surface border-app-bord rounded-lg border px-4 py-3.5">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-[26px] font-extrabold tracking-tight">
            {sansCode}
          </span>
          <span className="text-[13px] font-bold">
            {titreSansCode(libelleSociete)}
          </span>
        </div>
        <p className="text-app-encre-faible mt-1 text-[11.5px]">
          {sansCode === 0
            ? t("clients.sans_code_aucune")
            : t("clients.sans_code_aide")}
        </p>
      </section>

      {/* LA LIGNE de la maquette (N-08, D123) — un champ, un <select>, rien
          d'autre. Formulaire GET : l'état vit dans l'URL, jamais dans un
          composant. Le filtre d'état ferme sur TROIS valeurs réelles
          (tous/actifs/inactifs), jamais une case qui ne fait que masquer. */}
      <BarreDeFiltres
        action="/clients"
        parametre="q"
        valeur={typeof params.q === "string" ? params.q : undefined}
        libelleChamp={t("client.recherche")}
        libelleBouton={t("clients.rechercher")}
        enfants={
          <>
            <label className="sr-only" htmlFor="etat">
              {t("clients.filtre.libelle")}
            </label>
            <select
              id="etat"
              name="etat"
              defaultValue={criteres.success ? criteres.data.etat : "tous"}
              className="border-app-bord bg-app-surface h-[40px] rounded-[9px] border px-3"
            >
              <option value="tous">{t("clients.filtre.tous")}</option>
              <option value="actifs">{t("clients.filtre.actifs")}</option>
              <option value="inactifs">{t("clients.filtre.inactifs")}</option>
            </select>
          </>
        }
      />

      {clients.length === 0 ? (
        <p className="text-app-encre-faible text-[13px]">
          {t("client.recherche.vide")}
        </p>
      ) : (
        <GrilleCartesEntites>
          {clients.map((client) => (
            <CarteClient
              key={client.id}
              client={client}
              sites={sites.get(client.id)}
            />
          ))}
        </GrilleCartesEntites>
      )}

      <Pagination
        page={criteres.success ? criteres.data.page : 1}
        totalPages={totalPages}
        libelleResultats={decompte(
          totalFiltre,
          t("clients.resultat_un"),
          t("clients.resultat"),
        )}
        libellePage={libellePage(
          criteres.success ? criteres.data.page : 1,
          totalPages,
        )}
        libellePrecedent={t("pagination.precedent")}
        libelleSuivant={t("pagination.suivant")}
        hrefPage={(page) =>
          hrefDeLaPage(
            "/clients",
            {
              q: typeof params.q === "string" ? params.q : undefined,
              etat:
                typeof params.etat === "string" && params.etat !== "tous"
                  ? params.etat
                  : undefined,
            },
            page,
          )
        }
      />
    </Page>
  );
}

function CarteClient({
  client,
  sites,
}: {
  readonly client: FicheClient;
  readonly sites: SitesDUnClient | undefined;
}) {
  const referent = referentClient(client.commercial_referent);
  return (
    <CarteEntite
      titre={
        <Link href={`/clients/${client.id}`} className={CLASSES_LIEN}>
          {client.raison_sociale}
        </Link>
      }
      badge={
        client.actif ? (
          <Badge ton="vert">{t("clients.etat.actif")}</Badge>
        ) : (
          <Badge ton="gris">{t("clients.inactif")}</Badge>
        )
      }
      lignes={
        referent === null
          ? [codeEtCommune(client.code_externe, sites)]
          : [codeEtCommune(client.code_externe, sites), referent]
      }
      compteurs={[compteurSites(sites)]}
    />
  );
}
