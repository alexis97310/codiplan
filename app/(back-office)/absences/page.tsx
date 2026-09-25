import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { BoutonAvecConfirmation } from "@/components/ui/bouton-confirmation";
import { Button } from "@/components/ui/button";
import { Carte } from "@/components/ui/carte";
import { Kpi } from "@/components/ui/kpi";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { apercuAbsence } from "@/lib/absences/depot";
import {
  lireLesAbsences,
  nommerLesAgences,
  nommerLesInterventions,
} from "@/lib/absences/ecran";
import { obtenirSession } from "@/lib/auth/session";
import {
  instantDuJour,
  jourDe,
  jourSuivant,
  maintenant,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { lundiDeLaSemaine } from "@/lib/calendar/semaine";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { quiTravaille } from "@/lib/interventions/personnes";

import { referenceAffichee } from "../interventions/presentation";

import { identifiants } from "../../api/absences/actions";
import {
  absencesDuMois,
  agencesSansTechnicienDisponible,
  enTeteDeJour,
  hrefSemaine,
  libelleMoisAnnee,
  libelleRuptureAucune,
  pastillesDuJour,
  saisieApercuDepuisUrl,
  semaineAffichee,
  versDateCivile,
} from "./presentation";

export const metadata: Metadata = { title: t("absences.titre") };

/**
 * L'ÉCRAN DES BLOCAGES D'AGENDA (R3-14, RG-PLA-06).
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
 * ## Ce qu'il DIT et qu'il ne peut pas empêcher
 *
 * Rien n'est matérialisé : le taux d'occupation relit les blocages à chaque
 * rendu. Poser aujourd'hui un blocage sur la semaine passée change donc un
 * taux **déjà lu**, et il ne dira pas qu'il a changé. *Le travail est de le
 * DIRE là où la saisie se fait* — la forme de D76, appliquée non plus à une
 * valeur mais à sa fraîcheur.
 *
 * ## D125 PUIS D128 — la disposition de `absences()`, JAMAIS son vocabulaire
 * ni ses règles déjà tranchées (lot A4, 18/09/2026)
 *
 * `absences()` de `codiplan-maquette-complete.html` dessine trois KPI puis un
 * calendrier — une SEMAINE de sept colonnes sous un titre de mois, avec sa
 * navigation ‹ / Aujourd'hui / ›. Ces deux blocs sont ajoutés ICI, au-dessus
 * du contenu déjà écrit. **Ce que D125 ne touche PAS** (D128, deux raisons
 * distinctes) :
 *
 * - **Le TITRE reste « Blocages d'agenda ».** C'est un choix de VOCABULAIRE
 *   (D122), pas de disposition — et un choix délibéré de R3-14 pour ne pas
 *   laisser croire à un outil de congés. La maquette écrit « Absences » ;
 *   `absences.titre` ne bouge pas. **L'audit d'ergonomie du 25/09/2026
 *   (constat 36) redemande cet alignement avec `nav.absences` — refusé pour
 *   la même raison, arbitrage porté en fin de `docs/backlog.md`
 *   (99D-ABSENCES-1) plutôt que tranché en session.**
 * - **Le formulaire de déclaration, le tableau des blocages et les deux
 *   bandeaux (interventions rendues, rupture de service au moment de la
 *   pose) restent.** `absences()` ne les dessine pas, mais ce sont des
 *   REMPLACEMENTS FONCTIONNELS ASSUMÉS — la seule façon de poser ou lever un
 *   blocage dans ce dépôt — et D128 l'écrit en toutes lettres : *jamais au
 *   prix de supprimer une information réelle que la maquette ignore.*
 *
 * **Les pastilles du calendrier montrent une PERSONNE, jamais un TYPE.** La
 * maquette écrit « J. Lefèvre · Congé » ; `absence` (R3-14) ne porte aucune
 * nature, et l'inventer romprait exactement la décision que ce fichier
 * documente plus haut. Voir `./presentation.ts` pour le détail.
 *
 * **Le bouton d'en-tête « + Déclarer une absence » n'est pas construit** —
 * écart nommé, `lib/absences/ecarts-maquette.ts` : un bouton de CRÉATION
 * n'entre jamais dans les actions de `Page` (§2 de `ActionPrimaire`), et le
 * vrai geste reste le formulaire déjà sur cette page.
 *
 * **« Rupture de service » du KPI n'est PAS `rupturesDeService`.** Celle-ci
 * juge un ÉVÉNEMENT (une pose qui vient de rendre des interventions) et ne se
 * relit pas ; le KPI répond à une question différente — *combien d'agences
 * n'ont AUJOURD'HUI aucun technicien disponible* —, voir la note de
 * `agencesSansTechnicienDisponible` dans `./presentation.ts`.
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
  // UN APPEL DE PLUS, SÉQUENTIEL, JAMAIS IMBRIQUÉ : `apercuAbsence` ouvre sa
  // PROPRE transaction cloisonnée — le même principe que les multiples appels
  // de `tableau-de-bord/page.tsx`. L'imbriquer dans le `avecContexteApplicatif`
  // ci-dessous ouvrirait une seconde transaction À L'INTÉRIEUR de la première.
  const apercu =
    apercuSaisie === null
      ? null
      : await apercuAbsence(session.contexte, apercuSaisie);

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
    const lecture = await lireLesAbsences(tx, fenetreAffichee(fuseau));
    // LA SEMAINE AFFICHÉE EST LUE À PART, dans SES seules bornes — jamais en
    // élargissant la fenêtre par défaut jusqu'à elle. `vue.absences` (et le
    // tableau qui le rend) ne doit pas grossir parce qu'une navigation a
    // demandé une semaine lointaine ; sept jours, toujours sept jours,
    // quelle que soit la distance parcourue par `?semaine=`.
    const lectureSemaine = await lireLesAbsences(tx, {
      du: versDateCivile(semaine[0]),
      au: versDateCivile(semaine[6]),
    });
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

  const moisEnCours = absencesDuMois(vue.absences, vue.aujourdHui);

  return (
    <Page
      chemin="/absences"
      titre={t("absences.titre")}
      sousTitre={t("absences.sous_titre")}
    >
      <div
        data-bloc="kpi-grille"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <div data-bloc="kpi-absences-mois">
          <Kpi
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
          <Kpi
            ton="rouge"
            libelle={t("absences.kpi_rupture")}
            valeur={vue.agencesEnRupture.length}
            detail={
              vue.agencesEnRupture.length === 0
                ? libelleRuptureAucune()
                : listeDesAgences(vue.agencesEnRupture)
            }
          />
        </div>
        <div data-bloc="kpi-demandes-valider">
          <Kpi
            ton="orange"
            libelle={t("absences.kpi_demandes_a_valider")}
            valeur={t("absences.kpi_demandes_a_valider_valeur")}
            detail={t("absences.kpi_demandes_a_valider_motif")}
          />
        </div>
      </div>

      <Carte titre={libelleMoisAnnee(vue.semaine[0])}>
        <div
          data-bloc="calendrier-nav"
          className="border-app-bord flex items-center gap-2 border-b px-[16px] py-[10px]"
        >
          <Link
            href={hrefSemaine(jourSuivant(vue.lundiAffiche, -7))}
            className="border-app-bord rounded-md border px-2.5 py-1.5 text-[12.5px] font-semibold"
          >
            {t("absences.calendrier_precedente")}
          </Link>
          <Link
            href={hrefSemaine(lundiDeLaSemaine(vue.aujourdHui))}
            className="border-app-bord rounded-md border px-2.5 py-1.5 text-[12.5px] font-semibold"
          >
            {t("absences.calendrier_aujourdhui")}
          </Link>
          <Link
            href={hrefSemaine(jourSuivant(vue.lundiAffiche, 7))}
            className="border-app-bord rounded-md border px-2.5 py-1.5 text-[12.5px] font-semibold"
          >
            {t("absences.calendrier_suivante")}
          </Link>
        </div>
        <div data-bloc="calendrier" className="grid grid-cols-1 sm:grid-cols-7">
          {vue.semaine.map((jour) => (
            <JourDuCalendrier
              key={enTeteDeJour(jour)}
              jour={jour}
              pastilles={pastillesDuJour(
                jour,
                vue.absencesSemaine,
                vue.annuaireSemaine,
              )}
            />
          ))}
        </div>
      </Carte>

      {/* CE QUI SUIT N'EST PAS DANS `absences()` — REMPLACEMENTS FONCTIONNELS
          ASSUMÉS (D128) : voir le docblock de tête. */}

      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(motif)}
        </p>
      ) : null}

      {vue.interventionsRendues.length > 0 ? (
        <section
          role="status"
          className="border-app-bord bg-app-surface flex flex-col gap-1.5 rounded-md border px-3.5 py-2.5 text-[12.5px]"
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

      {vue.agencesRompues.length > 0 ? (
        <section
          role="alert"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre flex flex-col gap-1.5 rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          <p className="font-bold">{t("absences.rupture_titre")}</p>
          <p>{listeDesAgences(vue.agencesRompues)}</p>
          <p>{t("absences.rupture_explication")}</p>
        </section>
      ) : null}

      <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
        <h2 className="text-[14px] font-bold">{t("absences.declarer")}</h2>
        <form
          action="/absences"
          method="get"
          className="flex flex-wrap items-end gap-2"
        >
          <input type="hidden" name="apercu" value="1" />
          <div className="flex flex-col gap-1">
            <label
              htmlFor="absence-personne"
              className="text-app-encre-faible text-[11px]"
            >
              {t("absences.personne")}
            </label>
            <select
              id="absence-personne"
              name="utilisateur_id"
              defaultValue={apercuSaisie?.utilisateur_id}
              className="border-app-bord bg-app-surface min-w-52 rounded-md border px-2 py-1 text-[12.5px]"
            >
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
          <ChampJour
            id="absence-du"
            nom="du"
            libelle={t("absences.du")}
            valeur={
              apercuSaisie === null
                ? undefined
                : versChaineJourInput(apercuSaisie.du)
            }
          />
          <ChampJour
            id="absence-au"
            nom="au"
            libelle={t("absences.au")}
            valeur={
              apercuSaisie === null
                ? undefined
                : versChaineJourInput(apercuSaisie.au)
            }
          />
          <Button type="submit" variant="outline" size="sm">
            {t("absences.apercu_action")}
          </Button>
        </form>

        {apercuSaisie !== null && vue.interventionsApercu !== null ? (
          <section
            role="status"
            className="border-app-bord bg-app-surface flex flex-col gap-2 rounded-md border px-3.5 py-2.5 text-[12.5px]"
          >
            <p>
              {libelleApercuAnnonce(vue.interventionsApercu.length)}
              {vue.interventionsApercu.length > 0 ? (
                <>
                  {" "}
                  <ListeLiensInterventions
                    interventions={vue.interventionsApercu}
                  />
                </>
              ) : null}
            </p>
            <form
              action="/api/absences/declarer"
              method="post"
              className="flex"
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
              <Button type="submit" variant="outline" size="sm">
                {t("absences.declarer_action")}
              </Button>
            </form>
          </section>
        ) : null}

        <p className="text-app-encre-faible text-[11.5px]">
          {t("absences.immediat")}
        </p>
        <p className="text-app-encre-faible text-[11.5px]">
          {t("absences.retroactif")}
        </p>
      </section>

      <section className="bg-app-surface border-app-bord overflow-hidden rounded-lg border">
        <Tableau colonnes={COLONNES()} minimum="760px">
          {vue.absences.length === 0 ? (
            <LignePleine colonnes={3}>{t("absences.aucune")}</LignePleine>
          ) : null}
          {vue.absences.map((absence) => (
            <tr key={absence.id}>
              <Cellule fort>
                {quiTravaille(absence.utilisateur_id, vue.annuaire)}
              </Cellule>
              <Cellule>{periode(absence.du, absence.au)}</Cellule>
              <Cellule>
                <FormulaireLevee
                  absenceId={absence.id}
                  sujet={sujetLevee(
                    quiTravaille(absence.utilisateur_id, vue.annuaire),
                    periode(absence.du, absence.au),
                  )}
                />
              </Cellule>
            </tr>
          ))}
        </Tableau>
      </section>

      <p className="text-app-encre-faible text-[11.5px]">
        {t("absences.levee_explication")}
      </p>
    </Page>
  );
}

/** Une colonne du calendrier — un jour, ses pastilles (une par personne bloquée). */
function JourDuCalendrier({
  jour,
  pastilles,
}: {
  readonly jour: JourLocal;
  readonly pastilles: readonly {
    readonly utilisateurId: string;
    readonly nom: string;
  }[];
}) {
  return (
    <div className="border-app-bord flex flex-col gap-1.5 border-b border-l p-2 first:border-l-0 sm:border-b-0">
      <span className="text-app-encre-faible text-[11px] font-semibold">
        {enTeteDeJour(jour)}
      </span>
      {pastilles.map((pastille) => (
        <span
          key={pastille.utilisateurId}
          data-bloc="calendrier-pastille"
          className="bg-app-violet-fond text-app-violet-encre rounded-md px-1.5 py-1 text-[11px] font-semibold"
        >
          {pastille.nom} {t("absences.pastille_separateur")}{" "}
          {t("absences.pastille_bloque")}
        </span>
      ))}
    </div>
  );
}

function COLONNES() {
  return [
    { cle: "personne", libelle: t("absences.personne"), largeur: "220px" },
    { cle: "periode", libelle: t("absences.periode") },
    { cle: "levee", libelle: t("absences.levee"), largeur: "160px" },
  ];
}

/**
 * LEVER UN BLOCAGE — la seule action possible sur une ligne existante.
 *
 * *Il n'y a rien à « trancher »* : la ligne bloque dès qu'elle existe. Ce
 * formulaire la supprime, et ce qu'il ne fait pas est dit à côté du
 * tableau — lever ne rend pas leurs créneaux aux interventions déjà rendues
 * à la file. **Depuis 99D-ABSENCES-1, ce que ça ne fait pas est aussi dit
 * dans la confirmation elle-même** (constat 37 de l'audit du 25/09/2026),
 * avec la même mécanique que `BoutonAnnuler` sur la fiche d'intervention
 * (lot 84) — un dialogue natif, jamais une soumission au premier clic.
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
      <label htmlFor={id} className="text-app-encre-faible text-[11px]">
        {libelle}
      </label>
      <input
        id={id}
        name={nom}
        type="date"
        defaultValue={valeur}
        className="border-app-bord bg-app-surface rounded-md border px-2 py-1 text-[12.5px]"
      />
    </div>
  );
}

/**
 * LA FENÊTRE AFFICHÉE — le passé proche et le trimestre qui vient.
 *
 * Ce ne sont pas des durées métier : aucune règle ne dit qu'une absence se
 * regarde sur 90 jours. C'est la borne d'un écran, et elle est nommée pour ne
 * pas se lire comme un délai du §8.
 */
const JOURS_DE_PASSE = 30;
const JOURS_A_VENIR = 90;

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

function fenetreAffichee(fuseau: string): { du: Date; au: Date } {
  // LA CIVILE, JAMAIS L'INSTANT (DATES-1) : `lireLesAbsences` compare `du`
  // et `au` à `Absence.du`/`Absence.au`, deux `@db.Date` posées à minuit UTC.
  // Borner par arithmétique de millisecondes sur l'instant décalait la
  // fenêtre d'un cran sous UTC+11 ; `instantDuJour` reste sur des jours civils.
  const jour = jourDe(maintenant(fuseau).local);
  return {
    du: instantDuJour(jour, -JOURS_DE_PASSE),
    au: instantDuJour(jour, JOURS_A_VENIR),
  };
}

/** Un paramètre d'URL, en chaîne — une liste répétée n'en est pas une. */
function lu(valeur: string | string[] | undefined): string | undefined {
  return typeof valeur === "string" ? valeur : undefined;
}

/**
 * Les compositions sont faites HORS du JSX — un littéral n'y est pas admis,
 * fût-il le séparateur d'une liste (L0-11).
 */
const SEPARATEUR = ", ";
const TIRET = " → ";
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
  return `${jourEcrit(du)}${TIRET}${jourEcrit(au)}`;
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
            href={`/interventions/${intervention.id}`}
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
 * L'ANNONCE DE L'APERÇU — « Cette absence rendra N intervention(s) à la
 * file : » ou « Aucune intervention touchée » (SAV-12). La liste qui suit
 * n'est plus composée ici : elle est rendue à part par
 * `ListeLiensInterventions`, chaque référence devenue un lien (65-ABSENCES-3).
 */
function libelleApercuAnnonce(compte: number): string {
  if (compte === 0) {
    return t("absences.apercu_aucune");
  }
  const suffixe =
    compte === 1
      ? t("absences.apercu_suffixe_une")
      : t("absences.apercu_suffixe");
  return `${t("absences.apercu_prefixe")} ${compte} ${suffixe}`;
}

function listeDesAgences(
  agences: readonly { readonly id: string; readonly libelle: string }[],
): string {
  return agences.map((a) => a.libelle).join(SEPARATEUR);
}
