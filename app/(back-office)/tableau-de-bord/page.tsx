import type { Metadata } from "next";

import { Role, type TypeIntervention } from "@prisma/client";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { CLASSES_TON } from "@/components/ui/badge";
import { BoutonPlus } from "@/components/ui/bouton-plus";
import {
  BandeDecomptes,
  type ElementDecompte,
} from "@/components/ui/bande-decomptes";
import { Carte } from "@/components/ui/carte";
import { Icone } from "@/components/ui/icone";
import { Kpi } from "@/components/ui/kpi";
import { Message } from "@/components/ui/message";
import { RefusAcces } from "@/components/ui/refus-acces";
import { SelectPriorites } from "@/components/tableau-de-bord/select-priorites";
import {
  BlocAujourdhuiParTechnicien,
  type LigneAujourdhuiTechnicien,
} from "@/components/tableau-de-bord/bloc-aujourdhui-technicien";
import {
  BlocCharge4Semaines,
  type SemaineDeCharge,
} from "@/components/tableau-de-bord/bloc-charge-4-semaines";
import {
  BlocTerminees,
  type LigneTerminee,
} from "@/components/tableau-de-bord/bloc-terminees";
import { Page } from "@/components/mise-en-page/page";
import { BlocAccesAOuvrir } from "@/components/tableau-de-bord/bloc-acces-a-ouvrir";
import { BlocDonneesACompleter } from "@/components/tableau-de-bord/bloc-donnees-a-completer";
import { BlocJournal } from "@/components/tableau-de-bord/bloc-journal";
import { BlocMiseEnRoute } from "@/components/tableau-de-bord/bloc-mise-en-route";
import { BlocMois } from "@/components/tableau-de-bord/bloc-mois";
import {
  dernieresEcrituresDuJour,
  compterEcrituresDuJour,
} from "@/lib/audit/journal";
import { peut, peutPleinement } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import {
  bornesDuMois,
  cleJour,
  instantDuJour,
  jourDe,
  jourSuivant,
  maintenant,
  minutesDepuisMinuit,
  schemaFuseau,
  versLocal,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { enHeure } from "@/lib/calendar/parametrage";
import { enDuree } from "@/lib/calendar/duree";
import { lundiDeLaSemaine, semaineIso } from "@/lib/calendar/semaine";
import {
  chargerCalendrierAgence,
  type CacheCalendrierAgence,
} from "@/lib/calendar/agence";
import { absencesDeLaPeriode } from "@/lib/absences/depot";
import { annuaireDesPersonnes, type Annuaire } from "@/lib/auth/annuaire";
import { type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { demandesOuvertes } from "@/lib/demandes/depot";
import { etatAccuse } from "@/lib/demandes/accuse";
import { habilitationsDesTechniciens } from "@/lib/habilitations/depot";
import { compterLesLots } from "@/lib/imports/depot";
import { t, type CleTraduction } from "@/lib/i18n/fr";
import {
  compterInterventions,
  compterInterventionsSansDuree,
  enAttenteDePiece,
  interventionsEnRetard,
  listerInterventions,
  listerPlanning,
} from "@/lib/interventions/depot";
import {
  schemaRechercheInterventions,
  TYPES_INTERVENTION,
} from "@/lib/interventions/saisie";
import {
  occupationsDuPlanning,
  type LigneOccupation,
} from "@/lib/interventions/occupation";
import { compterLeParc, JOURS_GARANTIE } from "@/lib/machines/depot";
import { schemaRechercheParc } from "@/lib/machines/saisie";
import {
  pointsDonneesACompleter,
  techniciensAccesAOuvrir,
} from "@/lib/tableau-de-bord/lectures";
import { faitsMiseEnRoute } from "@/lib/tableau-de-bord/mise-en-route";
import { listerLesTechniciens } from "@/lib/techniciens/depot";
import { CLASSES_STATUT, type StatutAffiche } from "@/lib/theme/statuts";

import { referenceAffichee } from "../interventions/presentation";
import {
  estARenouveler60Jours,
  estExpiree,
} from "../parametres/equipe/presentation";

import {
  barresParNature,
  CATEGORIES_PAR_COMPOSITION,
  DECOMPTE_PAR_COMPOSITION,
  dateCourteLocale,
  detailAccesAOuvrir,
  etapesMiseEnRoute,
  libelleActionJournal,
  libelleClotureEnMois,
  libelleCompteJournal,
  libelleEntiteJournal,
  libelleEtatAccesTuile,
  libelleHabilitationsARenouveler,
  libelleHabilitationsExpirees,
  libelleJauge,
  lienEcritureJournal,
  LIGNES_JOURNAL,
  LIGNES_PRIORITES,
  pourcentageJauge,
  titreBlocMois,
  type CompositionRole,
  compositionDuRole,
  detailAPlanifier,
  detailAlerteP1,
  detailAujourdhui,
  detailEnAttenteDePiece,
  elementsFiltres,
  filtrePrioriteLu,
  interventionsDuJour,
  lienEnRetard,
  optionsFiltrePriorites,
  piedPriorites,
  prioritesATransmettre,
  prioritesDemandeAQualifier,
  prioritesEnRetard,
  prioritesP1APlanifier,
  prioritesPasDemarrees,
  prioritesPieces,
  prioritesSignatureAbsente,
  sousTitreTableauDeBord,
  techniciensIndisponibles,
  tonEnRetard,
  tuilesRenduesDuRole,
  type ElementPriorite,
  type FicheEnAttentePourPriorite,
} from "./presentation";

export const metadata: Metadata = { title: t("tableau_de_bord.titre") };

/** Un annuaire qui ne rend jamais de nom — les deux compositions qui n'en ont pas besoin. */
const ANNUAIRE_VIDE: Annuaire = () => ({ etat: "non_demandee" });

/**
 * L'ALERTE P1 RESTE RÉSERVÉE AU TERRAIN (9EG-TP-UX6-TABLEAU-DE-BORD-2, V4) —
 * direction et administrateur ne la voient plus : la maquette la rend pour
 * ADV, responsable matériel et responsable SAV seulement (`alerteP1`, :2900).
 */
const COMPOSITIONS_AVEC_ALERTE_P1: readonly CompositionRole[] = [
  Role.adv,
  Role.responsable_materiel,
  Role.responsable_sav,
];

/**
 * LE TABLEAU DE BORD SELON LE RÔLE (QE-7 (a), 03/10/2026 ; D185).
 *
 * Trois compositions aujourd'hui — ADV, responsable matériel, responsable
 * SAV. Direction et administrateur de société gardent celle de l'ADV
 * jusqu'au second ticket (`compositionDuRole`, `./presentation.ts`) : le
 * RÔLE choisit la COMPOSITION, jamais un droit — chaque lecture garde sa
 * propre capacité (`peut…`).
 *
 * La maquette du 28/09 (`route("/tableau-de-bord")`, :2862-2909) fait foi
 * sur la DISPOSITION (D125, D128) ; ce qu'elle dessine sans lecture réelle
 * sur ce dépôt reste ABSENT de l'écran, nommé dans `./presentation.ts`,
 * plutôt qu'inventé (§8 de CLAUDE.md).
 */
export default async function PageTableauDeBord({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }
  const contexte = session.contexte;

  // LE TABLEAU DE BORD EST FERMÉ AU TECHNICIEN (QT-2, D152) — voir la même
  // garde sur `/interventions` (`app/(back-office)/interventions/page.tsx`).
  if (
    contexte.role === null ||
    !peutPleinement(contexte.role, "consulter_planning")
  ) {
    return (
      <Page chemin="/tableau-de-bord" titre={t("tableau_de_bord.titre")}>
        <RefusAcces />
      </Page>
    );
  }
  const role = contexte.role;
  const composition = compositionDuRole(role);

  // LE FUSEAU EST UNE DONNÉE, JAMAIS UN LITTÉRAL (L0-08) — le même geste que
  // `/parc` et `/vgp`.
  const societe = await avecContexteApplicatif(contexte, (tx) =>
    tx.societe.findFirst({
      where: { id: contexte.societeId as string },
      select: { fuseau_horaire: true },
    }),
  );
  const fuseau = schemaFuseau.parse(societe?.fuseau_horaire);
  const { instant, local } = maintenant(fuseau);
  const jour = jourDe(local);
  const debutDuJour = instantDuJour(jour);
  const finDuJour = instantDuJour(jour, 1);
  const heureLocale = (valeur: Date): string =>
    enHeure(minutesDepuisMinuit(versLocal(valeur, fuseau)));

  // ── LES LECTURES COMMUNES AUX TROIS COMPOSITIONS ─────────────────────────
  const [
    lignesPlanning,
    demandes,
    absencesDuJour,
    techniciensTous,
    enAttente,
    suspenduesCompte,
    enRetardLignes,
  ] = await Promise.all([
    // `listerPlanning` REND AUSSI TOUTE LA FILE D'ATTENTE, non paginée, quelle
    // que soit la fenêtre demandée (voir sa propre note) : c'est elle qui sert
    // les lignes du jour ET la file « à planifier », jamais deux requêtes.
    // LES ANNULÉES N'ENTRENT NI DANS « AUJOURD'HUI » NI DANS « URGENCES »
    // (IN-46) : ni la tuile ni la carte ne doivent compter une intervention
    // dont le travail ne se fera plus.
    listerPlanning(contexte, debutDuJour, finDuJour, undefined, {
      inclureAnnulees: false,
    }),
    demandesOuvertes(contexte),
    absencesDeLaPeriode(contexte, debutDuJour, debutDuJour),
    listerLesTechniciens(contexte),
    // DEUX PARAMÈTRES DATÉS (DATES-1) : `instant` réel pour `ancienneteJours`,
    // `debutDuJour` — la civile — pour `horizonDepasse`.
    enAttenteDePiece(contexte, instant, debutDuJour),
    compterInterventions(
      contexte,
      schemaRechercheInterventions.parse({ vue: "bloquees" }),
    ),
    interventionsEnRetard(contexte, debutDuJour),
  ]);

  const lignesDuJour = interventionsDuJour(
    lignesPlanning,
    debutDuJour,
    finDuJour,
  );
  const aPlanifier = lignesPlanning.filter(
    (ligne) => ligne.statut === "a_planifier",
  );
  const aTransmettreAujourdhui = lignesDuJour.filter(
    (ligne) => ligne.statut === "planifiee",
  );

  const nomDuTechnicien = (technicienId: string | null): string => {
    const technicien = techniciensTous.find(
      (t) => t.utilisateurId === technicienId,
    );
    return technicien?.nom ?? "";
  };

  // ── LA LECTURE PROPRE À « À CONTRÔLER » / « TERMINÉES » (adv, resp_sav —
  // la catégorie « Contrôle » des Priorités en a besoin aussi pour l'ADV) —
  // AUCUN DES DEUX pour responsable matériel, direction, administrateur
  // (9EG-TP-UX6-TABLEAU-DE-BORD-2) : ni leurs tuiles ni leurs catégories n'en
  // ont besoin.
  const terminees =
    composition === Role.adv || composition === Role.responsable_sav
      ? await avecContexteApplicatif(contexte, (tx) =>
          tx.intervention.findMany({
            where: { statut: "terminee", client: { actif: true } },
            select: {
              id: true,
              numero: true,
              technicien_id: true,
              date_planifiee: true,
              client: { select: { raison_sociale: true } },
              signatures: {
                select: { issue: true, motif: true, signataire_nom: true },
                orderBy: { cree_le: "desc" },
                take: 1,
              },
            },
            orderBy: { date_planifiee: "asc" },
          }),
        )
      : [];
  const signaturesAbsentes = terminees
    .filter(
      (ligne) =>
        ligne.signatures[0] !== undefined &&
        ligne.signatures[0].issue !== "signee",
    )
    .map((ligne) => ({
      interventionId: ligne.id,
      clientNom: ligne.client.raison_sociale,
      issue: ligne.signatures[0]!.issue as "client_absent" | "refus_signature",
      motif: ligne.signatures[0]!.motif ?? "",
    }));

  // ── LA LECTURE PROPRE AU RESPONSABLE MATÉRIEL — « garanties qui finissent »
  // (décision 25 d'Alexis du 05/10, PV-08 = `JOURS_GARANTIE`, lecture de
  // `lib/machines/depot.ts`, le même critère que la vue « garantie » de
  // `/parc`) ────────────────────────────────────────────────────────────────
  const garantiesQuiFinissent =
    composition === Role.responsable_materiel
      ? await compterLeParc(
          contexte,
          schemaRechercheParc.parse({ vue: "garantie" }),
          debutDuJour,
        )
      : 0;

  // ── LA LECTURE PROPRE AU RESPONSABLE SAV — « sous garantie, ouvertes »
  // (choix « Suivi » de 9EA-2, D177) ───────────────────────────────────────
  const sousGarantieOuvertes =
    composition === Role.responsable_sav
      ? await compterInterventions(
          contexte,
          schemaRechercheInterventions.parse({ suivi: "garantie_ouvertes" }),
        )
      : 0;

  // ── « PARC SUIVI » (direction, administrateur — tuile, maquette `T.parc`)
  const parcSuiviCompte =
    composition === Role.direction || composition === Role.admin_societe
      ? await compterLeParc(
          contexte,
          schemaRechercheParc.parse({ vue: "parc" }),
          debutDuJour,
        )
      : 0;

  // ── LE BLOC « <MOIS ANNÉE>, AU JJ/MM » (direction — `moisCard`) ─────────
  const { debut: debutMois, finIncluse: finMoisIncluse } = bornesDuMois(
    jour,
    fuseau,
  );
  const baseInterventionsMois = schemaRechercheInterventions.parse({});
  const [clotureEnMoisCompte, moisCreees, moisClotureesParType] =
    composition === Role.direction
      ? await Promise.all([
          compterInterventions(contexte, {
            ...baseInterventionsMois,
            cloturee_du: debutMois,
            cloturee_au: finMoisIncluse,
          }),
          compterInterventions(contexte, {
            ...baseInterventionsMois,
            cree_du: debutMois,
            cree_au: finMoisIncluse,
          }),
          Promise.all(
            TYPES_INTERVENTION.map(async (type) => ({
              type,
              compte: await compterInterventions(contexte, {
                ...baseInterventionsMois,
                type,
                cloturee_du: debutMois,
                cloturee_au: finMoisIncluse,
              }),
            })),
          ),
        ])
      : [
          0,
          0,
          [] as readonly {
            readonly type: TypeIntervention;
            readonly compte: number;
          }[],
        ];

  // ── « ACCÈS À OUVRIR » (administrateur — tuile et bloc, MÊME lecture) ───
  const accesAOuvrirLignes =
    composition === Role.admin_societe
      ? await techniciensAccesAOuvrir(contexte)
      : [];

  // ── « DONNÉES À COMPLÉTER » (administrateur — tuile et bloc, MÊME
  // lecture que `/parametres/donnees`, 9DT) ────────────────────────────────
  const pointsADC =
    composition === Role.admin_societe
      ? await pointsDonneesACompleter(contexte, debutDuJour)
      : [];

  // ── « IMPORT EN CONTRÔLE » (administrateur — la MÊME lecture que la puce
  // « À appliquer » de /imports, 9EB-2) ───────────────────────────────────
  const lotsAAppliquerCompte =
    composition === Role.admin_societe
      ? await compterLesLots(contexte, "a-appliquer")
      : 0;

  // ── LA BANDE DE L'ADMINISTRATEUR — HABILITATIONS EXPIRÉES / À RENOUVELER
  // (60 J) — `estExpiree`/`estARenouveler60Jours` (`../parametres/equipe/
  // presentation`), la MÊME lecture que la page Équipe (`habilitationsDes
  // Techniciens`), jamais une seconde écriture du jugement. ────────────────
  const [habilitationsExpireesCompte, habilitationsARenouvelerCompte] =
    composition === Role.admin_societe
      ? await (async () => {
          const techniciensActifs = techniciensTous.filter(
            (technicien) => technicien.actif,
          );
          const habilitationsParTechnicien = await habilitationsDesTechniciens(
            contexte,
            techniciensActifs.map((technicien) => technicien.utilisateurId),
          );
          const toutes = [...habilitationsParTechnicien.values()].flat();
          const aujourdHuiLocal = jour;
          return [
            toutes.filter((attribution) =>
              estExpiree(attribution, aujourdHuiLocal),
            ).length,
            toutes.filter((attribution) =>
              estARenouveler60Jours(attribution, aujourdHuiLocal),
            ).length,
          ];
        })()
      : [0, 0];

  // ── « MISE EN ROUTE » (administrateur seulement — PU-1) ─────────────────
  const etapesMiseEnRouteCalculees =
    composition === Role.admin_societe
      ? etapesMiseEnRoute(await faitsMiseEnRoute(contexte))
      : [];

  // ── « JOURNAL D'AUJOURD'HUI » (direction, administrateur — réservé à
  // `consulter_journal_audit`, ADMS et DIR) ───────────────────────────────
  const peutLireLeJournal = peut(role, "consulter_journal_audit");
  const [journalLignes, journalCompte] = peutLireLeJournal
    ? await Promise.all([
        dernieresEcrituresDuJour(contexte, debutDuJour, LIGNES_JOURNAL),
        compterEcrituresDuJour(contexte, debutDuJour),
      ])
    : [[], 0];
  const journalAuteurs = peutLireLeJournal
    ? await avecContexteApplicatif(contexte, (tx) =>
        annuaireDesPersonnes(
          tx,
          journalLignes
            .map((ligne) => ligne.utilisateurId)
            .filter((id): id is string => id !== null),
        ),
      )
    : ANNUAIRE_VIDE;

  // ── « DEMANDE À QUALIFIER » (décision 47 d'Alexis du 09/10, D185 amende
  // D176) — ADV et responsable matériel seulement (`CATEGORIES_PAR_
  // COMPOSITION`). Aucune lecture de demande neuve : `demandes` est déjà lue
  // plus haut ; seul le calendrier de l'agence est lu, une fois par agence
  // candidate (`CacheCalendrierAgence`).
  const demandesAQualifier = CATEGORIES_PAR_COMPOSITION[composition].includes(
    "planning",
  )
    ? await demandesACandidatesAQualifier(contexte, demandes, instant)
    : [];

  // ── « AUJOURD'HUI, PAR TECHNICIEN » (ADV, responsable matériel) ─────────
  //
  // LE TAUX NE S'AFFICHE JAMAIS SEUL (demande d'exploitation du 10/09/2026,
  // D56, gardé par `tests/unit/interventions/occupation-affichee.test.ts`) —
  // ce bloc ne calcule donc AUCUN pourcentage lui-même : la liste nomme la
  // personne et ses interventions du jour, et la charge détaillée (numérateur,
  // dénominateur, formule) est rendue par `Statistiques`
  // (`app/(back-office)/planning/statistiques.tsx`), le SEUL composant qui
  // porte déjà les quatre mentions inséparables — jamais une seconde forme.
  const aBesoinDeJournee =
    composition === Role.adv || composition === Role.responsable_materiel;
  const [occupationsDuJour, annuaire] = aBesoinDeJournee
    ? await Promise.all([
        occupationsDuPlanning(contexte, lignesDuJour, {
          du: jour,
          au: jourSuivant(jour, 1),
        }),
        avecContexteApplicatif(contexte, (tx) =>
          annuaireDesPersonnes(
            tx,
            techniciensTous.map((technicien) => technicien.utilisateurId),
          ),
        ),
      ])
    : [[] as readonly LigneOccupation[], ANNUAIRE_VIDE];
  const lignesAujourdhuiTechnicien: readonly LigneAujourdhuiTechnicien[] =
    aBesoinDeJournee
      ? techniciensTous
          .filter((technicien) => technicien.actif)
          .map((technicien) => ({
            technicienId: technicien.utilisateurId,
            nom: technicien.nom,
            agenceLibelle: technicien.agenceLibelle,
            absent: absencesDuJour.some(
              (a) => a.utilisateur_id === technicien.utilisateurId,
            ),
            interventions: lignesDuJour
              .filter(
                (ligne) => ligne.technicien_id === technicien.utilisateurId,
              )
              .map((ligne) => ({
                id: ligne.id,
                heure:
                  ligne.creneau_debut === null
                    ? null
                    : heureLocale(ligne.creneau_debut),
                statut: ligne.statut,
                priorite: ligne.priorite,
                clientNom: ligne.client.raison_sociale,
              })),
          }))
      : [];

  // ── « CHARGE DES 4 PROCHAINES SEMAINES » (responsable matériel, direction
  // — 9EG-TP-UX6-TABLEAU-DE-BORD-2, le MÊME bloc que le lot -1) ───────────
  const charge4Semaines =
    composition === Role.responsable_materiel || composition === Role.direction
      ? await chargerCharge4Semaines(contexte, jour, techniciensTous)
      : {
          semaines: [] as readonly SemaineDeCharge[],
          annuaire: ANNUAIRE_VIDE,
        };

  // ── « INTERVENTIONS SANS DURÉE » (les trois compositions, en bloc latéral)
  const [sansDuree, sansDureeCompte] = await Promise.all([
    listerInterventions(
      contexte,
      schemaRechercheInterventions.parse({ sans_duree_a_venir: "1" }),
    ),
    compterInterventionsSansDuree(contexte, debutDuJour),
  ]);

  // LES CLIENTS DE LA FILE « EN ATTENTE DE PIÈCE » — `enAttenteDePiece` ne
  // porte QUE `LigneIntervention` (sans jointure client, voir sa note de
  // tête) : une seconde lecture GROUPÉE, jamais une par ligne (même geste
  // que `demandes/page.tsx`).
  const clientsEnAttente =
    enAttente.length === 0
      ? []
      : await avecContexteApplicatif(contexte, (tx) =>
          tx.client.findMany({
            where: {
              id: { in: [...new Set(enAttente.map((f) => f.ligne.client_id))] },
            },
            select: { id: true, raison_sociale: true },
          }),
        );
  const nomClientEnAttenteDe = new Map(
    clientsEnAttente.map((c) => [c.id, c.raison_sociale]),
  );

  const elements: readonly ElementPriorite[] = [
    ...(CATEGORIES_PAR_COMPOSITION[composition].includes("urgent")
      ? [
          ...prioritesP1APlanifier(aPlanifier, referenceAffichee),
          ...prioritesPasDemarrees(lignesDuJour, instant, referenceAffichee),
        ]
      : []),
    ...(CATEGORIES_PAR_COMPOSITION[composition].includes("retard")
      ? prioritesEnRetard(enRetardLignes, referenceAffichee)
      : []),
    ...(CATEGORIES_PAR_COMPOSITION[composition].includes("planning")
      ? [
          ...prioritesATransmettre(
            aTransmettreAujourdhui,
            nomDuTechnicien,
            heureLocale,
          ),
          ...prioritesDemandeAQualifier(
            demandesAQualifier,
            heureLocale,
            enDuree,
          ),
        ]
      : []),
    ...(CATEGORIES_PAR_COMPOSITION[composition].includes("qualite")
      ? prioritesSignatureAbsente(signaturesAbsentes)
      : []),
    ...(CATEGORIES_PAR_COMPOSITION[composition].includes("piece")
      ? prioritesPieces(
          enAttente.map((fiche): FicheEnAttentePourPriorite => ({
            ligne: fiche.ligne,
            clientNom: nomClientEnAttenteDe.get(fiche.ligne.client_id) ?? "",
            pieceAttendueRef: fiche.pieceAttendueRef,
            ancienneteJours: fiche.ancienneteJours,
          })),
          referenceAffichee,
        )
      : []),
  ];
  const params = await searchParams;
  const filtre = filtrePrioriteLu(params.priorite);
  const elementsAffiches = elementsFiltres(elements, filtre).slice(
    0,
    LIGNES_PRIORITES,
  );

  const p1APlanifier = aPlanifier.filter((ligne) => ligne.priorite === "p1");
  const plusAncienneP1 = p1APlanifier[0];

  return (
    <Page
      chemin="/tableau-de-bord"
      titre={t("tableau_de_bord.titre")}
      sousTitre={sousTitreTableauDeBord(jour, semaineIso(jour).semaine, role)}
      actions={
        <span data-bloc="action-planning" className="flex gap-2">
          <Link href="/indicateurs" className={CLASSE_BOUTON_SECONDAIRE}>
            <Icone nom="chart" taille={16} />
            {t("nav.indicateurs_du_mois")}
          </Link>
          <Link href="/planning" className={CLASSE_BOUTON_SECONDAIRE}>
            <Icone nom="calendar" taille={16} />
            {t("tableau_de_bord.ouvrir_planning")}
          </Link>
        </span>
      }
    >
      {/* `/tableau-de-bord` reste, avec `/indicateurs`, la seule page sans
          aucun bouton de création dans son en-tête (voir le docblock de
          `BoutonPlus`) ; le bouton « + » n'apparaît qu'au téléphone. */}
      <BoutonPlus
        href="/interventions/nouvelle"
        capacite="creer_demande"
        libelle="planning.creer"
        role={contexte.role}
      />

      {plusAncienneP1 === undefined ||
      !COMPOSITIONS_AVEC_ALERTE_P1.includes(composition) ? null : (
        <Message
          ton="refus"
          titre={detailAlerteP1(
            p1APlanifier.length,
            Math.floor(
              (instant.getTime() - plusAncienneP1.cree_le.getTime()) / 60000,
            ),
            enDuree,
          )}
        >
          <p>
            {plusAncienneP1.client.raison_sociale}
            {t("ponctuation.point_median")}
            {referenceAffichee(plusAncienneP1)}
          </p>
          <div className="mt-2">
            <Link
              href={`/planning?intervention=${plusAncienneP1.id}`}
              className="bg-app-rouge-bord text-app-bleu-plein-encre inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-13 font-bold"
            >
              {t("tableau_de_bord.alerte_p1_bouton")}
            </Link>
          </div>
        </Message>
      )}

      <div
        data-bloc="kpi-grille"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {tuilesRenduesDuRole(composition).map((tuile) => {
          switch (tuile) {
            case "a_planifier":
              return (
                <div key={tuile} data-bloc="kpi-a-planifier">
                  <Kpi
                    icone="clipboard"
                    libelle={t("tableau_de_bord.tuile_a_planifier")}
                    valeur={aPlanifier.length}
                    detail={detailAPlanifier(aPlanifier, instant)}
                    href="/interventions?vue=a_planifier"
                  />
                </div>
              );
            case "aujourdhui":
              return (
                <div key={tuile} data-bloc="kpi-aujourdhui">
                  <Kpi
                    icone="calendar"
                    libelle={t("tableau_de_bord.tuile_aujourdhui")}
                    valeur={lignesDuJour.length}
                    detail={detailAujourdhui(lignesDuJour, instant)}
                    href={`/planning?vue=jour&jour=${cleJour(jour)}`}
                  />
                </div>
              );
            case "en_retard":
              return (
                <div key={tuile} data-bloc="kpi-en-retard">
                  <Kpi
                    icone="calendar"
                    ton={tonEnRetard(enRetardLignes.length)}
                    libelle={t("tableau_de_bord.kpi_en_retard")}
                    valeur={enRetardLignes.length}
                    href={lienEnRetard(enRetardLignes.length)}
                  />
                </div>
              );
            case "a_controler":
              return (
                <div key={tuile} data-bloc="kpi-a-controler">
                  <Kpi
                    icone="check-circle"
                    libelle={t("tableau_de_bord.tuile_a_controler")}
                    valeur={terminees.length}
                    href="/interventions?vue=a_controler"
                  />
                </div>
              );
            case "suspendues":
              return (
                <div key={tuile} data-bloc="kpi-suspendues">
                  <Kpi
                    icone="pause"
                    ton="orange"
                    libelle={t("tableau_de_bord.tuile_suspendues")}
                    valeur={suspenduesCompte}
                    detail={detailEnAttenteDePiece(enAttente)}
                    href="/interventions?vue=bloquees"
                  />
                </div>
              );
            case "cloture_en_mois":
              return (
                <div key={tuile} data-bloc="kpi-cloture-en-mois">
                  <Kpi
                    icone="coins"
                    libelle={libelleClotureEnMois(jour.mois)}
                    valeur={clotureEnMoisCompte}
                    unite={t("tableau_de_bord.unite_interventions")}
                    detail={t("tableau_de_bord.tuile_cloture_detail")}
                    href={`/interventions?vue=toutes&cloturee_du=${encodeURIComponent(debutMois.toISOString())}&cloturee_au=${encodeURIComponent(finMoisIncluse.toISOString())}`}
                  />
                </div>
              );
            case "parc_suivi":
              return (
                <div key={tuile} data-bloc="kpi-parc-suivi">
                  <Kpi
                    icone="machine"
                    libelle={t("tableau_de_bord.tuile_parc_suivi")}
                    valeur={parcSuiviCompte}
                    unite={t("tableau_de_bord.unite_machines")}
                    href="/parc?vue=parc"
                  />
                </div>
              );
            case "acces_a_ouvrir":
              return (
                <div key={tuile} data-bloc="kpi-acces-a-ouvrir">
                  <Kpi
                    icone="key"
                    ton={accesAOuvrirLignes.length === 0 ? "vert" : "orange"}
                    libelle={t("tableau_de_bord.tuile_acces_a_ouvrir")}
                    valeur={accesAOuvrirLignes.length}
                    detail={
                      accesAOuvrirLignes.length === 0
                        ? undefined
                        : detailAccesAOuvrir(accesAOuvrirLignes)
                    }
                    href="/parametres/equipe?acces=a-ouvrir"
                  />
                </div>
              );
            case "donnees_a_completer":
              return (
                <div key={tuile} data-bloc="kpi-donnees-a-completer">
                  <Kpi
                    icone="database"
                    ton={pointsADC.length === 0 ? "vert" : "orange"}
                    libelle={t("donnees_a_completer.titre")}
                    valeur={pointsADC.length}
                    detail={t("tableau_de_bord.tuile_donnees_detail")}
                    href="/parametres/donnees"
                  />
                </div>
              );
            case "import_en_controle":
              return (
                <div key={tuile} data-bloc="kpi-import-en-controle">
                  <Kpi
                    icone="upload"
                    libelle={t("tableau_de_bord.tuile_import_en_controle")}
                    valeur={lotsAAppliquerCompte}
                    unite={t("tableau_de_bord.unite_lot")}
                    href="/imports?vue=a-appliquer"
                  />
                </div>
              );
            default:
              return null;
          }
        })}
      </div>

      <BandeDecomptes
        elements={elementsDeLaBande({
          composition,
          demandesCompte: demandes.length,
          absencesCompte: techniciensIndisponibles(absencesDuJour),
          sansDureeCompte,
          aTransmettreCompte: aTransmettreAujourdhui.length,
          garantiesQuiFinissent,
          sousGarantieOuvertes,
          p1APlanifierCompte: p1APlanifier.length,
          habilitationsExpireesCompte,
          habilitationsARenouvelerCompte,
        })}
      />

      <div
        data-bloc="priorites-layout"
        className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,.75fr)]"
      >
        <section data-bloc="priorites-et-blocs" className="flex flex-col gap-4">
          {composition === Role.direction ? (
            <BlocMois
              titre={titreBlocMois(jour)}
              creees={moisCreees}
              cloturees={clotureEnMoisCompte}
              parNature={barresParNature(
                new Map(moisClotureesParType.map((l) => [l.type, l.compte])),
              )}
            />
          ) : null}

          {composition === Role.admin_societe ? (
            <BlocAccesAOuvrir
              lignes={accesAOuvrirLignes.map((ligne) => ({
                utilisateurId: ligne.utilisateurId,
                nom: ligne.nom,
                etatLibelle: libelleEtatAccesTuile(
                  ligne.etat,
                  ligne.etat.etat === "lien_envoye"
                    ? dateCourteLocale(ligne.etat.horodatage, fuseau)
                    : undefined,
                ),
                boutonLibelle:
                  ligne.etat.etat === "aucun"
                    ? t("tableau_de_bord.acces_envoyer")
                    : t("tableau_de_bord.acces_renvoyer"),
              }))}
            />
          ) : null}

          {composition === Role.admin_societe ? (
            <BlocDonneesACompleter points={pointsADC} />
          ) : null}

          {composition === Role.admin_societe ? null : (
            <Carte
              titre={t("tableau_de_bord.priorites_titre")}
              icone="flag"
              compte={elements.length}
              enTeteDroite={
                <SelectPriorites
                  id="priorite"
                  defaultValue={filtre}
                  options={optionsFiltrePriorites(elements)}
                  libelleAria={t("tableau_de_bord.priorites_filtre_libelle")}
                />
              }
              pied={piedPriorites(elements.length)}
            >
              <form action="/tableau-de-bord" method="get" className="sr-only">
                <button type="submit">
                  {t("tableau_de_bord.priorites_filtrer_action")}
                </button>
              </form>
              <div data-bloc="priorites-liste">
                {elementsAffiches.length === 0 ? (
                  <p className="text-app-encre-faible px-[16px] py-[15px] text-13 font-bold">
                    {t("tableau_de_bord.priorites_vide")}
                  </p>
                ) : (
                  elementsAffiches.map((element, index) => (
                    <LigneDePriorite
                      key={`${element.href}-${index}`}
                      element={element}
                    />
                  ))
                )}
              </div>
            </Carte>
          )}

          {composition === Role.adv ||
          composition === Role.responsable_materiel ? (
            <BlocAujourdhuiParTechnicien
              lignes={lignesAujourdhuiTechnicien}
              occupations={occupationsDuJour}
              annuaire={annuaire}
            />
          ) : null}

          {composition === Role.responsable_sav ? (
            <BlocTerminees
              lignes={termineesPourLeBloc(terminees)}
              nomDuTechnicien={nomDuTechnicien}
              jourEcrit={jourEcritCourt}
            />
          ) : null}
        </section>

        <section data-bloc="activite" className="flex flex-col gap-4">
          {composition === Role.responsable_materiel ||
          composition === Role.direction ? (
            <BlocCharge4Semaines
              semaines={charge4Semaines.semaines}
              annuaire={charge4Semaines.annuaire}
            />
          ) : null}

          {composition === Role.admin_societe ? (
            <BlocMiseEnRoute
              etiquette={libelleJauge(etapesMiseEnRouteCalculees)}
              pourcentage={pourcentageJauge(etapesMiseEnRouteCalculees)}
              etapes={etapesMiseEnRouteCalculees}
            />
          ) : null}

          {composition === Role.direction ||
          composition === Role.admin_societe ? (
            peutLireLeJournal ? (
              <BlocJournal
                lignes={journalLignes.map((ligne) => ({
                  id: ligne.id,
                  heure: heureLocale(ligne.horodatage),
                  texte: `${libelleEntiteJournal(ligne.entite)} ${libelleActionJournal(ligne.action)}`,
                  auteur:
                    ligne.utilisateurId === null
                      ? t("tableau_de_bord.journal_sans_auteur")
                      : auteurJournal(journalAuteurs, ligne.utilisateurId),
                  href: lienEcritureJournal(ligne),
                }))}
                compteLibelle={libelleCompteJournal(journalCompte)}
              />
            ) : null
          ) : null}

          {composition === Role.direction ||
          composition === Role.admin_societe ? null : (
            <Carte
              titre={t("tableau_de_bord.interventions_sans_duree_titre")}
              icone="hourglass"
              compte={sansDuree.length}
              pied={
                sansDuree.length === 0 ? undefined : (
                  <span className="flex items-center justify-between gap-2">
                    {t("tableau_de_bord.sans_duree_pied")}
                    <Link
                      href="/interventions?vue=toutes&sans_duree_a_venir=1"
                      className="text-app-marque font-bold"
                    >
                      {t("tableau_de_bord.lien_interventions_sans_duree")}
                    </Link>
                  </span>
                )
              }
            >
              {sansDuree.length === 0 ? (
                <p className="px-[16px] py-[15px] text-13 font-bold">
                  <span className="block">
                    {t("tableau_de_bord.sans_duree_vide_titre")}
                  </span>
                  <span className="text-app-encre-faible">
                    {t("tableau_de_bord.sans_duree_vide_texte")}
                  </span>
                </p>
              ) : (
                sansDuree.map((ligne) => (
                  <Link
                    key={ligne.id}
                    href={`/interventions/${ligne.id}?depuis=tableau_de_bord`}
                    className="border-app-bord flex items-center gap-[10px] border-b px-[16px] py-[12px] text-13 font-bold last:border-b-0"
                  >
                    <span
                      className={`rounded-full px-2 py-0.5 text-12 font-bold ${CLASSES_STATUT[ligne.statut as StatutAffiche]}`}
                    >
                      {t(`statut.${ligne.statut}` as CleTraduction)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {ligne.client.raison_sociale}
                      {t("ponctuation.point_median")}
                      {t(`type_intervention.${ligne.type}` as CleTraduction)}
                    </span>
                    <Icone nom="chev-r" taille={16} />
                  </Link>
                ))
              )}
            </Carte>
          )}
        </section>
      </div>
    </Page>
  );
}

const CLASSE_BOUTON_SECONDAIRE =
  "border-app-bord inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-13 font-bold";

function elementsDeLaBande(parametres: {
  readonly composition: CompositionRole;
  readonly demandesCompte: number;
  readonly absencesCompte: number;
  readonly sansDureeCompte: number;
  readonly aTransmettreCompte: number;
  readonly garantiesQuiFinissent: number;
  readonly sousGarantieOuvertes: number;
  readonly p1APlanifierCompte: number;
  readonly habilitationsExpireesCompte: number;
  readonly habilitationsARenouvelerCompte: number;
}): readonly ElementDecompte[] {
  const communs: readonly ElementDecompte[] = [
    {
      n: parametres.demandesCompte,
      href: "/demandes",
      libelle:
        parametres.demandesCompte === 1
          ? t("tableau_de_bord.bande_demandes_une")
          : t("tableau_de_bord.bande_demandes"),
      libelleAJour: t("tableau_de_bord.bande_demandes_zero"),
    },
    {
      n: parametres.absencesCompte,
      href: "/absences?vue=aujourdhui",
      libelle:
        parametres.absencesCompte === 1
          ? t("tableau_de_bord.bande_indisponible_un")
          : t("tableau_de_bord.bande_indisponibles"),
      libelleAJour: t("tableau_de_bord.bande_indisponible_zero"),
    },
    {
      n: parametres.sansDureeCompte,
      href: "/interventions?vue=toutes&sans_duree_a_venir=1",
      libelle:
        parametres.sansDureeCompte === 1
          ? t("tableau_de_bord.bande_sans_duree_un")
          : t("tableau_de_bord.bande_sans_duree"),
      libelleAJour: t("tableau_de_bord.bande_sans_duree_zero"),
    },
  ];
  const role = DECOMPTE_PAR_COMPOSITION[parametres.composition];
  if (role === "a_transmettre") {
    return [
      ...communs,
      {
        n: parametres.aTransmettreCompte,
        href: "/interventions?vue=aujourdhui&statut=planifiee",
        libelle:
          parametres.aTransmettreCompte === 1
            ? t("tableau_de_bord.bande_a_transmettre_un")
            : t("tableau_de_bord.bande_a_transmettre"),
        libelleAJour: t("tableau_de_bord.bande_a_transmettre_zero"),
      },
    ];
  }
  if (role === "garanties_qui_finissent") {
    return [
      ...communs,
      {
        n: parametres.garantiesQuiFinissent,
        href: "/parc?vue=garantie",
        libelle: `${
          parametres.garantiesQuiFinissent === 1
            ? t("tableau_de_bord.bande_garantie_finit_un")
            : t("tableau_de_bord.bande_garantie_finit")
        } (${t("tableau_de_bord.bande_garantie_finit_sous_prefixe")} ${JOURS_GARANTIE} ${t("tableau_de_bord.jours_suffixe")})`,
        libelleAJour: t("tableau_de_bord.bande_garantie_finit_zero"),
      },
    ];
  }
  if (role === "p1_a_planifier") {
    return [
      ...communs,
      {
        n: parametres.p1APlanifierCompte,
        href: "/planning?priorite=p1&statut=a_planifier",
        libelle: t("tableau_de_bord.bande_p1_libelle"),
        libelleAJour: t("tableau_de_bord.bande_p1_zero"),
      },
    ];
  }
  if (role === "habilitations_echeance") {
    return [
      ...communs,
      {
        n: parametres.habilitationsExpireesCompte,
        href: "/parametres/equipe?echeance=expiree",
        libelle: libelleHabilitationsExpirees(
          parametres.habilitationsExpireesCompte,
        ),
        libelleAJour: t("tableau_de_bord.bande_habilitation_expiree_zero"),
      },
      {
        n: parametres.habilitationsARenouvelerCompte,
        href: "/parametres/equipe?echeance=j60",
        libelle: libelleHabilitationsARenouveler(
          parametres.habilitationsARenouvelerCompte,
        ),
        libelleAJour: t("tableau_de_bord.bande_habilitation_renouveler_zero"),
      },
    ];
  }
  return [
    ...communs,
    {
      n: parametres.sousGarantieOuvertes,
      href: "/interventions?vue=toutes&suivi=garantie_ouvertes",
      libelle:
        parametres.sousGarantieOuvertes === 1
          ? t("tableau_de_bord.bande_garantie_ouverte_un")
          : t("tableau_de_bord.bande_garantie_ouverte"),
      libelleAJour: t("tableau_de_bord.bande_garantie_ouverte_zero"),
    },
  ];
}

function LigneDePriorite({ element }: { readonly element: ElementPriorite }) {
  return (
    <article className="border-app-bord flex items-center gap-[13px] border-b px-[16px] py-[13px] last:border-b-0">
      <div
        className={`flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full ${CLASSES_TON[element.ton]}`}
      >
        <Icone nom={element.icone} taille={18} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[14px] font-bold" title={element.titre}>
          {element.titre}
        </h3>
        <p
          className="text-app-encre-faible truncate text-[12px] font-bold"
          title={element.detail}
        >
          {element.detail}
        </p>
      </div>
      {element.actionLibelle === undefined ? (
        <Link href={element.href} aria-label={element.titre}>
          <Icone nom="chev-r" taille={18} />
        </Link>
      ) : (
        <Link
          href={element.href}
          className="border-app-bord shrink-0 rounded-md border px-3 py-1.5 text-[12px] font-bold whitespace-nowrap"
        >
          {element.actionLibelle}
        </Link>
      )}
    </article>
  );
}

/**
 * LES CANDIDATES « DEMANDE À QUALIFIER » (décision 47 d'Alexis du 09/10) —
 * `statut === "nouvelle"` ET l'accusé de réception dépasse le standard de 30
 * minutes OUVRÉES (D13, `etatAccuse`). Aucune lecture de demande neuve : les
 * demandes sont déjà lues (`demandesOuvertes`) ; seul le calendrier de
 * l'agence est lu, une fois par agence candidate (modèle `demandes/[id]/
 * page.tsx:256-275`, `planning/page.tsx:470`).
 */
async function demandesACandidatesAQualifier(
  contexte: ContexteSession,
  demandes: readonly {
    readonly id: string;
    readonly statut: string;
    readonly source: string;
    readonly client_id: string;
    readonly agence_id: string;
    readonly depose_le: Date;
    readonly compteur_accuse_le: Date;
    readonly accuse_le: Date | null;
  }[],
  instant: Date,
): Promise<
  readonly {
    readonly id: string;
    readonly clientNom: string;
    readonly source: string;
    readonly deposeLe: Date;
    readonly minutesOuvrees: number;
  }[]
> {
  const candidates = demandes.filter(
    (demande) => demande.statut === "nouvelle",
  );
  if (candidates.length === 0) {
    return [];
  }
  const societeId = contexte.societeId as string;
  const clients = await avecContexteApplicatif(contexte, (tx) =>
    tx.client.findMany({
      where: { id: { in: [...new Set(candidates.map((d) => d.client_id))] } },
      select: { id: true, raison_sociale: true },
    }),
  );
  const nomClientDe = new Map(clients.map((c) => [c.id, c.raison_sociale]));
  const cache: CacheCalendrierAgence = new Map();

  const resultats: {
    readonly id: string;
    readonly clientNom: string;
    readonly source: string;
    readonly deposeLe: Date;
    readonly minutesOuvrees: number;
  }[] = [];
  for (const demande of candidates) {
    const calendrier = await avecContexteApplicatif(contexte, (tx) =>
      chargerCalendrierAgence(
        tx,
        {
          societeId,
          agenceId: demande.agence_id,
          fenetre: {
            du: versLocal(demande.depose_le, "UTC"),
            au: versLocal(instant, "UTC"),
          },
        },
        cache,
      ),
    );
    if (calendrier === null) {
      continue;
    }
    const etat = etatAccuse(calendrier, {
      compteurDepart: demande.compteur_accuse_le,
      accuseLe: demande.accuse_le,
      maintenant: instant,
    });
    if (etat.etat === "sans_reponse" && etat.depasse) {
      resultats.push({
        id: demande.id,
        clientNom: nomClientDe.get(demande.client_id) ?? "",
        source: demande.source,
        deposeLe: demande.depose_le,
        minutesOuvrees: etat.minutesOuvrees,
      });
    }
  }
  return resultats;
}

function termineesPourLeBloc(
  terminees: readonly {
    readonly id: string;
    readonly numero: number | null;
    readonly technicien_id: string | null;
    readonly date_planifiee: Date | null;
    readonly client: { readonly raison_sociale: string };
    readonly signatures: readonly {
      readonly issue: string;
      readonly motif: string | null;
      readonly signataire_nom: string | null;
    }[];
  }[],
): readonly LigneTerminee[] {
  return terminees.map((ligne) => {
    const signature = ligne.signatures[0];
    return {
      id: ligne.id,
      reference: referenceAffichee(ligne),
      clientNom: ligne.client.raison_sociale,
      technicienId: ligne.technicien_id,
      datePlanifiee: ligne.date_planifiee,
      signature:
        signature === undefined
          ? undefined
          : {
              issue: signature.issue,
              motif: signature.motif,
              signataireNom: signature.signataire_nom,
            },
    };
  });
}

/** `DD/MM`, écrit à la main sur une colonne `@db.Date` — jamais `toLocaleDateString` (L0-08). */
function jourEcritCourt(date: Date | null): string {
  if (date === null) {
    return "";
  }
  const jourNum = String(date.getUTCDate()).padStart(2, "0");
  const moisNum = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${jourNum}/${moisNum}`;
}

/** L'auteur d'une écriture du journal — « — » quand l'annuaire refuse la désignation (même geste que `lib/interventions/depot.ts:3003`). */
function auteurJournal(annuaire: Annuaire, utilisateurId: string): string {
  const designation = annuaire(utilisateurId);
  return designation.etat === "nom" ? designation.nom : "—";
}

/**
 * LA CHARGE DES 4 PROCHAINES SEMAINES — une lecture de planning de 4 semaines
 * (NEUVE : aucun appelant existant n'avait besoin de cette fenêtre), puis
 * `occupationsDuPlanning` appelée UNE FOIS PAR SEMAINE, chacune sur ses
 * propres lignes.
 *
 * **LE TAUX NE S'AFFICHE JAMAIS SEUL** (D56, `tests/unit/interventions/
 * occupation-affichee.test.ts`) : cette fonction rend donc les `LigneOccupation`
 * BRUTES de chaque semaine, jamais un pourcentage déjà calculé — c'est
 * `Statistiques` (`app/(back-office)/planning/statistiques.tsx`) qui les
 * affichera, avec ses quatre mentions inséparables.
 *
 * « Absent » quand une absence couvre tous les jours ouvrés de la semaine
 * (lundi à samedi), même disposition que la maquette (`charge4Card`,
 * :2812-2813) — une liste de NOMS, pas une mesure de charge.
 */
async function chargerCharge4Semaines(
  contexte: ContexteSession,
  jour: JourLocal,
  techniciens: readonly {
    readonly utilisateurId: string;
    readonly nom: string;
    readonly actif: boolean;
  }[],
): Promise<{
  readonly semaines: readonly SemaineDeCharge[];
  readonly annuaire: Annuaire;
}> {
  const lundi0 = lundiDeLaSemaine(jour);
  const debut = instantDuJour(lundi0);
  const fin = instantDuJour(jourSuivant(lundi0, 28));
  const [lignes, absences, annuaire] = await Promise.all([
    listerPlanning(contexte, debut, fin, undefined, { inclureAnnulees: false }),
    absencesDeLaPeriode(contexte, debut, fin),
    avecContexteApplicatif(contexte, (tx) =>
      annuaireDesPersonnes(
        tx,
        techniciens.map((technicien) => technicien.utilisateurId),
      ),
    ),
  ]);

  const actifs = techniciens.filter((technicien) => technicien.actif);
  const semaines = [0, 1, 2, 3].map((k) => jourSuivant(lundi0, 7 * k));
  const parSemaine = await Promise.all(
    semaines.map(async (debutSemaine) => {
      const finSemaine = jourSuivant(debutSemaine, 7);
      const debutInstant = instantDuJour(debutSemaine);
      const finInstant = instantDuJour(finSemaine);
      const lignesSemaine = lignes.filter(
        (ligne) =>
          ligne.date_planifiee !== null &&
          ligne.date_planifiee.getTime() >= debutInstant.getTime() &&
          ligne.date_planifiee.getTime() < finInstant.getTime(),
      );
      const occupations = await occupationsDuPlanning(contexte, lignesSemaine, {
        du: debutSemaine,
        au: finSemaine,
      });
      const samediInstant = instantDuJour(jourSuivant(debutSemaine, 5));
      const absentsDeLaSemaine = actifs.filter((technicien) =>
        absences.some(
          (a) =>
            a.utilisateur_id === technicien.utilisateurId &&
            a.du.getTime() <= debutInstant.getTime() &&
            a.au.getTime() >= samediInstant.getTime(),
        ),
      );
      return {
        numero: semaineIso(debutSemaine).semaine,
        occupations: occupations.filter(
          (o) =>
            !absentsDeLaSemaine.some((a) => a.utilisateurId === o.technicienId),
        ),
        absentsNoms: absentsDeLaSemaine.map((technicien) => technicien.nom),
      };
    }),
  );

  return { semaines: parSemaine, annuaire };
}
