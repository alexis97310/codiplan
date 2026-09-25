import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { Page } from "@/components/mise-en-page/page";
import { Button } from "@/components/ui/button";
import { absencesDeLaPeriode } from "@/lib/absences/depot";
import { annuaireDesPersonnes } from "@/lib/auth/annuaire";
import { type ContexteActif } from "@/lib/auth/contexte";
import { peut } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import {
  dateCivile,
  instantDuJour,
  jourDe,
  maintenant,
  type Fuseau,
} from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import type { VerdictAffectation } from "@/lib/habilitations/affectation";
import {
  estFige,
  peutAffecter,
  peutAnnuler,
  peutCloturer,
  peutDeplacer,
  peutGenererLeBon,
  peutReprendre,
  peutSuspendre,
  type Verdict,
} from "@/lib/interventions/cycle-de-vie";
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
import type { StatutIntervention } from "@/lib/interventions/saisie";
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

import { CLASSES_STATUT } from "@/lib/theme/statuts";

import {
  chronologieDeLaFiche,
  dateHeureLocale,
  heureDuCreneau,
  machinesIdentifiees,
  referenceAffichee,
  retourFiche,
  technicienAfficheSurLaFiche,
  type EvenementChronologie,
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
 * LE TITRE D'ONGLET PORTE LA RÉFÉRENCE DE L'INTERVENTION (VISUEL-1) — la
 * MÊME forme que le `<h1>` affiche déjà, `referenceAffichee(ligne)`.
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
  const fiche = await lireFicheCache(session.contexte, id);
  if (fiche === null) {
    return { title: t("intervention.titre") };
  }
  return {
    title: `${t("intervention.titre")} ${referenceAffichee(fiche.ligne)}`,
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
  // D'OÙ ON ARRIVE (FICHE-INTERVENTION-1) — une liste FERMÉE, jamais une URL
  // libre : voir `retourFiche` dans `../presentation.ts`.
  const depuis = parametres.depuis;
  const depuisId = parametres.depuis_id;
  // LE REGISTRE TEL QU'ON L'AVAIT LAISSÉ (78-LIENS-2) — voir
  // `retourVersRegistre`, `../presentation.ts`, pour le filtrage.
  const retourRegistre = parametres.retour;
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
  // LA DATE ET L'HEURE PLANIFIÉES, DANS L'EN-TÊTE (FICHE-INTERVENTION-1) —
  // *l'information n°1 d'un planificateur qui ouvre cette fiche*, mesurée
  // absente de l'identification le 23/09/2026. `date_planifiee` est un jour
  // CIVIL (`dateCivile`, jamais de fuseau) ; l'heure, si le créneau en porte
  // une, est lue dans le fuseau de l'AGENCE — `heureDuCreneau`, la MÊME
  // fonction que le planning (§9, 01/09 : jamais une seconde lecture).
  // Aucune date : l'absence se NOMME, elle ne se tait jamais derrière un tiret.
  const heurePlanifiee = heureDuCreneau(ligne, fiche.fuseau);
  const datePlanifieeAffichee =
    ligne.date_planifiee === null
      ? t("statut.a_planifier")
      : heurePlanifiee === null
        ? dateCivile(ligne.date_planifiee)
        : `${dateCivile(ligne.date_planifiee)} ${heurePlanifiee}`;
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
  const peutModifierLePlanning =
    session.contexte.role !== null &&
    peut(session.contexte.role, "modifier_planning");
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
  // « AFFECTER » N'A QU'UN CHAMP, ET C'EST CELUI QUI FUYAIT : un rôle sans
  // `qualifier_affecter` verrait un bouton dont le seul champ est vide —
  // *un champ pré-rempli qu'on ne peut pas remplir est un affichage déguisé
  // en saisie*, la même réserve que D120 pose ailleurs sur cette fiche. Le
  // refus prend donc la place de TOUTE l'action, comme la consigne
  // d'exploitation le veut déjà pour un refus de statut.
  const verdictAffecter: Verdict = peutQualifierAffecter
    ? peutAffecter(statut)
    : { refuse: true, cle: "intervention.refus.qualification_requise" };
  // « PLANIFIER » (PARCOURS-1, 23/09/2026, arbitrage Alexis) — le bloc UNIQUE
  // qui remplace « Affecter » et « Déplacer » tant que le statut est
  // `a_planifier`. **Même capacité que « Déplacer »** — `modifier_planning`,
  // celle que `/api/interventions/[id]/deplacer` exige déjà côté serveur
  // (D131 : « planifier = qualifier_affecter / modifier_planning tels qu'ils
  // sont ») : ce bloc POSTE sur cette route, sous `peutPlanifier`, jamais un
  // troisième chemin.
  const verdictPlanifier: Verdict = peutModifierLePlanning
    ? peutDeplacer(statut)
    : { refuse: true, cle: "intervention.refus.qualification_requise" };
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
  const chronologie = chronologieDeLaFiche({
    creeLe: fiche.creeLe,
    pauses: (pauses ?? []).map((p) => ({ debut: p.debut, fin: p.fin })),
    clotureeLe: fiche.clotureeLe,
    annuleeLe: fiche.annuleeLe,
  });

  return (
    <Page
      chemin="/interventions"
      titre={
        <span className="inline-flex flex-wrap items-center gap-3">
          <span>
            {t("intervention.titre")} {referenceAffichee(ligne)}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${CLASSES_STATUT[statut]}`}
          >
            {t(`statut.${statut}`)}
          </span>
        </span>
      }
      sousTitre={
        ligne.numero === null ? t("intervention.sans_numero") : undefined
      }
      actions={
        <span className="inline-flex items-center gap-3">
          {/*
            LE BON D'INTERVENTION IMPRIMABLE (lot 16, BON-1) — un lien, pas un
            bouton d'action : cette fiche ne décide de rien de plus, elle mène
            à l'écran qui imprime. Sans lui, le bon existerait sans aucun
            appelant (§9, la maladie que le portail a déjà soignée).

            PROPOSÉ SEULEMENT SI LE BON PEUT SE GÉNÉRER (AFFICHAGE-MATERIEL-1,
            23/09/2026). *Mesuré en production le 23/09/2026 : le lien restait
            offert sur une intervention encore `planifiee`.* `peutGenererLeBon`
            est le MÊME verdict que la page du bon applique elle-même : deux
            lectures d'un même critère ne doivent jamais diverger (§9, 01/09).
          */}
          {peutGenererLeBon(statut).refuse ? null : (
            <Link
              href={`/interventions/${ligne.id}/bon`}
              className={CLASSES_LIEN}
            >
              {t("intervention.bon.titre")}
            </Link>
          )}
          <Link
            href={retour.href}
            className="text-app-encre-faible text-[12.5px]"
          >
            {retour.libelle}
          </Link>
        </span>
      }
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(motif)}
        </p>
      ) : null}

      {avertissementsAffiches.map((cle) => (
        <p
          key={cle}
          data-avertissement={cle}
          role="status"
          className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre mb-4 rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(cle)}
        </p>
      ))}

      {/* `.mach` de la maquette : deux colonnes, 1fr et 300 px. */}
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-4">
          <section className="bg-app-surface border-app-bord rounded-lg border px-4 py-3.5">
            <dl className="grid grid-cols-[132px_1fr] gap-x-3 gap-y-2.5 text-[13px]">
              <Ligne
                libelle={t("intervention.date")}
                valeur={datePlanifieeAffichee}
              />
              <Ligne
                libelle={t("intervention.type")}
                valeur={t(`type_intervention.${ligne.type}`)}
              />
              <Ligne
                libelle={t("intervention.priorite")}
                valeur={t(`priorite.${ligne.priorite}`)}
              />
              {/*
                LE CLIENT MÈNE À SA FICHE (LIENS-1). Même raisonnement que le
                lien du site juste en dessous : un client hors périmètre ne
                serait pas lu du tout (`fiche.client` resterait `null`), et le
                lien mènerait au même refus que partout ailleurs (D35, D50).
              */}
              <Ligne
                libelle={t("intervention.client")}
                valeur={fiche.client ?? TIRET}
                lien={`/clients/${ligne.client_id}`}
              />
              {/*
                LA MACHINE SUIT DIRECTEMENT LE CLIENT — même ordre que la
                colonne du registre (D125/D128) : « machine » y suit
                immédiatement « client ». Une ou plusieurs, chacune un LIEN
                vers sa fiche (LIENS-1) — `machinesAffichees` reste la forme
                CHAÎNE employée par la liste et le bon imprimable, que ce
                bloc ne touche pas.
              */}
              <LigneMachines
                libelle={t("intervention.machine")}
                machines={machinesIdentifiees(ligne, libellesMachines)}
              />
              {/*
                LE LIEU MÈNE À SA FICHE (L3-16). C'est ce lien qui donne un
                APPELANT à l'écran « Sites » : la maquette ne lui donne aucune
                entrée de barre — sa liste est close et un gardien la
                confronte —, et *une interface sans appelant est la maladie que
                le portail a soignée.*

                `lieu` est le libellé rendu par la lecture cloisonnée ; son
                identifiant est sur la ligne. Un site hors périmètre ne serait
                pas lu du tout, et le lien mènerait à un 404 — c'est-à-dire au
                même refus que partout ailleurs (D35, D50).
              */}
              <Ligne
                libelle={mot("site")}
                valeur={fiche.lieu ?? TIRET}
                lien={`/sites/${ligne.site_id}`}
              />
              <Ligne
                libelle={mot("agence")}
                valeur={fiche.rattachement ?? TIRET}
                note={t("intervention.deduit_du_lieu")}
              />
              {/*
                LA NOTE « DÉDUIT DU LIEU » NE SE RÉPÈTE PAS (FICHE-INTERVENTION-1)
                — mesurée deux fois sur cette fiche, l'une sous « agence » juste
                au-dessus, l'autre ici : un même fait ne s'affirme qu'une fois.
              */}
              <Ligne
                libelle={t("intervention.forfait_deplacement")}
                valeur={fiche.forfait ?? TIRET}
              />
              <Ligne
                libelle={t("intervention.technicien")}
                valeur={nomTechnicien}
              />
              <Ligne
                libelle={t("intervention.mode_valorisation")}
                valeur={t(`mode_valorisation.${ligne.mode_valorisation}`)}
              />
              {/*
                LA PANNE SIGNALÉE, LE CONTACT SUR PLACE ET LA RÉFÉRENCE
                CLIENT (PARCOURS-1, 23/09/2026) — saisis une seule fois, à la
                création. `NULL` sur une intervention née avant ce lot :
                l'absence se nomme par le TIRET, comme partout ailleurs sur
                cette fiche, jamais par une ligne qui disparaît.
              */}
              <Ligne
                libelle={t("intervention.panne_signalee")}
                valeur={ligne.description ?? TIRET}
              />
              <Ligne
                libelle={t("intervention.contact_sur_place")}
                valeur={fiche.contact ?? TIRET}
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
            </dl>
          </section>

          {fiche.habilitations === null ? null : (
            <Habilitations verdict={fiche.habilitations} />
          )}

          {/*
            AJOUTER UNE MACHINE APRÈS COUP (chantier INT-MACHINE 2.2,
            20/09/2026) — le dépôt sait déjà écrire `intervention_machine` à
            la CRÉATION ; ce mini-formulaire couvre le cas où le diagnostic
            arrive plus tard. La liste ne propose que les machines DU SITE de
            cette intervention (voir `ajouterMachineAIntervention`, qui tient
            la même règle côté serveur contre un formulaire forgé).

            FIGÉE, CE BLOC NE SE RESSAIE PLUS (FICHE-INTERVENTION-1) — mesuré
            le 23/09/2026 : une intervention clôturée proposait encore les
            ~30 machines du site, alors que rien de ce que ce formulaire pose
            n'a plus lieu d'être une fois l'intervention figée. `estFige` est
            la même lecture que les cinq actions du panneau ci-contre.

            NI QUAND UNE MACHINE EST DÉJÀ LÀ (PARCOURS-1, 23/09/2026, arbitrage
            Alexis) — mesuré : ce bloc restait offert même sur une intervention
            qui en portait déjà une, alors qu'« une intervention ne peut pas
            avoir 2 machines ». `ligne.machines`, la même lecture que
            `LigneMachines` juste au-dessus, jamais un second compte.
          */}
          {figee || ligne.machines.length > 0 ? null : (
            <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
              <h2 className="text-[13px] font-bold">
                {t("intervention.machine.ajouter_titre")}
              </h2>
              {machinesDuSite.length === 0 ? (
                <p className="text-app-encre-faible text-[12px]">
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
                      className="border-input bg-background rounded-md border px-3 py-2 font-normal"
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
          )}

          {fiche.valorisation !== null && fiche.devise !== null ? (
            <Valorisation
              valorisation={fiche.valorisation}
              devise={fiche.devise}
              montants={montants}
            />
          ) : null}

          <Realisation
            segments={segments ?? []}
            tempsMesureMin={ligne.temps_mesure_min}
            tempsValideMin={ligne.temps_valide_min}
            tempsValidePar={nomValidateur}
            tempsValideLe={fiche.tempsValideLe}
            prestations={prestationsRealiseesFiche ?? []}
            commentaireTechnicien={fiche.commentaireTechnicien}
            suiteADonner={fiche.suiteADonner}
            signature={signatureFiche}
            clotureeLe={fiche.clotureeLe}
            fuseau={fiche.fuseau}
          />

          <Pauses pauses={pauses ?? []} fuseau={fiche.fuseau} />

          <Chronologie evenements={chronologie} fuseau={fiche.fuseau} />

          {peutModifierLePlanning ? (
            <NoteInterne
              interventionId={ligne.id}
              note={fiche.noteInterne}
              modifiable={!figee}
            />
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          {/*
            LE PANNEAU « ACTIONS » (FICHE-INTERVENTION-1) — un seul
            regroupement, plutôt que jusqu'à cinq blocs empilés à la file
            (mesuré : sept sur une intervention planifiée, le 23/09/2026,
            maquette R2-08 lue et non approchée sur ce point).

            FIGÉE, LE RÉGIME CHANGE (D131, 29-DROITS-1) : *aucun bloc dont
            le verdict est un refus ne se rend* — le motif d'un refus DE
            STATUT, sur une intervention clôturée ou annulée, est TOUJOURS
            le même pour les quatre autres actions ; une ligne UNIQUE le dit,
            reprise des clés existantes (`intervention.refus.cloturee_figee`,
            `intervention.refus.annulee_figee`) plutôt qu'une phrase écrite
            une seconde fois. Ce que le rôle peut encore faire — annuler une
            clôturée, si D131 le lui accorde — reste un bloc plein, jamais
            une ligne.

            NON FIGÉE, RIEN NE CHANGE : chaque refus continue de s'afficher
            À LA PLACE de l'action, avec sa raison écrite — c'est ce que
            `tests/e2e/intervention-technicien-select.spec.ts` et
            `tests/e2e/blocage-agenda-visible.spec.ts` éprouvent déjà, et ce
            régime-là n'est pas celui que ce ticket change.
          */}
          <section className="bg-app-surface border-app-bord flex flex-col gap-4 rounded-lg border px-4 py-3.5">
            <h2 className="text-[13px] font-bold">
              {t("intervention.actions.titre")}
            </h2>

            {figee ? (
              <>
                <p className="text-app-encre-faible text-[12.5px]">
                  {t(
                    statut === "cloturee"
                      ? "intervention.refus.cloturee_figee"
                      : "intervention.refus.annulee_figee",
                  )}
                </p>
                {peutAnnulerCetteIntervention && !peutAnnuler(statut).refuse ? (
                  <Action
                    titre={t("intervention.action.annuler")}
                    verdict={peutAnnuler(statut)}
                    action={`/api/interventions/${ligne.id}/annuler`}
                    note={t("intervention.annulation.obligatoire")}
                  >
                    <Saisie
                      nom="motif"
                      libelle={t("intervention.annulation.motif")}
                    />
                  </Action>
                ) : null}
              </>
            ) : (
              <>
                {statut === "a_planifier" ? (
                  <>
                    {/*
                  « PLANIFIER » (PARCOURS-1, 23/09/2026, arbitrage Alexis) —
                  UN SEUL bloc, quatre champs OBLIGATOIRES ensemble, tant que
                  le statut est `a_planifier`. Il remplace « Affecter » et
                  « Déplacer » pour ce statut-là : *« une intervention ne
                  peut pas passer au statut planifié/affecté sans ces quatre
                  valeurs. »* Même route que « Déplacer » — `.../deplacer`,
                  sous `peutPlanifier` — et même glisser-déposer du planning :
                  aucun des trois chemins ne peut plus poser une planification
                  à moitié (R2-19, « même route, même décision »).
                */}
                    <Action
                      titre={t("intervention.action.planifier")}
                      verdict={verdictPlanifier}
                      action={`/api/interventions/${ligne.id}/deplacer`}
                      note={t("intervention.planification.explication")}
                    >
                      <Saisie
                        nom="date_planifiee"
                        type="date"
                        libelle={t("intervention.date")}
                        obligatoire
                      />
                      {/*
                    LE BLOCAGE D'AGENDA, DIT AVANT L'ENVOI (66-PLANNING-4,
                    SAV-05) — cette date n'existe pas encore côté serveur au
                    moment du rendu, contrairement à celle qu'« Affecter »
                    lit déjà sur la ligne : `DisponibiliteTechnicien` la
                    recalcule au changement de champ, sur les MÊMES absences
                    que le dépôt refuserait — jamais une seconde règle.
                  */}
                      {disponibiliteTechnicien === null ? null : (
                        <p className="text-app-encre-faible text-[11px]">
                          {t("intervention.disponibilite_technicien.fenetre")}
                        </p>
                      )}
                      <Saisie
                        nom="heure_debut"
                        type="time"
                        libelle={t("intervention.deplacement.heure")}
                        obligatoire
                      />
                      <Saisie
                        nom="duree_min"
                        type="number"
                        libelle={t("intervention.deplacement.duree")}
                        obligatoire
                      />
                      <Saisie
                        nom="technicien_id"
                        libelle={t("intervention.technicien")}
                        options={optionsAffectation}
                        libelleOptionVide={t("intervention.aucun_technicien")}
                        obligatoire
                      />
                      {disponibiliteTechnicien === null ? null : (
                        <DisponibiliteTechnicien
                          absences={disponibiliteTechnicien.absences}
                          fenetre={disponibiliteTechnicien.fenetre}
                        />
                      )}
                    </Action>
                  </>
                ) : (
                  <>
                    <Action
                      titre={t("intervention.action.affecter")}
                      verdict={verdictAffecter}
                      action={`/api/interventions/${ligne.id}/affecter`}
                    >
                      <Saisie
                        nom="technicien_id"
                        libelle={t("intervention.technicien")}
                        options={optionsAffectation}
                        libelleOptionVide={t("intervention.aucun_technicien")}
                        valeurParDefaut={ligne.technicien_id ?? undefined}
                      />
                    </Action>

                    {/*
              LA VOIE SANS GLISSÉ (R2-19) — même route, même décision.

              *Une fonction qui n'existe qu'à la souris exclut le tactile et
              le clavier.* Ce formulaire fait exactement ce que le
              glisser-déposer du planning fait, aux mêmes refus près : chaque
              bloc du planning est un lien vers cette fiche, atteignable à la
              tabulation.

              L'heure se saisit en HEURE LOCALE, comme sur le planning :
              l'instant demande le fuseau de l'établissement, et c'est le
              dépôt qui le résout.
            */}
                    <Action
                      titre={t("intervention.action.deplacer")}
                      verdict={peutDeplacer(statut)}
                      action={`/api/interventions/${ligne.id}/deplacer`}
                      note={t("intervention.deplacement.explication")}
                    >
                      <Saisie
                        nom="date_planifiee"
                        type="date"
                        libelle={t("intervention.date")}
                      />
                      {/*
                    LE BLOCAGE D'AGENDA, DIT AVANT L'ENVOI (66-PLANNING-4,
                    SAV-05) — voir le même commentaire sur « Planifier »
                    ci-dessus. Cette note ne se rend que si le sélecteur
                    technicien existe : sans lui, elle parlerait d'un champ
                    absent.
                  */}
                      {disponibiliteTechnicien === null ? null : (
                        <p className="text-app-encre-faible text-[11px]">
                          {t("intervention.disponibilite_technicien.fenetre")}
                        </p>
                      )}
                      <Saisie
                        nom="heure_debut"
                        type="time"
                        libelle={t("intervention.deplacement.heure")}
                      />
                      <Saisie
                        nom="duree_min"
                        type="number"
                        libelle={t("intervention.deplacement.duree")}
                      />
                      {/*
                    SEUL CE CHAMP DISPARAÎT, PAS LE FORMULAIRE ENTIER
                    (extension de la revue Codex, 20/09/2026) : « Déplacer »
                    restait déjà accessible, avant ce chantier, à un rôle
                    sans `modifier_planning` — la route le refuse au SUBMIT,
                    comme toujours. Ce que ce chantier ajoutait était la
                    LISTE NOMINATIVE ; c'est elle, et elle seule, qui se
                    retire ici. Date, heure et durée gardent le comportement
                    PRÉEXISTANT, hors du périmètre de cette revue.
                  */}
                      {peutModifierLePlanning ? (
                        <Saisie
                          nom="technicien_id"
                          libelle={t("intervention.technicien")}
                          options={optionsTechniciens}
                          libelleOptionVide={t("intervention.aucun_technicien")}
                          valeurParDefaut={ligne.technicien_id ?? undefined}
                        />
                      ) : null}
                      {disponibiliteTechnicien === null ? null : (
                        <DisponibiliteTechnicien
                          absences={disponibiliteTechnicien.absences}
                          fenetre={disponibiliteTechnicien.fenetre}
                        />
                      )}
                    </Action>
                  </>
                )}

                {/* LA GARDE JUGE LE TEMPS MESURÉ, jamais le validé (D120) :
                    le champ de l'action est pré-rempli depuis le mesuré, et
                    une garde qui juge ce qu'elle vient d'écrire ne juge
                    rien. */}
                {peutClore ? (
                  <Action
                    titre={t("intervention.action.cloturer")}
                    verdict={peutCloturer(statut, ligne.temps_mesure_min)}
                    action={`/api/interventions/${ligne.id}/cloturer`}
                    note={t("intervention.cloture.explication")}
                  >
                    {/* CE N'EST PLUS UNE SAISIE, C'EST UNE VALIDATION (D120).
                        Le champ arrive PRÉ-REMPLI avec ce que le compteur a
                        compté : par défaut le temps validé égale le temps
                        mesuré, et il n'en diffère que si quelqu'un l'a
                        corrigé — on saura alors qui et quand. */}
                    <Saisie
                      nom="temps_valide_min"
                      type="number"
                      libelle={t("intervention.cloture.temps_valide")}
                      valeurParDefaut={
                        ligne.temps_mesure_min === null
                          ? undefined
                          : String(ligne.temps_mesure_min)
                      }
                    />
                  </Action>
                ) : null}

                {/*
              LA SUSPENSION ET SA REPRISE (L2-10, RG-INT-06).

              *Une seule des deux s'offre à la fois*, et ce n'est pas une
              commodité d'affichage : le verdict de chacune refuse l'état de
              l'autre, et un refus prend la place de l'action avec sa
              raison — jamais un bouton grisé, qui laisse croire qu'il
              suffirait d'insister.

              La référence de pièce et sa date sont dans le MÊME formulaire,
              parce qu'elles se saisissent ensemble ou pas du tout.
            */}
                {!peutSuspendreOuReprendre ? null : statut === "suspendue" ? (
                  <Action
                    titre={t("intervention.action.reprendre")}
                    verdict={peutReprendre(statut)}
                    action={`/api/interventions/${ligne.id}/reprendre`}
                  />
                ) : (
                  <Action
                    titre={t("intervention.action.suspendre")}
                    verdict={peutSuspendre(statut, "—")}
                    action={`/api/interventions/${ligne.id}/suspendre`}
                    note={t("intervention.suspension.piece_aide")}
                  >
                    <Saisie
                      nom="motif"
                      libelle={t("intervention.suspension.motif")}
                    />
                    <Saisie
                      nom="piece_attendue_ref"
                      libelle={t("intervention.suspension.piece")}
                    />
                    <Saisie
                      nom="date_dispo_prevue"
                      type="date"
                      libelle={t("intervention.suspension.date_dispo")}
                    />
                  </Action>
                )}

                {peutAnnulerCetteIntervention ? (
                  <Action
                    titre={t("intervention.action.annuler")}
                    verdict={peutAnnuler(statut)}
                    action={`/api/interventions/${ligne.id}/annuler`}
                    note={t("intervention.annulation.obligatoire")}
                  >
                    <Saisie
                      nom="motif"
                      libelle={t("intervention.annulation.motif")}
                    />
                  </Action>
                ) : null}
              </>
            )}
          </section>
        </aside>
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
      <h2 className="mb-2 text-[12.5px] font-bold">
        {t("intervention.habilitations.exigees")}
      </h2>
      {manquantes.length === 0 ? (
        // **« Rien à signaler » S'ÉCRIT, il ne se déduit pas d'une absence.**
        // Une section vide se lit comme une section qu'on n'a pas remplie —
        // c'est le défaut que D88 nomme sur le registre des VGP, et il vaut ici.
        <p className="text-app-encre-faible text-[12px]">
          {t("intervention.habilitations.satisfaites")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-[12px]">
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
        <p className="text-app-oxyde text-[12.5px]">{t(montants.cle)}</p>
      )}
      {!montants.montre ? null : (
        <>
          <p className="text-app-encre-faible text-[11.5px]">
            {t("intervention.cloture.explication")}
          </p>
          <dl className="grid grid-cols-[132px_1fr] gap-x-3 gap-y-2.5 text-[13px]">
            <Ligne
              libelle={t("intervention.cloture.temps_valide")}
              valeur={minutes(valorisation.minutesReelles)}
            />
            <Ligne
              libelle={t("intervention.cloture.arrondi")}
              valeur={minutes(valorisation.minutesArrondies)}
            />
            {valorisation.plancherApplique ? (
              <Ligne
                libelle={t("intervention.cloture.plancher")}
                valeur={minutes(valorisation.minutesFacturees)}
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

/** Des minutes en heures et minutes — `75` se lit « 1 h 15 », jamais « 75 ». */
function minutes(total: number): string {
  const heures = Math.floor(total / 60);
  const reste = String(total % 60).padStart(2, "0");
  return heures === 0 ? `${reste} min` : `${heures} h ${reste}`;
}

// Composés hors du JSX (même geste que `FLECHE`/`DEUX_POINTS` de
// `parametres/agences/[id]/page.tsx`) : `react/jsx-no-literals` refuse un
// texte de ponctuation écrit à même l'arbre, et une ligne composée en dehors
// se relit d'un bloc plutôt qu'en morceaux entrecoupés d'expressions.
const FLECHE = " → ";
const DEUX_POINTS = " : ";

/** Une ligne du bloc « Segments de travail » de la Réalisation. */
function ligneSegment(segment: SegmentAffiche, fuseau: Fuseau): string {
  const fin =
    segment.fin === null
      ? t("intervention.realisation.en_cours")
      : dateHeureLocale(segment.fin, fuseau);
  const duree =
    segment.minutes === null ? "" : ` (${minutes(segment.minutes)})`;
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
  const duree = dureeMin === null ? "" : ` (${minutes(dureeMin)})`;
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
 * LA RÉALISATION (50-INTERVENTIONS-2) — les données RÉELLES de la visite,
 * sous les yeux : les segments du compteur, les deux temps (D120) et qui a
 * validé, les prestations réalisées, les mots du technicien, la signature, la
 * clôture. Rien n'est saisi ici — cette section ne fait que MONTRER ce que le
 * terrain et la clôture ont déjà écrit ailleurs.
 */
function Realisation({
  segments,
  tempsMesureMin,
  tempsValideMin,
  tempsValidePar,
  tempsValideLe,
  prestations,
  commentaireTechnicien,
  suiteADonner,
  signature,
  clotureeLe,
  fuseau,
}: {
  segments: readonly SegmentAffiche[];
  tempsMesureMin: number | null;
  tempsValideMin: number | null;
  tempsValidePar: string | null;
  tempsValideLe: Date | null;
  prestations: readonly { readonly id: string; readonly libelle: string }[];
  commentaireTechnicien: string | null;
  suiteADonner: string | null;
  signature: { readonly cree_le: Date } | null;
  clotureeLe: Date | null;
  fuseau: Fuseau;
}) {
  return (
    <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
      <h2 className="text-[13px] font-bold">
        {t("intervention.realisation.titre")}
      </h2>

      <h3 className="text-app-encre-faible text-[12px] font-semibold">
        {t("intervention.realisation.segments_titre")}
      </h3>
      {segments.length === 0 ? (
        <p className="text-app-encre-faible text-[12px]">
          {t("intervention.realisation.aucun_segment")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1 text-[12.5px]">
          {segments.map((segment, index) => (
            // Aucun identifiant propre au segment n'est lu ici (voir `SegmentAffiche`).
            <li key={index}>{ligneSegment(segment, fuseau)}</li>
          ))}
        </ul>
      )}

      <dl className="grid grid-cols-[160px_1fr] gap-x-3 gap-y-2 text-[13px]">
        <Ligne
          libelle={t("intervention.realisation.temps_mesure")}
          valeur={tempsMesureMin === null ? TIRET : minutes(tempsMesureMin)}
        />
        <Ligne
          libelle={t("intervention.realisation.temps_valide")}
          valeur={tempsValideMin === null ? TIRET : minutes(tempsValideMin)}
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

      <h3 className="text-app-encre-faible text-[12px] font-semibold">
        {t("intervention.realisation.prestations_titre")}
      </h3>
      {prestations.length === 0 ? (
        <p className="text-app-encre-faible text-[12px]">
          {t("intervention.realisation.aucune_prestation")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1 text-[12.5px]">
          {prestations.map((prestation) => (
            <li key={prestation.id}>{prestation.libelle}</li>
          ))}
        </ul>
      )}

      <dl className="grid grid-cols-[160px_1fr] gap-x-3 gap-y-2 text-[13px]">
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
          valeur={
            signature === null
              ? t("intervention.realisation.aucune_signature")
              : `${t("intervention.realisation.signee_le")} ${dateHeureLocale(signature.cree_le, fuseau)}`
          }
        />
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
        <p className="text-app-encre-faible text-[12px]">
          {t("intervention.pauses.aucune")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pauses.map((pause) => (
            <li
              key={pause.id}
              className="border-app-bord flex flex-col gap-1 border-b pb-3 text-[12.5px] last:border-b-0 last:pb-0"
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
 * LA CHRONOLOGIE (50-INTERVENTIONS-2) — depuis les FAITS DATÉS, jamais le
 * journal d'audit : voir `chronologieDeLaFiche`, `../presentation.ts`, pour
 * le choix et sa raison.
 */
function Chronologie({
  evenements,
  fuseau,
}: {
  evenements: readonly EvenementChronologie[];
  fuseau: Fuseau;
}) {
  return (
    <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
      <h2 className="text-[13px] font-bold">
        {t("intervention.chronologie.titre")}
      </h2>
      <ol className="flex flex-col gap-1.5 text-[12.5px]">
        {evenements.map((evenement, index) => (
          // Un évènement composé n'a pas d'identifiant propre ; l'ordre affiché est celui du tableau lui-même.
          <li key={index}>
            <span className="text-app-encre-faible">
              {dateHeureLocale(evenement.instant, fuseau)}
            </span>
            {t("ponctuation.separateur")}
            {t(evenement.cle)}
          </li>
        ))}
      </ol>
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
      <h2 className="text-[13px] font-bold">
        {t("intervention.note_interne.titre")}
      </h2>
      <p className="text-app-encre-faible text-[11.5px]">
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
            defaultValue={note ?? ""}
            rows={4}
            className="border-input bg-background rounded-md border px-3 py-2 text-[12.5px]"
          />
          <Button type="submit" variant="outline" size="sm">
            {t("intervention.note_interne.enregistrer")}
          </Button>
        </form>
      ) : (
        <p className="text-[12.5px]">
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
  valeur: string;
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
      <dt className="text-app-encre-faible text-[12px]">{libelle}</dt>
      <dd className="font-semibold break-all">
        {lien === undefined ? (
          valeur
        ) : (
          <Link href={lien} className={CLASSES_LIEN}>
            {valeur}
          </Link>
        )}
        {note === undefined ? null : (
          <span className="text-app-encre-faible block text-[11.5px] font-normal">
            {note}
          </span>
        )}
      </dd>
    </>
  );
}

/**
 * LES MACHINES, CHACUNE UN LIEN — même paire dt/dd que `Ligne`, mais `Ligne`
 * ne porte qu'UN `lien` : plusieurs machines veulent chacune le sien (LIENS-1).
 *
 * Une machine SANS libellé lu (hors périmètre, cas de bord) garde le signe
 * d'absence, en texte — jamais un lien mort vers une fiche qu'on ne peut pas
 * nommer.
 */
function LigneMachines({
  libelle,
  machines,
}: {
  libelle: string;
  machines: readonly {
    readonly machineId: string;
    readonly libelle: string | null;
  }[];
}) {
  return (
    <>
      <dt className="text-app-encre-faible text-[12px]">{libelle}</dt>
      <dd className="font-semibold break-all">{contenuMachines(machines)}</dd>
    </>
  );
}

/**
 * COMPOSÉ HORS DE L'ARBRE JSX DE `LigneMachines`, jamais dans son `return`
 * — même geste que `machinesAffichees` (`../presentation.ts`) qui compose sa
 * propre forme chaîne en dehors de tout JSX. Le signe d'absence et la
 * virgule qui sépare deux machines sont un FAIT DE STRUCTURE, au même titre
 * que le séparateur que ce fichier compose déjà pour la forme chaîne — pas
 * un libellé métier qui changerait de mot d'une langue à l'autre.
 */
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

function Saisie({
  nom,
  libelle,
  type = "text",
  valeurParDefaut,
  options,
  libelleOptionVide,
  obligatoire,
}: {
  nom: string;
  libelle: string;
  type?: "text" | "number" | "date" | "time";
  /**
   * `required` (PARCOURS-1) — un repère CÔTÉ CLIENT, jamais la garantie :
   * `deplacerIntervention` (`peutPlanifier`) refuse toujours sans le champ,
   * `required` ne fait qu'éviter l'aller-retour au serveur pour le dire.
   */
  obligatoire?: boolean;
  /**
   * La valeur PRÉ-REMPLIE, quand il y en a une à proposer (D120).
   *
   * `defaultValue` et non `value` : le champ reste **modifiable**. *Un champ
   * pré-rempli qu'on ne peut pas changer est un affichage déguisé en saisie* —
   * et c'est précisément la correction que la validation doit permettre.
   */
  valeurParDefaut?: string;
  /**
   * UNE LISTE FERMÉE PLUTÔT QU'UNE SAISIE LIBRE (chantier TECH-1, 20/09/2026)
   * — rend un `<select>` au lieu d'un `<input>` quand elle est fournie.
   *
   * *Le champ technicien était un `<input type="text">` nu* : rien
   * n'empêchait d'y taper un UUID inventé, ni de deviner celui d'un
   * technicien qu'on n'a pas le droit de nommer. La liste vient TOUJOURS de
   * l'appelant, déjà résolue sous le contexte cloisonné (§9, 01/09 : ce
   * composant ne lit ni base ni politique).
   */
  options?: readonly {
    readonly valeur: string;
    readonly libelle: string;
    /**
     * L'option DIT que l'agenda est bloqué (PLANNING-1, RG-PLA-06) — elle
     * reste sélectionnable, le dépôt tranche. `data-agenda-bloque` est ce
     * qu'un scénario interroge, jamais le texte du libellé.
     */
    readonly bloque?: boolean;
  }[];
  /** L'option vide du `<select>`, quand `options` est fourni et qu'elle a un sens (ex. « Aucun technicien affecté »). */
  libelleOptionVide?: string;
}) {
  if (options !== undefined) {
    return (
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {libelle}
        <select
          name={nom}
          defaultValue={valeurParDefaut ?? ""}
          required={obligatoire}
          className="border-input bg-background rounded-md border px-3 py-2 font-normal"
        >
          {libelleOptionVide === undefined ? null : (
            <option value="">{libelleOptionVide}</option>
          )}
          {options.map((option) => (
            <option
              key={option.valeur}
              value={option.valeur}
              {...(option.bloque === true ? { "data-agenda-bloque": "" } : {})}
            >
              {option.libelle}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {libelle}
      <input
        name={nom}
        type={type}
        defaultValue={valeurParDefaut}
        required={obligatoire}
        className="border-input bg-background rounded-md border px-3 py-2 font-normal"
      />
    </label>
  );
}

/**
 * UNE ACTION, OU SON REFUS — jamais les deux, jamais un bouton grisé.
 *
 * *Le refus s'affiche à la place, en oxyde, avec sa raison écrite.* Un bouton
 * désactivé laisse croire qu'il suffirait d'insister ; un refus qui prend la
 * place de l'action dit ce qui bloque et pourquoi.
 */
function Action({
  titre,
  verdict,
  action,
  note,
  children,
}: {
  titre: string;
  verdict: { refuse: boolean; cle?: string };
  action: string;
  note?: string;
  /**
   * FACULTATIF depuis L2-10 : la reprise ne saisit rien — le statut retrouvé se
   * déduit du créneau, et le motif est effacé par la base. *Une action sans
   * champ n'est pas une action incomplète.*
   */
  children?: React.ReactNode;
}) {
  if (verdict.refuse) {
    const cle = verdict.cle;
    return (
      <section className="border-app-rouge-bord bg-app-rouge-fond flex flex-col gap-1 rounded-lg border px-4 py-3">
        <h2 className="text-[13px] font-bold">{titre}</h2>
        <p className="text-app-rouge-encre text-[12.5px]">
          {cle !== undefined && estCleTraduction(cle) ? t(cle) : ""}
        </p>
      </section>
    );
  }
  return (
    <form
      action={action}
      method="post"
      className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3"
    >
      <h2 className="text-[13px] font-bold">{titre}</h2>
      {note === undefined ? null : (
        <p className="text-app-encre-faible text-[11.5px]">{note}</p>
      )}
      {children}
      <Button type="submit" variant="outline" size="sm">
        {titre}
      </Button>
    </form>
  );
}
