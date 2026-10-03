import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LienPrimaire } from "@/components/ui/action-primaire";
import { Badge } from "@/components/ui/badge";
import { EtatVide } from "@/components/ui/etat-vide";
import { Page } from "@/components/mise-en-page/page";
import { Onglets, type EtatOnglet } from "@/components/ui/onglets";
import { Pagination } from "@/components/ui/pagination";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { peut } from "@/lib/auth/habilitations";
import { RefusAcces } from "@/components/ui/refus-acces";
import { Role } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { lireFuseau } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import {
  compterDemandesTraitees,
  demandesOuvertes,
  demandesTraitees,
  type LigneDemande,
} from "@/lib/demandes/depot";
import { LIMITE_RECHERCHE_PAR_DEFAUT } from "@/lib/demandes/saisie";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { tonDePriorite } from "@/lib/theme/priorites";

import { referenceAffichee } from "../interventions/presentation";
import { hrefDeLaPage, libellePage } from "../presentation";

import {
  instantLisible,
  parLaPlusAncienne,
  piedDeLaFile,
  tonDuStatutDemande,
} from "./presentation";

export const metadata: Metadata = { title: t("demande.titre") };

/**
 * LA FILE DE QUALIFICATION (DEMANDES-1, sur L2-06), PUIS SES DEUX ONGLETS
 * (TP-DEM, IN-40, D164).
 *
 * ## Le constat qui ouvre ce ticket
 *
 * `lib/demandes/depot.ts` porte tout le cycle de vie d'une demande depuis le
 * 14/09/2026 (L2-06) — et zéro route, zéro écran ne l'appelait avant ce lot
 * (`docs/backlog.md`, ticket L2-06b). Le tableau de bord affichait un compteur
 * « demandes ouvertes » qui ne menait NULLE PART — un chiffre sans chemin, la
 * même faute que le zéro muet que ce dépôt corrige ailleurs (D125/D128). Cet
 * écran EST ce chemin.
 *
 * ## L'ORDRE — voir `parLaPlusAncienne` et `piedDeLaFile`
 *
 * `demandesOuvertes` (le dépôt) ordonne par urgence puis par dépôt, pour SON
 * usage à elle (le tableau de bord). Une file d'attente répond à une autre
 * question, et l'ordre choisi ICI est écrit à côté de la fonction qui le pose.
 *
 * ## D123 — UN TABLEAU, JAMAIS DES CARTES
 *
 * `demande` est transactionnel — une file d'actions à traiter — et non un
 * référentiel qu'on consulte pour ce qu'il EST : le tableau dense de
 * `Tableau`, comme `/imports`, `/vgp`, `/parametres`, jamais `CarteEntite`,
 * réservée aux deux seuls écrans référentiels de la maquette (D123).
 *
 * ## LE CLOISONNEMENT N'EST PAS ÉCRIT ICI
 *
 * `demande` est de forme « parc » (D102) : `demandesOuvertes` et
 * `demandesTraitees` lisent SOUS le contexte cloisonné, et un compte de
 * portail n'y verrait que les siennes sans qu'aucune ligne de cet écran le
 * sache — mais aucun compte de portail n'atteint cette route : le portail est
 * hors périmètre de ce ticket (dépôt exclu, D102 note déjà que la même
 * lecture SERT le portail le jour où il existe).
 *
 * ## L'ACCÈS DIRECT À LA CRÉATION (89-DEMANDES-3, 25/09/2026)
 *
 * « Créer une intervention », même style et même position qu'au registre
 * (`/interventions`) : `LienPrimaire` vers `/interventions/nouvelle`, gardé
 * par la MÊME capacité que les autres écrans qui posent ce lien
 * (`clients/[id]`, `sites/[id]`) — `creer_demande`, jamais une seconde
 * lecture du critère. Inchangé par les onglets ci-dessous : les deux vues
 * restent la même file de demandes, seul ce qu'elle MONTRE change.
 *
 * ## DEUX ONGLETS, UN SEUL RENDU À LA FOIS (IN-40 ; « SEUL dans le DOM »)
 *
 * « À traiter » lit EXACTEMENT `demandesOuvertes` — la même lecture que la
 * tuile du tableau de bord (`tableau-de-bord/page.tsx`), pour que le compte de
 * la tuile et le compte de l'onglet ne puissent jamais diverger (deux lectures
 * d'un même critère divergeraient en silence, §9, 01/09). « Traitées » est
 * NEUVE : `demandesTraitees` (`lib/demandes/depot.ts`), paginée par
 * `LIMITE_RECHERCHE_PAR_DEFAUT`, la plus RÉCENTE d'abord — l'inverse de « À
 * traiter », parce qu'une liste de ce qui est déjà réglé regarde d'abord ce
 * qui vient de se régler. L'état vit dans l'URL (`?onglet=traitees`,
 * `?page=`), jamais dans un composant : chaque requête ne lit QUE la lecture
 * dont l'onglet actif a besoin — la vue inactive n'est ni lue ni rendue.
 */
export default async function PageDemandes({
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

  // FERMÉ AU TECHNICIEN (QT-2, D152) — le registre des demandes est un écran
  // de bureau (qualifier/affecter) ; le technicien garde `creer_demande`,
  // inchangé, ailleurs.
  if (session.contexte.role === Role.technicien) {
    return (
      <Page chemin="/demandes" titre={t("demande.titre")}>
        <RefusAcces />
      </Page>
    );
  }

  const contexte = session.contexte;
  const params = await searchParams;
  const motif = params.motif;
  const peutCreerIntervention =
    contexte.role !== null && peut(contexte.role, "creer_demande");

  const ongletActif: "a_traiter" | "traitees" =
    params.onglet === "traitees" ? "traitees" : "a_traiter";
  const pageParam = typeof params.page === "string" ? Number(params.page) : NaN;
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  // TROIS LECTURES INDÉPENDANTES — les DEUX COMPTES servent les pastilles des
  // DEUX onglets, quel que soit celui qui est actif ; la ligne de la file
  // « Traitées » ne se lit QUE si cet onglet est actif (voir le docblock).
  const [ouvertes, compteTraitees, traiteesBrutes] = await Promise.all([
    demandesOuvertes(contexte),
    compterDemandesTraitees(contexte),
    ongletActif === "traitees"
      ? demandesTraitees(contexte, { page })
      : Promise.resolve<readonly LigneDemande[]>([]),
  ]);
  const fileATraiter = parLaPlusAncienne(ouvertes);
  const demandesAffichees =
    ongletActif === "a_traiter" ? fileATraiter : traiteesBrutes;
  const totalPagesTraitees = Math.max(
    1,
    Math.ceil(compteTraitees / LIMITE_RECHERCHE_PAR_DEFAUT),
  );

  // LES LIBELLÉS DE CLIENT ET DE SITE, résolus en DEUX lectures groupées —
  // jamais une par ligne, qui multiplierait les requêtes par la taille de la
  // file (même discipline que `libellesDesMachines`).
  const clientIds = [...new Set(demandesAffichees.map((d) => d.client_id))];
  const siteIds = [...new Set(demandesAffichees.map((d) => d.site_id))];
  // LA « SUITE » DE L'ONGLET TRAITÉES (IN-40) — l'intervention née d'une
  // demande TRANSFORMÉE, lue par `demande_id` (68-DEMANDES-2) ; une demande
  // peut en porter plusieurs (décision 4 du chapitre 11), et c'est la
  // PREMIÈRE créée (`cree_le` croissant) que cette colonne nomme — même choix
  // que la fiche (`[id]/page.tsx`) pour son bouton de création.
  const idsTransformees =
    ongletActif === "traitees"
      ? demandesAffichees
          .filter((d) => d.statut === "transformee")
          .map((d) => d.id)
      : [];
  const [clients, sites, societe, interventionsIssues] = await Promise.all([
    clientIds.length === 0
      ? Promise.resolve([])
      : avecContexteApplicatif(contexte, (tx) =>
          tx.client.findMany({
            where: { id: { in: clientIds } },
            select: { id: true, raison_sociale: true },
          }),
        ),
    siteIds.length === 0
      ? Promise.resolve([])
      : avecContexteApplicatif(contexte, (tx) =>
          tx.site.findMany({
            where: { id: { in: siteIds } },
            select: { id: true, libelle: true },
          }),
        ),
    avecContexteApplicatif(contexte, (tx) =>
      tx.societe.findFirst({
        where: { id: contexte.societeId as string },
        select: { fuseau_horaire: true },
      }),
    ),
    idsTransformees.length === 0
      ? Promise.resolve([])
      : avecContexteApplicatif(contexte, (tx) =>
          tx.intervention.findMany({
            where: { demande_id: { in: idsTransformees } },
            select: { id: true, numero: true, demande_id: true },
            orderBy: { cree_le: "asc" },
          }),
        ),
  ]);
  const fuseau = lireFuseau(societe?.fuseau_horaire);
  const raisonSocialeParClient = new Map(
    clients.map((c) => [c.id, c.raison_sociale]),
  );
  const libelleParSite = new Map(sites.map((s) => [s.id, s.libelle]));
  const interventionParDemande = new Map<
    string,
    { id: string; numero: number | null }
  >();
  for (const intervention of interventionsIssues) {
    if (
      intervention.demande_id !== null &&
      !interventionParDemande.has(intervention.demande_id)
    ) {
      interventionParDemande.set(intervention.demande_id, intervention);
    }
  }

  const colonnesCommunes = [
    { cle: "client", libelle: t("intervention.client") },
    { cle: "site", libelle: mot("site") },
    { cle: "urgence", libelle: t("demande.urgence"), largeur: "100px" },
    { cle: "description", libelle: t("demande.description") },
    { cle: "source", libelle: t("demande.source"), largeur: "160px" },
    {
      cle: "deposee",
      libelle: t("demande.colonne_deposee_le"),
      largeur: "150px",
    },
  ];
  const colonnes =
    ongletActif === "a_traiter"
      ? [
          ...colonnesCommunes,
          {
            cle: "statut",
            libelle: t("demande.colonne_statut"),
            largeur: "120px",
          },
        ]
      : [
          ...colonnesCommunes,
          {
            cle: "suite",
            libelle: t("demande.colonne_suite"),
            largeur: "160px",
          },
        ];

  const onglets: readonly EtatOnglet[] = [
    {
      libelle: t("demandes.onglet.a_traiter"),
      href: "/demandes",
      compte: ouvertes.length,
      actif: ongletActif === "a_traiter",
    },
    {
      libelle: t("demandes.onglet.traitees"),
      href: "/demandes?onglet=traitees",
      compte: compteTraitees,
      actif: ongletActif === "traitees",
    },
  ];

  return (
    <Page
      chemin="/demandes"
      titre={t("demande.titre")}
      sousTitre={
        ongletActif === "a_traiter"
          ? t("demandes.sous_titre")
          : t("demandes.traitees.sous_titre")
      }
      actions={
        peutCreerIntervention ? (
          <LienPrimaire href="/interventions/nouvelle">
            {t("planning.creer")}
          </LienPrimaire>
        ) : undefined
      }
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          data-motif={motif}
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-13 font-bold"
        >
          {t(motif)}
        </p>
      ) : null}

      <Onglets libelleAria={t("demande.titre")} elements={onglets} />

      {ongletActif === "traitees" && compteTraitees === 0 ? (
        <EtatVide titre={t("demandes.traitees.vide_titre")} icone="check">
          {t("demandes.traitees.vide")}
        </EtatVide>
      ) : (
        <>
          <section className="bg-app-surface border-app-bord rounded-lg border">
            <Tableau colonnes={colonnes} minimum="960px">
              {demandesAffichees.length === 0 ? (
                <LignePleine colonnes={colonnes.length}>
                  {t("demandes.vide")}
                </LignePleine>
              ) : (
                demandesAffichees.map((demande) => (
                  <tr key={demande.id} data-demande={demande.id}>
                    <Cellule>
                      <Link
                        href={`/clients/${demande.client_id}`}
                        className={CLASSES_LIEN}
                      >
                        {raisonSocialeParClient.get(demande.client_id) ??
                          t("demande.sans_valeur")}
                      </Link>
                    </Cellule>
                    <Cellule>
                      <Link
                        href={`/sites/${demande.site_id}`}
                        className={CLASSES_LIEN}
                      >
                        {libelleParSite.get(demande.site_id) ??
                          t("demande.sans_valeur")}
                      </Link>
                    </Cellule>
                    <Cellule>
                      <Badge ton={tonDePriorite(demande.urgence)}>
                        {t(`priorite.${demande.urgence}`)}
                      </Badge>
                    </Cellule>
                    <Cellule>
                      <Link
                        href={`/demandes/${demande.id}`}
                        className={CLASSES_LIEN}
                      >
                        {demande.description}
                      </Link>
                    </Cellule>
                    <Cellule>{t(`demande.source.${demande.source}`)}</Cellule>
                    <Cellule>
                      {instantLisible(demande.depose_le, fuseau)}
                    </Cellule>
                    {ongletActif === "a_traiter" ? (
                      <Cellule>
                        <Badge ton={tonDuStatutDemande(demande.statut)}>
                          {t(`demande.statut.${demande.statut}`)}
                        </Badge>
                      </Cellule>
                    ) : (
                      <Cellule>
                        {demande.statut === "transformee"
                          ? (() => {
                              const intervention = interventionParDemande.get(
                                demande.id,
                              );
                              return intervention === undefined ? (
                                t("demande.sans_valeur")
                              ) : (
                                <Link
                                  href={`/interventions/${intervention.id}?depuis=demande&depuis_id=${demande.id}`}
                                  className={CLASSES_LIEN}
                                >
                                  {referenceAffichee(intervention)}
                                </Link>
                              );
                            })()
                          : demande.motif_cloture === null
                            ? t("demande.sans_valeur")
                            : t(`demande.motif.${demande.motif_cloture}`)}
                      </Cellule>
                    )}
                  </tr>
                ))
              )}
            </Tableau>
          </section>

          <Pagination
            page={ongletActif === "traitees" ? page : 1}
            totalPages={ongletActif === "traitees" ? totalPagesTraitees : 1}
            libelleResultats={piedDeLaFile(
              ongletActif === "a_traiter" ? ouvertes.length : compteTraitees,
              ongletActif === "a_traiter" ? "ancienne" : "recente",
            )}
            libellePage={libellePage(
              ongletActif === "traitees" ? page : 1,
              ongletActif === "traitees" ? totalPagesTraitees : 1,
            )}
            libellePrecedent={t("pagination.precedent")}
            libelleSuivant={t("pagination.suivant")}
            hrefPage={(cible) =>
              hrefDeLaPage("/demandes", { onglet: "traitees" }, cible)
            }
          />
        </>
      )}
    </Page>
  );
}
