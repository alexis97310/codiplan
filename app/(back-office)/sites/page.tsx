import Link from "next/link";
import { LienPrimaire } from "@/components/ui/action-primaire";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { obtenirSession } from "@/lib/auth/session";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  libellesDesSites,
  rechercherSites,
  type FicheSite,
} from "@/lib/sites/depot";
import { schemaRechercheSite } from "@/lib/sites/saisie";

import { libelleRattachement, ouTiret } from "./presentation";
import { CLASSES_LIEN } from "@/lib/theme/apparence";

/**
 * L'ÉCRAN « SITES » (L3-16, D75).
 *
 * > *« Un client a plusieurs sites, dans des villes différentes — c'est le cas
 * > courant. La table, la saisie Zod et le dépôt existent depuis L1-02 ; il
 * > manque l'écran. »*
 *
 * ## ⚠ IL N'A PAS D'ENTRÉE DANS LA BARRE, ET C'EST MESURÉ
 *
 * La maquette fait foi sur la disposition (D95) et sa barre porte **onze
 * entrées, dont aucune « Sites »** — mesuré : le mot n'y figure qu'une fois, et
 * c'est dans la liste des imports disponibles. `lib/navigation/entrees.ts`
 * confronte la liste à la maquette, libellés et ordre compris : **ajouter une
 * douzième entrée la ferait rougir**, à raison.
 *
 * Cet écran se rejoint donc **par un lien**, depuis le lieu d'une intervention —
 * ce qui lui donne un appelant, et c'est ce qui compte : *une interface sans
 * appelant est la maladie que le portail a soignée.* Le jour où la barre
 * accueillera « Sites », ce sera une décision sur la maquette, pas un effet de
 * bord de ce ticket.
 *
 * ## Ce qu'il montre, et pourquoi le temps de trajet ne voyage pas seul
 *
 * Le rattachement est affiché **à côté** du temps de trajet, jamais sans lui :
 * *un nombre dont la signification dépend d'une autre colonne ne voyage jamais
 * seul* (D56), et « 45 » ne veut rien dire sans « depuis où ». Et le libellé le
 * dit encore autrement : c'est une donnée de **planification**, jamais de
 * facturation (D74).
 *
 * ## Le cloisonnement n'est pas écrit ici
 *
 * `site` est de forme « parc » : société, client, périmètre de sites. Un compte
 * de portail ne voit donc que les sites de son périmètre **sans qu'une ligne de
 * cet écran le sache** — RG-DRO-01 est tenue par la politique, et une
 * comparaison écrite ici serait une seconde lecture d'un critère que la base
 * porte déjà.
 */

/** Ce que l'écran rend. Une BORNE d'affichage, jamais un cloisonnement. */
const LIGNES_AFFICHEES = 100;

export default async function PageSites({
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
  const criteres = schemaRechercheSite.safeParse({
    texte: typeof params.q === "string" ? params.q : "",
    client_id: typeof params.client === "string" ? params.client : null,
    limite: LIGNES_AFFICHEES,
  });
  const sites = criteres.success
    ? await rechercherSites(session.contexte, criteres.data)
    : [];
  const libelles = await libellesDesSites(session.contexte, sites);

  const colonnes = [
    { cle: "libelle", libelle: t("site.libelle") },
    { cle: "client", libelle: t("site.client"), largeur: "220px" },
    { cle: "commune", libelle: t("site.commune"), largeur: "160px" },
    { cle: "zone", libelle: t("site.zone_geo"), largeur: "150px" },
    {
      cle: "rattachement",
      libelle: libelleRattachement(),
      largeur: "200px",
    },
    { cle: "trajet", libelle: t("sites.colonne_trajet"), largeur: "110px" },
  ];

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">
            {mot("site", true)}
          </h1>
          <p className="text-app-encre-faible text-[13px]">
            {t("sites.sous_titre")}
          </p>
        </div>
        <LienPrimaire href="/sites/nouveau">{t("sites.creer")}</LienPrimaire>
      </header>

      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(motif)}
        </p>
      ) : null}

      {/* La recherche est un FORMULAIRE `GET` : elle s'écrit dans l'URL, donc
          elle se partage et se recharge. Aucun état client à tenir. */}
      <form
        method="get"
        className="bg-app-surface border-app-bord flex flex-wrap items-end gap-3 rounded-[10px] border px-4 py-3.5"
      >
        <label className="flex flex-col gap-1 text-[12px] font-semibold">
          {t("sites.recherche")}
          <input
            type="search"
            name="q"
            defaultValue={typeof params.q === "string" ? params.q : ""}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
          />
        </label>
        <button
          type="submit"
          className="border-app-bord rounded-md border px-4 py-2 text-[13px] font-bold"
        >
          {t("sites.rechercher")}
        </button>
      </form>

      <section className="bg-app-surface border-app-bord overflow-hidden rounded-[10px] border">
        <Tableau colonnes={colonnes} minimum="980px">
          {sites.length === 0 ? (
            <LignePleine colonnes={colonnes.length}>
              {t("site.recherche.vide")}
            </LignePleine>
          ) : null}
          {sites.map((site) => (
            <LigneSite
              key={site.id}
              site={site}
              client={libelles.clients.get(site.client_id) ?? null}
              agence={libelles.agences.get(site.agence_id) ?? null}
            />
          ))}
        </Tableau>
      </section>

      <p className="text-app-encre-faible text-[11.5px]">{t("sites.borne")}</p>
    </main>
  );
}

function LigneSite({
  site,
  client,
  agence,
}: {
  readonly site: FicheSite;
  readonly client: string | null;
  readonly agence: string | null;
}) {
  const zone = site.zone_geo === null ? null : `site.zone.${site.zone_geo}`;
  return (
    <tr>
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
      {/* LA COLONNE « CLIENT » MÈNE À LA FICHE (14/09/2026) — le second des
          deux chemins tranchés ce jour-là. Le libellé peut manquer (la
          politique a refusé, ou le client n'est pas dans le périmètre) ; on ne
          fabrique alors AUCUN lien, parce qu'un lien vers une fiche qu'on ne
          peut pas lire rendrait un 404 là où il faut lire une absence. */}
      <Cellule>
        {client === null ? (
          ouTiret(null)
        ) : (
          <Link href={`/clients/${site.client_id}`} className={CLASSES_LIEN}>
            {client}
          </Link>
        )}
      </Cellule>
      <Cellule>{ouTiret(site.commune)}</Cellule>
      <Cellule>
        {zone !== null && estCleTraduction(zone) ? t(zone) : ouTiret(null)}
      </Cellule>
      {/* LE RATTACHEMENT EST RENDU À CÔTÉ DU TEMPS, jamais sans lui (D56). */}
      <Cellule>{ouTiret(agence)}</Cellule>
      <Cellule droite mono>
        {ouTiret(site.temps_trajet_min)}
      </Cellule>
    </tr>
  );
}
