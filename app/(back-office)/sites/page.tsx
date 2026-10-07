import type { Metadata } from "next";

import Link from "next/link";
import { LienPrimaire } from "@/components/ui/action-primaire";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { CarteEntite, GrilleCartesEntites } from "@/components/ui/carte-entite";
import { Page } from "@/components/mise-en-page/page";
import { Pagination } from "@/components/ui/pagination";
import { PuceMenu, PuceVue, ResumeListe } from "@/components/ui/puces-filtre";
import { RefusAcces } from "@/components/ui/refus-acces";
import { agencesProposables } from "@/lib/agences/proposables";
import { peut } from "@/lib/auth/habilitations";
import { Role } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import {
  instantDuJour,
  jourDe,
  maintenant,
  schemaFuseau,
} from "@/lib/calendar/fuseau";
import { lireClient } from "@/lib/clients/depot";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot, motDansUnePhrase } from "@/lib/i18n/vocabulaire";
import {
  compterSites,
  habilitationsRequisesParSite,
  libellesDesSites,
  lireCatalogueTrajets,
  rechercherSites,
  resumeDesCartesSites,
  type FicheSite,
} from "@/lib/sites/depot";
import { schemaRechercheSite, type RechercheSite } from "@/lib/sites/saisie";
import { resoudreTempsTrajet, type Trajet } from "@/lib/sites/trajet-zone";
import { ZONES_GEOGRAPHIQUES } from "@/lib/sites/zones";
import { CLASSES_LIEN } from "@/lib/theme/apparence";

import { decompte, hrefDeLaPage, libellePage } from "../presentation";
import {
  chiffreMachinesSite,
  chiffreOuvertes,
  chiffreTrajet,
  chiffreVgpDepassee,
  libelleAfficherSitesMasques,
  libelleAgenceDeLaLigne,
  libelleBadgeSousContrat,
  libelleFiltreEquipement,
  libelleNouveauSite,
  libelleZone,
  ligneHabilitationsExigees,
  ouTiret,
  phraseSitesMasques,
  sousTitreSites,
} from "./presentation";

export const metadata: Metadata = { title: mot("site", true) };

/** Les quatre vues nommées (QE-10 (a), 03/10/2026) — `null` : aucune vue n'est imposée (écran ouvert depuis `client=`). */
type VueSites = "actifs" | "trajet_inconnu" | "sans_zone" | "inactifs";

function criteresDeLaVue(
  vue: VueSites | null,
): Pick<RechercheSite, "client_actif" | "sans_zone" | "trajet_inconnu"> {
  if (vue === "inactifs") {
    return { client_actif: false, sans_zone: false, trajet_inconnu: false };
  }
  if (vue === "sans_zone") {
    return { client_actif: true, sans_zone: true, trajet_inconnu: false };
  }
  if (vue === "trajet_inconnu") {
    return { client_actif: true, sans_zone: false, trajet_inconnu: true };
  }
  if (vue === "actifs") {
    return { client_actif: true, sans_zone: false, trajet_inconnu: false };
  }
  return { client_actif: null, sans_zone: false, trajet_inconnu: false };
}

/**
 * L'ÉCRAN « SITES » — reconstruit au gabarit de la maquette du 28/09
 * (9EB-TP-UX3-2-LISTES-1 ; QE-10 (a) et QE-13c, décisions d'Alexis du
 * 03/10/2026 ; D179). Le reste de la note de tête d'avant ce ticket (pas de
 * barre de navigation, D123, cloisonnement non écrit ici, pagination AT-07)
 * ne change pas.
 *
 * ## LA VUE PAR DÉFAUT, ET CELLE QUI N'EN IMPOSE AUCUNE
 *
 * Sans `vue` ni `client` dans l'adresse : « Sites des clients actifs ».
 * **Avec `client=` (un lien depuis une fiche) et SANS `vue` explicite,
 * aucune vue n'est imposée** — un client inactif garde ses sites visibles
 * depuis SA PROPRE fiche, exactement ce que `criteresDeLaVue(null)` rend :
 * `client_actif: null`. Une puce « Client : X » retirable le rappelle.
 *
 * ## LES QUATRE COMPTEURS DE PUCES — quatre `compterSites`, pas un `groupBy`
 *
 * Contrairement aux clients, les quatre vues de site ne partagent PAS un
 * même ensemble de candidats qu'un simple booléen suffirait à répartir —
 * « sans zone » et « trajet inconnu » se recouvrent partiellement, et
 * aucune n'est le complément d'une autre. Quatre lectures indépendantes,
 * mêmes recherche/masquage/contrat/zone/agence/client, parallèles.
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

  // LA LISTE DES SITES EST FERMÉE AU TECHNICIEN (QT-2, D152, choix 1).
  if (session.contexte.role === Role.technicien) {
    return (
      <Page chemin="/sites" titre={mot("site", true)}>
        <RefusAcces />
      </Page>
    );
  }

  // D153 (03/10/2026, TP-S3, CS6) — « Nouveau site » n'est offert qu'au rôle
  // que la route accepterait (`gerer_client_site`).
  const peutCreer =
    session.contexte.role !== null &&
    peut(session.contexte.role, "gerer_client_site");

  const params = await searchParams;
  const motif = params.motif;
  const avecSansEquipement = params.sans_equipement === "1";
  const sousContratSeulement = params.sous_contrat === "1";
  const clientParam = typeof params.client === "string" ? params.client : null;
  const vueParam = typeof params.vue === "string" ? params.vue : null;
  const vueEffective: VueSites | null =
    vueParam === "actifs" ||
    vueParam === "trajet_inconnu" ||
    vueParam === "sans_zone" ||
    vueParam === "inactifs"
      ? vueParam
      : clientParam === null
        ? "actifs"
        : null;
  const zoneParam =
    typeof params.zone_geo === "string" && params.zone_geo.length > 0
      ? params.zone_geo
      : undefined;
  const agenceParam =
    typeof params.agence_id === "string" && params.agence_id.length > 0
      ? params.agence_id
      : undefined;

  const criteres = schemaRechercheSite.safeParse({
    texte: typeof params.q === "string" ? params.q : "",
    client_id: clientParam,
    zone_geo: zoneParam,
    agence_id: agenceParam,
    inclure_sans_equipement: avecSansEquipement,
    sous_contrat_seulement: sousContratSeulement,
    ...criteresDeLaVue(vueEffective),
    page: typeof params.page === "string" ? params.page : undefined,
  });

  // LES PARAMÈTRES COMMUNS À TOUTE NAVIGATION DE PUCE/MENU — jamais `vue`
  // (chaque puce pose la sienne) ni `page` (retour en page 1).
  const parametresCommuns: Readonly<Record<string, string | undefined>> = {
    q: typeof params.q === "string" ? params.q : undefined,
    client: clientParam ?? undefined,
    sans_equipement: avecSansEquipement ? "1" : undefined,
    sous_contrat: sousContratSeulement ? "1" : undefined,
    zone_geo: zoneParam,
    agence_id: agenceParam,
  };

  const [
    sites,
    totalFiltre,
    compteActifs,
    compteTrajetInconnu,
    compteSansZone,
    compteInactifs,
    agencesActives,
    clientFiltre,
  ] = await Promise.all([
    criteres.success
      ? rechercherSites(session.contexte, criteres.data)
      : Promise.resolve([]),
    criteres.success
      ? compterSites(session.contexte, criteres.data)
      : Promise.resolve(0),
    criteres.success
      ? compterSites(session.contexte, {
          ...criteres.data,
          ...criteresDeLaVue("actifs"),
        })
      : Promise.resolve(0),
    criteres.success
      ? compterSites(session.contexte, {
          ...criteres.data,
          ...criteresDeLaVue("trajet_inconnu"),
        })
      : Promise.resolve(0),
    criteres.success
      ? compterSites(session.contexte, {
          ...criteres.data,
          ...criteresDeLaVue("sans_zone"),
        })
      : Promise.resolve(0),
    criteres.success
      ? compterSites(session.contexte, {
          ...criteres.data,
          ...criteresDeLaVue("inactifs"),
        })
      : Promise.resolve(0),
    avecContexteApplicatif(session.contexte, (tx) => agencesProposables(tx)),
    clientParam === null
      ? Promise.resolve(null)
      : lireClient(session.contexte, clientParam),
  ]);

  // LE MASQUAGE LISTES-1 (I-16/CS7) — même troisième lecture indépendante
  // qu'avant ce ticket.
  const totalAvecSansEquipement =
    criteres.success && !avecSansEquipement
      ? await compterSites(session.contexte, {
          ...criteres.data,
          inclure_sans_equipement: true,
        })
      : 0;
  const nombreSitesMasques = avecSansEquipement
    ? 0
    : totalAvecSansEquipement - totalFiltre;

  const [libelles, habilitations, catalogueTrajets, societe] =
    await Promise.all([
      libellesDesSites(session.contexte, sites),
      habilitationsRequisesParSite(session.contexte, sites),
      lireCatalogueTrajets(session.contexte),
      avecContexteApplicatif(session.contexte, (tx) =>
        tx.societe.findFirst({ select: { fuseau_horaire: true } }),
      ),
    ]);
  const fuseau = schemaFuseau.parse(societe?.fuseau_horaire);
  const aujourdHui = instantDuJour(jourDe(maintenant(fuseau).local));
  const resume = await resumeDesCartesSites(
    session.contexte,
    sites,
    aujourdHui,
  );

  const totalPages = Math.max(
    1,
    Math.ceil(totalFiltre / (criteres.success ? criteres.data.limite : 1)),
  );

  const hrefAfficherSitesMasques = hrefVueSites(
    parametresCommuns,
    vueEffective,
  );
  const hrefAfficherSitesMasquesAvecCase = `${hrefAfficherSitesMasques}${hrefAfficherSitesMasques.includes("?") ? "&" : "?"}sans_equipement=1`;

  return (
    <Page
      chemin="/sites"
      titre={mot("site", true)}
      sousTitre={sousTitreSites()}
      actions={
        peutCreer ? (
          <LienPrimaire href="/sites/nouveau">
            {libelleNouveauSite()}
          </LienPrimaire>
        ) : undefined
      }
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-13 font-bold"
        >
          {t(motif)}
        </p>
      ) : null}

      <form
        method="get"
        className="bg-app-surface border-app-bord flex flex-wrap items-end gap-3 rounded-lg border px-4 py-3.5"
      >
        <label className="flex flex-col gap-1 text-[12px] font-bold">
          {t("sites.recherche")}
          <input
            type="search"
            name="q"
            defaultValue={typeof params.q === "string" ? params.q : ""}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
          />
        </label>
        {/* L'ÉTAT DE LA VUE ET DU CLIENT FILTRÉ VOYAGENT AVEC LE FORMULAIRE —
            une recherche relancée garde la vue active. */}
        {vueParam !== null ? (
          <input type="hidden" name="vue" value={vueParam} />
        ) : null}
        {clientParam !== null ? (
          <input type="hidden" name="client" value={clientParam} />
        ) : null}
        <label className="flex items-center gap-1.5 self-end pb-2 text-13 font-bold">
          <input
            type="checkbox"
            name="sans_equipement"
            value="1"
            defaultChecked={avecSansEquipement}
          />
          {libelleFiltreEquipement()}
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-bold">
          {t("sites.menu_zone")}
          <select
            name="zone_geo"
            defaultValue={zoneParam ?? ""}
            className="border-app-bord bg-app-surface h-[40px] rounded-[9px] border px-3 text-13 font-bold"
          >
            <option value="">{t("sites.menu_toutes")}</option>
            {ZONES_GEOGRAPHIQUES.map((zone) => (
              <option key={zone} value={zone}>
                {t(`site.zone.${zone}`)}
              </option>
            ))}
          </select>
        </label>
        {agencesActives.length > 1 ? (
          <label className="flex flex-col gap-1 text-[12px] font-bold">
            {mot("agence")}
            <select
              name="agence_id"
              defaultValue={agenceParam ?? ""}
              className="border-app-bord bg-app-surface h-[40px] rounded-[9px] border px-3 text-13 font-bold"
            >
              <option value="">{t("sites.menu_toutes")}</option>
              {agencesActives.map((agence) => (
                <option key={agence.id} value={agence.id}>
                  {agence.libelle}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          type="submit"
          className="border-app-bord rounded-md border px-4 py-2 text-[13px] font-bold"
        >
          {t("sites.rechercher")}
        </button>
      </form>

      <div
        aria-label={t("sites.puces_aria")}
        className="flex flex-wrap items-center gap-2"
      >
        <PuceVue
          libelle={`${mot("site", true)} ${t("sites.vue_actifs_suffixe")}`}
          compteur={compteActifs}
          actif={vueEffective === "actifs"}
          href={hrefVueSites(parametresCommuns, "actifs")}
        />
        <PuceVue
          libelle={t("sites.vue_trajet_inconnu")}
          compteur={compteTrajetInconnu}
          actif={vueEffective === "trajet_inconnu"}
          href={hrefVueSites(parametresCommuns, "trajet_inconnu")}
        />
        <PuceVue
          libelle={t("sites.sans_zone")}
          compteur={compteSansZone}
          actif={vueEffective === "sans_zone"}
          href={hrefVueSites(parametresCommuns, "sans_zone")}
        />
        <PuceVue
          libelle={t("sites.vue_clients_inactifs")}
          compteur={compteInactifs}
          actif={vueEffective === "inactifs"}
          href={hrefVueSites(parametresCommuns, "inactifs")}
        />
        {/* « SOUS CONTRAT » — une puce À BASCULE après les quatre vues
            (CONTRAT-SITE-1, `sous_contrat=1` inchangé) : écart nommé face à
            la maquette, qui ne porte pas ce filtre (D179). */}
        <PuceVue
          libelle={t("sites.filtre_contrat")}
          compteur={
            criteres.success
              ? await compterSites(session.contexte, {
                  ...criteres.data,
                  sous_contrat_seulement: true,
                })
              : 0
          }
          actif={sousContratSeulement}
          href={hrefBascule(
            parametresCommuns,
            vueParam,
            "sous_contrat",
            !sousContratSeulement,
          )}
        />
        {clientFiltre === null ? null : (
          <PuceMenu
            libelle={t("client.titre")}
            valeur={clientFiltre.raison_sociale}
            href={hrefVueSites(
              { ...parametresCommuns, client: undefined },
              vueEffective,
            )}
          />
        )}
      </div>

      <ResumeListe
        texte={decompte(
          totalFiltre,
          motDansUnePhrase("site"),
          motDansUnePhrase("site", true),
        )}
        complement={
          <>
            {t("ponctuation.point_median")}
            {t("sites.resume_ordre_prefixe")} {motDansUnePhrase("site")}
          </>
        }
      />

      {nombreSitesMasques > 0 ? (
        <p className="text-app-encre-faible text-13 font-bold">
          {phraseSitesMasques(nombreSitesMasques)}
          {t("ponctuation.point_median")}
          <Link
            href={hrefAfficherSitesMasquesAvecCase}
            className={CLASSES_LIEN}
          >
            {libelleAfficherSitesMasques()}
          </Link>
        </p>
      ) : null}

      {sites.length === 0 ? (
        <p className="text-app-encre-faible text-[13px] font-bold">
          {t("site.recherche.vide")}
        </p>
      ) : (
        <GrilleCartesEntites>
          {sites.map((site) => (
            <CarteSite
              key={site.id}
              site={site}
              client={libelles.clients.get(site.client_id) ?? null}
              clientActif={libelles.clientsActifs.get(site.client_id) ?? null}
              agence={libelles.agences.get(site.agence_id) ?? null}
              nombreHabilitations={habilitations.get(site.id) ?? 0}
              trajet={resoudreTempsTrajet(site, catalogueTrajets)}
              resume={resume.get(site.id)}
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
              client: clientParam ?? undefined,
              vue: vueParam ?? undefined,
              sans_equipement: avecSansEquipement ? "1" : undefined,
              sous_contrat: sousContratSeulement ? "1" : undefined,
              zone_geo: zoneParam,
              agence_id: agenceParam,
            },
            page,
          )
        }
      />
    </Page>
  );
}

/** L'adresse d'une vue : les paramètres communs, PUIS `vue` (`null` : omise — le cas « aucune vue imposée »). */
function hrefVueSites(
  parametresCommuns: Readonly<Record<string, string | undefined>>,
  vue: VueSites | null,
): string {
  const recherche = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(parametresCommuns)) {
    if (valeur !== undefined && valeur.length > 0) {
      recherche.set(cle, valeur);
    }
  }
  if (vue !== null) {
    recherche.set("vue", vue);
  }
  return `/sites?${recherche.toString()}`;
}

/** L'adresse d'une puce à bascule (CONTRAT-SITE-1) : les paramètres communs, la vue, PUIS le critère à bascule. */
function hrefBascule(
  parametresCommuns: Readonly<Record<string, string | undefined>>,
  vue: string | null,
  cle: string,
  valeur: boolean,
): string {
  const recherche = new URLSearchParams();
  for (const [c, v] of Object.entries(parametresCommuns)) {
    if (v !== undefined && v.length > 0 && c !== cle) {
      recherche.set(c, v);
    }
  }
  if (vue !== null) {
    recherche.set("vue", vue);
  }
  if (valeur) {
    recherche.set(cle, "1");
  }
  return `/sites?${recherche.toString()}`;
}

function CarteSite({
  site,
  client,
  clientActif,
  agence,
  nombreHabilitations,
  trajet,
  resume,
}: {
  readonly site: FicheSite;
  readonly client: string | null;
  /** `null` : le client n'a pas été résolu (hors périmètre), comme `client` ci-dessus. */
  readonly clientActif: boolean | null;
  readonly agence: string | null;
  readonly nombreHabilitations: number;
  readonly trajet: Trajet;
  readonly resume:
    | {
        readonly nombreMachines: number;
        readonly nombreOuvertes: number;
        readonly vgpDepassee: number;
      }
    | undefined;
}) {
  const ligneHabilitations = ligneHabilitationsExigees(nombreHabilitations);
  const zoneConnue = site.zone_geo !== null;
  const vgp = chiffreVgpDepassee(resume?.vgpDepassee ?? 0);
  return (
    <CarteEntite
      href={`/sites/${site.id}`}
      titre={
        client === null ? (
          ouTiret(null)
        ) : site.libelle === client ? (
          client
        ) : (
          <>
            <span className="text-app-encre-faible">{client}</span>
            {t("ponctuation.separateur")}
            {site.libelle}
          </>
        )
      }
      badge={
        <>
          {site.actif ? null : (
            <span className="text-app-encre-faible text-12 font-bold block">
              {t("sites.inactif")}
            </span>
          )}
          {clientActif === false ? (
            <span className="text-app-encre-faible text-12 font-bold block">
              {t("clients.inactif")}
            </span>
          ) : null}
          {site.sous_contrat ? (
            <Badge ton="bleu">{libelleBadgeSousContrat()}</Badge>
          ) : null}
        </>
      }
      lignes={[
        ouTiret(
          site.commune === null && site.adresse === null ? null : site.commune,
        ),
        zoneConnue ? (
          <>
            {libelleZone(site.zone_geo)}
            {t("ponctuation.point_median")}
            {agence === null ? ouTiret(null) : libelleAgenceDeLaLigne(agence)}
          </>
        ) : (
          <>
            <span className="text-app-orange-encre">
              {libelleZone(site.zone_geo)}
            </span>
            {t("ponctuation.point_median")}
            {agence === null ? ouTiret(null) : libelleAgenceDeLaLigne(agence)}
          </>
        ),
        ...(ligneHabilitations === null ? [] : [ligneHabilitations]),
      ]}
      compteurs={[]}
      chiffres={[
        // `id` sur chaque chiffre (REPRISE-3) : la prise stable qu'un
        // scénario de bout en bout vise, plutôt qu'un compte total de `<b>`.
        { ...chiffreMachinesSite(resume?.nombreMachines ?? 0), id: "machines" },
        { ...chiffreOuvertes(resume?.nombreOuvertes ?? 0), id: "ouvertes" },
        { ...chiffreTrajet(trajet), id: "trajet" },
        ...(vgp === null ? [] : [{ ...vgp, id: "vgp-depassee" }]),
      ]}
    />
  );
}
