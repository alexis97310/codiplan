"use client";

import { useEffect, useId, useRef, useState } from "react";

import { decompte } from "@/app/(back-office)/presentation";
import { dateCivile, versLocal, type Fuseau } from "@/lib/calendar/fuseau";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { CLASSES_TON } from "@/lib/theme/statuts";

import type { CibleDeDepot, EnMain } from "@/components/planning/pose";

/**
 * LA FENÊTRE DE POSE (PG-B2-FENETRE-POSE, spécification §3.10, §3.11, CA-3).
 *
 * *Le dépôt d'une carte de la file « À planifier » était refusé 100 % du
 * temps* — la case n'a ni heure ni toujours de durée, et `peutPlanifier`
 * exige les quatre valeurs ensemble (PARCOURS-1). Cette fenêtre les complète
 * AVANT d'écrire : elle ne pose aucune requête tant que « Planifier » n'a pas
 * été cliqué, et cliquer appelle la MÊME route que le glisser-déposer direct
 * (`POST /api/interventions/{id}/deplacer`, via `onConfirmer`, qui est
 * `Posable.deposer` — R2-19, un verdict, un seul chemin qui écrit).
 *
 * ## Ce qu'elle lit, et ce qu'elle n'invente pas
 *
 * `GET /api/interventions/{id}/verdict-pose` (PG-B1) rend `{verdicts,
 * creneaux}` — jamais un état de technicien tout fait. Cette fenêtre le
 * COMPOSE :
 *
 * - les CRÉNEAUX (technicien + jour + durée, sans heure) disent s'il existe
 *   un début possible pour la durée choisie ;
 * - un second appel, à `duree=1`, sert de SONDE : si même une minute ne
 *   trouve aucun début ce jour-là, la cause la plus probable est une absence
 *   couvrant la journée entière (`creneauxDisponibles` la zère avant tout
 *   calcul) plutôt qu'un jour simplement complet. **Ce n'est qu'une
 *   approximation** — un jour rempli à la minute près donnerait le même
 *   signal — mais PG-B1 ne rend pas la cause exacte sans heure, et sonder
 *   plutôt qu'inventer un texte reste la lecture la plus honnête des données
 *   disponibles.
 * - les VERDICTS (habilitation, chevauchement, ouverture, absence) n'existent
 *   que technicien + jour + heure + durée ENSEMBLE (même « tout ou rien » que
 *   `peutPlanifier`) : ils n'apparaissent donc qu'une fois une heure choisie,
 *   dans le panneau « Contrôles » — jamais reconstruits plus tôt.
 *
 * ## Le jour ne se choisit pas ici — SAUF depuis la fiche (PG-B3-TROUVER-CRENEAU-FICHE)
 *
 * Depuis le planning, `jour` est *pré-rempli* par la case sur laquelle la
 * carte a été déposée, ou par le jour du jour depuis le bouton « Poser »
 * (`Posable.ouvrirPose`) — jamais un sélecteur : le ticket d'origine ne
 * demandait des puces que pour la durée et l'heure.
 *
 * Depuis la FICHE d'intervention, il n'y a ni case ni glissé pour fixer le
 * jour : `jourChoisissable` fait alors apparaître un champ date, à la place
 * du texte fixe — le planning ne le demande jamais et garde son comportement
 * exact. `jour` reste la valeur de DÉPART dans les deux cas ; seul l'appelant
 * décide si elle peut changer.
 */

const DUREES_PROPOSEES = [30, 60, 90, 120, 180, 240] as const;

type Verdict = { readonly cle: string; readonly bloquant: boolean };

export function FenetrePose({
  interventionId,
  libelle,
  dureeMinInitiale,
  technicienIdInitial,
  jour,
  jourChoisissable = false,
  fuseau,
  techniciens,
  onFermer,
  onConfirmer,
}: Readonly<{
  interventionId: string;
  libelle: string;
  dureeMinInitiale: number | null;
  technicienIdInitial: string | null;
  /** `AAAA-MM-JJ`, toujours résolu par l'appelant (`Posable.ouvrirPose`) — la valeur de DÉPART, voir `jourChoisissable`. */
  jour: string;
  /**
   * `true` depuis la fiche d'intervention (PG-B3) : un champ date remplace le
   * texte fixe, et `jour` n'est plus alors qu'un point de départ. Le planning
   * ne passe jamais cette prop — il connaît toujours le jour par la case ou
   * par le bouton « Poser », et son comportement reste exactement celui
   * d'avant.
   */
  jourChoisissable?: boolean;
  fuseau: Fuseau;
  techniciens: readonly { readonly id: string; readonly nom: string }[];
  onFermer: () => void;
  onConfirmer: (main: EnMain, cible: CibleDeDepot) => void;
}>) {
  const dialogueRef = useRef<HTMLDialogElement>(null);
  const idTitre = useId();

  const [jourChoisi, setJourChoisi] = useState(jour);
  const [technicienId, setTechnicienId] = useState(
    technicienIdInitial ?? techniciens[0]?.id ?? "",
  );
  const dureeConnue =
    dureeMinInitiale !== null &&
    (DUREES_PROPOSEES as readonly number[]).includes(dureeMinInitiale);
  const [dureeMin, setDureeMin] = useState<number | null>(dureeMinInitiale);
  const [dureeAutreActive, setDureeAutreActive] = useState(
    dureeMinInitiale !== null && !dureeConnue,
  );
  const [dureeAutreTexte, setDureeAutreTexte] = useState(
    dureeMinInitiale !== null && !dureeConnue ? String(dureeMinInitiale) : "",
  );
  const [heureMinutes, setHeureMinutes] = useState<number | null>(null);
  const [heureAutreTexte, setHeureAutreTexte] = useState("");

  const [creneaux, setCreneaux] = useState<readonly string[]>([]);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);
  const [absent, setAbsent] = useState(false);
  const [verdicts, setVerdicts] = useState<readonly Verdict[]>([]);

  useEffect(() => {
    const dialogue = dialogueRef.current;
    // `typeof … === "function"` : jsdom (tests unitaires) n'implémente pas
    // `showModal` — même garde que la disponibilité d'une API navigateur
    // ailleurs dans le dépôt, jamais une omission volontaire du modal.
    if (
      dialogue !== null &&
      !dialogue.open &&
      typeof dialogue.showModal === "function"
    ) {
      dialogue.showModal();
    }
  }, []);

  // ── LES CRÉNEAUX, PUIS LA SONDE « ABSENT » (voir l'entête) ────────────────
  useEffect(() => {
    if (technicienId === "" || dureeMin === null) {
      setCreneaux([]);
      setAbsent(false);
      return;
    }
    let annule = false;
    setRechercheEnCours(true);
    const parametres = new URLSearchParams({
      technicien: technicienId,
      date: jourChoisi,
      duree: String(dureeMin),
    });
    fetch(`/api/interventions/${interventionId}/verdict-pose?${parametres}`)
      .then((reponse) => (reponse.ok ? reponse.json() : null))
      .catch(() => null)
      .then(async (corps: unknown) => {
        if (annule) {
          return;
        }
        const liste = creneauxLus(corps);
        setCreneaux(liste);
        if (liste.length > 0) {
          setAbsent(false);
          return;
        }
        const parametresSonde = new URLSearchParams({
          technicien: technicienId,
          date: jourChoisi,
          duree: "1",
        });
        const reponseSonde = await fetch(
          `/api/interventions/${interventionId}/verdict-pose?${parametresSonde}`,
        ).catch(() => null);
        const corpsSonde =
          reponseSonde !== null && reponseSonde.ok
            ? await reponseSonde.json().catch(() => null)
            : null;
        if (!annule) {
          setAbsent(creneauxLus(corpsSonde).length === 0);
        }
      })
      .finally(() => {
        if (!annule) {
          setRechercheEnCours(false);
        }
      });
    return () => {
      annule = true;
    };
  }, [technicienId, dureeMin, jourChoisi, interventionId]);

  // ── LES VERDICTS — technicien, jour, heure ET durée ENSEMBLE ──────────────
  useEffect(() => {
    if (technicienId === "" || dureeMin === null || heureMinutes === null) {
      setVerdicts([]);
      return;
    }
    let annule = false;
    const parametres = new URLSearchParams({
      technicien: technicienId,
      date: jourChoisi,
      heure: String(heureMinutes),
      duree: String(dureeMin),
    });
    fetch(`/api/interventions/${interventionId}/verdict-pose?${parametres}`)
      .then((reponse) => (reponse.ok ? reponse.json() : null))
      .catch(() => null)
      .then((corps: unknown) => {
        if (!annule) {
          setVerdicts(verdictsLus(corps));
        }
      });
    return () => {
      annule = true;
    };
  }, [technicienId, dureeMin, heureMinutes, jourChoisi, interventionId]);

  function choisirJour(valeur: string) {
    setJourChoisi(valeur);
    setHeureMinutes(null);
  }

  function choisirDuree(valeur: number) {
    setDureeAutreActive(false);
    setDureeMin(valeur);
    setHeureMinutes(null);
  }

  function choisirDureeAutre(texte: string) {
    setDureeAutreTexte(texte);
    const valeur = Number.parseInt(texte, 10);
    setDureeMin(Number.isFinite(valeur) && valeur > 0 ? valeur : null);
    setHeureMinutes(null);
  }

  function choisirHeureAutre(texte: string) {
    setHeureAutreTexte(texte);
    const correspondance = /^(\d{1,2}):(\d{2})$/.exec(texte);
    setHeureMinutes(
      correspondance
        ? Number(correspondance[1]) * 60 + Number(correspondance[2])
        : null,
    );
  }

  const bloquant = verdicts.some((verdict) => verdict.bloquant);
  const peutPlanifier =
    technicienId !== "" &&
    dureeMin !== null &&
    heureMinutes !== null &&
    !absent &&
    !bloquant;

  function fermer() {
    onFermer();
  }

  function planifier() {
    if (!peutPlanifier || dureeMin === null || heureMinutes === null) {
      return;
    }
    const main: EnMain = {
      id: interventionId,
      dureeMin,
      bord: "bloc",
      debutMinutes: null,
      depuisFile: false,
      libelle: null,
      fuseau: null,
    };
    const cible: CibleDeDepot = {
      jour: jourChoisi,
      technicienId,
      minutes: heureMinutes,
      pasMinutes: 0,
      // `deposer` ne lit jamais `survol` (PG-B4) — il ne sert qu'à `CasePosable`,
      // et cet appel n'affiche aucune case. Un instantané neutre suffit.
      survol: { bloquee: false, ouverte: true, ferie: false },
    };
    fermer();
    onConfirmer(main, cible);
  }

  return (
    <dialog
      ref={dialogueRef}
      data-fenetre-pose={interventionId}
      data-jour={jourChoisi}
      data-technicien={technicienId}
      onClose={fermer}
      aria-labelledby={idTitre}
      className="bg-app-surface border-app-bord m-auto w-full max-w-md rounded-lg border p-4 shadow-lg backdrop:bg-app-encre/40"
    >
      <h2 id={idTitre} className="text-[14px] font-bold">
        {t("planning.pose.titre")}
        {t("ponctuation.separateur")}
        {libelle}
      </h2>

      <div className="mt-3 flex flex-col gap-3">
        <div>
          <label
            htmlFor={`${idTitre}-technicien`}
            className="text-app-encre-faible block text-12 font-semibold"
          >
            {t("planning.pose.technicien")}
          </label>
          <select
            id={`${idTitre}-technicien`}
            value={technicienId}
            onChange={(evenement) => {
              setTechnicienId(evenement.target.value);
              setHeureMinutes(null);
            }}
            className="border-app-bord mt-1 min-h-11 w-full rounded-md border px-2 text-13 sm:min-h-0 sm:py-1.5"
          >
            {techniciens.map((technicien) => (
              <option key={technicien.id} value={technicien.id}>
                {technicien.nom}
              </option>
            ))}
          </select>
          <p
            data-etat-technicien={etatTechnicien({
              dureeChoisie: dureeMin,
              rechercheEnCours,
              absent,
              nombreDeCreneaux: creneaux.length,
            })}
            className="text-app-encre-faible mt-1 text-12"
          >
            {libelleEtatTechnicien({
              dureeChoisie: dureeMin,
              rechercheEnCours,
              absent,
              nombreDeCreneaux: creneaux.length,
            })}
          </p>
        </div>

        {jourChoisissable ? (
          <div>
            <label
              htmlFor={`${idTitre}-jour`}
              className="text-app-encre-faible block text-12 font-semibold"
            >
              {t("planning.pose.date")}
            </label>
            <input
              id={`${idTitre}-jour`}
              type="date"
              value={jourChoisi}
              onChange={(evenement) => choisirJour(evenement.target.value)}
              className="border-app-bord mt-1 min-h-11 w-full rounded-md border px-2 text-13 sm:min-h-0 sm:py-1.5"
            />
          </div>
        ) : (
          <p className="text-app-encre-faible text-12">
            {t("planning.pose.date")}
            {t("ponctuation.deux_points")}
            {dateCivile(new Date(`${jourChoisi}T00:00:00.000Z`))}
          </p>
        )}

        <fieldset>
          <legend className="text-app-encre-faible text-12 font-semibold">
            {t("planning.pose.duree")}
          </legend>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {DUREES_PROPOSEES.map((valeur) => (
              <button
                key={valeur}
                type="button"
                aria-pressed={!dureeAutreActive && dureeMin === valeur}
                onClick={() => choisirDuree(valeur)}
                className={`min-h-11 rounded-md border px-2.5 text-12 font-semibold sm:min-h-0 sm:py-1 ${
                  !dureeAutreActive && dureeMin === valeur
                    ? "bg-app-marque text-app-marque-encre border-app-marque"
                    : "border-app-bord"
                }`}
              >
                {t(`planning.pose.duree_${valeur}` as "planning.pose.duree_30")}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={dureeAutreActive}
              onClick={() => {
                setDureeAutreActive(true);
                choisirDureeAutre(dureeAutreTexte);
              }}
              className={`min-h-11 rounded-md border px-2.5 text-12 font-semibold sm:min-h-0 sm:py-1 ${
                dureeAutreActive
                  ? "bg-app-marque text-app-marque-encre border-app-marque"
                  : "border-app-bord"
              }`}
            >
              {t("planning.pose.duree_autre")}
            </button>
          </div>
          {!dureeAutreActive ? null : (
            <input
              type="number"
              min={1}
              inputMode="numeric"
              aria-label={t("planning.pose.duree_autre_libelle")}
              value={dureeAutreTexte}
              onChange={(evenement) =>
                choisirDureeAutre(evenement.target.value)
              }
              className="border-app-bord mt-1.5 min-h-11 w-28 rounded-md border px-2 text-13 sm:min-h-0 sm:py-1"
            />
          )}
        </fieldset>

        {dureeMin === null ? null : (
          <fieldset>
            <legend className="text-app-encre-faible text-12 font-semibold">
              {t("planning.pose.heure")}
            </legend>
            {rechercheEnCours ? (
              <p className="text-app-encre-faible mt-1 text-12">
                {t("planning.pose.chargement")}
              </p>
            ) : creneaux.length === 0 ? (
              <p className="text-app-encre-faible mt-1 text-12">
                {t("planning.pose.heure_aucun_creneau")}
              </p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {creneaux.map((creneau) => {
                  const minutes = minutesLocalesDe(creneau, fuseau);
                  return (
                    <button
                      key={creneau}
                      type="button"
                      aria-pressed={heureMinutes === minutes}
                      onClick={() => setHeureMinutes(minutes)}
                      className={`min-h-11 rounded-md border px-2.5 text-12 font-semibold sm:min-h-0 sm:py-1 ${
                        heureMinutes === minutes
                          ? "bg-app-marque text-app-marque-encre border-app-marque"
                          : "border-app-bord"
                      }`}
                    >
                      {formatteMinutes(minutes)}
                    </button>
                  );
                })}
              </div>
            )}
            <label
              htmlFor={`${idTitre}-heure-autre`}
              className="text-app-encre-faible mt-1.5 block text-12"
            >
              {t("planning.pose.heure_autre")}
            </label>
            <input
              id={`${idTitre}-heure-autre`}
              type="time"
              value={heureAutreTexte}
              onChange={(evenement) =>
                choisirHeureAutre(evenement.target.value)
              }
              className="border-app-bord mt-1 min-h-11 w-28 rounded-md border px-2 text-13 sm:min-h-0 sm:py-1"
            />
          </fieldset>
        )}

        <div aria-live="polite">
          <p className="text-app-encre-faible text-12 font-semibold">
            {t("planning.pose.controles")}
          </p>
          {dureeMin === null || heureMinutes === null ? (
            <p className="text-app-encre-faible mt-1 text-12">
              {t("planning.pose.controles_attente")}
            </p>
          ) : verdicts.length === 0 ? (
            <p
              className={`mt-1 rounded-md border px-2.5 py-1.5 text-12 ${CLASSES_TON.succes}`}
            >
              {t("planning.pose.controles_ok")}
            </p>
          ) : (
            <ul className="mt-1 flex flex-col gap-1">
              {verdicts.map((verdict, index) => (
                <li
                  key={`${verdict.cle}-${index}`}
                  className={`rounded-md border px-2.5 py-1.5 text-12 ${
                    CLASSES_TON[verdict.bloquant ? "refus" : "avertissement"]
                  }`}
                >
                  {estCleTraduction(verdict.cle) ? t(verdict.cle) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={fermer}
          className="border-app-bord min-h-11 rounded-md border px-3 text-13 font-semibold sm:min-h-0 sm:py-1.5"
        >
          {t("planning.pose.annuler")}
        </button>
        <button
          type="button"
          disabled={!peutPlanifier}
          onClick={planifier}
          className="bg-app-marque text-app-marque-encre min-h-11 rounded-md px-3 text-13 font-semibold disabled:opacity-50 sm:min-h-0 sm:py-1.5"
        >
          {t("planning.pose.confirmer")}
        </button>
      </div>
    </dialog>
  );
}

/** Les créneaux d'une réponse — un contenu illisible n'en rend aucun. */
function creneauxLus(corps: unknown): readonly string[] {
  if (
    corps === null ||
    typeof corps !== "object" ||
    !("creneaux" in corps) ||
    !Array.isArray(corps.creneaux)
  ) {
    return [];
  }
  return corps.creneaux.filter(
    (valeur): valeur is string => typeof valeur === "string",
  );
}

/** Les verdicts d'une réponse — même contrôle de forme que `creneauxLus`. */
function verdictsLus(corps: unknown): readonly Verdict[] {
  if (
    corps === null ||
    typeof corps !== "object" ||
    !("verdicts" in corps) ||
    !Array.isArray(corps.verdicts)
  ) {
    return [];
  }
  return corps.verdicts.filter(
    (valeur): valeur is Verdict =>
      typeof valeur === "object" &&
      valeur !== null &&
      "cle" in valeur &&
      typeof valeur.cle === "string" &&
      "bloquant" in valeur &&
      typeof valeur.bloquant === "boolean",
  );
}

/** L'instant ISO d'un créneau, en minutes locales depuis minuit, dans le fuseau donné. */
function minutesLocalesDe(instantIso: string, fuseau: Fuseau): number {
  const local = versLocal(new Date(instantIso), fuseau);
  return local.heures * 60 + local.minutes;
}

/** `510` → `"08:30"` — réemployée par `components/planning/pose.tsx` pour le
 * bandeau d'un déplacement différé (PG-B5) : deux lectures de la même minute
 * divergent en silence (§9, 01/09). */
export function formatteMinutes(minutes: number): string {
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return `${String(heures).padStart(2, "0")}:${String(reste).padStart(2, "0")}`;
}

type ParametresEtat = {
  readonly dureeChoisie: number | null;
  readonly rechercheEnCours: boolean;
  readonly absent: boolean;
  readonly nombreDeCreneaux: number;
};

function etatTechnicien(parametres: ParametresEtat): string {
  if (parametres.dureeChoisie === null) {
    return "attente_duree";
  }
  if (parametres.rechercheEnCours) {
    return "chargement";
  }
  if (parametres.absent) {
    return "absent";
  }
  return parametres.nombreDeCreneaux > 0 ? "libre" : "aucun_creneau";
}

function libelleEtatTechnicien(parametres: ParametresEtat): string {
  switch (etatTechnicien(parametres)) {
    case "attente_duree":
      return t("planning.pose.technicien_choisir_duree");
    case "chargement":
      return t("planning.pose.chargement");
    case "absent":
      return t("planning.pose.technicien_absent");
    case "libre":
      return `${t("planning.pose.technicien_libre")}${t("ponctuation.point_median")}${decompte(
        parametres.nombreDeCreneaux,
        t("planning.creneau_libre_un"),
        t("planning.creneaux_libres"),
      )}`;
    default:
      return t("planning.pose.technicien_aucun_creneau");
  }
}
