import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LienPrimaire } from "@/components/ui/action-primaire";
import { Badge } from "@/components/ui/badge";
import { EtatVide } from "@/components/ui/etat-vide";
import { Carte, ListeCartes } from "@/components/ui/liste-cartes";
import { Page } from "@/components/mise-en-page/page";
import { Onglets, type EtatOnglet } from "@/components/ui/onglets";
import { Pagination } from "@/components/ui/pagination";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { peut } from "@/lib/auth/habilitations";
import { RefusAcces } from "@/components/ui/refus-acces";
import { Role } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { jourDe, lireFuseau, maintenant } from "@/lib/calendar/fuseau";
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
import { libellesDesMachines } from "@/lib/machines/depot";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { tonDePriorite } from "@/lib/theme/priorites";

import { referenceAffichee } from "../interventions/presentation";
import { hrefDeLaPage, libellePage } from "../presentation";

import {
  ongletVide,
  parLaPlusAncienne,
  piedDeLaFile,
  receptionPremiereLigne,
  receptionSecondeLigne,
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
  // LE BOUTON-LIEN « QUALIFIER » (QE-9, maquette du 28/09, D176) — la même
  // capacité que la fiche exige pour agir sur une demande (`[id]/page.tsx`,
  // D151) : aucun POST ne part d'ici, seulement un lien vers la fiche.
  const peutQualifierDepuisLaListe =
    contexte.role !== null && peut(contexte.role, "qualifier_affecter");

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
  const machineIds = [
    ...new Set(
      demandesAffichees
        .map((d) => d.machine_id)
        .filter((id): id is string => id !== null),
    ),
  ];
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
  const [clients, sites, societe, interventionsIssues, libellesMachines] =
    await Promise.all([
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
      libellesDesMachines(contexte, machineIds),
    ]);
  const fuseau = lireFuseau(societe?.fuseau_horaire);
  // AUJOURD'HUI, LU UNE SEULE FOIS (QE-9, D176) — pour la colonne « Reçue »,
  // jamais recalculé ligne à ligne (voir `receptionPremiereLigne`).
  const aujourdhuiLocal = jourDe(maintenant(fuseau).local);
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

  // LE GABARIT DE LA MAQUETTE DU 28/09 (QE-9, D176) — « Reçue · Client·site ·
  // Demande · Source », puis une dernière colonne qui dépend de l'onglet :
  // sur « À traiter », l'URGENCE, l'ÉTAT et le bouton « Qualifier » tiennent
  // ENSEMBLE dans une seule cellule alignée à droite (jamais une colonne
  // « Urgence » séparée, mesurée fausse contre la maquette) ; sur
  // « Traitées », la « Suite ». Ni N°, ni « créée par » (constat 4 : aucune
  // donnée ne les porte).
  const colonnesCommunes = [
    { cle: "recue", libelle: t("demande.colonne_recue"), largeur: "130px" },
    {
      cle: "client_site",
      libelle: `${t("intervention.client")}${t("ponctuation.point_median")}${mot("site")}`,
    },
    { cle: "demande", libelle: t("demande.colonne_demande") },
    { cle: "source", libelle: t("demandes.colonne.source"), largeur: "160px" },
  ];
  const colonnes =
    ongletActif === "a_traiter"
      ? [
          ...colonnesCommunes,
          { cle: "action", libelle: "", largeur: "230px", droite: true },
        ]
      : [
          ...colonnesCommunes,
          {
            cle: "suite",
            libelle: t("demande.colonne_suite"),
            largeur: "160px",
            droite: true,
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

  // LES DEUX ÉTATS VIDES (QE-9, maquette du 28/09, `ongletVide`) — « À
  // traiter » vide retire la ligne vide du tableau mais garde le pied
  // « 0 demande » (Pagination, hors de ce bloc) ; « Traitées » vide garde le
  // comportement d'avant ce lot (aucune pagination affichée).
  const videDe = ongletVide(ongletActif, ouvertes.length, compteTraitees);
  const estVideATraiter = videDe === "a_traiter";
  const estVideTraitees = videDe === "traitees";

  return (
    <Page
      chemin="/demandes"
      titre={t("demande.titre")}
      sousTitre={t("demandes.sous_titre_page")}
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

      {estVideTraitees ? (
        <EtatVide titre={t("demandes.traitees.vide_titre")} icone="check">
          {t("demandes.etat_vide.texte")}
        </EtatVide>
      ) : (
        <>
          {estVideATraiter ? (
            <EtatVide titre={t("demandes.a_traiter.vide_titre")} icone="check">
              {t("demandes.etat_vide.texte")}
            </EtatVide>
          ) : (
            <>
              <section className="bg-app-surface border-app-bord max-[900px]:hidden rounded-lg border">
                <Tableau colonnes={colonnes} minimum="960px">
                  {demandesAffichees.length === 0 ? (
                    <LignePleine colonnes={colonnes.length}>
                      {t("demandes.vide")}
                    </LignePleine>
                  ) : (
                    demandesAffichees.map((demande) => {
                      const ligne2Reception = receptionSecondeLigne(
                        demande.depose_le,
                        fuseau,
                        aujourdhuiLocal,
                      );
                      const libelleMachine =
                        demande.machine_id === null
                          ? null
                          : (libellesMachines.get(demande.machine_id) ?? null);
                      const droiteTableau = contenuDroite(demande, false);
                      return (
                        <tr key={demande.id} data-demande={demande.id}>
                          <Cellule>
                            <div className="font-bold">
                              {receptionPremiereLigne(
                                demande.depose_le,
                                fuseau,
                                aujourdhuiLocal,
                              )}
                            </div>
                            {ligne2Reception === null ? null : (
                              <div className="text-app-encre-faible text-12 font-bold">
                                {ligne2Reception}
                              </div>
                            )}
                          </Cellule>
                          <Cellule>
                            <Link
                              href={`/clients/${demande.client_id}`}
                              className={`${CLASSES_LIEN} font-bold`}
                            >
                              {raisonSocialeParClient.get(demande.client_id) ??
                                t("demande.sans_valeur")}
                            </Link>
                            <div className="text-app-encre-faible text-12 font-bold">
                              <Link
                                href={`/sites/${demande.site_id}`}
                                className={CLASSES_LIEN}
                              >
                                {libelleParSite.get(demande.site_id) ??
                                  t("demande.sans_valeur")}
                              </Link>
                              {libelleMachine === null
                                ? null
                                : `${t("ponctuation.point_median")}${libelleMachine}`}
                            </div>
                          </Cellule>
                          <Cellule>
                            <Link
                              href={`/demandes/${demande.id}`}
                              className={`${CLASSES_LIEN} line-clamp-2`}
                            >
                              {demande.description}
                            </Link>
                          </Cellule>
                          <Cellule>
                            {t(`demande.source.${demande.source}`)}
                          </Cellule>
                          <Cellule droite>{droiteTableau}</Cellule>
                        </tr>
                      );
                    })
                  )}
                </Tableau>
              </section>

              <ListeCartes libelle={t("demande.titre")}>
                {demandesAffichees.map((demande) => {
                  const libelleMachine =
                    demande.machine_id === null
                      ? null
                      : (libellesMachines.get(demande.machine_id) ?? null);
                  const droiteCarte = contenuDroite(demande, true);
                  return (
                    <Carte key={demande.id} href={`/demandes/${demande.id}`}>
                      <div
                        data-demande-carte={demande.id}
                        className="flex flex-col gap-1.5"
                      >
                        <div className="font-bold">
                          {receptionPremiereLigne(
                            demande.depose_le,
                            fuseau,
                            aujourdhuiLocal,
                          )}
                        </div>
                        <div className="font-bold">
                          {raisonSocialeParClient.get(demande.client_id) ??
                            t("demande.sans_valeur")}
                          <span className="text-app-encre-faible text-12 font-bold">
                            {t("ponctuation.point_median")}
                            {libelleParSite.get(demande.site_id) ??
                              t("demande.sans_valeur")}
                            {libelleMachine === null
                              ? null
                              : `${t("ponctuation.point_median")}${libelleMachine}`}
                          </span>
                        </div>
                        <div className="text-app-encre-faible line-clamp-2 text-13 font-bold">
                          {demande.description}
                        </div>
                        <div className="text-app-encre-faible text-12 font-bold">
                          {t(`demande.source.${demande.source}`)}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {droiteCarte}
                        </div>
                      </div>
                    </Carte>
                  );
                })}
              </ListeCartes>
            </>
          )}

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

  /**
   * LE CONTENU DE DROITE, PARTAGÉ PAR LA LIGNE DU TABLEAU ET LA CARTE
   * (TP-UX3-1-REGISTRE-2, PR-10) — urgence, état et « Qualifier » sur « À
   * traiter », la « Suite » sur « Traitées » : une seule écriture de cette
   * cellule, jamais deux qui divergeraient en silence (§9, 01/09).
   */
  function contenuDroite(
    demande: LigneDemande,
    dansUneCarte: boolean,
  ): React.ReactNode {
    if (ongletActif === "a_traiter") {
      // « QUALIFIER » (QE-9, D176) — un LIEN dans le tableau (une entrée de
      // plus vers la fiche, parmi d'autres sur la même ligne) ; un simple
      // TEXTE dans la carte, dont tout le contenu est déjà un seul lien
      // plein vers cette même fiche (`Carte`, jamais une seconde navigation
      // ajoutée par-dessus — une ancre dans une ancre serait invalide).
      return (
        <>
          <Badge ton={tonDePriorite(demande.urgence)}>
            {t(`priorite.${demande.urgence}`)}
          </Badge>
          <Badge ton={tonDuStatutDemande(demande.statut)}>
            {t(`demande.statut.${demande.statut}`)}
          </Badge>
          {peutQualifierDepuisLaListe ? (
            dansUneCarte ? (
              <span className="bg-app-bleu-plein text-app-bleu-plein-encre inline-flex items-center rounded-md px-2.5 py-1 text-12 font-bold">
                {t("demande.action.qualifier")}
              </span>
            ) : (
              <Link
                href={`/demandes/${demande.id}`}
                className="bg-app-bleu-plein text-app-bleu-plein-encre inline-flex items-center rounded-md px-2.5 py-1 text-12 font-bold"
              >
                {t("demande.action.qualifier")}
              </Link>
            )
          ) : null}
        </>
      );
    }
    if (demande.statut === "transformee") {
      const intervention = interventionParDemande.get(demande.id);
      if (intervention === undefined) {
        return t("demande.sans_valeur");
      }
      // Même raison que « Qualifier » ci-dessus : la carte ne peut pas
      // porter une seconde ancre vers l'intervention.
      return dansUneCarte ? (
        <span>{referenceAffichee(intervention)}</span>
      ) : (
        <Link
          href={`/interventions/${intervention.id}?depuis=demande&depuis_id=${demande.id}`}
          className={CLASSES_LIEN}
        >
          {referenceAffichee(intervention)}
        </Link>
      );
    }
    if (demande.motif_cloture === null) {
      return t("demande.sans_valeur");
    }
    return (
      <Badge ton="gris">
        {t("demande.cloture.suite_prefixe")}
        {t("ponctuation.deux_points")}
        {t(`demande.motif.${demande.motif_cloture}`)}
      </Badge>
    );
  }
}
