import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LienPrimaire } from "@/components/ui/action-primaire";
import { CLASSES_TON } from "@/components/ui/badge";
import { Carte } from "@/components/ui/carte";
import { Kpi } from "@/components/ui/kpi";
import { Page } from "@/components/mise-en-page/page";
import { obtenirSession } from "@/lib/auth/session";
import {
  cleJour,
  instantDuJour,
  jourDe,
  maintenant,
  schemaFuseau,
} from "@/lib/calendar/fuseau";
import { lundiDeLaSemaine } from "@/lib/calendar/semaine";
import { absencesDeLaPeriode } from "@/lib/absences/depot";
import { avecContexteApplicatif } from "@/lib/db/client";
import { demandesOuvertes } from "@/lib/demandes/depot";
import { t } from "@/lib/i18n/fr";
import {
  compterInterventionsSansDuree,
  compterParVue,
  enAttenteDePiece,
  listerPlanning,
} from "@/lib/interventions/depot";
import { schemaRechercheInterventions } from "@/lib/interventions/saisie";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { tonDePriorite } from "@/lib/theme/priorites";
import { compterAPrevoir } from "@/lib/vgp/registre";
import { auMoinsUneVerificationEnregistree } from "@/lib/vgp/verification";

import { referenceAffichee } from "../interventions/presentation";

import {
  detailEnAttenteDePiece,
  detailInterventionsDuJour,
  detailVgpAPrevoir,
  elementsFiltres,
  etatVgpAPrevoir,
  filtrePrioriteLu,
  interventionsDuJour,
  prioritesAPlanifier,
  prioritesPieces,
  prioritesUrgentes,
  techniciensIndisponibles,
  valeurVgpAPrevoir,
  type ElementPriorite,
} from "./presentation";

const HORIZON_VGP_JOURS = 30;

/**
 * LA RECHERCHE VIDE (99V-GR6-TUILES) — le critère de l'onglet « Toutes »,
 * client actif compris. Sert à interroger `compterParVue` pour un compte
 * qui doit dire EXACTEMENT ce que l'onglet « Bloquées » du registre montre
 * quand rien n'y est filtré, jamais une seconde forme du même critère
 * (`filtreClientActif`, `lib/interventions/depot.ts`).
 */
const CRITERES_REGISTRE_VIDE = schemaRechercheInterventions.parse({});

/**
 * LE LIEN SOUS UNE TUILE (98-TABLEAU-2) — 13 px, et une zone cliquable d'au
 * moins 32 px de haut. L'audit d'ergonomie du 25/09/2026 (constat 4) mesurait
 * 11,5 px et ~17 px sur les liens déjà posés (`lien_charge_planning`,
 * `lien_vgp_a_prevoir`, `lien_demandes`, `lien_interventions_sans_duree`) : ce
 * ticket les corrige EN MÊME TEMPS qu'il pose les deux liens neufs, plutôt que
 * de laisser deux tailles cohabiter sur le même écran.
 */
const CLASSES_LIEN_TUILE = `inline-flex min-h-[32px] items-center text-[13px] ${CLASSES_LIEN}`;

/**
 * « NON CALCULÉ », EN TEXTE COURANT (GR17-M8, audit du 26/09/2026, constat M8)
 * — mesuré dans le gros chiffre des tuiles au même corps que le taux ou le
 * compte qu'il remplace, ce qui le fait lire comme une mesure. Reprend la
 * taille et la graisse du texte de détail de la tuile (`text-[11px]`, poids
 * normal), jamais une nouvelle valeur : le motif reste inchangé, seule sa
 * typographie se distingue du chiffre.
 */
function nonCalcule(): React.ReactNode {
  return (
    <span
      data-non-calcule=""
      className="text-app-encre-faible text-[11px] font-normal"
    >
      {t("tableau_de_bord.non_calcule")}
    </span>
  );
}

export const metadata: Metadata = { title: t("tableau_de_bord.titre") };

/**
 * LE TABLEAU DE BORD (AV-10, réécrit sous D125) — le premier écran de la
 * maquette (R2-13), à l'IDENTIQUE de `dashboard()` de
 * `codiplan-maquette-complete.html`.
 *
 * ## CE QUE D125 REND CADUC ICI, ET CE QU'ELLE NE REND PAS CADUC (D128)
 *
 * Jusqu'à ce ticket (lot A1), cet écran empilait un tableau « Interventions
 * du jour » qu'AUCUNE des deux maquettes ne dessine sous cette forme — une
 * disposition inventée avant que `codiplan-maquette-complete.html` ne fasse
 * foi sur celle des écrans qu'elle dessine (D125, 18/09/2026). `dashboard()`
 * pose QUATRE KPI, puis deux cartes côte à côte — « Priorités
 * opérationnelles » et « Activité récente » — jamais un tableau : le tableau
 * est donc RETIRÉ.
 *
 * **D128 (18/09/2026 au soir) tranche l'AUTRE moitié : D125 fait foi sur la
 * DISPOSITION, jamais sur une information réelle que la maquette ignore.**
 * Les quatre KPI de `dashboard()` sont donc rendus EN PREMIER, dans la grille
 * qu'elle dessine — et DEUX des trois KPI que ce dépôt savait déjà calculer
 * sans équivalent dans la maquette restent, sous un intitulé propre, dans une
 * seconde grille sous la première : un AJOUT VOLONTAIRE, jamais un écart à
 * combler.
 *
 * - **« Demandes en attente de qualification »** (`demandesOuvertes`) : ce
 *   que la file de qualification (lot 2, avant tout intervention) porte
 *   aujourd'hui. Depuis D128, la carte MÈNE quelque part ; depuis DEMANDES-1,
 *   elle mène à `/demandes` — la file de qualification elle-même, plutôt qu'à
 *   `/interventions/nouvelle` — parce que cette route et sa fiche existent
 *   désormais. *Un chiffre sans chemin est la même faute que le zéro muet que
 *   ce dépôt corrige ailleurs* : `/demandes` est maintenant le chemin réel où
 *   une demande se qualifie, se clôt sans suite, ou se marque transformée.
 * - **« Techniciens indisponibles aujourd'hui »** (`absencesDeLaPeriode` +
 *   `techniciensIndisponibles`) : combien de personnes sont couvertes par un
 *   blocage d'agenda aujourd'hui — une lecture DIFFÉRENTE de celle
 *   qu'`/absences` fait pour sa propre semaine (§9, 01/09 : même critère,
 *   deux moments, jamais recalculé à la place de l'original).
 *
 * **UN TROISIÈME AJOUT VOLONTAIRE REJOINT CE BLOC (PG-C1b-EN-RETARD-TABLEAU,
 * bug 8 de l'audit d'ergonomie du 27/09/2026, §4.1, CA-5)** — les
 * « Priorités opérationnelles » listaient les P1 du jour, les pièces
 * attendues et la file à planifier, mais jamais une intervention planifiée
 * dont la date est déjà passée sans qu'aucun travail n'ait commencé.
 * - **« Interventions en retard »** (`comptesRegistre.en_retard`, lu par le
 *   même `compterParVue` que « Dossiers bloqués » plus haut) : le MÊME
 *   critère que `enRetard` (`lib/interventions/retard.ts`) et que l'onglet
 *   « En retard » du registre (PG-C1c-EN-RETARD-REGISTRE) — jamais une
 *   troisième lecture du même critère (§9, 01/09).
 *
 * **« Clients sans code externe » A QUITTÉ CE BANDEAU le 19/09/2026 (lot
 * AV-14)** — mesuré en ligne comme le plus gros chiffre de tout l'écran,
 * devant les deux tuiles qui appellent réellement un geste du jour. Un
 * problème de QUALITÉ DE DONNÉES n'est pas une alerte du matin ; `/clients`
 * porte déjà exactement la même lecture (`titreSansCode`,
 * `compterSansCodeExterne`) pour sa propre carte, à l'endroit où on la
 * corrige.
 *
 * ## LE SIXIÈME CHIFFRE N'EXISTE NULLE PART, ET IL NE S'INVENTE PAS (§8)
 *
 * R2-13 reste BLOQUÉ sur le taux d'occupation CONSOLIDÉ — `lib/interventions/
 * statistiques.ts` rend un taux PAR TECHNICIEN, déjà appelé par `/planning` ;
 * agréger plusieurs techniciens et plusieurs calendriers d'agence en UN SEUL
 * taux n'est écrit nulle part au chapitre 10. La carte l'affiche donc
 * `Non calculé` — jamais un zéro, jamais un tiret : les deux se liraient
 * comme une mesure (doctrine §3).
 *
 * **LE MOTIF « R2-13 » A QUITTÉ L'ÉCRAN LE 23/09/2026 (TABLEAU-1)** : mesuré
 * en ligne, une référence de ticket interne dans une tuile lue par un
 * opérateur — deux zones inertes nommées au même constat, avec la carte
 * « Activité récente » ci-dessous. La tuile GARDE sa place et son nombre
 * (D125, l'ORDRE et le NOMBRE des quatre tuiles ne bougent pas) mais mène
 * maintenant quelque part : un lien vers `/planning`, où le taux PAR
 * TECHNICIEN — la seule maille que ce dépôt sait calculer — est déjà affiché.
 *
 * **« VGP à prévoir » PEUT MENTIR PAR OMISSION DE LA MÊME FAÇON (lot
 * AV-14)** : `compterAPrevoir` rend 0 aussi bien quand rien n'est dû dans
 * l'horizon que quand le registre n'a JAMAIS reçu de vérification — deux
 * situations que le chiffre seul ne distingue pas (voir `etatVgpAPrevoir` et
 * `auMoinsUneVerificationEnregistree`, `lib/vgp/verification.ts`). La
 * seconde emprunte donc le même texte `Non calculé` que le taux d'occupation,
 * plutôt qu'une troisième forme.
 *
 * **ET ELLE MENTAIT SUR LE RETARD (VGP-2, 22/09/2026)** : mesuré sur
 * d9c9446, une machine dont l'échéance était passée depuis huit mois ne
 * comptait pas — `compterAPrevoir` écartait `< 0` —, et la tuile rendait
 * « 0 » avec « Dans les 30 prochains jours ». La tuile dit désormais TROIS
 * voies (`detailVgpAPrevoir`) : DÉPASSÉE, À VENIR sous `HORIZON_VGP_JOURS`,
 * SANS INFORMATION — et son grand chiffre (`valeurVgpAPrevoir`) compte les
 * dépassées avec les à venir. Même ordre, même nombre de tuiles (D125).
 *
 * **ET ELLE NE DISAIT PAS LA MÊME CHOSE QUE LE REGISTRE (TABLEAU-1,
 * 23/09/2026)** : mesuré en production le 23/09 — 81 échéances dépassées
 * ici, 78 sur `/vgp`. `compterAPrevoir` lit tout le parc cloisonné, sans
 * plafond ; `/vgp` composait son résumé à partir des lignes déjà bornées
 * pour son AFFICHAGE (200), même faute qu'AT-07 avait fermée pour `/parc`.
 * Réparé côté registre (`lib/vgp/registre.ts`, `LIGNES_RESUME_MAXIMALES`) :
 * les deux comptent désormais tout le même parc. La tuile OUVRE maintenant
 * `/vgp?etat=depassees` — un chiffre sans chemin vers ce qu'il compte est la
 * même faute que le zéro muet corrigé ailleurs.
 *
 * ## « PRIORITÉS OPÉRATIONNELLES » — voir `./presentation.ts`
 *
 * Les quatre lignes de démonstration de `priorityItems()` n'ont pas de
 * contrepartie exacte ; ce que la carte affiche vient de trois lectures
 * réelles déjà écrites, composées par `prioritesUrgentes`, `prioritesPieces`
 * et `prioritesAPlanifier`. **Chaque élément porte sa PRIORITÉ depuis le
 * 23/09/2026 (TABLEAU-1)** : mesuré en ligne, une fiche P1 — critique
 * s'affichait « 01 Intervention à planifier », indiscernable d'une P4 — voir
 * `prioritesAPlanifier`.
 *
 * ## « ACTIVITÉ RÉCENTE » N'AVAIT AUCUNE SOURCE — REMPLACÉE LE 23/09/2026
 *    (TABLEAU-1) PAR UNE VRAIE MESURE
 *
 * `journal_audit` (I8) trace les écritures, pour l'audit — *« lue par
 * personne aujourd'hui »* était déjà l'état d'une table voisine du même
 * périmètre (`journal_acces`, `docs/arbitrages.md`), et la carte le disait en
 * toutes lettres plutôt que d'inventer un fil. **Le marqueur `data-bloc=
 * "activite"` reste** (D125 : l'ORDRE et le NOMBRE des blocs de cette
 * disposition ne bougent pas, gardé par `tests/unit/ui/lot-a1-a4.test.ts`),
 * mais son CONTENU change : la carte affiche désormais le compte
 * d'interventions PLANIFIÉES sans durée prévue (`compterInterventionsSansDuree`,
 * `lib/interventions/depot.ts`) — une donnée réelle, qui fausse la charge
 * tant qu'elle n'est pas saisie, et que la durée obligatoire (décision
 * d'Alexis du 23/09/2026) va bientôt fermer.
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

  const [
    lignesPlanning,
    enAttente,
    comptesRegistre,
    vgpAPrevoir,
    demandes,
    absencesDuJour,
    auMoinsUneVerification,
    interventionsSansDuree,
  ] = await Promise.all([
    // LES ANNULÉES N'ENTRENT NI DANS « INTERVENTIONS AUJOURD'HUI » NI DANS
    // « URGENCES » (TP-A6-TRIS-MISE-EN-PAGE, audit du 28/09/2026, IN-46) :
    // ni l'une ni l'autre tuile ne doit compter une intervention dont le
    // travail ne se fera plus. `aPlanifier` (plus bas) n'est pas concernée —
    // son filtre `statut === "a_planifier"` exclut déjà une annulée, qui
    // porte un autre statut.
    listerPlanning(contexte, debutDuJour, finDuJour, undefined, {
      inclureAnnulees: false,
    }),
    // DEUX PARAMÈTRES DATÉS (DATES-1) : `instant` réel pour `ancienneteJours`
    // (des jours ENTIERS écoulés), `debutDuJour` — la civile — pour
    // `horizonDepasse`, comparée à `date_dispo_prevue` (`@db.Date`).
    enAttenteDePiece(contexte, instant, debutDuJour),
    // LE TOTAL DE LA TUILE « DOSSIERS BLOQUÉS » (99V-GR6-TUILES) — TOUTES les
    // suspendues, le même critère que l'onglet « Bloquées » du registre :
    // `enAttente` ci-dessus n'en est qu'un DÉTAIL, la file plus étroite des
    // seules pièces attendues.
    compterParVue(contexte, CRITERES_REGISTRE_VIDE),
    // LA CIVILE, JAMAIS L'INSTANT (L0-08) : `prochaineEcheance` est une
    // `@db.Date` posée à minuit UTC. Lui comparer `instant` (l'heure qu'il
    // est) fait tomber une échéance du JOUR MÊME sous zéro dès que l'horloge
    // dépasse minuit — une machine due aujourd'hui disparaîtrait du KPI
    // pour le reste de la journée. `debutDuJour` porte la même forme civile
    // que la colonne comparée.
    compterAPrevoir(contexte, debutDuJour, HORIZON_VGP_JOURS),
    demandesOuvertes(contexte),
    absencesDeLaPeriode(contexte, debutDuJour, debutDuJour),
    // INDÉPENDANTE DE TOUT CE QUI PRÉCÈDE (lot AV-14) — une existence, jamais
    // un résultat des cinq lectures ci-dessus, jamais lue par elles.
    auMoinsUneVerificationEnregistree(contexte),
    // `debutDuJour` BORNE DÉSORMAIS LA POPULATION (AFFICHAGE-MATERIEL-1,
    // 23/09/2026) — voir la note de tête de `compterInterventionsSansDuree` :
    // sans cette borne, la tuile comptait tout l'historique clôturé.
    compterInterventionsSansDuree(contexte, debutDuJour),
  ]);
  const etatVgp = etatVgpAPrevoir(auMoinsUneVerification, vgpAPrevoir);

  const lignesDuJour = interventionsDuJour(
    lignesPlanning,
    debutDuJour,
    finDuJour,
  );
  // `listerPlanning` REND AUSSI TOUTE LA FILE D'ATTENTE, non paginée, quelle
  // que soit la fenêtre demandée (voir sa propre note) : c'est elle qui sert
  // les interventions « à planifier », jamais `listerInterventions` avec sa
  // page de LIMITE_RECHERCHE_PAR_DEFAUT — au-delà de cinquante en file,
  // les plus anciennes (donc les plus prioritaires à replacer) auraient
  // simplement disparu de la carte.
  const aPlanifier = lignesPlanning.filter(
    (ligne) => ligne.statut === "a_planifier",
  );

  const elements: readonly ElementPriorite[] = [
    ...prioritesUrgentes(lignesDuJour, referenceAffichee),
    ...prioritesPieces(enAttente, referenceAffichee),
    ...prioritesAPlanifier(aPlanifier, referenceAffichee),
  ];
  const params = await searchParams;
  const filtre = filtrePrioriteLu(params.priorite);
  const elementsAffiches = elementsFiltres(elements, filtre);

  return (
    <Page
      chemin="/tableau-de-bord"
      titre={t("tableau_de_bord.titre")}
      sousTitre={t("tableau_de_bord.sous_titre")}
      actions={
        <span data-bloc="action-planning" className="contents">
          <LienPrimaire href="/planning">
            {t("tableau_de_bord.ouvrir_planning")}
          </LienPrimaire>
        </span>
      }
    >
      <div
        data-bloc="kpi-grille"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div data-bloc="kpi-interventions" className="flex flex-col gap-1.5">
          <Kpi
            libelle={t("tableau_de_bord.kpi_interventions_jour")}
            valeur={lignesDuJour.length}
            detail={detailInterventionsDuJour(lignesDuJour)}
          />
          {/* LA VUE JOUR DU PLANNING, AU JOUR MÊME (98-TABLEAU-2) — même
              forme que `retourPlanning` (`../interventions/presentation.ts`) :
              `vue=jour&jour=<cléJour>`, jamais une URL reconstruite ici avec
              un vocabulaire différent. */}
          <Link
            href={`/planning?vue=jour&jour=${cleJour(jour)}`}
            className={CLASSES_LIEN_TUILE}
          >
            {t("tableau_de_bord.lien_interventions_jour")}
          </Link>
        </div>
        <div data-bloc="kpi-occupation" className="flex flex-col gap-1.5">
          <Kpi
            ton="vert"
            libelle={t("tableau_de_bord.kpi_taux_occupation")}
            valeur={nonCalcule()}
          />
          <Link href="/planning" className={CLASSES_LIEN_TUILE}>
            {t("tableau_de_bord.lien_charge_planning")}
          </Link>
        </div>
        <div data-bloc="kpi-bloques" className="flex flex-col gap-1.5">
          <Kpi
            ton="orange"
            libelle={t("tableau_de_bord.kpi_dossiers_bloques")}
            valeur={comptesRegistre.bloquees}
            detail={detailEnAttenteDePiece(enAttente)}
          />
          {/* LA TUILE MÈNE MAINTENANT À L'ONGLET QU'ELLE COMPTE
              (99V-GR6-TUILES, audit du 26/09/2026, constat G7) — jusqu'ici
              AUCUN LIEN, mesuré et documenté (98-TABLEAU-2), parce que le
              total venait d'`enAttenteDePiece` (`piece_attendue_ref`), une
              file plus ÉTROITE que l'onglet « Bloquées » (`statut ===
              "suspendue"`, RG-INT-06 permettant une suspension sans attente
              de pièce). Le total de CETTE tuile vient désormais de
              `compterParVue`, le MÊME critère que l'onglet — un lien vers une
              liste plus large que le compte affiché aurait été la faute que
              98-TABLEAU-2 interdisait ; ce n'en est plus une. Voir la
              passation. */}
          <Link
            href="/interventions?vue=bloquees"
            className={CLASSES_LIEN_TUILE}
          >
            {t("tableau_de_bord.lien_dossiers_bloques")}
          </Link>
        </div>
        <div data-bloc="kpi-vgp" className="flex flex-col gap-1.5">
          <Kpi
            ton="rouge"
            libelle={t("tableau_de_bord.kpi_vgp_a_prevoir")}
            valeur={etatVgp.calcule ? valeurVgpAPrevoir(etatVgp) : nonCalcule()}
            detail={
              etatVgp.calcule
                ? detailVgpAPrevoir(etatVgp, HORIZON_VGP_JOURS)
                : t("tableau_de_bord.vgp_a_prevoir_motif_non_calcule")
            }
          />
          <Link href="/vgp?etat=depassees" className={CLASSES_LIEN_TUILE}>
            {t("tableau_de_bord.lien_vgp_a_prevoir")}
          </Link>
        </div>
      </div>

      {/* LA SECONDE GRILLE — deux AJOUTS VOLONTAIRES, sans équivalent dans
          `dashboard()` (D128) : voir le docblock de tête, un paragraphe par
          KPI. `dashboard()` ne dessine rien ici ; ce bloc n'a donc pas de
          marqueur `data-bloc` attendu par le gardien de composition. */}
      <h2 className="text-app-encre-faible text-[11px] font-bold tracking-[0.6px] uppercase">
        {t("tableau_de_bord.indicateurs_complementaires_titre")}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Kpi
            libelle={t("tableau_de_bord.kpi_demandes_ouvertes")}
            valeur={demandes.length}
          />
          <Link href="/demandes" className={CLASSES_LIEN_TUILE}>
            {t("tableau_de_bord.lien_demandes")}
          </Link>
        </div>
        <div className="flex flex-col gap-1.5">
          <Kpi
            ton="orange"
            libelle={t("tableau_de_bord.kpi_absences_jour")}
            valeur={techniciensIndisponibles(absencesDuJour)}
          />
          {/* `/absences` NE PREND QU'UNE SEMAINE (`?semaine=<lundi>`), jamais
              un jour seul (98-TABLEAU-2) — son calendrier dessine sept
              colonnes, pas une. `semaine` VISE la semaine qui contient
              AUJOURD'HUI, la même que le calcul de la tuile
              (`techniciensIndisponibles(absencesDuJour)`, borné à `debutDuJour`
              plus haut) : le paramètre est explicite plutôt que de compter sur
              le repli par défaut de l'écran, qui recalculerait la même chose
              en silence. */}
          <Link
            href={`/absences?semaine=${cleJour(lundiDeLaSemaine(jour))}`}
            className={CLASSES_LIEN_TUILE}
          >
            {t("tableau_de_bord.lien_absences_jour")}
          </Link>
        </div>
        {/* « EN RETARD » (PG-C1b-EN-RETARD-TABLEAU, bug 8 de l'audit
            d'ergonomie du 27/09/2026, §4.1, CA-5) — TROISIÈME AJOUT
            VOLONTAIRE de ce bloc (D128), même titre que les deux tuiles
            au-dessus. Le compte vient de `comptesRegistre.en_retard`
            (`compterParVue`, déjà lu plus haut pour « Dossiers bloqués ») —
            le MÊME critère que l'onglet « En retard » du registre
            (PG-C1c-EN-RETARD-REGISTRE), jamais une seconde lecture (§9,
            01/09). À 0, la tuile affiche « 0 » : c'est une bonne nouvelle,
            pas l'absence d'une mesure. */}
        <div data-bloc="kpi-en-retard" className="flex flex-col gap-1.5">
          <Kpi
            ton="rouge"
            libelle={t("tableau_de_bord.kpi_en_retard")}
            valeur={comptesRegistre.en_retard}
          />
          <Link
            href="/interventions?vue=en_retard"
            className={CLASSES_LIEN_TUILE}
          >
            {t("tableau_de_bord.lien_en_retard")}
          </Link>
        </div>
      </div>

      <div
        data-bloc="priorites-layout"
        className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,.75fr)]"
      >
        <section data-bloc="priorites" className="contents">
          <Carte titre={t("tableau_de_bord.priorites_titre")}>
            <form
              action="/tableau-de-bord"
              method="get"
              className="border-app-bord flex flex-wrap items-center gap-2 border-b px-[16px] py-[10px]"
            >
              <label className="sr-only" htmlFor="priorite">
                {t("tableau_de_bord.priorites_filtre_libelle")}
              </label>
              <select
                id="priorite"
                name="priorite"
                defaultValue={filtre}
                data-bloc="priorites-filtre"
                className="border-app-bord bg-app-surface h-[36px] rounded-[9px] border px-2 text-[12.5px]"
              >
                <option value="tous">
                  {t("tableau_de_bord.priorites_filtre_tous")}
                </option>
                <option value="urgent">
                  {t("tableau_de_bord.priorites_filtre_urgent")}
                </option>
                <option value="piece">
                  {t("tableau_de_bord.priorites_filtre_piece")}
                </option>
                <option value="planning">
                  {t("tableau_de_bord.priorites_filtre_planning")}
                </option>
              </select>
              <button
                type="submit"
                className="border-app-bord rounded-[9px] border px-3 py-1.5 text-[12.5px] font-semibold"
              >
                {t("tableau_de_bord.priorites_filtrer_action")}
              </button>
            </form>
            <div data-bloc="priorites-liste">
              {elementsAffiches.length === 0 ? (
                <p className="text-app-encre-faible px-[16px] py-[15px] text-[12.5px]">
                  {t("tableau_de_bord.priorites_vide")}
                </p>
              ) : (
                elementsAffiches.map((element) => (
                  <ElementDePriorite
                    key={element.href + element.rang}
                    element={element}
                  />
                ))
              )}
            </div>
          </Carte>
        </section>

        <section data-bloc="activite" className="contents">
          <Carte titre={t("tableau_de_bord.interventions_sans_duree_titre")}>
            <div className="flex flex-col gap-1.5 px-[16px] py-[15px]">
              <Kpi
                ton="orange"
                libelle={t("tableau_de_bord.kpi_interventions_sans_duree")}
                valeur={interventionsSansDuree}
              />
              {/*
                LE LIEN MÈNE À LA LISTE FILTRÉE SUR LE MÊME CRITÈRE QUE LA
                TUILE (AFFICHAGE-MATERIEL-1, 23/09/2026) — jamais le registre
                nu : `sans_duree_a_venir=1` pose le MÊME critère que
                `compterInterventionsSansDuree` (§9, 01/09).
              */}
              <Link
                href="/interventions?sans_duree_a_venir=1"
                className={CLASSES_LIEN_TUILE}
              >
                {t("tableau_de_bord.lien_interventions_sans_duree")}
              </Link>
            </div>
          </Carte>
        </section>
      </div>
    </Page>
  );
}

function ElementDePriorite({ element }: { readonly element: ElementPriorite }) {
  const classesTon =
    element.priorite === undefined
      ? "bg-app-rouge-fond text-app-rouge-encre"
      : CLASSES_TON[tonDePriorite(element.priorite)];
  return (
    <article className="border-app-bord flex items-center gap-[13px] border-b px-[17px] py-[15px] last:border-b-0">
      <div
        className={`flex h-[39px] w-[39px] shrink-0 items-center justify-center rounded-[11px] text-[13px] font-black ${classesTon}`}
      >
        {element.rang}
      </div>
      <div className="min-w-0 flex-1">
        {/* TRONQUÉ PROPREMENT, INFOBULLE AVEC LE TEXTE ENTIER (GR7,
            27/09/2026) — même geste que `siteDeLaCarte`/`materielDeLaCarte`
            sur `/planning` : la panne signalée n'a pas de longueur bornée. */}
        <h3 className="truncate text-[14px] font-bold" title={element.titre}>
          {element.titre}
        </h3>
        <p className="text-app-encre-faible text-[12px]">{element.detail}</p>
      </div>
      <Link
        href={element.href}
        className="border-app-bord rounded-md border px-3 py-1.5 text-[12px] font-semibold"
      >
        {t("tableau_de_bord.priorites_ouvrir")}
      </Link>
    </article>
  );
}
