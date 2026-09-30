import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { OptionsAgence } from "@/components/agences/options";
import { LienPrimaire } from "@/components/ui/action-primaire";
import { Badge } from "@/components/ui/badge";
import { Kpi } from "@/components/ui/kpi";
import { Pagination } from "@/components/ui/pagination";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { agencesProposables } from "@/lib/agences/proposables";
import { annuaireDesPersonnes, type Annuaire } from "@/lib/auth/annuaire";
import { type ContexteSession } from "@/lib/auth/contexte";
import { obtenirSession } from "@/lib/auth/session";
import {
  dateCivile,
  instantDuJour,
  jourDe,
  maintenant,
  schemaFuseau,
  versLocal,
} from "@/lib/calendar/fuseau";
import { lundiDeLaSemaine } from "@/lib/calendar/semaine";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  compterInterventions,
  compterParVue,
  listerInterventions,
  type ComptesRegistre,
  type LignePlanning,
} from "@/lib/interventions/depot";
import { personnesANommer, quiTravaille } from "@/lib/interventions/personnes";
import {
  LIMITE_RECHERCHE_PAR_DEFAUT,
  schemaRechercheInterventions,
  STATUTS_INTERVENTION,
  TYPES_INTERVENTION,
} from "@/lib/interventions/saisie";
import { libellesDesMachines } from "@/lib/machines/depot";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { tonDePriorite } from "@/lib/theme/priorites";
import { CLASSES_STATUT, CLASSES_TON } from "@/lib/theme/statuts";

import { decompte, hrefDeLaPage, libellePage } from "../presentation";
import { LigneCliquable } from "./ligne-cliquable";
import {
  etatVideDuRegistre,
  hrefEffacerLesFiltres,
  hrefOnglet,
  libelleFiltreAgence,
  libelleOngletAvecCompte,
  machinesAffichees,
  motifCriteresInvalides,
  ONGLETS_REGISTRE,
  optionsFiltreTechnicien,
  optionToutesLesAgences,
  puceFiltresActifs,
  referenceAffichee,
  retourActuelDuRegistre,
} from "./presentation";

export const metadata: Metadata = { title: t("interventions.titre") };

/**
 * L'ÉCRAN « INTERVENTIONS » — le REGISTRE, canonique (N-01, 16/09/2026).
 *
 * ## CE QUE CE TICKET RÉPARE
 *
 * L'entrée « Interventions » de la barre de navigation était INERTE — elle
 * nommait `L2-08`, le ticket qui a livré la fiche et la création, jamais un
 * ticket de LISTE. Une intervention ne se rejoignait donc que depuis le
 * planning, qui n'en montre qu'un CALENDRIER : aucun endroit ne montrait le
 * registre complet, le sens même de l'entrée que la maquette réserve.
 *
 * ## UN OBJET, UN ÉCRAN CANONIQUE, UNE URL QUI LE NOMME
 *
 * `/interventions/{id}` remplace `/planning/{id}` par ce même ticket : une
 * intervention n'est pas davantage un sous-écran du planning que du parc ou
 * d'un client, et son URL cesse de nommer le premier écran par lequel on
 * l'atteignait — le programme des liens arrêtés le 16/09/2026.
 *
 * ## LA LISTE PAGINE, LA RECHERCHE ET LES FILTRES SONT REMPLIS (AT-07, 17/09/2026 ; étendue AT-07 bis, 18/09/2026)
 *
 * Comme `/clients` (L1-01) : une liste non bornée casse au volume sur un parc
 * de démonstration qui porte 226 machines et 615 clients. Le texte cherche sur
 * le client, le lieu et le `numero` de la référence affichée (`INT-00312`,
 * via `numeroDeReference`, `lib/interventions/depot.ts`) — jamais sur le
 * technicien (dont le nom vit dans l'annuaire, pas sur `intervention`). La
 * forme `Local-XXXXXX` de la référence reste un ÉCART NOMMÉ (voir la note de
 * tête de `numeroDeReference`) : `id` est `@db.Uuid`, et son filtre Prisma
 * ne sait pas comparer une sous-chaîne sans SQL brut, que le stack imposé
 * interdit hors migrations. Les quatre premiers filtres sont ceux que la
 * maquette annonce : agence, type, statut, période. Le CINQUIÈME, technicien
 * (57-REGISTRE-2), n'y figure pas — il répond à la question la plus courante
 * du bureau, « qu'a-t-il sur les bras ? », restée sans réponse sur ce
 * registre jusque-là ; « Non affectées » y porte les interventions sans
 * technicien, sur la même colonne que le libellé de repli de la colonne
 * « Technicien » (`quiTravaille`).
 *
 * ## LE CLIENT INACTIF SORT DE CETTE LISTE, ET LA CASE LE FAIT REVENIR (RG-PLA-08, D129)
 *
 * **Un CINQUIÈME contrôle, absent de la maquette et volontaire (même raison
 * que D128 pour un chiffre du tableau de bord)** : depuis l'arbitrage
 * d'exploitation du 19/09/2026, une intervention dont le CLIENT est inactif
 * ne s'affiche plus ici PAR DÉFAUT (`filtreClientActif`,
 * `lib/interventions/depot.ts`) — c'est la même règle que le planning, qui
 * l'applique sans aucune case pour la lever. *L'historique ne devient pas
 * inatteignable pour autant* : la case « Inclure les clients inactifs »
 * revient dessus depuis cet écran, et la fiche du CLIENT continue de tout
 * montrer, quel que soit son statut (`dernieresInterventionsDuClient`, qui ne
 * filtre jamais sur `actif`). Le SITE n'est pas concerné — la question reste
 * ouverte, RG-PLA-08 ne tranche que sur `client.actif`.
 *
 * ## LE CLOISONNEMENT N'EST PAS ÉCRIT ICI
 *
 * `listerInterventions` lit sous le contexte cloisonné, et la forme « parc »
 * décide. Une comparaison de société écrite au-dessus serait une seconde
 * lecture d'un même critère, et c'est celle qui vieillit sans rougir.
 */

/**
 * LE REPLI QUAND LA RECHERCHE EST INVALIDE — tous les onglets à zéro plutôt
 * qu'une lecture en base sur des critères que le schéma a déjà refusés
 * (52-REGISTRE-1, même repli que `lignes`/`totalFiltre` juste au-dessus).
 */
const COMPTES_VUE_VIDES: ComptesRegistre = {
  toutes: 0,
  a_planifier: 0,
  aujourdhui: 0,
  en_cours: 0,
  bloquees: 0,
  a_controler: 0,
  historique: 0,
  a_venir: 0,
  en_retard: 0,
};

/**
 * LA RECHERCHE VIDE (99V-GR6-TUILES) — le critère de l'onglet « Toutes »,
 * client actif compris. `kpiDuRegistre` l'utilise pour que ses deux KPI
 * « En cours » et « En attente » comptent exactement ce que l'onglet
 * correspondant montre quand rien n'y est filtré, jamais une seconde forme
 * du même critère (`filtreClientActif`, `lib/interventions/depot.ts`).
 */
const CRITERES_REGISTRE_VIDE = schemaRechercheInterventions.parse({});

/** Le lien sous une tuile du bandeau (99V-GR6-TUILES) — même forme que
 * `CLASSES_LIEN_TUILE` du tableau de bord (98-TABLEAU-2) : 13 px de texte,
 * une zone cliquable d'au moins 32 px de haut. */
const CLASSES_LIEN_TUILE = `inline-flex min-h-[32px] items-center text-[13px] ${CLASSES_LIEN}`;

export default async function PageInterventions({
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
  const contexte = session.contexte;
  const params = await searchParams;
  const motif = params.motif;

  const criteres = schemaRechercheInterventions.safeParse({
    texte: typeof params.q === "string" ? params.q : "",
    agence_id: typeof params.agence === "string" ? params.agence : "",
    type: typeof params.type === "string" ? params.type : "",
    statut: typeof params.statut === "string" ? params.statut : "",
    du: typeof params.du === "string" ? params.du : "",
    au: typeof params.au === "string" ? params.au : "",
    technicien: typeof params.technicien === "string" ? params.technicien : "",
    inclure_clients_inactifs:
      typeof params.inclure_clients_inactifs === "string"
        ? params.inclure_clients_inactifs
        : undefined,
    sans_duree_a_venir:
      typeof params.sans_duree_a_venir === "string"
        ? params.sans_duree_a_venir
        : undefined,
    vue: typeof params.vue === "string" ? params.vue : undefined,
    page: typeof params.page === "string" ? params.page : undefined,
  });

  // SIX LECTURES INDÉPENDANTES (lot PERF, mesuré sur 4fead41 ; étendu
  // 52-REGISTRE-1, puis 57-REGISTRE-2) — aucune ne dépend du résultat d'une
  // autre. `annuaire` et `libellesMachines`, eux, dépendent des LIGNES
  // rendues et restent dans un second `Promise.all`, après celui-ci.
  const [agences, techniciensActifs, lignes, totalFiltre, kpi, comptesVue] =
    await Promise.all([
      // LES AGENCES DU FILTRE (AGENCE-ACTIVE, AA-4) — proposables seulement :
      // une agence inactive ne se propose plus, SAUF si l'URL la demande déjà
      // (`garder`), auquel cas elle reste sélectionnée, marquée « (inactive) »,
      // et sa puce continue de s'afficher (`puceFiltresActifs`,
      // `interventions/presentation.ts`). Même précédent que `/sites/nouveau`
      // et `/sites/[id]` (`lib/agences/proposables.ts`) ; le filtre APPLIQUÉ
      // ne change pas — les interventions d'une agence inactive restent
      // visibles dans « Toutes les agences ».
      avecContexteApplicatif(contexte, (tx) =>
        agencesProposables(tx, {
          garder: criteres.success ? criteres.data.agence_id : null,
        }),
      ),
      // LES TECHNICIENS DU FILTRE (57-REGISTRE-2) — seuls les ACTIFS sont
      // proposés, même règle que `/interventions/nouvelle` et la fiche : un
      // technicien inactif n'entre pas dans une liste PROPOSÉE à une nouvelle
      // saisie, même si son historique reste consultable ailleurs.
      avecContexteApplicatif(contexte, (tx) =>
        tx.technicien.findMany({
          where: { actif: true },
          select: { utilisateur_id: true },
          orderBy: { utilisateur_id: "asc" },
        }),
      ),
      criteres.success
        ? listerInterventions(contexte, criteres.data)
        : Promise.resolve([]),
      // LE TOTAL DE LA PAGINATION — la MÊME `filtreDesInterventions` que la
      // liste, jamais une seconde lecture divergente du critère (AT-07).
      criteres.success
        ? compterInterventions(contexte, criteres.data)
        : Promise.resolve(0),
      kpiDuRegistre(contexte),
      // LE COMPTEUR DE CHAQUE ONGLET (52-REGISTRE-1) — les mêmes AUTRES
      // filtres que la liste ci-dessus, l'onglet actif exclu par
      // `compterParVue` lui-même.
      criteres.success
        ? compterParVue(contexte, criteres.data)
        : Promise.resolve(COMPTES_VUE_VIDES),
    ]);
  const totalPages = Math.max(
    1,
    Math.ceil(totalFiltre / LIMITE_RECHERCHE_PAR_DEFAUT),
  );
  // LES FILTRES ACTIFS, COMPOSÉS UNE SEULE FOIS (52-REGISTRE-1) — servent à
  // la fois la pagination et les onglets ci-dessous : deux lectures de ces
  // mêmes paramètres divergeraient en silence (§9, 01/09). `vue` PORTE LE
  // CRITÈRE ANALYSÉ, comme `inclure_clients_inactifs` juste en dessous —
  // jamais le paramètre brut, qu'une valeur inconnue aurait laissé passer
  // tel quel vers la page suivante.
  const parametresActifs = {
    q: typeof params.q === "string" ? params.q : undefined,
    agence: typeof params.agence === "string" ? params.agence : undefined,
    type: typeof params.type === "string" ? params.type : undefined,
    statut: typeof params.statut === "string" ? params.statut : undefined,
    du: typeof params.du === "string" ? params.du : undefined,
    au: typeof params.au === "string" ? params.au : undefined,
    technicien:
      typeof params.technicien === "string" ? params.technicien : undefined,
    inclure_clients_inactifs:
      criteres.success && criteres.data.inclure_clients_inactifs
        ? "on"
        : undefined,
    vue:
      criteres.success && criteres.data.vue !== null
        ? criteres.data.vue
        : undefined,
  };
  // L'UNION des identités que CETTE liste doit nommer est celle des LIGNES
  // rendues, et rien d'autre : à la différence de la vue jour du planning,
  // aucune colonne ne provient d'un référentiel vide à remplir.
  //
  // `annuaire` ET `libellesMachines` SONT INDÉPENDANTS L'UN DE L'AUTRE, mais
  // dépendent tous deux de `lignes` ci-dessus — d'où ce second `Promise.all`,
  // jamais fondu dans le premier.
  const [annuaire, libellesMachines] = await Promise.all([
    // L'ANNUAIRE PORTE AUSSI LES TECHNICIENS ACTIFS (57-REGISTRE-2), pour le
    // `<select>` du filtre — un technicien dont aucune intervention n'est
    // encore posée n'a sinon aucun nom à proposer (même raisonnement que
    // `personnesANommer` pour la vue jour du planning : la population à
    // nommer est celle des COLONNES, pas seulement celle des lignes).
    avecContexteApplicatif(contexte, (tx) =>
      annuaireDesPersonnes(
        tx,
        personnesANommer(
          lignes,
          techniciensActifs.map((technicien) => ({
            id: technicien.utilisateur_id,
          })),
        ),
      ),
    ),
    // LES LIBELLÉS DE MACHINE — lus une seconde fois, sur les identifiants
    // que les lignes rendues portent déjà (même principe que l'annuaire
    // ci-dessus, et que `libellesDesSites`). AT-07 bis : `machines` était
    // déjà lu par ligne et jamais montré.
    libellesDesMachines(
      contexte,
      lignes.flatMap((ligne) => ligne.machines.map((m) => m.machine_id)),
    ),
  ]);

  // LE RETOUR AU REGISTRE TEL QU'ON L'AVAIT LAISSÉ (78-LIENS-2) — porté par
  // chaque lien de ligne, rejoué par `retourVersRegistre` depuis la fiche.
  const retourRegistre = retourActuelDuRegistre(params);

  // LES PUCES DE FILTRES ACTIFS (88-REGISTRE-5) — une SUPERPOSITION de
  // `parametresActifs` : `sans_duree_a_venir` n'y figure pas (il ne survit
  // pas à un changement d'onglet ni de page, un comportement déjà là que ce
  // ticket ne touche pas), mais une puce qui le retire doit conserver les
  // AUTRES critères actifs — d'où cette seconde composition, réservée aux
  // puces et à « Tout effacer ».
  const parametresPuces = {
    ...parametresActifs,
    sans_duree_a_venir:
      criteres.success && criteres.data.sans_duree_a_venir ? "1" : undefined,
  };
  const puces = criteres.success
    ? puceFiltresActifs(criteres.data, parametresPuces, agences, annuaire)
    : [];
  // IN-12 (audit du 28/09) — un onglet choisi filtre tout autant qu'une puce,
  // même s'il n'en pose aucune (`puceFiltresActifs` ne connaît pas `vue`).
  const filtreActif =
    puces.length > 0 || (criteres.success && criteres.data.vue !== null);

  const colonnes = [
    {
      cle: "reference",
      libelle: t("intervention.reference"),
      largeur: "120px",
    },
    { cle: "client", libelle: t("intervention.client") },
    // MACHINE SUIT DIRECTEMENT CLIENT — l'ORDRE de la maquette (D125) ;
    // « Site », un ajout réel qu'elle ne dessine pas, la suit plutôt que de
    // s'intercaler (D128 : gardé, jamais supprimé, mais pas au prix de
    // l'ordre que D125 fixe). Gardé par tests/unit/ui/lot-a3.test.ts.
    { cle: "machine", libelle: t("intervention.machine") },
    { cle: "site", libelle: mot("site") },
    {
      cle: "technicien",
      libelle: t("intervention.technicien"),
      largeur: "200px",
    },
    { cle: "date", libelle: t("intervention.date"), largeur: "120px" },
    { cle: "priorite", libelle: t("intervention.priorite"), largeur: "110px" },
    { cle: "statut", libelle: t("intervention.statut"), largeur: "150px" },
  ];

  return (
    <Page
      chemin="/interventions"
      titre={t("interventions.titre")}
      sousTitre={t("interventions.sous_titre")}
      actions={
        <LienPrimaire href="/interventions/nouvelle">
          {t("planning.creer")}
        </LienPrimaire>
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

      {/* IN-07 (audit du 28/09) — une période inversée ou une recherche
          invalide vidait la page en silence : `criteres.error` n'était lu
          nulle part. */}
      {!criteres.success ? (
        <div
          role="status"
          className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3.5 py-2.5 text-13 font-bold ${CLASSES_TON.refus}`}
        >
          <span>{t(motifCriteresInvalides(criteres.error))}</span>
          <Link href="/interventions" className={CLASSES_LIEN}>
            {t("interventions.puce_tout_effacer")}
          </Link>
        </div>
      ) : null}

      {/*
        LE FILTRE POSÉ PAR LE LIEN DE LA TUILE (AFFICHAGE-MATERIEL-1) — un
        état qui ne vient d'aucune case du formulaire ci-dessous ne doit pas
        rester muet à l'écran, sinon la liste semble filtrée sans raison.
      */}
      {criteres.success && criteres.data.sans_duree_a_venir ? (
        <p
          role="status"
          className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3.5 py-2.5 text-13 font-bold"
        >
          {t("interventions.filtre_sans_duree_a_venir")}
        </p>
      ) : null}

      {/* La recherche et les quatre filtres sont un FORMULAIRE `GET` : l'état
          vit dans l'URL, jamais dans un état de composant (AT-07). */}
      <form
        method="get"
        className="bg-app-surface border-app-bord flex flex-wrap items-end gap-3 rounded-lg border px-4 py-3.5"
      >
        <label className="flex flex-col gap-1 text-[12px] font-bold">
          {t("interventions.recherche")}
          <input
            type="search"
            name="q"
            defaultValue={typeof params.q === "string" ? params.q : ""}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-bold">
          {libelleFiltreAgence()}
          <select
            name="agence"
            defaultValue={
              typeof params.agence === "string" ? params.agence : ""
            }
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
          >
            <option value="">{optionToutesLesAgences()}</option>
            <OptionsAgence agences={agences} />
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-bold">
          {t("intervention.type")}
          <select
            name="type"
            defaultValue={typeof params.type === "string" ? params.type : ""}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
          >
            <option value="">{t("interventions.filtre_type_tous")}</option>
            {TYPES_INTERVENTION.map((type) => (
              <option key={type} value={type}>
                {t(`type_intervention.${type}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-bold">
          {t("intervention.statut")}
          <select
            name="statut"
            defaultValue={
              typeof params.statut === "string" ? params.statut : ""
            }
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
          >
            <option value="">{t("interventions.filtre_statut_tous")}</option>
            {STATUTS_INTERVENTION.map((statut) => (
              <option key={statut} value={statut}>
                {t(`statut.${statut}`)}
              </option>
            ))}
          </select>
        </label>
        {/* LE FILTRE TECHNICIEN (57-REGISTRE-2) — « qu'a-t-il sur les
            bras ? », la question la plus courante du bureau, sans réponse
            avant ce ticket. `"aucun"` porte les interventions sans
            affectation, comme `filtreDesInterventions` le lit. */}
        <label className="flex flex-col gap-1 text-[12px] font-bold">
          {t("intervention.technicien")}
          <select
            name="technicien"
            defaultValue={
              typeof params.technicien === "string" ? params.technicien : ""
            }
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
          >
            <option value="">
              {t("interventions.filtre_technicien_tous")}
            </option>
            <option value="aucun">
              {t("interventions.filtre_technicien_non_affectees")}
            </option>
            {optionsFiltreTechnicien(techniciensActifs, annuaire).map(
              (option) => (
                <option key={option.valeur} value={option.valeur}>
                  {option.libelle}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-bold">
          {t("interventions.filtre_periode_du")}
          <input
            type="date"
            name="du"
            defaultValue={typeof params.du === "string" ? params.du : ""}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-bold">
          {t("interventions.filtre_periode_au")}
          <input
            type="date"
            name="au"
            defaultValue={typeof params.au === "string" ? params.au : ""}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
          />
        </label>
        {/* RG-PLA-08 (D129) : le seul moyen de revoir, depuis ce registre,
            les interventions dont le client est devenu inactif — sans quoi
            leur historique deviendrait inatteignable depuis cet écran.
            L'ÉTAT AFFICHÉ SUIT LE CRITÈRE ANALYSÉ, jamais le paramètre brut :
            `?inclure_clients_inactifs=autre-chose-que-on` retombe à `false`
            dans le schéma (seul `"on"` est reconnu, une case décochée ne
            soumettant rien) — la case doit se lire décochée dans ce cas,
            sous peine de contredire les lignes réellement affichées. */}
        <label className="flex items-center gap-1.5 pb-1.5 text-13 font-bold">
          <input
            type="checkbox"
            name="inclure_clients_inactifs"
            defaultChecked={
              criteres.success && criteres.data.inclure_clients_inactifs
            }
          />
          {t("interventions.filtre_inclure_clients_inactifs")}
        </label>
        <button
          type="submit"
          className="border-app-bord rounded-md border px-4 py-2 text-[13px] font-bold"
        >
          {t("interventions.rechercher")}
        </button>
      </form>

      {/* LES TROIS KPI DU BANDEAU — GAP COMBLÉ (audit du 18/09/2026) :
          interventions() de la maquette en pose trois, absents de cet écran.
          Voir `kpiDuRegistre` pour ce que chacun compte RÉELLEMENT — jamais
          les valeurs illustratives de la maquette.
          LE DÉTAIL « SUR TOUT LE REGISTRE » (88-REGISTRE-5, constat 18) —
          rendu SEULEMENT quand un filtre est actif : ces trois nombres ne
          bougent JAMAIS avec la recherche (voir `kpiDuRegistre`), et un
          exploitant qui vient de filtrer doit pouvoir le lire, pas le
          deviner.
          « EN COURS » ET « EN ATTENTE » MÈNENT MAINTENANT À L'ONGLET QU'ELLES
          COMPTENT (99V-GR6-TUILES, audit du 26/09/2026, constat G7) — un lien
          NU (`?vue=en_cours`, `?vue=bloquees`), jamais `hrefOnglet` : la
          portée de ces trois KPI reste FIXE, elle ne compose pas avec les
          AUTRES filtres actifs. « PLANIFIÉES CETTE SEMAINE » LES REJOINT
          (PG-C1c-EN-RETARD-REGISTRE, décision M1 du 27/09/2026) — un lien NU
          vers `?vue=a_venir`, la vue posée par ce même ticket : la tuile
          RESTE FIXE (semaine ISO courante, tout statut), c'est son lien qui
          mène vers la file « planifiée/affectée, à venir ». */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div data-bloc="kpi-semaine" className="flex flex-col gap-1.5">
          <Kpi
            libelle={t("interventions.kpi_semaine")}
            valeur={kpi.planifieesCetteSemaine}
            detail={
              puces.length > 0
                ? t("interventions.kpi_detail_filtre_actif")
                : undefined
            }
          />
          <Link
            href="/interventions?vue=a_venir"
            className={CLASSES_LIEN_TUILE}
          >
            {t("interventions.lien_kpi_semaine")}
          </Link>
        </div>
        <div data-bloc="kpi-en-cours" className="flex flex-col gap-1.5">
          <Kpi
            ton="vert"
            libelle={t("interventions.kpi_en_cours")}
            valeur={kpi.enCours}
            detail={
              puces.length > 0
                ? t("interventions.kpi_detail_filtre_actif")
                : undefined
            }
            href="/interventions?vue=en_cours"
          />
          <Link
            href="/interventions?vue=en_cours"
            className={CLASSES_LIEN_TUILE}
          >
            {t("interventions.lien_kpi_en_cours")}
          </Link>
        </div>
        <div data-bloc="kpi-en-attente" className="flex flex-col gap-1.5">
          <Kpi
            ton="orange"
            libelle={t("interventions.kpi_en_attente")}
            valeur={kpi.enAttente}
            detail={
              puces.length > 0
                ? t("interventions.kpi_detail_filtre_actif")
                : undefined
            }
            href="/interventions?vue=bloquees"
          />
          <Link
            href="/interventions?vue=bloquees"
            className={CLASSES_LIEN_TUILE}
          >
            {t("interventions.lien_kpi_en_attente")}
          </Link>
        </div>
      </div>

      {/* LES ONGLETS DU REGISTRE (52-REGISTRE-1) — « Toutes » puis les huit
          vues nommées ; chacun porte le compte EXACT de ce qu'il liste
          (`comptesVue`, la MÊME `filtreDesInterventions` que le tableau). */}
      <nav
        aria-label={t("interventions.vue.aria")}
        data-nav="onglets-registre"
        className="flex flex-wrap gap-2"
      >
        {ONGLETS_REGISTRE.map((vue) => {
          const actif = criteres.success && criteres.data.vue === vue;
          return (
            <Link
              key={vue ?? "toutes"}
              href={hrefOnglet(parametresActifs, vue)}
              aria-current={actif ? "page" : undefined}
              className={`rounded-full border px-3.5 py-1.5 text-13 font-bold ${
                actif
                  ? "border-app-bleu-bord bg-app-bleu-fond text-app-bleu-encre"
                  : "border-app-bord bg-app-surface"
              }`}
            >
              {libelleOngletAvecCompte(vue, comptesVue[vue ?? "toutes"])}
            </Link>
          );
        })}
      </nav>

      {/* LES PUCES DE FILTRES ACTIFS (88-REGISTRE-5, constat 17) — AUCUNE
          puce quand rien n'est filtré ; chacune retire SON SEUL critère,
          les autres survivent. */}
      {puces.length > 0 ? (
        <div
          aria-label={t("interventions.puce_bandeau_aria")}
          className="flex flex-wrap items-center gap-2"
        >
          {puces.map((puce) => (
            <span
              key={puce.cle}
              data-puce={puce.cle}
              className="border-app-bord bg-app-surface-creuse inline-flex items-center gap-1.5 rounded-full border py-1 pr-2 pl-3 text-[12px] font-bold"
            >
              {puce.libelle}
              <Link
                href={puce.href}
                aria-label={t("interventions.puce_retirer")}
                className="text-app-encre-faible hover:text-app-encre"
              >
                {t("interventions.puce_signe_retrait")}
              </Link>
            </span>
          ))}
          <Link
            href={hrefEffacerLesFiltres(parametresPuces)}
            className={CLASSES_LIEN}
          >
            {t("interventions.puce_tout_effacer")}
          </Link>
        </div>
      ) : null}

      <section className="bg-app-surface border-app-bord overflow-hidden rounded-lg border">
        <Tableau
          colonnes={colonnes}
          minimum="920px"
          libelle={t("interventions.titre")}
        >
          {lignes.length === 0 ? (
            <LignePleine colonnes={colonnes.length}>
              {t(
                etatVideDuRegistre({
                  criteresValides: criteres.success,
                  filtreActif,
                }),
              )}
            </LignePleine>
          ) : null}
          {lignes.map((ligne) => (
            <LigneIntervention
              key={ligne.id}
              ligne={ligne}
              annuaire={annuaire}
              libellesMachines={libellesMachines}
              retourRegistre={retourRegistre}
            />
          ))}
        </Tableau>
      </section>

      <Pagination
        page={criteres.success ? criteres.data.page : 1}
        totalPages={totalPages}
        libelleResultats={decompte(
          totalFiltre,
          t("interventions.resultat_un"),
          t("interventions.resultat"),
        )}
        libellePage={libellePage(
          criteres.success ? criteres.data.page : 1,
          totalPages,
        )}
        libellePrecedent={t("pagination.precedent")}
        libelleSuivant={t("pagination.suivant")}
        hrefPage={(page) =>
          hrefDeLaPage("/interventions", parametresActifs, page)
        }
      />
    </Page>
  );
}

/**
 * LES TROIS KPI DU BANDEAU — GAP COMBLÉ (audit du 18/09/2026) :
 * `interventions()` de la maquette en pose trois (« Planifiées cette
 * semaine », « En cours », « En attente ») et l'écran n'en portait aucun.
 *
 * **Chacun compte un FAIT RÉEL, jamais la valeur illustrative de la
 * maquette** (27, 2, 5) — la même règle que les KPI de `/parc` (R2-21).
 * **Sur TOUTE la société, jamais sur la recherche en cours** : la maquette
 * les dessine au-dessus du formulaire, comme un bandeau fixe — changer un
 * filtre ne doit pas faire bouger ces trois nombres, la même raison que le
 * détail du premier KPI de `/parc` (« sur N machines au total »).
 *
 * - « Planifiées cette semaine » : `date_planifiee` dans la semaine ISO
 *   courante (lundi 00:00 à lundi suivant 00:00 EXCLU), dans le fuseau de la
 *   société — quel que soit le statut, une lecture littérale du libellé qui
 *   n'ajoute aucune condition que le chapitre 10 ne pose pas.
 * - « En cours » : `statut = "en_cours"`, la valeur exacte de
 *   `STATUTS_INTERVENTION`.
 * - « En attente » : `statut = "suspendue"` — RG-INT-06, la file d'attente
 *   de pièce.
 *
 * **« EN COURS » ET « EN ATTENTE » COMPTENT DÉSORMAIS SOUS LE MÊME CRITÈRE
 * QUE LEUR ONGLET (99V-GR6-TUILES, audit du 26/09/2026, constat G7)** — un
 * client inactif sortait de l'onglet (`filtreClientActif`,
 * `lib/interventions/depot.ts`) mais restait compté ici : la tuile et
 * l'onglet qu'elle nomme désormais (voir le lien posé sous chacune) disaient
 * deux nombres différents. `compterParVue`, sur la RECHERCHE VIDE
 * (`CRITERES_REGISTRE_VIDE`), porte déjà ce critère — le réutiliser ici
 * évite une seconde lecture du même critère (gardien R3-12,
 * `tests/unit/gardiens/chemins-de-depot.test.ts`) plutôt que d'écrire
 * `client: { actif: true }` une deuxième fois.
 */
async function kpiDuRegistre(contexte: ContexteSession): Promise<{
  readonly planifieesCetteSemaine: number;
  readonly enCours: number;
  readonly enAttente: number;
}> {
  const societe = await avecContexteApplicatif(contexte, (tx) =>
    tx.societe.findFirst({
      where: { id: contexte.societeId as string },
      select: { fuseau_horaire: true },
    }),
  );
  const fuseau = schemaFuseau.parse(societe?.fuseau_horaire);
  const aujourdHui = jourDe(versLocal(maintenant(fuseau).instant, fuseau));
  const lundi = lundiDeLaSemaine(aujourdHui);
  const debutSemaine = instantDuJour(lundi);
  // BORNE EXCLUSIVE — même raison que `listerPlanning` (`lib/interventions/
  // depot.ts`) : `lt` et non `lte`, sans quoi le lundi suivant reviendrait
  // tout entier et la semaine compterait un jour de trop.
  const finSemaine = instantDuJour(lundi, 7);

  const [planifieesCetteSemaine, comptesVueVides] = await Promise.all([
    avecContexteApplicatif(contexte, (tx) =>
      tx.intervention.count({
        where: { date_planifiee: { gte: debutSemaine, lt: finSemaine } },
      }),
    ),
    compterParVue(contexte, CRITERES_REGISTRE_VIDE),
  ]);
  return {
    planifieesCetteSemaine,
    enCours: comptesVueVides.en_cours,
    enAttente: comptesVueVides.bloquees,
  };
}

function LigneIntervention({
  ligne,
  annuaire,
  libellesMachines,
  retourRegistre,
}: {
  readonly ligne: LignePlanning;
  readonly annuaire: Annuaire;
  readonly libellesMachines: ReadonlyMap<string, string>;
  readonly retourRegistre: string;
}) {
  const hrefFiche =
    retourRegistre.length === 0
      ? `/interventions/${ligne.id}?depuis=interventions`
      : `/interventions/${ligne.id}?depuis=interventions&retour=${encodeURIComponent(retourRegistre)}`;
  return (
    <LigneCliquable href={hrefFiche}>
      <Cellule mono fort>
        <Link href={hrefFiche} className={`${CLASSES_LIEN} whitespace-nowrap`}>
          {referenceAffichee(ligne)}
        </Link>
      </Cellule>
      <Cellule>{ligne.client.raison_sociale}</Cellule>
      <Cellule>{machinesAffichees(ligne, libellesMachines)}</Cellule>
      <Cellule>{ligne.site.libelle}</Cellule>
      <Cellule>{technicienAffiche(ligne, annuaire)}</Cellule>
      <Cellule>
        {ligne.date_planifiee === null
          ? t("planning.file_attente")
          : dateCivile(ligne.date_planifiee)}
      </Cellule>
      <Cellule>
        <Badge ton={tonDePriorite(ligne.priorite)}>
          {t(`priorite.${ligne.priorite}`)}
        </Badge>
      </Cellule>
      <Cellule>
        <span
          className={`rounded-full px-2 py-0.5 text-12 font-bold ${CLASSES_STATUT[ligne.statut]}`}
        >
          {t(`statut.${ligne.statut}`)}
        </span>
      </Cellule>
    </LigneCliquable>
  );
}

/**
 * LE TECHNICIEN AFFECTÉ — `quiTravaille` distingue déjà le refus légitime du
 * cloisonnement de l'oubli de l'écran (D88) ; seul le cas SANS AFFECTATION
 * change de libellé ici, parce que « Interventions non affectées » — le
 * pluriel d'une ligne de REGROUPEMENT du planning — n'a pas de sens répété
 * ligne à ligne dans un registre où chaque ligne est une seule intervention.
 */
function technicienAffiche(ligne: LignePlanning, annuaire: Annuaire): string {
  return ligne.technicien_id === null
    ? t("intervention.aucun_technicien")
    : quiTravaille(ligne.technicien_id, annuaire);
}
