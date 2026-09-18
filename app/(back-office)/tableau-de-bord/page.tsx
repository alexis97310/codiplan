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
import { schemaRechercheClient } from "@/lib/clients";
import {
  compterSansCodeExterne,
  libelleCodeExterneDeLaSociete,
} from "@/lib/clients/depot";
import { avecContexteApplicatif } from "@/lib/db/client";
import { demandesOuvertes } from "@/lib/demandes/depot";
import { t } from "@/lib/i18n/fr";
import {
  enAttenteDePiece,
  listerInterventions,
  listerPlanning,
} from "@/lib/interventions/depot";
import { schemaRechercheInterventions } from "@/lib/interventions/saisie";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { compterAPrevoir } from "@/lib/vgp/registre";

import { titreSansCode } from "../clients/presentation";
import { referenceAffichee } from "../interventions/presentation";

import {
  detailEnAttenteDePiece,
  detailInterventionsDuJour,
  elementsFiltres,
  filtrePrioriteLu,
  interventionsDuJour,
  prioritesAPlanifier,
  prioritesPieces,
  prioritesUrgentes,
  techniciensIndisponibles,
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
 * qu'elle dessine — et les TROIS KPI que ce dépôt savait déjà calculer sans
 * équivalent dans la maquette restent, dans une seconde grille, sous la
 * première : un AJOUT VOLONTAIRE, jamais un écart à combler.
 *
 * - **« Demandes en attente de qualification »** (`demandesOuvertes`) : ce
 *   que la file de qualification (lot 2, avant tout intervention) porte
 *   aujourd'hui. Depuis D128, la carte MÈNE quelque part — `/interventions/
 *   nouvelle`, l'écran réel où une demande devient une intervention planifiée
 *   ; aucune fiche par demande n'existe encore (pas de route `/demandes`), et
 *   la destination est donc l'écran qui la QUALIFIE, pas une fiche qui la
 *   MONTRE — la même distinction que `Carte.action` fait ailleurs (« mène »,
 *   jamais « crée »).
 * - **« Techniciens indisponibles aujourd'hui »** (`absencesDeLaPeriode` +
 *   `techniciensIndisponibles`) : combien de personnes sont couvertes par un
 *   blocage d'agenda aujourd'hui — une lecture DIFFÉRENTE de celle
 *   qu'`/absences` fait pour sa propre semaine (§9, 01/09 : même critère,
 *   deux moments, jamais recalculé à la place de l'original).
 * - **« Clients sans code externe »** (`compterSansCodeExterne`,
 *   `titreSansCode`) : combien de fiches client n'ont encore aucun code de
 *   rapprochement pour l'import Excel (RG-IMP-05) — la même lecture que
 *   `/clients` fait déjà pour SA propre carte, ici une SECONDE fois sous un
 *   contexte différent (le jour, pas une recherche), pas une divergence.
 *
 * ## LE SIXIÈME CHIFFRE N'EXISTE NULLE PART, ET IL NE S'INVENTE PAS (§8)
 *
 * R2-13 reste BLOQUÉ sur le taux d'occupation CONSOLIDÉ — `lib/interventions/
 * statistiques.ts` rend un taux PAR TECHNICIEN, déjà appelé par `/planning` ;
 * agréger plusieurs techniciens et plusieurs calendriers d'agence en UN SEUL
 * taux n'est écrit nulle part au chapitre 10. La carte l'affiche donc
 * `Non calculé`, avec son motif — jamais un zéro, jamais un tiret : les deux
 * se liraient comme une mesure (doctrine §3).
 *
 * ## « PRIORITÉS OPÉRATIONNELLES » — voir `./presentation.ts`
 *
 * Les quatre lignes de démonstration de `priorityItems()` n'ont pas de
 * contrepartie exacte ; ce que la carte affiche vient de trois lectures
 * réelles déjà écrites, composées par `prioritesUrgentes`, `prioritesPieces`
 * et `prioritesAPlanifier`.
 *
 * ## « ACTIVITÉ RÉCENTE » N'A AUCUNE SOURCE, ET C'EST NOMMÉ DANS LA CARTE
 *
 * `journal_audit` (I8) trace les écritures, pour l'audit — *« lue par
 * personne aujourd'hui »* est déjà l'état d'une table voisine du même
 * périmètre (`journal_acces`, `docs/arbitrages.md`). En composer un fil
 * lisible par un opérateur (« Compteur démarré par J. Lefèvre ») demanderait
 * une interprétation du journal qu'aucun ticket n'a encore écrite : la carte
 * reste dans la disposition, avec l'écart au lieu d'un fil inventé (D125,
 * « une donnée que le dépôt ne sait pas produire »).
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

  const criteresAPlanifier = schemaRechercheInterventions.parse({
    statut: "a_planifier",
  });
  const [
    lignesPlanning,
    enAttente,
    aPlanifier,
    vgpAPrevoir,
    demandes,
    absencesDuJour,
    sansCodeExterne,
  ] = await Promise.all([
    listerPlanning(contexte, debutDuJour, finDuJour),
    enAttenteDePiece(contexte, instant),
    listerInterventions(contexte, criteresAPlanifier),
    compterAPrevoir(contexte, instant, HORIZON_VGP_JOURS),
    demandesOuvertes(contexte),
    absencesDeLaPeriode(contexte, debutDuJour, debutDuJour),
    compterSansCodeExterne(contexte, schemaRechercheClient.parse({})),
  ]);
  const libelleSociete = await libelleCodeExterneDeLaSociete(contexte);

  const lignesDuJour = interventionsDuJour(
    lignesPlanning,
    debutDuJour,
    finDuJour,
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
        <div data-bloc="kpi-occupation">
          <Kpi
            ton="vert"
            libelle={t("tableau_de_bord.kpi_taux_occupation")}
            valeur={t("tableau_de_bord.taux_occupation_non_calcule")}
            detail={t("tableau_de_bord.taux_occupation_motif")}
          />
        </div>
        <div data-bloc="kpi-bloques">
          <Kpi
            ton="orange"
            libelle={t("tableau_de_bord.kpi_dossiers_bloques")}
            valeur={enAttente.length}
            detail={detailEnAttenteDePiece(enAttente)}
          />
        </div>
        <div data-bloc="kpi-vgp">
          <Kpi
            ton="rouge"
            libelle={t("tableau_de_bord.kpi_vgp_a_prevoir")}
            valeur={vgpAPrevoir}
            detail={t("tableau_de_bord.vgp_a_prevoir_detail")}
          />
        </div>
      </div>

      {/* LA SECONDE GRILLE — trois AJOUTS VOLONTAIRES, sans équivalent dans
          `dashboard()` (D128) : voir le docblock de tête, un paragraphe par
          KPI. `dashboard()` ne dessine rien ici ; ce bloc n'a donc pas de
          marqueur `data-bloc` attendu par le gardien de composition. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Kpi
            libelle={t("tableau_de_bord.kpi_demandes_ouvertes")}
            valeur={demandes.length}
          />
          <Link
            href="/interventions/nouvelle"
            className={`text-[11.5px] ${CLASSES_LIEN}`}
          >
            {t("tableau_de_bord.lien_demandes")}
          </Link>
        </div>
        <Kpi
          ton="orange"
          libelle={t("tableau_de_bord.kpi_absences_jour")}
          valeur={techniciensIndisponibles(absencesDuJour)}
        />
        <Kpi libelle={titreSansCode(libelleSociete)} valeur={sansCodeExterne} />
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
          <Carte titre={t("tableau_de_bord.activite_titre")}>
            <p className="text-app-encre-faible px-[16px] py-[15px] text-[12.5px]">
              {t("tableau_de_bord.activite_ecart")}
            </p>
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
