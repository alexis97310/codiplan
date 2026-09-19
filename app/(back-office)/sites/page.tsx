import Link from "next/link";
import { LienPrimaire } from "@/components/ui/action-primaire";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { CarteEntite, GrilleCartesEntites } from "@/components/ui/carte-entite";
import { Page } from "@/components/mise-en-page/page";
import { Pagination } from "@/components/ui/pagination";
import { obtenirSession } from "@/lib/auth/session";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot, motDansUnePhrase } from "@/lib/i18n/vocabulaire";
import {
  compterSites,
  libellesDesSites,
  rechercherSites,
  type FicheSite,
} from "@/lib/sites/depot";
import { schemaRechercheSite } from "@/lib/sites/saisie";

import { decompte, hrefDeLaPage, libellePage } from "../presentation";
import { agenceDuSite, ouTiret } from "./presentation";
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
 * ## DEPUIS N-08 (D123) : DES CARTES, PAS UN TABLEAU
 *
 * Mesuré dans `docs/maquette/codiplan-maquette-complete.html` : `sites()` et
 * `clients()` sont les DEUX SEULS écrans à dessiner `entity-card` (D123). Un
 * site est un référentiel, pas une file d'événements datés : la carte, pas
 * le tableau. La zone géographique n'est plus montrée sur la carte — elle
 * sert au calcul du trajet (`trajet-zone.ts`), pas à SITUER le site, ce que
 * la commune fait déjà à la ligne au-dessus.
 *
 * ## Ce que la bande de compteurs montre, et pourquoi le rattachement s'y lit
 *
 * Le temps de trajet ne voyage jamais seul : *un nombre dont la signification
 * dépend d'une autre colonne ne voyage jamais seul* (D56), et « 45 » ne veut
 * rien dire sans « depuis où ». L'agence de rattachement est donc une LIGNE de
 * la carte, juste au-dessus de la bande de compteurs qui porte le trajet — les
 * deux informations restent voisines, comme elles l'étaient déjà côte à côte
 * dans le tableau. Et le libellé le dit encore autrement : c'est une donnée de
 * **planification**, jamais de facturation (D74).
 *
 * **Aucun compte de machines par site n'est ajouté** : `D123` nomme ce
 * manque plutôt que d'inventer une requête — aucune fonction de dépôt ne
 * compte aujourd'hui les machines d'un site.
 *
 * ## Le cloisonnement n'est pas écrit ici
 *
 * `site` est de forme « parc » : société, client, périmètre de sites. Un compte
 * de portail ne voit donc que les sites de son périmètre **sans qu'une ligne de
 * cet écran le sache** — RG-DRO-01 est tenue par la politique, et une
 * comparaison écrite ici serait une seconde lecture d'un critère que la base
 * porte déjà.
 *
 * ## LA PAGINATION (AT-07, 17/09/2026)
 *
 * `limite` (50) borne désormais chaque PAGE, jamais la recherche entière :
 * `compterSites` compte le total FILTRÉ, par la même `filtreDeRecherche` que
 * la liste — un total qui compterait autrement que ce qu'il pagine est la
 * faute nommée par le directeur d'exploitation le 16/09. L'état de la page vit
 * dans l'URL (`searchParams.page`).
 */

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
  // `limite` retombe sur son défaut (50) — la taille d'une PAGE, jamais celle
  // d'un unique chargement (AT-07).
  const criteres = schemaRechercheSite.safeParse({
    texte: typeof params.q === "string" ? params.q : "",
    client_id: typeof params.client === "string" ? params.client : null,
    page: typeof params.page === "string" ? params.page : undefined,
  });
  // `sites` ET `totalFiltre` SONT INDÉPENDANTS (lot PERF, mesuré sur
  // 4fead41) : les deux ne portent que sur `criteres`, la MÊME
  // `filtreDeRecherche` — jamais une seconde lecture divergente (AT-07).
  // `libelles`, lui, dépend du résultat de `sites` et reste donc APRÈS.
  const [sites, totalFiltre] = await Promise.all([
    criteres.success
      ? rechercherSites(session.contexte, criteres.data)
      : Promise.resolve([]),
    criteres.success
      ? compterSites(session.contexte, criteres.data)
      : Promise.resolve(0),
  ]);
  const libelles = await libellesDesSites(session.contexte, sites);
  const totalPages = Math.max(
    1,
    Math.ceil(totalFiltre / (criteres.success ? criteres.data.limite : 1)),
  );

  return (
    <Page
      chemin="/sites"
      titre={mot("site", true)}
      sousTitre={t("sites.sous_titre")}
      actions={
        <LienPrimaire href="/sites/nouveau">{t("sites.creer")}</LienPrimaire>
      }
    >
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
        className="bg-app-surface border-app-bord flex flex-wrap items-end gap-3 rounded-lg border px-4 py-3.5"
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

      {sites.length === 0 ? (
        <p className="text-app-encre-faible text-[13px]">
          {t("site.recherche.vide")}
        </p>
      ) : (
        <GrilleCartesEntites>
          {sites.map((site) => (
            <CarteSite
              key={site.id}
              site={site}
              client={libelles.clients.get(site.client_id) ?? null}
              agence={libelles.agences.get(site.agence_id) ?? null}
            />
          ))}
        </GrilleCartesEntites>
      )}

      <Pagination
        page={criteres.success ? criteres.data.page : 1}
        totalPages={totalPages}
        libelleResultats={decompte(
          totalFiltre,
          motDansUnePhrase("site"),
          motDansUnePhrase("site", true),
        )}
        libellePage={libellePage(
          criteres.success ? criteres.data.page : 1,
          totalPages,
        )}
        libellePrecedent={t("pagination.precedent")}
        libelleSuivant={t("pagination.suivant")}
        hrefPage={(page) =>
          hrefDeLaPage(
            "/sites",
            {
              q: typeof params.q === "string" ? params.q : undefined,
              client:
                typeof params.client === "string" ? params.client : undefined,
            },
            page,
          )
        }
      />
    </Page>
  );
}

function CarteSite({
  site,
  client,
  agence,
}: {
  readonly site: FicheSite;
  readonly client: string | null;
  readonly agence: string | null;
}) {
  const rattachement = agenceDuSite(agence);
  const lignes: React.ReactNode[] = [
    // LE CLIENT MÈNE À SA FICHE (14/09/2026) — le second des deux chemins
    // tranchés ce jour-là, conservé tel quel : *le geste change, le
    // comportement reste* (D123). Le libellé peut manquer (la politique a
    // refusé, ou le client n'est pas dans le périmètre) ; on ne fabrique
    // alors AUCUN lien, parce qu'un lien vers une fiche qu'on ne peut pas
    // lire rendrait un 404 là où il faut lire une absence.
    <>
      {client === null ? (
        ouTiret(null)
      ) : (
        <Link href={`/clients/${site.client_id}`} className={CLASSES_LIEN}>
          {client}
        </Link>
      )}
      {site.commune === null ? null : (
        <>
          {t("ponctuation.separateur")}
          {site.commune}
        </>
      )}
    </>,
  ];
  if (rattachement !== null) {
    lignes.push(rattachement);
  }

  return (
    <CarteEntite
      titre={
        <Link href={`/sites/${site.id}`} className={CLASSES_LIEN}>
          {site.libelle}
        </Link>
      }
      badge={
        site.actif ? null : (
          <span className="text-app-encre-faible text-[10.5px]">
            {t("sites.inactif")}
          </span>
        )
      }
      lignes={lignes}
      compteurs={[
        {
          valeur: ouTiret(site.temps_trajet_min),
          libelle: t("sites.colonne_trajet"),
        },
      ]}
    />
  );
}
