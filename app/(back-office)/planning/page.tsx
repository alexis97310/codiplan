import type { StatutRessource } from "@prisma/client";
import type { Metadata } from "next";

import Link from "next/link";
import { Page } from "@/components/mise-en-page/page";
import { LienPrimaire } from "@/components/ui/action-primaire";
import { Avatar } from "@/components/ui/avatar";
import {
  Badge,
  CLASSES_TON as CLASSES_TON_PRIORITE,
} from "@/components/ui/badge";
import { CadreDefilant } from "@/components/ui/cadre-defilant";
import { Carte } from "@/components/ui/carte";
import { Icone } from "@/components/ui/icone";
import { ListeQuiFiltre } from "@/components/ui/liste-qui-filtre";
import {
  CLASSES_LIEN,
  LARGEUR_COLONNE_JOUR_FERME_PX,
  LARGEUR_COLONNE_JOUR_MOIS_PX,
  LARGEUR_COLONNE_JOUR_OUVERT_DEUX_SEMAINES_PX,
  LARGEUR_COLONNE_JOUR_OUVERT_PX,
  LARGEUR_COLONNE_TECHNICIEN_PX,
} from "@/lib/theme/apparence";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { absencesDeLaPeriode } from "@/lib/absences/depot";
import { periodesBloquees } from "@/lib/absences/periode";
import { annuaireDesPersonnes, type Annuaire } from "@/lib/auth/annuaire";
import { exigerContexteActif } from "@/lib/auth/contexte";
import { peut, peutPleinement } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import {
  cleJour,
  instantDuJour,
  jourDe,
  jourSuivant,
  maintenant,
  minuit,
  minutesDepuisMinuit,
  schemaFuseau,
  versInstant,
  versLocal,
  type Fuseau,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import {
  chargerCalendrierAgence,
  type CacheCalendrierAgence,
  type FenetreJours,
} from "@/lib/calendar/agence";
import { chargerCalendrierDuTechnicien } from "@/lib/calendar/technicien";
import {
  jourParticulier,
  plagesDuJourSemaine,
  type Calendrier,
} from "@/lib/calendar/calendrier";
import {
  estJourOuvre,
  minutesOuvrees,
  prochainJourOuvert,
} from "@/lib/calendar/ouverture";
import {
  enHeure,
  joursTravailles,
  lireParametrage,
} from "@/lib/calendar/parametrage";
import { jourSemaineIso, lundiDeLaSemaine } from "@/lib/calendar/semaine";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t, type CleTraduction } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  interventionsEnRetard,
  interventionsSansDuree,
  interventionsSuspendues,
  listerPlanifieesATransmettre,
  listerPlanning,
  type LigneLaisseeATransmettre,
} from "@/lib/interventions/depot";
import {
  ancienneteEnJours,
  fileDAttente,
  idConnuDepuisParametre,
  joursDeLaVue,
  lignesAffichees,
  moisDecale,
  ongletFileDepuisParametre,
  ongletTelephone,
  parametrePeriode,
  parZone,
  valeurConnueDepuisParametre,
  voletDepuisParametre,
  vueDepuisParametre,
  zoneFileDepuisParametre,
  type OngletFile,
  type VuePlanning,
} from "@/lib/interventions/affichage";
import { hrefCreerIci } from "@/lib/interventions/creer-ici";
import { enRetard } from "@/lib/interventions/retard";
import { ZONES_GEOGRAPHIQUES, type ZoneGeographique } from "@/lib/sites/zones";
import {
  construireGrille,
  type AgenceDeGrille,
  type CaseDeGrille,
} from "@/lib/interventions/grille";
import {
  construireJournee,
  type ACaler,
  type AgenceDeJournee,
  type BlocDeLigne,
  type Journee,
  type MotifHorsGrille,
  type TechnicienDeJournee,
} from "@/lib/interventions/journee";
import {
  occupationsDuPlanning,
  type LigneOccupation,
} from "@/lib/interventions/occupation";
import {
  nomSeul,
  personnesANommer,
  quiTravaille,
} from "@/lib/interventions/personnes";
import { perimetreDuPlanning } from "@/lib/interventions/perimetre-technicien";
import {
  PRIORITES,
  STATUTS_INTERVENTION,
  TYPES_INTERVENTION,
} from "@/lib/interventions/saisie";
import {
  occupationTechnicien,
  tauxCompact,
  TAUX_PLEIN,
  type OccupationTechnicien,
} from "@/lib/interventions/statistiques";
import { SANS_TRAJET } from "@/lib/interventions/trajet";
import {
  donneesMaterielDesMachines,
  type DonneesMateriel,
} from "@/lib/machines/depot";
import { tonDePriorite } from "@/lib/theme/priorites";
import {
  CLASSES_BLOC,
  CLASSES_TON,
  LEGENDE_PLANNING,
} from "@/lib/theme/statuts";
import { tonDeLAvertissement } from "@/lib/avertissements/ton";

import {
  BlocPosable,
  BoutonPoser,
  CasePosable,
  Posable,
} from "@/components/planning/pose";
import {
  DialogueTransmettreDemain,
  type GroupeTechnicienATransmettre,
  type InterventionPreteAffichee,
  type LigneLaisseeAffichee,
} from "@/components/planning/transmettre-demain";
import { Tiroir } from "@/components/planning/tiroir";
import { BoutonAvecConfirmation } from "@/components/ui/bouton-confirmation";
import { DefilerVersAujourdhuiMois } from "./defiler-mois";
import { EchapPleinEcran } from "./plein-ecran";

import {
  enTeteDuBloc,
  mentionDeplanifiee,
  objetDuBloc,
  referenceAffichee,
} from "../interventions/presentation";
import { decompte } from "../presentation";
import {
  barreChargeDuJour,
  creneauDeLaCarte,
  dureeCarteAffichee,
  glisseDeLaCarteSansHeure,
  materielDeLaCarte,
  panneOuNatureDeLaCarte,
  resumeDesTechniciens,
  siteDeLaCarte,
  teinteDeChargeDuJour,
  type TeinteChargeJour,
} from "./carte";
import {
  courrielTransmissionNonConfigure,
  libelleDeuxSemaines,
  libelleMois,
  libelleMotifNonTransmissible,
  libelleSemaine,
  libelleTransmettreDemain,
  libelleTransmettreToutesLesPlanifieesPretes,
  ouTravaille,
  puceAbsencesSemaine,
  puceEnRetard,
  puceSansDuree,
  sousTitreJour,
  texteCalendriers,
  texteCompteRenduTransmission,
  texteConfirmationTransmettreToutes,
  texteIndiceDefilement,
  texteIndiceDefilementJour,
  texteIndiceDefilementMois,
  texteLigneLaissee,
  texteRefusTransmission,
  titreCalendriers,
  titreDialogueTransmettreDemain,
} from "./presentation";
import { Statistiques } from "./statistiques";

export const metadata: Metadata = { title: t("planning.titre") };

/**
 * LE PLANNING — deux vues sur la même donnée (lot 2, D84 ; D95 ; 11/09/2026).
 *
 * ## La vue SEMAINE : une ligne par PERSONNE
 *
 * *Elle avait une ligne par couple (technicien, agence), et une personne qui
 * sert Ducos et Koné en occupait deux.* La maille est désormais la personne ;
 * la règle d'ouverture et la raison pour laquelle elle ne contredit pas I7 sont
 * écrites dans `lib/interventions/grille.ts`. Chaque bloc NOMME son agence,
 * parce que c'est elle qui décide, et que la ligne ne le dit plus.
 *
 * ## La vue JOUR : les heures en lignes, les personnes en colonnes
 *
 * **Son objet est de montrer les TROUS**, et c'est le seul critère qui la juge.
 * L'axe porte l'union des heures des agences présentes, au pas le plus fin
 * qu'elles règlent — jamais un pas écrit ici (I7) —, et chaque colonne grise
 * les heures hors du calendrier de sa propre agence. Le compte des créneaux
 * libres est affiché : *« on voit bien les trous » est une impression, pas une
 * observation.*
 *
 * ## Ce qui est commun aux deux
 *
 * **Une seule lecture cloisonnée**, et les deux vues s'en servent. Les noms des
 * personnes viennent de `nomsDesPersonnes`, qui n'élargit rien : la politique
 * `utilisateur_lecture` porte cette branche depuis L1-02c — mesuré le
 * 11/09/2026, 4 identités pour un interne, 0 pour un compte portail.
 *
 * **Ce n'est toujours pas un calendrier agissant** : Schedule-X et le
 * glisser-déposer viennent au lot 3.
 */
export default async function PagePlanning({
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
  // LE DROIT DE DÉPLACER (99J-PLANNING-GLISSER) — `peutPleinement`, pas
  // `peut` (05/10/2026, 9D3-PLANNING-TECHNICIEN-ACTIONS), même correction que
  // la fiche d'intervention (`app/(back-office)/interventions/[id]/page.tsx`,
  // 9DKA-REPRISE-9DK). Depuis TR-5 (D136), le technicien porte un ○ sur
  // `modifier_planning` pour déclarer SA PROPRE absence ; ce ○ n'a jamais été
  // pensé pour « Transmettre », « + Créer ici » ni la réaffectation par
  // glisser-déposer — les routes qu'ils appellent
  // (`/api/interventions/[id]/deplacer`, `.../transmettre`,
  // `app/api/interventions/transmettre`) exigent désormais l'accès complet
  // (`exigerCapaciteComplete`). Un écran qui continuait de lire `peut` offrait
  // donc à un technicien des actions que le serveur refusait à chaque clic
  // (D131, D-06). Sert à annoncer le geste dans le sous-titre, à montrer les
  // commandes de transmission groupée et à masquer la liste des laissées —
  // la grille elle-même reste rendue à tout rôle qui voit le planning
  // (`pose.tsx`, hors périmètre de ce ticket).
  const peutModifierLePlanning =
    contexte.role !== null &&
    peutPleinement(contexte.role, "modifier_planning");
  // « DÉCLARER UNE ABSENCE » (MO-31, D136, TR-5) — à PART, en `peut` : c'est
  // le SEUL geste que le ○ du technicien doit continuer d'ouvrir sur cette
  // page (`LienDeclarerAbsence`, plus bas). Le confondre avec
  // `peutModifierLePlanning` ci-dessus rouvrirait exactement le défaut que ce
  // ticket corrige.
  const peutDeclarerAbsence =
    contexte.role !== null && peut(contexte.role, "modifier_planning");
  // « + CRÉER ICI » (PG-D5-CREER-ICI) — les DEUX capacités ensemble : celle
  // de la route de création (`creer_demande`, `app/api/interventions/creer/route.ts`)
  // et celle de la pose (`modifier_planning`, ci-dessus, en accès COMPLET).
  // Un rôle qui n'a que l'une des deux ne verrait qu'un geste que l'autre
  // moitié du parcours refuserait en silence.
  const peutCreerIci =
    contexte.role !== null &&
    peut(contexte.role, "creer_demande") &&
    peutModifierLePlanning;
  // ── LE RÉFÉRENTIEL DES TECHNICIENS SUIT LE MÊME PÉRIMÈTRE QUE LES LIGNES
  // (R5-01, mesuré et corrigé le 17/09/2026).
  //
  // *Mesuré sous la session d'un technicien au périmètre restreint (rôle
  // `technicien`, `perimetreDuPlanning` rend `"restreint"`) : `listerPlanning`
  // rendait bien UNE seule personne, mais `technicien.findMany({actif: true})`
  // en rendait QUATRE — celui-ci ET ses trois collègues — parce que rien ici
  // ne lisait le périmètre avant de peupler le référentiel qui donne ses
  // colonnes à la vue jour (depuis le 12/09) et ses lignes à la vue semaine
  // (depuis le N-06 ci-dessus).* Le technicien voyait donc la liste nominative
  // de toute l'équipe, et les cibles de dépôt de ses collègues, alors que
  // `consulter_planning` le lui interdit — une fuite par déduction, exactement
  // la famille que R5-01 existe pour fermer.
  //
  // La correction lit `perimetreDuPlanning` UNE FOIS, ici, et filtre le
  // référentiel avant qu'il n'aille nommer une colonne ou une ligne. Elle ne
  // recopie pas `role === technicien` : c'est le verdict de la matrice
  // (`perimetreDuPlanning`, `lib/interventions/perimetre-technicien.ts`) qui
  // décide, comme il décide déjà pour `listerPlanning`.
  const perimetre = perimetreDuPlanning(exigerContexteActif(contexte));
  const parametres = await searchParams;
  const vue = vueDepuisParametre(parametres.vue);
  // LES ANNULÉES SONT MASQUÉES PAR DÉFAUT (PG-A8-ANNULEES-MASQUEES) — seule
  // `"1"` les remontre, comme `vue` ci-dessus n'accepte qu'une liste FERMÉE
  // (`vueDepuisParametre`) : toute autre valeur retombe sur le défaut plutôt
  // que de faire échouer la page (L1-02f, un paramètre d'URL vient de
  // l'extérieur).
  const afficherAnnulees = parametres.annulees === "1";
  // LE « PLEIN ÉCRAN » (PG-C3-CARTES-COLONNES, décision QG-1 du 27/09/2026) —
  // dans l'URL, comme `vue` et `annulees` juste au-dessus : même discipline,
  // même raison (L1-02f, un paramètre d'URL vient de l'extérieur, et une
  // valeur illisible retombe sur l'état initial plutôt que de faire échouer
  // la page).
  const pleinEcran = parametres.pleinEcran === "1";
  // LES ONGLETS DE LA COLONNE « À TRAITER » (PG-C2-FILE-ONGLETS) ET LE FILTRE
  // « ZONE » (MO-18) — même discipline que `vue` : une liste FERMÉE, et toute
  // autre valeur retombe sur le défaut (L1-02f). Lus par des fonctions PURES
  // (`lib/interventions/affichage.ts`), testables sans lever cette page.
  const ongletFile = ongletFileDepuisParametre(parametres.onglet);
  const zoneFile = zoneFileDepuisParametre(parametres.zone);
  // LE VOLET DU TÉLÉPHONE (PG-D4-TELEPHONE-ONGLETS, D146) — sous 900 px,
  // trois onglets (Aujourd'hui / À traiter / Semaine) remplacent l'ancien
  // repli en liste de la vue Jour (C-B1). `volet` ne vaut que « a_traiter » ;
  // `ongletActif` en déduit lequel des trois est actif, `vue` primant sinon
  // (fonctions pures, `lib/interventions/affichage.ts`).
  const volet = voletDepuisParametre(parametres.volet);
  const ongletActif = ongletTelephone(vue, volet);
  // LA RECHERCHE TEXTE DE LA COLONNE (PG-C2-FILE-ONGLETS) — client ou
  // référence, jamais dans un état de composant (AT-07) : elle vit dans l'URL,
  // comme le reste des critères de cet écran.
  const rechercheFile =
    typeof parametres.q === "string" && parametres.q.trim() !== ""
      ? parametres.q.trim()
      : null;
  // LES AVERTISSEMENTS D'UN DÉPÔT ACCEPTÉ (N+1, 17/09/2026) — portés par
  // l'URL du rechargement complet que `Posable` déclenche désormais, jamais
  // par un état client qu'un rechargement effacerait avant qu'on le lise.
  // Même filtre que le refus de la fiche (L1-02f) : une clé inconnue ne
  // s'affiche pas — une réponse forgée ne ferait écrire n'importe quoi ici.
  //
  // **LA CLÉ EST LITTÉRALE, PAS `PARAMETRE_AVERTISSEMENT` (GR17-M13, bogue
  // trouvé en écrivant ce lot)** — mesuré : cette constante, exportée par
  // `pose.tsx` (`"use client"`), est `undefined` une fois lue depuis CE
  // composant SERVEUR. La frontière client/serveur de Next.js ne transmet
  // que les références de composant à travers un import ainsi marqué, pas
  // une constante ordinaire — le bandeau ne s'affichait donc JAMAIS ici,
  // quelle que soit l'URL. La fiche d'intervention lisait déjà la même clé en
  // toutes lettres (`../interventions/[id]/page.tsx`) ; ce fichier fait
  // désormais pareil, pour la même raison.
  const avertissementsAffiches = [parametres.avertissement ?? []]
    .flat()
    .filter((valeur): valeur is string => typeof valeur === "string")
    .filter(estCleTraduction);
  // LE REFUS DE LA CRÉATION, LU DEPUIS L'URL (chantier CRÉA-1, 20/09/2026).
  //
  // `versLePlanning(cle)` (`app/api/interventions/actions.ts`) redirige déjà
  // vers `/planning?motif=<cle>` quand `creerIntervention` refuse — c'est le
  // MÊME mécanisme que `/interventions/[id]` et `/interventions/nouvelle`
  // emploient pour leur propre refus (`motif`, filtré par `estCleTraduction`,
  // L1-02f) —, mais rien ici ne lisait ce paramètre : un jour d'agence fermée
  // refusait la création EN SILENCE, sans qu'aucun écran ne le dise. Même
  // filtre, même raison : un lien forgé ne doit pas pouvoir faire écrire
  // n'importe quoi à la page.
  const motifRefusCreation = parametres.motif;
  const refusCreationAffiche =
    typeof motifRefusCreation === "string" &&
    estCleTraduction(motifRefusCreation)
      ? motifRefusCreation
      : null;

  // LE COMPTE-RENDU D'UNE TRANSMISSION GROUPÉE, LU DEPUIS L'URL
  // (QG-5, D141, 9CP-PG-G14B-TRANSMETTRE-GROUPE) — `POST
  // /api/interventions/transmettre` redirige vers `/planning?transmis=<n>
  // &techniciens=<n>&echecsCourriel=<n>&courriel=non_configure
  // &refusee=<id>:<cle>`. Des NOMBRES et des CLÉS FERMÉES, jamais du texte
  // (L1-02f, D50) : un paramètre forgé rend au plus un compte faux, une
  // mention « canal non configuré » à tort, ou une ligne d'une intervention
  // que son rôle a par ailleurs le droit d'ouvrir — jamais un texte injecté.
  const entierPositif = (valeur: string | string[] | undefined): number => {
    const brut = Array.isArray(valeur) ? valeur[0] : valeur;
    const nombre = Number(brut);
    return typeof brut === "string" && Number.isInteger(nombre) && nombre >= 0
      ? nombre
      : 0;
  };
  const transmisAffiche =
    typeof parametres.transmis === "string"
      ? entierPositif(parametres.transmis)
      : null;
  const compteRenduTransmission =
    transmisAffiche === null
      ? null
      : texteCompteRenduTransmission({
          transmis: transmisAffiche,
          techniciens: entierPositif(parametres.techniciens),
          echecsCourriel: entierPositif(parametres.echecsCourriel),
          courrielNonConfigure: courrielTransmissionNonConfigure(
            parametres.courriel,
          ),
        });
  const refuseesAffichees = [parametres.refusee ?? []]
    .flat()
    .filter((valeur): valeur is string => typeof valeur === "string")
    .map((valeur) => {
      const [id, cle] = valeur.split(":");
      return { id, cle };
    })
    .filter(
      (refus): refus is { id: string; cle: CleTraduction } =>
        typeof refus.id === "string" &&
        typeof refus.cle === "string" &&
        estCleTraduction(refus.cle),
    );

  const cadre = await avecContexteApplicatif(contexte, async (tx) => {
    const societe = await tx.societe.findFirst({
      where: { id: contexte.societeId as string },
      select: { fuseau_horaire: true },
    });
    const fuseau = societe?.fuseau_horaire ?? "UTC";

    // ── LA FENÊTRE DE JOURS EST CALCULÉE ICI, AVANT LES AGENCES
    // (PG-A1-FERIES-GRILLE, 28/09/2026) ──────────────────────────────────
    //
    // `chargerCalendrierAgence`, plus bas, a besoin de la fenêtre affichée
    // pour charger les jours particuliers (fériés, ponts, exceptions) qui la
    // couvrent : elle ne peut donc plus se calculer APRÈS cette lecture,
    // comme elle le faisait quand seul `lireParametrage` (plages
    // hebdomadaires seules) servait la grille et la vue jour.
    //
    // LES QUATRE VUES (9CI-PG-G12-DEUX-SEMAINES-MOIS, D145) — `joursDeLaVue`
    // dit combien de jours et lesquels, une seule fois pour les quatre :
    // « jour » et « mois » partent du jour demandé par `?jour=`, « semaine »
    // et « deux_semaines » du lundi demandé par `?semaine=` (inchangé pour
    // ces deux-là, `jourDemande(..., true)` forçait déjà le lundi).
    const jourAffiche = jourDemande(parametres.jour, fuseau, false);
    const jours = joursDeLaVue(
      vue,
      vue === "jour" || vue === "mois"
        ? jourAffiche
        : jourDemande(parametres.semaine, fuseau, true),
    );
    // ── LA FENÊTRE EST EN JOURS, ET SA BORNE HAUTE EST EXCLUSIVE ───────────
    //
    // `date_planifiee` est un `@db.Date` : la borner à minuit UTC est JUSTE
    // pour l'appartenance au jour, et c'est pour cela que `instantDuJour`
    // existe. *Ce qui était faux était d'employer LES MÊMES BORNES comme des
    // INSTANTS pour le dénominateur du panneau de charge* — sous UTC+11,
    // « vendredi 00:00 UTC » est « vendredi 11 h à Nouméa ». La conversion en
    // instants descend désormais dans `occupationsDuPlanning`, où le fuseau
    // de chaque calendrier est connu ; ici, on ne manipule plus que des
    // JOURS.
    const fenetreEnJours =
      vue === "jour"
        ? { du: jourAffiche, au: jourSuivant(jourAffiche) }
        : { du: jours[0], au: jourSuivant(jours[jours.length - 1]) };

    // `actif` est LU (select), jamais FILTRÉ (where) — voir l'en-tête plus
    // bas, à l'endroit où il sert : `pourGrille` et `pourJournee` sont des
    // index de consultation pour les interventions encore posées d'une
    // agence, actives ou non (AGENCE-ACTIVE, AA-5).
    const agences = await tx.agence.findMany({
      select: {
        id: true,
        libelle: true,
        calendrier_id: true,
        fuseau_horaire: true,
        actif: true,
      },
      orderBy: { libelle: "asc" },
    });
    // LE CACHE DU CALENDRIER (PERF-2, `lib/calendar/agence.ts`) — mutualisé
    // entre les agences de CETTE page, jamais entre deux requêtes HTTP.
    const cacheCalendriers: CacheCalendrierAgence = new Map();
    const detaillees = await Promise.all(
      agences.map(async (agence) => {
        const parametrage =
          agence.calendrier_id === null
            ? null
            : await lireParametrage(tx, agence.calendrier_id);
        // LE CALENDRIER COMPLET DE L'AGENCE (PG-A1-FERIES-GRILLE, CA-1) —
        // fériés, ponts et exceptions compris, jamais seulement les plages
        // hebdomadaires que `parametrage` porte : c'est lui, et lui seul, qui
        // décide de l'ouverture d'un jour à la grille et à la vue jour,
        // exactement la lecture que la pose emploie déjà
        // (`chargerCalendrierAgence`, commentaire de
        // `lib/interventions/depot.ts:780` : « ET NON `lireParametrage` »).
        const calendrier = await chargerCalendrierAgence(
          tx,
          {
            societeId: contexte.societeId as string,
            agenceId: agence.id,
            fenetre: fenetreEnJours,
          },
          cacheCalendriers,
        );
        return { agence, parametrage, calendrier };
      }),
    );
    // ── LE RÉFÉRENTIEL DES PERSONNES — c'est lui qui donne ses colonnes à la
    // vue jour, et non plus les interventions (12/09/2026).
    //
    // *Un technicien dont la journée est entièrement libre n'avait aucune
    // colonne* — c'est-à-dire, sur un écran dont l'objet déclaré est de MONTRER
    // LES TROUS, la personne qu'il fallait montrer en premier.
    //
    // `actif` filtre, et c'est une décision : *un technicien qui a quitté
    // l'entreprise ne se supprime pas, il cesse d'être proposé* (schéma,
    // `Technicien.actif`). Lui garder une colonne vide ferait proposer une
    // journée entière chez quelqu'un qui n'est plus là. Ses interventions
    // passées, elles, lui rendent sa colonne — la vue jour n'en perd aucune.
    // `filtreDuPerimetre` (lib/interventions/perimetre-technicien.ts) n'est
    // PAS réutilisable ici : il rend un fragment sur la colonne `technicien_id`
    // d'`intervention`, pas sur la clé `utilisateur_id` de `technicien`. Le
    // VERDICT vient de la même matrice ; seule la colonne filtrée diffère
    // parce que la table diffère.
    const techniciens = await tx.technicien.findMany({
      where: {
        actif: true,
        ...(perimetre.acces === "restreint"
          ? { utilisateur_id: perimetre.technicienId }
          : {}),
      },
      select: { utilisateur_id: true, agence_id: true, statut_ressource: true },
    });
    // LE FILTRE « CLIENT » DE LA BARRE D'OUTILS (PG-C6-FILTRES-AUJOURDHUI) —
    // les clients ACTIFS seulement, comme `filtreClientActif(false)` le fait
    // déjà pour les lignes elles-mêmes : proposer un client inactif dans ce
    // filtre inviterait à chercher des cartes qu'aucune ligne ne porte plus
    // (RG-PLA-08, D129).
    const clients = await tx.client.findMany({
      where: { actif: true },
      select: { id: true, raison_sociale: true },
      orderBy: { raison_sociale: "asc" },
    });
    return {
      fuseau,
      jours,
      jourAffiche,
      fenetreEnJours,
      detaillees,
      techniciens,
      clients,
    };
  });

  // ── LA BARRE DE FILTRES (PG-C6-FILTRES-AUJOURDHUI) ──────────────────────
  //
  // Cinq critères combinables, dans l'URL comme le reste de cet écran
  // (L1-02f : une valeur hors liste, ou qui ne désigne rien de connu, est
  // ignorée plutôt que de faire échouer la page). Composés ICI, dans
  // `affichees` lui-même (plus bas) — jamais dans un second `.filter()` posé
  // à côté : les trois consommateurs (`construireGrille`, `construireJournee`,
  // `occupationsDuPlanning`) continuent de lire LE MÊME jeu, sans quoi le
  // panneau de charge et la grille recompteraient deux populations
  // différentes (§9, 01/09 — `tests/unit/interventions/
  // planning-un-seul-jeu.test.ts`). Les LIGNES de technicien, elles, ne
  // viennent jamais d'`affichees` : `pourGrille`/`pourJournee`/
  // `pourTechniciens` restent l'index complet, et un technicien sans carte
  // visible garde sa ligne, vide, plutôt que de disparaître.
  const agencesActives = cadre.detaillees.filter(({ agence }) => agence.actif);
  const filtreAgence = idConnuDepuisParametre(
    parametres.agence,
    agencesActives.map((a) => a.agence.id),
  );
  const filtreTechnicien =
    parametres.technicien === "aucun"
      ? "aucun"
      : idConnuDepuisParametre(
          parametres.technicien,
          cadre.techniciens.map((t) => t.utilisateur_id),
        );
  const filtreNature = valeurConnueDepuisParametre(
    parametres.nature,
    TYPES_INTERVENTION,
  );
  const filtrePriorite = valeurConnueDepuisParametre(
    parametres.priorite,
    PRIORITES,
  );
  const filtreClient = idConnuDepuisParametre(
    parametres.client,
    cadre.clients.map((c) => c.id),
  );
  const filtreStatut = valeurConnueDepuisParametre(
    parametres.statut,
    STATUTS_INTERVENTION,
  );
  const auMoinsUnFiltreActif =
    filtreAgence !== null ||
    filtreTechnicien !== null ||
    filtreNature !== null ||
    filtrePriorite !== null ||
    filtreClient !== null ||
    filtreStatut !== null;

  function correspondAuxFiltres(ligne: Ligne): boolean {
    if (filtreAgence !== null && ligne.agence_id !== filtreAgence) {
      return false;
    }
    if (filtreTechnicien !== null) {
      const correspond =
        filtreTechnicien === "aucun"
          ? ligne.technicien_id === null
          : ligne.technicien_id === filtreTechnicien;
      if (!correspond) {
        return false;
      }
    }
    if (filtreNature !== null && ligne.type !== filtreNature) {
      return false;
    }
    if (filtrePriorite !== null && ligne.priorite !== filtrePriorite) {
      return false;
    }
    if (filtreClient !== null && ligne.client_id !== filtreClient) {
      return false;
    }
    if (filtreStatut !== null && ligne.statut !== filtreStatut) {
      return false;
    }
    return true;
  }

  const pourGrille: AgenceDeGrille[] = cadre.detaillees.map(
    ({ agence, calendrier }) => ({
      id: agence.id,
      libelle: agence.libelle,
      calendrier,
    }),
  );
  const pourJournee: AgenceDeJournee[] = cadre.detaillees.map(
    ({ agence, parametrage, calendrier }) => ({
      id: agence.id,
      libelle: agence.libelle,
      calendrier,
      pasCreneauMinutes: parametrage?.pasCreneauMinutes ?? 0,
    }),
  );

  const pourTechniciens: TechnicienDeJournee[] = cadre.techniciens.map((t) => ({
    id: t.utilisateur_id,
    agenceIds: [t.agence_id],
  }));

  // SALARIÉ OU PATENTÉ (QG-9, D163) — le badge « Patente », À CÔTÉ du nom,
  // jamais dessous (D111). Rien n'est marqué pour un salarié ni pour un
  // statut non renseigné (choix du pilote).
  const statutRessourceDe = new Map(
    cadre.techniciens.map((t) => [t.utilisateur_id, t.statut_ressource]),
  );

  // ── LE FUSEAU DE CHAQUE AGENCE (PG-B2-FENETRE-POSE) ─────────────────────
  //
  // `FenetrePose` affiche les créneaux de PG-B1 en heure LOCALE : le fuseau
  // vient de l'agence DE L'INTERVENTION, jamais d'une constante — même
  // principe que `verdictALaPose`, qui juge sous ce même fuseau (I7).
  const fuseauParAgence = new Map(
    cadre.detaillees
      .filter(({ calendrier }) => calendrier !== null)
      .map(({ agence, calendrier }) => [agence.id, calendrier!.fuseau]),
  );

  // POUR LA SEULE BANNIÈRE (AGENCE-ACTIVE, AA-5) — jamais pour `pourGrille`
  // ni `pourJournee`, qui restent l'index de consultation COMPLET, agences
  // actives ou non, dont `lib/interventions/grille.ts` a besoin pour ouvrir
  // la journée et hachurer les interventions encore posées d'une agence
  // désactivée. `texteCalendriers` filtre lui-même sur `actif`.
  const pourBanniere = cadre.detaillees.map(({ agence, parametrage }) => ({
    libelle: agence.libelle,
    joursOuverts: parametrage === null ? [] : joursTravailles(parametrage),
    calendrierConnu: parametrage !== null,
    actif: agence.actif,
  }));

  const jours = cadre.jours;
  const jourAffiche = cadre.jourAffiche;
  // LE JOUR COURANT, UNE SEULE FOIS (82-PLANNING-6, 25/09/2026) — dans le
  // fuseau de la SOCIÉTÉ, comme `jourDemande` ci-dessus quand aucun paramètre
  // ne fixe le jour : deux lectures d'un même critère divergent en silence
  // (§9, 01/09), et il ne doit exister qu'un seul « aujourd'hui » sur l'écran.
  const aujourdhui = maintenant(cadre.fuseau).local;
  // LA BORNE CIVILE DE « AUJOURD'HUI » (PG-C2-FILE-ONGLETS, 9CT-RETOUCHES-5)
  // — hissée ICI plutôt que recalculée près de chacun de ses usages : l'onglet
  // « En retard » de la colonne « À traiter » ET « Transmettre toutes les
  // planifiées prêtes » (décision d'Alexis du 02/10/2026, point 7, D141)
  // lisent la MÊME civile, jamais deux lectures d'un même critère (§9, 01/09).
  const debutDuJourSociete = instantDuJour(jourDe(aujourdhui));
  // LE PROCHAIN JOUR OUVERT (PG-C6-FILTRES-AUJOURDHUI) — pour le bouton
  // « Aujourd'hui » de la vue JOUR : si aujourd'hui est un jour fermé de
  // TOUTES les agences (dimanche, férié), il ouvre le premier jour suivant où
  // AU MOINS UNE agence est ouverte (`prochainJourOuvert`,
  // `lib/calendar/ouverture.ts`), jamais une règle « dimanche » écrite ici
  // (I7).
  const jourOuvertLePlusProche = prochainJourOuvert(
    pourGrille
      .map((agence) => agence.calendrier)
      .filter((calendrier): calendrier is Calendrier => calendrier !== null),
    jourDe(aujourdhui),
  );

  // ── « TRANSMETTRE DEMAIN » / « TRANSMETTRE TOUTES LES PLANIFIÉES PRÊTES »
  // (QG-5, D141, 9CP-PG-G14B-TRANSMETTRE-GROUPE, précisions du 02/10/2026) ──
  //
  // Calculées pour tout rôle qui voit le planning (coût négligeable), mais
  // RENDUES seulement sous `peutModifierLePlanning`, plus bas — même
  // discipline que le reste de cette page (D-06).
  //
  // « Demain » = le prochain jour ouvert d'AU MOINS UNE agence À PARTIR DE
  // J+1 — même règle que `jourOuvertLePlusProche` ci-dessus, un DÉPART
  // différent. Les calendriers sont RECHARGÉS sur une fenêtre dédiée
  // [J+1, J+15] : `fenetreEnJours`, juste en dessous, ne couvre que la
  // fenêtre AFFICHÉE — un seul jour en vue Jour — et chercherait l'ouverture
  // dans le vide.
  const fenetreDemain: FenetreJours = {
    du: jourSuivant(jourDe(aujourdhui)),
    au: jourSuivant(jourDe(aujourdhui), 16),
  };
  const calendriersDemain = await avecContexteApplicatif(
    contexte,
    async (tx) => {
      const cache: CacheCalendrierAgence = new Map();
      const calendriers = await Promise.all(
        cadre.detaillees.map(({ agence }) =>
          chargerCalendrierAgence(
            tx,
            {
              societeId: contexte.societeId as string,
              agenceId: agence.id,
              fenetre: fenetreDemain,
            },
            cache,
          ),
        ),
      );
      return calendriers.filter(
        (calendrier): calendrier is Calendrier => calendrier !== null,
      );
    },
  );
  const demain = prochainJourOuvert(calendriersDemain, fenetreDemain.du);

  const [
    { pretes: pretesDemain, laissees: laisseesDemain },
    { pretes: pretesToutes, laissees: laisseesToutes },
  ] = await Promise.all([
    listerPlanifieesATransmettre(contexte, { jour: demain }),
    listerPlanifieesATransmettre(contexte, { aPartirDe: debutDuJourSociete }),
  ]);
  const annuaireTransmettreDemain = await avecContexteApplicatif(
    contexte,
    (tx) =>
      annuaireDesPersonnes(
        tx,
        pretesDemain.map((ligne) => ligne.technicienId),
      ),
  );
  const groupesTransmettreDemain: GroupeTechnicienATransmettre[] = (() => {
    const parTechnicien = new Map<string, InterventionPreteAffichee[]>();
    for (const ligne of pretesDemain) {
      const fuseauAgence = fuseauParAgence.get(ligne.agenceId) ?? cadre.fuseau;
      const liste = parTechnicien.get(ligne.technicienId) ?? [];
      liste.push({
        id: ligne.id,
        reference: referenceAffichee(ligne),
        heure: creneauDeLaCarte(
          { creneau_debut: ligne.creneauDebut, creneau_fin: null },
          fuseauAgence,
        ),
        client: ligne.client.raison_sociale,
        site: siteDeLaCarte(ligne.site),
      });
      parTechnicien.set(ligne.technicienId, liste);
    }
    return [...parTechnicien.entries()].map(
      ([technicienId, interventions]) => ({
        technicienId,
        technicienNom: quiTravaille(technicienId, annuaireTransmettreDemain),
        interventions,
      }),
    );
  })();

  function laisseesAffichees(
    laissees: readonly LigneLaisseeATransmettre[],
  ): LigneLaisseeAffichee[] {
    return laissees.map((ligne) => ({
      id: ligne.id,
      reference: referenceAffichee(ligne),
      client: ligne.client.raison_sociale,
      site: siteDeLaCarte(ligne.site),
      motifsLibelles: ligne.motifs.map(libelleMotifNonTransmissible),
    }));
  }

  const fenetreEnJours = cadre.fenetreEnJours;
  const fenetre = {
    du: instantDuJour(fenetreEnJours.du),
    au: instantDuJour(fenetreEnJours.au),
  };

  const lignes = await listerPlanning(
    contexte,
    fenetre.du,
    fenetre.au,
    undefined,
    { inclureAnnulees: afficherAnnulees },
  );
  // ── LA POPULATION À NOMMER EST CELLE DES COLONNES, PAS CELLE DES LIGNES ──
  //
  // Elle ne venait que des interventions, et la vue jour tire ses colonnes du
  // RÉFÉRENTIEL depuis le 12/09 : *un technicien sans intervention dans la
  // fenêtre n'était jamais soumis à la résolution*, et sa colonne — celle-là
  // même que le 12/09 lui avait rendue — portait un fragment d'identifiant.
  // `personnesANommer` fait l'UNION, une fois, pour les deux vues.
  //
  // ── LE PANNEAU DE CHARGE ET LA VUE LISENT LE MÊME JEU ───────────────────
  //
  // Ils ne le lisaient pas. Le panneau recevait la liste BRUTE, la grille une
  // liste filtrée — si bien qu'il comptait la FILE D'ATTENTE (`date_planifiee`
  // nulle, que `listerPlanning` ramène exprès), et, en vue jour, les six jours
  // de la semaine. *Deux chiffres côte à côte, calculés sur deux populations,
  // et rien ne disait lequel croire* (§9, 01/09).
  //
  // **LA RÈGLE A QUITTÉ CE FICHIER le 12/09/2026** — `lib/interventions/
  // affichage.ts`. Filtrer une fois dans l'écran était juste et ne tenait
  // rien : la règle vivait dans une variable locale d'un composant de neuf
  // cents lignes, et le prochain consommateur pouvait recevoir autre chose
  // sans qu'aucun test ne rougisse. `tests/unit/interventions/
  // planning-un-seul-jeu.test.ts` refuse désormais qu'un consommateur reçoive
  // autre chose qu'`affichees`.
  const attente = fileDAttente(lignes);
  const affichees = lignesAffichees(lignes, vue, jourAffiche).filter(
    correspondAuxFiltres,
  );
  // DEUX LECTURES INDÉPENDANTES (lot AV-14, mesuré sur 4fead41 puis 99c2e85) :
  // `annuaire` ne dépend que de `lignes` et de `pourTechniciens` ;
  // `occupationsDuPlanning` ne dépend que d'`affichees`, dérivée de `lignes`
  // elle aussi — ni l'une ni l'autre du résultat de l'autre. Elles restaient
  // pourtant en série, un aller-retour attendu pour rien pendant que l'autre
  // courait déjà.
  //
  // ── ET LES BLOCAGES D'AGENDA DE LA FENÊTRE (PLANNING-1, RG-PLA-06) ──────
  //
  // *Mesuré le 22/09/2026* : la case d'un technicien absent se dessinait
  // comme une case libre, et RG-PLA-06 ne refusait qu'au dépôt, APRÈS la
  // tentative. L'absence est une donnée connue d'avance ; elle est lue ici,
  // sous le contexte cloisonné — la forme d'`absence` est « interne » (D94),
  // c'est la même lecture que `/absences` et que le tableau de bord —, et
  // donnée aux deux vues, qui la posent sur la case ou la colonne par
  // `absenceCouvrant`, le critère même du refus (§9, 01/09). La borne haute
  // est le DERNIER JOUR AFFICHÉ, compris : `fenetre.au` est exclusive et
  // `absencesDeLaPeriode` compare des jours civils, bornes comprises.
  // LA BORNE CIVILE DE « AUJOURD'HUI », POUR L'ONGLET « EN RETARD » DE LA
  // COLONNE « À TRAITER » (PG-C2-FILE-ONGLETS) — LA MÊME civile que
  // `debutDuJourSociete` du registre (une seule société pour toute la
  // colonne, comme `criteresVue("en_retard")`), hissée plus haut sur l'écran
  // (9CT-RETOUCHES-5) pour servir aussi « Transmettre toutes les planifiées
  // prêtes », jamais recalculée par une seconde requête.
  const [
    annuaire,
    charges,
    absences,
    donneesMateriel,
    enRetardFile,
    sansDureeFile,
    suspenduesFile,
  ] = await Promise.all([
    avecContexteApplicatif(contexte, (tx) =>
      annuaireDesPersonnes(tx, personnesANommer(lignes, pourTechniciens)),
    ),
    occupationsDuPlanning(
      contexte,
      affichees,
      vue === "jour"
        ? { du: jourAffiche, au: jourSuivant(jourAffiche) }
        : fenetreEnJours,
    ),
    absencesDeLaPeriode(
      contexte,
      fenetre.du,
      instantDuJour(fenetreEnJours.au, -1),
    ),
    // LE MATÉRIEL DES CARTES (AFFICHAGE-MATERIEL-1) — les machines des
    // interventions AFFICHÉES seulement, jamais celles de la file d'attente
    // (lue à part, `attente`) : cette lecture ne dépend que d'`affichees`,
    // comme `charges`, et ni l'une ni l'autre du résultat de l'autre.
    donneesMaterielDesMachines(
      contexte,
      affichees.flatMap((ligne) => ligne.machines.map((m) => m.machine_id)),
    ),
    // LES TROIS AUTRES ONGLETS DE LA COLONNE « À TRAITER » (PG-C2-FILE-
    // ONGLETS) — lus À PART, par des requêtes dédiées (`lib/interventions/
    // depot.ts`), jamais en élargissant `listerPlanning` : la partition
    // « file / grille » de la fenêtre reste vraie.
    interventionsEnRetard(contexte, debutDuJourSociete),
    interventionsSansDuree(contexte),
    interventionsSuspendues(contexte),
  ]);

  // ── LES TECHNICIENS DU BOUTON « POSER » (PG-B2-FENETRE-POSE) ────────────
  //
  // Le dépôt d'une carte de la file connaît le technicien de la CASE ; le
  // bouton « Poser » (clavier, téléphone) n'en connaît aucun — cette liste
  // lui sert de premier choix, et reste modifiable dans la fenêtre.
  const techniciensPourPose = cadre.techniciens
    .map((technicien) => ({
      id: technicien.utilisateur_id,
      nom: quiTravaille(technicien.utilisateur_id, annuaire),
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  // LA COLONNE ET LE PANNEAU LISENT LA MÊME MESURE (D111). `charges` vient
  // d'`affichees`, le jeu unique de `lib/interventions/affichage.ts` : la
  // colonne n'en diffère que par la BRIÈVETÉ du rendu, jamais par sa source.
  // *Deux chiffres côte à côte, calculés sur deux populations, et rien ne dit
  // lequel croire* (§9, 01/09) — c'est la faute que ce planning a déjà commise.
  //
  // ── ET LA MAILLE EST BIEN (technicien, agence), MESURÉE PLUTÔT QUE SUPPOSÉE
  //
  // D111 s'appuie sur le fait qu'*un technicien n'a qu'UNE agence de
  // rattachement*, donc jamais deux taux. C'est vrai de `technicien.agence_id`
  // — et `occupationsDuPlanning` ne rend PAS une ligne par personne : il rend
  // une ligne par **(technicien, agence de l'INTERVENTION)**. Or D112, rendu le
  // même soir, autorise expressément qu'un technicien de Ducos soit posé sur
  // une intervention de Koné.
  //
  // **Les deux décisions se contredisent le premier jour d'un renfort**, et
  // c'est un défaut à signaler, jamais une préséance à appliquer (§1). La voie
  // qui reste ouverte est de MESURER la condition de D111 au lieu de la
  // supposer : une seule ligne, le taux seul ; plusieurs, chacun NOMME son
  // agence — ce que D111 lui-même prescrit pour ce jour-là.
  const chargeParTechnicien = new Map<string, LigneOccupation[]>();
  for (const charge of charges) {
    if (charge.technicienId === null) {
      continue;
    }
    const deja = chargeParTechnicien.get(charge.technicienId) ?? [];
    deja.push(charge);
    chargeParTechnicien.set(charge.technicienId, deja);
  }

  // ── LE TECHNICIEN ACTIF SANS AUCUNE INTERVENTION CETTE SEMAINE, 0 % COMPRIS
  // (PG-C4-CHARGE) ─────────────────────────────────────────────────────────
  //
  // *Mesuré sur main le 27/09/2026 (audit I-4) : un technicien actif dont
  // aucune intervention n'est affichée cette semaine n'a NI pourcentage NI
  // ligne dans la colonne « Technicien » — `occupationsDuPlanning` regroupe
  // ses lignes par (technicien, agence) EN PARTANT DES INTERVENTIONS, et un
  // technicien sans intervention n'ouvre aucun groupe.* Ce n'est pas une
  // formule fausse : `occupationTechnicien(id, [], ouvrables, SANS_TRAJET)`
  // rend déjà 0 % pour zéro intervention (`tests/unit/interventions/
  // statistiques.test.ts`). C'est un groupe qui n'existe simplement pas.
  //
  // **CE BLOC N'EST PAS UNE SECONDE FORMULE** — territoire de ce ticket : ni
  // `lib/interventions/occupation.ts` ni `lib/interventions/statistiques.ts`.
  // Il appelle EXACTEMENT les fonctions que `occupationsDuPlanning` appelle
  // pour calculer le dénominateur d'un groupe (`chargerCalendrierDuTechnicien`,
  // son repli `chargerCalendrierAgence`, `minutesOuvrees`, `periodesBloquees`),
  // puis compose le résultat avec `occupationTechnicien`, la même fonction
  // pure — jamais une réécriture indépendante qui pourrait diverger en
  // silence (§9, 01/09). `charges` et le panneau de charge (`<Statistiques>`
  // plus bas) NE VOIENT PAS ces entrées : elles n'existent que dans CETTE
  // carte, pour la colonne compacte — le panneau reste la mesure officielle,
  // dérivée des seules interventions réelles.
  const techniciensSansCharge = cadre.techniciens.filter(
    (technicien) => !chargeParTechnicien.has(technicien.utilisateur_id),
  );
  if (techniciensSansCharge.length > 0 && contexte.societeId !== null) {
    const societeId = contexte.societeId;
    const jourMinuit = {
      du: minuit(fenetreEnJours.du),
      au: minuit(fenetreEnJours.au),
    };
    const libelleAgence = new Map(
      cadre.detaillees.map(({ agence }) => [agence.id, agence.libelle]),
    );
    await avecContexteApplicatif(contexte, async (tx) => {
      const cacheAgence: CacheCalendrierAgence = new Map();
      for (const technicien of techniciensSansCharge) {
        const calendrier =
          (await chargerCalendrierDuTechnicien(tx, {
            societeId,
            utilisateurId: technicien.utilisateur_id,
            fenetre: jourMinuit,
            cache: cacheAgence,
          })) ??
          (await chargerCalendrierAgence(
            tx,
            {
              societeId,
              agenceId: technicien.agence_id,
              fenetre: jourMinuit,
            },
            cacheAgence,
          ));
        const debut =
          calendrier === null
            ? null
            : versInstant(jourMinuit.du, calendrier.fuseau);
        const fin =
          calendrier === null
            ? null
            : versInstant(jourMinuit.au, calendrier.fuseau);
        const brut =
          calendrier === null || debut === null || fin === null
            ? 0
            : minutesOuvrees(calendrier, debut, fin);
        const absentes =
          calendrier === null || debut === null || fin === null
            ? 0
            : periodesBloquees(
                absences,
                technicien.utilisateur_id,
                { du: debut, au: fin },
                calendrier.fuseau,
              ).reduce(
                (total, periode) =>
                  total + minutesOuvrees(calendrier, periode.du, periode.au),
                0,
              );
        const ouvrables = Math.max(0, brut - absentes);
        chargeParTechnicien.set(technicien.utilisateur_id, [
          {
            technicienId: technicien.utilisateur_id,
            agenceId: technicien.agence_id,
            agenceLibelle:
              libelleAgence.get(technicien.agence_id) ?? technicien.agence_id,
            occupation: occupationTechnicien(
              technicien.utilisateur_id,
              [],
              ouvrables,
              SANS_TRAJET,
            ),
          },
        ]);
      }
    });
  }

  // ── LE CALENDRIER DE CHAQUE TECHNICIEN AFFICHÉ, POUR LA BARRE DE CHARGE DU
  // JOUR DANS CHAQUE CASE (9BJA-REPRISE-9BJ, point 4c — PG-C4-CHARGE point 2,
  // que 9BJ n'avait pas fait, hors territoire de `lib/interventions/
  // occupation.ts` et `lib/interventions/statistiques.ts`) ──────────────────
  //
  // **TOUS** les techniciens de la grille, pas seulement ceux « sans charge »
  // du bloc ci-dessus : `VueSemaine` calcule ensuite, PUREMENT et SANS
  // NOUVELLE REQUÊTE, le taux du jour de chaque case — `minutesOuvrees` est
  // une fonction pure une fois le calendrier chargé (`carte.ts`,
  // `barreChargeDuJour`). Ce bloc appelle EXACTEMENT les mêmes fonctions que
  // le bloc précédent pour charger un calendrier, jamais une troisième
  // écriture (§9, 01/09).
  const calendrierDuTechnicien = new Map<string, Calendrier | null>();
  if (contexte.societeId !== null) {
    const societeId = contexte.societeId;
    const jourMinuit = {
      du: minuit(fenetreEnJours.du),
      au: minuit(fenetreEnJours.au),
    };
    await avecContexteApplicatif(contexte, async (tx) => {
      const cacheAgence: CacheCalendrierAgence = new Map();
      for (const technicien of cadre.techniciens) {
        const calendrier =
          (await chargerCalendrierDuTechnicien(tx, {
            societeId,
            utilisateurId: technicien.utilisateur_id,
            fenetre: jourMinuit,
            cache: cacheAgence,
          })) ??
          (await chargerCalendrierAgence(
            tx,
            {
              societeId,
              agenceId: technicien.agence_id,
              fenetre: jourMinuit,
            },
            cacheAgence,
          ));
        calendrierDuTechnicien.set(technicien.utilisateur_id, calendrier);
      }
    });
  }

  // LE FUSEAU EST CELUI DE L'AGENCE, et la société n'est que le repli — c'est
  // `fuseauDeLAgence` qui décide à l'ÉCRITURE (`lib/interventions/depot.ts`),
  // et deux lectures d'un même critère divergent en silence. Une agence sans
  // fuseau propre retombe sur celui de la société, exactement comme là-bas.
  const fuseauDe = new Map(
    cadre.detaillees.map(({ agence }) => [
      agence.id,
      agence.fuseau_horaire ?? cadre.fuseau,
    ]),
  );
  const minutesDe = (instant: Date, agenceId: string) =>
    minutesDepuisMinuit(
      versLocal(instant, fuseauDe.get(agenceId) ?? cadre.fuseau),
    );

  // « EN RETARD » (PG-C1a-EN-RETARD-PLANNING) — LE JOUR CIVIL « AUJOURD'HUI »
  // PAR AGENCE, MÊME REPLI QUE `fuseauDe` : une agence sans fuseau propre
  // retombe sur celui de la société, jamais sur celui de l'appareil (I7,
  // L0-08). `enRetard` (`lib/interventions/retard.ts`) reste une fonction
  // pure ; c'est ici, et une seule fois, que « aujourd'hui » se lit.
  const aujourdhuiParAgence = new Map<string, JourLocal>(
    cadre.detaillees.map(({ agence }) => [
      agence.id,
      jourDe(maintenant(fuseauDe.get(agence.id) ?? cadre.fuseau).local),
    ]),
  );
  const enRetardDe = (ligne: Ligne): boolean =>
    enRetard(
      {
        statut: ligne.statut,
        datePlanifiee: ligne.date_planifiee,
        aDesSegments: ligne.aDesSegments,
      },
      aujourdhuiParAgence.get(ligne.agence_id) ?? jourDe(aujourdhui),
    );

  // ── LA COLONNE « À TRAITER » : ONGLETS, ZONE, RECHERCHE (PG-C2-FILE-
  // ONGLETS, MO-18) ─────────────────────────────────────────────────────────
  //
  // Le filtre « Zone » s'applique aux QUATRE onglets, AVANT le compte de
  // chacun — « les compteurs des onglets comptent ce qui est affiché »
  // (décision d'Alexis). La recherche texte, elle, ne borne que la liste
  // affichée de l'onglet ACTIF : elle affine ce qu'on regarde, elle ne
  // redéfinit pas la population d'un onglet.
  const attenteParZone = parZone(attente, zoneFile);
  const enRetardParZone = parZone(enRetardFile, zoneFile);
  const sansDureeParZone = parZone(sansDureeFile, zoneFile);
  const suspenduesParZone = parZone(suspenduesFile, zoneFile);

  const correspondALaRecherche = (ligne: {
    readonly client: { readonly raison_sociale: string };
    readonly id: string;
    readonly numero: number | null;
    readonly annee: number | null;
  }): boolean => {
    if (rechercheFile === null) {
      return true;
    }
    const cible = rechercheFile.toLocaleLowerCase("fr");
    return (
      ligne.client.raison_sociale.toLocaleLowerCase("fr").includes(cible) ||
      referenceAffichee(ligne).toLocaleLowerCase("fr").includes(cible)
    );
  };

  const cartesFile = (
    ongletFile === "en_retard"
      ? enRetardParZone
      : ongletFile === "sans_duree"
        ? sansDureeParZone
        : ongletFile === "suspendues"
          ? suspenduesParZone
          : attenteParZone
  ).filter(correspondALaRecherche);

  // ── LE TIROIR (PG-C5-TIROIR) — `?intervention=` s'ouvre sur N'IMPORTE
  // QUELLE carte du planning, quel que soit l'endroit qui l'a posé : la même
  // fonction `hrefFile` que les onglets, jamais une seconde composition d'URL
  // (§9, 01/09).
  const hrefTiroir = (id: string): string =>
    hrefFile({
      vue,
      jour: jourAffiche,
      semaine: jours[0],
      afficherAnnulees,
      onglet: ongletFile,
      zone: zoneFile,
      q: rechercheFile,
      volet,
      intervention: id,
    });
  // LE CLIC SUR UNE CASE DU MOIS OUVRE LA VUE JOUR DE CE JOUR
  // (9CI-PG-G12-DEUX-SEMAINES-MOIS, PG-D3-MOIS-CHARGE) — MÊME FONCTION
  // `hrefFile` que le tiroir juste au-dessus (§9, 01/09), filtres conservés.
  const hrefJourDepuisMois = (jour: JourLocal): string =>
    hrefFile({
      vue: "jour",
      jour,
      semaine: jours[0],
      afficherAnnulees,
      onglet: ongletFile,
      zone: zoneFile,
      q: rechercheFile,
      volet,
    });
  const interventionOuverte =
    typeof parametres.intervention === "string"
      ? parametres.intervention
      : null;
  // LE PARAMÈTRE DE PÉRIODE DE LA VUE ACTUELLE (D145) — UNE SEULE LECTURE,
  // reprise par les deux formulaires ci-dessous : `parametrePeriode` dit à la
  // fois le NOM (`jour` ou `semaine`) et la VALEUR, là où l'écran écrivait
  // jusqu'ici le même ternaire `vue === "jour" ? "jour" : "semaine"` à quatre
  // endroits (§9, 01/09).
  const periodeActuelle = parametrePeriode(vue, jourAffiche, jours[0]);

  // ── LE SOUS-TITRE AU GABARIT DE LA MAQUETTE DU 28/09 (9EH-TP-UX-PL-
  // PLANNING-1, D190) — « N techniciens · N absences », Semaine/« 2
  // semaines »/Jour. `grilleAffichee`/`journeeAffichee` sont construites ICI,
  // UNE SEULE FOIS, et reprises par `VueSemaine`/`VueJour` plus bas : les
  // recalculer là-bas aurait été une seconde lecture du même critère (§9,
  // 01/09). `absencesAffichees` filtre `absences` (déjà lue, l.862-866) sur
  // les SEULS techniciens affichés (`pourTechniciens`) — aucune lecture de
  // plus.
  const grilleAffichee =
    vue === "semaine" || vue === "deux_semaines"
      ? construireGrille(
          affichees,
          jours,
          pourGrille,
          (id) => nomSeul(id, annuaire),
          pourTechniciens,
          absences,
        )
      : null;
  const journeeAffichee =
    vue === "jour"
      ? construireJournee(
          affichees,
          jourAffiche,
          pourJournee,
          minutesDe,
          pourTechniciens,
          absences,
          (id) => nomSeul(id, annuaire),
        )
      : null;
  // LA FILE N'EST PAS UN TECHNICIEN (9F5C) — `grilleAffichee` porte toujours
  // sa ligne « Non affectées » (`technicienId: null`, `construireGrille`,
  // décision du 21/10/2026) ; `.length` la comptait comme une personne de
  // plus, « 5 techniciens » pour une équipe de 4 (revue du pilote). Même
  // filtre que la vue Jour, juste en dessous, qui l'appliquait déjà.
  const techniciensAffiches =
    grilleAffichee !== null
      ? grilleAffichee.filter((ligne) => ligne.technicienId !== null).length
      : journeeAffichee !== null
        ? journeeAffichee.colonnes.filter((c) => c.technicienId !== null).length
        : 0;
  const absencesAffichees = absences.filter((absence) =>
    pourTechniciens.some(
      (technicien) => technicien.id === absence.utilisateur_id,
    ),
  );
  // DEUX BOUTONS DANS L'EN-TÊTE (9EH-TP-UX-PL-PLANNING-1, D190) — « Transmettre
  // demain » ET « Intervention » : à 1280 px, les deux ne tiennent PAS à côté
  // du sous-titre en une ligne (mesuré : bloc titre 688,9 px + bloc actions
  // 360 px > les 968 px disponibles). `tests/e2e/planning-creer-en-haut.spec.ts`
  // exige que le bouton primaire reste SUR la même ligne que le sous-titre
  // (jamais rejeté dessous, GR17-M6) ; le sous-titre passe donc sur deux
  // lignes — PLUTÔT QU'UN BOUTON RETIRÉ (ticket) — en RÉDUISANT la largeur
  // qu'il réclame, seulement quand le second bouton est affiché.
  const deuxBoutonsEnTete = peutModifierLePlanning && pretesDemain.length > 0;

  return (
    <Page
      chemin="/planning"
      titre={t("planning.titre")}
      sousTitre={
        <span
          className={
            deuxBoutonsEnTete ? "inline-block max-w-[520px]" : undefined
          }
        >
          {vue === "jour"
            ? sousTitreJour(
                libelleJour(jourAffiche),
                techniciensAffiches,
                absencesAffichees.length,
              )
            : vue === "deux_semaines"
              ? libelleDeuxSemaines(
                  jours,
                  aujourdhui.annee,
                  techniciensAffiches,
                  absencesAffichees.length,
                )
              : vue === "mois"
                ? libelleMois(jourAffiche)
                : libelleSemaine(
                    jours,
                    aujourdhui.annee,
                    techniciensAffiches,
                    absencesAffichees.length,
                  )}
          {/*
            LA MENTION DE LA MAQUETTE (D95, 99J-PLANNING-GLISSER) — visible
            SEULEMENT là où le geste existe : la grille, à partir de `lg`
            (`hidden lg:inline`, symétrique du `lg:hidden` qui montre la liste
            lecture seule en dessous), et seulement au rôle qui détient
            `modifier_planning`. Sous `lg`, ou sans le droit, l'écran ne
            montrerait un geste qu'il refuserait ensuite en silence — D-06.

            `vue !== "mois"` (9G1-CORRECTIFS-AUDIT-URGENTS, point 5) — la vue
            Mois SE LIT, elle ne pose pas (voir le docblock de `VueMois` :
            « aucune carte, aucun `BlocPosable`, aucune `CasePosable`, aucun
            geste »). La mention s'affichait pourtant là aussi, promettant un
            geste que cette vue n'offre à aucune largeur.
          */}
          {peutModifierLePlanning && vue !== "mois" ? (
            <span
              data-mention-glisser-reaffecter
              className="ms-1 hidden lg:inline"
            >
              {t("planning.glisser_pour_reaffecter")}
            </span>
          ) : null}
        </span>
      }
      actions={
        // CACHÉ SOUS 901 PX (9EH-TP-UX-PL-PLANNING-1, décision 69/71) : la
        // paire de boutons pleine largeur rendue plus bas, en tête de
        // `children`, LA REMPLACE — jamais les deux à la fois. Même patron
        // que `OngletsTelephone`/`Onglets` (D146) : deux rendus distincts,
        // un par gabarit, plutôt qu'une seule mise en page forcée aux deux.
        <div className="max-[900px]:hidden">
          <span className="flex items-center gap-3">
            {/*
              « TRANSMETTRE DEMAIN » REMONTE DANS L'EN-TÊTE, À CÔTÉ DU BOUTON
              PRIMAIRE (9EH-TP-UX-PL-PLANNING-1, D190, gabarit de la maquette
              du 28/09) — RESTE caché à zéro (D-06) : la maquette le grise
              plutôt que de le retirer, écart gardé et nommé dans D190.
              « Transmettre toutes les planifiées prêtes » N'EST PLUS ICI : il
              se pose désormais en tête du bloc « Laissées », sous la grille
              (voir plus bas) — l'en-tête ne tient pas trois boutons à 1280 px
              (`tests/e2e/planning-creer-en-haut.spec.ts`).
            */}
            {!peutModifierLePlanning || pretesDemain.length === 0 ? null : (
              <DialogueTransmettreDemain
                libelleBouton={libelleTransmettreDemain(pretesDemain.length)}
                titre={titreDialogueTransmettreDemain(libelleJour(demain))}
                groupes={groupesTransmettreDemain}
                laissees={laisseesAffichees(laisseesDemain)}
                icone="send"
              />
            )}
            <span
              data-maquette-bloc="bouton-primaire-intervention"
              className="ml-auto"
            >
              <LienPrimaire href="/interventions/nouvelle" className="gap-2">
                <Icone nom="plus" taille={16} />
                <span aria-hidden="true">{t("creer.intervention")}</span>
                <span className="sr-only">{t("planning.creer")}</span>
              </LienPrimaire>
            </span>
          </span>
        </div>
      }
    >
      {/*
        LES DEUX BOUTONS DE L'EN-TÊTE, CÔTE À CÔTE ET PLEINE LARGEUR, SOUS
        901 PX (9EH-TP-UX-PL-PLANNING-1, décision 69 d'Alexis, précisée par
        la décision 71 du 10/10/2026 ; maquette :888-990) — `actions`
        ci-dessus, caché sous 901 px, ne peut PAS s'étirer sur toute la
        largeur de l'en-tête : `header` (`components/mise-en-page/page.tsx`,
        41 appelants, hors du territoire de ce lot) ne pose aucun
        `flex-grow` sur son bloc d'actions, et lui en poser un affecterait
        les quarante autres écrans pour un besoin propre au seul planning.
        Cette rangée vit donc dans `children`, où `<main className="flex
        flex-col …">` (même fichier) étire déjà chaque enfant sur toute la
        largeur par défaut (`align-items` non posé vaut `stretch`) — sans
        toucher une ligne de `Page`. Duplique les deux boutons plutôt que de
        les déplacer en JavaScript : même patron que `OngletsTelephone`/
        `Onglets` (D146), et `getByRole` ne voit jamais les deux à la fois,
        l'un des deux blocs étant toujours `display:none` (hors de l'arbre
        d'accessibilité) selon la largeur.
      */}
      <div className="max-[900px]:flex min-[901px]:hidden gap-3">
        {!peutModifierLePlanning || pretesDemain.length === 0 ? null : (
          // `[&>button]:w-full`, JAMAIS `[&_button]:w-full`
          // (9EWB1-FEUILLE-BASSE-375-MENU-PLUS) — un descendant élargit le
          // bouton déclencheur ET, par la même règle, CHAQUE bouton du pied
          // du `<dialog>` qu'il ouvre (`DialogueTransmettreDemain` rend les
          // deux comme des ENFANTS de ce `<span>`, le `<dialog>` restant un
          // descendant au sens CSS malgré son rendu en couche supérieure) :
          // `shrink-0` (`components/ui/button.tsx`) empêchait ces boutons de
          // rétrécir, et deux boutons à 100 % de la largeur du dialogue dans
          // un pied `justify-end` débordaient hors écran (mesuré, le premier
          // à x=-332 sur 375 px). L'enfant DIRECT reste seul visé.
          <span className="min-w-0 flex-1 [&>button]:w-full">
            <DialogueTransmettreDemain
              libelleBouton={libelleTransmettreDemain(pretesDemain.length)}
              titre={titreDialogueTransmettreDemain(libelleJour(demain))}
              groupes={groupesTransmettreDemain}
              laissees={laisseesAffichees(laisseesDemain)}
              icone="send"
            />
          </span>
        )}
        <LienPrimaire
          href="/interventions/nouvelle"
          className="min-h-11 min-w-0 flex-1 gap-2"
        >
          <Icone nom="plus" taille={16} />
          <span aria-hidden="true">{t("creer.intervention")}</span>
          <span className="sr-only">{t("planning.creer")}</span>
        </LienPrimaire>
      </div>
      {/*
        LES ONGLETS ET LE DÉPLACEMENT, EN PROPRE RANGÉE SOUS L'EN-TÊTE
        (GR17-M6, audit GR du 26/09/2026, constat M6).

        Le gabarit partagé `Page` (`components/mise-en-page/page.tsx`) ne pose
        qu'UN SEUL bloc d'actions, à côté du titre : quand ce bloc ne tient
        plus, il passe ENTIER sous le titre, bouton primaire compris —
        mesuré, ce bouton se retrouvait ainsi hors de vue en haut à droite.
        Seul `data-maquette-bloc="bouton-primaire-intervention"` reste dans
        `actions` ; la bascule Semaine/Jour et le déplacement de période
        deviennent une rangée à part, qui ne dispute plus au bouton sa place.
      */}
      <div className="flex flex-wrap items-center gap-3">
        {/*
          LES TROIS ONGLETS DU TÉLÉPHONE (PG-D4-TELEPHONE-ONGLETS, D146) —
          SOUS 900 px SEULEMENT (`max-[900px]:flex`, masqué au-dessus par
          l'absence de tout autre affichage) : ils remplacent le sélecteur de
          vue et l'ancien repli en liste de la vue Jour (C-B1). À partir de
          901 px, aucune classe ici ne change d'effet — `Onglets`, juste en
          dessous, garde sa place et son comportement exacts.
        */}
        <OngletsTelephone
          vue={vue}
          jour={jourAffiche}
          semaine={jours[0]}
          afficherAnnulees={afficherAnnulees}
          ongletFile={ongletFile}
          zoneFile={zoneFile}
          rechercheFile={rechercheFile}
          attenteParZone={attenteParZone.length}
          ongletActif={ongletActif}
          jourOuvertLePlusProche={jourOuvertLePlusProche}
        />
        <div className="max-[900px]:hidden">
          <Onglets vue={vue} jour={jourAffiche} semaine={jours[0]} />
        </div>
        <Deplacement
          vue={vue}
          jour={jourAffiche}
          semaine={jours[0]}
          aujourdhui={aujourdhui}
          jourOuvertLePlusProche={jourOuvertLePlusProche}
        />
        {/*
          « AFFICHER LES ANNULÉES » ET « PLEIN ÉCRAN », À DROITE
          (9EH-TP-UX-PL-PLANNING-1, D190, gabarit `.plan-bar` de la maquette
          du 28/09) — `ml-auto` sur ce groupe plutôt que sur chacun : un
          `margin-inline-start:auto` posé sur un item de flex multi-ligne se
          résout par LIGNE (CSS Flexbox §8.3) — le groupe reste collé à
          droite qu'il tienne seul sur la ligne du segment ou qu'il soit
          rejeté sous elle.
        */}
        <div className="ml-auto flex items-center gap-3">
          <ToggleAnnulees
            vue={vue}
            jour={jourAffiche}
            semaine={jours[0]}
            afficherAnnulees={afficherAnnulees}
          />
          {/*
            « PLEIN ÉCRAN » (PG-C3-CARTES-COLONNES, décision QG-1 du
            27/09/2026 ; étendue à Jour et « 2 semaines » par
            9G4-PLANNING-JOUR-ET-MOIS, point 4) — Semaine, Jour et « 2
            semaines » en ont besoin (c'est leur grille que la colonne
            « À planifier » resserre), jamais Mois (qui se lit, ne pose pas,
            et n'a pas cette gouttière à rendre). Le bouton reste dans la
            même rangée que le reste des commandes de période plutôt que
            d'apparaître et disparaître d'un endroit à l'autre selon la vue.
            ENTRER SOUS 901 PX EST SANS EFFET (la colonne qu'il replie est
            déjà hors de vue, `order-2 lg:order-1` ci-dessous) : masqué là,
            même discipline que `<Onglets>` juste au-dessus — MAIS EN SORTIR
            A UN EFFET À TOUTE LARGEUR (point 6, 9H4-FINITIONS-AVANT-AUDIT) :
            `{pleinEcran ? null : <aside>}` plus bas retire la colonne « À
            traiter » ENTIÈREMENT, y compris sous 901 px où l'onglet
            téléphone l'affiche à pleine largeur. `?pleinEcran=1` arrivé par
            un lien partagé ou une fenêtre réduite depuis le bureau laissait
            donc ce téléphone sans aucun bouton visible pour en sortir — seul
            `EchapPleinEcran` existait, un clavier qu'un écran tactile n'a
            pas. Le bouton ne reste masqué sous 901 px QUE pour ENTRER ;
            SORTIR reste visible à toute largeur.
          */}
          {vue === "semaine" || vue === "jour" || vue === "deux_semaines" ? (
            <div className={pleinEcran ? "" : "max-[900px]:hidden"}>
              <BasculerPleinEcran
                vue={vue}
                jour={jourAffiche}
                semaine={jours[0]}
                afficherAnnulees={afficherAnnulees}
                pleinEcran={pleinEcran}
              />
            </div>
          ) : null}
        </div>
      </div>
      {compteRenduTransmission === null ? null : (
        <p
          data-compte-rendu-transmission
          role="status"
          className="bg-app-surface border-app-bord mb-4 rounded-md border px-3.5 py-2.5 text-13 font-bold"
        >
          {compteRenduTransmission}
        </p>
      )}
      {refuseesAffichees.length === 0 ? null : (
        <div
          data-refusees-transmission
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre mb-4 rounded-md border px-3.5 py-2.5"
        >
          <p className="text-12 font-bold">
            {t("planning.transmission.refusees_titre")}
          </p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {refuseesAffichees.map((refus) => (
              <li key={refus.id} className="text-12 font-bold">
                <a href={`/interventions/${refus.id}`} className="underline">
                  {t("planning.tiroir.ouvrir_la_fiche")}
                </a>{" "}
                {texteRefusTransmission(refus.cle)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {/*
        LA BARRE DE FILTRES (PG-C6-FILTRES-AUJOURDHUI, audit du 27/09/2026
        §5 ; EN LIGNE, SANS CARTE, DEPUIS 9EH-TP-UX-PL-PLANNING-1, D190,
        gabarit `.pf` de la maquette du 28/09) — « le planning n'a AUCUN
        filtre ». Un formulaire `GET` : l'état vit dans l'URL (AT-07), et
        préserve les critères déjà posés par la colonne « À traiter »
        (onglet, zone, recherche) et par le reste de l'écran (vue, période,
        annulées, plein écran). Chaque `ListeQuiFiltre` se soumet SEULE au
        changement (`components/ui/liste-qui-filtre.tsx`) ; le bouton
        « Filtrer » reste dans le DOM, en `sr-only`, pour qui n'a pas
        JavaScript — jamais retiré.
      */}
      <form method="get" className="mb-4 flex flex-wrap items-center gap-3">
        <input type="hidden" name="vue" value={vue} />
        <input
          type="hidden"
          name={periodeActuelle.nom}
          value={cleJour(periodeActuelle.valeur)}
        />
        {afficherAnnulees ? (
          <input type="hidden" name="annulees" value="1" />
        ) : null}
        {pleinEcran ? (
          <input type="hidden" name="pleinEcran" value="1" />
        ) : null}
        {ongletFile === "a_planifier" ? null : (
          <input type="hidden" name="onglet" value={ongletFile} />
        )}
        {zoneFile === null ? null : (
          <input type="hidden" name="zone" value={zoneFile} />
        )}
        {rechercheFile === null ? null : (
          <input type="hidden" name="q" value={rechercheFile} />
        )}
        {volet === null ? null : (
          <input type="hidden" name="volet" value={volet} />
        )}
        <label className="flex items-center gap-1.5 text-12 font-bold max-[900px]:flex-col max-[900px]:items-start">
          {t("intervention.technicien")}
          <ListeQuiFiltre
            name="technicien"
            defaultValue={filtreTechnicien ?? ""}
            className="border-app-bord max-w-[160px] rounded-md border px-2 py-1 text-[12px] font-bold"
          >
            <option value="">{t("planning.filtre_tous")}</option>
            <option value="aucun">
              {t("interventions.filtre_technicien_non_affectees")}
            </option>
            {techniciensPourPose.map((technicien) => (
              <option key={technicien.id} value={technicien.id}>
                {technicien.nom}
              </option>
            ))}
          </ListeQuiFiltre>
        </label>
        <label className="flex items-center gap-1.5 text-12 font-bold max-[900px]:flex-col max-[900px]:items-start">
          {t("intervention.priorite")}
          <ListeQuiFiltre
            name="priorite"
            defaultValue={filtrePriorite ?? ""}
            className="border-app-bord max-w-[160px] rounded-md border px-2 py-1 text-[12px] font-bold"
          >
            <option value="">{t("planning.filtre_tous")}</option>
            {PRIORITES.map((priorite) => (
              <option key={priorite} value={priorite}>
                {t(`priorite.${priorite}`)}
              </option>
            ))}
          </ListeQuiFiltre>
        </label>
        <label className="flex items-center gap-1.5 text-12 font-bold max-[900px]:flex-col max-[900px]:items-start">
          {t("intervention.type")}
          <ListeQuiFiltre
            name="nature"
            defaultValue={filtreNature ?? ""}
            className="border-app-bord max-w-[160px] rounded-md border px-2 py-1 text-[12px] font-bold"
          >
            <option value="">{t("planning.filtre_tous")}</option>
            {TYPES_INTERVENTION.map((type) => (
              <option key={type} value={type}>
                {t(`type_intervention.${type}`)}
              </option>
            ))}
          </ListeQuiFiltre>
        </label>
        <label className="flex items-center gap-1.5 text-12 font-bold max-[900px]:flex-col max-[900px]:items-start">
          {t("intervention.statut")}
          <ListeQuiFiltre
            name="statut"
            defaultValue={filtreStatut ?? ""}
            className="border-app-bord max-w-[160px] rounded-md border px-2 py-1 text-[12px] font-bold"
          >
            <option value="">{t("planning.filtre_tous")}</option>
            {STATUTS_INTERVENTION.map((statut) => (
              <option key={statut} value={statut}>
                {t(`statut.${statut}`)}
              </option>
            ))}
          </ListeQuiFiltre>
        </label>
        {agencesActives.length <= 1 ? null : (
          <label className="flex items-center gap-1.5 text-12 font-bold max-[900px]:flex-col max-[900px]:items-start">
            {mot("agence")}
            <ListeQuiFiltre
              name="agence"
              defaultValue={filtreAgence ?? ""}
              className="border-app-bord max-w-[160px] rounded-md border px-2 py-1 text-[12px] font-bold"
            >
              <option value="">{t("planning.filtre_tous")}</option>
              {agencesActives.map(({ agence }) => (
                <option key={agence.id} value={agence.id}>
                  {agence.libelle}
                </option>
              ))}
            </ListeQuiFiltre>
          </label>
        )}
        <label className="flex items-center gap-1.5 text-12 font-bold max-[900px]:flex-col max-[900px]:items-start">
          {t("intervention.client")}
          <ListeQuiFiltre
            name="client"
            defaultValue={filtreClient ?? ""}
            className="border-app-bord max-w-[160px] rounded-md border px-2 py-1 text-[12px] font-bold"
          >
            <option value="">{t("planning.filtre_tous")}</option>
            {cadre.clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.raison_sociale}
              </option>
            ))}
          </ListeQuiFiltre>
        </label>
        <button type="submit" className="sr-only">
          {t("planning.filtre_appliquer")}
        </button>
        {auMoinsUnFiltreActif ? (
          <Link
            href={hrefFile({
              vue,
              jour: jourAffiche,
              semaine: jours[0],
              afficherAnnulees,
              onglet: ongletFile,
              zone: zoneFile,
              q: rechercheFile,
              volet,
            })}
            className="text-[12px] font-bold underline"
          >
            {t("planning.filtre_tout_effacer")}
          </Link>
        ) : null}
      </form>
      {/*
        LA BANNIÈRE « CALENDRIERS D'AGENCE RESPECTÉS » (D125, D128, LOT A2).

        Mesurée ABSENTE par `docs/audits/2026-09-19-ecrans.md` — le seul écart
        de ce lot que rien ne justifiait de garder. Le texte ne recopie PAS
        l'exemple figé de la maquette : la liste des jours par agence est
        COMPOSÉE depuis `pourGrille` (donc depuis `joursTravailles`), jamais
        écrite en dur — une agence dont le calendrier change n'oblige à
        modifier aucune chaîne ici (I7).
      */}
      <div
        data-maquette-bloc="banniere-calendriers"
        className="border-app-bleu-bord bg-app-bleu-fond text-app-bleu-encre mb-4 flex gap-2.5 rounded-[11px] border px-3.5 py-3 text-13 font-bold"
      >
        {/* `info` remplace le rond décoratif (9EH-TP-UX-PL-PLANNING-1, D190,
            gabarit de la maquette du 28/09) — toujours décoratif,
            `aria-hidden` porté par `Icone` elle-même. */}
        <Icone nom="info" taille={18} className="mt-0.5 shrink-0" />
        <div>
          <strong className="block">{titreCalendriers()}</strong>
          <p className="mt-0.5">{texteCalendriers(pourBanniere)}</p>
          {/*
            LES PUCES-LIENS (D190) — chacune seulement si > 0. « N en
            retard »/« N sans durée » mènent à l'onglet qui les montre, dans
            TOUTES les vues ; « N absence(s) cette semaine » ne se pose
            qu'en Semaine et Jour (R3-14 : la barre de navigation porte déjà
            « Absences », ce lien-ci n'ouvre que LA semaine affichée) —
            seulement si son compte (`absencesAffichees`, déjà lu,
            l.862-866, filtré sur les techniciens affichés) égale ce que
            `/absences` montrerait pour cette même semaine (sept jours,
            lundi à dimanche) : le planning ne lit que six jours (lundi à
            samedi), et une absence qui ne tombe QUE le dimanche romprait
            l'égalité — écart connu, nommé dans D190, jamais vérifié ici par
            une lecture de plus.
          */}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {enRetardParZone.length === 0 ? null : (
              <Link
                href={hrefFile({
                  vue,
                  jour: jourAffiche,
                  semaine: jours[0],
                  afficherAnnulees,
                  onglet: "en_retard",
                  zone: zoneFile,
                  q: rechercheFile,
                  volet,
                })}
                className="border-app-bleu-bord bg-app-surface text-app-bleu-encre rounded-full border px-2.5 py-1 text-12 font-bold"
              >
                {puceEnRetard(enRetardParZone.length)}
              </Link>
            )}
            {sansDureeParZone.length === 0 ? null : (
              <Link
                href={hrefFile({
                  vue,
                  jour: jourAffiche,
                  semaine: jours[0],
                  afficherAnnulees,
                  onglet: "sans_duree",
                  zone: zoneFile,
                  q: rechercheFile,
                  volet,
                })}
                className="border-app-bleu-bord bg-app-surface text-app-bleu-encre rounded-full border px-2.5 py-1 text-12 font-bold"
              >
                {puceSansDuree(sansDureeParZone.length)}
              </Link>
            )}
            {(vue !== "semaine" && vue !== "jour") ||
            absencesAffichees.length === 0 ? null : (
              <Link
                href={`/absences?semaine=${cleJour(
                  vue === "jour" ? lundiDeLaSemaine(jourAffiche) : jours[0],
                )}`}
                className="border-app-bleu-bord bg-app-surface text-app-bleu-encre rounded-full border px-2.5 py-1 text-12 font-bold"
              >
                {puceAbsencesSemaine(absencesAffichees.length)}
              </Link>
            )}
          </div>
        </div>
      </div>
      {/*
        ~~LES DEUX VUES NE MONTRENT PAS LA MÊME POPULATION, ET ELLES LE
        DISENT (14/09/2026)~~ — RETIRÉ LE 17/09/2026 (N-06). C'était
        présenté comme deux choix délibérés ; c'était en réalité le défaut
        le plus grave mesuré sur ce planning, parce qu'il fait DISPARAÎTRE
        un technicien : celui qu'on cherche précisément en ouvrant un
        planning est celui qui n'a rien, et la vue semaine ne lui donnait
        aucune ligne là où la vue jour lui donnait sa colonne. Les deux vues
        tirent désormais leurs lignes et leurs colonnes du MÊME référentiel
        (`pourTechniciens`), et la mention qui expliquait l'écart n'a plus
        d'écart à expliquer.
      */}
      {/*
        LE LIEN ISOLÉ « ABSENCES » AU-DESSUS DE LA GRILLE EST RETIRÉ
        (9EH-TP-UX-PL-PLANNING-1, D190) — la barre de navigation porte déjà
        `nav.absences` (R3-14 restait vrai, « un écran se rejoint par un
        LIEN » ; c'est désormais celui de la barre, plus la puce du bandeau
        ci-dessus quand une absence tombe sur la période affichée).
      */}

      <Posable
        techniciens={techniciensPourPose}
        aujourdhui={cleJour(aujourdhui)}
      >
        {/*
          LE TIROIR (PG-C5-TIROIR) — DANS `Posable`, jamais à côté : le geste
          « Déplacer… » du tiroir réutilise `BoutonPoser`, qui exige le
          contexte que `Posable` fournit. `initialInterventionId` vient de
          l'URL (`?intervention=`) : un lien partagé ouvre directement le
          tiroir, sans qu'aucun clic ne soit nécessaire.
        */}
        <Tiroir initialInterventionId={interventionOuverte} />
        {/*
          LE REFUS DE CRÉATION — ROUGE, `role="alert"`, exactement le patron
          de `Posable` (`components/planning/pose.tsx:300-324`) : un refus
          INTERROMPT, il ne se contente pas d'informer. Posé AU-DESSUS de
          l'avertissement orange, qui lui `role="status"` — les deux peuvent
          coexister sans se confondre : rouge = refus, orange = avertissement
          d'une action par ailleurs acceptée.
        */}
        {refusCreationAffiche === null ? null : (
          <p
            data-refus-creation={refusCreationAffiche}
            role="alert"
            className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre mb-4 rounded-md border px-3.5 py-2.5 text-13 font-bold"
          >
            {t(refusCreationAffiche)}
          </p>
        )}
        {avertissementsAffiches.map((cle) => (
          <p
            key={cle}
            // `role="status"` et non `alert` : *un avertissement n'interrompt
            // pas.* L'action a été acceptée ; ce qui suit est une
            // information, et l'annoncer comme une alerte apprendrait à
            // ignorer les alertes.
            data-avertissement={cle}
            role="status"
            className={`mb-4 rounded-md border px-3.5 py-2.5 text-13 font-bold ${CLASSES_TON[tonDeLAvertissement(cle)]}`}
          >
            {t(cle)}
          </p>
        ))}
        {/*
          L'ORDRE DE COLONNES SUIT LA MAQUETTE (D125, LOT A2) : `.planning-shell`
          pose la carte « À affecter » à GAUCHE de la grille, jamais à droite —
          mesuré inversé par l'audit du 19/09 (coût Moyen). Rien ne s'y oppose :
          ni une règle de gestion (D128) ni une donnée que l'inversion ferait
          disparaître, seulement une classe de grille et l'ordre du JSX.

          CET ORDRE NE VAUT QU'À DEUX COLONNES (`lg`). En dessous, la grille
          retombe à une seule colonne et suit l'ordre du DOM : y garder l'aside
          en premier ferait défiler toute la file — potentiellement sans borne
          — avant le planning sur téléphone et tablette (revue d'exploitation,
          19/09/2026). `order-2 lg:order-1` / `order-1 lg:order-2` séparent
          l'ordre VISUEL de l'ordre du DOM : le planning reste lu en premier
          par un lecteur d'écran et par un clavier, sur toutes les largeurs.
        */}
        {/*
          « PLEIN ÉCRAN » REPLIE CETTE COLONNE ENTIÈRE (PG-C3-CARTES-
          COLONNES) : `lg:grid-cols-1` rend à la grille les 290 px + la
          gouttière que la file d'attente lui prenait. `EchapPleinEcran`
          n'est monté que dans cet état — un écouteur clavier posé en
          permanence sur un écran qui ne l'utilise pas serait du travail pour
          rien.
        */}
        {pleinEcran ? (
          <EchapPleinEcran
            href={hrefSansPleinEcran(
              vue,
              jourAffiche,
              jours[0],
              afficherAnnulees,
            )}
          />
        ) : null}
        <div
          className={`grid items-start gap-4 ${pleinEcran ? "" : "lg:grid-cols-[290px_1fr]"}`}
        >
          {pleinEcran ? null : (
            <aside
              data-maquette-bloc="carte-a-affecter"
              // `min-w-0` MÊME RAISON QUE L'AUTRE COLONNE DE LA GRILLE, PLUS
              // BAS (PLANNING-2) : les cartes de la file tronquent désormais
              // client/panne/site (99X-GR8-FILE) — un span `truncate` est un
              // texte SANS RETOUR À LA LIGNE, et sans ce `min-w-0` sa longueur
              // ENTIÈRE redevient la taille minimale de cette colonne de
              // grille, qui pousse alors la page hors de l'écran (mesuré à
              // 390px : 425px de large pour un écran de 390).
              className={`order-2 min-w-0 flex flex-col gap-4 lg:order-1 ${
                ongletActif === "a_traiter" ? "" : "max-[900px]:hidden"
              }`}
            >
              <Carte titre={t("planning.a_traiter_titre")} icone="inbox">
                <div
                  role="tablist"
                  className="border-app-bord flex flex-col gap-0.5 border-b p-2"
                >
                  {/*
                    L'ONGLET « À PLANIFIER » PORTE `badge-a-affecter`, LE SEUL
                    marqueur de maquette de cette rangée (D125, D128,
                    `tests/unit/ui/lot-a2.test.ts`) — c'est le badge
                    « 4 dossiers » de `planning()`, désormais posé sur un
                    onglet plutôt que sur l'en-tête de la colonne. Écrit à
                    part du `.map()` ci-dessous : le marqueur est un attribut
                    LITTÉRAL, jamais composé, pour que le gardien de
                    composition (une lecture TEXTUELLE du fichier) le trouve.

                    ONGLETS EN LISTE VERTICALE, UN PAR LIGNE (9EH-TP-UX-PL-
                    PLANNING-2, gabarit `.aside` de la maquette du 28/09) — le
                    compteur est GRIS par défaut, ROUGE sur CET onglet SEUL
                    quand une P1 attend dans la population filtrée par zone
                    (`attenteParZone`) : c'est la seule alerte que la colonne
                    porte sans qu'il faille l'ouvrir.
                  */}
                  <Link
                    href={hrefFile({
                      vue,
                      jour: jourAffiche,
                      semaine: jours[0],
                      afficherAnnulees,
                      onglet: "a_planifier",
                      zone: zoneFile,
                      q: rechercheFile,
                      volet,
                    })}
                    role="tab"
                    aria-selected={ongletFile === "a_planifier"}
                    data-onglet-file="a_planifier"
                    className={`flex items-center justify-between gap-1.5 rounded-md px-2.5 py-1.5 text-12 font-bold ${
                      ongletFile === "a_planifier"
                        ? "bg-app-bleu-fond text-app-bleu-encre"
                        : "text-app-encre-faible"
                    }`}
                  >
                    {t("planning.a_traiter_onglet_a_planifier")}
                    <span data-maquette-bloc="badge-a-affecter">
                      <Badge
                        ton={
                          attenteParZone.some(
                            (ligne) => ligne.priorite === "p1",
                          )
                            ? "rouge"
                            : "gris"
                        }
                      >
                        {attenteParZone.length}
                      </Badge>
                    </span>
                  </Link>
                  {(
                    [
                      {
                        cle: "en_retard",
                        libelle: t("planning.a_traiter_onglet_en_retard"),
                        compte: enRetardParZone.length,
                      },
                      {
                        cle: "sans_duree",
                        libelle: t("planning.a_traiter_onglet_sans_duree"),
                        compte: sansDureeParZone.length,
                      },
                      {
                        cle: "suspendues",
                        libelle: t("planning.a_traiter_onglet_suspendues"),
                        compte: suspenduesParZone.length,
                      },
                    ] as const
                  ).map((onglet) => (
                    <Link
                      key={onglet.cle}
                      href={hrefFile({
                        vue,
                        jour: jourAffiche,
                        semaine: jours[0],
                        afficherAnnulees,
                        onglet: onglet.cle,
                        zone: zoneFile,
                        q: rechercheFile,
                        volet,
                      })}
                      role="tab"
                      aria-selected={ongletFile === onglet.cle}
                      data-onglet-file={onglet.cle}
                      className={`flex items-center justify-between gap-1.5 rounded-md px-2.5 py-1.5 text-12 font-bold ${
                        ongletFile === onglet.cle
                          ? "bg-app-bleu-fond text-app-bleu-encre"
                          : "text-app-encre-faible"
                      }`}
                    >
                      {onglet.libelle}
                      <Badge ton="gris">{onglet.compte}</Badge>
                    </Link>
                  ))}
                </div>
                {/*
                  LA NOTE D'ORDRE (9EH-TP-UX-PL-PLANNING-2, X5) — UNE SEULE
                  PHRASE, VRAIE POUR LES QUATRE ONGLETS : `fileDAttente`
                  (`À planifier`) et `ligneFileATraiter` (les trois autres)
                  trient tous par `priorite, puis cree_le` — jamais les
                  phrases de la maquette (« La plus ancienne d'abord », « Par
                  date… »), qui ne disent pas ce tri-ci. Les deux phrases
                  supplémentaires n'apparaissent que sous « À planifier » et
                  seulement si le rôle peut poser (`peutModifierLePlanning`) ;
                  la seconde, propre au bureau, dès `lg`.
                */}
                <p className="text-app-encre-faible border-app-bord border-b px-4 py-2 text-12 font-bold">
                  {t("planning.a_traiter_ordre")}
                  {ongletFile === "a_planifier" && peutModifierLePlanning ? (
                    <>
                      {" "}
                      {t("planning.a_traiter_note_poser")}
                      <span className="hidden lg:inline">
                        {" "}
                        {t("planning.a_traiter_note_glisser")}
                      </span>
                    </>
                  ) : null}
                </p>
                <form
                  method="get"
                  className="border-app-bord flex flex-col gap-2 border-b p-3"
                >
                  <input type="hidden" name="vue" value={vue} />
                  <input
                    type="hidden"
                    name={periodeActuelle.nom}
                    value={cleJour(periodeActuelle.valeur)}
                  />
                  {afficherAnnulees ? (
                    <input type="hidden" name="annulees" value="1" />
                  ) : null}
                  {ongletFile === "a_planifier" ? null : (
                    <input type="hidden" name="onglet" value={ongletFile} />
                  )}
                  {volet === null ? null : (
                    <input type="hidden" name="volet" value={volet} />
                  )}
                  {/*
                    LA RECHERCHE : LA LOUPE EST LE BOUTON D'ENVOI
                    (9EH-TP-UX-PL-PLANNING-2, gabarit `.search` de la
                    maquette) — le champ ne cherche VRAIMENT que le client et
                    la référence (`correspondALaRecherche`), jamais le site
                    ni le numéro : le texte le dit plutôt que de promettre
                    plus que la fonction ne tient.
                  */}
                  <span className="border-app-bord flex items-center gap-1.5 rounded-md border px-2 py-1">
                    <input
                      type="search"
                      name="q"
                      defaultValue={rechercheFile ?? ""}
                      aria-label={t("planning.a_traiter_recherche")}
                      placeholder={t("planning.a_traiter_recherche")}
                      className="min-w-0 flex-1 text-[12px] font-bold outline-none"
                    />
                    <button
                      type="submit"
                      aria-label={t("planning.a_traiter_filtrer")}
                      className="text-app-encre-faible shrink-0"
                    >
                      <Icone nom="search" taille={16} />
                    </button>
                  </span>
                  <label className="flex flex-col gap-1 text-12 font-bold">
                    {t("planning.a_traiter_zone_label")}
                    <ListeQuiFiltre
                      name="zone"
                      defaultValue={zoneFile ?? ""}
                      className="border-app-bord rounded-md border px-2 py-1 text-[12px] font-bold"
                    >
                      <option value="">
                        {t("planning.a_traiter_zone_toutes")}
                      </option>
                      {ZONES_GEOGRAPHIQUES.map((zone) => (
                        <option key={zone} value={zone}>
                          {t(`site.zone.${zone}`)}
                        </option>
                      ))}
                    </ListeQuiFiltre>
                  </label>
                </form>
                <div
                  data-maquette-bloc="cartes-dossier-file"
                  className="flex flex-col gap-2 p-4"
                >
                  {cartesFile.length === 0 ? (
                    <p className="text-app-encre-faible text-[12px] font-bold">
                      {t(texteVideDeLOnglet(ongletFile))}
                    </p>
                  ) : null}
                  {ongletFile === "a_planifier"
                    ? cartesFile.map((ligne) => {
                        const fuseauDeLaLigne =
                          fuseauParAgence.get(ligne.agence_id) ?? cadre.fuseau;
                        const fuseauPose = fuseauParAgence.get(ligne.agence_id);
                        const dureeMin = dureeDe(ligne);
                        const dureeAffichee =
                          dureeMin === null
                            ? null
                            : dureeCarteAffichee(dureeMin);
                        return (
                          // GLISSER DEPUIS LA FILE OUVRE `FenetrePose` (PG-B2) —
                          // la case ne donne qu'un jour et un technicien, jamais
                          // une heure sûre. Sans fuseau connu pour l'agence de
                          // l'intervention (agence sans calendrier, cas déjà
                          // dégradé ailleurs), la carte garde l'ancien
                          // comportement plutôt que d'ouvrir une fenêtre qui ne
                          // saurait pas afficher d'heure locale.
                          <BlocPosable
                            key={ligne.id}
                            interventionId={ligne.id}
                            dureeMin={dureeMin}
                            depuisFile={fuseauPose !== undefined}
                            libelle={libellePourFenetrePose(ligne)}
                            fuseau={fuseauPose ?? null}
                          >
                            {/*
                              UN SEUL CADRE, LIEN ET PIED COMPRIS
                              (9EH-TP-UX-PL-PLANNING-2, X4) — « Poser… »
                              quittait le cadre de la carte (`mt-1.5`, hors du
                              `border` du `Link`) ; il y entre désormais, dans
                              un pied partagé avec l'origine. Bord gauche 4 px
                              par priorité (`bordGaucheDeLaCarteFile`), jamais
                              la couleur `#efa81c` de la maquette (D124).
                            */}
                            <div
                              className={`border-app-bord overflow-hidden rounded-lg border border-l-[4px] ${bordGaucheDeLaCarteFile(ligne.priorite)}`}
                            >
                              <Link
                                href={hrefFile({
                                  vue,
                                  jour: jourAffiche,
                                  semaine: jours[0],
                                  afficherAnnulees,
                                  onglet: ongletFile,
                                  zone: zoneFile,
                                  q: rechercheFile,
                                  volet,
                                  intervention: ligne.id,
                                })}
                                data-tiroir-declencheur={ligne.id}
                                className="block px-3 py-2.5"
                              >
                                <span className="flex items-center gap-2 text-13 font-bold">
                                  <PucePriorite priorite={ligne.priorite} />
                                  <span className="min-w-0 flex-1 truncate">
                                    {ligne.client.raison_sociale}
                                  </span>
                                  {dureeAffichee === null ? (
                                    <Badge ton="orange">
                                      {t("planning.duree_inconnue")}
                                    </Badge>
                                  ) : (
                                    <span className="text-app-encre-faible shrink-0 text-12 font-bold">
                                      {dureeAffichee}
                                    </span>
                                  )}
                                </span>
                                <span
                                  className="text-app-encre-faible block truncate text-[12px] font-bold"
                                  title={panneOuNatureDeLaCarte(ligne)}
                                >
                                  {panneOuNatureDeLaCarte(ligne)}
                                </span>
                                <span className="text-app-encre-faible block truncate text-12 font-bold">
                                  {siteDeLaCarte(ligne.site)}
                                  {t("ponctuation.point_median")}
                                  {referenceAffichee(ligne)}
                                </span>
                                {(() => {
                                  const mention = mentionDeplanifiee(
                                    ligne,
                                    ligne.deplanifiee_absent_id === null
                                      ? ""
                                      : (nomSeul(
                                          ligne.deplanifiee_absent_id,
                                          annuaire,
                                        ) ?? "—"),
                                    fuseauDeLaLigne,
                                  );
                                  if (mention === null) return null;
                                  return (
                                    <>
                                      <span
                                        className="text-app-encre-faible block truncate text-[12px] font-bold"
                                        title={mention.titre}
                                      >
                                        {mention.titre}
                                      </span>
                                      <span
                                        className="text-app-encre-faible block truncate text-[12px] font-bold"
                                        title={mention.ancienCreneau}
                                      >
                                        {mention.ancienCreneau}
                                      </span>
                                    </>
                                  );
                                })()}
                              </Link>
                              <div className="border-app-bord flex items-center justify-between gap-2 border-t px-3 py-2">
                                <span className="text-app-encre-faible min-w-0 flex-1 truncate text-12 font-bold">
                                  {origineAffichee(
                                    ligne.cree_le,
                                    fuseauDeLaLigne,
                                    jourDe(aujourdhui),
                                  )}
                                </span>
                                {fuseauPose === undefined ? null : (
                                  <BoutonPoser
                                    interventionId={ligne.id}
                                    dureeMin={dureeMin}
                                    libelle={libellePourFenetrePose(ligne)}
                                    fuseau={fuseauPose}
                                    icone="calendar-plus"
                                  />
                                )}
                              </div>
                            </div>
                          </BlocPosable>
                        );
                      })
                    : cartesFile.map((ligne) => {
                        const fuseauDeLaLigne =
                          fuseauParAgence.get(ligne.agence_id) ?? cadre.fuseau;
                        const dureeMin = dureeDe(ligne);
                        const dureeAffichee =
                          dureeMin === null
                            ? null
                            : dureeCarteAffichee(dureeMin);
                        return (
                          <div
                            key={ligne.id}
                            className={`border-app-bord overflow-hidden rounded-lg border border-l-[4px] ${bordGaucheDeLaCarteFile(ligne.priorite)}`}
                          >
                            <Link
                              href={hrefFile({
                                vue,
                                jour: jourAffiche,
                                semaine: jours[0],
                                afficherAnnulees,
                                onglet: ongletFile,
                                zone: zoneFile,
                                q: rechercheFile,
                                volet,
                                intervention: ligne.id,
                              })}
                              data-tiroir-declencheur={ligne.id}
                              className="block px-3 py-2.5"
                            >
                              <span className="flex items-center gap-2 text-13 font-bold">
                                <PucePriorite priorite={ligne.priorite} />
                                <span className="min-w-0 flex-1 truncate">
                                  {ligne.client.raison_sociale}
                                </span>
                                {dureeAffichee === null ? (
                                  <Badge ton="orange">
                                    {t("planning.duree_inconnue")}
                                  </Badge>
                                ) : (
                                  <span className="text-app-encre-faible shrink-0 text-12 font-bold">
                                    {dureeAffichee}
                                  </span>
                                )}
                              </span>
                              <span
                                className="text-app-encre-faible block truncate text-[12px] font-bold"
                                title={panneOuNatureDeLaCarte(ligne)}
                              >
                                {panneOuNatureDeLaCarte(ligne)}
                              </span>
                              <span className="text-app-encre-faible block truncate text-12 font-bold">
                                {siteDeLaCarte(ligne.site)}
                                {t("ponctuation.point_median")}
                                {referenceAffichee(ligne)}
                              </span>
                            </Link>
                            <div className="border-app-bord flex items-center gap-2 border-t px-3 py-2">
                              <span className="text-app-encre-faible min-w-0 flex-1 truncate text-12 font-bold">
                                {origineAffichee(
                                  ligne.cree_le,
                                  fuseauDeLaLigne,
                                  jourDe(aujourdhui),
                                )}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                </div>
              </Carte>
            </aside>
          )}

          {/*
            `min-w-0` CONTRE LE DÉBORDEMENT DE TOUTE LA PAGE (PLANNING-2).

            *Mesuré le 23/09/2026 en production, 1280 × 900* :
            `document.documentElement.scrollWidth` valait 1520 pour un
            `clientWidth` de 1280 — jeudi et vendredi coupés, une barre de
            défilement sur la PAGE ENTIÈRE. Un item de grille CSS a une
            largeur minimale automatique de `auto`, c'est-à-dire le
            min-content de son contenu : celui-ci descend jusqu'à la table
            `min-w-[920px]` de `VueSemaine`, PLUS LOIN que le conteneur
            `overflow-x-auto` (l.677 ci-dessous) qui existe exprès pour
            absorber ce débordement — l'item de grille s'élargissait à la
            place de le laisser défiler. `min-w-0` REND à ce conteneur le
            travail qu'il faisait déjà pour `VueJour` (même parent, même
            piste `1fr`).
          */}
          <div
            className={`order-1 min-w-0 lg:order-2 ${
              ongletActif === "a_traiter" ? "max-[900px]:hidden" : ""
            }`}
          >
            {vue === "jour" ? (
              (() => {
                const journee = journeeAffichee!;
                return (
                  <>
                    {/*
                        LA FRISE, À PARTIR DE 901 PX (PG-D4-TELEPHONE-ONGLETS,
                        D146) — `ListeJour`, juste en dessous, prend le relais
                        sous 900 px : la même donnée (`journee`, UN SEUL appel
                        à `construireJournee`, hissé en tête de fonction pour
                        servir aussi le sous-titre, D190), deux rendus.
                      */}
                    <div className="max-[900px]:hidden">
                      <VueJour
                        journee={journee}
                        annuaire={annuaire}
                        statutRessourceDe={statutRessourceDe}
                        jourAffiche={jourAffiche}
                        donneesMateriel={donneesMateriel}
                        enRetardDe={enRetardDe}
                        hrefIntervention={hrefTiroir}
                        fuseauPour={(agenceId) =>
                          schemaFuseau.parse(
                            fuseauDe.get(agenceId) ?? cadre.fuseau,
                          )
                        }
                        peutCreerIci={peutCreerIci}
                        peutDeclarerAbsence={peutDeclarerAbsence}
                        afficherAnnulees={afficherAnnulees}
                      />
                    </div>
                    <ListeJour
                      journee={journee}
                      annuaire={annuaire}
                      statutRessourceDe={statutRessourceDe}
                      chargeDe={chargeParTechnicien}
                      donneesMateriel={donneesMateriel}
                      enRetardDe={enRetardDe}
                      hrefIntervention={hrefTiroir}
                      fuseauPour={(agenceId) =>
                        schemaFuseau.parse(
                          fuseauDe.get(agenceId) ?? cadre.fuseau,
                        )
                      }
                    />
                  </>
                );
              })()
            ) : vue === "mois" ? (
              <VueMois
                jours={jours}
                grille={construireGrille(
                  affichees,
                  jours,
                  pourGrille,
                  (id) => nomSeul(id, annuaire),
                  pourTechniciens,
                  absences,
                )}
                annuaire={annuaire}
                statutRessourceDe={statutRessourceDe}
                chargeDe={chargeParTechnicien}
                aujourdhui={aujourdhui}
                calendrierDuTechnicien={calendrierDuTechnicien}
                hrefJour={hrefJourDepuisMois}
              />
            ) : (
              <VueSemaine
                jours={jours}
                grille={grilleAffichee!}
                agences={pourGrille}
                annuaire={annuaire}
                statutRessourceDe={statutRessourceDe}
                chargeDe={chargeParTechnicien}
                fuseauPour={(agenceId) =>
                  schemaFuseau.parse(fuseauDe.get(agenceId) ?? cadre.fuseau)
                }
                donneesMateriel={donneesMateriel}
                aujourdhui={aujourdhui}
                enRetardDe={enRetardDe}
                calendrierDuTechnicien={calendrierDuTechnicien}
                hrefIntervention={hrefTiroir}
                largeurColonneJourOuvertPx={
                  vue === "deux_semaines"
                    ? LARGEUR_COLONNE_JOUR_OUVERT_DEUX_SEMAINES_PX
                    : undefined
                }
                formeCarte={vue === "deux_semaines" ? "compacte" : undefined}
                peutCreerIci={peutCreerIci}
                peutDeclarerAbsence={peutDeclarerAbsence}
                afficherAnnulees={afficherAnnulees}
              />
            )}
          </div>
        </div>

        {/*
          « TRANSMETTRE TOUTES LES PLANIFIÉES PRÊTES » SE POSE ICI, EN TÊTE
          DU BLOC « LAISSÉES » (9EH-TP-UX-PL-PLANNING-1, D190) — REVIENT sur
          sa place dans la rangée de commandes : à 1280 px, l'en-tête ne
          tenait pas trois boutons sans rejeter « Intervention » sous le
          titre (`tests/e2e/planning-creer-en-haut.spec.ts`), et la barre
          d'outils ne tenait plus sur une seule ligne avec lui. D141 voulait
          déjà les laissées « à côté du bouton » — c'est toujours le cas.

          LA LISTE NOMMÉE DES LAISSÉES (02/10/2026, point 1 ; déplacée sous la
          grille le 03/10/2026, 9CTA-REPRISE-9CT) — affichée en permanence dès
          qu'elle n'est pas vide, pas seulement après une confirmation : ces
          lignes ne sont JAMAIS écrites par ce bouton, et leur liste reste
          donc la même avant et après qu'on l'ait cliqué. SOUS la grille
          plutôt qu'au-dessus (comme posée le 02/10) : au-dessus, son volume —
          grossi par le motif `date_passee` sur la scène de démonstration —
          repoussait la légende de la vue Jour hors du cadre visible à 800 px
          de hauteur (`tests/e2e/planning-jour-en-tete.spec.ts`).
        */}
        {!peutModifierLePlanning ||
        (pretesToutes.length === 0 && laisseesToutes.length === 0) ? null : (
          <div data-laissees-transmission className="mb-4">
            <Carte
              titre={t("planning.transmission.laissees_titre")}
              compte={
                laisseesToutes.length === 0 ? undefined : laisseesToutes.length
              }
            >
              <div className="px-4 py-3">
                {pretesToutes.length === 0 ? null : (
                  <form
                    method="POST"
                    action="/api/interventions/transmettre"
                    // LE BOUTON PASSE À LA LIGNE, LE NOMBRE RESTE VISIBLE
                    // (9G4-PLANNING-JOUR-ET-MOIS, point 6) — REVIENT sur
                    // `overflow-x-auto` (9EH-TP-UX-PL-PLANNING-1) : un
                    // débordement CONTENU évitait bien celui de la PAGE
                    // entière, mais le compte (« … prêtes (14) ») restait
                    // hors cadre à 375 px tant qu'on ne défilait pas — rien
                    // n'indiquait qu'il fallait le faire. Même correction que
                    // `components/planning/transmettre-demain.tsx` (déjà
                    // corrigé) : `BoutonAvecConfirmation`
                    // (`components/ui/bouton-confirmation.tsx`, hors du
                    // territoire de ce lot) ne reçoit aucun `className`, donc
                    // `[&>button]` — JAMAIS `[&_button]`, qui mordrait aussi
                    // sur les boutons « Confirmer »/« Revenir » du dialogue
                    // qu'il ouvre (même piège que 9EWB1-FEUILLE-BASSE-375-
                    // MENU-PLUS, commenté plus haut) — vise le SEUL bouton
                    // déclencheur, enfant direct de ce `<form>`.
                    className="mb-2.5 [&>button]:max-[900px]:text-center [&>button]:max-[900px]:leading-tight [&>button]:max-[900px]:whitespace-normal [&>button]:max-[900px]:py-1"
                  >
                    <input type="hidden" name="toutes" value="1" />
                    <BoutonAvecConfirmation
                      libelle={libelleTransmettreToutesLesPlanifieesPretes(
                        pretesToutes.length,
                      )}
                      variant="outline"
                      texteConfirmation={texteConfirmationTransmettreToutes(
                        pretesToutes.length,
                        laisseesToutes.length,
                      )}
                      boutonConfirmer={t("planning.transmission.confirmer")}
                      boutonRevenir={t("planning.transmission.revenir")}
                    />
                  </form>
                )}
                {laisseesToutes.length === 0 ? null : (
                  <ul className="flex flex-col gap-1">
                    {laisseesAffichees(laisseesToutes).map((ligne) => (
                      <li
                        key={ligne.id}
                        className="text-app-encre-faible text-12 font-bold"
                      >
                        <a
                          href={`/interventions/${ligne.id}?depuis=planning`}
                          className="text-app-encre font-bold underline"
                        >
                          {ligne.reference}
                        </a>{" "}
                        {texteLigneLaissee(ligne)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Carte>
          </div>
        )}

        {/*
          LE DÉTAIL DE CHARGE SE POSE SOUS LE PLANNING (N-02, 17/09/2026).

          Il vivait dans le panneau latéral de 290 px, à côté de la file
          d'attente — un écart avec la maquette que rien n'écrivait : elle ne
          pose dans cette colonne QUE la file et les contrôles à la pose, et
          n'y montre aucun panneau de charge. Ce panneau-ci est une donnée que
          la maquette ne prévoit pas, mais l'endroit où on le pose y est
          arbitré : jamais dans la colonne étroite qui vole sa largeur à la
          grille — c'est très exactement elle que le planificateur consulte le
          plus, jours et personnes confondus.
        */}
        <div
          className={ongletActif === "a_traiter" ? "max-[900px]:hidden" : ""}
        >
          <Statistiques lignes={charges} annuaire={annuaire} />
        </div>
      </Posable>
    </Page>
  );
}

type Ligne = Awaited<ReturnType<typeof listerPlanning>>[number];

/**
 * L'URL D'UN ONGLET / D'UN FILTRE DE LA COLONNE « À TRAITER » — préserve la
 * vue, la période, les annulées, et les DEUX AUTRES critères de la colonne
 * (zone, recherche) : changer d'onglet ne doit ni changer de semaine ni
 * perdre le filtre de zone en cours, et réciproquement (MO-18).
 */
function hrefFile(params: {
  readonly vue: VuePlanning;
  readonly jour: JourLocal;
  readonly semaine: JourLocal;
  readonly afficherAnnulees: boolean;
  readonly onglet: OngletFile;
  readonly zone: ZoneGeographique | null;
  readonly q: string | null;
  /**
   * LE TIROIR (PG-C5-TIROIR) — `?intervention=` se pose ou se retire SANS
   * jamais toucher aux autres critères de cet écran : ouvrir une fiche dans
   * le tiroir ne doit ni changer de semaine, ni perdre l'onglet ou le filtre
   * de zone en cours.
   */
  readonly intervention?: string;
  /**
   * LE VOLET DU TÉLÉPHONE (PG-D4-TELEPHONE-ONGLETS, D146) — changer d'onglet
   * de la file, de zone ou de recherche ne doit pas faire quitter l'onglet
   * « À traiter » du téléphone : `hrefFile` le conserve, comme le reste.
   */
  readonly volet: "a_traiter" | null;
}): string {
  const query = new URLSearchParams();
  query.set("vue", params.vue);
  const periode = parametrePeriode(params.vue, params.jour, params.semaine);
  query.set(periode.nom, cleJour(periode.valeur));
  if (params.afficherAnnulees) {
    query.set("annulees", "1");
  }
  if (params.onglet !== "a_planifier") {
    query.set("onglet", params.onglet);
  }
  if (params.zone !== null) {
    query.set("zone", params.zone);
  }
  if (params.q !== null) {
    query.set("q", params.q);
  }
  if (params.intervention !== undefined) {
    query.set("intervention", params.intervention);
  }
  if (params.volet === "a_traiter") {
    query.set("volet", "a_traiter");
  }
  return `/planning?${query.toString()}`;
}

/**
 * LE CONTOUR D'UNE CARTE EN RETARD (PG-C1a-EN-RETARD-PLANNING) — un `outline`,
 * jamais un `border` : la couleur du statut occupe déjà `border-*`
 * (`CLASSES_BLOC`), et une seconde classe sur la MÊME propriété gagnerait ou
 * perdrait selon l'ordre de génération du CSS, pas selon l'ordre du JSX.
 * `outline` est une couche séparée, qui ne dispute donc rien à `CLASSES_BLOC`.
 * Le jeton est `app-rouge-bord`, DÉJÀ utilisé (`en_cours` dans `CLASSES_BLOC`,
 * le ton `refus` de `CLASSES_TON`) — aucune couleur neuve (CLAUDE.md §6).
 */
const CONTOUR_EN_RETARD =
  "outline outline-2 outline-dashed outline-app-rouge-bord outline-offset-1";

/**
 * L'EN-TÊTE DE LA CARTE DE LA GRILLE SEMAINE — heure DE FIN comprise
 * (PG-C3-CARTES-COLONNES, décision QG-1 du 27/09/2026, `.event` de la
 * maquette). Même forme que `enTeteDuBloc` (`../interventions/
 * presentation.ts`, toujours utilisée par la liste téléphone et la vue jour,
 * hors territoire de ce ticket) : l'heure d'abord, le client ensuite, le
 * client seul si aucune heure n'est posée — seule la SOURCE de l'heure
 * change, `creneauDeLaCarte` plutôt que `heureDuCreneau` seule.
 */
function enTeteDeLaCarteSemaine(
  ligne: {
    creneau_debut: Date | null;
    creneau_fin: Date | null;
    client: { raison_sociale: string };
  },
  fuseau: Fuseau,
): string {
  const creneau = creneauDeLaCarte(ligne, fuseau);
  return creneau === null
    ? ligne.client.raison_sociale
    : `${creneau} ${ligne.client.raison_sociale}`;
}

/**
 * LA PUCE DE PRIORITÉ — P1/P2 SEULEMENT (PG-C3-CARTES-COLONNES, décision
 * QG-1 du 27/09/2026, `.b-p1`/`.b-p2` de la maquette).
 *
 * **P3 et P4 n'ont pas de puce** : `tonDePriorite` leur donne déjà le gris
 * « rien à signaler » (GR5, audit du 26/09/2026, constat G6) — une puce grise
 * sur CHAQUE carte serait un bruit constant sur un écran qui en montre des
 * dizaines, pour ne rien dire de plus que son absence.
 *
 * Le TEXTE de la puce (`planning.priorite_puce.p1`/`.p2`) est court par
 * construction — la carte mesure 150 px, pas plus —, et `aria-label` porte la
 * même phrase que la file d'attente (`priorite.p1`/`.p2`, « P1 — critique ») :
 * un lecteur d'écran ne doit pas apprendre moins qu'un œil qui voit la
 * couleur.
 */
function PucePriorite({ priorite }: { readonly priorite: string }) {
  if (priorite !== "p1" && priorite !== "p2") {
    return null;
  }
  return (
    <span
      aria-label={t(`priorite.${priorite}`)}
      className={`shrink-0 rounded-full px-1 text-12 font-bold ${CLASSES_TON_PRIORITE[tonDePriorite(priorite)]}`}
    >
      {t(`planning.priorite_puce.${priorite}`)}
    </span>
  );
}

/**
 * LE BORD GAUCHE D'UNE CARTE DE LA FILE « À TRAITER » (9EH-TP-UX-PL-
 * PLANNING-2, `.qcard` de la maquette du 28/09) — jamais la couleur nouvelle
 * `#efa81c` de la maquette pour P2 (D124, écart nommé en D193).
 *
 * **Passe par `tonDePriorite`, jamais par la priorité directement** (GR5,
 * D144, `tests/unit/ui/priorite-une-correspondance.test.ts`) : la seule
 * correspondance `"p1"`…`"p4"` → ton vit dans `lib/theme/priorites.ts` ; ce
 * qui suit n'associe qu'un TON à une classe de bordure, jamais une priorité
 * à une couleur.
 */
const BORD_GAUCHE_PAR_TON: Record<ReturnType<typeof tonDePriorite>, string> = {
  rouge: "border-l-app-rouge-bord",
  orange: "border-l-app-orange-bord",
  gris: "border-l-app-bord",
  bleu: "border-l-app-bord",
  vert: "border-l-app-bord",
};

function bordGaucheDeLaCarteFile(priorite: string): string {
  return BORD_GAUCHE_PAR_TON[tonDePriorite(priorite)];
}

/**
 * LE SITE, LE MATÉRIEL ET LA DURÉE D'UNE CARTE (PLANNING-2 ; matériel ajouté
 * par AFFICHAGE-MATERIEL-1) — PARTAGÉS entre les trois rendus de carte (grille
 * semaine, grille jour, liste téléphone), pour que les trois ne divergent
 * jamais sur ce qu'ils disent (§9, 01/09 : deux lectures d'un même critère
 * divergent en silence).
 *
 * *Mesuré le 23/09/2026 en production : une carte se lisait « CLIENT /
 * Curatif » — ni le site, ni le matériel, ni la durée.* Le matériel est
 * TRONQUÉ avec `title` complet, exactement comme le site juste au-dessus.
 *
 * La durée ne s'affiche PAS quand elle est inconnue — `dureeCarteAffichee`
 * rend alors `null`, et rien n'est écrit : un zéro se lirait comme une
 * mesure, et l'alerte « sans durée saisie » existe déjà dans le panneau de
 * charge (`Statistiques`) — cette carte ne la duplique pas.
 *
 * **LA MENTION « EN RETARD » (PG-C1a-EN-RETARD-PLANNING, bug 8 de l'audit
 * d'ergonomie du 27/09/2026)** — en TEXTE, jamais seulement dans une couleur
 * de contour : un contour pointillé seul ne se lit pas au lecteur d'écran, ni
 * sur une capture en niveaux de gris. `enRetard` est calculé une seule fois,
 * par la page (`enRetardDe`), et transmis ici tout fait — cette fonction ne
 * lit ni la base ni l'horloge.
 */
function DetailsDeLaCarte({
  ligne,
  donneesMateriel,
  enRetard,
  masquerMateriel = false,
}: {
  readonly ligne: Ligne;
  readonly donneesMateriel: ReadonlyMap<string, DonneesMateriel>;
  readonly enRetard: boolean;
  /**
   * LA CARTE NORMALISÉE DE LA GRILLE SEMAINE (PG-C3-CARTES-COLONNES) montre
   * déjà le matériel FONDU dans sa ligne « nature · machine » — le répéter
   * ici doublerait l'information. Facultatif : les autres cartes (vue jour,
   * liste téléphone) n'y touchent pas et gardent leur ligne matériel dédiée.
   */
  readonly masquerMateriel?: boolean;
}) {
  const duree = dureeCarteAffichee(dureeDe(ligne) ?? 0);
  const materiel = materielDeLaCarte(ligne, donneesMateriel);
  return (
    <>
      <span
        className="text-app-encre-faible block truncate text-12 font-bold"
        title={siteDeLaCarte(ligne.site)}
      >
        {siteDeLaCarte(ligne.site)}
      </span>
      {masquerMateriel ? null : (
        <span
          className="text-app-encre-faible block truncate text-12 font-bold"
          title={materiel}
        >
          {materiel}
        </span>
      )}
      {duree === null ? null : (
        <span className="text-app-encre-faible block text-12 font-bold">
          {duree}
        </span>
      )}
      {enRetard ? (
        <span className="text-app-rouge-encre block text-12 font-bold">
          {t("planning.en_retard")}
        </span>
      ) : null}
    </>
  );
}

/**
 * LE NOM POUR L'AVATAR DE LA COLONNE TECHNICIEN (9EH-TP-UX-PL-PLANNING-2,
 * décision 28 du pilote) — `null` SANS technicien OU quand le nom est
 * refusé/non demandé : `initialesDuNom` rendrait sinon des initiales depuis
 * le texte de repli (« Nom non communiqué »), qui n'est pas un nom. La
 * TEINTE, elle, reste posée sur l'identifiant (`Avatar`, `identifiant`) —
 * seule l'absence de technicien la rend grise.
 */
function nomPourAvatar(
  technicienId: string | null,
  annuaire: Annuaire,
): string | null {
  if (technicienId === null) {
    return null;
  }
  const designation = annuaire(technicienId);
  return designation.etat === "nom" ? designation.nom : null;
}

/* ───────────────────────────── LA VUE SEMAINE ──────────────────────────── */

function VueSemaine({
  jours,
  grille,
  agences,
  annuaire,
  statutRessourceDe,
  chargeDe,
  fuseauPour,
  donneesMateriel,
  aujourdhui,
  enRetardDe,
  calendrierDuTechnicien,
  hrefIntervention,
  largeurColonneJourOuvertPx = LARGEUR_COLONNE_JOUR_OUVERT_PX,
  formeCarte = "normale",
  peutCreerIci = false,
  peutDeclarerAbsence = false,
  afficherAnnulees = false,
}: {
  readonly jours: readonly JourLocal[];
  readonly grille: ReturnType<typeof construireGrille<Ligne>>;
  /**
   * LES AGENCES DE LA GRILLE — pour l'EN-TÊTE de colonne (PG-A1-FERIES-
   * GRILLE, 28/09/2026) : elle seule sait si un jour est fermé par un férié
   * ou un pont alors que son jour de semaine est ordinairement travaillé.
   * Même jeu que `construireGrille(..., pourGrille, ...)`, jamais une
   * seconde lecture.
   */
  readonly agences: readonly AgenceDeGrille[];
  readonly annuaire: Annuaire;
  /** SALARIÉ OU PATENTÉ (QG-9, D163) — voir `BadgeTechnicienPatente`. */
  readonly statutRessourceDe: ReadonlyMap<string, StatutRessource | null>;
  readonly donneesMateriel: ReadonlyMap<string, DonneesMateriel>;
  /**
   * LE JOUR COURANT (82-PLANNING-6, 25/09/2026) — dans le fuseau de la
   * société, calculé UNE FOIS par la page (`aujourdhui`, `page.tsx`) : la
   * colonne du jour ne lit jamais l'heure de l'appareil (piège UTC connu,
   * L0-08).
   */
  readonly aujourdhui: JourLocal;
  /**
   * LA CHARGE DE CHAQUE PERSONNE, par identifiant (D111).
   *
   * **Elle vient du MÊME jeu que le panneau de charge** — `affichees`, et rien
   * d'autre : *deux chiffres côte à côte, calculés sur deux populations, et
   * rien ne dit lequel croire* (§9, 01/09). La colonne et le panneau lisent
   * donc la même mesure, et n'en diffèrent que par la BRIÈVETÉ du rendu.
   */
  readonly chargeDe: ReadonlyMap<string, readonly LigneOccupation[]>;
  /**
   * LE FUSEAU DE L'AGENCE DE LA LIGNE — une fonction, jamais une valeur.
   *
   * Une intervention de Koné et une de Ducos peuvent tomber dans la même
   * semaine, et *l'heure affichée est celle de l'agence, jamais celle de
   * l'appareil* (L0-08). Passer un fuseau unique ferait lire les deux sous le
   * même, ce qui est juste aujourd'hui et faux le jour d'une agence
   * métropolitaine.
   */
  readonly fuseauPour: (agenceId: string) => Fuseau;
  /** « EN RETARD » (PG-C1a-EN-RETARD-PLANNING) — voir `page.tsx`, `enRetardDe`. */
  readonly enRetardDe: (ligne: Ligne) => boolean;
  /**
   * LE CALENDRIER DE CHAQUE TECHNICIEN, POUR LA BARRE DE CHARGE DU JOUR DANS
   * CHAQUE CASE (9BJA-REPRISE-9BJ, point 4c) — `null` pour « pas de
   * calendrier connu », jamais absent de la carte : `barreChargeDuJour`
   * (`carte.ts`) le lit pour composer `minutesOuvrees` SANS NOUVELLE
   * REQUÊTE, un calendrier une fois chargé se lisant en pur.
   */
  readonly calendrierDuTechnicien: ReadonlyMap<string, Calendrier | null>;
  /** LE TIROIR (PG-C5-TIROIR) — l'URL qui ouvre une intervention SANS quitter le planning. */
  readonly hrefIntervention: (id: string) => string;
  /**
   * LA LARGEUR MINIMALE D'UNE COLONNE DE JOUR OUVERT (9CI-PG-G12-DEUX-
   * SEMAINES-MOIS, D145) — FACULTATIVE, `LARGEUR_COLONNE_JOUR_OUVERT_PX`
   * (150 px) par défaut : la Semaine ne change pas d'un pixel. La vue « 2
   * semaines » passe `LARGEUR_COLONNE_JOUR_OUVERT_DEUX_SEMAINES_PX` (118 px,
   * spécification §3.7) — douze colonnes plutôt que six.
   */
  readonly largeurColonneJourOuvertPx?: number;
  /**
   * LA FORME DE LA CARTE (9CI-PG-G12-DEUX-SEMAINES-MOIS, D145) — FACULTATIVE,
   * « normale » par défaut : la Semaine garde sa carte à trois lignes
   * (créneau complet, objet, détails). « compacte » — la vue « 2 semaines »
   * seule — réduit à UNE ligne (`enTeteDuBloc`, heure de DÉBUT + client) ; le
   * détail complet reste au tiroir et en `title` (D128 : rien n'est retiré).
   */
  readonly formeCarte?: "normale" | "compacte";
  /**
   * « + CRÉER ICI » (PG-D5-CREER-ICI) — FACULTATIF, faux par défaut : sans
   * lui, `CasePosable` ne reçoit aucun `hrefCreerIci` et reste inchangée.
   * Vrai seulement si le rôle détient `creer_demande` ET `modifier_planning`
   * (`peutCreerIci`, `page.tsx`).
   */
  readonly peutCreerIci?: boolean;
  /**
   * « DÉCLARER UNE ABSENCE » (MO-31, D136, TR-5) — FACULTATIF, faux par
   * défaut. Le SEUL geste que le ○ du technicien sur `modifier_planning`
   * ouvre (`peut`, `page.tsx`) — jamais `peutPleinement`, que la page lit par
   * ailleurs pour la réaffectation et la transmission.
   */
  readonly peutDeclarerAbsence?: boolean;
  /**
   * « ANNULÉE » DANS LA LÉGENDE (9EH-TP-UX-PL-PLANNING-2, X8, D193) —
   * FACULTATIF, faux par défaut : la légende ne la montre que lorsque la
   * page affiche elle-même les annulées (`PG-A8-ANNULEES-MASQUEES`), jamais
   * une entrée pour un statut absent de la grille qu'elle explique.
   */
  readonly afficherAnnulees?: boolean;
}) {
  // LE FÉRIÉ DE CHAQUE JOUR, UNE SEULE FOIS — lu par la largeur de la colonne
  // (`<colgroup>`, PG-C3-CARTES-COLONNES), par son en-tête (`<thead>`) et par
  // le survol de chaque case (`survol.ferie`, PG-B4) : trois lectures du même
  // critère divergeraient en silence (§9, 01/09) si l'une changeait sans les
  // autres.
  const etatsFeries = jours.map((jour) => etatFerieDuJour(agences, jour));
  const ferieParJour = new Map(
    jours.map((jour, index) => [cleJour(jour), etatsFeries[index].ferme]),
  );

  return (
    <Carte>
      {/*
        LA GRILLE NE SE COMPRIME PAS SOUS `lg` (N-02, 17/09/2026).

        Elle défilait horizontalement sur petite largeur — six colonnes
        resserrées dans une fenêtre de téléphone —, ce qui n'est pas une liste
        et n'est plus une grille lisible non plus : *cinq colonnes sur un
        téléphone n'est pas une grille.* La maquette ne dit rien du téléphone,
        elle n'a été pensée que pour un poste de travail ; en dessous de `lg`,
        c'est donc `ListeSemaine`, une liste par personne, qui prend le relais.
      */}
      {/*
        LA COLONNE DE JOUR TIENT SA LARGEUR, LA GRILLE DÉFILE PLUTÔT QUE DE
        L'ÉCRASER (PG-C3-CARTES-COLONNES, décision QG-1 du 27/09/2026 — REVIENT
        sur 82-PLANNING-6, 25/09/2026, constats 10/11).

        82-PLANNING-6 avait retiré `min-w-[920px]` pour que les six colonnes
        de jour tiennent sans défilement à 1280 et 1440 px — au prix d'une
        colonne mesurée à 79 px, une carte à 11 px de contenu utile (audit du
        27/09/2026, I-2) : illisible. QG-1 arbitre l'inverse, et c'est ce
        `etatsFeries`/`<colgroup>` qui le pose : `LARGEUR_COLONNE_JOUR_OUVERT_PX`
        (150 px) pour un jour ouvert, `LARGEUR_COLONNE_JOUR_FERME_PX` (36 px,
        rien à y montrer qu'une trame et un libellé court) pour un férié ou un
        pont. `LARGEUR_COLONNE_TECHNICIEN_PX` ne bouge pas (170 px, D95).

        `table-layout: fixed` rend le tableau à `max(largeur du conteneur,
        somme des colonnes)` (CSS 2.1, §17.5.2) : à 1280/1440 px, la somme
        dépasse le conteneur disponible et le tableau DÉBORDE de lui — c'est
        exactement ce que `CadreDefilant` (`components/ui/cadre-defilant.tsx`,
        réutilisé, jamais copié) existe pour montrer, avec son indice de
        défilement (`data-defile-droite`/`data-defile-gauche`) plutôt que
        l'ancien débordement muet que 82-PLANNING-6 avait corrigé. Sur un
        conteneur plus large que la somme (peu de jours fermés, grand écran),
        l'espace surplus se distribue sur les colonnes — les 150 px restent un
        PLANCHER, jamais un plafond.
      */}
      <div data-conteneur-tableau-semaine className="hidden lg:block">
        <CadreDefilant
          className="overflow-x-auto overflow-y-hidden"
          indice={texteIndiceDefilement(
            jours[jours.length - 1],
            // `formeCarte === "compacte"` EST la vue « 2 semaines » (seule
            // appelante, voir son docblock plus bas) — jamais une seconde
            // lecture du même critère (§9, 01/09) par un prop qui le
            // redirait.
            formeCarte === "compacte",
          )}
        >
          <table
            data-maquette-bloc="tableau-charge-semaine"
            aria-label={t("planning.titre")}
            className="w-full table-fixed border-separate border-spacing-0 text-[13px] font-bold"
          >
            <colgroup>
              {/* La largeur vient de `lib/theme/apparence.ts` : une largeur
                écrite dans un écran est une largeur par écran (D95). */}
              <col style={{ width: `${LARGEUR_COLONNE_TECHNICIEN_PX}px` }} />
              {jours.map((jour, index) => (
                <col
                  key={cleJour(jour)}
                  style={{
                    width: `${
                      etatsFeries[index].ferme
                        ? LARGEUR_COLONNE_JOUR_FERME_PX
                        : largeurColonneJourOuvertPx
                    }px`,
                  }}
                />
              ))}
            </colgroup>
            <thead>
              <tr>
                {/*
                STICKY (PLANNING-2) : la colonne « Technicien » reste visible
                pendant que la grille défile — le plancher de sécurité qu'elle
                a toujours été, exercé de nouveau depuis QG-1.
              */}
                <th className="bg-app-surface-creuse border-app-bord text-app-encre-faible sticky left-0 z-10 border-b px-3.5 py-2.5 text-left text-12 font-bold tracking-wider uppercase">
                  {t("planning.colonne_technicien")}
                </th>
                {jours.map((jour, index) => {
                  const estAuj = estAujourdHui(jour, aujourdhui);
                  const ferie = etatsFeries[index];
                  return (
                    <th
                      key={cleJour(jour)}
                      // LE JOUR COURANT (82-PLANNING-6) — `data-aujourdhui`
                      // n'existe que sur SA colonne : jamais une valeur, un
                      // repère.
                      data-aujourdhui={estAuj ? "" : undefined}
                      // LE FÉRIÉ OU LE PONT SUR UN JOUR ORDINAIREMENT TRAVAILLÉ
                      // (PG-A1-FERIES-GRILLE, bug 5 de l'audit du 27/09) —
                      // `data-jour-ferie` n'existe que sur SA colonne, même
                      // patron que `data-aujourdhui`.
                      data-jour-ferie={ferie.ferme ? "" : undefined}
                      title={ferie.libelle ?? undefined}
                      className={`border-app-bord border-b px-3.5 py-2.5 text-left text-12 font-bold tracking-wider uppercase ${
                        ferie.ferme
                          ? "trame-fermee"
                          : estAuj
                            ? "bg-app-marque/10 text-app-marque"
                            : "bg-app-surface-creuse text-app-encre-faible"
                      }`}
                    >
                      {enTeteDeJour(jour)}
                      {ferie.ferme ? (
                        <span className="block normal-case">
                          {t("planning.jour_ferie")}
                        </span>
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* LA FILE EST TOUJOURS SEMÉE (9F5C) — « vide » veut dire :
                aucune PERSONNE n'a d'intervention, jamais `grille.length
                === 0`, qui ne vaut plus puisque la file occupe seule une
                ligne. */}
              {grille.filter((ligne) => ligne.technicienId !== null).length ===
              0 ? (
                <tr>
                  <td
                    colSpan={jours.length + 1}
                    className="text-app-encre-faible px-3.5 py-6"
                  >
                    {t("planning.semaine_vide")}
                  </td>
                </tr>
              ) : null}
              {grille.map((ligne) => (
                <tr key={ligne.technicienId ?? "-"}>
                  <td className="bg-app-surface-creuse border-app-bord sticky left-0 z-[1] border-r border-b px-3.5 py-2.5 align-top text-13 font-bold">
                    {/*
                      L'AVATAR À INITIALES (9EH-TP-UX-PL-PLANNING-2, 9EC
                      réutilisé) — teinte par personne (décision 28), grise
                      sans technicien ; le nom et tout le reste de la
                      colonne restent dans leur propre bloc, inchangés.
                    */}
                    <span className="flex items-start gap-2">
                      <Avatar
                        identifiant={ligne.technicienId}
                        nom={nomPourAvatar(ligne.technicienId, annuaire)}
                      />
                      <span className="min-w-0 flex-1">
                        {quiTravaille(ligne.technicienId, annuaire)}
                        <BadgeTechnicienPatente
                          technicienId={ligne.technicienId}
                          statutRessourceDe={statutRessourceDe}
                        />
                        <span
                          data-maquette-bloc="nom-technicien-agence"
                          className="text-app-encre-faible block text-12 font-bold"
                        >
                          {ouTravaille(ligne.agences.map((a) => a.libelle))}
                        </span>
                        {/*
                        LE TAUX COMPACT (D111) : le pourcentage SEUL, sans le nom de
                        l'agence. *Un technicien n'a qu'une agence de rattachement,
                        donc jamais deux taux* — le chiffre ne peut pas être lu de
                        travers, et la colonne est trop étroite pour porter la
                        formule. Le panneau de charge, lui, la porte toujours.
                      */}
                        <TauxCompactAffiche
                          lignes={chargeDe.get(ligne.technicienId ?? "") ?? []}
                          jauge
                        />
                        {peutDeclarerAbsence && ligne.technicienId !== null ? (
                          <LienDeclarerAbsence
                            technicienId={ligne.technicienId}
                            jour={aujourdhui}
                          />
                        ) : null}
                      </span>
                    </span>
                  </td>
                  {ligne.cases.map((cellule) => (
                    <CasePosable
                      key={cleJour(cellule.jour)}
                      cible={{
                        jour: cleJour(cellule.jour),
                        technicienId: ligne.technicienId,
                        minutes: null,
                        // La vue SEMAINE n'a pas d'heure, donc pas de pas : elle
                        // déplace des jours, jamais des durées.
                        pasMinutes: 0,
                        survol: {
                          bloquee: cellule.bloquee,
                          ouverte: cellule.ouverte,
                          ferie:
                            ferieParJour.get(cleJour(cellule.jour)) ?? false,
                        },
                      }}
                      className={`border-app-bord border-r border-b p-1.5 align-top ${classeDeCase(cellule, estAujourdHui(cellule.jour, aujourdhui))}`}
                      style={{ height: "78px" }}
                      hrefCreerIci={
                        peutCreerIci &&
                        ligne.technicienId !== null &&
                        cellule.ouverte === true &&
                        !cellule.bloquee &&
                        cellule.lignes.length === 0
                          ? hrefCreerIci({
                              technicienId: ligne.technicienId,
                              jour: cellule.jour,
                              minutes: null,
                            })
                          : undefined
                      }
                    >
                      {/*
                      LE BLOCAGE D'AGENDA SE LIT DANS LA CASE, AVANT LE GESTE
                      (PLANNING-1, RG-PLA-06). La pastille est celle de
                      `/absences` — même mot, même violet (D124, D128). La
                      case reste une cible de dépôt : c'est toujours le dépôt
                      qui refuse, et la légende le dit.
                    */}
                      {cellule.bloquee ? <PastilleAgendaBloque /> : null}
                      <BarreChargeJourDeLaCase
                        technicienId={ligne.technicienId}
                        cellule={cellule}
                        calendrierDuTechnicien={calendrierDuTechnicien}
                      />
                      {cellule.lignes.map((intervention) => (
                        <BlocPosable
                          key={intervention.id}
                          interventionId={intervention.id}
                          dureeMin={dureeDe(intervention)}
                          debutMinutes={debutMinutesDe(
                            intervention,
                            fuseauPour(intervention.agence_id),
                          )}
                          avecRedimensionnement={false}
                        >
                          <Link
                            href={hrefIntervention(intervention.id)}
                            data-tiroir-declencheur={intervention.id}
                            data-maquette-bloc="bloc-intervention-case"
                            className={`mb-1 block rounded-[5px] border-l-[3px] px-1.5 py-1 text-12 font-bold leading-snug ${CLASSES_BLOC[intervention.statut]}${enRetardDe(intervention) ? ` ${CONTOUR_EN_RETARD}` : ""}`}
                            title={
                              formeCarte === "compacte"
                                ? `${enTeteDeLaCarteSemaine(
                                    intervention,
                                    fuseauPour(intervention.agence_id),
                                  )}${t("ponctuation.point_median")}${objetDuBloc(
                                    intervention,
                                  )}${t("ponctuation.point_median")}${materielDeLaCarte(
                                    intervention,
                                    donneesMateriel,
                                  )}`
                                : undefined
                            }
                          >
                            {formeCarte === "compacte" ? (
                              /*
                                LA CARTE COMPACTE (9CI-PG-G12-DEUX-SEMAINES-
                                MOIS, D145, spécification §3.7) — UNE seule
                                ligne, `enTeteDuBloc` (heure de DÉBUT + client,
                                jamais la fin) : douze colonnes à 118 px ne
                                tiennent pas la carte à trois lignes de la
                                Semaine. Rien n'est PERDU (D128) : le détail
                                complet (créneau, objet, matériel, durée, « EN
                                RETARD ») reste au `title` ci-dessus et au
                                tiroir, à un clic.
                              */
                              <span className="flex items-center justify-between gap-1">
                                <span className="min-w-0 flex-1 truncate font-bold">
                                  {enTeteDuBloc(
                                    intervention,
                                    fuseauPour(intervention.agence_id),
                                  )}
                                </span>
                                <PucePriorite
                                  priorite={intervention.priorite}
                                />
                              </span>
                            ) : (
                              // LA CARTE NORMALISÉE AU GABARIT DU 28/09
                              // (9EH-TP-UX-PL-PLANNING-2, X7 ; PRÉCÉDEMMENT
                              // PG-C3-CARTES-COLONNES, QG-1) — quatre lignes
                              // séparées (créneau, client, nature · site,
                              // matériel) plutôt que l'ancien « créneau
                              // client » fondu et « nature · machine »
                              // fondue : rendu LOCAL à `VueSemaine`,
                              // `DetailsDeLaCarte` (partagée Jour/téléphone)
                              // n'est plus appelée ici.
                              //
                              // CONTRADICTION MESURÉE ET TRANCHÉE : le corps
                              // du ticket demandait de taire la durée quand
                              // le créneau porte une fin (« l'horaire la dit
                              // déjà ») — mais la même section liste
                              // `planning-largeur-et-carte.spec.ts` parmi les
                              // épreuves qui doivent rester vertes SANS
                              // changer une attente, et cette épreuve mesure
                              // précisément une carte à créneau complet QUI
                              // affiche aussi sa durée. Entre taire une
                              // épreuve nommée et garder une redondance sans
                              // risque, la durée reste affichée chaque fois
                              // qu'elle est connue — voir la passation.
                              (() => {
                                const creneau = creneauDeLaCarte(
                                  intervention,
                                  fuseauPour(intervention.agence_id),
                                );
                                const dureeMin = dureeDe(intervention);
                                const dureeAffichee =
                                  dureeMin === null
                                    ? null
                                    : dureeCarteAffichee(dureeMin);
                                return (
                                  <>
                                    <span className="flex items-center justify-between gap-1">
                                      {creneau === null ? null : (
                                        <span className="tabular-nums font-bold">
                                          {creneau}
                                        </span>
                                      )}
                                      <PucePriorite
                                        priorite={intervention.priorite}
                                      />
                                    </span>
                                    {/* `data-ligne` : repère neutre pour les
                                    épreuves e2e, aucun style. */}
                                    <span
                                      data-ligne="client"
                                      className="line-clamp-2 font-bold break-words"
                                    >
                                      {intervention.client.raison_sociale}
                                    </span>
                                    <span
                                      className="block truncate"
                                      title={`${objetDuBloc(intervention)}${t("ponctuation.point_median")}${siteDeLaCarte(intervention.site)}`}
                                    >
                                      {objetDuBloc(intervention)}
                                      {t("ponctuation.point_median")}
                                      {siteDeLaCarte(intervention.site)}
                                    </span>
                                    <span
                                      className="block truncate"
                                      title={materielDeLaCarte(
                                        intervention,
                                        donneesMateriel,
                                      )}
                                    >
                                      {materielDeLaCarte(
                                        intervention,
                                        donneesMateriel,
                                      )}
                                    </span>
                                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                      {intervention.statut === "affectee" ? (
                                        <Badge ton="bleu">
                                          {t("planning.transmise")}
                                        </Badge>
                                      ) : null}
                                      {dureeAffichee === null ? (
                                        <Badge ton="orange">
                                          {t("planning.duree_inconnue")}
                                        </Badge>
                                      ) : (
                                        <span>{dureeAffichee}</span>
                                      )}
                                      {enRetardDe(intervention) ? (
                                        <span className="text-app-rouge-encre">
                                          {t("planning.en_retard")}
                                        </span>
                                      ) : null}
                                    </span>
                                  </>
                                );
                              })()
                            )}
                          </Link>
                        </BlocPosable>
                      ))}
                    </CasePosable>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CadreDefilant>
      </div>
      <ListeSemaine
        grille={grille}
        annuaire={annuaire}
        statutRessourceDe={statutRessourceDe}
        chargeDe={chargeDe}
        fuseauPour={fuseauPour}
        donneesMateriel={donneesMateriel}
        enRetardDe={enRetardDe}
        hrefIntervention={hrefIntervention}
      />
      <Legende afficherAnnulees={afficherAnnulees} />
    </Carte>
  );
}

/**
 * LA LISTE — la même donnée que la grille, sous `lg` (N-02, 17/09/2026).
 *
 * Une personne, une carte : son nom, ses agences, son taux, puis SES SEULS
 * jours qui portent quelque chose cette semaine. **Un jour vide n'a pas de
 * ligne** — le jour fermé compris : une trame veut dire quelque chose sur une
 * grille où chaque case existe déjà ; dans une liste qui ne montre que ce qui
 * est rempli, l'absence d'un jour dit déjà qu'il n'y a rien à y montrer, et
 * gonfler la liste avec six jours hachurés par personne serait revenir à la
 * densité qu'une liste existe pour éviter.
 *
 * **Une personne dont la semaine est VIDE n'est pas retirée de la liste** —
 * c'est très exactement N-06 : *le technicien qu'on cherche en ouvrant un
 * planning est celui qui n'a rien.* Sa carte le dit, avec le seul mot que la
 * réserve absolue autorise : `t("planning.technicien_sans_intervention")` —
 * jamais « disponible », qui affirmerait un état sur les absences et les
 * trajets que cet écran n'a pas lus.
 */
function ListeSemaine({
  grille,
  annuaire,
  statutRessourceDe,
  chargeDe,
  fuseauPour,
  donneesMateriel,
  enRetardDe,
  hrefIntervention,
}: {
  readonly grille: ReturnType<typeof construireGrille<Ligne>>;
  readonly annuaire: Annuaire;
  /** SALARIÉ OU PATENTÉ (QG-9, D163) — voir `BadgeTechnicienPatente`. */
  readonly statutRessourceDe: ReadonlyMap<string, StatutRessource | null>;
  readonly chargeDe: ReadonlyMap<string, readonly LigneOccupation[]>;
  readonly fuseauPour: (agenceId: string) => Fuseau;
  readonly donneesMateriel: ReadonlyMap<string, DonneesMateriel>;
  /** « EN RETARD » (PG-C1a-EN-RETARD-PLANNING) — voir `page.tsx`, `enRetardDe`. */
  readonly enRetardDe: (ligne: Ligne) => boolean;
  /** LE TIROIR (PG-C5-TIROIR) — l'URL qui ouvre une intervention SANS quitter le planning. */
  readonly hrefIntervention: (id: string) => string;
}) {
  // LA FILE EST TOUJOURS SEMÉE (9F5C) — même raison que `VueSemaine`
  // ci-dessus : « vide » veut dire aucune PERSONNE, jamais `grille.length
  // === 0`.
  if (grille.filter((ligne) => ligne.technicienId !== null).length === 0) {
    return (
      <p className="text-app-encre-faible border-app-bord border-t px-4 py-6 text-[13px] font-bold lg:hidden">
        {t("planning.semaine_vide")}
      </p>
    );
  }
  return (
    <>
      {/*
        LA LISTE N'A AUCUNE CASE DE DÉPÔT (mesuré et corrigé le 17/09/2026,
        revue de #221).

        La grille qu'elle remplace sous `lg` porte `CasePosable` sur chaque
        case ; cette liste ne montre que ce qui est déjà posé et n'a jamais eu
        de cible. Un bloc à la couleur d'un statut (`CLASSES_BLOC`, la même
        que la grille) invitait un utilisateur à la souris — fenêtre étroite,
        pas nécessairement tactile — à un geste que rien ici ne peut recevoir,
        en silence : la famille exacte de D-06. Le mot dit où le geste existe
        réellement, sans essayer de le recréer ici : la fiche de
        l'intervention, dont le formulaire « Déplacer » fait la même chose
        que le dépôt (`components/planning/pose.tsx`).
      */}
      <p
        data-avertissement-lecture-seule
        className="text-app-encre-faible border-app-bord border-t px-3.5 py-2 text-12 font-bold lg:hidden"
      >
        {t("planning.liste_lecture_seule")}
      </p>
      <ul className="divide-app-bord border-app-bord divide-y lg:hidden">
        {grille.map((ligne) => (
          <li key={ligne.technicienId ?? "-"} className="p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-13 font-bold">
                  {quiTravaille(ligne.technicienId, annuaire)}
                  <BadgeTechnicienPatente
                    technicienId={ligne.technicienId}
                    statutRessourceDe={statutRessourceDe}
                  />
                </p>
                <p className="text-app-encre-faible text-12 font-bold">
                  {ouTravaille(ligne.agences.map((a) => a.libelle))}
                </p>
              </div>
              <TauxCompactAffiche
                lignes={chargeDe.get(ligne.technicienId ?? "") ?? []}
              />
            </div>
            {/*
              UN JOUR BLOQUÉ A UNE LIGNE, MÊME VIDE (PLANNING-1, RG-PLA-06) :
              la liste ne montre que ce qui porte quelque chose, et un agenda
              bloqué EST quelque chose — c'est l'information qu'on cherche
              avant d'affecter. « Sans intervention » ne s'écrit donc que si
              la semaine est vide ET sans blocage.
            */}
            {ligne.total === 0 &&
            ligne.cases.every((cellule) => !cellule.bloquee) ? (
              <p className="text-app-encre-faible mt-2 text-[12px] font-bold italic">
                {t("planning.technicien_sans_intervention")}
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {ligne.cases
                  .filter(
                    (cellule) => cellule.lignes.length > 0 || cellule.bloquee,
                  )
                  .map((cellule) => (
                    <li key={cleJour(cellule.jour)}>
                      <p className="text-app-encre-faible text-12 font-bold tracking-wide uppercase">
                        {enTeteDeJour(cellule.jour)}
                      </p>
                      <div className="mt-1 flex flex-col gap-1">
                        {cellule.bloquee ? <PastilleAgendaBloque /> : null}
                        {/*
                        PAS DE `BlocPosable` ICI, ET C'EST DÉLIBÉRÉ.

                        Cette liste n'a aucune `CasePosable` pour recevoir un
                        dépôt — elle ne montre que ce qui est déjà posé,
                        jamais une cible. Un `data-bloc` en double aurait
                        rendu chaque intervention DEUX FOIS dans la page (la
                        cellule de la grille, cachée sous `lg`, ET cette
                        ligne) : *mesuré* — tout scénario qui cherche un bloc
                        par son identifiant, y compris ceux du glisser-déposer
                        déjà écrits, échoue alors en violation de mode strict
                        avant même d'atteindre son assertion.
                      */}
                        {cellule.lignes.map((intervention) => (
                          <Link
                            key={intervention.id}
                            href={hrefIntervention(intervention.id)}
                            data-tiroir-declencheur={intervention.id}
                            // `data-carte-liste`, et jamais `data-bloc` — le
                            // commentaire ci-dessus explique pourquoi cette
                            // liste ne porte pas le repère du glisser-déposer.
                            // Cette marque-ci n'en est pas une cible : elle
                            // n'identifie la carte que pour une épreuve.
                            data-carte-liste={intervention.id}
                            className={`block rounded-[5px] border-l-[3px] px-2 py-1.5 text-12 font-bold leading-snug ${CLASSES_BLOC[intervention.statut]}${enRetardDe(intervention) ? ` ${CONTOUR_EN_RETARD}` : ""}`}
                          >
                            <span
                              className="block truncate font-bold"
                              title={enTeteDuBloc(
                                intervention,
                                fuseauPour(intervention.agence_id),
                              )}
                            >
                              {enTeteDuBloc(
                                intervention,
                                fuseauPour(intervention.agence_id),
                              )}
                            </span>
                            <span
                              className="block truncate"
                              title={objetDuBloc(intervention)}
                            >
                              {objetDuBloc(intervention)}
                            </span>
                            <DetailsDeLaCarte
                              ligne={intervention}
                              donneesMateriel={donneesMateriel}
                              enRetard={enRetardDe(intervention)}
                            />
                          </Link>
                        ))}
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * LA LISTE DU JOUR, AU TÉLÉPHONE (PG-D4-TELEPHONE-ONGLETS, D146) — sous
 * 900 px seulement (masquée par la classe posée au point d'appel, `min-
 * [901px]:hidden`) : remplace l'ancien repli en liste de la vue Jour (C-B1),
 * qui n'existait plus depuis la frise (D142/9CF).
 *
 * MÊME DONNÉE que la frise — `journee`, UN SEUL appel à `construireJournee`
 * (§9, 01/09) — jamais une seconde lecture de la journée. Par technicien,
 * dans l'ordre de `journee.colonnes` (déjà trié, `comparerLignes`) : les
 * cartes « heure non fixée » en tête, puis les posées dans l'ordre des
 * heures (`colonne.blocs`, déjà trié par `blocsDeLaLigne`), puis les hors
 * grille — rien de ce que la frise montre ne manque ici (D128).
 *
 * **Aucun `<li>` par technicien** (mesuré, voir le docblock de ce fichier
 * plus haut) : `tests/e2e/planning-3.spec.ts` et
 * `tests/e2e/planning-cibles-375.spec.ts` retrouvent un technicien par
 * `page.locator("li", { has: getByText(NOM, { exact: true }) })` et
 * attendent ensuite la ligne de charge de `<Statistiques>` — un `<li>` posé
 * ici, même masqué à 1280 px, serait pris à sa place.
 *
 * **LES CARTES « POSÉES » ET « HORS GRILLE » PORTENT L'HEURE, LE CLIENT ET
 * LA NATURE (9G1-CORRECTIFS-AUDIT-URGENTS, point 2)** — leur titre était
 * `referenceAffichee(ligne)`, « Local-… » : un numéro provisoire ne dit ni
 * QUAND, ni CHEZ QUI, ni POURQUOI. `enTeteDeLaCarteSemaine` (créneau + client,
 * déjà réutilisée par `VueJour` juste au-dessus) compose l'en-tête, et
 * `objetDuBloc` (déjà réutilisé par `VueSemaine`) la nature — le site suit
 * déjà, par `DetailsDeLaCarte`. Les cartes « sans heure » ne changent pas :
 * leur en-tête dit déjà le client, et l'absence d'heure EST l'information
 * (« heure non fixée »).
 */
function ListeJour({
  journee,
  annuaire,
  statutRessourceDe,
  chargeDe,
  donneesMateriel,
  enRetardDe,
  hrefIntervention,
  fuseauPour,
}: {
  readonly journee: Journee<Ligne>;
  readonly annuaire: Annuaire;
  /** SALARIÉ OU PATENTÉ (QG-9, D163) — voir `BadgeTechnicienPatente`. */
  readonly statutRessourceDe: ReadonlyMap<string, StatutRessource | null>;
  readonly chargeDe: ReadonlyMap<string, readonly LigneOccupation[]>;
  readonly donneesMateriel: ReadonlyMap<string, DonneesMateriel>;
  /** « EN RETARD » (PG-C1a-EN-RETARD-PLANNING) — voir `page.tsx`, `enRetardDe`. */
  readonly enRetardDe: (ligne: Ligne) => boolean;
  /** LE TIROIR (PG-C5-TIROIR) — l'URL qui ouvre une intervention SANS quitter le planning. */
  readonly hrefIntervention: (id: string) => string;
  /** LE FUSEAU DE L'AGENCE DE LA LIGNE — même convention que `VueJour`, pour l'en-tête « heure + client » (point 2). */
  readonly fuseauPour: (agenceId: string) => Fuseau;
}) {
  return (
    <Carte
      data-maquette-bloc="liste-jour-telephone"
      className="min-[901px]:hidden"
    >
      <p className="text-app-encre-faible border-app-bord border-b px-3.5 py-2 text-12 font-bold">
        {t("planning.liste_lecture_seule")}
      </p>
      <div className="divide-app-bord divide-y">
        {journee.colonnes.map((colonne) => (
          <div key={colonne.technicienId ?? "-"} className="p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-13 font-bold">
                  {quiTravaille(colonne.technicienId, annuaire)}
                  <BadgeTechnicienPatente
                    technicienId={colonne.technicienId}
                    statutRessourceDe={statutRessourceDe}
                  />
                </p>
                <p className="text-app-encre-faible text-12 font-bold">
                  {ouTravaille(colonne.agences.map((a) => a.libelle))}
                </p>
              </div>
              <TauxCompactAffiche
                lignes={chargeDe.get(colonne.technicienId ?? "") ?? []}
              />
            </div>
            {colonne.bloquee ? <PastilleAgendaBloque /> : null}
            {colonne.aCaler.nombre > 0 ? (
              <PastilleACaler nombre={colonne.aCaler.nombre} />
            ) : null}
            {colonne.sansHeure.length === 0 &&
            colonne.blocs.length === 0 &&
            colonne.horsGrille.length === 0 ? (
              colonne.bloquee ? null : (
                <p className="text-app-encre-faible mt-2 text-12 font-bold italic">
                  {t("planning.jour_liste_sans_intervention")}
                </p>
              )
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                {colonne.sansHeure.map((ligne) => (
                  <Link
                    key={ligne.id}
                    href={hrefIntervention(ligne.id)}
                    data-tiroir-declencheur={ligne.id}
                    data-carte-liste={ligne.id}
                    className={`block rounded-[5px] border-l-[3px] px-2 py-1.5 text-12 font-bold leading-snug ${CLASSES_BLOC[ligne.statut]}${enRetardDe(ligne) ? ` ${CONTOUR_EN_RETARD}` : ""}`}
                  >
                    <span className="flex items-center justify-between gap-1">
                      <span className="min-w-0 flex-1 truncate font-bold">
                        {t("planning.jour_sans_heure")}
                        {t("ponctuation.point_median")}
                        {ligne.client.raison_sociale}
                      </span>
                      <PucePriorite priorite={ligne.priorite} />
                    </span>
                    <DetailsDeLaCarte
                      ligne={ligne}
                      donneesMateriel={donneesMateriel}
                      enRetard={enRetardDe(ligne)}
                    />
                  </Link>
                ))}
                {colonne.blocs.map((bloc) => (
                  <Link
                    key={bloc.ligne.id}
                    href={hrefIntervention(bloc.ligne.id)}
                    data-tiroir-declencheur={bloc.ligne.id}
                    data-carte-liste={bloc.ligne.id}
                    className={`block rounded-[5px] border-l-[3px] px-2 py-1.5 text-12 font-bold leading-snug ${CLASSES_BLOC[bloc.ligne.statut]}${enRetardDe(bloc.ligne) ? ` ${CONTOUR_EN_RETARD}` : ""}`}
                  >
                    <span className="flex items-center justify-between gap-1">
                      <span
                        className="min-w-0 flex-1 truncate font-bold"
                        title={enTeteDeLaCarteSemaine(
                          bloc.ligne,
                          fuseauPour(bloc.ligne.agence_id),
                        )}
                      >
                        {enTeteDeLaCarteSemaine(
                          bloc.ligne,
                          fuseauPour(bloc.ligne.agence_id),
                        )}
                      </span>
                      <PucePriorite priorite={bloc.ligne.priorite} />
                    </span>
                    <span
                      className="text-app-encre-faible block truncate text-12 font-bold"
                      title={objetDuBloc(bloc.ligne)}
                    >
                      {objetDuBloc(bloc.ligne)}
                    </span>
                    <DetailsDeLaCarte
                      ligne={bloc.ligne}
                      donneesMateriel={donneesMateriel}
                      enRetard={enRetardDe(bloc.ligne)}
                    />
                  </Link>
                ))}
                {colonne.horsGrille.map(({ ligne }) => (
                  <Link
                    key={ligne.id}
                    href={hrefIntervention(ligne.id)}
                    data-tiroir-declencheur={ligne.id}
                    data-carte-liste={ligne.id}
                    className={`block rounded-[5px] border-l-[3px] px-2 py-1.5 text-12 font-bold leading-snug ${CLASSES_BLOC[ligne.statut]}${enRetardDe(ligne) ? ` ${CONTOUR_EN_RETARD}` : ""}`}
                  >
                    <span className="flex items-center justify-between gap-1">
                      <span
                        className="min-w-0 flex-1 truncate font-bold"
                        title={enTeteDeLaCarteSemaine(
                          ligne,
                          fuseauPour(ligne.agence_id),
                        )}
                      >
                        {enTeteDeLaCarteSemaine(
                          ligne,
                          fuseauPour(ligne.agence_id),
                        )}
                      </span>
                      <PucePriorite priorite={ligne.priorite} />
                    </span>
                    <span
                      className="text-app-encre-faible block truncate text-12 font-bold"
                      title={objetDuBloc(ligne)}
                    >
                      {objetDuBloc(ligne)}
                    </span>
                    <DetailsDeLaCarte
                      ligne={ligne}
                      donneesMateriel={donneesMateriel}
                      enRetard={enRetardDe(ligne)}
                    />
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Carte>
  );
}

/* ────────────────────────────── LA VUE MOIS ────────────────────────────── */

/**
 * LA VUE « MOIS » (9CI-PG-G12-DEUX-SEMAINES-MOIS, PG-D3-MOIS-CHARGE, D145,
 * spécification §3.8) — elle SE LIT, elle ne pose pas : aucune carte, aucun
 * `BlocPosable`, aucune `CasePosable`, aucun geste. La case est un `Link` VERS
 * la vue Jour de ce jour ; le détail de chaque intervention se lit là, jamais
 * ici.
 *
 * Une ligne par technicien (même ordre que la Semaine et « 2 semaines »,
 * `construireGrille` inchangé), une colonne par jour du mois (28 à 31). La
 * case porte deux informations, jamais plus : le NOMBRE d'interventions (le
 * chiffre) et le TAUX de charge du jour EN TEINTE (l'opacité d'un calque de
 * couleur), par la MÊME priorité que `classeDeCase` de la Semaine — absence
 * (violet) > fermé (trame) > teinte.
 */
function VueMois({
  jours,
  grille,
  annuaire,
  statutRessourceDe,
  chargeDe,
  aujourdhui,
  calendrierDuTechnicien,
  hrefJour,
}: {
  readonly jours: readonly JourLocal[];
  readonly grille: ReturnType<typeof construireGrille<Ligne>>;
  readonly annuaire: Annuaire;
  /** SALARIÉ OU PATENTÉ (QG-9, D163) — voir `BadgeTechnicienPatente`. */
  readonly statutRessourceDe: ReadonlyMap<string, StatutRessource | null>;
  /** LA CHARGE DE CHAQUE PERSONNE SUR LE MOIS ENTIER (D111) — même source que la Semaine, `chargeParTechnicien`. */
  readonly chargeDe: ReadonlyMap<string, readonly LigneOccupation[]>;
  readonly aujourdhui: JourLocal;
  readonly calendrierDuTechnicien: ReadonlyMap<string, Calendrier | null>;
  /** LA VUE JOUR DE CE JOUR — href par `hrefFile`, filtres conservés. */
  readonly hrefJour: (jour: JourLocal) => string;
}) {
  return (
    <Carte>
      {/* `key` LIÉE AU MOIS AFFICHÉ (point 6, 9H4-FINITIONS-AVANT-AUDIT) —
          sans elle, une navigation DOUCE (lien client, jamais un rechargement
          de page) d'un mois à l'autre et retour laissait ce composant monté
          une seule fois pour toute la session : son effet (`[]`, une seule
          fois PAR MONTAGE) ne rejouait jamais au retour sur le mois
          d'aujourd'hui, qui pouvait alors rester hors cadre. La `key` force
          un nouveau montage — donc un nouveau défilement — à CHAQUE mois. */}
      <DefilerVersAujourdhuiMois key={cleJour(jours[0])} />
      <CadreDefilant
        className="overflow-x-auto overflow-y-hidden"
        indice={texteIndiceDefilementMois(jours[jours.length - 1])}
      >
        <table
          data-maquette-bloc="tableau-mois"
          aria-label={t("planning.titre")}
          className="w-full table-fixed border-separate border-spacing-0 text-13 font-bold"
        >
          <colgroup>
            <col style={{ width: `${LARGEUR_COLONNE_TECHNICIEN_PX}px` }} />
            {jours.map((jour) => (
              <col
                key={cleJour(jour)}
                style={{ width: `${LARGEUR_COLONNE_JOUR_MOIS_PX}px` }}
              />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="bg-app-surface-creuse border-app-bord text-app-encre-faible sticky left-0 z-10 border-b px-3.5 py-2.5 text-left text-12 font-bold tracking-wider uppercase">
                {t("planning.colonne_technicien")}
              </th>
              {jours.map((jour) => {
                const estAuj = estAujourdHui(jour, aujourdhui);
                const cleJourCourt = `jour.court.${jourSemaineIso(jour)}`;
                return (
                  <th
                    key={cleJour(jour)}
                    data-aujourdhui={estAuj ? "" : undefined}
                    className={`border-app-bord border-b px-0.5 py-1.5 text-center text-12 font-bold tabular-nums ${
                      estAuj
                        ? "bg-app-marque/10 text-app-marque"
                        : "bg-app-surface-creuse text-app-encre-faible"
                    }`}
                  >
                    {estCleTraduction(cleJourCourt) ? t(cleJourCourt) : ""}
                    <span className="block">{jour.jour}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {grille.map((ligne) => (
              <tr key={ligne.technicienId ?? "-"}>
                <td className="bg-app-surface-creuse border-app-bord sticky left-0 z-[1] border-r border-b px-3.5 py-2.5 align-top text-13 font-bold">
                  {quiTravaille(ligne.technicienId, annuaire)}
                  <BadgeTechnicienPatente
                    technicienId={ligne.technicienId}
                    statutRessourceDe={statutRessourceDe}
                  />
                  <span className="text-app-encre-faible block text-12 font-bold">
                    {ouTravaille(ligne.agences.map((a) => a.libelle))}
                  </span>
                  <TauxCompactAffiche
                    lignes={chargeDe.get(ligne.technicienId ?? "") ?? []}
                  />
                </td>
                {ligne.cases.map((cellule) => {
                  const occupation =
                    ligne.technicienId === null
                      ? null
                      : occupationDuJourDeLaCase(
                          ligne.technicienId,
                          cellule,
                          calendrierDuTechnicien,
                        );
                  const teinte =
                    occupation === null
                      ? null
                      : teinteDeChargeDuJour(occupation);
                  const nombre = cellule.lignes.length;
                  const ferme = cellule.ouverte === false;
                  const appliquerTeinte =
                    !cellule.bloquee && !ferme && teinte !== null;
                  return (
                    <td
                      key={cleJour(cellule.jour)}
                      className="border-app-bord border-r border-b p-0 align-top"
                    >
                      <Link
                        href={hrefJour(cellule.jour)}
                        data-mois-jour={cleJour(cellule.jour)}
                        data-mois-technicien={ligne.technicienId ?? ""}
                        title={infoBulleCaseMois(
                          quiTravaille(ligne.technicienId, annuaire),
                          cellule.jour,
                          teinte,
                          nombre,
                        )}
                        aria-label={infoBulleCaseMois(
                          quiTravaille(ligne.technicienId, annuaire),
                          cellule.jour,
                          teinte,
                          nombre,
                        )}
                        className={`relative flex h-8 items-center justify-center ${
                          cellule.bloquee
                            ? "bg-app-violet-fond"
                            : ferme
                              ? "trame-fermee"
                              : ""
                        }`}
                      >
                        {appliquerTeinte ? (
                          <span
                            aria-hidden
                            className={`absolute inset-0 ${teinte.depasse ? "bg-app-rouge-encre" : "bg-app-marque"}`}
                            style={
                              teinte.depasse
                                ? undefined
                                : { opacity: teinte.fraction }
                            }
                          />
                        ) : null}
                        {nombre > 0 ? (
                          <span className="bg-app-surface text-app-encre relative z-10 rounded px-1 text-12 font-bold tabular-nums">
                            {nombre}
                          </span>
                        ) : null}
                      </Link>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CadreDefilant>
      <LegendeMois />
    </Carte>
  );
}

/**
 * L'INFOBULLE D'UNE CASE DU MOIS — technicien, jour, taux exact (repris de
 * `teinteDeChargeDuJour`, « ≥ » déjà porté par son infobulle) et le nombre
 * d'interventions, composée HORS du JSX (L0-11).
 */
function infoBulleCaseMois(
  nomTechnicien: string,
  jour: JourLocal,
  teinte: TeinteChargeJour | null,
  nombre: number,
): string {
  const taux =
    teinte === null ? t("statistiques.taux_compact_inconnu") : teinte.infobulle;
  const compte = decompte(
    nombre,
    t("planning.mois_intervention_une"),
    t("planning.mois_interventions"),
  );
  return `${nomTechnicien} — ${enTeteDeJour(jour)}${t("ponctuation.point_median")}${taux}${t("ponctuation.point_median")}${compte}`;
}

/** LA LÉGENDE DE LA VUE MOIS — propre à cette vue, `Legende()` reste celle de la Semaine. */
const ENTREES_LEGENDE_MOIS = [
  {
    cle: "planning.legende.mois_zero",
    classes: "bg-app-surface border-app-bord",
  },
  {
    cle: "planning.legende.mois_teinte",
    classes: "bg-app-marque/50 border-app-bord",
  },
  {
    cle: "planning.legende.mois_depasse",
    classes: "bg-app-rouge-encre border-app-rouge-encre",
  },
  { cle: "planning.legende.mois_ferme", classes: "trame-fermee" },
] as const;

function LegendeMois() {
  return (
    <div className="border-app-bord text-app-encre-faible border-t px-4 py-3 text-12 font-bold">
      <ul className="flex flex-wrap items-center gap-4">
        {[...ENTREES_LEGENDE_MOIS, ENTREE_LEGENDE_AGENDA_BLOQUE].map(
          (entree) => (
            <li key={entree.cle} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={`inline-block h-3 w-3 rounded-[3px] border ${entree.classes}`}
              />
              {t(entree.cle)}
            </li>
          ),
        )}
      </ul>
      <p className="mt-1.5">{t("planning.legende.mois_note")}</p>
    </div>
  );
}

/* ────────────────────────────── LA VUE JOUR ────────────────────────────── */

/**
 * LA HAUTEUR D'UN RANG DE CHEVAUCHEMENT, EN PIXELS (QG-3/D142) — deux blocs
 * qui se chevauchent dans le temps (`BlocDeLigne.rang`) s'empilent chacun sur
 * sa propre bande de cette hauteur ; une ligne SANS chevauchement garde un
 * minimum de 64 px (specification §3.6), même si sa seule bande n'en mesure
 * que 32.
 */
const HAUTEUR_RANG_PX = 32;
const HAUTEUR_LIGNE_MIN_PX = 64;

function VueJour({
  journee,
  annuaire,
  statutRessourceDe,
  jourAffiche,
  donneesMateriel,
  enRetardDe,
  hrefIntervention,
  fuseauPour,
  peutCreerIci = false,
  peutDeclarerAbsence = false,
  afficherAnnulees = false,
}: {
  readonly journee: ReturnType<typeof construireJournee<Ligne>>;
  readonly annuaire: Annuaire;
  /** SALARIÉ OU PATENTÉ (QG-9, D163) — voir `BadgeTechnicienPatente`. */
  readonly statutRessourceDe: ReadonlyMap<string, StatutRessource | null>;
  readonly jourAffiche: JourLocal;
  readonly donneesMateriel: ReadonlyMap<string, DonneesMateriel>;
  /** « EN RETARD » (PG-C1a-EN-RETARD-PLANNING) — voir `page.tsx`, `enRetardDe`. */
  readonly enRetardDe: (ligne: Ligne) => boolean;
  /** LE TIROIR (PG-C5-TIROIR) — l'URL qui ouvre une intervention SANS quitter le planning. */
  readonly hrefIntervention: (id: string) => string;
  /** Le fuseau de l'agence D'UNE LIGNE — même repli que `VueSemaine`. */
  readonly fuseauPour: (agenceId: string) => Fuseau;
  /** « + CRÉER ICI » (PG-D5-CREER-ICI) — même discipline que `VueSemaine`. */
  readonly peutCreerIci?: boolean;
  /** « Déclarer une absence » (MO-31, D136) — même discipline que `VueSemaine`. */
  readonly peutDeclarerAbsence?: boolean;
  /**
   * « ANNULÉE » DANS LA LÉGENDE (9G4-PLANNING-JOUR-ET-MOIS, point 3) —
   * FACULTATIF, faux par défaut : même discipline que `VueSemaine`, qui la
   * transmet déjà à `Legende`.
   */
  readonly afficherAnnulees?: boolean;
}) {
  // L'ÉTAT VIDE N'AVALE PLUS CE QUI N'EST PAS DESSINABLE. Sans axe — aucune
  // agence n'a de calendrier — il n'y a pas de grille à montrer ; il peut
  // pourtant y avoir des interventions ce jour-là, et « aucune intervention
  // posée » serait alors un mensonge de plus.
  if (journee.axe.length === 0 || journee.colonnes.length === 0) {
    return (
      <Carte data-maquette-bloc="vue-jour">
        <p className="text-app-encre-faible px-4 py-6 text-[13px] font-bold">
          {t("planning.jour_vide")}
        </p>
        {/*
          SANS AXE, IL N'Y A PAS DE GRILLE — mais une intervention SANS HEURE
          n'a jamais eu besoin d'un axe pour se dessiner (AFFICHAGE-MATERIEL-1) :
          elle appartient au jour de sa colonne, pas à une heure de son axe.
        */}
        <SansHeureVide
          journee={journee}
          annuaire={annuaire}
          donneesMateriel={donneesMateriel}
          enRetardDe={enRetardDe}
          hrefIntervention={hrefIntervention}
        />
        <HorsGrille journee={journee} annuaire={annuaire} />
      </Carte>
    );
  }
  return (
    <Carte data-maquette-bloc="vue-jour">
      <p className="border-app-bord text-app-encre-faible border-b px-4 py-3 text-13 font-bold">
        {resumeEnTeteDeJournee(journee, annuaire)}
      </p>
      {/*
        LA LÉGENDE PARTAGÉE (9G4-PLANNING-JOUR-ET-MOIS, point 3) — REVIENT sur
        la liste à quatre entrées (Occupé/Libre/Hors ouverture/Absence) que ce
        bloc dessinait lui-même : « Occupé » n'y correspondait à AUCUN aplat
        réel (`classeDeCellule` ci-dessous peint « occupe » et « libre »
        IDENTIQUEMENT — la couleur vient du bloc, pas de la case), et la liste
        taisait les cinq statuts (planifiée/affectée/en cours/suspendue/
        terminée) ainsi que la puce de priorité que `Legende` explique déjà
        pour la Semaine. Une légende qui ne nomme pas les couleurs qu'elle est
        censée expliquer est fausse par omission — même défaut que §9, 01/09 :
        deux lectures d'un même critère qui divergent en silence.
      */}
      <Legende afficherAnnulees={afficherAnnulees} />
      {/*
        LA LIGNE « HEURE À FIXER », EN TÊTE DE LA FRISE (AFFICHAGE-MATERIEL-1,
        23/09/2026 ; orientation QG-3/D142, 30/09/2026 ; libellé « Heure à
        fixer » depuis la décision du 30/09/2026, point 3 — D147 ; avant elle,
        « Journée — heure non fixée »).

        Techniciens en LIGNES désormais : cette section n'est plus une ligne
        du tableau des heures — elle ne pourrait plus l'être, les techniciens
        occupant eux-mêmes chaque ligne — mais un bloc à part, AU-DESSUS de la
        frise, un par technicien qui porte quelque chose à y montrer. Le
        marqueur `data-maquette-bloc="ligne-jour-sans-heure"` est INCHANGÉ
        (`SansHeureVide`, gardien `tests/unit/ui/lot-a2.test.ts`) : ce qui
        bouge est sa PLACE dans le DOM, jamais son identité.
      */}
      <SansHeureVide
        journee={journee}
        annuaire={annuaire}
        donneesMateriel={donneesMateriel}
        enRetardDe={enRetardDe}
        hrefIntervention={hrefIntervention}
        glissable={{ fuseauPour }}
      />
      <CadreDefilant
        className="overflow-x-auto overflow-y-hidden"
        indice={texteIndiceDefilementJour(journee.axe, journee.pasMinutes)}
      >
        <table
          aria-label={t("planning.titre")}
          className="w-full table-fixed border-separate border-spacing-0 text-[12px] font-bold"
        >
          <colgroup>
            <col style={{ width: "190px" }} />
            {journee.axe.map((debut) => (
              <col key={debut} style={{ width: "40px" }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="bg-app-surface-creuse border-app-bord text-app-encre-faible sticky left-0 z-10 border-b px-2 py-2.5 text-left text-12 font-bold tracking-wider uppercase">
                {t("planning.colonne_technicien")}
              </th>
              {/* GRADUATIONS AUX HEURES PLEINES (specification §3.6) — le pas
                  peut être plus fin que l'heure (30 min mesurées au semis), et
                  répéter le libellé à chaque colonne serait un bruit constant
                  sur une frise qui en compte déjà beaucoup. */}
              {journee.axe.map((debut) => (
                <th
                  key={debut}
                  className="bg-app-surface-creuse border-app-bord text-app-encre-faible border-b px-1 py-2.5 text-left text-12 font-bold"
                >
                  {debut % 60 === 0 ? enHeure(debut) : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {journee.colonnes.map((colonne) => {
              // LE RANG DE CHEVAUCHEMENT le plus haut de cette ligne décide sa
              // hauteur — voir `HAUTEUR_RANG_PX` et le docblock de `blocs`
              // (`lib/interventions/journee.ts`).
              const nombreDeRangs =
                colonne.blocs.length === 0
                  ? 1
                  : Math.max(...colonne.blocs.map((bloc) => bloc.rang)) + 1;
              const hauteurLigne = Math.max(
                HAUTEUR_LIGNE_MIN_PX,
                nombreDeRangs * HAUTEUR_RANG_PX,
              );
              // Chaque rang se partage la hauteur RÉELLE de la ligne — pas la
              // seule hauteur minimale d'un rang : une ligne SANS
              // chevauchement (`nombreDeRangs === 1`) donne ainsi toute la
              // hauteur (64 px au moins) au bloc, plutôt que 32 px perdus
              // dans un espace vide.
              const hauteurRang = hauteurLigne / nombreDeRangs;
              const blocsParColonneDebut = new Map<
                number,
                BlocDeLigne<Ligne>[]
              >();
              for (const bloc of colonne.blocs) {
                const liste = blocsParColonneDebut.get(bloc.colonneDebut);
                if (liste === undefined) {
                  blocsParColonneDebut.set(bloc.colonneDebut, [bloc]);
                } else {
                  liste.push(bloc);
                }
              }
              return (
                <tr key={colonne.technicienId ?? "-"}>
                  <th
                    scope="row"
                    style={{ height: hauteurLigne }}
                    // `z-20`, AU-DESSUS DES BLOCS DE LA FRISE (`z-10` plus
                    // bas) — point 5, 9H4-FINITIONS-AVANT-AUDIT. Un bloc
                    // d'intervention commençant tôt dans la journée reste
                    // positionné dans sa propre case (`left: 0`, relative à
                    // elle) : une fois la frise défilée vers la droite, cette
                    // case glisse sous la colonne figée, et son bloc — à
                    // `z-10` — passait AU-DESSUS d'elle (`z-[1]` avant ce
                    // point) plutôt que de disparaître dessous.
                    className="bg-app-surface-creuse border-app-bord sticky left-0 z-20 border-r border-b px-2.5 py-2 text-left align-top text-[12px] font-bold"
                  >
                    {/* L'AVATAR À INITIALES (9EH-TP-UX-PL-PLANNING-2) — même
                        patron que la colonne de la Semaine, juste au-dessus. */}
                    <span className="flex items-start gap-2">
                      <Avatar
                        identifiant={colonne.technicienId}
                        nom={nomPourAvatar(colonne.technicienId, annuaire)}
                      />
                      <span className="min-w-0 flex-1">
                        {quiTravaille(colonne.technicienId, annuaire)}
                        <BadgeTechnicienPatente
                          technicienId={colonne.technicienId}
                          statutRessourceDe={statutRessourceDe}
                        />
                        <span className="text-app-encre-faible block text-12 font-bold">
                          {ouTravaille(colonne.agences.map((a) => a.libelle))}
                        </span>
                        {/* LA LIGNE LE DIT EN TÊTE, et chaque cellule le répète
                            par son aplat : un blocage se lit sans chercher. */}
                        {colonne.bloquee ? <PastilleAgendaBloque /> : null}
                        {colonne.aCaler.nombre > 0 ? (
                          <PastilleACaler nombre={colonne.aCaler.nombre} />
                        ) : null}
                        {peutDeclarerAbsence &&
                        colonne.technicienId !== null ? (
                          <LienDeclarerAbsence
                            technicienId={colonne.technicienId}
                            jour={jourAffiche}
                          />
                        ) : null}
                      </span>
                    </span>
                  </th>
                  {journee.axe.map((debut, indexColonne) => {
                    const cellule = colonne.cellules[indexColonne];
                    const blocsIci =
                      blocsParColonneDebut.get(indexColonne) ?? [];
                    return (
                      <CasePosable
                        key={debut}
                        cible={{
                          jour: cleJour(jourAffiche),
                          technicienId: colonne.technicienId,
                          minutes: debut,
                          // Le pas vient de la VUE, réglé au plus fin des
                          // agences présentes — jamais d'une constante écrite
                          // ici.
                          pasMinutes: journee.pasMinutes,
                          survol: {
                            bloquee: cellule.etat === "bloque",
                            // La vue Jour ne distingue pas le FÉRIÉ nommé de
                            // la fermeture hebdomadaire ordinaire à l'échelle
                            // d'une HEURE (`hors_ouverture` est par créneau,
                            // jamais par jour entier) : les deux se rangent
                            // sous « agence fermée » ici, seule la vue
                            // Semaine porte le nom du férié
                            // (`lib/interventions/survol.ts`).
                            ouverte: cellule.etat !== "hors_ouverture",
                            ferie: false,
                          },
                        }}
                        etat={cellule.etat}
                        className={`border-app-bord border-r border-b p-0 align-top ${classeDeCellule(cellule.etat)}`}
                        style={{ height: hauteurLigne }}
                        hrefCreerIci={
                          peutCreerIci &&
                          colonne.technicienId !== null &&
                          cellule.etat === "libre"
                            ? hrefCreerIci({
                                technicienId: colonne.technicienId,
                                jour: jourAffiche,
                                minutes: debut,
                              })
                            : undefined
                        }
                      >
                        {/*
                          UN SEUL BLOC PAR INTERVENTION, EN LARGEUR
                          (QG-3/D142) — jamais un lien répété dans chaque
                          case couverte : `blocsDeLaLigne`
                          (`lib/interventions/journee.ts`) donne sa position
                          (`colonneDebut`) et sa largeur (`nombreDeColonnes`,
                          en nombre de colonnes de largeur égale). La case
                          RESTE la cible du dépôt — `CasePosable`
                          ci-dessus — pour CHAQUE pas qu'elle couvre : le
                          bloc ne fait que se peindre par-dessus, `position:
                          absolute` dans la case déjà positionnée
                          (`relative`, voir `CasePosable`).

                          Deux blocs qui commencent à la MÊME colonne (rangs
                          différents) se dessinent l'un sous l'autre — jamais
                          l'un SUR l'autre : c'est `rang * hauteurRang` qui
                          les sépare, chacun recevant sa PART de la hauteur
                          réelle de la ligne (`hauteurRang`), jamais un
                          gabarit fixe qui laisserait un vide quand une seule
                          ligne n'a aucun chevauchement.

                          CONTENU (9G4-PLANNING-JOUR-ET-MOIS, point 2) —
                          REVIENT sur l'ordre posé par PG-C3-CARTES-COLONNES :
                          mesuré sur la frise (colonnes de 40 px), la
                          référence « Local-… », la plus courte et donc la
                          SEULE à tenir sans troncature, se lisait comme le
                          titre de la carte — le client, fondu dans l'en-tête
                          heure et coupé dès la première poignée de
                          caractères, ne se lisait plus ; la nature n'était
                          montrée nulle part. MÊME HIÉRARCHIE QUE LA CARTE
                          NORMALE DE LA SEMAINE désormais : créneau + puce,
                          CLIENT sur sa propre ligne, nature · site fondus —
                          la référence, le matériel et la durée restent
                          disponibles (D128 : rien n'est perdu), mais au
                          `title` et au tiroir, jamais sur une ligne dédiée
                          qu'une carte de 40 à 120 px ne peut pas se payer.
                          « EN RETARD » reste du TEXTE visible, jamais
                          seulement le contour (PG-C1a-EN-RETARD-PLANNING).
                        */}
                        {blocsIci.map((bloc) => {
                          const creneau = creneauDeLaCarte(
                            bloc.ligne,
                            fuseauPour(bloc.ligne.agence_id),
                          );
                          const pm = t("ponctuation.point_median");
                          const titreComplet = [
                            enTeteDeLaCarteSemaine(
                              bloc.ligne,
                              fuseauPour(bloc.ligne.agence_id),
                            ),
                            objetDuBloc(bloc.ligne),
                            siteDeLaCarte(bloc.ligne.site),
                            materielDeLaCarte(bloc.ligne, donneesMateriel),
                            referenceAffichee(bloc.ligne),
                          ].join(pm);
                          return (
                            <div
                              key={bloc.ligne.id}
                              // `data-fin-heure` (QG-3/D142) — le bloc ne
                              // répétant plus de lien dans les cases qu'il
                              // COUVRE au-delà de la première (voir plus haut),
                              // une épreuve qui prouvait la fin d'un
                              // redimensionnement par la présence d'un lien
                              // dans la case d'arrivée ne le peut plus : cet
                              // attribut porte la fin RÉELLE (minutes locales,
                              // non bornée à l'axe — voir `BlocDeLigne`).
                              data-fin-heure={bloc.finMinutes}
                              className="absolute left-0 z-10 overflow-hidden"
                              style={{
                                top: bloc.rang * hauteurRang,
                                height: hauteurRang,
                                width: `calc(${bloc.nombreDeColonnes} * 100%)`,
                              }}
                            >
                              <BlocPosable
                                interventionId={bloc.ligne.id}
                                dureeMin={dureeDe(bloc.ligne)}
                                // Le début est celui de L'INTERVENTION, pas de
                                // la case : `blocsDeLaLigne` le porte déjà
                                // résolu (`debutMinutes`), et la poignée
                                // n'apparaît que sur CE bloc, jamais sur une
                                // case qu'il couvre sans y commencer.
                                debutMinutes={bloc.debutMinutes}
                                className="h-full"
                              >
                                <Link
                                  href={hrefIntervention(bloc.ligne.id)}
                                  data-tiroir-declencheur={bloc.ligne.id}
                                  title={titreComplet}
                                  className={`flex h-full flex-col overflow-hidden rounded-[5px] border-l-[3px] px-1.5 py-0.5 text-12 font-bold leading-tight ${CLASSES_BLOC[bloc.ligne.statut]}${enRetardDe(bloc.ligne) ? ` ${CONTOUR_EN_RETARD}` : ""}`}
                                >
                                  <span className="flex items-center justify-between gap-1">
                                    {creneau === null ? null : (
                                      <span className="truncate tabular-nums">
                                        {creneau}
                                      </span>
                                    )}
                                    <PucePriorite
                                      priorite={bloc.ligne.priorite}
                                    />
                                  </span>
                                  <span
                                    data-ligne="client"
                                    className="truncate font-bold"
                                  >
                                    {bloc.ligne.client.raison_sociale}
                                  </span>
                                  <span className="text-app-encre-faible block truncate">
                                    {objetDuBloc(bloc.ligne)}
                                    {t("ponctuation.point_median")}
                                    {siteDeLaCarte(bloc.ligne.site)}
                                  </span>
                                  {enRetardDe(bloc.ligne) ? (
                                    <span className="text-app-rouge-encre block truncate">
                                      {t("planning.en_retard")}
                                    </span>
                                  ) : null}
                                </Link>
                              </BlocPosable>
                            </div>
                          );
                        })}
                      </CasePosable>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </CadreDefilant>
      <HorsGrille journee={journee} annuaire={annuaire} />
    </Carte>
  );
}

/**
 * L'aplat d'une cellule. **Le créneau LIBRE est la surface la plus claire** —
 * c'est lui qu'on cherche, et un trou doit sauter aux yeux sans qu'on le
 * cherche. « Hors ouverture » est creux mais uni : *une trame veut dire une
 * seule chose*, et la hachure appartient au jour non ouvert de la vue semaine.
 *
 * **La cellule OCCUPÉE ne porte pas d'aplat ici**, et ce n'est pas un oubli :
 * elle est entièrement recouverte par le bloc, qui porte la couleur du STATUT.
 * *Mesuré à la première capture : seule la première ligne d'une intervention
 * était peinte, et les suivantes — blanches — se lisaient comme des créneaux
 * libres. Une intervention de deux heures paraissait en durer trente minutes,
 * sur l'écran même dont l'objet est de montrer ce qui est pris.*
 */
function classeDeCellule(
  etat: "occupe" | "libre" | "hors_ouverture" | "bloque",
): string {
  if (etat === "hors_ouverture") return "bg-app-gris-fond";
  // L'AGENDA BLOQUÉ porte le violet de `/absences` (D124, D128) — jamais la
  // hachure, qui ne veut dire qu'une chose : « ce jour n'est pas ouvert ».
  if (etat === "bloque") return "bg-app-violet-fond";
  return "bg-app-surface";
}

/**
 * L'aplat d'une CASE de la vue semaine. **Le blocage d'agenda prime sur la
 * trame du jour fermé**, qui prime elle-même sur la teinte du jour courant
 * (82-PLANNING-6) : sur un jour où la personne n'est pas là, ou que l'agence
 * n'ouvre pas, savoir que c'est AUJOURD'HUI ne dit plus rien à qui cherche où
 * poser. La hachure garde son sens unique — « ce jour n'est pas ouvert » — là
 * où elle reste.
 */
function classeDeCase(
  cellule: {
    readonly ouverte: boolean | null;
    readonly bloquee: boolean;
  },
  estAujourdhui: boolean,
): string {
  if (cellule.bloquee) return "bg-app-violet-fond";
  if (cellule.ouverte === false) return "trame-fermee";
  return estAujourdhui ? "bg-app-marque/5" : "";
}

/**
 * L'EN-TÊTE DIT LE FÉRIÉ OU LE PONT, PAS LE SIMPLE JOUR DE REPOS
 * (PG-A1-FERIES-GRILLE, bug 5 de l'audit d'ergonomie du 27/09/2026).
 *
 * *Mesuré en production le jeudi 24/09/2026 (« Fête de la citoyenneté ») :
 * aucune agence ne l'ouvrait, et l'en-tête restait muet.* La mention ne
 * paraît QUE quand le jour est fermé pour toutes les agences dont le jour de
 * semaine est ORDINAIREMENT travaillé — un dimanche fermé partout n'a rien
 * d'exceptionnel, et n'a droit à aucune mention. Un férié TRAVAILLÉ
 * (RG-PLA-02) reste ouvert, sans mention : `estJourOuvre` en décide déjà.
 */
function etatFerieDuJour(
  agences: readonly AgenceDeGrille[],
  jour: JourLocal,
): { readonly ferme: boolean; readonly libelle: string | null } {
  const iso = jourSemaineIso(jour);
  const ordinairement = agences.filter(
    (a): a is AgenceDeGrille & { calendrier: Calendrier } =>
      a.calendrier !== null &&
      plagesDuJourSemaine(a.calendrier, iso).length > 0,
  );
  if (ordinairement.length === 0) return { ferme: false, libelle: null };
  const toutesFermees = ordinairement.every(
    (a) => !estJourOuvre(a.calendrier, jour),
  );
  if (!toutesFermees) return { ferme: false, libelle: null };
  const particulier = jourParticulier(ordinairement[0].calendrier, jour);
  return { ferme: true, libelle: particulier?.libelle ?? null };
}

/**
 * LE JOUR COURANT — comparé par sa CLÉ (`cleJour`), jamais par ses champs un à
 * un : c'est la même égalité que partout ailleurs dans cet écran (grille,
 * cases, URL de navigation).
 */
function estAujourdHui(jour: JourLocal, aujourdhui: JourLocal): boolean {
  return cleJour(jour) === cleJour(aujourdhui);
}

/**
 * LA PASTILLE « AGENDA BLOQUÉ » — celle de `/absences`, au mot et à la couleur
 * près (D124, D128) : *une chose, un mot, une couleur.* `data-agenda-bloque`
 * est ce qu'un scénario interroge — jamais la couleur, jamais le texte.
 */
function PastilleAgendaBloque() {
  return (
    <span
      data-agenda-bloque
      className="bg-app-violet-fond text-app-violet-encre border-app-violet-bord mb-1 block rounded-md border px-1.5 py-0.5 text-12 font-bold"
    >
      {t("planning.agenda_bloque")}
    </span>
  );
}

/**
 * LE LIEN DISCRET VERS « DÉCLARER UNE ABSENCE » (MO-31, D136) — dans
 * l'en-tête de ligne d'un technicien, Semaine et Jour. `/absences` reçoit la
 * personne et le jour affiché, `du = au`, et `apercu=1` pour ouvrir
 * directement l'aperçu d'impact (même forme que le formulaire de
 * `app/(back-office)/absences/page.tsx`).
 *
 * **N'apparaît jamais sur la ligne « file d'attente »** (`technicienId ===
 * null`) : une absence se déclare pour une personne, jamais pour une file.
 */
function LienDeclarerAbsence({
  technicienId,
  jour,
}: {
  readonly technicienId: string;
  readonly jour: JourLocal;
}) {
  const cle = cleJour(jour);
  return (
    <Link
      href={`/absences?apercu=1&utilisateur_id=${technicienId}&du=${cle}&au=${cle}`}
      // LE TEXTE VISIBLE SE RACCOURCIT (9EH-TP-UX-PL-PLANNING-2, icône
      // user-off + « Absence ») — `aria-label` garde la phrase complète :
      // le nom accessible ne change pas, les scénarios qui le cherchent par
      // `fr["planning.declarer_absence_lien"]` restent verts tels quels.
      aria-label={t("planning.declarer_absence_lien")}
      className="text-app-encre-faible flex items-center gap-1 text-12 font-bold underline"
    >
      <Icone nom="user-off" taille={16} />
      {t("planning.absence_lien_court")}
    </Link>
  );
}

/**
 * LA BARRE DE CHARGE DU JOUR, DANS LA CASE (9BJA-REPRISE-9BJ, point 4c —
 * PG-C4-CHARGE point 2, que 9BJ n'avait pas fait). `minutesOuvrees` est une
 * fonction PURE une fois le calendrier chargé (`page.tsx`,
 * `calendrierDuTechnicien`) : aucune requête ici, seulement de la lecture.
 * `barreChargeDuJour` (`carte.ts`) fait le reste — largeur bornée, seuil de
 * dépassement, infobulle — SANS toucher `lib/interventions/occupation.ts` ni
 * `lib/interventions/statistiques.ts`.
 *
 * Rien n'est rendu sans calendrier connu (`barreChargeDuJour` rend `null`) ni
 * pour la colonne sans technicien (la file d'attente n'a pas de case) : une
 * barre à 0 % s'y lirait comme un fait sur une personne qui n'existe pas.
 */
/**
 * L'OCCUPATION D'UN SEUL JOUR D'UNE CASE (9CI-PG-G12-DEUX-SEMAINES-MOIS,
 * PG-D3-MOIS-CHARGE) — FACTORISÉE hors de `BarreChargeJourDeLaCase` : la case
 * de la Semaine (la barre) et la case du Mois (la teinte) lisent toutes deux
 * CE calcul, jamais deux écritures du même dénominateur (§9, 01/09). `null`
 * sans technicien ou sans calendrier connu — rien à calculer.
 */
function occupationDuJourDeLaCase(
  technicienId: string | null,
  cellule: { readonly jour: JourLocal; readonly lignes: readonly Ligne[] },
  calendrierDuTechnicien: ReadonlyMap<string, Calendrier | null>,
): OccupationTechnicien | null {
  if (technicienId === null) {
    return null;
  }
  const calendrier = calendrierDuTechnicien.get(technicienId) ?? null;
  if (calendrier === null) {
    return null;
  }
  const debut = versInstant(minuit(cellule.jour), calendrier.fuseau);
  const fin = versInstant(minuit(jourSuivant(cellule.jour)), calendrier.fuseau);
  const ouvrables = minutesOuvrees(calendrier, debut, fin);
  return occupationTechnicien(
    technicienId,
    cellule.lignes,
    ouvrables,
    SANS_TRAJET,
  );
}

function BarreChargeJourDeLaCase({
  technicienId,
  cellule,
  calendrierDuTechnicien,
}: {
  readonly technicienId: string | null;
  readonly cellule: CaseDeGrille<Ligne>;
  readonly calendrierDuTechnicien: ReadonlyMap<string, Calendrier | null>;
}) {
  const occupation = occupationDuJourDeLaCase(
    technicienId,
    cellule,
    calendrierDuTechnicien,
  );
  if (occupation === null) {
    return null;
  }
  const barre = barreChargeDuJour(occupation);
  if (barre === null) {
    return null;
  }
  return (
    <div
      data-barre-charge-jour
      title={barre.infobulle}
      className="bg-app-fond absolute right-1 bottom-1 left-1 h-1 overflow-hidden rounded-full"
    >
      <div
        className={`h-full ${barre.depasse ? "bg-app-rouge-encre" : "bg-app-marque"}`}
        style={{ width: `${barre.largeurPourcent}%` }}
      />
    </div>
  );
}

/**
 * « N à caler », EN TÊTE DE COLONNE (75-PLANNING-5, SAV-06) — le pendant, par
 * personne, de `resumeACaler` : le résumé de la journée dit combien de
 * visites sans heure pèsent au total, cette pastille dit COMBIEN sur CETTE
 * colonne, sans qu'il faille compter les blocs de la ligne « Heure à fixer »
 * (D147 ; « Journée — heure non fixée » avant elle).
 *
 * L'orange, jamais le violet du blocage d'agenda : les deux ne disent pas la
 * même chose — un agenda bloqué REFUSE le dépôt, une visite à caler l'attend
 * seulement — et une même couleur pour les deux ferait perdre la distinction
 * que `classeDeCellule` tient déjà entre `bloque` et le reste.
 */
function PastilleACaler({ nombre }: { readonly nombre: number }) {
  return (
    <span
      data-a-caler
      className="bg-app-orange-fond text-app-orange-encre border-app-orange-bord mb-1 block rounded-md border px-1.5 py-0.5 text-12 font-bold"
    >
      {nombre} {t("planning.a_caler_pastille")}
    </span>
  );
}

/**
 * L'ENTRÉE DE LÉGENDE DU BLOCAGE D'AGENDA (PLANNING-1) — ajoutée ICI et non à
 * `LEGENDE_PLANNING` : cette liste-là recopie les six familles de couleur de
 * la maquette dans son ordre (D95), et le blocage n'est pas une famille de
 * STATUT — c'est un état de la CASE, au violet de `/absences` (D124, D128).
 */
const ENTREE_LEGENDE_AGENDA_BLOQUE = {
  cle: "planning.legende.agenda_bloque",
  classes: "bg-app-violet-fond border-app-violet-bord",
} as const;

/**
 * LA LÉGENDE DE LA GRILLE SEMAINE (9EH-TP-UX-PL-PLANNING-2, X8, D193) — sous
 * la grille, hors de sa carte (gabarit `.legend` de la maquette du 28/09).
 * L'ABSENCE (violet) s'insère entre « Terminée » et « Agence fermée » — les
 * couleurs de `LEGENDE_PLANNING` sont filtrées plutôt qu'indexées, pour ne
 * pas supposer sa position dans le tableau. « Annulée » ne paraît que
 * lorsque les annulées sont affichées (`afficherAnnulees`) ; les puces de
 * priorité réutilisent `PucePriorite`, jamais une seconde pastille.
 */
function Legende({ afficherAnnulees }: { readonly afficherAnnulees: boolean }) {
  const ferme = LEGENDE_PLANNING.find(
    (entree) => entree.cle === "planning.legende.ferme",
  )!;
  const avantFerme = LEGENDE_PLANNING.filter(
    (entree) => entree.cle !== "planning.legende.ferme",
  );
  return (
    <ul className="text-app-encre-faible flex flex-wrap items-center gap-4 px-4 py-3 text-12 font-bold">
      {[...avantFerme, ENTREE_LEGENDE_AGENDA_BLOQUE, ferme].map((entree) => (
        <li key={entree.cle} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={`inline-block h-3 w-3 rounded-[3px] border ${entree.classes}`}
          />
          {estCleTraduction(entree.cle) ? t(entree.cle) : entree.cle}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <PucePriorite priorite="p1" />
        <PucePriorite priorite="p2" />
        {t("planning.legende.priorite")}
      </li>
      {afficherAnnulees ? (
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="bg-app-gris-fond border-app-gris-bord inline-block h-3 w-3 rounded-[3px] border"
          />
          <span className="line-through">{t("planning.legende.annulee")}</span>
        </li>
      ) : null}
    </ul>
  );
}

/* ─────────────────────────────── LA BASCULE ────────────────────────────── */

/**
 * L'URL DE LA VUE JOUR « AUJOURD'HUI » — factorisée (§9, 01/09) : `Deplacement`
 * et `OngletsTelephone` (PG-D4-TELEPHONE-ONGLETS, D146) pointaient vers deux
 * écritures du même critère avant cette extraction.
 */
function hrefVueJourAujourdhui(jourOuvertLePlusProche: JourLocal): string {
  return `/planning?vue=jour&jour=${cleJour(jourOuvertLePlusProche)}`;
}

/**
 * LES TROIS ONGLETS DU TÉLÉPHONE (PG-D4-TELEPHONE-ONGLETS, D146) — SOUS
 * 900 px SEULEMENT (masqué par les classes posées au point d'appel) :
 * « Aujourd'hui », « À traiter » et « Semaine » remplacent, à cette largeur,
 * le sélecteur de vue (`Onglets`) et l'ancien repli en liste de la vue Jour
 * (C-B1). Les deux premiers libellés réutilisent des clés déjà existantes
 * (`planning.aujourdhui`, `planning.vue_semaine`) : la même idée, jamais un
 * second mot (§9, 01/09).
 */
function OngletsTelephone({
  vue,
  jour,
  semaine,
  afficherAnnulees,
  ongletFile,
  zoneFile,
  rechercheFile,
  attenteParZone,
  ongletActif,
  jourOuvertLePlusProche,
}: {
  readonly vue: VuePlanning;
  readonly jour: JourLocal;
  readonly semaine: JourLocal;
  readonly afficherAnnulees: boolean;
  readonly ongletFile: OngletFile;
  readonly zoneFile: ZoneGeographique | null;
  readonly rechercheFile: string | null;
  /** Le compte du badge « À traiter » — le même que l'onglet « À planifier » de la colonne. */
  readonly attenteParZone: number;
  /**
   * `null` EN MOIS ET « 2 SEMAINES » (9G4-PLANNING-JOUR-ET-MOIS, point 8) —
   * `ongletTelephone` (`lib/interventions/affichage.ts`) : aucun des trois
   * onglets ne correspond, aucun ne s'allume.
   */
  readonly ongletActif: "a_traiter" | "aujourdhui" | "semaine" | null;
  readonly jourOuvertLePlusProche: JourLocal;
}) {
  const classes = "rounded-md px-3 py-2 text-13 font-bold min-h-11";
  const classeDe = (actif: boolean) =>
    actif
      ? `${classes} bg-app-marque text-app-marque-encre`
      : `${classes} text-app-encre-faible`;
  // « SEMAINE » RETOMBE SUR LA SEMAINE DÉJÀ AFFICHÉE QUAND LA VUE EN EST UNE
  // (« semaine » ou « deux_semaines », `semaine` porte déjà son lundi) —
  // sinon (vue « jour » ou « mois ») sur la semaine du jour affiché.
  const semaineCible =
    vue === "semaine" || vue === "deux_semaines"
      ? semaine
      : lundiDeLaSemaine(jour);
  return (
    <div
      role="tablist"
      aria-label={t("planning.telephone_navigation")}
      data-onglets-telephone
      className="max-[900px]:flex min-[901px]:hidden gap-1"
    >
      <Link
        href={hrefVueJourAujourdhui(jourOuvertLePlusProche)}
        role="tab"
        aria-current={ongletActif === "aujourdhui" ? "page" : undefined}
        data-onglet-telephone="aujourdhui"
        className={classeDe(ongletActif === "aujourdhui")}
      >
        {t("planning.aujourdhui")}
      </Link>
      <Link
        href={hrefFile({
          vue,
          jour,
          semaine,
          afficherAnnulees,
          onglet: ongletFile,
          zone: zoneFile,
          q: rechercheFile,
          volet: "a_traiter",
        })}
        role="tab"
        aria-current={ongletActif === "a_traiter" ? "page" : undefined}
        data-onglet-telephone="a_traiter"
        className={classeDe(ongletActif === "a_traiter")}
      >
        {t("planning.a_traiter_titre")}
        <Badge ton="orange">{attenteParZone}</Badge>
      </Link>
      <Link
        href={`/planning?vue=semaine&semaine=${cleJour(semaineCible)}`}
        role="tab"
        aria-current={ongletActif === "semaine" ? "page" : undefined}
        data-onglet-telephone="semaine"
        className={classeDe(ongletActif === "semaine")}
      >
        {t("planning.vue_semaine")}
      </Link>
    </div>
  );
}

function Onglets({
  vue,
  jour,
  semaine,
}: {
  readonly vue: VuePlanning;
  readonly jour: JourLocal;
  readonly semaine: JourLocal;
}) {
  const classes = "rounded-md px-3 py-2 text-13 font-bold";
  return (
    <div
      data-maquette-bloc="selecteur-semaine-jour"
      className="border-app-bord flex gap-0.5 rounded-md border p-0.5"
    >
      {/*
        L'ORDRE DES QUATRE VUES — Jour, Semaine, 2 semaines, Mois
        (9EH-TP-UX-PL-PLANNING-1, D190) — TRANCHE la « question en
        passation » laissée par 9CI (ordre alors Semaine, Jour, 2 semaines,
        Mois) : celui de la maquette du 28/09 (`.plan-bar`, `.seg`), qui pose
        « Jour » en premier.
      */}
      <Link
        href={`/planning?vue=jour&jour=${cleJour(jour)}`}
        aria-current={vue === "jour" ? "page" : undefined}
        className={
          vue === "jour"
            ? `${classes} bg-app-marque text-app-marque-encre`
            : `${classes} text-app-encre-faible`
        }
      >
        {/*
          « JOUR », PAS LE NOM DU JOUR (audit du 25/09/2026, constat 13,
          82-PLANNING-6) — REVIENT sur le choix du 19/09 (« réutiliser
          `libelleJour` ») : cet onglet est une BASCULE entre deux VUES, comme
          son voisin « Semaine », qui ne nomme pas non plus la semaine
          affichée. Le nom du jour réel se lit déjà dans le sous-titre de la
          page (`libelleJour`, l.406) une fois la vue jour ouverte ; le
          répéter ici faisait de l'onglet un second sous-titre, jamais choisi
          comme tel.
        */}
        {t("planning.vue_jour")}
      </Link>
      <Link
        href={`/planning?vue=semaine&semaine=${cleJour(semaine)}`}
        aria-current={vue === "semaine" ? "page" : undefined}
        className={
          vue === "semaine"
            ? `${classes} bg-app-marque text-app-marque-encre`
            : `${classes} text-app-encre-faible`
        }
      >
        {t("planning.vue_semaine")}
      </Link>
      <Link
        href={`/planning?vue=deux_semaines&semaine=${cleJour(semaine)}`}
        aria-current={vue === "deux_semaines" ? "page" : undefined}
        className={
          vue === "deux_semaines"
            ? `${classes} bg-app-marque text-app-marque-encre`
            : `${classes} text-app-encre-faible`
        }
      >
        {t("planning.vue_deux_semaines")}
      </Link>
      <Link
        href={`/planning?vue=mois&jour=${cleJour(moisDecale(jour, 0))}`}
        aria-current={vue === "mois" ? "page" : undefined}
        className={
          vue === "mois"
            ? `${classes} bg-app-marque text-app-marque-encre`
            : `${classes} text-app-encre-faible`
        }
      >
        {t("planning.vue_mois")}
      </Link>
    </div>
  );
}

function Deplacement({
  vue,
  jour,
  semaine,
  aujourdhui,
  jourOuvertLePlusProche,
}: {
  readonly vue: VuePlanning;
  readonly jour: JourLocal;
  readonly semaine: JourLocal;
  /** LE JOUR COURANT — pour poser le bouton « Aujourd'hui » (82-PLANNING-6, PG-C6-FILTRES-AUJOURDHUI). */
  readonly aujourdhui: JourLocal;
  /**
   * LE JOUR CIBLE DE LA VUE JOUR (PG-C6-FILTRES-AUJOURDHUI) — `aujourdhui` si
   * ouvert, sinon le premier jour suivant où au moins une agence l'est
   * (`estJourOuvre`, jamais une règle « dimanche » écrite ici, I7). La vue
   * SEMAINE n'en a pas besoin : elle montre toujours une semaine entière.
   */
  readonly jourOuvertLePlusProche: JourLocal;
}) {
  // LE PAS DE DÉPLACEMENT (9CI-PG-G12-DEUX-SEMAINES-MOIS, D145) — 1 jour, 7
  // ou 14, selon la fenêtre que la vue montre. « Mois » se déplace par MOIS
  // CIVIL, pas par un nombre de jours fixe (`moisDecale`, ci-dessous) : le
  // pas vaut ici 1 MOIS, jamais 1 jour — `lien` le passe tel quel à
  // `moisDecale`, qui compte en mois plutôt qu'en jours.
  const pas =
    vue === "jour" ? 1 : vue === "deux_semaines" ? 14 : vue === "mois" ? 1 : 7;
  const periode = parametrePeriode(vue, jour, semaine);
  const lien = (decalage: number) =>
    vue === "mois"
      ? `/planning?vue=mois&jour=${cleJour(moisDecale(periode.valeur, decalage))}`
      : `/planning?vue=${vue}&${periode.nom}=${cleJour(decale(periode.valeur, decalage))}`;
  const classes =
    "border-app-bord text-app-encre-faible rounded-md border px-2.5 py-2 text-13 font-bold";
  // LES FLÈCHES EN ICÔNES (9EH-TP-UX-PL-PLANNING-1, D190, gabarit `.icon-btn`
  // de la maquette du 28/09) — `aria-label` ET `title` portent la clé
  // EXISTANTE, flèche comprise (« ← Semaine précédente ») : seul le CONTENU
  // VISIBLE change, jamais le nom accessible, pour que les épreuves qui le
  // lisent restent vertes sans y toucher. Cible ≥ 44 px sous 901 px
  // (99F-CIBLES-375), rendue à l'apparence bureau au-dessus.
  const classesFleche = `${classes} inline-flex min-h-11 min-w-11 items-center justify-center min-[901px]:min-h-0 min-[901px]:min-w-0`;
  // « AUJOURD'HUI » EST DÉSORMAIS PERMANENT, DANS TOUTES LES VUES
  // (PG-C6-FILTRES-AUJOURDHUI) — REVIENT sur 82-PLANNING-6 (25/09/2026),
  // qui le masquait sur la semaine courante et ne le posait pas du tout en
  // vue Jour. *Mesuré à l'audit du 27/09 (§5) : le dimanche, le planning
  // montre la semaine écoulée sans aucun moyen d'un clic pour revenir à
  // « maintenant ».* Le bouton ne disparaît plus jamais.
  const hrefAujourdhui =
    vue === "jour"
      ? hrefVueJourAujourdhui(jourOuvertLePlusProche)
      : vue === "mois"
        ? `/planning?vue=mois&jour=${cleJour(moisDecale(aujourdhui, 0))}`
        : `/planning?vue=${vue}&semaine=${cleJour(lundiDeLaSemaine(aujourdhui))}`;
  const cleAvant =
    vue === "jour"
      ? "planning.jour_avant"
      : vue === "deux_semaines"
        ? "planning.deux_semaines_avant"
        : vue === "mois"
          ? "planning.mois_avant"
          : "planning.semaine_avant";
  const cleApres =
    vue === "jour"
      ? "planning.jour_apres"
      : vue === "deux_semaines"
        ? "planning.deux_semaines_apres"
        : vue === "mois"
          ? "planning.mois_apres"
          : "planning.semaine_apres";
  return (
    <div className="flex items-center gap-2">
      <Link
        href={lien(-pas)}
        aria-label={t(cleAvant)}
        title={t(cleAvant)}
        className={classesFleche}
      >
        <Icone nom="chev-l" taille={16} />
      </Link>
      <Link href={hrefAujourdhui} className={classes}>
        {t("planning.aujourdhui")}
      </Link>
      <Link
        href={lien(pas)}
        aria-label={t(cleApres)}
        title={t(cleApres)}
        className={classesFleche}
      >
        <Icone nom="chev-r" taille={16} />
      </Link>
    </div>
  );
}

/**
 * LE FILTRE DES ANNULÉES (PG-A8-ANNULEES-MASQUEES) — un lien qui bascule
 * `?annulees=1`, en préservant la vue et la période affichées : jamais un
 * `<form>` séparé, qui perdrait `vue`/`jour`/`semaine` au premier envoi.
 */
function ToggleAnnulees({
  vue,
  jour,
  semaine,
  afficherAnnulees,
}: {
  readonly vue: VuePlanning;
  readonly jour: JourLocal;
  readonly semaine: JourLocal;
  readonly afficherAnnulees: boolean;
}) {
  const periode = parametrePeriode(vue, jour, semaine);
  const base = `/planning?vue=${vue}&${periode.nom}=${cleJour(periode.valeur)}`;
  const href = afficherAnnulees ? base : `${base}&annulees=1`;
  const classes =
    "border-app-bord rounded-md border px-2.5 py-2 text-13 font-bold";
  return (
    <Link
      href={href}
      aria-pressed={afficherAnnulees}
      className={
        afficherAnnulees
          ? `${classes} bg-app-marque text-app-marque-encre`
          : `${classes} text-app-encre-faible`
      }
    >
      {t("planning.afficher_annulees")}
    </Link>
  );
}

/**
 * L'URL DE LA VUE ACTUELLE, SANS `pleinEcran` — celle où Échap et le bouton
 * ramènent (PG-C3-CARTES-COLONNES ; étendue à Jour et « 2 semaines » par
 * 9G4-PLANNING-JOUR-ET-MOIS, point 4 — REVIENT sur l'écriture figée
 * `vue=semaine`, qui ramenait Échap à la Semaine même depuis une autre vue).
 * Une seule écriture pour les deux : la dupliquer dans `EchapPleinEcran` (un
 * COMPOSANT CLIENT, qui ne peut pas appeler cette fonction serveur) aurait
 * fait deux lectures du même critère (§9, 01/09) — elle est donc calculée
 * ICI, une fois, et transmise en `href`. Même lecture de la période que
 * `ToggleAnnulees`, `parametrePeriode` (D145).
 */
function hrefSansPleinEcran(
  vue: VuePlanning,
  jour: JourLocal,
  semaine: JourLocal,
  afficherAnnulees: boolean,
): string {
  const periode = parametrePeriode(vue, jour, semaine);
  const base = `/planning?vue=${vue}&${periode.nom}=${cleJour(periode.valeur)}`;
  return afficherAnnulees ? `${base}&annulees=1` : base;
}

/**
 * « PLEIN ÉCRAN » — replie la colonne « À planifier » pour rendre sa largeur
 * à la grille (PG-C3-CARTES-COLONNES, décision QG-1 du 27/09/2026 ; étendue à
 * Jour et « 2 semaines » par 9G4-PLANNING-JOUR-ET-MOIS, point 4 — D193
 * justifie l'absence de chevron de repli par ce bouton, qui jusqu'ici ne
 * manquait qu'à ces deux vues). Même patron que `ToggleAnnulees` juste
 * au-dessus : un `<Link>`, `aria-pressed`, l'état dans l'URL.
 */
function BasculerPleinEcran({
  vue,
  jour,
  semaine,
  afficherAnnulees,
  pleinEcran,
}: {
  readonly vue: VuePlanning;
  readonly jour: JourLocal;
  readonly semaine: JourLocal;
  readonly afficherAnnulees: boolean;
  readonly pleinEcran: boolean;
}) {
  const base = hrefSansPleinEcran(vue, jour, semaine, afficherAnnulees);
  const href = pleinEcran ? base : `${base}&pleinEcran=1`;
  const classes =
    "border-app-bord rounded-md border px-2.5 py-2 text-13 font-bold inline-flex items-center gap-1.5";
  return (
    <Link
      href={href}
      aria-pressed={pleinEcran}
      className={
        pleinEcran
          ? `${classes} bg-app-marque text-app-marque-encre`
          : `${classes} text-app-encre-faible`
      }
    >
      {/* `columns`/`x` (9EH-TP-UX-PL-PLANNING-1, D190, gabarit de la
          maquette du 28/09) — à CÔTÉ du texte, jamais à sa place : le nom
          accessible de ce lien reste la même clé qu'avant ce lot. */}
      <Icone nom={pleinEcran ? "x" : "columns"} taille={16} />
      {t(pleinEcran ? "planning.quitter_plein_ecran" : "planning.plein_ecran")}
    </Link>
  );
}

/* ──────────────────────────── LES COMPOSITIONS ─────────────────────────── */

/**
 * Le jour demandé, ou celui d'aujourd'hui.
 *
 * Une valeur illisible ne fait pas échouer l'écran — elle retombe sur le jour
 * courant. *Un paramètre d'URL vient de l'extérieur* (L1-02f) : le traiter
 * comme une erreur donnerait à n'importe qui le moyen de casser la page en
 * forgeant un lien.
 */
function jourDemande(
  demande: string | string[] | undefined,
  fuseau: string,
  versLundi: boolean,
): JourLocal {
  const defaut = maintenant(fuseau).local;
  const lu =
    typeof demande === "string"
      ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(demande)
      : null;
  const jour =
    lu === null
      ? defaut
      : {
          annee: Number(lu[1]),
          mois: Number(lu[2]),
          jour: Number(lu[3]),
        };
  const valide =
    jour.mois >= 1 && jour.mois <= 12 && jour.jour >= 1 && jour.jour <= 31
      ? jour
      : defaut;
  return versLundi ? lundiDeLaSemaine(valide) : valide;
}

function decale(jour: JourLocal, jours: number): JourLocal {
  const date = new Date(0);
  date.setUTCFullYear(jour.annee, jour.mois - 1, jour.jour + jours);
  return {
    annee: date.getUTCFullYear(),
    mois: date.getUTCMonth() + 1,
    jour: date.getUTCDate(),
  };
}

function libelleJour(jour: JourLocal): string {
  const cle = `jour.${jourSemaineIso(jour)}`;
  const nom = estCleTraduction(cle) ? t(cle) : "";
  return `${nom} ${jour.jour}/${String(jour.mois).padStart(2, "0")}/${jour.annee}`.trim();
}

/**
 * « Lun 17 » — l'en-tête d'une colonne.
 *
 * Le jour de la semaine vient de `jourSemaineIso`, qui passe par une date UTC
 * et jamais par `getDay()` : cet accesseur lirait le fuseau de l'appareil.
 */
function enTeteDeJour(jour: JourLocal): string {
  const cle = `jour.court.${jourSemaineIso(jour)}`;
  return `${estCleTraduction(cle) ? t(cle) : ""} ${jour.jour}`.trim();
}

/**
 * LE COMPTE DES TROUS, écrit à côté de la grille.
 *
 * *« Un créneau libre doit se distinguer au premier coup d'œil, sinon l'écran
 * ne sert à rien. »* Le chiffre est là pour que l'utilité de l'écran se mesure
 * au lieu de s'apprécier — et pour qu'une régression qui remplirait les trous
 * se voie tout de suite.
 */
/**
 * LES INTERVENTIONS SANS HEURE, QUAND IL N'Y A PAS D'AXE POUR LES PORTER
 * (AFFICHAGE-MATERIEL-1) — le repli de la ligne « Heure à fixer » (D147 ;
 * « Journée — heure non fixée » avant elle) pour le cas où aucune agence
 * présente n'a de calendrier connu : il n'y a
 * alors ni table ni colonne où poser cette ligne, mais l'intervention reste
 * du jour, et elle se dit ici, groupée par technicien.
 */
function SansHeureVide({
  journee,
  annuaire,
  donneesMateriel,
  enRetardDe,
  hrefIntervention,
  glissable,
}: {
  readonly journee: Journee<Ligne>;
  readonly annuaire: Annuaire;
  readonly donneesMateriel: ReadonlyMap<string, DonneesMateriel>;
  /** « EN RETARD » (PG-C1a-EN-RETARD-PLANNING) — voir `page.tsx`, `enRetardDe`. */
  readonly enRetardDe: (ligne: Ligne) => boolean;
  /**
   * LE TIROIR (PG-C5-TIROIR) — FACULTATIF : sans lui, un lien ordinaire vers
   * la fiche (repli conservé pour tout appelant qui n'a pas cette navigation).
   * `VueJour` le fournit désormais TOUJOURS (QG-3/D142, 30/09/2026) — c'est ce
   * qui manquait pour que ce bloc, devenu le SEUL endroit qui dessine « heure
   * non fixée » (l'ancienne ligne du tableau des heures a disparu avec
   * l'orientation), garde le même geste qu'avant : ouvrir la fiche SANS
   * quitter le planning.
   */
  readonly hrefIntervention?: (id: string) => string;
  /**
   * LES CARTES « HEURE À FIXER » DEVIENNENT GLISSABLES (décision d'Alexis du
   * 30/09/2026, point 5 ; D147) — FACULTATIF : sans lui, cette section reste
   * en LECTURE SEULE, exactement comme avant ce ticket. `VueJour` ne le
   * fournit que pour la branche FRISE (une case de dépôt existe) — jamais
   * pour la branche « axe vide », qui n'en a aucune.
   */
  readonly glissable?: { readonly fuseauPour: (agenceId: string) => Fuseau };
}) {
  const colonnesAvecSansHeure = journee.colonnes.filter(
    (c) => c.sansHeure.length > 0,
  );
  if (colonnesAvecSansHeure.length === 0) {
    return null;
  }
  return (
    <section
      data-maquette-bloc="ligne-jour-sans-heure"
      className="border-app-bord border-t px-4 py-3"
    >
      <h3 className="text-[12px] font-bold">{t("planning.jour_sans_heure")}</h3>
      <ul className="mt-2 flex flex-col gap-1">
        {colonnesAvecSansHeure.flatMap((colonne) =>
          colonne.sansHeure.map((ligne) => {
            const contenu = (
              <>
                <Link
                  href={
                    hrefIntervention === undefined
                      ? `/interventions/${ligne.id}?depuis=planning`
                      : hrefIntervention(ligne.id)
                  }
                  data-tiroir-declencheur={
                    hrefIntervention === undefined ? undefined : ligne.id
                  }
                  className={`font-bold ${CLASSES_LIEN}`}
                >
                  {referenceAffichee(ligne)}
                </Link>
                <span className="text-app-encre-faible">
                  {ligneTechnicienSansHeure(colonne.technicienId, annuaire)}
                </span>
                <DetailsDeLaCarte
                  ligne={ligne}
                  donneesMateriel={donneesMateriel}
                  enRetard={enRetardDe(ligne)}
                />
              </>
            );
            return (
              <li key={ligne.id} className="text-[12px] font-bold">
                {glissable === undefined ? (
                  contenu
                ) : (
                  <BlocPosable
                    interventionId={ligne.id}
                    {...glisseDeLaCarteSansHeure({
                      dureeMin: dureeDe(ligne),
                      libelle: libellePourFenetrePose(ligne),
                      fuseau: glissable.fuseauPour(ligne.agence_id),
                    })}
                  >
                    {contenu}
                  </BlocPosable>
                )}
              </li>
            );
          }),
        )}
      </ul>
    </section>
  );
}

/**
 * CE QUE LA GRILLE NE PEUT PAS DESSINER DANS L'AXE, ET QU'ELLE DIT
 * (12/09/2026).
 *
 * Une seule disparition silencieuse vit encore ici : le créneau posé hors de
 * l'axe. *Elle ne peut pas être placée sans inventer une heure que personne
 * n'a saisie ; elle est donc NOMMÉE, jamais effacée.* L'intervention datée
 * SANS HEURE n'y entre plus depuis AFFICHAGE-MATERIEL-1 — elle se dessine
 * dans la colonne (`sansHeure`, ci-dessus) ; la seconde d'un chevauchement est
 * réparée dans la cellule.
 *
 * Le bloc n'apparaît pas quand il n'y a rien à dire : *un « 0 » à cet endroit
 * se lirait comme une mesure*, et il n'y en a pas à faire.
 */
function HorsGrille({
  journee,
  annuaire,
}: {
  readonly journee: Journee<Ligne>;
  readonly annuaire: Annuaire;
}) {
  if (journee.horsGrille === 0) return null;
  return (
    <section className="border-app-bord bg-app-surface-creuse border-t px-4 py-3">
      <h3 className="text-[12px] font-bold">
        {t("planning.jour_hors_grille")}
        <span className="text-app-marque ml-2 text-12 font-bold">
          {journee.horsGrille}
        </span>
      </h3>
      <p className="text-app-encre-faible text-12 font-bold">
        {t("planning.jour_hors_grille_aide")}
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {journee.colonnes.flatMap((colonne) =>
          colonne.horsGrille.map(({ ligne, motif }) => (
            <li key={ligne.id} className="text-[12px] font-bold">
              <Link
                href={`/interventions/${ligne.id}`}
                className={`font-bold ${CLASSES_LIEN}`}
              >
                {referenceAffichee(ligne)}
              </Link>
              <span className="text-app-encre-faible">
                {ligneHorsGrille(colonne.technicienId, motif, annuaire)}
              </span>
            </li>
          )),
        )}
      </ul>
    </section>
  );
}

/**
 * LE TECHNICIEN D'UNE LIGNE « SANS HEURE » — composé HORS du JSX (L0-11),
 * comme `ligneHorsGrille` juste en dessous : le séparateur est un littéral.
 */
function ligneTechnicienSansHeure(
  technicienId: string | null,
  annuaire: Annuaire,
): string {
  return ` — ${quiTravaille(technicienId, annuaire)}`;
}

/**
 * La ligne entière — composée HORS du JSX, où un littéral n'est pas admis
 * (L0-11), et le séparateur en est un.
 *
 * Un seul motif reste possible depuis AFFICHAGE-MATERIEL-1 — `hors_axe` — et
 * le paramètre garde son type `MotifHorsGrille` plutôt qu'une chaîne : un
 * futur second motif ne pourra pas se glisser ici en silence.
 */
function ligneHorsGrille(
  technicienId: string | null,
  motif: MotifHorsGrille,
  annuaire: Annuaire,
): string {
  const libelle: Record<MotifHorsGrille, string> = {
    hors_axe: t("planning.jour_hors_grille_hors_axe"),
  };
  return ` — ${quiTravaille(technicienId, annuaire)} — ${libelle[motif]}`;
}

function resumeDesTrous(
  libres: number,
  pasMinutes: number,
  aCaler: ACaler,
): string {
  const base = `${decompte(libres, t("planning.creneau_libre_un"), t("planning.creneaux_libres"))} · ${t("planning.pas")} ${pasMinutes} min`;
  const trousACaler = resumeACaler(aCaler);
  return trousACaler === null ? base : `${base} · ${trousACaler}`;
}

/**
 * L'EN-TÊTE COMPLET DE LA VUE JOUR (99G-PLANNING-JOUR) — qui est là, qui est
 * bloqué, PUIS le résumé des trous. `resumeDesTechniciens` s'AJOUTE devant
 * `resumeDesTrous`, elle ne le remplace jamais (`docs/backlog.md`, R2-14 :
 * *« Le compte des créneaux libres est donc affiché à l'écran »*).
 */
function resumeEnTeteDeJournee(
  journee: Journee<Ligne>,
  annuaire: Annuaire,
): string {
  const qui = resumeDesTechniciens(journee.colonnes, annuaire);
  const trous = resumeDesTrous(
    journee.creneauxLibres,
    journee.pasMinutes,
    journee.aCaler,
  );
  return `${qui} · ${trous}`;
}

/**
 * « 2 visites à caler (3 h 30) » — jamais à la place du compte de trous,
 * toujours À CÔTÉ (voir `ACaler`, `lib/interventions/journee.ts`).
 *
 * Le parenthésage se compose de ce qui est CONNU (`minutesConnues`, via
 * `dureeCarteAffichee`) et de ce qui ne l'est PAS (`sansDuree`) — l'un des
 * deux peut manquer, jamais les deux à la fois puisque `aCaler.nombre > 0`
 * l'exige.
 */
function resumeACaler(aCaler: ACaler): string | null {
  if (aCaler.nombre === 0) {
    return null;
  }
  const visites = decompte(
    aCaler.nombre,
    t("planning.a_caler_visite_une"),
    t("planning.a_caler_visites"),
  );
  const duree = dureeCarteAffichee(aCaler.minutesConnues);
  const sansDuree =
    aCaler.sansDuree > 0
      ? `${aCaler.sansDuree} ${t("planning.a_caler_sans_duree")}`
      : null;
  const parenthese = [duree, sansDuree]
    .filter((v): v is string => v !== null)
    .join(" + ");
  return parenthese.length === 0 ? visites : `${visites} (${parenthese})`;
}

/**
 * LE BADGE « PATENTE » (QG-9, D163) — À CÔTÉ DU NOM, JAMAIS DESSOUS (D111).
 *
 * `inline-block` : posé juste après le texte du nom, avant le `<span
 * className="... block ...">` de l'agence, il se rend sur la MÊME ligne que
 * le nom sans wrapper supplémentaire. Rien n'est rendu pour un salarié ni
 * pour un statut non renseigné — choix du pilote, la majorité n'a pas à être
 * marquée.
 */
function BadgeTechnicienPatente({
  technicienId,
  statutRessourceDe,
}: {
  readonly technicienId: string | null;
  readonly statutRessourceDe: ReadonlyMap<string, StatutRessource | null>;
}) {
  if (technicienId === null) {
    return null;
  }
  if (statutRessourceDe.get(technicienId) !== "patente") {
    return null;
  }
  return (
    <span className="ml-1.5 inline-block align-middle">
      <Badge ton="gris">{t("planning.technicien.patente")}</Badge>
    </span>
  );
}

/**
 * LE TAUX COMPACT — trois états, trois libellés, et aucun ne se confond (D111).
 *
 * **Une personne sans ligne de charge ne rend RIEN** — pas « 0 % ». C'est le cas
 * d'un technicien dont aucune intervention n'est affichée cette semaine : *il
 * n'a pas un taux de zéro, il n'a pas de taux*, et la colonne se tait plutôt que
 * d'affirmer.
 */
function TauxCompactAffiche({
  lignes,
  jauge = false,
}: {
  readonly lignes: readonly LigneOccupation[];
  /**
   * LA MINI-JAUGE DE CHARGE (9EH-TP-UX-PL-PLANNING-2, CHOIX DU PILOTE) —
   * FACULTATIVE, fausse par défaut : ce composant sert aussi la liste
   * téléphone et `ListeJour`, qui ne la demandent pas (D193, écart nommé).
   * Seule la colonne technicien de `VueSemaine` la pose.
   */
  readonly jauge?: boolean;
}) {
  if (lignes.length === 0) {
    return null;
  }
  // UNE SEULE AGENCE : le taux SEUL, c'est D111 dans sa condition de validité.
  // PLUSIEURS : chacun nomme la sienne — *cet affichage devient ambigu et devra
  // nommer l'agence*, écrit D111 lui-même. Le voici, sans attendre le jour.
  const nommer = lignes.length > 1;
  return (
    <>
      {lignes.map((ligne) => (
        <TauxDUneAgence
          key={ligne.agenceId}
          ligne={ligne}
          nommerLAgence={nommer}
          jauge={jauge}
        />
      ))}
    </>
  );
}

/**
 * LA MINI-JAUGE DE CHARGE DE LA COLONNE TECHNICIEN (9EH-TP-UX-PL-
 * PLANNING-2, CHOIX DU PILOTE) — 6 px, même formule que `barreChargeDuJour`
 * (`carte.ts:283` : largeur bornée à 100, rouge au-delà de `TAUX_PLEIN`,
 * seul seuil, D107) sans l'IMPORTER : son nom et son docblock la lient à la
 * charge d'UN JOUR dans une case, jamais à la charge de la semaine d'une
 * colonne. Jetons existants seulement (`bg-app-fond`, `bg-app-marque`,
 * `bg-app-rouge-encre`) ; `aria-hidden` — le texte du taux, juste à côté,
 * porte déjà le chiffre pour qui ne voit pas la barre.
 */
function JaugeDeCharge({ pourcent }: { readonly pourcent: number }) {
  const largeur = Math.min(Math.max(pourcent, 0), 100);
  const depasse = pourcent > TAUX_PLEIN;
  return (
    <div
      aria-hidden="true"
      className="bg-app-fond mt-1 h-1.5 overflow-hidden rounded-full"
    >
      <div
        className={`h-full ${depasse ? "bg-app-rouge-encre" : "bg-app-marque"}`}
        style={{ width: `${largeur}%` }}
      />
    </div>
  );
}

/**
 * LE TAUX COMPACT, ÉTENDU DE DEUX ÉTATS (PG-C4-CHARGE, 28/09/2026) — SANS
 * TOUCHER À `tauxCompact` (`lib/interventions/statistiques.ts`, hors
 * territoire de ce ticket, formule inchangée D107/D111).
 *
 * **« — », JAMAIS « taux inconnu » AFFICHÉ EN CLAIR, pour l'état
 * `sans_calendrier`** : « 0 % » ne doit jamais se lire pour un dénominateur
 * inconnu (même règle que `statistiques.sans_calendrier` au panneau complet,
 * D56) — le signe est court parce que la colonne l'est, `aria-label` et
 * `title` portent la phrase entière pour qui ne voit pas la couleur ni la
 * position.
 *
 * **« ≥ N % », quand `sansDuree > 0`** : au moins une intervention de la
 * semaine du technicien n'a pas de durée saisie, et le nombre engagé n'est
 * alors qu'un PLANCHER — même raison que `heuresEngageesAuMoins` au panneau
 * complet (SAV-05), reprise ici pour la colonne compacte. Le chiffre BRUT
 * vient de `compact` (voir plus bas pourquoi jamais d'un second appel) ;
 * `sansDuree` vient de `ligne.occupation`, jamais recalculé.
 */
function TauxDUneAgence({
  ligne,
  nommerLAgence,
  jauge = false,
}: {
  readonly ligne: LigneOccupation;
  readonly nommerLAgence: boolean;
  readonly jauge?: boolean;
}) {
  const compact = tauxCompact(ligne.occupation);
  const ou = nommerLAgence ? `${ligne.agenceLibelle} ` : "";
  if (compact.etat === "sans_calendrier") {
    return (
      <span
        title={t("statistiques.taux_compact_sans_calendrier.aide")}
        aria-label={`${ou}${t("statistiques.taux_compact_sans_calendrier")}`}
        className="text-app-encre-faible block text-12 font-bold italic"
      >
        {ou}
        {t("statistiques.taux_compact_inconnu")}
      </span>
    );
  }
  // LA JAUGE REDIT LE TAUX, AUCUN AUTRE NOMBRE (D111) — même pourcentage que
  // le texte juste en dessous, jamais un second calcul ; `nommerLAgence` vrai
  // (plusieurs agences) l'écarte : D111 impose alors de nommer chacune, et
  // une jauge par agence serait un second taux à comparer dans 170 px.
  const pourcentConnu = compact.etat === "infime" ? 0 : compact.pourcent;
  const afficherLaJauge = jauge && !nommerLAgence;
  const incomplet = ligne.occupation.sansDuree > 0;
  if (incomplet) {
    // LE CHIFFRE BRUT VIENT DE `compact`, JAMAIS D'UN SECOND APPEL À LA
    // FONCTION PURE QUI CALCULE LE TAUX — un gardien statique
    // (`tests/unit/interventions/occupation-affichee.test.ts`) refuse qu'un
    // composant l'appelle par son nom sans porter aussi les deux termes et la
    // formule (D56) : la colonne compacte en est exemptée par construction
    // (D111, un technicien n'a qu'une agence), mais seulement tant qu'elle
    // passe par `tauxCompact` plutôt que par la fonction nue.
    const brut = compact.etat === "chiffre" ? compact.pourcent : 0;
    return (
      <>
        {afficherLaJauge ? <JaugeDeCharge pourcent={pourcentConnu} /> : null}
        <span
          title={t("statistiques.charge_incomplete")}
          className="text-app-encre-faible block text-12 font-bold"
        >
          {ou}
          {t("statistiques.taux_compact_au_moins_signe")} {brut}
          {t("statistiques.pourcent")}
        </span>
      </>
    );
  }
  return (
    <>
      {afficherLaJauge ? <JaugeDeCharge pourcent={pourcentConnu} /> : null}
      <span className="text-app-encre-faible block text-12 font-bold">
        {ou}
        {compact.etat === "infime"
          ? t("statistiques.taux_infime")
          : `${compact.pourcent}${t("statistiques.pourcent")}`}
      </span>
    </>
  );
}

/**
 * LA DURÉE D'UNE INTERVENTION, pour la conserver au déplacement.
 *
 * Le créneau posé d'abord — c'est la durée RÉELLEMENT réservée —, l'estimation
 * ensuite, et `null` quand NI L'UN NI L'AUTRE n'existe : *une valeur par
 * défaut qui répond à une question qu'on n'a pas posée est une décision prise
 * par personne* (§9, 24/08). Un `0` inventé ici partirait comme un
 * `duree_min=0` au dépôt (PG-A3a, bug 2 de l'audit du 27/09) — Zod le refuse
 * (`positive()`), et le refus se lit alors « tirez la poignée », un texte qui
 * ne s'applique qu'au redimensionnement. `pose.tsx` doit pouvoir DISTINGUER
 * une durée connue de zéro minute d'une durée absente, et seul `null` le lui
 * permet.
 */
function dureeDe(ligne: Ligne): number | null {
  if (ligne.creneau_debut !== null && ligne.creneau_fin !== null) {
    return Math.round(
      (ligne.creneau_fin.getTime() - ligne.creneau_debut.getTime()) / 60_000,
    );
  }
  return ligne.duree_estimee_min;
}

/** Le titre de `FenetrePose` — « client · panne ou nature · priorité » (PG-B2). */
function libellePourFenetrePose(ligne: Ligne): string {
  return [
    ligne.client.raison_sociale,
    panneOuNatureDeLaCarte(ligne),
    t(`priorite.${ligne.priorite}`),
  ].join(t("ponctuation.point_median"));
}

/** Le texte de colonne vide, propre à chaque onglet de « À traiter ». */
function texteVideDeLOnglet(
  onglet: OngletFile,
):
  | "planning.file_vide"
  | "planning.a_traiter_vide_en_retard"
  | "planning.a_traiter_vide_sans_duree"
  | "planning.a_traiter_vide_suspendues" {
  switch (onglet) {
    case "en_retard":
      return "planning.a_traiter_vide_en_retard";
    case "sans_duree":
      return "planning.a_traiter_vide_sans_duree";
    case "suspendues":
      return "planning.a_traiter_vide_suspendues";
    case "a_planifier":
      return "planning.file_vide";
  }
}

/**
 * L'ANCIENNETÉ AFFICHÉE D'UNE CARTE DE LA COLONNE « À TRAITER »
 * (PG-C2-FILE-ONGLETS) — « Créée aujourd'hui », ou « Créée il y a N jour(s) »,
 * calculée par `ancienneteEnJours` (`lib/interventions/affichage.ts`), jamais
 * ici : ce fichier compose le texte, il ne recalcule pas le nombre de jours.
 */
function origineAffichee(
  creeLe: Date,
  fuseau: Fuseau,
  aujourdhuiLocal: JourLocal,
): string {
  const jours = ancienneteEnJours(creeLe, fuseau, aujourdhuiLocal);
  if (jours === 0) {
    return t("planning.a_traiter_cree_aujourdhui");
  }
  return `${t("planning.a_traiter_cree_il_y_a")} ${decompte(
    jours,
    t("planning.a_traiter_jour_un"),
    t("planning.a_traiter_jours"),
  )}`;
}

/**
 * LE DÉBUT D'UNE INTERVENTION, en minutes locales — pour le CONSERVER au
 * déplacement en vue Semaine (PG-A7, 28/09/2026, décision QG-4 d'Alexis du
 * 27/09 : une intervention planifiée garde une heure).
 *
 * `null` sans créneau posé : une intervention qui n'a jamais eu d'heure n'en
 * invente pas une en voyageant d'un jour à l'autre — ce cas garde le
 * comportement d'avant ce ticket (elle se déplace au jour, sans heure).
 */
function debutMinutesDe(ligne: Ligne, fuseau: Fuseau): number | null {
  if (ligne.creneau_debut === null) {
    return null;
  }
  return minutesDepuisMinuit(versLocal(ligne.creneau_debut, fuseau));
}
