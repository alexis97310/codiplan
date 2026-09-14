import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LienPrimaire } from "@/components/ui/action-primaire";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { obtenirSession } from "@/lib/auth/session";
import {
  compterSansCodeExterne,
  libelleCodeExterne,
  libelleCodeExterneDeLaSociete,
  rechercherClients,
  sitesParClient,
  type FicheClient,
  type SitesDUnClient,
} from "@/lib/clients";
import { schemaRechercheClient } from "@/lib/clients/saisie";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { CLASSES_LIEN } from "@/lib/theme/apparence";

import { ouTiret } from "../presentation";
import { resumeDesSites, titreSansCode } from "./presentation";

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
 * ## LA MAQUETTE EST MUETTE ICI, ET L'ÉCART SE DIT AVEC SA MESURE
 *
 * D95 donne à `docs/maquette/CODIPLAN_Maquette.html` autorité sur la
 * disposition et les couleurs — *pour ce qu'elle montre*. **Elle ne montre
 * aucun écran client** : mesuré le 14/09/2026, `grep -i client` y rend trente
 * occurrences, toutes des colonnes « Client » d'AUTRES écrans (planning, parc,
 * contrats, imports), et pas une liste ni une fiche. La disposition suivie est
 * donc celle des écrans voisins qu'elle gouverne — en-tête, bandeau, tableau —,
 * et c'est le point précis où elle se tait.
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
 */

/** Ce que l'écran rend. Une BORNE d'affichage, jamais un cloisonnement. */
const LIGNES_AFFICHEES = 200;

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
  const criteres = schemaRechercheClient.safeParse({
    texte: typeof params.q === "string" ? params.q : "",
    actifs_seulement: params.actifs === "1",
    limite: LIGNES_AFFICHEES,
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
  const sites = await sitesParClient(session.contexte, clients);
  const libelleSociete = await libelleCodeExterneDeLaSociete(session.contexte);

  const colonnes = [
    { cle: "raison_sociale", libelle: t("client.raison_sociale") },
    {
      cle: "code_externe",
      libelle: libelleCodeExterne(libelleSociete),
      largeur: "170px",
    },
    { cle: "sites", libelle: t("clients.colonne_sites"), largeur: "280px" },
    { cle: "categorie", libelle: t("client.categorie"), largeur: "150px" },
    {
      cle: "commercial",
      libelle: t("client.commercial_referent"),
      largeur: "170px",
    },
  ];

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">
            {t("client.titre")}
          </h1>
          <p className="text-app-encre-faible text-[13px]">
            {t("clients.sous_titre")}
          </p>
        </div>
        <LienPrimaire href="/clients/nouveau">
          {t("clients.creer")}
        </LienPrimaire>
      </header>

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
      <section className="bg-app-surface border-app-bord rounded-[10px] border px-4 py-3.5">
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

      {/* La recherche est un FORMULAIRE `GET` : elle s'écrit dans l'URL, donc
          elle se partage et se recharge. Aucun état client à tenir. */}
      <form
        method="get"
        className="bg-app-surface border-app-bord flex flex-wrap items-end gap-3 rounded-[10px] border px-4 py-3.5"
      >
        <label className="flex flex-col gap-1 text-[12px] font-semibold">
          {t("client.recherche")}
          <input
            type="search"
            name="q"
            defaultValue={typeof params.q === "string" ? params.q : ""}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
          />
        </label>
        <label className="flex items-center gap-2 pb-2 text-[12px] font-semibold">
          <input
            type="checkbox"
            name="actifs"
            value="1"
            defaultChecked={params.actifs === "1"}
          />
          {t("clients.actifs_seulement")}
        </label>
        <button
          type="submit"
          className="border-app-bord rounded-md border px-4 py-2 text-[13px] font-bold"
        >
          {t("clients.rechercher")}
        </button>
        <p className="text-app-encre-faible w-full text-[11.5px]">
          {t("clients.recherche.aide")}
        </p>
      </form>

      <section className="bg-app-surface border-app-bord overflow-hidden rounded-[10px] border">
        <Tableau colonnes={colonnes} minimum="960px">
          {clients.length === 0 ? (
            <LignePleine colonnes={colonnes.length}>
              {t("client.recherche.vide")}
            </LignePleine>
          ) : null}
          {clients.map((client) => (
            <LigneClient
              key={client.id}
              client={client}
              sites={sites.get(client.id)}
            />
          ))}
        </Tableau>
      </section>

      <p className="text-app-encre-faible text-[11.5px]">
        {t("clients.borne")}
      </p>
    </main>
  );
}

function LigneClient({
  client,
  sites,
}: {
  readonly client: FicheClient;
  readonly sites: SitesDUnClient | undefined;
}) {
  return (
    <tr>
      <Cellule fort>
        <Link href={`/clients/${client.id}`} className={CLASSES_LIEN}>
          {client.raison_sociale}
        </Link>
        {client.actif ? null : (
          <span className="text-app-encre-faible block text-[10.5px]">
            {t("clients.inactif")}
          </span>
        )}
      </Cellule>
      <Cellule mono>{ouTiret(client.code_externe)}</Cellule>
      <Cellule>{resumeDesSites(sites)}</Cellule>
      <Cellule>{ouTiret(client.categorie)}</Cellule>
      <Cellule>{ouTiret(client.commercial_referent)}</Cellule>
    </tr>
  );
}
