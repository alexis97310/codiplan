import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LienPrimaire } from "@/components/ui/action-primaire";
import { Carte } from "@/components/ui/carte";
import { Kpi } from "@/components/ui/kpi";
import { Page } from "@/components/mise-en-page/page";
import { obtenirSession } from "@/lib/auth/session";
import {
  instantDuJour,
  jourDe,
  maintenant,
  schemaFuseau,
} from "@/lib/calendar/fuseau";
import { absencesDeLaPeriode } from "@/lib/absences/depot";
import { avecContexteApplicatif } from "@/lib/db/client";
import { demandesOuvertes } from "@/lib/demandes/depot";
import { t } from "@/lib/i18n/fr";
import {
  compterInterventionsSansDuree,
  enAttenteDePiece,
  listerPlanning,
} from "@/lib/interventions/depot";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
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
    vgpAPrevoir,
    demandes,
    absencesDuJour,
    auMoinsUneVerification,
    interventionsSansDuree,
  ] = await Promise.all([
    listerPlanning(contexte, debutDuJour, finDuJour),
    // DEUX PARAMÈTRES DATÉS (DATES-1) : `instant` réel pour `ancienneteJours`
    // (des jours ENTIERS écoulés), `debutDuJour` — la civile — pour
    // `horizonDepasse`, comparée à `date_dispo_prevue` (`@db.Date`).
    enAttenteDePiece(contexte, instant, debutDuJour),
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
    // INDÉPENDANTE ELLE AUSSI (TABLEAU-1) — aucune borne de période, voir
    // `compterInterventionsSansDuree`.
    compterInterventionsSansDuree(contexte),
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
        <div data-bloc="kpi-interventions">
          <Kpi
            libelle={t("tableau_de_bord.kpi_interventions_jour")}
            valeur={lignesDuJour.length}
            detail={detailInterventionsDuJour(lignesDuJour)}
          />
        </div>
        <div data-bloc="kpi-occupation" className="flex flex-col gap-1.5">
          <Kpi
            ton="vert"
            libelle={t("tableau_de_bord.kpi_taux_occupation")}
            valeur={t("tableau_de_bord.non_calcule")}
          />
          <Link href="/planning" className={`text-[11.5px] ${CLASSES_LIEN}`}>
            {t("tableau_de_bord.lien_charge_planning")}
          </Link>
        </div>
        <div data-bloc="kpi-bloques">
          <Kpi
            ton="orange"
            libelle={t("tableau_de_bord.kpi_dossiers_bloques")}
            valeur={enAttente.length}
            detail={detailEnAttenteDePiece(enAttente)}
          />
        </div>
        <div data-bloc="kpi-vgp" className="flex flex-col gap-1.5">
          <Kpi
            ton="rouge"
            libelle={t("tableau_de_bord.kpi_vgp_a_prevoir")}
            valeur={
              etatVgp.calcule
                ? valeurVgpAPrevoir(etatVgp)
                : t("tableau_de_bord.non_calcule")
            }
            detail={
              etatVgp.calcule
                ? detailVgpAPrevoir(etatVgp, HORIZON_VGP_JOURS)
                : t("tableau_de_bord.vgp_a_prevoir_motif_non_calcule")
            }
          />
          <Link
            href="/vgp?etat=depassees"
            className={`text-[11.5px] ${CLASSES_LIEN}`}
          >
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Kpi
            libelle={t("tableau_de_bord.kpi_demandes_ouvertes")}
            valeur={demandes.length}
          />
          <Link href="/demandes" className={`text-[11.5px] ${CLASSES_LIEN}`}>
            {t("tableau_de_bord.lien_demandes")}
          </Link>
        </div>
        <Kpi
          ton="orange"
          libelle={t("tableau_de_bord.kpi_absences_jour")}
          valeur={techniciensIndisponibles(absencesDuJour)}
        />
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
              <Link
                href="/interventions"
                className={`text-[11.5px] ${CLASSES_LIEN}`}
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
  return (
    <article className="border-app-bord flex items-center gap-[13px] border-b px-[17px] py-[15px] last:border-b-0">
      <div className="bg-app-rouge-fond text-app-rouge-encre flex h-[39px] w-[39px] shrink-0 items-center justify-center rounded-[11px] text-[13px] font-black">
        {element.rang}
      </div>
      <div className="flex-1">
        <h3 className="text-[14px] font-bold">{element.titre}</h3>
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
