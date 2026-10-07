import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { OptionsAgence } from "@/components/agences/options";
import { LienPrimaire } from "@/components/ui/action-primaire";
import { BarreDeFiltres } from "@/components/ui/barre-de-filtres";
import {
  BarreSelection,
  CaseSelectionLigne,
  ProviderSelection,
} from "@/components/ui/barre-selection";
import { BasculeDensite } from "@/components/ui/bascule-densite";
import { Carte, ListeCartes } from "@/components/ui/liste-cartes";
import { LigneResume } from "@/components/ui/ligne-resume";
import { Pagination } from "@/components/ui/pagination";
import { Priorite } from "@/components/ui/priorite";
import { RefusAcces } from "@/components/ui/refus-acces";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { OngletsRegistre } from "@/components/interventions/onglets-registre";
import { TrouverCreneau } from "@/components/interventions/trouver-creneau";
import { agencesProposables } from "@/lib/agences/proposables";
import { annuaireDesPersonnes, type Annuaire } from "@/lib/auth/annuaire";
import { exigerContexteActif } from "@/lib/auth/contexte";
import { peut, peutPleinement } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import { fuseauDeLAgence } from "@/lib/calendar/agence";
import {
  cleJour,
  dateCivile,
  jourDe,
  maintenant,
  schemaFuseau,
  type Fuseau,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import {
  compterInterventions,
  compterParVue,
  listerInterventions,
  type ComptesRegistre,
  type LignePlanning,
} from "@/lib/interventions/depot";
import { dernieresIssuesSignature } from "@/lib/interventions/depot-rapport-terrain";
import {
  peutDeplacer,
  peutTransmettre,
} from "@/lib/interventions/cycle-de-vie";
import { ordreDuRegistre } from "@/lib/interventions/ordre-registre";
import { personnesANommer, quiTravaille } from "@/lib/interventions/personnes";
import {
  LIMITE_RECHERCHE_PAR_DEFAUT,
  PRIORITES,
  schemaRechercheInterventions,
  STATUTS_INTERVENTION,
  TYPES_INTERVENTION,
  type IssueSignature,
  type VueRegistre,
} from "@/lib/interventions/saisie";
import { libellesDesMachines } from "@/lib/machines/depot";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { CLASSES_STATUT, CLASSES_TON } from "@/lib/theme/statuts";
import { Button } from "@/components/ui/button";

import { decompte, hrefDeLaPage, libellePage } from "../presentation";
import { LigneCliquable } from "./ligne-cliquable";
import {
  ancienneteRegistreAffichee,
  colonnesDuRegistre,
  compteurRegistreAffiche,
  dateLocale,
  dateRegistreAffichee,
  descriptionTronquee,
  dureeRegistreAffichee,
  estDeplanifieeEnAttente,
  etatVideDuRegistre,
  heureDuCreneau,
  hrefDensite,
  hrefEffacerLesFiltres,
  hrefExportInterventions,
  hrefOnglet,
  libelleFiltreAgence,
  machinesAffichees,
  motifCriteresInvalides,
  motifSuspensionAffiche,
  objetDuBloc,
  optionsFiltreTechnicien,
  optionToutesLesAgences,
  pieceAttendueAffichee,
  puceFiltresActifs,
  referenceAffichee,
  retourActuelDuRegistre,
  selectionDisponibleSurLOnglet,
  SIGNE_ABSENCE,
  texteRapportColonne,
  vueEffectiveDuRegistre,
  type CleColonneRegistre,
  type PuceFiltre,
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
  a_planifier_p1: false,
};

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

  // LE REGISTRE EST FERMÉ AU TECHNICIEN (QT-2, D152) — un `○` sur
  // `consulter_planning` ouvre SA journée (`/planning`), jamais le registre
  // complet de la société. `peutPleinement` exige le `●`, le même niveau que
  // `lib/navigation/entrees.ts` exige désormais pour que « Interventions »
  // apparaisse au menu (menu et route restent cohérents).
  if (
    contexte.role === null ||
    !peutPleinement(contexte.role, "consulter_planning")
  ) {
    return (
      <Page
        chemin="/interventions"
        titre={t("interventions.titre")}
        sousTitre={t("interventions.sous_titre")}
      >
        <RefusAcces />
      </Page>
    );
  }
  // « POSER », « DÉPLACER… » ET « TRANSMETTRE… » (TP-UX3-1-REGISTRE-2, partie
  // B) — AU MÊME VERDICT que la fiche (`app/(back-office)/interventions/
  // [id]/page.tsx`) : `modifier_planning`, COMPLET (`peutPleinement`), celle
  // que `.../deplacer` et `.../transmettre` exigent déjà côté serveur. Cette
  // page ne lisait jusqu'ici que `consulter_planning` (ci-dessus), une
  // lecture, jamais une écriture. Un rôle sans ce niveau voit le registre,
  // sans aucun des trois boutons — le bloc entier est ABSENT, jamais montré
  // refusé (même régime que D153 sur la fiche).
  const peutModifierLePlanning = peutPleinement(
    contexte.role,
    "modifier_planning",
  );

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
    // LA PRIORITÉ ET LE SUIVI (TP-UX3-1-REGISTRE-1, QE-8) — deux `<select>`
    // de plus, même forme que `type`/`statut` ci-dessus.
    priorite: typeof params.priorite === "string" ? params.priorite : "",
    suivi: typeof params.suivi === "string" ? params.suivi : undefined,
    // LES BORNES DE CRÉATION ET DE CLÔTURE (9DT-TP-MOD2-INDICATEURS-DONNEES,
    // QT-20) — posées par les liens de « Indicateurs du mois », jamais par un
    // champ de ce formulaire.
    cree_du: typeof params.cree_du === "string" ? params.cree_du : "",
    cree_au: typeof params.cree_au === "string" ? params.cree_au : "",
    cloturee_du:
      typeof params.cloturee_du === "string" ? params.cloturee_du : "",
    cloturee_au:
      typeof params.cloturee_au === "string" ? params.cloturee_au : "",
    vue: typeof params.vue === "string" ? params.vue : undefined,
    page: typeof params.page === "string" ? params.page : undefined,
  });

  // L'ONGLET VRAIMENT OUVERT (décision 13 d'Alexis du 05/10/2026) — voir
  // `vueEffectiveDuRegistre` : l'adresse nue, ou une `vue` inconnue, ouvre
  // « À planifier » ; `?vue=toutes` ouvre « Toutes ». `criteres.data.vue`
  // seul ne peut pas les distinguer (les deux y retombent à `null`).
  const vueEffective = criteres.success
    ? vueEffectiveDuRegistre(params.vue, criteres.data.vue)
    : "a_planifier";
  const vuePourDepot: VueRegistre | null =
    vueEffective === "toutes" ? null : vueEffective;
  // LA RECHERCHE TELLE QUE LE DÉPÔT DOIT LA LIRE — `vue` remplacé par
  // l'onglet EFFECTIF ci-dessus, jamais le champ brut du schéma : filtrage,
  // ordre et borne du jour civil doivent tous les trois lire la MÊME valeur
  // (§9, 01/09).
  const criteresPourDepot = criteres.success
    ? { ...criteres.data, vue: vuePourDepot }
    : null;
  const ordre = ordreDuRegistre(vuePourDepot);
  const estCompact = params.densite === "compact";

  // DES LECTURES INDÉPENDANTES (lot PERF, mesuré sur 4fead41 ; étendu
  // 52-REGISTRE-1, 57-REGISTRE-2, puis TP-UX3-1-REGISTRE-2) — aucune ne
  // dépend du résultat d'une autre. `annuaire` et `libellesMachines`, eux,
  // dépendent des LIGNES rendues et restent dans un second `Promise.all`,
  // après celui-ci.
  const [agences, techniciensActifs, lignes, totalFiltre, comptesVue, societe] =
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
      criteresPourDepot !== null
        ? listerInterventions(contexte, criteresPourDepot)
        : Promise.resolve([]),
      // LE TOTAL DE LA PAGINATION — la MÊME `filtreDesInterventions` que la
      // liste, jamais une seconde lecture divergente du critère (AT-07).
      criteresPourDepot !== null
        ? compterInterventions(contexte, criteresPourDepot)
        : Promise.resolve(0),
      // LE COMPTEUR DE CHAQUE ONGLET (52-REGISTRE-1) — les mêmes AUTRES
      // filtres que la liste ci-dessus, l'onglet actif exclu par
      // `compterParVue` lui-même : le paramètre `vue` qu'elle reçoit lui est
      // indifférent (elle le remplace toujours), `criteres.data` suffit.
      criteres.success
        ? compterParVue(contexte, criteres.data)
        : Promise.resolve(COMPTES_VUE_VIDES),
      // LE FUSEAU DE LA SOCIÉTÉ (TP-UX3-1-REGISTRE-2) — la colonne
      // « Ancienneté » (onglet « À planifier ») compare `cree_le` au jour
      // civil COURANT « de la société » (constat du ticket), jamais à celui
      // d'une agence : la même échelle que `debutDuJourSociete` applique déjà
      // aux onglets « Aujourd'hui »/« À venir »/« En retard ».
      avecContexteApplicatif(contexte, (tx) =>
        tx.societe.findFirst({
          where: { id: exigerContexteActif(contexte).societeId },
          select: { fuseau_horaire: true },
        }),
      ),
    ]);
  const fuseauSociete: Fuseau = schemaFuseau.parse(societe?.fuseau_horaire);
  const aujourdhuiLocal = jourDe(maintenant(fuseauSociete).local);
  const totalPages = Math.max(
    1,
    Math.ceil(totalFiltre / LIMITE_RECHERCHE_PAR_DEFAUT),
  );
  // LES FILTRES ACTIFS, COMPOSÉS UNE SEULE FOIS (52-REGISTRE-1) — servent à
  // la fois la pagination et les onglets ci-dessous : deux lectures de ces
  // mêmes paramètres divergeraient en silence (§9, 01/09). `vue` PORTE
  // L'ONGLET EFFECTIF (décision 13 d'Alexis du 05/10/2026), jamais le champ
  // brut : « Toutes » s'écrit `"toutes"` en toutes lettres, l'onglet par
  // défaut `"a_planifier"`, TOUJOURS présent — plus jamais absent, pour
  // qu'aucun lien composé depuis cette page ne retombe en silence sur le
  // défaut au lieu de l'onglet réellement ouvert.
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
    priorite: typeof params.priorite === "string" ? params.priorite : undefined,
    suivi: typeof params.suivi === "string" ? params.suivi : undefined,
    cree_du: typeof params.cree_du === "string" ? params.cree_du : undefined,
    cree_au: typeof params.cree_au === "string" ? params.cree_au : undefined,
    cloturee_du:
      typeof params.cloturee_du === "string" ? params.cloturee_du : undefined,
    cloturee_au:
      typeof params.cloturee_au === "string" ? params.cloturee_au : undefined,
    vue: vueEffective,
    densite: estCompact ? "compact" : undefined,
  };
  // L'UNION des identités que CETTE liste doit nommer est celle des LIGNES
  // rendues, et rien d'autre : à la différence de la vue jour du planning,
  // aucune colonne ne provient d'un référentiel vide à remplir.
  //
  // `annuaire` ET `libellesMachines` SONT INDÉPENDANTS L'UN DE L'AUTRE, mais
  // dépendent tous deux de `lignes` ci-dessus — d'où ce second `Promise.all`,
  // jamais fondu dans le premier.
  const [annuaire, libellesMachines, issuesSignature, agencesFuseau] =
    await Promise.all([
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
      // L'ISSUE DE SIGNATURE (9DE-TP-CY1) — seules les TERMINÉES en portent une
      // à montrer (l'onglet « À contrôler ») ; les autres lignes n'ont rien à
      // demander, `dernieresIssuesSignature` rend alors une carte vide sans
      // requête.
      dernieresIssuesSignature(
        contexte,
        lignes
          .filter((ligne) => ligne.statut === "terminee")
          .map((ligne) => ligne.id),
      ),
      // LE FUSEAU DE CHAQUE AGENCE PRÉSENTE (TP-UX3-1-REGISTRE-2) — lu une fois
      // par agence, sur les IDENTIFIANTS que les lignes rendues portent déjà
      // (même principe que l'annuaire et les libellés de machine ci-dessus) :
      // les colonnes « Heure »/« Début » (`heureDuCreneau`) et le créneau
      // initial de « Poser »/« Déplacer… » (`TrouverCreneau`) lisent le fuseau
      // de l'AGENCE DE L'INTERVENTION, jamais celui de la société (I7).
      avecContexteApplicatif(contexte, (tx) =>
        tx.agence.findMany({
          where: { id: { in: [...new Set(lignes.map((l) => l.agence_id))] } },
          select: {
            id: true,
            fuseau_horaire: true,
            societe: { select: { fuseau_horaire: true } },
          },
        }),
      ),
    ]);
  const fuseauParAgence = new Map(
    agencesFuseau.map((agence) => [agence.id, fuseauDeLAgence(agence)]),
  );
  // LES TECHNICIENS DU RACCOURCI « POSER »/« DÉPLACER… » (TP-UX3-1-REGISTRE-2)
  // — les mêmes techniciens ACTIFS, nommés par le même `optionsFiltreTechnicien`
  // que le `<select>` du filtre (jamais une seconde lecture du nom, §9,
  // 01/09). Sans l'annotation « absent le JJ » que `optionsDAffectation`
  // ajoute sur la fiche (elle a besoin d'une date par ligne, hors de portée
  // ici sans une lecture par ligne) : un repli assumé, dit en passation —
  // le refus d'une affectation réellement bloquée reste porté par le dépôt
  // et le déclencheur, jamais par ce seul affichage.
  const techniciensPourCreneau = optionsFiltreTechnicien(
    techniciensActifs,
    annuaire,
  ).map((option) => ({ id: option.valeur, nom: option.libelle }));

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
  // LA PUCE DE « À VENIR »/« HISTORIQUE » (TP-UX3-1-REGISTRE-1) — ces deux
  // vues quittent la rangée d'onglets (`OngletsRegistre`), mais restent des
  // adresses valides ; actives, elles se montrent ainsi, avec leur croix
  // vers « Toutes ». `puceFiltresActifs` ne les connaît pas (elle ignore
  // `vue` par construction, voir IN-12 plus bas) : composée ICI plutôt que
  // d'étendre cette fonction pour un cas qui n'est pas un FILTRE du
  // formulaire.
  const puceVue: PuceFiltre | null =
    vueEffective === "a_venir" || vueEffective === "historique"
      ? {
          cle: "vue",
          libelle: `${t("interventions.puce_vue_prefixe")}${t("ponctuation.deux_points")}${t(`interventions.vue.${vueEffective}`)}`,
          href: hrefOnglet(parametresActifs, null),
        }
      : null;
  const toutesLesPuces = puceVue === null ? puces : [puceVue, ...puces];
  // IN-12 (audit du 28/09) — un onglet choisi filtre tout autant qu'une puce,
  // même s'il n'en pose aucune (`puceFiltresActifs` ne connaît pas `vue`).
  // Depuis la décision 13 (05/10/2026), « À planifier » est l'onglet PAR
  // DÉFAUT — lui aussi filtre, et seule « Toutes » ne filtre rien.
  const filtreActif = puces.length > 0 || vueEffective !== "toutes";
  // « PLUS DE FILTRES » S'OUVRE D'OFFICE DÈS QU'UN DE SES CHAMPS EST ACTIF
  // (TP-UX3-1-REGISTRE-1) — sans quoi un filtre réellement posé resterait
  // caché derrière un repli fermé.
  const plusDeFiltresActif =
    criteres.success &&
    (criteres.data.agence_id !== null ||
      criteres.data.du !== null ||
      criteres.data.au !== null ||
      criteres.data.inclure_clients_inactifs ||
      criteres.data.cree_du !== null ||
      criteres.data.cree_au !== null ||
      criteres.data.cloturee_du !== null ||
      criteres.data.cloturee_au !== null);

  // LES COLONNES DE CET ONGLET (TP-UX3-1-REGISTRE-2, QE-8 (a)) — un jeu PAR
  // ONGLET, jamais les mêmes huit colonnes partout : voir `colonnesDuRegistre`
  // (`./presentation.ts`), qui seule en décide. La case de sélection
  // (`selectionDisponibleSurLOnglet`) s'ajoute EN TÊTE, sur trois onglets
  // seulement.
  const selectionDisponible = selectionDisponibleSurLOnglet(vueEffective);
  const colonnesOnglet = colonnesDuRegistre(vueEffective);
  const colonnes = selectionDisponible
    ? [
        { cle: "selection" as const, libelle: "", largeur: "36px" },
        ...colonnesOnglet,
      ]
    : colonnesOnglet;

  return (
    <Page
      chemin="/interventions"
      titre={t("interventions.titre")}
      sousTitre={t("interventions.sous_titre")}
      actions={
        <>
          {peut(contexte.role, "importer_exporter") ? (
            <a
              href={hrefExportInterventions(parametresPuces)}
              className={CLASSES_LIEN}
            >
              {t("export.bouton")}
            </a>
          ) : null}
          <LienPrimaire href="/interventions/nouvelle">
            {t("planning.creer")}
          </LienPrimaire>
        </>
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
      {criteres.success &&
      (criteres.data.sans_duree_a_venir ||
        criteres.data.suivi === "sans_duree_a_venir") ? (
        <p
          role="status"
          className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3.5 py-2.5 text-13 font-bold"
        >
          {t("interventions.filtre_sans_duree_a_venir")}
        </p>
      ) : null}

      {/* LES ONGLETS DU REGISTRE (TP-UX3-1-REGISTRE-1, QE-8) — huit onglets
          à compteur, puis « Toutes » ; « À facturer » visible seulement aux
          rôles qui préparent la facturation. */}
      <OngletsRegistre
        vueActive={vueEffective}
        comptes={comptesVue}
        peutFacturer={peut(contexte.role, "preparer_facturation")}
        hrefOnglet={(vue) => hrefOnglet(parametresActifs, vue)}
        hrefAFacturer="/interventions/a-facturer"
      />

      {/* LA BARRE DE FILTRES COMPACTE (TP-UX3-1-REGISTRE-1, QE-10 : les
          listes déroulantes de D122, jamais des puces de filtre) — un
          FORMULAIRE `GET` unique, l'état vivant dans l'URL (AT-07). */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <BarreDeFiltres
          action="/interventions"
          parametre="q"
          valeur={typeof params.q === "string" ? params.q : undefined}
          libelleChamp={t("interventions.recherche")}
          libelleBouton={t("interventions.rechercher")}
          enfants={
            <>
              {/* L'ONGLET ET LA DENSITÉ NE SONT PAS DES CHAMPS DU
                  FORMULAIRE — une recherche composée par-dessus un onglet ou
                  une densité ne doit ni l'un ni l'autre perdre. */}
              <input type="hidden" name="vue" value={parametresActifs.vue} />
              {estCompact ? (
                <input type="hidden" name="densite" value="compact" />
              ) : null}
              {/* LE FILTRE TECHNICIEN (57-REGISTRE-2) — « qu'a-t-il sur les
                  bras ? », la question la plus courante du bureau. */}
              <label className="flex flex-col gap-1 text-[12px] font-bold">
                {t("intervention.technicien")}
                <select
                  name="technicien"
                  defaultValue={
                    typeof params.technicien === "string"
                      ? params.technicien
                      : ""
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
              {/* LA PRIORITÉ (TP-UX3-1-REGISTRE-1). */}
              <label className="flex flex-col gap-1 text-[12px] font-bold">
                {t("interventions.filtre_priorite_label")}
                <select
                  name="priorite"
                  defaultValue={
                    typeof params.priorite === "string" ? params.priorite : ""
                  }
                  className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
                >
                  <option value="">
                    {t("interventions.filtre_priorite_toutes")}
                  </option>
                  {PRIORITES.map((priorite) => (
                    <option key={priorite} value={priorite}>
                      {t(`priorite.${priorite}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-bold">
                {t("intervention.type")}
                <select
                  name="type"
                  defaultValue={
                    typeof params.type === "string" ? params.type : ""
                  }
                  className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
                >
                  <option value="">
                    {t("interventions.filtre_type_tous")}
                  </option>
                  {TYPES_INTERVENTION.map((type) => (
                    <option key={type} value={type}>
                      {t(`type_intervention.${type}`)}
                    </option>
                  ))}
                </select>
              </label>
              {/* LE STATUT — SEULEMENT SOUS L'ONGLET « TOUTES » : ailleurs,
                  l'onglet lui-même porte déjà un statut (ou un groupe de
                  statuts), et ce `<select>` ferait doublon avec lui. */}
              {vueEffective === "toutes" ? (
                <label className="flex flex-col gap-1 text-[12px] font-bold">
                  {t("intervention.statut")}
                  <select
                    name="statut"
                    defaultValue={
                      typeof params.statut === "string" ? params.statut : ""
                    }
                    className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
                  >
                    <option value="">
                      {t("interventions.filtre_statut_tous")}
                    </option>
                    {STATUTS_INTERVENTION.map((statut) => (
                      <option key={statut} value={statut}>
                        {t(`statut.${statut}`)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {/* LE SUIVI (TP-UX3-1-REGISTRE-1) — « Sans durée prévue » pose
                  le MÊME critère que l'ancien lien `sans_duree_a_venir=1`,
                  gardé valide (`filtreDesInterventions`). */}
              <label className="flex flex-col gap-1 text-[12px] font-bold">
                {t("interventions.filtre_suivi_label")}
                <select
                  name="suivi"
                  defaultValue={
                    criteres.success &&
                    (criteres.data.suivi === "sans_duree_a_venir" ||
                      criteres.data.sans_duree_a_venir)
                      ? "sans_duree_a_venir"
                      : ""
                  }
                  className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
                >
                  <option value="">
                    {t("interventions.filtre_suivi_aucun")}
                  </option>
                  <option value="sans_duree_a_venir">
                    {t("interventions.filtre_suivi_sans_duree_a_venir")}
                  </option>
                </select>
              </label>

              {/* « PLUS DE FILTRES » (TP-UX3-1-REGISTRE-1) — Agence,
                  Depuis/Jusqu'au, « Inclure les clients inactifs » et les
                  bornes de création/clôture (9DT) : RIEN n'est retiré, ils
                  changent seulement de place. Ouvert d'office dès que l'un
                  d'eux est actif. */}
              <details
                open={plusDeFiltresActif}
                className="border-app-bord bg-app-surface-creuse w-full rounded-md border px-3 py-2"
              >
                <summary className="cursor-pointer text-[12px] font-bold">
                  {t("interventions.plus_de_filtres")}
                </summary>
                <div className="flex flex-wrap items-end gap-3 pt-2.5">
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
                    {t("interventions.filtre_periode_du")}
                    <input
                      type="date"
                      name="du"
                      defaultValue={
                        typeof params.du === "string" ? params.du : ""
                      }
                      className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[12px] font-bold">
                    {t("interventions.filtre_periode_au")}
                    <input
                      type="date"
                      name="au"
                      defaultValue={
                        typeof params.au === "string" ? params.au : ""
                      }
                      className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[12px] font-bold">
                    {t("interventions.filtre_cree_du")}
                    <input
                      type="date"
                      name="cree_du"
                      defaultValue={
                        typeof params.cree_du === "string" ? params.cree_du : ""
                      }
                      className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[12px] font-bold">
                    {t("interventions.filtre_cree_au")}
                    <input
                      type="date"
                      name="cree_au"
                      defaultValue={
                        typeof params.cree_au === "string" ? params.cree_au : ""
                      }
                      className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[12px] font-bold">
                    {t("interventions.filtre_cloturee_du")}
                    <input
                      type="date"
                      name="cloturee_du"
                      defaultValue={
                        typeof params.cloturee_du === "string"
                          ? params.cloturee_du
                          : ""
                      }
                      className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[12px] font-bold">
                    {t("interventions.filtre_cloturee_au")}
                    <input
                      type="date"
                      name="cloturee_au"
                      defaultValue={
                        typeof params.cloturee_au === "string"
                          ? params.cloturee_au
                          : ""
                      }
                      className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
                    />
                  </label>
                  {/* RG-PLA-08 (D129) : le seul moyen de revoir, depuis ce
                      registre, les interventions dont le client est devenu
                      inactif — sans quoi leur historique deviendrait
                      inatteignable depuis cet écran. */}
                  <label className="flex items-center gap-1.5 pb-1.5 text-13 font-bold">
                    <input
                      type="checkbox"
                      name="inclure_clients_inactifs"
                      defaultChecked={
                        criteres.success &&
                        criteres.data.inclure_clients_inactifs
                      }
                    />
                    {t("interventions.filtre_inclure_clients_inactifs")}
                  </label>
                </div>
              </details>
            </>
          }
        />
        <BasculeDensite
          hrefConfort={hrefDensite(
            parametresActifs,
            criteres.success ? criteres.data.page : 1,
            "confort",
          )}
          hrefCompact={hrefDensite(
            parametresActifs,
            criteres.success ? criteres.data.page : 1,
            "compact",
          )}
          actif={estCompact ? "compact" : "confort"}
        />
      </div>

      <LigneResume
        nombre={totalFiltre}
        libelleUn={t("interventions.resultat_un")}
        libellePluriel={t("interventions.resultat")}
        texteTri={t(ordre.cleTri)}
        hrefEffacer={
          filtreActif ? hrefEffacerLesFiltres(parametresPuces) : undefined
        }
      />

      {/* LES PUCES DE FILTRES ACTIFS (88-REGISTRE-5, constat 17) — AUCUNE
          puce quand rien n'est filtré ; chacune retire SON SEUL critère,
          les autres survivent. */}
      {toutesLesPuces.length > 0 ? (
        <div
          aria-label={t("interventions.puce_bandeau_aria")}
          className="flex flex-wrap items-center gap-2"
        >
          {toutesLesPuces.map((puce) => (
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

      {(() => {
        // LA TABLE DU BUREAU (≥ 901 px), ET LES CARTES DU TÉLÉPHONE
        // (TP-UX3-1-REGISTRE-2, PR-10) — l'une masque l'autre par la
        // largeur, jamais par une détection d'appareil. La sélection
        // (`ProviderSelection`/`BarreSelection`) n'enrobe QUE la table : le
        // choix du pilote C5 (07/10/2026) réserve la sélection au bureau,
        // les cartes n'en portent ni case ni action.
        const table = (
          <section className="bg-app-surface border-app-bord max-[900px]:hidden overflow-hidden rounded-lg border">
            <Tableau
              colonnes={colonnes}
              minimum="920px"
              libelle={t("interventions.titre")}
              compact={estCompact}
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
                  issueSignature={issuesSignature.get(ligne.id) ?? null}
                  compact={estCompact}
                  colonnesOnglet={colonnesOnglet}
                  vueEffective={vueEffective}
                  fuseauParAgence={fuseauParAgence}
                  fuseauSociete={fuseauSociete}
                  aujourdhuiLocal={aujourdhuiLocal}
                  techniciensPourCreneau={techniciensPourCreneau}
                  peutModifierLePlanning={peutModifierLePlanning}
                  selectionDisponible={selectionDisponible}
                />
              ))}
            </Tableau>
          </section>
        );
        return selectionDisponible ? (
          <ProviderSelection
            lignes={lignes.map((ligne) => ({
              id: ligne.id,
              statut: ligne.statut,
            }))}
          >
            <BarreSelection
              className="max-[900px]:hidden"
              libelleUn={t("interventions.selection.un")}
              libellePluriel={t("interventions.selection.plusieurs")}
              libelleVider={t("interventions.selection.vider")}
              libelleExporter={t("export.bouton")}
              actionExporter="/api/interventions/exporter"
              filtresExport={parametresPuces}
              actionTransmettre={
                vueEffective === "aujourdhui"
                  ? "/api/interventions/transmettre"
                  : undefined
              }
              libelleTransmettre={t("interventions.colonne.transmettre_courte")}
              libelleUnePlanifiee={t("interventions.selection.une_planifiee")}
              libellePlusieursPlanifiees={t(
                "interventions.selection.plusieurs_planifiees",
              )}
            />
            {table}
          </ProviderSelection>
        ) : (
          table
        );
      })()}

      <ListeCartes libelle={t("interventions.titre")}>
        {lignes.map((ligne) => (
          <CarteIntervention
            key={ligne.id}
            ligne={ligne}
            annuaire={annuaire}
            libellesMachines={libellesMachines}
            retourRegistre={retourRegistre}
          />
        ))}
      </ListeCartes>

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

/** Le créneau initial de « Poser »/« Déplacer… » (TP-UX3-1-REGISTRE-2) — même calcul que la fiche (`jourInitialCreneau`, `[id]/page.tsx`), jamais une seconde lecture (§9, 01/09). */
function jourInitialCreneauDeLaLigne(
  ligne: LignePlanning,
  fuseau: Fuseau,
): string {
  return ligne.date_planifiee !== null
    ? ligne.date_planifiee.toISOString().slice(0, 10)
    : cleJour(jourDe(maintenant(fuseau).local));
}

function LigneIntervention({
  ligne,
  annuaire,
  libellesMachines,
  retourRegistre,
  issueSignature,
  compact,
  colonnesOnglet,
  vueEffective,
  fuseauParAgence,
  fuseauSociete,
  aujourdhuiLocal,
  techniciensPourCreneau,
  peutModifierLePlanning,
  selectionDisponible,
}: {
  readonly ligne: LignePlanning;
  readonly annuaire: Annuaire;
  readonly libellesMachines: ReadonlyMap<string, string>;
  readonly retourRegistre: string;
  /** `null` hors onglet « À contrôler », ou pour une ligne sans signature (9DE-TP-CY1). */
  readonly issueSignature: { readonly issue: IssueSignature } | null;
  /** LA DENSITÉ « COMPACT » (TP-UX3-1-REGISTRE-1) — répercutée sur chaque cellule. */
  readonly compact: boolean;
  readonly colonnesOnglet: readonly { readonly cle: CleColonneRegistre }[];
  readonly vueEffective: VueRegistre | "toutes";
  readonly fuseauParAgence: ReadonlyMap<string, Fuseau>;
  readonly fuseauSociete: Fuseau;
  readonly aujourdhuiLocal: JourLocal;
  readonly techniciensPourCreneau: readonly {
    readonly id: string;
    readonly nom: string;
  }[];
  readonly peutModifierLePlanning: boolean;
  readonly selectionDisponible: boolean;
}) {
  const hrefFiche =
    retourRegistre.length === 0
      ? `/interventions/${ligne.id}?depuis=interventions`
      : `/interventions/${ligne.id}?depuis=interventions&retour=${encodeURIComponent(retourRegistre)}`;
  const fuseauAgence = fuseauParAgence.get(ligne.agence_id) ?? fuseauSociete;
  return (
    <LigneCliquable href={hrefFiche}>
      {selectionDisponible ? (
        <Cellule compact={compact}>
          <CaseSelectionLigne
            id={ligne.id}
            ariaLabel={`${t("interventions.selection.case_aria_prefixe")} ${referenceAffichee(ligne)}`}
          />
        </Cellule>
      ) : null}
      {colonnesOnglet.map((colonne) => (
        <CelluleDeColonne
          key={colonne.cle}
          cle={colonne.cle}
          ligne={ligne}
          annuaire={annuaire}
          libellesMachines={libellesMachines}
          issueSignature={issueSignature}
          compact={compact}
          hrefFiche={hrefFiche}
          vueEffective={vueEffective}
          fuseauAgence={fuseauAgence}
          fuseauSociete={fuseauSociete}
          aujourdhuiLocal={aujourdhuiLocal}
          techniciensPourCreneau={techniciensPourCreneau}
          peutModifierLePlanning={peutModifierLePlanning}
        />
      ))}
    </LigneCliquable>
  );
}

/**
 * LA CELLULE D'UNE COLONNE (TP-UX3-1-REGISTRE-2) — une seule fonction qui
 * sait rendre chaque `CleColonneRegistre`, jamais huit fonctions dispersées :
 * `colonnesDuRegistre` (`./presentation.ts`) décide QUELLES colonnes, celle-
 * ci décide COMMENT chacune se rend.
 */
function CelluleDeColonne({
  cle,
  ligne,
  annuaire,
  libellesMachines,
  issueSignature,
  compact,
  hrefFiche,
  vueEffective,
  fuseauAgence,
  fuseauSociete,
  aujourdhuiLocal,
  techniciensPourCreneau,
  peutModifierLePlanning,
}: {
  readonly cle: CleColonneRegistre;
  readonly ligne: LignePlanning;
  readonly annuaire: Annuaire;
  readonly libellesMachines: ReadonlyMap<string, string>;
  readonly issueSignature: { readonly issue: IssueSignature } | null;
  readonly compact: boolean;
  readonly hrefFiche: string;
  readonly vueEffective: VueRegistre | "toutes";
  readonly fuseauAgence: Fuseau;
  readonly fuseauSociete: Fuseau;
  readonly aujourdhuiLocal: JourLocal;
  readonly techniciensPourCreneau: readonly {
    readonly id: string;
    readonly nom: string;
  }[];
  readonly peutModifierLePlanning: boolean;
}) {
  switch (cle) {
    case "selection":
      // Rendue à part, en tête de ligne (`LigneIntervention`) — jamais ici :
      // la case précède TOUTES les colonnes de l'onglet, `colonnesOnglet` ne
      // la porte pas.
      return null;
    case "prio":
      return (
        <Cellule compact={compact}>
          <Priorite valeur={ligne.priorite} court />
        </Cellule>
      );
    case "intervention":
      return (
        <Cellule compact={compact}>
          <div className="flex flex-col gap-0.5">
            <Link
              href={hrefFiche}
              className={`${CLASSES_LIEN} whitespace-nowrap font-mono text-[12px] font-bold`}
            >
              {referenceAffichee(ligne)}
            </Link>
            <span>{objetDuBloc(ligne)}</span>
            <span className="text-app-encre-faible text-12 font-bold">
              {machinesAffichees(ligne, libellesMachines)}
            </span>
          </div>
        </Cellule>
      );
    case "client_site":
      return (
        <Cellule compact={compact}>
          <div className="flex flex-col gap-0.5">
            <span>{ligne.client.raison_sociale}</span>
            <span className="text-app-encre-faible text-12 font-bold">
              {ligne.site.libelle}
              {ligne.site.commune === null ? null : (
                <>
                  {t("ponctuation.point_median")}
                  {ligne.site.commune}
                </>
              )}
            </span>
          </div>
        </Cellule>
      );
    case "demande":
      return (
        <Cellule compact={compact}>
          <div className="flex flex-col gap-1">
            {ligne.description === null ? null : (
              <span>{descriptionTronquee(ligne.description)}</span>
            )}
            {ligne.demande_id === null &&
            !estDeplanifieeEnAttente(ligne) ? null : (
              <span className="flex flex-wrap gap-1.5">
                {ligne.demande_id === null ? null : (
                  <span className="border-app-bord text-app-encre-faible rounded-full border px-1.5 text-12 font-bold">
                    {t("interventions.demande.badge")}
                  </span>
                )}
                {estDeplanifieeEnAttente(ligne) ? (
                  <span className="text-app-orange-encre text-12 font-bold">
                    {t("interventions.demande.rendue_par_absence")}
                  </span>
                ) : null}
              </span>
            )}
          </div>
        </Cellule>
      );
    case "anciennete": {
      const anciennete = ancienneteRegistreAffichee(
        ligne.cree_le,
        fuseauSociete,
        aujourdhuiLocal,
      );
      return (
        <Cellule compact={compact}>
          <div className="flex flex-col gap-0.5">
            <span>{anciennete.texte}</span>
            <span className="text-app-encre-faible text-12 font-bold">
              {anciennete.depuisLe}
            </span>
          </div>
        </Cellule>
      );
    }
    case "duree": {
      const duree = dureeRegistreAffichee(ligne.duree_estimee_min);
      return (
        <Cellule compact={compact}>
          <span
            className={
              duree.manquante ? "text-app-orange-encre font-bold" : undefined
            }
          >
            {duree.texte}
          </span>
        </Cellule>
      );
    }
    case "heure":
    case "debut":
      return (
        <Cellule compact={compact}>
          {heureDuCreneau(ligne, fuseauAgence) ?? SIGNE_ABSENCE}
        </Cellule>
      );
    case "prevue":
    case "date":
    case "terminee":
      return (
        <Cellule compact={compact}>
          {dateRegistreAffichee(ligne.date_planifiee)}
        </Cellule>
      );
    case "statut":
      return (
        <Cellule compact={compact}>
          <span
            className={`rounded-full px-2 py-0.5 text-12 font-bold ${CLASSES_STATUT[ligne.statut]}`}
          >
            {t(`statut.${ligne.statut}`)}
          </span>
          {issueSignature === null ||
          issueSignature.issue === "signee" ? null : (
            <span className="text-app-encre-faible ml-1.5 text-12 font-bold">
              {issueSignature.issue === "client_absent"
                ? t("intervention.realisation.signature_absente")
                : t("intervention.realisation.signature_refusee")}
            </span>
          )}
        </Cellule>
      );
    case "technicien":
      return (
        <Cellule compact={compact}>
          {technicienAffiche(ligne, annuaire)}
        </Cellule>
      );
    case "compteur":
      return (
        <Cellule compact={compact}>
          {compteurRegistreAffiche(ligne.temps_mesure_min)}
        </Cellule>
      );
    case "depuis":
      return (
        <Cellule compact={compact}>
          {ligne.suspendue_le === null
            ? SIGNE_ABSENCE
            : dateLocale(ligne.suspendue_le, fuseauAgence)}
        </Cellule>
      );
    case "motif":
      return (
        <Cellule compact={compact}>
          {motifSuspensionAffiche(ligne.motif_suspension)}
        </Cellule>
      );
    case "piece_attendue": {
      const piece = pieceAttendueAffichee(ligne);
      return (
        <Cellule compact={compact}>
          {piece === null ? (
            SIGNE_ABSENCE
          ) : (
            <div className="flex flex-col gap-0.5">
              <span>{piece.reference}</span>
              {piece.disponibleLe === null ? null : (
                <span className="text-app-encre-faible text-12 font-bold">
                  {piece.disponibleLe}
                </span>
              )}
            </div>
          )}
        </Cellule>
      );
    }
    case "rapport":
      return (
        <Cellule compact={compact}>
          {texteRapportColonne(issueSignature)}
        </Cellule>
      );
    case "action":
      return (
        <Cellule compact={compact}>
          <ActionDeLigne
            ligne={ligne}
            hrefFiche={hrefFiche}
            vueEffective={vueEffective}
            fuseauAgence={fuseauAgence}
            techniciensPourCreneau={techniciensPourCreneau}
            peutModifierLePlanning={peutModifierLePlanning}
          />
        </Cellule>
      );
  }
}

/**
 * L'ACTION DE LIGNE (TP-UX3-1-REGISTRE-2, partie B) — « Poser » (À
 * planifier, Suspendues) et « Déplacer… » (En retard) ouvrent LA MÊME
 * `TrouverCreneau` que la fiche ; « Transmettre… » (Aujourd'hui, Planifiée
 * seulement) poste vers la route EXISTANTE ; « Contrôler » (Aujourd'hui
 * Terminée, À contrôler) n'est qu'un lien vers la fiche. **AU MÊME VERDICT
 * que la fiche** (`peutDeplacer`/`peutTransmettre`,
 * `lib/interventions/cycle-de-vie.ts`) — aucun bouton sans son verdict
 * serveur, et le bloc entier est ABSENT sans `modifier_planning` (même
 * régime que D153 sur la fiche), jamais montré refusé.
 */
function ActionDeLigne({
  ligne,
  hrefFiche,
  vueEffective,
  fuseauAgence,
  techniciensPourCreneau,
  peutModifierLePlanning,
}: {
  readonly ligne: LignePlanning;
  readonly hrefFiche: string;
  readonly vueEffective: VueRegistre | "toutes";
  readonly fuseauAgence: Fuseau;
  readonly techniciensPourCreneau: readonly {
    readonly id: string;
    readonly nom: string;
  }[];
  readonly peutModifierLePlanning: boolean;
}) {
  if (!peutModifierLePlanning) {
    return null;
  }
  if (vueEffective === "a_planifier" || vueEffective === "bloquees") {
    if (peutDeplacer(ligne.statut).refuse) {
      return null;
    }
    return (
      <TrouverCreneau
        interventionId={ligne.id}
        libelle={referenceAffichee(ligne)}
        dureeMinInitiale={ligne.duree_estimee_min}
        technicienIdInitial={ligne.technicien_id}
        jourInitial={jourInitialCreneauDeLaLigne(ligne, fuseauAgence)}
        fuseau={fuseauAgence}
        techniciens={techniciensPourCreneau}
        libelleBouton="interventions.colonne.poser"
      />
    );
  }
  if (vueEffective === "en_retard") {
    if (peutDeplacer(ligne.statut).refuse) {
      return null;
    }
    return (
      <TrouverCreneau
        interventionId={ligne.id}
        libelle={referenceAffichee(ligne)}
        dureeMinInitiale={ligne.duree_estimee_min}
        technicienIdInitial={ligne.technicien_id}
        jourInitial={jourInitialCreneauDeLaLigne(ligne, fuseauAgence)}
        fuseau={fuseauAgence}
        techniciens={techniciensPourCreneau}
        libelleBouton="interventions.colonne.deplacer"
      />
    );
  }
  if (vueEffective === "aujourdhui") {
    if (ligne.statut === "terminee") {
      return (
        <Link href={hrefFiche} className={CLASSES_LIEN}>
          {t("interventions.colonne.controler")}
        </Link>
      );
    }
    if (ligne.statut !== "planifiee") {
      return null;
    }
    const verdict = peutTransmettre({
      statut: ligne.statut,
      technicienId: ligne.technicien_id,
      datePlanifiee: ligne.date_planifiee,
      debutMinutes: ligne.creneau_debut,
      dureeMin: ligne.duree_estimee_min,
    });
    if (verdict.refuse) {
      return null;
    }
    return (
      <form method="post" action={`/api/interventions/${ligne.id}/transmettre`}>
        <Button type="submit" variant="outline" size="sm">
          {t("interventions.colonne.transmettre_courte")}
        </Button>
      </form>
    );
  }
  if (vueEffective === "a_controler") {
    return (
      <Link href={hrefFiche} className={CLASSES_LIEN}>
        {t("interventions.colonne.controler")}
      </Link>
    );
  }
  return null;
}

/**
 * LA CARTE SOUS 900 PX (TP-UX3-1-REGISTRE-2, choix du pilote C5) — IDENTIQUE
 * pour tous les onglets, sans action ni case (`components/ui/liste-cartes.tsx`).
 */
function CarteIntervention({
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
    <Carte href={hrefFiche}>
      <div className="flex items-center gap-1.5">
        <Priorite valeur={ligne.priorite} court />
        <span
          className={`rounded-full px-2 py-0.5 text-12 font-bold ${CLASSES_STATUT[ligne.statut]}`}
        >
          {t(`statut.${ligne.statut}`)}
        </span>
        <span className="text-app-encre-faible ml-auto font-mono text-[12px] font-bold">
          {referenceAffichee(ligne)}
        </span>
      </div>
      <div>
        {ligne.client.raison_sociale}
        <span className="text-app-encre-faible font-semibold">
          {t("ponctuation.point_median")}
          {ligne.site.libelle}
        </span>
      </div>
      <div className="text-app-encre-faible text-12 font-bold">
        {objetDuBloc(ligne)}
        {t("ponctuation.point_median")}
        {machinesAffichees(ligne, libellesMachines)}
      </div>
      <div className="flex items-center justify-between text-12 font-bold">
        <span className="text-app-encre-faible">
          {ligne.date_planifiee === null
            ? t("planning.file_attente")
            : dateCivile(ligne.date_planifiee)}
        </span>
        <span>{technicienAffiche(ligne, annuaire)}</span>
      </div>
    </Carte>
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
