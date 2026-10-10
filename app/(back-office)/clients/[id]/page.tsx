import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache, type ReactNode } from "react";
import { z } from "zod";

import { Page } from "@/components/mise-en-page/page";
import {
  ActionPrimaire,
  BarreActionCollee,
  LienPrimaire,
} from "@/components/ui/action-primaire";
import { BlocATraiter, type LigneATraiter } from "@/components/ui/a-traiter";
import { Badge } from "@/components/ui/badge";
import { BandeauEtat } from "@/components/ui/bandeau-etat";
import { Button } from "@/components/ui/button";
import { CarteEntite, GrilleCartesEntites } from "@/components/ui/carte-entite";
import { ColonneContexte } from "@/components/ui/colonne-contexte";
import { EnTeteFiche, type FaitFiche } from "@/components/ui/entete-fiche";
import { Onglets, type EtatOnglet } from "@/components/ui/onglets";
import { Pagination } from "@/components/ui/pagination";
import { BandeauMotif } from "@/components/ui/bandeau-motif";
import { Kpi } from "@/components/ui/kpi";
import { RefusAcces } from "@/components/ui/refus-acces";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { peut } from "@/lib/auth/habilitations";
import { Role } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import {
  dateCivile,
  instantDuJour,
  jourDe,
  maintenant,
  schemaFuseau,
} from "@/lib/calendar/fuseau";
import { destinataireClient } from "@/lib/avertissements/planification";
import {
  libelleCodeExterne,
  libelleCodeExterneDeLaSociete,
  lireClient,
} from "@/lib/clients";
import { sitesParClient } from "@/lib/clients/depot";
import { contactsDuClient } from "@/lib/contacts/depot";
import {
  compterInterventionsDuClient,
  dernieresInterventionsDuClient,
  derniereInterventionDuClient,
  interventionsATraiterDuClient,
  interventionsEmpechantDesactivationDuClient,
  interventionsOuvertesDuClient,
  prochaineInterventionDuClient,
  type LigneBloquantDesactivation,
  type LignePlanning,
} from "@/lib/interventions/depot";
import {
  compterLeParc,
  donneesMaterielDesMachines,
  rechercherLeParc,
  resumerLeParcFiltre,
  type LigneDeParc,
} from "@/lib/machines/depot";
import type { RechercheParc } from "@/lib/machines/saisie";
import { libelleMaterielComplet } from "@/lib/machines/presentation";
import { equipementsParSite, resumeDesCartesSites } from "@/lib/sites/depot";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estUuid } from "@/lib/identifiant";
import { trierAlphanumeriquement } from "@/lib/tri/collation";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { CLASSES_STATUT } from "@/lib/theme/statuts";

import {
  BlocContacts,
  saisieContactGardeeDepuis,
} from "../../contacts/presentation";
import {
  decompte,
  hrefDeLaPage,
  libellePage,
  libelleDestinataireCourriels,
  ouTiret,
} from "../../presentation";
import {
  machinesIdentifiees,
  referenceAffichee,
} from "../../interventions/presentation";
import {
  compteurContrat,
  compteurEquipements,
  libelleBadgeSousContrat,
} from "../../sites/presentation";
import {
  communeDuClient,
  detailTuileMachines,
  detailTuileSitesZero,
} from "../presentation";

/** La clé de refus de QT-16 (D165) — la LISTE qui l'accompagne n'est lue que pour elle. */
const MOTIF_REFUS_INTERVENTIONS_OUVERTES =
  "client.refus.interventions_ouvertes";

/**
 * LA FICHE D'UN CLIENT, AU GABARIT DU 28/09 (9EF-TP-UX4-2-FICHES-1, D191) —
 * en-tête à faits, cinq tuiles cliquables (D140, décision 52), six onglets,
 * identité en lecture derrière « Modifier ».
 *
 * ## CE QUI N'A PAS CHANGÉ
 *
 * Aucune règle de gestion, aucun droit, aucune route POST. `lireClient` lit
 * sous le contexte cloisonné — une fiche hors périmètre et une fiche
 * inexistante rendent LA MÊME chose (D35, D50). L'historique reste paginé
 * CÔTÉ BASE (HISTORIQUE-CLIENT-1) ; les contacts restent TOUS ceux du client,
 * siens et ceux de ses sites (CONTACTS-1).
 *
 * ## LES ONGLETS
 *
 * `?onglet=` en liste fermée (`VALEURS_ONGLET_CLIENT`) — une valeur absente ou
 * hors liste retombe sur Aperçu, jamais une page qui refuse de s'afficher
 * (D50). « Identité » n'existe que pour qui peut écrire la fiche
 * (`peutGererSite`, D153).
 */

/** Combien d'interventions une PAGE de l'onglet « Toutes » montre. */
const INTERVENTIONS_PAR_PAGE = 12;
/** La borne du bloc « À traiter » (décision 26 d'Alexis, 05/10/2026). */
const BORNE_A_TRAITER = 5;
/** La borne de l'aperçu « Historique », dans la même colonne (même décision). */
const BORNE_HISTORIQUE_APERCU = 5;
/** La borne de l'onglet « Interventions », puce « Ouvertes » — un aperçu large, jamais un plafond métier. */
const BORNE_INTERVENTIONS_OUVERTES = 200;

/** `page` — un entier d'au moins 1 ; toute valeur absente ou invalide retombe sur la première. */
const schemaPage = z.coerce.number().int().min(1).catch(1);

const VALEURS_ONGLET_CLIENT = [
  "apercu",
  "sites",
  "parc",
  "interventions",
  "interlocuteurs",
  "identite",
] as const;
type OngletClient = (typeof VALEURS_ONGLET_CLIENT)[number];

function ongletDuClient(
  valeur: string | string[] | undefined,
  peutVoirIdentite: boolean,
): OngletClient {
  const brut = Array.isArray(valeur) ? valeur[0] : valeur;
  if (!(VALEURS_ONGLET_CLIENT as readonly string[]).includes(brut ?? "")) {
    return "apercu";
  }
  if (brut === "identite" && !peutVoirIdentite) {
    return "apercu";
  }
  return brut as OngletClient;
}

const VALEURS_ETAT_INTERVENTIONS = ["ouvertes", "toutes"] as const;
type EtatInterventions = (typeof VALEURS_ETAT_INTERVENTIONS)[number];

function etatInterventionsDuClient(
  valeur: string | string[] | undefined,
): EtatInterventions {
  const brut = Array.isArray(valeur) ? valeur[0] : valeur;
  return (VALEURS_ETAT_INTERVENTIONS as readonly string[]).includes(brut ?? "")
    ? (brut as EtatInterventions)
    : "toutes";
}

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
  if (!estUuid(id)) {
    return { title: t("client.titre") };
  }
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

  // LA FICHE CLIENT EST FERMÉE AU TECHNICIEN (QT-2, D152, choix 1) — il lit
  // le client depuis la fiche de SES interventions, déjà restreinte.
  if (session.contexte.role === Role.technicien) {
    return (
      <Page chemin="/clients" titre={t("client.titre")}>
        <RefusAcces />
      </Page>
    );
  }

  const { id } = await params;
  // UN IDENTIFIANT MAL FORMÉ EST UN REFUS, JAMAIS UNE PANNE
  // (9EJ-CORRECTIFS-AUDIT-TUILES-ID) — `lireClientCache` transmettrait la
  // chaîne telle quelle à Postgres, qui refuse un uuid invalide par une
  // erreur 500 plutôt que par l'absence attendue (D35, D50).
  if (!estUuid(id)) {
    notFound();
  }
  const paramsResolus = await searchParams;
  const motif = paramsResolus.motif;
  const saisieContactGardee = saisieContactGardeeDepuis(paramsResolus);
  const client = await lireClientCache(session.contexte, id);
  if (client === null) {
    notFound();
  }
  const page = schemaPage.parse(
    typeof paramsResolus.page === "string" ? paramsResolus.page : undefined,
  );

  // LES ACTIONS EN CONTEXTE (FICHE-360-1) — visibles selon les MÊMES
  // capacités que les routes qu'elles ouvrent.
  const peutGererSite =
    session.contexte.role !== null &&
    peut(session.contexte.role, "gerer_client_site");
  const peutCreerIntervention =
    session.contexte.role !== null &&
    peut(session.contexte.role, "creer_demande");

  const onglet = ongletDuClient(paramsResolus.onglet, peutGererSite);
  const etatInterventions = etatInterventionsDuClient(paramsResolus.etat);

  const libelleSociete = await libelleCodeExterneDeLaSociete(session.contexte);
  const societe = await avecContexteApplicatif(session.contexte, (tx) =>
    tx.societe.findFirst({
      where: { id: session.contexte.societeId as string },
      select: { fuseau_horaire: true },
    }),
  );
  const fuseau = schemaFuseau.parse(societe?.fuseau_horaire);
  const aujourdHui = instantDuJour(jourDe(maintenant(fuseau).local));

  const sitesBruts = await avecContexteApplicatif(session.contexte, (tx) =>
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
    }),
  );
  // TRIÉ EN JS, JAMAIS PAR `ORDER BY` (CS19, LISTES-1) : voir
  // `lib/tri/collation.ts` — l'ordre alphanumérique d'un référentiel ne
  // dépend pas de la collation de la base qui répond.
  const sites = trierAlphanumeriquement(
    sitesBruts,
    (site) => site.libelle,
    (site) => site.id,
  );
  const contacts = await contactsDuClient(session.contexte, client.id);
  // LE DESTINATAIRE DES COURRIELS DE PLANIFICATION (CS45, QT-16, D165) — le
  // donneur d'ordre du CLIENT LUI-MÊME, jamais celui d'un de ses sites :
  // `siteId: null` fait retomber `destinataireClient` sur cette seule
  // branche (voir son commentaire, `lib/avertissements/planification.ts`).
  const destinataireCourriels = destinataireClient(contacts, null);
  // LA LISTE QUI JUSTIFIE UN REFUS DE DÉSACTIVATION DÉJÀ SURVENU (QT-16,
  // D165) — lue SEULEMENT quand le motif de redirection le demande : le canal
  // de redirection ne porte qu'une clé (D50), jamais la liste elle-même.
  const interventionsBloquantes: readonly LigneBloquantDesactivation[] =
    motif === MOTIF_REFUS_INTERVENTIONS_OUVERTES
      ? await interventionsEmpechantDesactivationDuClient(
          session.contexte,
          client.id,
        )
      : [];
  const [interventions, totalInterventions] = await Promise.all([
    dernieresInterventionsDuClient(
      session.contexte,
      client.id,
      INTERVENTIONS_PAR_PAGE,
      onglet === "interventions" && etatInterventions === "toutes" ? page : 1,
    ),
    compterInterventionsDuClient(session.contexte, client.id),
  ]);
  const totalPagesInterventions = Math.max(
    1,
    Math.ceil(totalInterventions / INTERVENTIONS_PAR_PAGE),
  );

  const aTraiter = await interventionsATraiterDuClient(
    session.contexte,
    client.id,
    onglet === "interventions" && etatInterventions === "ouvertes"
      ? BORNE_INTERVENTIONS_OUVERTES
      : BORNE_A_TRAITER,
  );

  // LA SYNTHÈSE EN TÊTE (FICHE-360-1, revue 9EF-1) — uniquement des faits
  // déjà en base.
  const [
    equipementsParSiteMap,
    sitesResume,
    sitesDuClient,
    interventionsOuvertes,
    derniereIntervention,
    prochaineIntervention,
    donneesMaterielHistorique,
  ] = await Promise.all([
    equipementsParSite(session.contexte, sites),
    resumeDesCartesSites(session.contexte, sites, aujourdHui),
    sitesParClient(session.contexte, [client]),
    interventionsOuvertesDuClient(session.contexte, client.id),
    derniereInterventionDuClient(session.contexte, client.id),
    prochaineInterventionDuClient(session.contexte, client.id, aujourdHui),
    // LA MACHINE DE CHAQUE INTERVENTION DES LISTES AFFICHÉES
    // (GR11-CLIENT-MACHINE, audit G14 du 26/09/2026) — UNE lecture groupée,
    // jamais une requête par ligne.
    donneesMaterielDesMachines(session.contexte, [
      ...interventions.flatMap((ligne) =>
        ligne.machines.map((m) => m.machine_id),
      ),
      ...aTraiter.flatMap((ligne) => ligne.machines.map((m) => m.machine_id)),
    ]),
  ]);
  const libellesMachinesHistorique = new Map(
    [...donneesMaterielHistorique].map(([machineId, donnees]) => [
      machineId,
      libelleMaterielComplet(donnees),
    ]),
  );
  const sitesActifs = sites.filter((site) => site.actif).length;

  // LA TUILE « MACHINES » (décision 52, D140) — `chiffre = lignes`,
  // CORRIGÉ (9EJ) pour que le lien ouvre EXACTEMENT ce que le chiffre
  // compte : `vue=parc` (sorties exclues), jamais le total brut.
  const criteresTuileMachines: RechercheParc = {
    texte: null,
    statut: "tous",
    client_id: client.id,
    site_id: null,
    famille_id: null,
    vue: "parc",
    incompletes: false,
    ajoutee_du: null,
    ajoutee_au: null,
    origine: null,
    page: 1,
  };
  const [nombreMachines, resumeMachines] = await Promise.all([
    compterLeParc(session.contexte, criteresTuileMachines, aujourdHui),
    resumerLeParcFiltre(session.contexte, criteresTuileMachines, aujourdHui),
  ]);

  // L'ONGLET « PARC » — première page du parc filtré sur ce client, jamais
  // une seconde lecture du critère de `/parc` (§9, 01/09).
  const parcDuClient: readonly LigneDeParc[] =
    onglet === "parc"
      ? await rechercherLeParc(
          session.contexte,
          criteresTuileMachines,
          aujourdHui,
        )
      : [];

  // « DONNEUR D'ORDRE » EN TÊTE (FICHE-360-1) — `roles` porte plusieurs
  // rôles à la fois (L1-03), et un `sort` par booléen reste STABLE (moteur
  // V8) : l'ordre relatif des autres contacts n'est jamais perturbé.
  const contactsTries = [...contacts].sort(
    (a, b) =>
      Number(b.roles.includes("donneur_ordre")) -
      Number(a.roles.includes("donneur_ordre")),
  );

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
    { cle: "site", libelle: mot("site") },
    {
      cle: "machine",
      libelle: t("intervention.machine"),
      largeur: "220px",
    },
    { cle: "statut", libelle: t("intervention.statut"), largeur: "150px" },
  ];

  const faitsFiche: readonly FaitFiche[] = [
    {
      cle: "commune",
      icone: "pin",
      libelle: t("site.commune"),
      valeur: communeDuClient(sitesDuClient.get(client.id)),
    },
    {
      cle: "categorie",
      icone: "tag",
      libelle: t("client.categorie"),
      valeur: client.categorie ?? t("parc.non_renseigne"),
    },
    {
      cle: "commercial_referent",
      icone: "badge",
      libelle: t("client.commercial_referent"),
      valeur: client.commercial_referent ?? t("parc.non_renseigne"),
    },
    {
      cle: "reglement",
      icone: "coins",
      libelle: t("client.conditions_reglement"),
      valeur: client.conditions_reglement ?? t("parc.non_renseigne"),
    },
  ];

  const ongletsElements: readonly EtatOnglet[] = [
    {
      libelle: t("clients.fiche.onglet.apercu"),
      href: `/clients/${client.id}`,
      actif: onglet === "apercu",
    },
    {
      libelle: mot("site", true),
      href: `/clients/${client.id}?onglet=sites`,
      compte: sites.length,
      actif: onglet === "sites",
    },
    {
      libelle: t("clients.fiche.onglet.parc"),
      href: `/clients/${client.id}?onglet=parc`,
      compte: nombreMachines,
      actif: onglet === "parc",
    },
    {
      libelle: t("intervention.titre"),
      href: `/clients/${client.id}?onglet=interventions`,
      compte: totalInterventions,
      actif: onglet === "interventions",
    },
    {
      libelle: t("sites.fiche.contacts"),
      href: `/clients/${client.id}?onglet=interlocuteurs`,
      compte: contacts.length,
      actif: onglet === "interlocuteurs",
    },
    ...(peutGererSite
      ? [
          {
            libelle: t("clients.fiche.identite"),
            href: `/clients/${client.id}?onglet=identite`,
            actif: onglet === "identite",
          },
        ]
      : []),
  ];

  const lignesATraiter: readonly LigneATraiter[] = aTraiter.map((ligne) => ({
    id: ligne.id,
    ton: "avertissement",
    titre: `${t(`type_intervention.${ligne.type}`)}${t("ponctuation.point_median")}${machinesEnTexte(ligne, libellesMachinesHistorique)}`,
    detail: `${referenceAffichee(ligne)}${t("ponctuation.point_median")}${
      ligne.date_planifiee === null
        ? t("statut.a_planifier")
        : dateCivile(ligne.date_planifiee)
    }`,
    href: `/interventions/${ligne.id}?depuis=client`,
  }));

  return (
    <Page
      chemin="/clients"
      surtitre={`${t("clients.fiche.mot_singulier")}${t("ponctuation.point_median")}${client.code_externe ?? ouTiret(null)}`}
      titre={client.raison_sociale}
      pastilles={
        <Badge ton={client.actif ? "vert" : "gris"}>
          {client.actif ? t("clients.filtre.actifs") : t("clients.inactif")}
        </Badge>
      }
      faits={<EnTeteFiche faits={faitsFiche} />}
      // FIL D'ARIANE (FICHE-360-1) — `Clients › <client>` ; l'écran courant
      // n'est jamais un lien, voir `components/mise-en-page/page.tsx`.
      filAriane={[
        { libelle: t("fil_ariane.clients"), href: "/clients" },
        { libelle: client.raison_sociale },
      ]}
      className="max-[900px]:pb-[170px]"
      actions={
        <>
          {/* CS15 (QT-16, D165) — masquées sur un client inactif, même pour
              un rôle qui en aurait la capacité : la raison se lit plus bas,
              en clair. */}
          {peutGererSite && client.actif ? (
            <Button asChild variant="outline" className="max-[900px]:hidden">
              <Link href={`/sites/nouveau?client=${client.id}`}>
                {t("action.ajouter")} {mot("site")}
              </Link>
            </Button>
          ) : null}
          {peutCreerIntervention && client.actif ? (
            <BarreActionCollee>
              <LienPrimaire
                href={`/interventions/nouvelle?client=${client.id}`}
                className="w-full min-[901px]:w-fit"
              >
                {t("clients.action.ajouter_intervention")}
              </LienPrimaire>
            </BarreActionCollee>
          ) : null}
        </>
      }
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <BandeauMotif motif={motif}>
          {t(motif)}
          {/* LA LISTE QUI JUSTIFIE LE REFUS (QT-16, D165) — des liens vers les
              fiches, jamais le motif technique ; voir `interventionsBloquantes`
              plus haut. */}
          {motif === MOTIF_REFUS_INTERVENTIONS_OUVERTES &&
          interventionsBloquantes.length > 0 ? (
            <>
              <p className="mt-1.5">
                {t("clients.fiche.interventions_bloquantes")}
              </p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {interventionsBloquantes.map((ligne) => (
                  <li key={ligne.id}>
                    <Link
                      href={`/interventions/${ligne.id}`}
                      className={CLASSES_LIEN}
                    >
                      {referenceAffichee(ligne)}
                    </Link>
                    {t("ponctuation.separateur")}
                    {t(`statut.${ligne.statut}`)}
                    {ligne.date_planifiee === null
                      ? null
                      : `${t("ponctuation.separateur")}${dateCivile(ligne.date_planifiee)}`}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </BandeauMotif>
      ) : null}

      {/* CS15 (QT-16, D165) — dit en clair pourquoi les deux actions
          ci-dessus manquent pour un rôle qui les aurait sinon. */}
      {!client.actif && (peutGererSite || peutCreerIntervention) ? (
        <p
          data-aide="client-inactif-actions"
          className="text-app-encre-faible text-13 font-bold"
        >
          {t("clients.fiche.actions_masquees_inactif")}
        </p>
      ) : null}

      {!client.actif ? (
        <BandeauEtat
          ton="avertissement"
          titre={t("clients.fiche.inactif_bandeau")}
        />
      ) : null}

      {/* CS45 (QT-16, D165) — qui reçoit les courriels de planification de ce
          client, calculé par `destinataireClient` (RÉUTILISÉE), jamais
          recopié. VISIBLE quel que soit l'onglet, comme le motif ci-dessus. */}
      <p
        data-aide="destinataire-courriels"
        className="text-app-encre-faible text-13 font-bold"
      >
        {libelleDestinataireCourriels(destinataireCourriels)}
      </p>

      <GrilleCartesEntites>
        <div data-compteur="sites-actifs">
          <Kpi
            ton="bleu"
            icone="pin"
            libelle={mot("site", true)}
            valeur={sitesActifs}
            href={
              sitesActifs > 0 ? `/clients/${client.id}?onglet=sites` : undefined
            }
            detail={
              sitesActifs > 0
                ? sites
                    .map((s) => s.libelle)
                    .slice(0, 3)
                    .join(t("ponctuation.point_median"))
                : detailTuileSitesZero()
            }
          />
        </div>
        <div data-compteur="equipements">
          <Kpi
            ton="bleu"
            icone="machine"
            libelle={t("clients.fiche.synthese.equipements")}
            valeur={nombreMachines}
            href={
              nombreMachines > 0
                ? `/parc?client=${client.id}&vue=parc`
                : undefined
            }
            detail={detailTuileMachines(
              nombreMachines,
              resumeMachines.enPanneOuArretees,
            )}
          />
        </div>
        <div data-compteur="interventions-ouvertes">
          <Kpi
            ton={interventionsOuvertes > 0 ? "orange" : "vert"}
            icone="clock"
            libelle={t("clients.fiche.synthese.interventions_ouvertes")}
            valeur={interventionsOuvertes}
            href={
              interventionsOuvertes > 0
                ? `/clients/${client.id}?onglet=interventions&etat=ouvertes`
                : undefined
            }
            detail={
              interventionsOuvertes > 0
                ? undefined
                : t("clients.fiche.synthese.ouvertes_zero")
            }
          />
        </div>
        <div data-compteur="prochaine-intervention">
          <Kpi
            ton="bleu"
            icone="calendar"
            libelle={t("clients.fiche.synthese.prochaine_intervention")}
            valeur={
              prochaineIntervention === null ? (
                ouTiret(null)
              ) : (
                <Link
                  href={`/interventions/${prochaineIntervention.id}?depuis=client`}
                  className={CLASSES_LIEN}
                >
                  {dateCivile(prochaineIntervention.date_planifiee!)}
                </Link>
              )
            }
            detail={detailTypeIntervention(prochaineIntervention)}
          />
        </div>
        <div data-compteur="derniere-intervention">
          <Kpi
            ton="bleu"
            icone="history"
            libelle={t("clients.fiche.synthese.derniere_intervention")}
            valeur={
              derniereIntervention === null ? (
                ouTiret(null)
              ) : (
                <Link
                  href={`/interventions/${derniereIntervention.id}?depuis=client`}
                  className={CLASSES_LIEN}
                >
                  {derniereIntervention.date_planifiee === null
                    ? ouTiret(null)
                    : dateCivile(derniereIntervention.date_planifiee)}
                </Link>
              )
            }
            detail={detailTypeIntervention(derniereIntervention)}
          />
        </div>
      </GrilleCartesEntites>

      <Onglets
        libelleAria={t("client.titre")}
        dataNav="onglets-client"
        elements={ongletsElements}
      />

      {onglet === "apercu" ? (
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_300px]">
          <div className="flex flex-col gap-4">
            {lignesATraiter.length === 0 ? null : (
              <BlocATraiter
                titre={t("clients.fiche.a_traiter.titre")}
                lignes={lignesATraiter}
                lienVoirPlus={{
                  href: `/clients/${client.id}?onglet=interventions&etat=ouvertes`,
                  libelle: t("clients.fiche.a_traiter.tout_voir"),
                }}
              />
            )}

            <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
              <h2 className="text-[13px] font-bold">{mot("site", true)}</h2>
              {sites.length === 0 ? (
                <p className="text-app-encre-faible text-13 font-bold">
                  {t("clients.fiche.sites_vide")}
                </p>
              ) : (
                <div
                  className="grid gap-3.5 max-[900px]:grid-cols-1"
                  style={{ gridTemplateColumns: "repeat(2, 1fr)" }}
                >
                  {sites.map((site) => {
                    const resume = sitesResume.get(site.id);
                    const compteContrat = compteurContrat(site.sous_contrat);
                    return (
                      <CarteEntite
                        key={site.id}
                        href={`/sites/${site.id}`}
                        titre={site.libelle}
                        badge={
                          <>
                            {compteContrat === null ? null : (
                              <Badge ton="bleu">
                                {libelleBadgeSousContrat()}
                              </Badge>
                            )}
                            {site.actif ? null : (
                              <Badge ton="gris">{t("sites.inactif")}</Badge>
                            )}
                          </>
                        }
                        lignes={[ouTiret(site.commune)]}
                        compteurs={[]}
                        chiffres={[
                          {
                            valeur: resume?.nombreMachines ?? 0,
                            libelle: t("clients.fiche.synthese.equipements"),
                          },
                          {
                            valeur: resume?.nombreOuvertes ?? 0,
                            libelle: t(
                              "clients.fiche.synthese.interventions_ouvertes",
                            ),
                          },
                        ]}
                      />
                    );
                  })}
                </div>
              )}
            </section>

            <section
              id="historique-client"
              data-bloc="historique-client-apercu"
              className="bg-app-surface border-app-bord overflow-hidden rounded-lg border"
            >
              <h2 className="border-app-bord border-b px-4 py-3 text-[15px] font-bold">
                {t("clients.fiche.interventions")}
              </h2>
              {interventions.length === 0 ? (
                <p className="text-app-encre-faible px-4 py-3 text-13 font-bold">
                  {t("clients.fiche.interventions_vide")}
                </p>
              ) : (
                <ul className="flex flex-col gap-0.5 px-4 py-3">
                  {interventions
                    .slice(0, BORNE_HISTORIQUE_APERCU)
                    .map((ligne) => (
                      <li key={ligne.id} className="text-13 font-bold">
                        <Link
                          href={`/interventions/${ligne.id}?depuis=client`}
                          className={CLASSES_LIEN}
                        >
                          {referenceAffichee(ligne)}
                        </Link>
                        {t("ponctuation.separateur")}
                        {t(`type_intervention.${ligne.type}`)}
                        {t("ponctuation.separateur")}
                        {ligne.date_planifiee === null
                          ? ouTiret(null)
                          : dateCivile(ligne.date_planifiee)}
                      </li>
                    ))}
                </ul>
              )}
              <div className="border-app-bord border-t px-4 py-3">
                <Link
                  href={`/clients/${client.id}?onglet=interventions&etat=toutes`}
                  className={CLASSES_LIEN}
                >
                  {t("clients.fiche.toutes_les_interventions")}
                </Link>
              </div>
            </section>
          </div>

          <ColonneContexte>
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
              saisieGardee={saisieContactGardee}
              peutEcrire={peutGererSite}
            />

            <section className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-[13px] font-bold">
                  {t("clients.fiche.identite")}
                </h2>
                {peutGererSite ? (
                  <Link
                    href={`/clients/${client.id}?onglet=identite`}
                    className={CLASSES_LIEN}
                  >
                    {t("clients.fiche.modifier")}
                  </Link>
                ) : null}
              </div>
              <dl className="grid grid-cols-[132px_1fr] gap-y-1.5 text-13 font-bold">
                <dt className="text-app-encre-faible">
                  {libelleCodeExterne(libelleSociete)}
                </dt>
                <dd>{client.code_externe ?? ouTiret(null)}</dd>
                <dt className="text-app-encre-faible">{t("client.ridet")}</dt>
                <dd>{client.ridet ?? ouTiret(null)}</dd>
                <dt className="text-app-encre-faible">
                  {t("client.categorie")}
                </dt>
                <dd>{client.categorie ?? ouTiret(null)}</dd>
                <dt className="text-app-encre-faible">
                  {t("client.conditions_reglement")}
                </dt>
                <dd>{client.conditions_reglement ?? ouTiret(null)}</dd>
                <dt className="text-app-encre-faible">
                  {t("client.commercial_referent")}
                </dt>
                <dd>{client.commercial_referent ?? ouTiret(null)}</dd>
              </dl>
            </section>
          </ColonneContexte>
        </div>
      ) : null}

      {onglet === "sites" ? (
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
                      <span className="text-app-encre-faible block text-12 font-bold">
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
      ) : null}

      {onglet === "parc" ? (
        <section className="bg-app-surface border-app-bord overflow-hidden rounded-lg border">
          <h2 className="border-app-bord border-b px-4 py-3 text-[15px] font-bold">
            {t("clients.fiche.onglet.parc")}
          </h2>
          {parcDuClient.length === 0 ? (
            <p className="text-app-encre-faible px-4 py-3 text-13 font-bold">
              {t("clients.fiche.synthese.machines_zero")}
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5 px-4 py-3">
              {parcDuClient.map((machine) => (
                <li key={machine.id} className="text-13 font-bold">
                  <Link href={`/parc/${machine.id}`} className={CLASSES_LIEN}>
                    {machine.modele.marque} {machine.modele.reference}
                  </Link>
                  {t("ponctuation.separateur")}
                  {machine.numero_serie}
                </li>
              ))}
            </ul>
          )}
          <div className="border-app-bord border-t px-4 py-3">
            <Link
              href={`/parc?client=${client.id}&vue=parc`}
              className={CLASSES_LIEN}
            >
              {t("clients.fiche.ouvrir_dans_le_parc")}
            </Link>
          </div>
        </section>
      ) : null}

      {onglet === "interventions" ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/clients/${client.id}?onglet=interventions&etat=ouvertes`}
              aria-current={
                etatInterventions === "ouvertes" ? "true" : undefined
              }
              className={
                etatInterventions === "ouvertes"
                  ? "border-app-bleu-bord bg-app-bleu-fond text-app-bleu-encre inline-flex h-9 items-center rounded-full border px-3 text-13 font-bold"
                  : "border-app-bord text-app-gris-encre inline-flex h-9 items-center rounded-full border border-dashed px-3 text-13 font-bold"
              }
            >
              {t("clients.fiche.puce.ouvertes")}
            </Link>
            <Link
              href={`/clients/${client.id}?onglet=interventions&etat=toutes`}
              aria-current={etatInterventions === "toutes" ? "true" : undefined}
              className={
                etatInterventions === "toutes"
                  ? "border-app-bleu-bord bg-app-bleu-fond text-app-bleu-encre inline-flex h-9 items-center rounded-full border px-3 text-13 font-bold"
                  : "border-app-bord text-app-gris-encre inline-flex h-9 items-center rounded-full border border-dashed px-3 text-13 font-bold"
              }
            >
              {t("interventions.vue.toutes")}
            </Link>
          </div>

          {etatInterventions === "ouvertes" ? (
            <section
              data-bloc="interventions-ouvertes-client"
              className="bg-app-surface border-app-bord overflow-hidden rounded-lg border"
            >
              <Tableau colonnes={colonnesInterventions} minimum="1000px">
                {aTraiter.length === 0 ? (
                  <LignePleine colonnes={colonnesInterventions.length}>
                    {t("clients.fiche.synthese.ouvertes_zero")}
                  </LignePleine>
                ) : null}
                {aTraiter.map((ligne) => (
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
                      {contenuMachinesHistorique(
                        ligne,
                        libellesMachinesHistorique,
                      )}
                    </Cellule>
                    <Cellule>
                      <span
                        className={`${CLASSES_STATUT[ligne.statut]} rounded px-1.5 py-0.5 text-12 font-bold`}
                      >
                        {t(`statut.${ligne.statut}`)}
                      </span>
                    </Cellule>
                  </tr>
                ))}
              </Tableau>
            </section>
          ) : (
            <section
              id="historique-client"
              data-bloc="historique-client"
              className="bg-app-surface border-app-bord overflow-hidden rounded-lg border"
            >
              <Tableau colonnes={colonnesInterventions} minimum="1000px">
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
                      {contenuMachinesHistorique(
                        ligne,
                        libellesMachinesHistorique,
                      )}
                    </Cellule>
                    <Cellule>
                      <span
                        className={`${CLASSES_STATUT[ligne.statut]} rounded px-1.5 py-0.5 text-12 font-bold`}
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
                    hrefPage={(p) =>
                      hrefDeLaPage(
                        `/clients/${client.id}`,
                        { onglet: "interventions", etat: "toutes" },
                        p,
                      )
                    }
                  />
                </div>
              )}
            </section>
          )}
        </>
      ) : null}

      {onglet === "interlocuteurs" ? (
        <BlocContacts
          bloc="contacts-client"
          titre={t("clients.fiche.contacts")}
          texteVide={t("clients.fiche.contacts_vide")}
          contacts={contactsTries}
          clientId={client.id}
          retour={`/clients/${client.id}?onglet=interlocuteurs`}
          siteOptions={sites.map((site) => ({
            id: site.id,
            libelle: site.libelle,
          }))}
          siteFixe={null}
          montrerRattachement
          saisieGardee={saisieContactGardee}
          peutEcrire={peutGererSite}
        />
      ) : null}

      {/* D153 (03/10/2026, TP-S3, CS6) — RM et RS lisent désormais cette
          fiche (consulter_clients_sites), mais ce formulaire reste celui que
          la route (`gerer_client_site`) accepte : absent plutôt qu'offert
          pour rien. */}
      {onglet === "identite" && peutGererSite ? (
        <form
          method="post"
          action={`/api/clients/${client.id}/modifier`}
          className="bg-app-surface border-app-bord flex flex-col gap-4 rounded-lg border px-4 py-4"
        >
          <h2 className="text-[15px] font-bold">
            {t("clients.fiche.identite")}
          </h2>
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
          <label className="flex flex-col gap-1 text-13 font-bold">
            {t("clients.etat")}
            <select
              name="actif"
              defaultValue={client.actif ? "true" : "false"}
              className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
            >
              <option value="true">{t("clients.etat.actif")}</option>
              <option value="false">{t("clients.etat.inactif")}</option>
            </select>
            <span className="text-app-encre-faible text-12 font-bold">
              {t("clients.etat.aide")}
            </span>
          </label>

          <div className="flex gap-3">
            <ActionPrimaire>{t("clients.action.modifier")}</ActionPrimaire>
            <Link
              href={`/clients/${client.id}`}
              className="text-app-encre-faible text-13 font-bold"
            >
              {t("clients.fiche.annuler")}
            </Link>
          </div>
        </form>
      ) : null}
    </Page>
  );
}

/**
 * LA OU LES MACHINES D'UNE LIGNE D'HISTORIQUE, EN LIENS (GR11-CLIENT-MACHINE)
 * — même forme que `contenuMachines` (`interventions/[id]/page.tsx`) : une
 * intervention sans machine rend le signe d'absence, jamais une ligne muette ;
 * plusieurs machines se séparent par une virgule, et chacune mène à
 * `/parc/<id>`. `machinesIdentifiees` (`../../interventions/presentation.ts`)
 * répond « `null` » quand un identifiant n'a pas de libellé lu — l'absence se
 * rend alors elle aussi par le signe, jamais par un lien vers rien.
 */
function contenuMachinesHistorique(
  ligne: LignePlanning,
  libellesMachines: ReadonlyMap<string, string>,
): ReactNode {
  const machines = machinesIdentifiees(ligne, libellesMachines);
  if (machines.length === 0) {
    return ouTiret(null);
  }
  const noeuds: ReactNode[] = [];
  machines.forEach((machine, index) => {
    if (index > 0) {
      noeuds.push(", ");
    }
    noeuds.push(
      machine.libelle === null ? (
        ouTiret(null)
      ) : (
        <Link
          key={machine.machineId}
          href={`/parc/${machine.machineId}`}
          className={CLASSES_LIEN}
        >
          {machine.libelle}
        </Link>
      ),
    );
  });
  return noeuds;
}

/** « <type d'intervention> » — hors du JSX pour éviter une faute d'étroitesse de type dans un attribut de tuile. */
function detailTypeIntervention(
  ligne: LignePlanning | null,
): string | undefined {
  return ligne === null ? undefined : t(`type_intervention.${ligne.type}`);
}

/**
 * LA OU LES MACHINES D'UNE LIGNE « À TRAITER », EN TEXTE (9EF-TP-UX4-2-
 * FICHES-1) — `BlocATraiter` ne rend que du texte, jamais un second lien
 * dans sa ligne (un seul lien par ligne, D140 l'exige déjà ailleurs).
 */
function machinesEnTexte(
  ligne: LignePlanning,
  libelles: ReadonlyMap<string, string>,
): string {
  const machines = machinesIdentifiees(ligne, libelles);
  if (machines.length === 0) {
    return ouTiret(null);
  }
  return machines.map((machine) => machine.libelle ?? ouTiret(null)).join(", ");
}

function Champ({
  nom,
  libelle,
  valeur,
}: Readonly<{ nom: string; libelle: string; valeur: string }>) {
  return (
    <label className="flex flex-col gap-1 text-13 font-bold">
      {libelle}
      <input
        name={nom}
        defaultValue={valeur}
        className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
      />
    </label>
  );
}
