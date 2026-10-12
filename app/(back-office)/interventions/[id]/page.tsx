import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { DialogueAnnuler } from "@/components/interventions/dialogue-annuler";
import { DialogueChangerTechnicien } from "@/components/interventions/dialogue-changer-technicien";
import { DialogueCloturer } from "@/components/interventions/dialogue-cloturer";
import { DialogueDeplacer } from "@/components/interventions/dialogue-deplacer";
import { DialoguePlanifier } from "@/components/interventions/dialogue-planifier";
import { DialogueSuspendre } from "@/components/interventions/dialogue-suspendre";
import { DialogueTransmettre } from "@/components/interventions/dialogue-transmettre";
import { TrouverCreneau } from "@/components/interventions/trouver-creneau";
import { Page } from "@/components/mise-en-page/page";
import { LienPrimaire } from "@/components/ui/action-primaire";
import { BandeauEtat } from "@/components/ui/bandeau-etat";
import { Chronologie } from "@/components/ui/chronologie";
import { ColonneContexte } from "@/components/ui/colonne-contexte";
import { EnTeteFiche, type FaitFiche } from "@/components/ui/entete-fiche";
import { FriseEtapes, type EtapeFrise } from "@/components/ui/frise-etapes";
import { Icone } from "@/components/ui/icone";
import { MenuPlus } from "@/components/ui/menu-plus";
import { Onglets } from "@/components/ui/onglets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { absencesDeLaPeriode } from "@/lib/absences/depot";
import { annuaireDesPersonnes } from "@/lib/auth/annuaire";
import { type ContexteActif } from "@/lib/auth/contexte";
import { peut, peutPleinement } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import { destinataireClient } from "@/lib/avertissements/planification";
import { contactsDuClient } from "@/lib/contacts/depot";
import { numeroDeLaDemande } from "@/lib/demandes/depot";
import { exigencesDuSite } from "@/lib/habilitations/depot";
import {
  cleJour,
  dateCivile,
  instantDuJour,
  jourDe,
  maintenant,
  type Fuseau,
} from "@/lib/calendar/fuseau";
import { enDuree } from "@/lib/calendar/duree";
import { avecContexteApplicatif } from "@/lib/db/client";
import type { VerdictAffectation } from "@/lib/habilitations/affectation";
import { actionPrincipale } from "@/lib/interventions/action-principale";
import { formatAdresseSite } from "@/lib/interventions/bon";
import {
  estFige,
  peutCloturer,
  peutGenererLeBon,
  peutTransmettre,
  type Verdict,
} from "@/lib/interventions/cycle-de-vie";
import { caseDepuisParametres } from "@/lib/interventions/creer-ici";
import { estUuid } from "@/lib/identifiant";
import {
  lireFicheIntervention,
  pausesDeLIntervention,
  segmentsDeLIntervention,
  type PauseAffichee,
  type SegmentAffiche,
  type ValorisationAffichee,
} from "@/lib/interventions/depot";
import {
  derniereSignature,
  prestationsRealisees,
} from "@/lib/interventions/depot-rapport-terrain";
import type {
  IssueSignature,
  StatutIntervention,
} from "@/lib/interventions/saisie";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  accesAuxMontants,
  type AccesAuxMontants,
} from "@/lib/interventions/montants-visibles";
import { optionsDAffectation } from "@/lib/interventions/personnes";
import { accesSurCetteIntervention } from "@/lib/interventions/perimetre-technicien";
import {
  donneesMaterielDesMachines,
  machinesDesSites,
} from "@/lib/machines/depot";
import { libelleMaterielComplet } from "@/lib/machines/presentation";
import { formatMoney } from "@/lib/money";
import { lireSite } from "@/lib/sites/depot";
import { observationLieeAIntervention } from "@/lib/vgp/observations";

import { tonDePriorite } from "@/lib/theme/priorites";
import { CLASSES_STATUT, CLASSES_TON } from "@/lib/theme/statuts";
import { tonDeLAvertissement } from "@/lib/avertissements/ton";

import { horairesAffiches } from "@/app/(back-office)/sites/presentation";

import {
  bandeauDeLaFiche,
  chronologieDeLaFiche,
  dateHeureLocale,
  deduiteDuSite,
  estRepriseDunImport,
  etapesDeLIntervention,
  heureDuCreneau,
  hrefOngletFiche,
  libelleOrigineDemande,
  machinesIdentifiees,
  mentionDeplanifiee,
  nomEtFonctionDuContact,
  ongletDeLaFiche,
  pieceAttendueAffichee,
  referenceAffichee,
  resumeDuCreneau,
  retourFiche,
  surtitreDeLaFiche,
  technicienAfficheSurLaFiche,
  texteBandeauReprise,
  texteSansSegment,
  titreDeLaFiche,
  VALEURS_ONGLET_FICHE,
} from "../presentation";
import { DisponibiliteTechnicien } from "./disponibilite-technicien";
import { CLASSES_LIEN } from "@/lib/theme/apparence";

/**
 * LA FICHE D'INTERVENTION (lot 2, D84) — et les quatre actions.
 *
 * ## Le refus s'affiche À LA PLACE de l'action, avec sa raison
 *
 * C'est la consigne d'exploitation, et elle change la forme de cet écran : un
 * bouton refusé n'est pas grisé avec une infobulle, il est **remplacé** par le
 * motif du refus, en oxyde. *Il ne disparaît jamais en silence et ne se
 * contourne pas depuis l'écran.*
 *
 * Et il ne se contourne pas non plus par une requête : les mêmes refus sont
 * tenus par `intervention_cycle_de_vie` en base. Cet écran DIT ce que la base
 * ferait ; il ne le décide pas.
 *
 * ## R2-08 — LA FORME DE FICHE DE LA MAQUETTE, LUE ET NON APPROCHÉE
 *
 * *Mesuré le 11/09/2026 : `max-w-3xl` — 768 px dans une fenêtre de 1700*, et
 * cinq actions empilées à la file sous l'identification. La maquette ne décrit
 * aucune fiche d'intervention, mais elle décrit **une fiche** : `.mach`, deux
 * colonnes `1fr 300px` ; `.dl`, une grille `132px 1fr` à 13 px, étiquettes
 * grises en 12 px et valeurs en demi-gras. *C'est cette FORME qui se reprend,
 * pas son contenu* — l'acceptation du ticket l'écrit ainsi.
 *
 * **Les cinq actions passent en colonne latérale**, et cela ne change rien à
 * leur régime : un refus reste affiché À LA PLACE de l'action, avec sa raison.
 * Ce qui change est qu'on voit désormais l'identification et les actions
 * ENSEMBLE — *on décide d'annuler une intervention en regardant ce qu'elle est,
 * pas en s'en souvenant après avoir défilé.*
 *
 * ## LA MACHINE ÉTAIT ABSENTE DE CETTE FICHE — GAP COMBLÉ (audit du 19/09/2026)
 *
 * *Mesuré : le mot « machine » n'apparaissait nulle part dans ce fichier — pas
 * une donnée vide, un champ qui n'existait pas.* `CHAMPS_LIGNE`
 * (`lib/interventions/depot.ts`) lit pourtant `machines` depuis L2-08a, et
 * `/interventions` les affiche depuis le 18/09/2026. La maquette ne dessine
 * aucune fiche d'intervention (voir R2-08 ci-dessus) : elle ne dit donc rien
 * de ce bloc non plus, et la forme retenue est celle que le registre porte
 * déjà — `machinesAffichees`, reprise telle quelle depuis
 * `../presentation.ts` plutôt que réécrite une troisième fois. Une
 * intervention pouvant porter plusieurs machines (`intervention_machine`),
 * la ligne les joint par une virgule ; aucune ne se dit par le tiret
 * (RG-INT-01 : aucune machine rattachée signifie le site entier, jamais un
 * oubli d'écran).
 */

/**
 * MÉMOÏSÉES PAR REQUÊTE (VISUEL-1, 23/09/2026) — voir le même commentaire sur
 * `lireClientCache` dans `app/(back-office)/clients/[id]/page.tsx`. La
 * session est mémoïsée pour la même raison : sans elle, `contexte` serait un
 * objet différent à chaque appel de `obtenirSession`, et `lireFicheCache` ne
 * dédoublonnerait rien.
 */
const lireFicheCache = cache(lireFicheIntervention);
const sessionCache = cache(async () => obtenirSession(await headers()));

/**
 * LA FENÊTRE DE `DisponibiliteTechnicien` (66-PLANNING-4, SAV-05) — ce n'est
 * pas une règle métier, c'est la portée d'un avertissement d'écran, au même
 * titre que `JOURS_A_VENIR` de `app/(back-office)/absences/page.tsx` qu'elle
 * reprend en valeur sans partager son nom : les deux bornent des choses
 * différentes (l'une une LISTE affichée, l'autre une AFFIRMATION avant envoi).
 */
const JOURS_DISPONIBILITE_TECHNICIEN = 90;

/**
 * LE TITRE D'ONGLET PORTE LE MÊME TITRE QUE LE `<h1>` (VISUEL-1 ; TR-51,
 * 9DR-TP-NAV2-RETOURS-FIL) — `titreDeLaFiche`, jamais recomposé ici.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const session = await sessionCache();
  if (session === null || session.contexte.societeId === null) {
    return { title: t("intervention.titre") };
  }
  const { id } = await params;
  if (!estUuid(id)) {
    return { title: t("intervention.titre") };
  }
  const fiche = await lireFicheCache(session.contexte, id);
  if (fiche === null) {
    return { title: t("intervention.titre") };
  }
  return {
    title: titreDeLaFiche(fiche.ligne, fiche.client),
  };
}

export default async function PageIntervention({
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

  const { id } = await params;
  const parametres = await searchParams;
  const motif = parametres.motif;
  // LE COMPTE-RENDU DES COURRIELS DE PLANIFICATION (AVERTISSEMENTS-1) — des
  // CLÉS, filtrées comme `motif` : une réponse forgée ne doit pas pouvoir
  // faire écrire n'importe quoi à la page (L1-02f). Même mécanisme que la
  // vue planning (`PARAMETRE_AVERTISSEMENT`, `components/planning/pose.tsx`).
  const avertissementsAffiches = [parametres.avertissement ?? []]
    .flat()
    .filter((valeur): valeur is string => typeof valeur === "string")
    .filter(estCleTraduction);
  // LE BANDEAU « INTERVENTION CRÉÉE » (PG-B6-DUREE-A-LA-CREATION) — posé par
  // `versLaFicheApresCreation` (`app/api/interventions/creer/route.ts`),
  // jamais par un autre geste : une simple navigation vers cette même fiche
  // SANS ce paramètre (le bouton « Laisser dans la file » du bandeau lui-même)
  // l'efface, sans qu'aucune requête n'ait à le faire.
  const vientDetreCree = parametres.cree === "1";
  // D'OÙ ON ARRIVE (FICHE-INTERVENTION-1) — une liste FERMÉE, jamais une URL
  // libre : voir `retourFiche` dans `../presentation.ts`.
  const depuis = parametres.depuis;
  const depuisId = parametres.depuis_id;
  // LE REGISTRE TEL QU'ON L'AVAIT LAISSÉ (78-LIENS-2) — voir
  // `retourVersRegistre`, `../presentation.ts`, pour le filtrage.
  const retourRegistre = parametres.retour;
  // L'ONGLET ACTIF (9EE-TP-UX4-1-FICHE-INTERVENTION-2) — une liste FERMÉE,
  // jamais une URL libre : voir `ongletDeLaFiche`, `../presentation.ts`.
  const onglet = ongletDeLaFiche(parametres.onglet);
  // UN IDENTIFIANT MAL FORMÉ EST UN REFUS, JAMAIS UNE PANNE
  // (9EJ-CORRECTIFS-AUDIT-TUILES-ID) — même garde que `clients/[id]`.
  if (!estUuid(id)) {
    notFound();
  }
  const fiche = await lireFicheCache(session.contexte, id);
  if (fiche === null) {
    // Hors périmètre et inexistante rendent LA MÊME chose : les distinguer
    // ferait un oracle (D35, D50).
    notFound();
  }

  const ligne = fiche.ligne;
  const statut = ligne.statut as StatutIntervention;
  // FIGÉE — annulée ou clôturée (`estFige`, `lib/interventions/cycle-de-vie.ts`) :
  // le panneau « Actions » ne rend alors QUE ce qui reste possible (D131,
  // 29-DROITS-1), jamais un bloc dont le verdict refuse.
  const figee = estFige(statut);
  // LAQUELLE FAIRE ENSUITE (93-FICHE-ACTIONS, constat 19) — la seule action
  // que ce statut désigne comme suivante ; les autres se replient dans le
  // panneau « Actions » ci-dessous.
  const principale = actionPrincipale(statut);
  // LA DATE ET L'HEURE PLANIFIÉES, DANS L'EN-TÊTE (FICHE-INTERVENTION-1) —
  // *l'information n°1 d'un planificateur qui ouvre cette fiche*, mesurée
  // absente de l'identification le 23/09/2026. `date_planifiee` est un jour
  // CIVIL (`dateCivile`, jamais de fuseau) ; l'heure, si le créneau en porte
  // une, est lue dans le fuseau de l'AGENCE — `heureDuCreneau`, la MÊME
  // fonction que le planning (§9, 01/09 : jamais une seconde lecture).
  // Aucune date : l'absence se NOMME, elle ne se tait jamais derrière un tiret.
  const heurePlanifiee = heureDuCreneau(ligne, fiche.fuseau);
  // HREF ET LIBELLÉ COMPOSÉS ENSEMBLE (`retourFiche`, `../presentation.ts`) —
  // jamais deux lectures séparées qui pourraient diverger.
  const retour = retourFiche(
    { depuis, depuisId, retour: retourRegistre },
    ligne,
  );
  // LA DÉCISION EST PRISE ICI, UNE FOIS, et le bloc plus bas ne fait que la
  // rendre — *une règle écrite dans le JSX ne s'éprouve qu'en montant un
  // rendu*, et c'est la raison pour laquelle ce critère vit dans un module.
  const montants = accesAuxMontants(session.contexte.role);
  // LE DROIT D'AFFECTER / DE DÉPLACER (extension de la revue Codex de la PR
  // #267, de ma propre initiative, 20/09/2026) — la remarque ne citait que
  // `/interventions/nouvelle`, mais le MÊME défaut existe ici : les deux
  // sélecteurs technicien de cette fiche ont été introduits par LE MÊME LOT
  // (chantier TECH-1), sur du code que cette PR touche déjà — ce n'est donc
  // pas un défaut préexistant hors périmètre. Lu depuis la matrice
  // (`peut(role, capacité)`), la MÊME capacité que celle que les routes
  // `/api/interventions/[id]/affecter` et `.../deplacer` exigent déjà
  // côté serveur — jamais une comparaison de rôle inventée ici.
  const peutQualifierAffecter =
    session.contexte.role !== null &&
    peut(session.contexte.role, "qualifier_affecter");
  // `peutPleinement`, pas `peut` (04/10/2026, 9DKA-REPRISE-9DK) — depuis TR-5
  // (D136), le technicien porte un ○ sur `modifier_planning` pour déclarer SA
  // PROPRE absence ; ce ○ n'a jamais été pensé pour « Transmettre » ni pour
  // affecter un AUTRE technicien sur CETTE fiche (D131 : le bloc se masque ou
  // se refuse selon la capacité, jamais selon la fonction appelante). Les
  // routes qu'il gouverne (`.../transmettre`, `.../deplacer`, `.../verdict-pose`,
  // `.../note-interne`) exigent donc désormais, elles aussi, l'accès complet.
  const peutModifierLePlanning =
    session.contexte.role !== null &&
    peutPleinement(session.contexte.role, "modifier_planning");
  // ── D131 (23/09/2026, DROITS-1) — LE BLOC QUI NE S'AFFICHE PAS ──────────
  //
  // *Un bloc que le rôle courant ne peut pas accomplir ne s'affiche pas*,
  // plutôt qu'un bouton qui mène à un refus — c'est la consigne du ticket, et
  // elle change le RÉGIME de ces trois blocs par rapport aux autres : un
  // refus de STATUT (intervention clôturée, par exemple) continue de
  // s'afficher en oxyde à la place de l'action ; un refus de CAPACITÉ ou de
  // PÉRIMÈTRE fait disparaître le bloc entier — la même distinction que
  // « Affecter » applique déjà à `qualification_requise`.
  //
  // Lu depuis la matrice (`accesSurCetteIntervention`, qui compose `niveau`
  // et le technicien affecté de CETTE ligne), jamais une seconde liste de
  // rôles écrite ici.
  const contexteActif: ContexteActif | null =
    session.contexte.role === null ? null : (session.contexte as ContexteActif);
  const peutClore =
    contexteActif !== null &&
    accesSurCetteIntervention(
      contexteActif,
      "cloturer_intervention",
      ligne.technicien_id,
    );
  const peutSuspendreOuReprendre =
    contexteActif !== null &&
    accesSurCetteIntervention(
      contexteActif,
      "suspendre_reprendre_intervention",
      ligne.technicien_id,
    );
  const peutAnnulerCetteIntervention =
    contexteActif !== null &&
    accesSurCetteIntervention(
      contexteActif,
      "annuler_intervention",
      ligne.technicien_id,
    );
  // LE VERDICT DE CLÔTURE, TRADUIT UNE SEULE FOIS (9ES-TP-UX4-3-FICHE-GESTES-1)
  // — `DialogueCloturer` affiche le motif à la place du champ si la base le
  // refuserait encore (aucun temps mesuré), le bouton d'action désactivé :
  // on voit le champ ET pourquoi on ne peut pas encore valider.
  const verdictCloturer = peutCloturer(statut, ligne.temps_mesure_min);
  const verdictCloturerAffiche = {
    refuse: verdictCloturer.refuse,
    raison:
      verdictCloturer.refuse && estCleTraduction(verdictCloturer.cle)
        ? t(verdictCloturer.cle)
        : "",
  };
  // LE LIEN MOBILE VERS L'ACTION PRINCIPALE (9AD-GR13-FICHE-TELEPHONE) —
  // `principale` seul ne suffit pas : « reprendre » et « clôturer » ne
  // rendent leur bloc que si `peutSuspendreOuReprendre` / `peutClore`
  // l'autorisent (sinon le bloc est ABSENT, et l'ancre qu'il porterait
  // n'existe pas). « affecter » rend toujours son bloc (refusé ou non) dès
  // que ce statut lui donne la main. « planifier », depuis D153 (TP-S3,
  // IN-29), suit la MÊME règle que « reprendre »/« clôturer » : son bloc est
  // ABSENT sans `modifier_planning`, donc son ancre aussi.
  const principaleRendue =
    (principale === "planifier" && peutModifierLePlanning) ||
    principale === "transmettre" ||
    (principale === "reprendre" && peutSuspendreOuReprendre) ||
    (principale === "cloturer" && peutClore);
  // LA LISTE NOMINATIVE N'EST DEMANDÉE À L'ANNUAIRE QUE SI UN FORMULAIRE EN A
  // L'USAGE — jamais par défaut : c'est la lecture, pas seulement le rendu,
  // qui fuyait (même raisonnement qu'à la création).
  const proposerUneListeDeTechniciens =
    peutQualifierAffecter || peutModifierLePlanning;
  // LE NOM, JAMAIS L'IDENTIFIANT (I10, D-04) — voir `technicienAfficheSurLaFiche`.
  //
  // **DEPUIS LE CHANTIER TECH-1 (20/09/2026), CETTE LECTURE PORTE AUSSI LES
  // TECHNICIENS ACTIFS**, mais SEULEMENT quand `proposerUneListeDeTechniciens`
  // — pour remplir le `<select>` d'« Affecter » et de « Déplacer », qui
  // remplace un champ texte nu. *Un technicien inactif n'entre pas dans la
  // liste PROPOSÉE à une nouvelle saisie* — même règle que
  // `/interventions/nouvelle` —, **mais le technicien déjà affecté à cette
  // intervention garde sa colonne dans l'annuaire même s'il est devenu
  // inactif entre-temps** : sans quoi son nom, affiché juste au-dessus par
  // `technicienAfficheSurLaFiche`, disparaîtrait du `<select>` en dessous —
  // deux lectures d'un même fait qui se contrediraient sur le même écran.
  const techniciensActifs = proposerUneListeDeTechniciens
    ? await avecContexteApplicatif(session.contexte, (tx) =>
        tx.technicien.findMany({
          where: { actif: true },
          select: { utilisateur_id: true },
          orderBy: { utilisateur_id: "asc" },
        }),
      )
    : [];
  const annuaire = await avecContexteApplicatif(session.contexte, (tx) =>
    annuaireDesPersonnes(tx, [
      ...techniciensActifs.map((technicien) => technicien.utilisateur_id),
      ...(ligne.technicien_id === null ? [] : [ligne.technicien_id]),
      ...(fiche.tempsValidePar === null ? [] : [fiche.tempsValidePar]),
    ]),
  );
  const nomValidateur = ((): string | null => {
    if (fiche.tempsValidePar === null) {
      return null;
    }
    const designation = annuaire(fiche.tempsValidePar);
    return designation.etat === "nom" ? designation.nom : "—";
  })();
  const nomTechnicien = technicienAfficheSurLaFiche(
    ligne.technicien_id,
    annuaire,
  );
  // ── « AFFECTER » DIT LE BLOCAGE AVANT LE CHOIX (PLANNING-1, RG-PLA-06,
  // 22/09/2026). *Mesuré* : la liste était nue, le refus n'arrivait qu'au
  // dépôt, après la tentative. Les blocages sont lus À LA DATE de
  // l'intervention — la seule que ce formulaire engage —, sous le contexte
  // cloisonné (forme « interne », D94, même lecture que `/absences`). La
  // borne SQL est le jour ; le critère est `absenceCouvrant`, dans
  // `optionsDAffectation`, et lui seul (§9, 01/09).
  //
  // « DÉPLACER » garde la liste NUE : sa date se saisit dans le même
  // formulaire, et un suffixe « à cette date » y parlerait d'une date que
  // l'utilisateur est en train de changer — une affirmation sur un état
  // qu'on n'a pas observé (§9, 07/09).
  const blocagesALaDate =
    proposerUneListeDeTechniciens && ligne.date_planifiee !== null
      ? await absencesDeLaPeriode(
          session.contexte,
          ligne.date_planifiee,
          ligne.date_planifiee,
        )
      : [];
  const optionsAffectation = optionsDAffectation(
    techniciensActifs,
    annuaire,
    blocagesALaDate,
    ligne.date_planifiee,
  );
  const optionsTechniciens = optionsDAffectation(
    techniciensActifs,
    annuaire,
    [],
    null,
  );
  // « TROUVER UN CRÉNEAU » DEPUIS LA FICHE (PG-B3-TROUVER-CRENEAU-FICHE) — LA
  // MÊME FENÊTRE que le planning (`components/planning/fenetre-pose.tsx`,
  // import, aucune copie), pré-remplie de ce que la fiche connaît déjà.
  //
  // Le jour de départ n'est PAS une valeur métier : c'est la date de
  // l'intervention si elle en a une, sinon le jour courant de la société —
  // un simple repère d'affichage, modifiable dans la fenêtre
  // (`jourChoisissable`). `optionsTechniciens` porte déjà le nom nu, sans
  // suffixe d'agenda bloqué (aucune date connue à ce stade) : exactement la
  // forme `{id, nom}` que `FenetrePose` attend.
  const jourInitialCreneau =
    ligne.date_planifiee !== null
      ? ligne.date_planifiee.toISOString().slice(0, 10)
      : cleJour(jourDe(maintenant(fiche.fuseau).local));
  const techniciensPourCreneau = optionsTechniciens.map((option) => ({
    id: option.valeur,
    nom: option.libelle,
  }));
  // « + CRÉER ICI » (PG-D5-CREER-ICI) — la case D'OÙ L'ON VIENT, lue
  // SEULEMENT quand le bandeau de création s'affiche (`vientDetreCree`,
  // ligne `a_planifier`, condition du bandeau plus bas) : ailleurs, cette
  // lecture ne servirait à rien. Le technicien n'est retenu que s'il figure
  // dans `techniciensPourCreneau` (LIENS-1) — sinon ignoré en silence,
  // exactement comme un `?site=` forgé ailleurs dans ce dépôt.
  const caseDePlanning =
    vientDetreCree && statut === "a_planifier"
      ? caseDepuisParametres(parametres)
      : null;
  const technicienDeLaCase =
    caseDePlanning !== null &&
    techniciensPourCreneau.some((t) => t.id === caseDePlanning.technicienId)
      ? caseDePlanning.technicienId
      : null;
  // ── « PLANIFIER » ET « DÉPLACER » LE DISENT AUSSI, AVANT L'ENVOI
  // (66-PLANNING-4, SAV-05) ────────────────────────────────────────────────
  //
  // Ces deux formulaires saisissent la date DANS le même envoi : contrairement
  // à « Affecter », leur sélecteur technicien ne peut pas être marqué au rendu
  // serveur — `optionsDAffectation` ne connaît pas encore la date choisie.
  // `DisponibiliteTechnicien`, un composant client, la recalcule au
  // changement de champ, sur ces MÊMES absences : un aller simple vers le
  // client, jamais une seconde écriture de la règle (§9, 01/09) — le refus
  // reste entièrement au dépôt et au déclencheur.
  //
  // Aucun sélecteur technicien à annoter sans `peutModifierLePlanning`, et
  // une fiche figée n'affiche plus aucun des deux formulaires : la lecture
  // serait un aller pour rien.
  const fenetreDisponibiliteTechnicien =
    peutModifierLePlanning && !figee
      ? {
          du: instantDuJour(jourDe(maintenant(fiche.fuseau).local)),
          au: instantDuJour(
            jourDe(maintenant(fiche.fuseau).local),
            JOURS_DISPONIBILITE_TECHNICIEN,
          ),
        }
      : null;
  const absencesFenetreDisponibilite =
    fenetreDisponibiliteTechnicien === null
      ? []
      : await absencesDeLaPeriode(
          session.contexte,
          fenetreDisponibiliteTechnicien.du,
          fenetreDisponibiliteTechnicien.au,
        );
  const disponibiliteTechnicien =
    fenetreDisponibiliteTechnicien === null
      ? null
      : {
          absences: absencesFenetreDisponibilite.map((absence) => ({
            id: absence.id,
            utilisateurId: absence.utilisateur_id,
            du: absence.du.toISOString(),
            au: absence.au.toISOString(),
          })),
          fenetre: {
            du: fenetreDisponibiliteTechnicien.du.toISOString(),
            au: fenetreDisponibiliteTechnicien.au.toISOString(),
          },
        };
  // LE BLOC « DISPONIBILITÉ » DES DIALOGUES DE L'EN-TÊTE (9ES-TP-UX4-3-FICHE-
  // GESTES-2) — une FONCTION, jamais un élément mémoïsé une seule fois : deux
  // dialogues distincts (« Planifier à la main », « Déplacer ») en posent
  // chacun leur propre instance de `DisponibiliteTechnicien`, dans LEUR
  // propre `<form>` (le composant se retrouve par `closest("form")`).
  const blocDisponibilite = (): React.ReactNode =>
    disponibiliteTechnicien === null ? undefined : (
      <>
        <p className="text-app-encre-faible text-12 font-bold">
          {t("intervention.disponibilite_technicien.fenetre")}
        </p>
        <DisponibiliteTechnicien
          absences={disponibiliteTechnicien.absences}
          fenetre={disponibiliteTechnicien.fenetre}
        />
      </>
    );
  // « TRANSMETTRE » (QG-5, D141, 9CO-PG-G14A-TRANSMETTRE) — MÊME capacité que
  // « Planifier »/« Déplacer », `modifier_planning` : c'est elle que la
  // route `.../transmettre` exige déjà côté serveur. Un refus de STATUT ou
  // de manque (date/heure/durée/technicien) prend la place de l'action,
  // nommé par `peutTransmettre`, jamais un message générique.
  const verdictTransmettre: Verdict = peutModifierLePlanning
    ? peutTransmettre({
        statut,
        technicienId: ligne.technicien_id,
        datePlanifiee: ligne.date_planifiee,
        debutMinutes: ligne.creneau_debut,
        dureeMin: ligne.duree_estimee_min,
      })
    : { refuse: true, cle: "intervention.refus.qualification_requise" };
  // LE DIALOGUE « TRANSMETTRE » DE L'EN-TÊTE (9ES-TP-UX4-3-FICHE-GESTES-2,
  // D195) — traduit UNE SEULE FOIS, comme `verdictCloturerAffiche` : le motif
  // s'affiche à côté du bouton désactivé, jamais à sa place.
  const verdictTransmettreAffiche = {
    refuse: verdictTransmettre.refuse,
    raison:
      verdictTransmettre.refuse && estCleTraduction(verdictTransmettre.cle)
        ? t(verdictTransmettre.cle)
        : "",
  };
  // LES MACHINES DU SITE DE L'INTERVENTION (chantier INT-MACHINE 2.2) — connu
  // côté serveur, aucun filtrage JS n'est nécessaire ici (à la différence du
  // formulaire de création, où le site se choisit APRÈS le chargement de la
  // page).
  const machinesDuSite = await machinesDesSites(session.contexte, [
    ligne.site_id,
  ]);
  // LE OU LES MACHINES DE L'INTERVENTION (audit du 19/09/2026) — GAP COMBLÉ :
  // cette fiche ne portait aucun champ machine, alors que `CHAMPS_LIGNE` lit
  // déjà `ligne.machines`.
  //
  // **LA FAMILLE Y MANQUAIT ENCORE** (AFFICHAGE-MATERIEL-1, 23/09/2026) :
  // *mesuré en production le 23/09/2026, « il manque la famille sur la page
  // intervention »* — la fiche lisait `marque référence` (`libellesDesMachines`,
  // la forme du registre et du bon imprimable), jamais la famille ni le
  // numéro de série. `libelleMaterielComplet` (`lib/machines/presentation.ts`)
  // compose désormais la même forme complète que la carte de planning — une
  // seule écriture du critère, jamais une troisième forme (§9, 01/09).
  const donneesMaterielFiche = await donneesMaterielDesMachines(
    session.contexte,
    ligne.machines.map((m) => m.machine_id),
  );
  const libellesMachines = new Map(
    [...donneesMaterielFiche].map(([machineId, donnees]) => [
      machineId,
      libelleMaterielComplet(donnees),
    ]),
  );
  // PARTAGÉE PAR L'EN-TÊTE ET LA CARTE « MACHINE » DE L'ONGLET RÉSUMÉ
  // (9EE-TP-UX4-1-FICHE-INTERVENTION-2) — même lecture, jamais recalculée
  // deux fois (§9, 01/09).
  const machinesListees = machinesIdentifiees(ligne, libellesMachines);
  // LE MINI-FORMULAIRE « AJOUTER UNE MACHINE » (chantier INT-MACHINE 2.2) —
  // même garde qu'avant ce lot, extraite pour que la carte « Machine » de
  // l'onglet Résumé décide seule de son affichage, sans la répéter.
  const peutAjouterMachine =
    !figee && ligne.machines.length === 0 && peutQualifierAffecter;

  // ── LES DONNÉES RÉELLES (50-INTERVENTIONS-2) — trois lectures indépendantes,
  // chacune sous SON PROPRE contexte applicatif : même raisonnement que
  // `lireBonIntervention` (`lib/interventions/bon.ts`), qui ouvre les siennes
  // hors de la transaction de `lireFicheIntervention` pour la même raison —
  // `avecContexteApplicatif` attend un `PrismaClient`, jamais un
  // `Prisma.TransactionClient` déjà ouvert.
  const [segments, pauses, prestationsRealiseesFiche, signatureFiche] =
    await Promise.all([
      segmentsDeLIntervention(session.contexte, ligne.id),
      pausesDeLIntervention(session.contexte, ligne.id),
      prestationsRealisees(session.contexte, ligne.id),
      derniereSignature(session.contexte, ligne.id),
    ]);
  const parametresReprise = {
    creeLe: fiche.creeLe,
    pauses: (pauses ?? []).map((p) => ({ debut: p.debut, fin: p.fin })),
    clotureeLe: fiche.clotureeLe,
    annuleeLe: fiche.annuleeLe,
  };
  const chronologie = chronologieDeLaFiche(parametresReprise);
  // FICHE REPRISE D'UN IMPORT (IN-23, audit du 28/09/2026) — même critère
  // que `chronologie` ci-dessus, jamais un second calcul (§9, 01/09).
  const estReprise = estRepriseDunImport(parametresReprise);
  const datePlanifieeAffichee = resumeDuCreneau(ligne, fiche.fuseau, {
    avecAnnee: estReprise,
  });
  // LA MENTION « DÉPLANIFIÉE — ABSENCE DE X LE JJ/MM » (9CC-DEPLANIFIEE-1) —
  // `fiche.deplanification` porte déjà le nom résolu (`lireFicheIntervention`,
  // `lib/interventions/depot.ts`), jamais l'identifiant brut (I10).
  const mentionDeplanification =
    fiche.deplanification === null
      ? null
      : mentionDeplanifiee(
          {
            statut: ligne.statut,
            deplanifiee_date: fiche.deplanification.date,
            deplanifiee_creneau_debut: fiche.deplanification.creneauDebut,
            deplanifiee_creneau_fin: fiche.deplanification.creneauFin,
            duree_estimee_min: ligne.duree_estimee_min,
          },
          fiche.deplanification.absentNom ?? "—",
          fiche.fuseau,
        );

  // ── L'EN-TÊTE (9EE-TP-UX4-1-FICHE-INTERVENTION-1, QE-9 (a)) ──────────────
  //
  // « Habilitation <code> exigée sur le site » (Q8 du pilote, 08/10/2026,
  // amendé R6 de l'addendum recalage 2 du 08/10/2026,
  // 9EE-TP-UX4-1-FICHE-INTERVENTION-2) — la bande rouge du bandeau d'état n'a
  // besoin que des exigences BLOQUANTES, sur une fiche encore `a_planifier` ;
  // la carte « Sur place » de l'onglet Résumé a besoin de la liste ENTIÈRE
  // (bloquantes ET avertissements). UN SEUL appel pour les deux usages,
  // jamais deux lectures d'un même critère (§9, 01/09).
  const ongletResume = onglet === "resume";
  const exigencesSite =
    statut === "a_planifier" || ongletResume
      ? await exigencesDuSite(session.contexte, ligne.site_id)
      : [];
  const exigencesBloquantes = exigencesSite.filter(
    (exigence) => exigence.bloquant,
  );
  // ── LA CARTE « SUR PLACE » (9EE-TP-UX4-1-FICHE-INTERVENTION-2) — lue
  // SEULEMENT sur l'onglet Résumé, où elle s'affiche seule (R2 de l'addendum
  // recalage 2) : une lecture qu'aucun onglet actif ne montre ne sert à rien.
  const siteDeLIntervention = ongletResume
    ? await lireSite(session.contexte, ligne.site_id)
    : null;
  const adresseSite = formatAdresseSite(
    siteDeLIntervention?.adresse ?? null,
    siteDeLIntervention?.commune ?? null,
  );
  const horairesSite = horairesAffiches(siteDeLIntervention?.horaires ?? null);
  // LE DONNEUR D'ORDRE — LA MÊME LECTURE que les courriels de planification
  // et « Qui sera prévenu » (9DN, D165) : `destinataireClient`, site puis
  // client, RÉUTILISÉE, jamais recopiée (§9, 01/09).
  const contactsClientPourDonneurOrdre = ongletResume
    ? await contactsDuClient(session.contexte, ligne.client_id)
    : [];
  const donneurDOrdre = destinataireClient(
    contactsClientPourDonneurOrdre,
    ligne.site_id,
  );
  // « CRÉÉE DEPUIS » — une demande et une observation VGP ne portent jamais
  // les deux à la fois sur une même fiche (`planifierLObservation`,
  // `lib/vgp/observations.ts`, ne pose jamais `demande_id`) : la seconde
  // lecture ne sert que si la première ne trouve rien à nommer.
  const numeroDemandeOrigine =
    ongletResume && ligne.demande_id !== null
      ? await numeroDeLaDemande(session.contexte, ligne.demande_id)
      : null;
  const observationOrigine =
    ongletResume && ligne.demande_id === null
      ? await observationLieeAIntervention(session.contexte, ligne.id)
      : null;
  const origineDeLaFiche: React.ReactNode | null =
    ligne.demande_id !== null ? (
      <Link href={`/demandes/${ligne.demande_id}`} className={CLASSES_LIEN}>
        {libelleOrigineDemande(numeroDemandeOrigine)}
      </Link>
    ) : observationOrigine !== null ? (
      <>
        {observationOrigine.libelle}{" "}
        {contenuMachines([
          {
            machineId: observationOrigine.machineId,
            libelle: libellesMachines.get(observationOrigine.machineId) ?? null,
          },
        ])}
      </>
    ) : null;
  // « COMPTEUR EN MARCHE DEPUIS HH:MM » — le même segment ouvert que
  // `Realisation` affiche déjà plus bas, jamais une seconde lecture.
  const segmentOuvert = (segments ?? []).find((s) => s.fin === null) ?? null;
  const segmentOuvertDepuis =
    segmentOuvert === null
      ? null
      : heureDuCreneau({ creneau_debut: segmentOuvert.debut }, fiche.fuseau);
  const instantFiche = maintenant(fiche.fuseau);
  const maintenantFiche = {
    instant: instantFiche.instant,
    local: jourDe(instantFiche.local),
  };
  const bandeauFiche = estReprise
    ? null
    : bandeauDeLaFiche(
        {
          statut,
          creeLe: fiche.creeLe,
          deplanifieeLe: fiche.deplanifieeLe,
          priorite: ligne.priorite,
          exigencesBloquantes,
          mentionDeplanifiee: mentionDeplanification,
          datePlanifiee: ligne.date_planifiee,
          aDesSegments: (segments ?? []).length > 0,
          segmentOuvertDepuis,
          motifSuspension: ligne.motif_suspension,
          pieceAttendue: pieceAttendueAffichee(ligne),
          suspendueLe: ligne.suspendue_le,
          tempsMesureMin: ligne.temps_mesure_min,
        },
        fiche.fuseau,
        maintenantFiche,
      );
  const etapesFiche: readonly EtapeFrise[] = etapesDeLIntervention(
    statut,
    estReprise,
  ).map((etape) => ({
    cle: etape.cle,
    libelle: t(`statut.${etape.cle}`),
    etat: etape.etat,
    precision: etape.precision === undefined ? undefined : t(etape.precision),
  }));
  const titreNatureClient = `${t(`type_intervention.${ligne.type}`)}${t("ponctuation.point_median")}${fiche.client ?? TIRET}`;
  const faitsFiche: readonly FaitFiche[] = [
    {
      cle: "site",
      icone: "pin",
      libelle: mot("site"),
      valeur: contenuSite(fiche.lieu, ligne.site_id),
    },
    {
      cle: "machine",
      icone: "machine",
      libelle: t("intervention.machine"),
      valeur: contenuMachines(machinesIdentifiees(ligne, libellesMachines)),
    },
    {
      cle: "creneau",
      icone: "calendar",
      libelle: t("intervention.fait.creneau"),
      valeur: datePlanifieeAffichee,
    },
    {
      cle: "technicien",
      icone: "user",
      libelle: t("intervention.technicien"),
      valeur: nomTechnicien,
    },
    ...(estReprise
      ? []
      : [
          {
            cle: "creee",
            icone: "clock" as const,
            libelle: t("intervention.fait.creee"),
            valeur: dateHeureLocale(fiche.creeLe, fiche.fuseau),
          },
        ]),
  ];

  return (
    <Page
      chemin="/interventions"
      surtitre={surtitreDeLaFiche(ligne)}
      titre={titreNatureClient}
      pastilles={
        <span
          data-hors-bandeau=""
          className="inline-flex flex-wrap items-center gap-2"
        >
          <span
            className={`rounded-full px-2 py-0.5 text-12 font-bold ${CLASSES_STATUT[statut]}`}
          >
            {t(`statut.${statut}`)}
          </span>
          <Badge ton={tonDePriorite(ligne.priorite)}>
            {t(`priorite.${ligne.priorite}`)}
          </Badge>
        </span>
      }
      faits={<EnTeteFiche faits={faitsFiche} />}
      actions={
        <span className="flex w-full flex-wrap items-center gap-3 min-[901px]:w-auto">
          {/*
            « TROUVER UN CRÉNEAU » + « PLANIFIER À LA MAIN » (9ES-TP-UX4-3-
            FICHE-GESTES-2, D195) — l'action PRINCIPALE d'une `a_planifier`
            (`actionPrincipale`), au bouton PRIMAIRE existant (`TrouverCreneau`,
            inchangé) plutôt qu'à un lien d'ancre : la carte Actions qui
            portait le formulaire a quitté la fiche (B1). « Planifier à la
            main » en reste la voie de repli, en dialogue. D153 (TP-S3, IN-29)
            — masqués ENTIER sans `modifier_planning`, jamais montrés refusés.
          */}
          {principale === "planifier" && principaleRendue ? (
            <>
              <TrouverCreneau
                interventionId={ligne.id}
                libelle={referenceAffichee(ligne)}
                dureeMinInitiale={ligne.duree_estimee_min}
                technicienIdInitial={ligne.technicien_id}
                jourInitial={jourInitialCreneau}
                fuseau={fiche.fuseau}
                techniciens={techniciensPourCreneau}
              />
              <DialoguePlanifier
                action={`/api/interventions/${ligne.id}/deplacer`}
                note={t("intervention.planification.explication")}
                options={optionsAffectation}
                libelleOptionVide={t("intervention.aucun_technicien")}
                disponibilite={blocDisponibilite()}
              />
            </>
          ) : null}
          {/*
            « TRANSMETTRE » (QG-5, D141) ET « DÉPLACER » (R2-19), EN DIALOGUES
            (9ES-TP-UX4-3-FICHE-GESTES-2, D195) — « Transmettre » est l'action
            PRINCIPALE d'une `planifiee` (`actionPrincipale`) ; « Déplacer »
            reste secondaire sur `planifiee` ET `affectee` (la table du
            ticket : aucune des deux n'apparaît ailleurs, contrairement à
            l'ancien bloc de la carte Actions qui se rendait sur tout statut
            non figé — écart nommé, D195).
          */}
          {principale === "transmettre" ? (
            <DialogueTransmettre
              client={fiche.client ?? TIRET}
              creneau={resumeDuCreneau(ligne, fiche.fuseau)}
              technicien={nomTechnicien}
              action={`/api/interventions/${ligne.id}/transmettre`}
              verdict={verdictTransmettreAffiche}
            />
          ) : null}
          {statut === "planifiee" || statut === "affectee" ? (
            <DialogueDeplacer
              client={fiche.client ?? TIRET}
              action={`/api/interventions/${ligne.id}/deplacer`}
              note={t("intervention.deplacement.explication")}
              dateInitiale={ligne.date_planifiee?.toISOString().slice(0, 10)}
              heureInitiale={heurePlanifiee ?? undefined}
              dureeInitiale={ligne.duree_estimee_min?.toString()}
              technicien={
                peutModifierLePlanning
                  ? {
                      options: optionsTechniciens,
                      libelleOptionVide: t("intervention.aucun_technicien"),
                      valeurParDefaut: ligne.technicien_id ?? undefined,
                    }
                  : undefined
              }
              trouverCreneau={
                <TrouverCreneau
                  interventionId={ligne.id}
                  libelle={referenceAffichee(ligne)}
                  dureeMinInitiale={ligne.duree_estimee_min}
                  technicienIdInitial={ligne.technicien_id}
                  jourInitial={jourInitialCreneau}
                  fuseau={fiche.fuseau}
                  techniciens={techniciensPourCreneau}
                />
              }
              disponibilite={blocDisponibilite()}
            />
          ) : null}
          {/*
            LES GESTES D'AVANCEMENT, SELON LE STATUT (9ES-TP-UX4-3-FICHE-GESTES-1,
            décision n° 63 d'Alexis du 08/10/2026, AMENDE D182 et D183 R1) — un
            bouton PAR GESTE PERMIS (statut ET capacité), jamais un bouton pour
            un refus de statut : la maquette n'affiche que ce qui est permis, la
            route refuse toujours le reste (`annulerIntervention`, `cloturerIntervention`).
          */}
          {statut === "en_cours" && peutSuspendreOuReprendre ? (
            <DialogueSuspendre
              reference={referenceAffichee(ligne)}
              action={`/api/interventions/${ligne.id}/suspendre`}
            />
          ) : null}
          {statut === "suspendue" && peutSuspendreOuReprendre ? (
            <form
              action={`/api/interventions/${ligne.id}/reprendre`}
              method="post"
            >
              <Button type="submit" size="sm">
                {t("intervention.action.reprendre")}
              </Button>
            </form>
          ) : null}
          {statut === "terminee" && peutClore ? (
            <DialogueCloturer
              reference={referenceAffichee(ligne)}
              action={`/api/interventions/${ligne.id}/cloturer`}
              tempsMesureMin={ligne.temps_mesure_min}
              verdict={verdictCloturerAffiche}
            />
          ) : null}
          {/*
            LE BON D'INTERVENTION DEVIENT L'ACTION PRINCIPALE D'UNE CLÔTURÉE
            (B3, 9ES-TP-UX4-3-FICHE-GESTES-1) — plus un lien secondaire isolé.
            `peutGenererLeBon` reste le MÊME verdict que la page du bon
            applique elle-même (§9, 01/09 : deux lectures d'un même critère ne
            doivent jamais diverger) ; il est toujours permis ici (deux seuls
            statuts, `cycle-de-vie.ts`), donc aucun motif de refus à montrer.
          */}
          {statut === "cloturee" && !peutGenererLeBon(statut).refuse ? (
            <LienPrimaire
              href={`/interventions/${ligne.id}/bon`}
              className="w-full min-[901px]:w-fit"
            >
              {t("intervention.bon.titre")}
            </LienPrimaire>
          ) : null}
          {/*
            LE MENU « ⋯ » (B3, complété par 9ES-TP-UX4-3-FICHE-GESTES-2,
            D195) — « Bon d'intervention » sur une terminée (le lien isolé
            d'avant disparaît, il est ICI) ; sinon « Changer de technicien… »
            (statuts non figés hors `a_planifier`/`terminee`, capacité
            `qualifier_affecter` — « Affecter » n'existe pas dans la
            maquette, le glossaire donne ce mot) ET « Annuler… », ensemble,
            tant que le rôle en a la capacité. Aucun menu sur une figée
            (clôturée, annulée) : il n'y aurait rien à y mettre.
          */}
          {(() => {
            const avecBon =
              statut === "terminee" && !peutGenererLeBon(statut).refuse;
            const avecChangerTechnicien =
              !avecBon &&
              peutQualifierAffecter &&
              (statut === "planifiee" ||
                statut === "affectee" ||
                statut === "en_cours" ||
                statut === "suspendue");
            const avecAnnuler =
              !avecBon && !figee && peutAnnulerCetteIntervention;
            if (!avecBon && !avecChangerTechnicien && !avecAnnuler) {
              return null;
            }
            return (
              <MenuPlus>
                {!avecBon ? null : (
                  <Link
                    href={`/interventions/${ligne.id}/bon`}
                    role="menuitem"
                    className="hover:bg-app-fond flex items-center gap-2.5 rounded-md px-2.5 py-2 text-13 font-bold"
                  >
                    {t("intervention.bon.titre")}
                  </Link>
                )}
                {!avecChangerTechnicien ? null : (
                  <DialogueChangerTechnicien
                    reference={referenceAffichee(ligne)}
                    action={`/api/interventions/${ligne.id}/affecter`}
                    options={optionsAffectation}
                    libelleOptionVide={t("intervention.aucun_technicien")}
                    valeurParDefaut={ligne.technicien_id ?? undefined}
                  />
                )}
                {!avecAnnuler ? null : (
                  <DialogueAnnuler
                    reference={referenceAffichee(ligne)}
                    action={`/api/interventions/${ligne.id}/annuler`}
                  />
                )}
              </MenuPlus>
            );
          })()}
          <Link
            href={retour.href}
            className="text-app-encre-faible text-13 font-bold"
          >
            {retour.libelle}
          </Link>
        </span>
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

      {avertissementsAffiches.map((cle) => (
        <p
          key={cle}
          data-avertissement={cle}
          role="status"
          className={`mb-4 rounded-md border px-3.5 py-2.5 text-13 font-bold ${CLASSES_TON[tonDeLAvertissement(cle)]}`}
        >
          {t(cle)}
        </p>
      ))}

      {!vientDetreCree || statut !== "a_planifier" ? null : (
        <div
          data-banniere-creation
          role="status"
          className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3.5 py-2.5 text-13 font-bold ${CLASSES_TON.succes}`}
        >
          <span>{t("intervention.creation.bandeau_cree")}</span>
          <span className="flex flex-wrap gap-2">
            <TrouverCreneau
              interventionId={ligne.id}
              libelle={referenceAffichee(ligne)}
              dureeMinInitiale={ligne.duree_estimee_min}
              technicienIdInitial={technicienDeLaCase ?? ligne.technicien_id}
              jourInitial={
                caseDePlanning !== null
                  ? cleJour(caseDePlanning.jour)
                  : jourInitialCreneau
              }
              fuseau={fiche.fuseau}
              techniciens={techniciensPourCreneau}
              libelleBouton="intervention.creation.planifier_maintenant"
              ouverteAuDepart={caseDePlanning !== null}
            />
            <Link
              href={`/interventions/${ligne.id}`}
              className="border-app-bord text-app-encre-faible hover:bg-app-fond flex min-h-11 items-center rounded-md border px-2.5 text-12 font-bold sm:min-h-0 sm:py-1"
            >
              {t("intervention.creation.laisser_dans_la_file")}
            </Link>
          </span>
        </div>
      )}

      {/*
        LE BANDEAU D'UNE FICHE REPRISE D'UN IMPORT (IN-23, audit du
        28/09/2026) — ton neutre (jetons `app-bleu-*`, déjà posés pour
        `planifiee`/`affectee` dans `lib/theme/statuts.ts`) : l'archive
        n'est pas une anomalie, elle ne prend ni le vert du succès ni
        l'orange de l'avertissement.
      */}
      {estReprise && fiche.clotureeLe !== null ? (
        <div
          data-bandeau-reprise
          role="status"
          className="border-app-bleu-bord bg-app-bleu-fond text-app-bleu-encre mb-4 rounded-md border px-3.5 py-2.5 text-13 font-bold"
        >
          {texteBandeauReprise(fiche.clotureeLe)}
        </div>
      ) : null}

      {/*
        LE BANDEAU D'ÉTAT (9EE-TP-UX4-1-FICHE-INTERVENTION-1, maquette du
        28/09) — `null` sur une fiche REPRISE d'un import (bandeau ci-dessus,
        inchangé), sur `affectee` sans retard, et sur `cloturee`/`annulee`.
      */}
      {bandeauFiche === null ? null : (
        <BandeauEtat
          ton={bandeauFiche.ton}
          titre={bandeauFiche.titre}
          texte={bandeauFiche.texte}
          className="mb-4"
        />
      )}

      {/*
        LA FRISE D'ÉTAPES (D8, 9EE-TP-UX4-1-FICHE-INTERVENTION-1) — absente
        sur une ANNULÉE ou une fiche REPRISE d'un import (`etapesFiche` est
        alors vide, `FriseEtapes` ne rend rien).
      */}
      <FriseEtapes
        etapes={etapesFiche}
        etapeSur={{
          prefixe: t("intervention.frise.etape_sur_prefixe"),
          milieu: t("intervention.frise.etape_sur_milieu"),
        }}
        separateur={t("ponctuation.point_median")}
        libelle={t("intervention.frise.libelle")}
        className="mb-4"
      />

      {/*
        LES ONGLETS (9EE-TP-UX4-1-FICHE-INTERVENTION-2, maquette du 28/09,
        §5.3) — Résumé, Temps, Rapport, Valorisation, Historique. Sans
        compteur (`Onglets` n'en accepte qu'un NUMÉRIQUE, et aucun n'a de
        sens ici). `depuis`/`depuis_id`/`retour` voyagent d'un onglet à
        l'autre, `hrefOngletFiche` (`../presentation.ts`) seule les filtre.
      */}
      <div className="mb-4">
        <Onglets
          libelleAria={t("intervention.onglets.aria")}
          dataNav="onglets-fiche"
          elements={VALEURS_ONGLET_FICHE.map((cle) => ({
            libelle: t(`intervention.onglet.${cle}`),
            href: hrefOngletFiche(ligne.id, cle, {
              depuis,
              depuisId,
              retour: retourRegistre,
            }),
            actif: onglet === cle,
          }))}
        />
      </div>

      {/* `.mach` de la maquette : deux colonnes, 1fr et 300 px. */}
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-4">
          {onglet === "resume" ? (
            <>
              <section className="bg-app-surface border-app-bord rounded-lg border px-4 py-3.5">
                <dl className="grid grid-cols-1 gap-x-3 gap-y-2.5 text-[13px] font-bold sm:grid-cols-[132px_1fr]">
                  {/*
                    LA PANNE SIGNALÉE, LE CLIENT, LA RÉFÉRENCE CLIENT, LE
                    MOTIF D'ANNULATION ET L'ORIGINE (9EE-TP-UX4-1-
                    FICHE-INTERVENTION-2, addendum recalage 2, R4) — AGENCE
                    et CONTACT SUR PLACE ont rejoint la carte « Sur place » ;
                    MODE DE VALORISATION et FORFAIT DE DÉPLACEMENT, l'onglet
                    Valorisation. `NULL` sur une intervention née avant ce
                    lot : l'absence se nomme par le TIRET, jamais par une
                    ligne qui disparaît.

                    LE CLIENT MÈNE À SA FICHE (LIENS-1) : le `<h1>` le
                    NOMME, cette ligne MÈNE à lui, les deux rôles ne se
                    recouvrent pas.
                  */}
                  <Ligne
                    libelle={t("intervention.panne_signalee")}
                    valeur={ligne.description ?? TIRET}
                  />
                  <Ligne
                    libelle={t("intervention.client")}
                    valeur={fiche.client ?? TIRET}
                    lien={`/clients/${ligne.client_id}`}
                  />
                  <Ligne
                    libelle={t("intervention.reference_client")}
                    valeur={ligne.reference_client ?? TIRET}
                  />
                  {ligne.motif_annulation !== null ? (
                    <Ligne
                      libelle={t("intervention.annulation.motif")}
                      valeur={ligne.motif_annulation}
                    />
                  ) : null}
                  {origineDeLaFiche === null ? null : (
                    <Ligne
                      libelle={t("intervention.cree_depuis")}
                      valeur={origineDeLaFiche}
                    />
                  )}
                </dl>
              </section>

              {/*
                LA MACHINE (9EE-TP-UX4-1-FICHE-INTERVENTION-2, addendum
                recalage 2, R4) — chacune un LIEN (LIENS-1), même lecture
                que l'en-tête (`machinesListees`, jamais recalculée). Rendue
                SEULEMENT s'il y a une machine à lister OU une à ajouter :
                une carte sans aucune des deux ne dirait rien.
              */}
              {ligne.machines.length > 0 || peutAjouterMachine ? (
                <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
                  <h2 className="text-[13px] font-bold">
                    {t("intervention.machine")}
                  </h2>
                  {ligne.machines.length === 0 ? null : (
                    <ul className="flex flex-col gap-1 text-13 font-bold">
                      {machinesListees.map((machine) => (
                        <li key={machine.machineId}>
                          {contenuMachines([machine])}
                        </li>
                      ))}
                    </ul>
                  )}
                  {/*
                    AJOUTER UNE MACHINE APRÈS COUP (chantier INT-MACHINE 2.2,
                    20/09/2026) — le dépôt sait déjà écrire
                    `intervention_machine` à la CRÉATION ; ce mini-formulaire
                    couvre le cas où le diagnostic arrive plus tard. La liste
                    ne propose que les machines DU SITE de cette intervention
                    (voir `ajouterMachineAIntervention`, qui tient la même
                    règle côté serveur contre un formulaire forgé).
                    `peutAjouterMachine` porte déjà `estFige`, le compte de
                    `ligne.machines` et `qualifier_affecter` (D153, 03/10/2026,
                    TP-S3, IN-29).
                  */}
                  {!peutAjouterMachine ? null : machinesDuSite.length === 0 ? (
                    <p className="text-app-encre-faible text-[12px] font-bold">
                      {t("intervention.machine.aucune_au_site")}
                    </p>
                  ) : (
                    <form
                      action={`/api/interventions/${ligne.id}/machine`}
                      method="post"
                      className="flex flex-col gap-3"
                    >
                      <label className="flex flex-col gap-1.5 text-sm font-medium">
                        {t("intervention.machine")}
                        <select
                          name="machine_id"
                          required
                          className="border-input bg-background w-full min-w-0 rounded-md border px-3 py-2 font-normal"
                        >
                          {machinesDuSite.map((machine) => (
                            <option key={machine.id} value={machine.id}>
                              {machine.libelle}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button type="submit" variant="outline" size="sm">
                        {t("intervention.machine.ajouter_action")}
                      </Button>
                    </form>
                  )}
                </section>
              ) : null}

              {fiche.habilitations === null ? null : (
                <Habilitations verdict={fiche.habilitations} />
              )}
            </>
          ) : null}

          {onglet !== "temps" ? null : (
            <>
              <RealisationTemps
                statut={statut}
                segments={segments ?? []}
                tempsMesureMin={ligne.temps_mesure_min}
                tempsValideMin={ligne.temps_valide_min}
                tempsValidePar={nomValidateur}
                tempsValideLe={fiche.tempsValideLe}
                fuseau={fiche.fuseau}
              />
              <Pauses pauses={pauses ?? []} fuseau={fiche.fuseau} />
            </>
          )}

          {onglet !== "rapport" ? null : (
            <RealisationRapport
              prestations={prestationsRealiseesFiche ?? []}
              commentaireTechnicien={fiche.commentaireTechnicien}
              suiteADonner={fiche.suiteADonner}
              signature={signatureFiche}
              clotureeLe={fiche.clotureeLe}
              fuseau={fiche.fuseau}
            />
          )}

          {onglet !== "valorisation" ? null : (
            <>
              <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
                <h2 className="text-[13px] font-bold">
                  {t("intervention.valorisation.titre")}
                </h2>
                <dl className="grid grid-cols-1 gap-x-3 gap-y-2.5 text-[13px] font-bold sm:grid-cols-[132px_1fr]">
                  <Ligne
                    libelle={t("intervention.mode_valorisation")}
                    valeur={t(`mode_valorisation.${ligne.mode_valorisation}`)}
                  />
                  <Ligne
                    libelle={t("intervention.forfait_deplacement")}
                    valeur={fiche.forfait ?? TIRET}
                  />
                </dl>
              </section>

              {fiche.valorisation !== null && fiche.devise !== null ? (
                <Valorisation
                  valorisation={fiche.valorisation}
                  devise={fiche.devise}
                  montants={montants}
                />
              ) : null}
            </>
          )}

          {onglet !== "historique" ? null : (
            <Chronologie
              titre={t("intervention.chronologie.titre")}
              evenements={chronologie.map((evenement) => ({
                instant: dateHeureLocale(evenement.instant, fiche.fuseau),
                libelle: t(evenement.cle),
              }))}
            />
          )}
        </div>

        <div className="flex flex-col gap-4">
          {/*
          LA COLONNE « SUR PLACE » (9EE-TP-UX4-1-FICHE-INTERVENTION-2,
          addendum recalage 2, R2) — un `<div>`, jamais un `<aside>` : la
          carte « Actions » qui portait ce rôle a quitté la fiche
          (9ES-TP-UX4-3-FICHE-GESTES-2, B1, D195) — ses gestes vivent
          désormais dans l'en-tête et le menu « ⋯ ». Onglet Résumé
          SEULEMENT — ailleurs, elle n'aurait rien à ajouter à ce que
          l'onglet montre déjà.
        */}
          {onglet !== "resume" ? null : (
            <ColonneContexte>
              <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
                <h2 className="flex items-center gap-1.5 text-[13px] font-bold">
                  <Icone nom="pin" taille={16} />
                  {t("intervention.sur_place.titre")}
                </h2>
                <dl className="grid grid-cols-1 gap-x-3 gap-y-2.5 text-[13px] font-bold sm:grid-cols-[132px_1fr]">
                  <Ligne
                    libelle={t("site.adresse")}
                    valeur={adresseSite ?? TIRET}
                  />
                  <Ligne
                    libelle={t("site.horaires")}
                    valeur={contenuHoraires(horairesSite)}
                  />
                  <Ligne
                    libelle={t("intervention.sur_place.donneur_ordre")}
                    valeur={contenuDonneurOrdre(donneurDOrdre)}
                  />
                  <Ligne
                    libelle={t("intervention.contact_sur_place")}
                    valeur={fiche.contact ?? TIRET}
                  />
                  <Ligne
                    libelle={t("site.consignes_acces")}
                    valeur={siteDeLIntervention?.consignes_acces ?? TIRET}
                  />
                  <Ligne
                    libelle={t("habilitations.site.titre")}
                    valeur={contenuHabilitationsSite(exigencesSite)}
                  />
                  <Ligne
                    libelle={mot("agence")}
                    valeur={fiche.rattachement ?? TIRET}
                    note={deduiteDuSite()}
                  />
                </dl>
              </section>

              {peutModifierLePlanning ? (
                <NoteInterne
                  interventionId={ligne.id}
                  note={fiche.noteInterne}
                  modifiable={!figee}
                />
              ) : null}
            </ColonneContexte>
          )}
        </div>
      </div>
    </Page>
  );
}

/** Ce qu'on affiche à la place d'une valeur qu'on n'a pas — jamais un vide. */
const TIRET = "—";

/**
 * RG-PLA-04 À L'ÉCRAN — **ce que le canal de refus ne peut pas dire** (L3-02,
 * D73).
 *
 * > « habilitation BR absente », « habilitation CACES expirée le 12/08/2026 » —
 * > jamais « impossible ».
 *
 * Le refus voyage en CLÉ de dictionnaire, et il le doit : *sans ce filtre, une
 * réponse forgée ferait écrire n'importe quoi à la page* (L1-02f). **Un code
 * d'habilitation ne peut donc pas voyager avec lui** — c'est une donnée de
 * société, et un paramètre d'URL recopié à l'écran est un canal d'écriture
 * (D50). Il est **lu en base**, sous le contexte cloisonné, par la même lecture
 * qui rend la fiche : le dépôt le résout, l'écran l'affiche.
 *
 * **Les deux moitiés de la règle sont ici, et la seconde n'avait aucun
 * appelant** : ce qui BLOQUE et ce qui AVERTIT. *Une règle dont une moitié est
 * calculée puis jetée n'est pas appliquée à moitié : elle n'est pas appliquée.*
 *
 * **Et ce n'est jamais un contrôle d'accès** : cette section affiche ce que la
 * politique a déjà laissé lire. Masquer une ligne ici serait une seconde
 * lecture d'un critère que la base porte, et c'est celle qui vieillit sans
 * rougir.
 */
function Habilitations({ verdict }: { verdict: VerdictAffectation }) {
  const manquantes = [
    ...verdict.bloquantes.map((exigence) => ({ exigence, bloquant: true })),
    ...verdict.avertissements.map((exigence) => ({
      exigence,
      bloquant: false,
    })),
  ];
  return (
    <section className="bg-app-surface border-app-bord rounded-lg border px-4 py-3.5">
      <h2 className="mb-2 text-13 font-bold">
        {t("intervention.habilitations.exigees")}
      </h2>
      {manquantes.length === 0 ? (
        // **« Rien à signaler » S'ÉCRIT, il ne se déduit pas d'une absence.**
        // Une section vide se lit comme une section qu'on n'a pas remplie —
        // c'est le défaut que D88 nomme sur le registre des VGP, et il vaut ici.
        <p className="text-app-encre-faible text-[12px] font-bold">
          {t("intervention.habilitations.satisfaites")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-[12px] font-bold">
          {manquantes.map(({ exigence, bloquant }) => (
            <li
              key={exigence.habilitation_id}
              className={
                bloquant ? "text-app-rouge-encre" : "text-app-encre-faible"
              }
            >
              <span className="font-bold">{exigence.code}</span>{" "}
              {exigence.motif === "absente"
                ? t("intervention.habilitations.absente")
                : `${t("intervention.habilitations.expiree_le")} ${dateCivile(
                    exigence.expiraitLe,
                  )}`}
              {bloquant
                ? `${t("ponctuation.separateur")}${t(
                    "intervention.habilitations.bloquante",
                  )}`
                : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * LE CALCUL DE D83, SOUS LES YEUX.
 *
 * *Voir l'arrondi et le plancher s'appliquer* était la demande, et un total
 * seul ne la satisfait pas : il donne le résultat sans donner la raison, et
 * c'est exactement ce qui fait douter d'une facture. Les quatre lignes se
 * lisent dans l'ordre du calcul — réel, arrondi, plancher, facturé — et le
 * plancher n'est signalé que lorsqu'il a réellement mordu.
 *
 * Aucun de ces nombres n'est recalculé ici : ils viennent de la même fonction
 * que la clôture. Un écran qui referait le calcul serait une seconde lecture
 * d'un même critère.
 */
function Valorisation({
  valorisation,
  devise,
  montants,
}: {
  valorisation: ValorisationAffichee;
  devise: { code: string; decimales: number; symbole: string | null };
  montants: AccesAuxMontants;
}) {
  return (
    <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
      <h2 className="text-[14px] font-bold">
        {t("intervention.cloture.facture")}
      </h2>
      {/*
        LE BLOC NE DISPARAÎT PAS — il est remplacé par son motif, exactement
        comme un refus d'action l'est en colonne latérale. *Un bloc absent se
        lirait « cette intervention n'a pas de montant » là où il faut lire
        « ce n'est pas pour vous »* (le motif de D88), et le titre reste pour
        que la différence soit visible.
      */}
      {montants.montre ? null : (
        <p className="text-app-oxyde text-13 font-bold">{t(montants.cle)}</p>
      )}
      {!montants.montre ? null : (
        <>
          <p className="text-app-encre-faible text-12 font-bold">
            {t("intervention.cloture.explication")}
          </p>
          <dl className="grid grid-cols-1 gap-x-3 gap-y-2.5 text-[13px] font-bold sm:grid-cols-[132px_1fr]">
            <Ligne
              libelle={t("intervention.cloture.temps_valide")}
              valeur={enDuree(valorisation.minutesReelles)}
            />
            <Ligne
              libelle={t("intervention.cloture.arrondi")}
              valeur={enDuree(valorisation.minutesArrondies)}
            />
            {valorisation.plancherApplique ? (
              <Ligne
                libelle={t("intervention.cloture.plancher")}
                valeur={enDuree(valorisation.minutesFacturees)}
              />
            ) : null}
            <Ligne
              libelle={t("intervention.cloture.taux")}
              valeur={formatMoney(valorisation.tauxHoraire, devise)}
            />
            {valorisation.mainDoeuvre === null ? null : (
              <Ligne
                libelle={t("intervention.cloture.main_doeuvre")}
                valeur={formatMoney(valorisation.mainDoeuvre, devise)}
              />
            )}
            {/*
          LE FORFAIT DE DÉPLACEMENT S'AFFICHE, et il entre dans le total
          (RG-INT-07, D77). *Il n'y entrait pas : « Total hors taxes » portait
          la main-d'œuvre seule.* Absent, la ligne ne s'affiche pas — le
          déplacement n'est alors pas facturé (D11), et une ligne à zéro
          dirait le contraire de ce qu'elle vaut.
        */}
            {valorisation.forfaitDeplacement === null ? null : (
              <Ligne
                libelle={t("intervention.cloture.forfait_deplacement")}
                valeur={formatMoney(valorisation.forfaitDeplacement, devise)}
              />
            )}
            {/*
          UN TOTAL INCONNU SE DIT, IL NE S'AFFICHE PAS À ZÉRO. *Zéro se lit
          « gratuit ».* Le motif prend la place du montant, en oxyde, comme un
          refus prend la place d'une action sur cet écran.
        */}
            <Ligne
              libelle={t("intervention.cloture.total")}
              valeur={
                valorisation.totalHT === null
                  ? t("intervention.cloture.total_inconnu")
                  : formatMoney(valorisation.totalHT, devise)
              }
            />
            {valorisation.motifTotalInconnu !== null &&
            estCleTraduction(valorisation.motifTotalInconnu) ? (
              <Ligne
                libelle={t("intervention.cloture.total_motif")}
                valeur={t(valorisation.motifTotalInconnu)}
              />
            ) : null}
          </dl>
        </>
      )}
    </section>
  );
}

// Composés hors du JSX (même geste que `FLECHE`/`DEUX_POINTS` de
// `parametres/agences/[id]/page.tsx`) : `react/jsx-no-literals` refuse un
// texte de ponctuation écrit à même l'arbre, et une ligne composée en dehors
// se relit d'un bloc plutôt qu'en morceaux entrecoupés d'expressions.
const FLECHE = " → ";
const DEUX_POINTS = " : ";

/** Une ligne du bloc « Segments de travail » de la Réalisation. */
/**
 * LE LIBELLÉ DE LA SIGNATURE, SELON SON ISSUE (9DE-TP-CY1, D-S5) — le motif
 * lui-même est une LIGNE séparée (voir l'appelant), jamais concaténé ici :
 * une valeur composée de deux faits distincts se relit mal et se compare pire.
 */
function libelleSignature(
  signature: { readonly cree_le: Date; readonly issue: IssueSignature } | null,
  fuseau: Fuseau,
): string {
  if (signature === null) {
    return t("intervention.realisation.aucune_signature");
  }
  if (signature.issue === "client_absent") {
    return t("intervention.realisation.signature_absente");
  }
  if (signature.issue === "refus_signature") {
    return t("intervention.realisation.signature_refusee");
  }
  return `${t("intervention.realisation.signee_le")} ${dateHeureLocale(signature.cree_le, fuseau)}`;
}

function ligneSegment(segment: SegmentAffiche, fuseau: Fuseau): string {
  const fin =
    segment.fin === null
      ? t("intervention.realisation.en_cours")
      : dateHeureLocale(segment.fin, fuseau);
  const duree =
    segment.minutes === null ? "" : ` (${enDuree(segment.minutes)})`;
  return `${segment.technicien}${t("ponctuation.separateur")}${dateHeureLocale(segment.debut, fuseau)}${FLECHE}${fin}${duree}`;
}

/** La période d'une pause, avec sa durée si elle est fermée. */
function lignePausePeriode(pause: PauseAffichee, fuseau: Fuseau): string {
  const fin =
    pause.fin === null
      ? t("intervention.pauses.en_cours")
      : dateHeureLocale(pause.fin, fuseau);
  const dureeMin =
    pause.fin === null
      ? null
      : Math.floor((pause.fin.getTime() - pause.debut.getTime()) / 60_000);
  const duree = dureeMin === null ? "" : ` (${enDuree(dureeMin)})`;
  return `${dateHeureLocale(pause.debut, fuseau)}${FLECHE}${fin}${duree}`;
}

function lignePauseMotif(pause: PauseAffichee): string {
  return `${t("intervention.pauses.motif")}${DEUX_POINTS}${pause.motif}`;
}

/** N'est rendue QUE quand `pieceAttendueRef` n'est pas `null` (voir l'appelant). */
function lignePausePiece(pause: PauseAffichee): string {
  const base = `${t("intervention.pauses.piece")}${DEUX_POINTS}${pause.pieceAttendueRef ?? TIRET}`;
  if (pause.dateDispoPrevue === null) {
    return base;
  }
  return `${base}${t("ponctuation.separateur")}${t("intervention.pauses.dispo_prevue")} ${dateCivile(pause.dateDispoPrevue)}`;
}

function lignePauseAuteurs(pause: PauseAffichee): string {
  const ouverture = `${t("intervention.pauses.ouverte_par")} ${pause.ouvertPar ?? TIRET}`;
  if (pause.fin === null) {
    return ouverture;
  }
  return `${ouverture}${t("ponctuation.separateur")}${t("intervention.pauses.fermee_par")} ${pause.fermeePar ?? TIRET}`;
}

/**
 * LA RÉALISATION, EN DEUX ONGLETS (50-INTERVENTIONS-2 ; coupée en deux par
 * 9EE-TP-UX4-1-FICHE-INTERVENTION-2, addendum recalage 2, R4 : « Temps » —
 * segments du compteur et les deux temps (D120) — et « Rapport » —
 * prestations, mots du technicien, signature, clôture). MÊMES clés, MÊME
 * contenu qu'avant ce lot : rien n'est saisi ici, ces deux fonctions ne font
 * que MONTRER ce que le terrain et la clôture ont déjà écrit ailleurs.
 */
function RealisationTemps({
  statut,
  segments,
  tempsMesureMin,
  tempsValideMin,
  tempsValidePar,
  tempsValideLe,
  fuseau,
}: {
  statut: StatutIntervention;
  segments: readonly SegmentAffiche[];
  tempsMesureMin: number | null;
  tempsValideMin: number | null;
  tempsValidePar: string | null;
  tempsValideLe: Date | null;
  fuseau: Fuseau;
}) {
  return (
    <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
      <h2 className="text-[13px] font-bold">
        {t("intervention.realisation.titre")}
      </h2>

      <h3 className="text-app-encre-faible text-[12px] font-bold">
        {t("intervention.realisation.segments_titre")}
      </h3>
      {segments.length === 0 ? (
        <p className="text-app-encre-faible text-[12px] font-bold">
          {t(texteSansSegment(statut))}
        </p>
      ) : (
        <ul className="flex flex-col gap-1 text-13 font-bold">
          {segments.map((segment, index) => (
            // Aucun identifiant propre au segment n'est lu ici (voir `SegmentAffiche`).
            <li key={index}>{ligneSegment(segment, fuseau)}</li>
          ))}
        </ul>
      )}

      <dl className="grid grid-cols-1 gap-x-3 gap-y-2 text-[13px] font-bold sm:grid-cols-[160px_1fr]">
        <Ligne
          libelle={t("intervention.realisation.temps_mesure")}
          valeur={tempsMesureMin === null ? TIRET : enDuree(tempsMesureMin)}
        />
        <Ligne
          libelle={t("intervention.realisation.temps_valide")}
          valeur={tempsValideMin === null ? TIRET : enDuree(tempsValideMin)}
        />
        {tempsValidePar === null ? null : (
          <Ligne
            libelle={t("intervention.realisation.valide_par")}
            valeur={tempsValidePar}
          />
        )}
        {tempsValideLe === null ? null : (
          <Ligne
            libelle={t("intervention.realisation.valide_le")}
            valeur={dateHeureLocale(tempsValideLe, fuseau)}
          />
        )}
      </dl>
    </section>
  );
}

function RealisationRapport({
  prestations,
  commentaireTechnicien,
  suiteADonner,
  signature,
  clotureeLe,
  fuseau,
}: {
  prestations: readonly { readonly id: string; readonly libelle: string }[];
  commentaireTechnicien: string | null;
  suiteADonner: string | null;
  signature: {
    readonly cree_le: Date;
    readonly issue: IssueSignature;
    readonly motif: string | null;
  } | null;
  clotureeLe: Date | null;
  fuseau: Fuseau;
}) {
  return (
    <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
      <h2 className="text-[13px] font-bold">
        {t("intervention.realisation.titre")}
      </h2>

      <h3 className="text-app-encre-faible text-[12px] font-bold">
        {t("intervention.realisation.prestations_titre")}
      </h3>
      {prestations.length === 0 ? (
        <p className="text-app-encre-faible text-[12px] font-bold">
          {t("intervention.realisation.aucune_prestation")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1 text-13 font-bold">
          {prestations.map((prestation) => (
            <li key={prestation.id}>{prestation.libelle}</li>
          ))}
        </ul>
      )}

      <dl className="grid grid-cols-1 gap-x-3 gap-y-2 text-[13px] font-bold sm:grid-cols-[160px_1fr]">
        <Ligne
          libelle={t("intervention.realisation.commentaire_technicien")}
          valeur={commentaireTechnicien ?? TIRET}
        />
        <Ligne
          libelle={t("intervention.realisation.suite_a_donner")}
          valeur={suiteADonner ?? TIRET}
        />
        <Ligne
          libelle={t("intervention.realisation.signature")}
          valeur={libelleSignature(signature, fuseau)}
        />
        {signature !== null && signature.issue !== "signee" ? (
          <Ligne
            libelle={t("intervention.realisation.motif_libelle")}
            valeur={signature.motif ?? TIRET}
          />
        ) : null}
        {clotureeLe === null ? null : (
          <Ligne
            libelle={t("intervention.realisation.cloturee_le")}
            valeur={dateHeureLocale(clotureeLe, fuseau)}
          />
        )}
      </dl>
    </section>
  );
}

/**
 * LES PAUSES (50-INTERVENTIONS-2, SAV-09) — TOUT l'historique, la plus
 * RÉCENTE en tête (`pausesDeLIntervention`, `lib/interventions/depot.ts`) :
 * deux pauses successives (pièce X, puis pièce Y) restent TOUTES DEUX
 * lisibles, avec leur durée chacune — ce que les quatre colonnes réécrites de
 * `intervention` ne pouvaient pas montrer.
 */
function Pauses({
  pauses,
  fuseau,
}: {
  pauses: readonly PauseAffichee[];
  fuseau: Fuseau;
}) {
  return (
    <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
      <h2 className="text-[13px] font-bold">
        {t("intervention.pauses.titre")}
      </h2>
      {pauses.length === 0 ? (
        <p className="text-app-encre-faible text-[12px] font-bold">
          {t("intervention.pauses.aucune")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pauses.map((pause) => (
            <li
              key={pause.id}
              className="border-app-bord flex flex-col gap-1 border-b pb-3 text-13 font-bold last:border-b-0 last:pb-0"
            >
              <p className="font-semibold">
                {lignePausePeriode(pause, fuseau)}
              </p>
              <p>{lignePauseMotif(pause)}</p>
              {pause.pieceAttendueRef === null ? null : (
                <p>{lignePausePiece(pause)}</p>
              )}
              <p className="text-app-encre-faible">
                {lignePauseAuteurs(pause)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * LA NOTE INTERNE (50-INTERVENTIONS-2) — visible et modifiable par les rôles
 * BACK-OFFICE seulement. Régime INVERSE de `commentaire_technicien`/
 * `suite_a_donner` : cette section n'existe QUE sur cette fiche, jamais sur
 * `/terrain`, le bon imprimable, le portail ou un courriel.
 *
 * FIGÉE, elle reste LISIBLE mais perd son formulaire — même régime que le
 * reste de la fiche (le déclencheur `intervention_cycle_de_vie` refuserait de
 * toute façon l'écriture).
 */
/**
 * LE TEXTAREA SE LIT PAR LE TITRE DE LA SECTION (IN-25, audit du
 * 28/09/2026) — `id` STABLE plutôt qu'un `label` visible : un second texte
 * « Note interne » casserait `getByText` en mode strict là où l'écran
 * n'attend qu'un seul nœud de ce texte (`tests/e2e/interventions-2.spec.ts`).
 */
const ID_TITRE_NOTE_INTERNE = "note-interne-titre";

function NoteInterne({
  interventionId,
  note,
  modifiable,
}: {
  interventionId: string;
  note: string | null;
  modifiable: boolean;
}) {
  return (
    <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
      <h2 id={ID_TITRE_NOTE_INTERNE} className="text-[13px] font-bold">
        {t("intervention.note_interne.titre")}
      </h2>
      <p className="text-app-encre-faible text-12 font-bold">
        {t("intervention.note_interne.aide")}
      </p>
      {modifiable ? (
        <form
          action={`/api/interventions/${interventionId}/note-interne`}
          method="post"
          className="flex flex-col gap-3"
        >
          <textarea
            name="note_interne"
            aria-labelledby={ID_TITRE_NOTE_INTERNE}
            defaultValue={note ?? ""}
            rows={4}
            className="border-input bg-background rounded-md border px-3 py-2 text-13 font-bold"
          />
          <Button type="submit" variant="outline" size="sm">
            {t("intervention.note_interne.enregistrer")}
          </Button>
        </form>
      ) : (
        <p className="text-13 font-bold">
          {note ?? t("intervention.note_interne.aucune")}
        </p>
      )}
    </section>
  );
}

function Ligne({
  libelle,
  valeur,
  note,
  lien,
}: {
  libelle: string;
  valeur: React.ReactNode;
  note?: string;
  /** Vers où la valeur mène, quand elle mène quelque part. */
  lien?: string;
}) {
  // `.dl` de la maquette : étiquette grise en 12 px, valeur en demi-gras, sur
  // deux colonnes que le PARENT tient — d'où le fragment plutôt qu'un `div`,
  // sans quoi chaque ligne formerait sa propre grille et les étiquettes ne
  // s'aligneraient plus.
  return (
    <>
      <dt className="text-app-encre-faible text-[12px] font-bold">{libelle}</dt>
      <dd className="font-semibold break-all">
        {lien === undefined ? (
          valeur
        ) : (
          <Link href={lien} className={CLASSES_LIEN}>
            {valeur}
          </Link>
        )}
        {note === undefined ? null : (
          <span className="text-app-encre-faible block text-12 font-bold">
            {note}
          </span>
        )}
      </dd>
    </>
  );
}

/**
 * LE CONTENU DU FAIT « MACHINE » DE L'EN-TÊTE (9EE-TP-UX4-1-
 * FICHE-INTERVENTION-1) — plusieurs machines, chacune UN LIEN (LIENS-1).
 * Une machine SANS libellé lu (hors périmètre, cas de bord) garde le signe
 * d'absence, en texte — jamais un lien mort vers une fiche qu'on ne peut pas
 * nommer.
 *
 * COMPOSÉ HORS DE L'ARBRE JSX, jamais dans un `return` — même geste que
 * `machinesAffichees` (`../presentation.ts`) qui compose sa propre forme
 * chaîne en dehors de tout JSX. Le signe d'absence et la virgule qui sépare
 * deux machines sont un FAIT DE STRUCTURE, au même titre que le séparateur
 * que ce fichier compose déjà pour la forme chaîne — pas un libellé métier
 * qui changerait de mot d'une langue à l'autre.
 */
/**
 * LE CONTENU DU FAIT « SITE » DE L'EN-TÊTE (9EE-TP-UX4-1-
 * FICHE-INTERVENTION-1) — même geste que `contenuMachines` juste en
 * dessous : le signe d'absence est un retour de fonction, jamais un
 * littéral posé en enfant direct d'un élément JSX (L0-11).
 */
function contenuSite(libelle: string | null, siteId: string): React.ReactNode {
  if (libelle === null) {
    return TIRET;
  }
  return (
    <Link href={`/sites/${siteId}`} className={CLASSES_LIEN}>
      {libelle}
    </Link>
  );
}

function contenuMachines(
  machines: readonly {
    readonly machineId: string;
    readonly libelle: string | null;
  }[],
): React.ReactNode {
  if (machines.length === 0) {
    return TIRET;
  }
  const noeuds: React.ReactNode[] = [];
  machines.forEach((machine, index) => {
    if (index > 0) {
      noeuds.push(SEPARATEUR_MACHINES);
    }
    noeuds.push(
      machine.libelle === null ? (
        TIRET
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

/** Le séparateur entre deux machines de la même ligne — recopié de `machinesAffichees`. */
const SEPARATEUR_MACHINES = ", ";

/** Le séparateur entre un jour (ou un groupe de jours) et le suivant, carte « Sur place ». */
const SEPARATEUR_PLAGES_HORAIRES = " ";

/**
 * LE CONTENU DU CHAMP « HORAIRES D'ACCÈS » DE LA CARTE « SUR PLACE »
 * (9EE-TP-UX4-1-FICHE-INTERVENTION-2) — `null` → le tiret de la fiche (rien
 * renseigné) ; `[]` → la phrase qui dit « fermé » ; sinon une plage par
 * groupe de jours (`horairesAffiches`, `app/(back-office)/sites/presentation.ts`,
 * qui porte déjà le regroupement et la garde sur la forme).
 */
function contenuHoraires(
  horaires: ReturnType<typeof horairesAffiches>,
): React.ReactNode {
  if (horaires === null) {
    return TIRET;
  }
  if (horaires.length === 0) {
    return t("site.horaires.aucune_plage");
  }
  return (
    <ul className="flex flex-col gap-0.5">
      {horaires.map((plage, index) => (
        <li key={index}>
          {plage.jours}
          {SEPARATEUR_PLAGES_HORAIRES}
          {plage.heures}
        </li>
      ))}
    </ul>
  );
}

/**
 * LE CONTENU DU CHAMP « DONNEUR D'ORDRE » DE LA CARTE « SUR PLACE »
 * (9EE-TP-UX4-1-FICHE-INTERVENTION-2) — nom puis fonction, puis un lien
 * `tel:` pour le mobile et pour le téléphone S'ILS DIFFÈRENT (un numéro
 * répété deux fois n'ajoute rien à composer deux liens identiques).
 */
function contenuDonneurOrdre(
  contact: {
    readonly nom: string;
    readonly fonction: string | null;
    readonly telephone: string | null;
    readonly mobile: string | null;
  } | null,
): React.ReactNode {
  if (contact === null) {
    return TIRET;
  }
  const numeros = [contact.mobile, contact.telephone].filter(
    (numero, index, tous): numero is string =>
      numero !== null && tous.indexOf(numero) === index,
  );
  return (
    <>
      {nomEtFonctionDuContact(contact)}
      {numeros.map((numero) => (
        <Link key={numero} href={`tel:${numero}`} className={CLASSES_LIEN}>
          <span className="block">{numero}</span>
        </Link>
      ))}
    </>
  );
}

/**
 * LE CONTENU DU CHAMP « HABILITATIONS EXIGÉES » DE LA CARTE « SUR PLACE »
 * (9EE-TP-UX4-1-FICHE-INTERVENTION-2) — la liste ENTIÈRE du site (bloquantes
 * ET avertissements), chacune nommée par son code — DISTINCTE de
 * `Habilitations` plus bas, qui ne montre que ce qu'il MANQUE à CE
 * technicien, jamais ce que le site exige dans l'absolu.
 */
function contenuHabilitationsSite(
  exigences: readonly {
    readonly id: string;
    readonly code: string;
    readonly bloquant: boolean;
  }[],
): React.ReactNode {
  if (exigences.length === 0) {
    return t("habilitations.site.aucune");
  }
  return (
    <ul className="flex flex-col gap-0.5">
      {exigences.map((exigence) => (
        <li key={exigence.id}>
          {exigence.code}
          {t("ponctuation.separateur")}
          {t(
            exigence.bloquant
              ? "habilitations.site.bloquant"
              : "habilitations.site.avertissement",
          )}
        </li>
      ))}
    </ul>
  );
}
