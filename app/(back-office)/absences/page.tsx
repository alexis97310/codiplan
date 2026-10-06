import type { Metadata } from "next";

import { Fragment } from "react";

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { LienPrimaire } from "@/components/ui/action-primaire";
import { Avatar } from "@/components/ui/avatar";
import { BoutonAvecConfirmation } from "@/components/ui/bouton-confirmation";
import { Button } from "@/components/ui/button";
import { Carte } from "@/components/ui/carte";
import { DecompteLecture } from "@/components/ui/decompte-lecture";
import { Onglets, type EtatOnglet } from "@/components/ui/onglets";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { Volet } from "@/components/ui/volet";
import {
  apercuAbsence,
  etatAbsence,
  type EtatAbsence,
} from "@/lib/absences/depot";
import {
  lireLesAbsences,
  nommerLesAgences,
  nommerLesInterventions,
} from "@/lib/absences/ecran";
import { type Annuaire } from "@/lib/auth/annuaire";
import { exigerContexteActif } from "@/lib/auth/contexte";
import { peut, peutPleinement } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import {
  cleJour,
  instantDuJour,
  jourDe,
  jourSuivant,
  maintenant,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { lundiDeLaSemaine, semaineIso } from "@/lib/calendar/semaine";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import {
  listerPlanning,
  type LigneFileATraiter,
} from "@/lib/interventions/depot";
import { perimetreDuPlanning } from "@/lib/interventions/perimetre-technicien";
import { nomSeul, quiTravaille } from "@/lib/interventions/personnes";
import { CLASSES_STATUT } from "@/lib/theme/statuts";

import {
  mentionDeplanifiee,
  referenceAffichee,
} from "../interventions/presentation";

import { identifiants } from "../../api/absences/actions";
import {
  absencesDeLOnglet,
  absencesDuMois,
  agencesSansTechnicienDisponible,
  bandesDesQuatreSemaines,
  couvre,
  dureeEnJours,
  enTeteDeJour,
  hrefSemaine,
  libelleRuptureAucune,
  pastillesDuJour,
  renduesParAbsence,
  saisieApercuDepuisUrl,
  semaineAffichee,
  semaineBandeTitre,
  type VueOnglet,
  versDateCivile,
} from "./presentation";

export const metadata: Metadata = { title: t("absences.titre") };

/**
 * L'ÉCRAN DES BLOCAGES D'AGENDA (R3-14, RG-PLA-06), AU GABARIT DE LA
 * MAQUETTE DU 28/09 (D175, 9EC-TP-UX3-E-ABSENCES).
 *
 * ## Pourquoi il existe
 *
 * `occupationTechnicien` retranche les périodes bloquées du dénominateur du
 * taux d'occupation, précisément pour distinguer *« il était indisponible »* de
 * *« il n'a rien fait »*. **Aucun blocage ne pouvant être posé, cette branche
 * n'était jamais prise** : les taux affichés étaient justes *pour un monde où
 * personne n'est jamais absent*, et ils ne disaient pas qu'ils l'étaient.
 *
 * ## CE QU'IL N'EST PAS — et c'est la décision du 14/09/2026
 *
 * **Ce n'est pas un écran de gestion des congés.** Une personne, une date de
 * début, une date de fin, et rien d'autre : ni nature, ni motif, ni champ
 * libre, ni file de demandes à trancher. *CODIPLAN n'est pas un outil de
 * gestion des ressources humaines*, et un écran qui ferait choisir entre
 * « congé » et « arrêt maladie » écrirait une donnée de santé sur une personne
 * nommée.
 *
 * **Le blocage est donc IMMÉDIAT**, et la conséquence est écrite plutôt que
 * tue : il n'y a plus rien à valider, donc plus de moment où quelqu'un relit
 * avant que le planning bouge. Poser rend à la file ; lever ne rend rien.
 *
 * ## Il ne propose AUCUN créneau
 *
 * *Un moteur qui propose sur un effectif d'un ne propose rien* (D106). Ce que
 * cet écran rend, ce sont les interventions **rendues à la file** et les agences
 * où le service est **rompu** — nommées, jamais comptées : *« 3 interventions
 * déplanifiées » ne dit pas lesquelles*, et c'est exactement ce que le
 * planificateur doit voir pour les reposer.
 *
 * ## D175 — LE GABARIT DE LA MAQUETTE, DÉCLARATION EN VOLET
 *
 * D125 puis D128 (lot A4, 18/09/2026) avaient ajouté le calendrier d'une
 * semaine et les trois KPI de `absences()` AU-DESSUS d'un écran inchangé par
 * ailleurs. **D175 va plus loin** : l'en-tête porte désormais un vrai bouton
 * qui ouvre un volet (`components/ui/volet.tsx`, « + Déclarer une absence »
 * — l'ancien ÉCART NOMMÉ de `lib/absences/ecarts-maquette.ts` est COMBLÉ,
 * même geste que « + Machine ») ; la semaine affichée se lit désormais EN
 * LIGNES PAR TECHNICIEN (une ligne, sept colonnes de jour) plutôt qu'en
 * pastilles empilées sous chaque jour ; les décomptes sont rendus par
 * `DecompteLecture`, EN LECTURE (aucun lien, aucun chevron — QE-13b, D140
 * borné) ; les interventions rendues à la file et la rupture de service
 * deviennent des cartes PERMANENTES, lues sur l'existant, à côté de la
 * semaine ; les 4 prochaines semaines se lisent EN BANDES par technicien,
 * AVANT le tableau ; le tableau lui-même porte des onglets à compteur
 * (`Onglets`, « À venir et en cours » / « Aujourd'hui » / « Terminées »),
 * une colonne Durée et une colonne Rendues à la planification.
 *
 * **Les pastilles et les bandes montrent une PERSONNE, jamais un TYPE.** La
 * maquette écrit « J. Lemaître · Congé » ; `absence` (R3-14) ne porte aucune
 * nature, et l'inventer romprait exactement la décision que ce fichier
 * documente plus haut. Voir `./presentation.ts` pour le détail.
 *
 * **Pas de « Modifier »** (décision 16 d'Alexis du 05/10/2026) : la maquette
 * en dessine un, mais le créer ouvrirait une règle de gestion (que rend-on à
 * la file si on allonge une absence ?) que ce lot ne tranche pas. Ni demi-
 * journée ni plage horaire non plus (QG-8, migration PG-G15, hors
 * périmètre).
 */
export default async function PageAbsences({
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

  const parametres = await searchParams;
  const motif = parametres.motif;
  const rendues = identifiants(lu(parametres.rendues));
  const rompues = identifiants(lu(parametres.rompues));
  const apercuSaisie = saisieApercuDepuisUrl(parametres);
  const voletOuvert =
    lu(parametres.declarer) === "1" || lu(parametres.apercu) === "1";
  // UN APPEL DE PLUS, SÉQUENTIEL, JAMAIS IMBRIQUÉ : `apercuAbsence` ouvre sa
  // PROPRE transaction cloisonnée — le même principe que les multiples appels
  // de `tableau-de-bord/page.tsx`. L'imbriquer dans le `avecContexteApplicatif`
  // ci-dessous ouvrirait une seconde transaction À L'INTÉRIEUR de la première.
  const apercu =
    apercuSaisie === null
      ? null
      : await apercuAbsence(session.contexte, apercuSaisie);

  // LE PÉRIMÈTRE PAR PERSONNE (QT-2, D152) — un technicien restreint sur
  // `consulter_planning` ne lit que sa propre absence (choix du pilote D).
  const perimetre = perimetreDuPlanning(exigerContexteActif(session.contexte));
  // LE VOLET S'OUVRE SI LA ROUTE L'ACCEPTERAIT (`modifier_planning`,
  // `app/api/absences/declarer/route.ts`) — TR-5, D151 : un technicien porte
  // désormais un ○ sur cette capacité, pour déclarer SA PROPRE absence (le
  // trigger `absence_declaree_pour_soi` reste le garde-fou en base, et son
  // périmètre de personnes déclarables est déjà restreint à lui-même par
  // `perimetre`, ci-dessous).
  const peutDeclarer =
    session.contexte.role !== null &&
    peut(session.contexte.role, "modifier_planning");
  // ÉCOURTER ET SUPPRIMER EXIGENT LE ●, PAS LE ○ (TR-5) : même porte que
  // `app/api/absences/{ecourter,lever}/route.ts` (`exigerCapaciteComplete`) —
  // un technicien ne peut agir que sur sa propre DÉCLARATION, jamais sur une
  // ligne déjà posée.
  const peutGererLignes =
    session.contexte.role !== null &&
    peutPleinement(session.contexte.role, "modifier_planning");

  const vue = await avecContexteApplicatif(session.contexte, async (tx) => {
    // L'HEURE SE LIT AVEC UN FUSEAU, jamais nue (L0-08) : sous UTC+11 le jour
    // se décale d'un cran, et la fenêtre affichée s'ouvrirait la veille.
    const societe = await tx.societe.findFirst({
      select: { fuseau_horaire: true },
    });
    const fuseau = societe?.fuseau_horaire ?? FUSEAU_DE_REPLI;
    const aujourdHui = jourDe(maintenant(fuseau).local);
    const lundiAffiche = lundiLu(lu(parametres.semaine), aujourdHui);
    const semaine = semaineAffichee(lundiAffiche);
    const lecture = await lireLesAbsences(
      tx,
      fenetreAffichee(fuseau),
      perimetre,
    );
    // LA SEMAINE AFFICHÉE EST LUE À PART, dans SES seules bornes — jamais en
    // élargissant la fenêtre par défaut jusqu'à elle. `vue.absences` (et le
    // tableau qui le rend) ne doit pas grossir parce qu'une navigation a
    // demandé une semaine lointaine ; sept jours, toujours sept jours,
    // quelle que soit la distance parcourue par `?semaine=`.
    const lectureSemaine = await lireLesAbsences(
      tx,
      {
        du: versDateCivile(semaine[0]),
        au: versDateCivile(semaine[6]),
      },
      perimetre,
    );
    const rupture = agencesSansTechnicienDisponible(
      lecture.declarables,
      lecture.absences,
      aujourdHui,
    );
    return {
      ...lecture,
      absencesSemaine: lectureSemaine.absences,
      annuaireSemaine: lectureSemaine.annuaire,
      aujourdHui,
      lundiAffiche,
      semaine,
      fuseau,
      interventionsRendues: await nommerLesInterventions(tx, rendues),
      agencesRompues: await nommerLesAgences(tx, rompues),
      agencesEnRupture: await nommerLesAgences(
        tx,
        rupture.map((r) => r.agenceId),
      ),
      // NOMMÉES DANS LA MÊME TRANSACTION QUE `rendues`/`rompues` — même
      // principe : `apercuAbsence` a dit LESQUELLES, cette lecture dit
      // comment elles s'appellent, et rien de plus.
      interventionsApercu:
        apercu === null ? null : await nommerLesInterventions(tx, apercu),
    };
  });

  // ── LES LIGNES RENDUES À LA FILE À PLANIFIER (D175) ─────────────────────
  //
  // `listerPlanning` OUVRE SA PROPRE TRANSACTION, hors de celle ci-dessus
  // (même principe que `apercuAbsence`) : AUCUNE requête ni critère neufs —
  // elle rend toute la file, et c'est `mentionDeplanifiee` (déjà écrite pour
  // le planning et la fiche d'intervention) qui dit laquelle vient d'une
  // absence.
  const lignesPlanning = await listerPlanning(
    session.contexte,
    instantDuJour(vue.aujourdHui),
    instantDuJour(vue.aujourdHui, 1),
  );
  const lignesRendues = lignesPlanning.filter(
    (ligne) => mentionDeplanifiee(ligne, "", vue.fuseau) !== null,
  );

  const moisEnCours = absencesDuMois(vue.absences, vue.aujourdHui);
  // QT-23 (a), D136 (03/10/2026) — « Demandes à valider » n'avait plus
  // d'objet depuis R3-14 (le blocage est immédiat) : la tuile devient
  // « Absents aujourd'hui », LE MÊME CRITÈRE que le tableau de bord — qui
  // couvre AUJOURD'HUI, exactement ce que `pastillesDuJour` filtre déjà pour
  // le calendrier de cette même page (§9, 01/09 : jamais un second critère
  // pour la même question).
  const absentsAujourdHui = pastillesDuJour(
    vue.aujourdHui,
    vue.absences,
    vue.annuaire,
  );

  // ── LES ONGLETS À COMPTEUR (D175) ───────────────────────────────────────
  const ongletDemande = lu(parametres.vue);
  const ongletActif: VueOnglet =
    ongletDemande === "aujourdhui" || ongletDemande === "terminees"
      ? ongletDemande
      : "actuelles";
  const absencesActuelles = absencesDeLOnglet(
    "actuelles",
    vue.absences,
    vue.aujourdHui,
  );
  const absencesAujourdhui = absencesDeLOnglet(
    "aujourdhui",
    vue.absences,
    vue.aujourdHui,
  );
  const absencesTerminees = absencesDeLOnglet(
    "terminees",
    vue.absences,
    vue.aujourdHui,
  );
  const absencesAffichees =
    ongletActif === "aujourdhui"
      ? absencesAujourdhui
      : ongletActif === "terminees"
        ? absencesTerminees
        : absencesActuelles;
  const onglets: readonly EtatOnglet[] = [
    {
      libelle: t("absences.onglet_actuelles"),
      href: hrefOnglet(undefined),
      compte: absencesActuelles.length,
      actif: ongletActif === "actuelles",
    },
    {
      libelle: t("absences.onglet_aujourdhui"),
      href: hrefOnglet("aujourdhui"),
      compte: absencesAujourdhui.length,
      actif: ongletActif === "aujourdhui",
    },
    {
      libelle: t("absences.onglet_terminees"),
      href: hrefOnglet("terminees"),
      compte: absencesTerminees.length,
      actif: ongletActif === "terminees",
    },
  ];

  // ── LES 4 PROCHAINES SEMAINES EN BANDES (D175) ──────────────────────────
  const bandes = bandesDesQuatreSemaines(
    vue.lundiAffiche,
    vue.absences,
    vue.declarables,
    vue.aujourdHui,
  );
  const semainesBandeTitres = [0, 1, 2, 3].map((n) =>
    semaineBandeTitre(jourSuivant(vue.lundiAffiche, 7 * n)),
  );

  const hrefFermerVolet = hrefFermer(parametres);

  return (
    <Page
      chemin="/absences"
      titre={t("absences.titre")}
      sousTitre={t("absences.sous_titre")}
      actions={
        peutDeclarer ? (
          <LienPrimaire href={hrefDeclarer(parametres)}>
            {t("absences.declarer_entete")}
          </LienPrimaire>
        ) : undefined
      }
    >
      <div
        data-bloc="kpi-grille"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <div data-bloc="kpi-absences-mois">
          <DecompteLecture
            libelle={t("absences.kpi_ce_mois")}
            valeur={moisEnCours.compte}
            detail={
              moisEnCours.personnes === 0
                ? undefined
                : `${moisEnCours.personnes} ${
                    moisEnCours.personnes === 1
                      ? t("absences.kpi_ce_mois_detail_suffixe_une")
                      : t("absences.kpi_ce_mois_detail_suffixe")
                  }`
            }
          />
        </div>
        <div data-bloc="kpi-rupture">
          <DecompteLecture
            libelle={t("absences.kpi_rupture")}
            valeur={vue.agencesEnRupture.length}
            detail={
              vue.agencesEnRupture.length === 0
                ? libelleRuptureAucune()
                : listeDesAgences(vue.agencesEnRupture)
            }
          />
        </div>
        {/* « Absents aujourd'hui » REMPLACE « Demandes à valider » (QT-23,
            D136) — le `data-bloc` est GARDÉ à l'identique (le gardien de
            composition, `tests/unit/ui/lot-a1-a4.test.ts`, ne lit que
            l'attribut, jamais le texte qu'il porte). */}
        <div data-bloc="kpi-demandes-valider">
          <DecompteLecture
            libelle={t("absences.kpi_absents_aujourdhui")}
            valeur={absentsAujourdHui.length}
            detail={
              absentsAujourdHui.length === 0
                ? t("absences.kpi_absents_aujourdhui_aucun")
                : listeDesPersonnes(absentsAujourdHui)
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Carte
          titre={`${t("absences.titre_semaine")} ${semaineIso(vue.lundiAffiche).semaine}`}
          action={{
            libelle: t("absences.action_planning"),
            href: `/planning?vue=semaine&semaine=${cleJour(vue.lundiAffiche)}`,
          }}
        >
          <div
            data-bloc="calendrier-nav"
            className="border-app-bord flex items-center gap-2 border-b px-[16px] py-[10px]"
          >
            <Link
              href={hrefSemaine(jourSuivant(vue.lundiAffiche, -7))}
              className="border-app-bord rounded-md border px-2.5 py-1.5 text-13 font-bold"
            >
              {t("absences.calendrier_precedente")}
            </Link>
            <Link
              href={hrefSemaine(lundiDeLaSemaine(vue.aujourdHui))}
              className="border-app-bord rounded-md border px-2.5 py-1.5 text-13 font-bold"
            >
              {t("absences.calendrier_aujourdhui")}
            </Link>
            <Link
              href={hrefSemaine(jourSuivant(vue.lundiAffiche, 7))}
              className="border-app-bord rounded-md border px-2.5 py-1.5 text-13 font-bold"
            >
              {t("absences.calendrier_suivante")}
            </Link>
          </div>
          <div className="overflow-x-auto">
            <div
              data-bloc="calendrier"
              className="grid grid-cols-[140px_repeat(7,minmax(42px,1fr))]"
            >
              <div />
              {vue.semaine.map((jour) => (
                <div
                  key={`entete-${cleJour(jour)}`}
                  className="text-app-marque border-app-bord border-b px-1.5 py-2 text-center text-12 font-extrabold uppercase"
                >
                  {enTeteDeJour(jour)}
                </div>
              ))}
              {vue.declarables.map((personne) => {
                const nom = quiTravaille(personne.utilisateurId, vue.annuaire);
                return (
                  <Fragment key={personne.utilisateurId}>
                    <div className="border-app-bord flex items-center gap-2 border-t border-b px-1.5 py-1.5">
                      <Avatar identifiant={personne.utilisateurId} nom={nom} />
                      <span className="truncate text-13 font-bold">{nom}</span>
                    </div>
                    {vue.semaine.map((jour) => {
                      const absent = vue.absencesSemaine.some(
                        (absence) =>
                          absence.utilisateur_id === personne.utilisateurId &&
                          couvre(absence, jour),
                      );
                      return (
                        <div
                          key={`${personne.utilisateurId}-${cleJour(jour)}`}
                          className="border-app-bord flex items-center justify-center border-t border-b border-l p-1"
                        >
                          {absent ? (
                            <span
                              data-bloc="calendrier-pastille"
                              className="bg-app-violet-fond text-app-violet-encre w-full rounded-md py-1 text-center text-12 font-bold"
                            >
                              <span className="sr-only">{nom}</span>{" "}
                              <span className="hidden sm:inline">
                                {t("absences.pastille_bloque")}
                              </span>
                              <span
                                aria-hidden="true"
                                className="bg-app-violet-encre mx-auto block size-2 rounded-full sm:hidden"
                              />
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </Fragment>
                );
              })}
            </div>
          </div>
        </Carte>

        <div className="flex flex-col gap-4">
          <Carte titre={t("absences.rendues_titre")}>
            <div className="divide-app-bord flex flex-col divide-y">
              {lignesRendues.length === 0 ? (
                <p className="text-app-encre-faible px-3.5 py-2.5 text-13 font-bold">
                  {t("absences.rendues_vide")}
                </p>
              ) : (
                lignesRendues.map((ligne) => (
                  <LigneRendue key={ligne.id} ligne={ligne} vue={vue} />
                ))
              )}
            </div>
            {lignesRendues.length === 0 ? null : (
              <div className="border-app-bord border-t px-3.5 py-2.5">
                <Link
                  href="/interventions?vue=a_planifier"
                  className="text-app-marque text-13 font-bold underline"
                >
                  {t("absences.rendues_lien_registre")}
                </Link>
              </div>
            )}
          </Carte>

          <Carte titre={t("absences.rupture_titre")}>
            <div className="flex flex-col gap-2 px-3.5 py-2.5">
              {vue.agencesRompues.length === 0 ? null : (
                <p
                  role="alert"
                  className="text-app-rouge-encre text-13 font-bold"
                >
                  {listeDesAgences(vue.agencesRompues)}{" "}
                  {t("absences.rupture_explication")}
                </p>
              )}
              {vue.agencesEnRupture.length === 0 ? (
                <p className="text-app-encre-faible text-13 font-bold">
                  {libelleRuptureAucune()}
                </p>
              ) : (
                <p className="text-13 font-bold">
                  {listeDesAgences(vue.agencesEnRupture)}
                </p>
              )}
            </div>
          </Carte>
        </div>
      </div>

      {/* CE QUI SUIT N'EST PAS DANS `absences()` — REMPLACEMENTS FONCTIONNELS
          ASSUMÉS (D128) : voir le docblock de tête. */}

      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-13 font-bold"
        >
          {t(motif)}
        </p>
      ) : null}

      {/* LE BANDEAU DE LA POSE (ÉPHÉMÈRE, `?rendues=`) RESTE EN TÊTE, TEL
          QUEL (D175) — distinct de la carte PERMANENTE ci-dessus. */}
      {vue.interventionsRendues.length > 0 ? (
        <section
          role="status"
          className="border-app-bord bg-app-surface flex flex-col gap-1.5 rounded-md border px-3.5 py-2.5 text-13 font-bold"
        >
          <p className="font-bold">{t("absences.rendues_titre")}</p>
          <p>
            <Link href="/interventions?vue=a_planifier" className="underline">
              {t("absences.rendues_lien_registre")}
            </Link>
          </p>
          <p>
            <ListeLiensInterventions interventions={vue.interventionsRendues} />
          </p>
        </section>
      ) : null}

      {/* QE-13e, D175 — les 4 semaines suivant celle affichée, EN BANDES,
          AVANT le tableau. Aucune requête de plus : ces absences sont déjà
          dans `vue.absences` (TR-3, plus de borne haute). */}
      <Carte titre={t("absences.quatre_semaines_titre")}>
        <div className="overflow-x-auto">
          <div className="grid min-w-[680px] grid-cols-[160px_repeat(4,minmax(120px,1fr))]">
            <div />
            {semainesBandeTitres.map((titreSemaine, index) => (
              <div
                key={index}
                className="text-app-encre-faible border-app-bord border-b px-2 py-2 text-12 font-extrabold uppercase"
              >
                {titreSemaine}
              </div>
            ))}
            {bandes.lignes.map((ligne) => {
              const nom = quiTravaille(ligne.utilisateurId, vue.annuaire);
              return (
                <Fragment key={ligne.utilisateurId}>
                  <div className="border-app-bord flex items-center gap-2 border-t border-b px-2 py-2">
                    <Avatar identifiant={ligne.utilisateurId} nom={nom} />
                    <span className="truncate text-13 font-bold">{nom}</span>
                  </div>
                  <div className="border-app-bord relative col-span-4 border-t border-b">
                    {bandes.traitAujourdHuiPourcent === null ? null : (
                      <span
                        aria-hidden="true"
                        className="bg-app-marque absolute top-0 bottom-0 w-[2px]"
                        style={{ left: `${bandes.traitAujourdHuiPourcent}%` }}
                      />
                    )}
                    {ligne.bandes.map((bande) => (
                      <span
                        key={bande.id}
                        data-bloc="calendrier-pastille"
                        className="bg-app-violet-fond text-app-violet-encre absolute top-[3px] bottom-[3px] flex items-center overflow-hidden rounded-md px-1.5 text-12 font-bold whitespace-nowrap"
                        style={{
                          left: `${bande.debutPourcent}%`,
                          width: `${bande.largeurPourcent}%`,
                        }}
                      >
                        <span className="sr-only">
                          {nom} {t("absences.pastille_separateur")}{" "}
                          {periode(bande.du, bande.au)}
                        </span>
                        {bande.duree}
                      </span>
                    ))}
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>
      </Carte>

      <Onglets libelleAria={t("absences.titre")} elements={onglets} />

      <section className="bg-app-surface border-app-bord overflow-hidden rounded-lg border">
        <Tableau colonnes={COLONNES(ongletActif)} minimum="820px">
          {absencesAffichees.length === 0 ? (
            <LignePleine colonnes={6}>
              {ongletActif === "aujourdhui"
                ? t("absences.kpi_absents_aujourdhui_aucun")
                : t("absences.aucune")}
            </LignePleine>
          ) : null}
          {absencesAffichees.map((absence) => {
            // L'ÉTAT SE LIT DEPUIS LA CIVILE DU JOUR, DANS LE FUSEAU DE LA
            // SOCIÉTÉ (QT-15, D136) : `vue.aujourdHui`, jamais `new Date()`.
            const etat = etatAbsence(absence, versDateCivile(vue.aujourdHui));
            const nom = quiTravaille(absence.utilisateur_id, vue.annuaire);
            const renduesDeCetteAbsence = renduesParAbsence(
              absence,
              lignesRendues,
            );
            return (
              <tr key={absence.id}>
                <Cellule fort>
                  <span className="flex items-center gap-2">
                    <Avatar identifiant={absence.utilisateur_id} nom={nom} />
                    {nom}
                  </span>
                </Cellule>
                <Cellule>{periode(absence.du, absence.au)}</Cellule>
                <Cellule>{dureeEnJours(absence.du, absence.au)}</Cellule>
                <Cellule>
                  <PastilleEtat etat={etat} />
                </Cellule>
                <Cellule>
                  {renduesDeCetteAbsence.length === 0 ? (
                    <span className="text-app-encre-faible">
                      {t("absences.rendues_aucune")}
                    </span>
                  ) : (
                    <>
                      <ListeLiensInterventions
                        interventions={renduesDeCetteAbsence}
                      />
                      <div className="text-app-encre-faible text-12 font-bold">
                        {renduesDeCetteAbsence.length}{" "}
                        {renduesDeCetteAbsence.length === 1
                          ? t("absences.rendues_compte_une")
                          : t("absences.rendues_compte")}
                      </div>
                    </>
                  )}
                </Cellule>
                <Cellule>
                  {peutGererLignes ? (
                    <ActionDeLaLigne
                      absence={absence}
                      etat={etat}
                      aujourdHui={vue.aujourdHui}
                      sujet={sujetLevee(nom, periode(absence.du, absence.au))}
                    />
                  ) : null}
                </Cellule>
              </tr>
            );
          })}
        </Tableau>
      </section>

      <p className="text-app-encre-faible text-12 font-bold">
        {t("absences.levee_explication")}
      </p>

      {voletOuvert ? (
        <Volet
          surtitre={t("absences.titre")}
          titre={t("absences.declarer")}
          hrefFermer={hrefFermerVolet}
        >
          <form action="/absences" method="get" className="flex flex-col gap-3">
            <input type="hidden" name="apercu" value="1" />
            <div className="flex flex-col gap-1">
              <label
                htmlFor="absence-personne"
                className="text-app-encre-faible text-12 font-bold"
              >
                {t("absences.personne")}
              </label>
              <select
                id="absence-personne"
                name="utilisateur_id"
                defaultValue={apercuSaisie?.utilisateur_id ?? ""}
                required
                className="border-app-bord bg-app-surface rounded-md border px-2 py-1.5 text-13 font-bold"
              >
                <option value="" disabled>
                  {t("absences.choisir_personne")}
                </option>
                {vue.declarables.map((personne) => (
                  <option
                    key={personne.utilisateurId}
                    value={personne.utilisateurId}
                  >
                    {quiTravaille(personne.utilisateurId, vue.annuaire)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ChampJour
                id="absence-du"
                nom="du"
                libelle={`${t("absences.du")} ${t("absences.obligatoire")}`}
                valeur={
                  apercuSaisie === null
                    ? undefined
                    : versChaineJourInput(apercuSaisie.du)
                }
              />
              <ChampJour
                id="absence-au"
                nom="au"
                libelle={`${t("absences.au")} ${t("absences.obligatoire")}`}
                valeur={
                  apercuSaisie === null
                    ? undefined
                    : versChaineJourInput(apercuSaisie.au)
                }
              />
            </div>
            <Button type="submit" variant="outline" size="sm">
              {t("absences.apercu_action")}
            </Button>
          </form>

          <section
            role="status"
            className="border-app-bord bg-app-surface-creuse flex flex-col gap-2 rounded-md border px-3.5 py-2.5 text-13 font-bold"
          >
            <p className="font-bold">{t("absences.impact_titre")}</p>
            {apercuSaisie === null || vue.interventionsApercu === null ? (
              <p className="text-app-encre-faible">
                {t("absences.impact_avant")}
              </p>
            ) : (
              <>
                <p>
                  {libelleImpact(vue.interventionsApercu.length)}
                  {vue.interventionsApercu.length > 0 ? (
                    <>
                      {" "}
                      <ListeLiensInterventions
                        interventions={vue.interventionsApercu}
                      />
                    </>
                  ) : null}
                </p>
                {vue.interventionsApercu.length === 0 ? null : (
                  <p className="text-app-encre-faible text-12 font-bold">
                    {t("absences.impact_automatique")}
                  </p>
                )}
                <form
                  action="/api/absences/declarer"
                  method="post"
                  className="flex justify-end gap-2"
                >
                  <input
                    type="hidden"
                    name="utilisateur_id"
                    value={apercuSaisie.utilisateur_id}
                  />
                  <input
                    type="hidden"
                    name="du"
                    value={versChaineJourInput(apercuSaisie.du)}
                  />
                  <input
                    type="hidden"
                    name="au"
                    value={versChaineJourInput(apercuSaisie.au)}
                  />
                  <Link
                    href={hrefFermerVolet}
                    className="border-app-bord rounded-md border px-3 py-1.5 text-13 font-bold"
                  >
                    {t("absences.annuler")}
                  </Link>
                  <Button type="submit" variant="default" size="sm">
                    {t("absences.declarer_action")}
                  </Button>
                </form>
              </>
            )}
          </section>

          <p className="text-app-encre-faible text-12 font-bold">
            {t("absences.immediat")}
          </p>
          <p className="text-app-encre-faible text-12 font-bold">
            {t("absences.retroactif")}
          </p>
        </Volet>
      ) : null}
    </Page>
  );
}

/** « À venir » / « En cours » / « Terminée » — jamais composé ailleurs (L0-11). */
function libelleEtat(etat: EtatAbsence): string {
  switch (etat) {
    case "a_venir":
      return t("absences.etat_a_venir");
    case "en_cours":
      return t("absences.etat_en_cours");
    case "terminee":
      return t("absences.etat_terminee");
  }
}

/**
 * L'ÉTAT D'UNE LIGNE (D175) — un `Badge` pour « À venir »/« Terminée », une
 * pastille aux jetons VIOLETS pour « En cours » : `Badge` ne porte que cinq
 * tons (`components/ui/badge.tsx`), et le violet n'en est délibérément pas
 * un sixième (il reste réservé aux blocages d'agenda eux-mêmes, calendrier et
 * bandes).
 */
function PastilleEtat({ etat }: { readonly etat: EtatAbsence }) {
  if (etat === "en_cours") {
    return (
      <span className="bg-app-violet-fond text-app-violet-encre inline-block rounded-[20px] px-[8px] py-[2px] text-12 font-bold whitespace-nowrap">
        {libelleEtat(etat)}
      </span>
    );
  }
  return (
    <span
      className={`inline-block rounded-[20px] px-[8px] py-[2px] text-12 font-bold whitespace-nowrap ${
        etat === "a_venir"
          ? "bg-app-bleu-fond text-app-bleu-encre"
          : "bg-app-gris-fond text-app-gris-encre"
      }`}
    >
      {libelleEtat(etat)}
    </span>
  );
}

/**
 * UNE LIGNE DE LA CARTE « INTERVENTIONS RENDUES À LA FILE À PLANIFIER »
 * (D175) — client, référence, l'ancien créneau (`mentionDeplanifiee`,
 * partagée avec le planning et la fiche), et le statut courant.
 */
function LigneRendue({
  ligne,
  vue,
}: {
  readonly ligne: LigneFileATraiter;
  readonly vue: { readonly annuaire: Annuaire; readonly fuseau: string };
}) {
  const nomAbsent =
    ligne.deplanifiee_absent_id === null
      ? TIRET
      : (nomSeul(ligne.deplanifiee_absent_id, vue.annuaire) ?? TIRET);
  const mention = mentionDeplanifiee(ligne, nomAbsent, vue.fuseau);
  return (
    <div className="flex flex-col gap-0.5 px-3.5 py-2.5 text-13 font-bold">
      <Link
        href={`/interventions/${ligne.id}?depuis=absences`}
        className="underline"
      >
        {ligne.client.raison_sociale}
        {t("ponctuation.point_median")}
        {referenceAffichee(ligne)}
      </Link>
      {mention === null ? null : (
        <>
          <span className="text-app-encre-faible text-12 font-bold">
            {mention.titre}
          </span>
          <span className="text-app-encre-faible text-12 font-bold">
            {mention.ancienCreneau}
          </span>
        </>
      )}
      <span
        className={`w-fit rounded-full px-2 py-0.5 text-12 font-bold ${CLASSES_STATUT[ligne.statut]}`}
      >
        {t(`statut.${ligne.statut}`)}
      </span>
    </div>
  );
}

function COLONNES(ongletActif: VueOnglet) {
  return [
    { cle: "personne", libelle: t("absences.personne"), largeur: "180px" },
    {
      cle: "periode",
      libelle:
        ongletActif === "terminees"
          ? t("absences.colonne_periode_desc")
          : t("absences.colonne_periode_asc"),
    },
    { cle: "duree", libelle: t("absences.colonne_duree"), largeur: "100px" },
    { cle: "etat", libelle: t("absences.etat"), largeur: "110px" },
    { cle: "rendues", libelle: t("absences.colonne_rendues") },
    { cle: "levee", libelle: t("absences.levee"), largeur: "190px" },
  ];
}

/**
 * L'ACTION D'UNE LIGNE, SELON SON ÉTAT (QT-15, D136) — « À venir » offre
 * SUPPRIMER (l'ancien « Lever ») ; « En cours » offre ÉCOURTER ; « Terminée »
 * n'offre plus rien, une absence passée ne se modifie plus (même lecture de
 * I5 qu'une intervention clôturée, `lib/absences/periode.ts`).
 */
function ActionDeLaLigne({
  absence,
  etat,
  aujourdHui,
  sujet,
}: {
  readonly absence: {
    readonly id: string;
    readonly du: Date;
    readonly au: Date;
  };
  readonly etat: EtatAbsence;
  readonly aujourdHui: JourLocal;
  readonly sujet: string;
}) {
  switch (etat) {
    case "a_venir":
      return <FormulaireLevee absenceId={absence.id} sujet={sujet} />;
    case "en_cours":
      return (
        <FormulaireEcourter
          absenceId={absence.id}
          du={absence.du}
          au={absence.au}
          aujourdHui={versDateCivile(aujourdHui)}
        />
      );
    case "terminee":
      return null;
  }
}

/**
 * SUPPRIMER UNE ABSENCE QUI N'A PAS ENCORE COMMENCÉ — la seule action
 * possible sur une ligne « À venir » (QT-15, l'ancien « Lever »).
 *
 * *Il n'y a rien à « trancher »* : la ligne bloque dès qu'elle existe. Ce
 * formulaire la supprime, et ce qu'il ne fait pas est dit à côté du
 * tableau — supprimer ne rend pas leurs créneaux aux interventions déjà
 * rendues à la file. **Depuis 99D-ABSENCES-1, ce que ça ne fait pas est
 * aussi dit dans la confirmation elle-même** (constat 37 de l'audit du
 * 25/09/2026), avec la même mécanique que `BoutonAnnuler` sur la fiche
 * d'intervention (lot 84) — un dialogue natif, jamais une soumission au
 * premier clic.
 */
function FormulaireLevee({
  absenceId,
  sujet,
}: {
  readonly absenceId: string;
  readonly sujet: string;
}) {
  return (
    <form action="/api/absences/lever" method="post">
      <input type="hidden" name="absence_id" value={absenceId} />
      <BoutonAvecConfirmation
        libelle={t("absences.lever")}
        variant="outline"
        texteConfirmation={
          <>
            {t("absences.levee_confirmation_avant")} {sujet}{" "}
            {t("absences.levee_confirmation_apres")}
          </>
        }
        boutonConfirmer={t("absences.levee_confirmer")}
        boutonRevenir={t("absences.levee_revenir")}
      />
    </form>
  );
}

/**
 * ÉCOURTER UNE ABSENCE EN COURS (QT-15, D136) — un champ de date et un
 * bouton, AUCUN dialogue : contrairement à la suppression, écourter n'efface
 * rien, et choisir une nouvelle date est déjà le geste délibéré.
 *
 * **Les bornes du champ sont posées ICI, à l'écran, pour guider la saisie**
 * — `min` ne descend jamais sous aujourd'hui ni sous `du`, `max` ne dépasse
 * jamais l'ancienne fin — mais c'est `ecourterAbsence` (`lib/absences/
 * depot.ts`) qui les REJUGE côté serveur : un champ `min`/`max` HTML se
 * contourne par un simple appel direct à la route.
 */
function FormulaireEcourter({
  absenceId,
  du,
  au,
  aujourdHui,
}: {
  readonly absenceId: string;
  readonly du: Date;
  readonly au: Date;
  readonly aujourdHui: Date;
}) {
  const borneBasse = aujourdHui.getTime() > du.getTime() ? aujourdHui : du;
  return (
    <form
      action="/api/absences/ecourter"
      method="post"
      className="flex items-center gap-1.5"
    >
      <input type="hidden" name="absence_id" value={absenceId} />
      <input
        type="date"
        name="au"
        aria-label={t("absences.ecourter_nouvelle_fin")}
        min={versChaineJourInput(borneBasse)}
        max={versChaineJourInput(au)}
        defaultValue={versChaineJourInput(au)}
        required
        className="border-app-bord bg-app-surface rounded-md border px-2 py-1 text-13 font-bold"
      />
      <Button type="submit" variant="outline" size="sm">
        {t("absences.ecourter")}
      </Button>
    </form>
  );
}

/**
 * Le sujet de la confirmation de levée — une personne et sa période, jamais
 * composé dans le JSX (même discipline que `periode`/`listeDesAgences`
 * ci-dessous, L0-11).
 */
function sujetLevee(personne: string, periodeTexte: string): string {
  return `${personne}${SEPARATEUR}${periodeTexte}`;
}

function ChampJour({
  id,
  nom,
  libelle,
  valeur,
}: {
  readonly id: string;
  readonly nom: string;
  readonly libelle: string;
  /** Préremplit le champ après un aperçu — la saisie reste sous les yeux (SAV-12). */
  readonly valeur?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-app-encre-faible text-12 font-bold">
        {libelle}
      </label>
      <input
        id={id}
        name={nom}
        type="date"
        defaultValue={valeur}
        className="border-app-bord bg-app-surface rounded-md border px-2 py-1 text-13 font-bold"
      />
    </div>
  );
}

/**
 * LA FENÊTRE AFFICHÉE — le passé proche et TOUT l'avenir (TR-3, D136).
 *
 * *Jusqu'au 03/10/2026, la borne haute était un trimestre* : au-delà de 90
 * jours, une absence déjà déclarée disparaissait du tableau sans qu'aucun
 * geste ne l'ait levée. L'audit TP-ABS l'a nommé défaut plutôt qu'écran : un
 * planificateur qui pose une absence à 4 mois doit pouvoir la retrouver pour
 * l'écourter ou la supprimer avant qu'elle ne commence. `JOURS_DE_PASSE`
 * n'est donc pas une règle métier — aucune règle ne dit qu'une absence
 * PASSÉE se regarde sur 30 jours —, c'est la borne d'un écran, nommée pour ne
 * pas se lire comme un délai du §8.
 */
const JOURS_DE_PASSE = 30;

/**
 * Le fuseau quand la société n'en déclare pas.
 *
 * *« Inconnu » n'est pas « Nouméa »* : écrire ici le fuseau calédonien ferait
 * du territoire d'un client le défaut du produit. UTC ne décale rien et ne
 * prétend rien.
 */
const FUSEAU_DE_REPLI = "UTC";

/**
 * LE LUNDI DEMANDÉ — le paramètre `semaine` (`AAAA-MM-JJ`, n'importe quel
 * jour de la semaine visée), ou celui de la semaine en cours. Même geste que
 * `jourDemande` de `/planning` : une valeur illisible retombe sur aujourd'hui
 * plutôt que de faire échouer l'écran (L1-02f).
 */
function lundiLu(
  demande: string | undefined,
  aujourdHui: JourLocal,
): JourLocal {
  const lu2 =
    demande === undefined ? null : /^(\d{4})-(\d{2})-(\d{2})$/.exec(demande);
  if (lu2 === null) {
    return lundiDeLaSemaine(aujourdHui);
  }
  const jour = {
    annee: Number(lu2[1]),
    mois: Number(lu2[2]),
    jour: Number(lu2[3]),
  };
  const valide =
    jour.mois >= 1 && jour.mois <= 12 && jour.jour >= 1 && jour.jour <= 31
      ? jour
      : aujourdHui;
  return lundiDeLaSemaine(valide);
}

function fenetreAffichee(fuseau: string): { du: Date; au: Date | null } {
  // LA CIVILE, JAMAIS L'INSTANT (DATES-1) : `lireLesAbsences` compare `du`
  // à `Absence.au`, une `@db.Date` posée à minuit UTC. Borner par arithmétique
  // de millisecondes sur l'instant décalait la fenêtre d'un cran sous UTC+11 ;
  // `instantDuJour` reste sur des jours civils.
  const jour = jourDe(maintenant(fuseau).local);
  return {
    du: instantDuJour(jour, -JOURS_DE_PASSE),
    // AUCUNE BORNE HAUTE (TR-3, D136) — voir la note de tête.
    au: null,
  };
}

/** Un paramètre d'URL, en chaîne — une liste répétée n'en est pas une. */
function lu(valeur: string | string[] | undefined): string | undefined {
  return typeof valeur === "string" ? valeur : undefined;
}

/**
 * LE LIEN DU BOUTON D'EN-TÊTE — ouvre le volet, en gardant `semaine`/`vue`
 * (D175) : changer de semaine ou d'onglet puis déclarer ne doit pas perdre
 * la navigation en cours.
 */
function hrefDeclarer(
  parametres: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();
  const semaineParam = lu(parametres.semaine);
  const vueParam = lu(parametres.vue);
  if (semaineParam !== undefined) {
    params.set("semaine", semaineParam);
  }
  if (vueParam !== undefined) {
    params.set("vue", vueParam);
  }
  const reste = params.toString();
  return `/absences?declarer=1${reste === "" ? "" : `&${reste}`}`;
}

/** L'onglet, en gardant `semaine` — jamais `declarer`/`apercu`, qui referment le volet. */
function hrefOnglet(vue: "aujourdhui" | "terminees" | undefined): string {
  const params = new URLSearchParams();
  if (vue !== undefined) {
    params.set("vue", vue);
  }
  const query = params.toString();
  return query === "" ? "/absences" : `/absences?${query}`;
}

/**
 * LE LIEN DE FERMETURE DU VOLET (D175) — la même adresse, sans
 * `declarer`/`apercu`/`utilisateur_id`/`du`/`au` ; `semaine` et `vue`
 * survivent, jamais perdus par un aller-retour dans le volet.
 */
function hrefFermer(
  parametres: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();
  const semaineParam = lu(parametres.semaine);
  const vueParam = lu(parametres.vue);
  if (semaineParam !== undefined) {
    params.set("semaine", semaineParam);
  }
  if (vueParam !== undefined) {
    params.set("vue", vueParam);
  }
  const query = params.toString();
  return query === "" ? "/absences" : `/absences?${query}`;
}

/**
 * Les compositions sont faites HORS du JSX — un littéral n'y est pas admis,
 * fût-il le séparateur d'une liste (L0-11).
 */
const SEPARATEUR = ", ";
const TIRET = "—";
const TIRET_PERIODE = " → ";
const BARRE = "/";
const TIRET_ISO = "-";

/**
 * Une journée civile, écrite à la main plutôt que par la locale.
 *
 * **`toLocaleDateString` lit le fuseau de l'APPAREIL** et le gardien de L0-08 le
 * refuse, à raison : sous UTC+11 la même journée se rendrait la veille sur une
 * machine restée à Paris. `du` et `au` sont des colonnes `date` — des journées
 * civiles, sans heure et sans fuseau —, et les lire en UTC est la seule façon de
 * les rendre telles qu'elles ont été écrites.
 */
function jourEcrit(journee: Date): string {
  // `jourNum`/`moisNum`, jamais `jour`/`mois` : ce fichier nomme aussi un
  // `JourLocal` `jour` plus haut, et le gardien des chaînes visibles
  // (L0-11) résout un IDENTIFIANT au premier littéral qu'il trouve sous ce
  // nom dans TOUT le fichier — un second `jour` local le ferait résoudre le
  // `"0"` de `padStart` ici plutôt que la vraie valeur, un faux positif
  // mesuré une fois qu'il ne vaut pas la peine de laisser réapparaître.
  const jourNum = String(journee.getUTCDate()).padStart(2, "0");
  const moisNum = String(journee.getUTCMonth() + 1).padStart(2, "0");
  return `${jourNum}${BARRE}${moisNum}${BARRE}${journee.getUTCFullYear()}`;
}

function periode(du: Date, au: Date): string {
  return `${jourEcrit(du)}${TIRET_PERIODE}${jourEcrit(au)}`;
}

/**
 * `du`/`au` EN CHAÎNE ISO (`AAAA-MM-JJ`), pour préremplir un `<input
 * type="date">` ou porter un champ caché — jamais la forme d'affichage
 * `jourEcrit` (SAV-12).
 *
 * `toISOString` reste en UTC quel que soit le fuseau de la machine qui rend la
 * page (L0-08) : sûr pour une colonne `@db.Date`, posée à minuit UTC.
 */
function versChaineJourInput(journee: Date): string {
  const jourNum = String(journee.getUTCDate()).padStart(2, "0");
  const moisNum = String(journee.getUTCMonth() + 1).padStart(2, "0");
  return `${journee.getUTCFullYear()}${TIRET_ISO}${moisNum}${TIRET_ISO}${jourNum}`;
}

/**
 * CHAQUE RÉFÉRENCE UN LIEN VERS SA FICHE (65-ABSENCES-3, SAV-12) — pour
 * reposer sans redemander au registre, à la main, ce qu'une absence a rendu
 * ou va rendre à la file. `Affecter` existe déjà sur `/interventions/{id}`.
 *
 * *Tant que le numéro est nul, l'interface affiche `Local-<6 caractères>`*
 * (I10). La forme est celle du planning, LUE et non recopiée : deux écrans
 * qui nomment la même intervention de deux façons obligent à deviner qu'il
 * s'agit de la même (§9, 01/09). Le séparateur se compose DANS le JSX,
 * `Link` par `Link` — la discipline « hors du JSX » d'`agences`/`periode`
 * ne s'applique pas ici, puisqu'aucune chaîne composée à l'avance ne peut
 * porter un `Link`.
 */
function ListeLiensInterventions({
  interventions,
}: {
  readonly interventions: readonly {
    readonly id: string;
    readonly numero: number | null;
  }[];
}) {
  return (
    <>
      {interventions.map((intervention, index) => (
        <span key={intervention.id}>
          {index === 0 ? null : t("absences.reference_separateur")}
          <Link
            href={`/interventions/${intervention.id}?depuis=absences`}
            className="underline"
          >
            {referenceAffichee(intervention)}
          </Link>
        </span>
      ))}
    </>
  );
}

/**
 * L'ANNONCE DE L'IMPACT, AVANT LA POSE (D175) — « 1 intervention repassera
 * à planifier : » / « N interventions repasseront à planifier : » ou
 * « Aucune intervention touchée. » (SAV-12). La liste qui suit n'est pas
 * composée ici : elle est rendue à part par `ListeLiensInterventions`,
 * chaque référence devenue un lien (65-ABSENCES-3).
 */
function libelleImpact(compte: number): string {
  if (compte === 0) {
    return t("absences.impact_aucune");
  }
  const suffixe =
    compte === 1 ? t("absences.impact_une") : t("absences.impact_plusieurs");
  return `${compte} ${suffixe}`;
}

function listeDesAgences(
  agences: readonly { readonly id: string; readonly libelle: string }[],
): string {
  return agences.map((a) => a.libelle).join(SEPARATEUR);
}

/** Le détail de la tuile « Absents aujourd'hui » (QT-23, D136) — même discipline que `listeDesAgences`. */
function listeDesPersonnes(
  personnes: readonly {
    readonly utilisateurId: string;
    readonly nom: string;
  }[],
): string {
  return personnes.map((p) => p.nom).join(SEPARATEUR);
}
