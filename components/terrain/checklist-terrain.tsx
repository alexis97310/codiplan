"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { PhotosTerrain } from "@/components/interventions/photos-terrain";
import {
  etatDeCompletude,
  type PointPourCompletude,
  type ReponsePourCompletude,
} from "@/lib/checklists/completude";
import { ligneNonConforme } from "@/lib/checklists/suite-preremplie";
import { t } from "@/lib/i18n/fr";
import {
  ajouterSaisie,
  compterEnAttente,
  EVENEMENT_CHECKLIST_SAUTER_AU_POINT,
  EVENEMENT_FILE_MODIFIEE,
  listerFilePourIntervention,
  signalerChecklistNonConforme,
  type DetailChecklistSauterAuPoint,
  type EntreeFile,
  type GesteChecklist,
} from "@/lib/terrain/file-saisies";

/**
 * LA TUILE DE SAISIE CHECKLIST, SUR LA FICHE TERRAIN (9K21-CHECKLIST-
 * TERRAIN-SAISIE, CK5 ; « ÉPURÉE » DEPUIS 9L04D-TERRAIN-CHECKLIST-EPUREE,
 * décision d'Alexis du 13/11/2026) — toujours ouverte, sans bouton
 * « Afficher le détail » : chaque rubrique se replie ou se déplie pour elle-
 * même. N'est rendue QUE si un gabarit s'est résolu (`checklist.disponible
 * === true` côté page) : rien ne change pour les interventions sans
 * checklist.
 *
 * ## LE GESTE S'ÉCRIT DANS LA FILE, JAMAIS EN LIGNE DIRECTEMENT
 *
 * À la différence du rapport ou des prestations (`rapport-automatique.tsx`),
 * cette tuile ne tente AUCUN envoi réseau elle-même : chaque réponse est
 * aussitôt écrite dans la file (`ajouterSaisie`, geste « checklist »,
 * coalescable — voir `lib/terrain/file-saisies.ts`), qui la porte comme
 * n'importe quelle autre saisie hors réseau. L'envoi réel part du bouton
 * « Envoyer » (générique, `envoi-file.ts`) ou de `flushTout`, avant
 * « Terminer » (`rapport-automatique.tsx`).
 *
 * ## LA DIFFÉRENCE EST CUMULÉE, PAS REMPLACÉE À CHAQUE RÉPONSE
 *
 * `differenceRef` porte TOUT ce que cet appareil a changé depuis la
 * dernière base connue (la réponse serveur au premier chargement, ou une
 * saisie déjà en file reprise au montage) : répondre à un second point
 * fusionne sa réponse dans cette même différence avant de rappeler
 * `ajouterSaisie`, qui REMPLACE l'entrée précédente dans la file (voir
 * `TYPES_COALESCABLES`) — jamais deux entrées « checklist » en file pour la
 * même intervention.
 *
 * ## LE RETRAIT D'UNE RÉPONSE — MESURÉ, PARTIEL (point 3 de 9L04D)
 *
 * Un second appui sur la pastille choisie remet SA valeur à `null`, et
 * c'est tout ce qui existe aujourd'hui : la clé disparaît localement et de
 * la différence envoyée, donc un point répondu PUIS retiré AVANT d'avoir
 * été envoyé ne part jamais. Une réponse déjà écrite côté serveur, elle, NE
 * PEUT PAS être effacée par ce geste — `enregistrerReponses`
 * (`lib/checklists/depot.ts`) refuse toute `valeur: null` comme n'importe
 * quelle valeur hors du type du point, parce que le rôle applicatif ne
 * détient aucun privilège `DELETE` sur `checklist_reponse` (mesuré :
 * `GRANT SELECT, INSERT, UPDATE` seulement, migration 9K08). Rouvrir cela
 * demande une migration — hors de ce lot (« AUCUNE migration »).
 */

export type PointChecklistEcran = {
  readonly id: string;
  readonly section: string;
  readonly libelle: string;
  readonly consigne: string | null;
  readonly obligatoire: boolean;
  readonly typeReponse: string;
  readonly unite: string | null;
  readonly choix: readonly string[];
  /** La réponse déjà connue du serveur — `null` si ce point n'a pas encore de réponse. */
  readonly valeurInitiale: string | number | boolean | null;
};

/** Le MAXIMUM d'options que les segments pleine largeur portent — au-delà, le menu déroulant. */
const MAX_OPTIONS_SEGMENTS = 4;

function valeursInitiales(
  points: readonly PointChecklistEcran[],
): Record<string, unknown> {
  const valeurs: Record<string, unknown> = {};
  for (const point of points) {
    if (point.valeurInitiale !== null) {
      valeurs[point.id] = point.valeurInitiale;
    }
  }
  return valeurs;
}

/** Vrai si CE point porte une réponse — un retrait local vaut absence, jamais `null` compté comme répondu. */
function estRepondu(valeur: unknown): boolean {
  return valeur !== undefined && valeur !== null;
}

function parSection(
  points: readonly PointChecklistEcran[],
): ReadonlyMap<string, readonly PointChecklistEcran[]> {
  const groupes = new Map<string, PointChecklistEcran[]>();
  for (const point of points) {
    const liste = groupes.get(point.section) ?? [];
    liste.push(point);
    groupes.set(point.section, liste);
  }
  return groupes;
}

function completudeDe(
  points: readonly PointChecklistEcran[],
  valeurs: Readonly<Record<string, unknown>>,
) {
  const pointsPourCompletude: PointPourCompletude[] = points.map((point) => ({
    id: point.id,
    section: point.section,
    libelle: point.libelle,
    obligatoire: point.obligatoire,
  }));
  const reponsesPourCompletude: ReponsePourCompletude[] = points
    .filter((point) => estRepondu(valeurs[point.id]))
    .map((point) => ({
      checklistPointId: point.id,
      nonConforme: valeurs[point.id] === "non_conforme",
    }));
  return etatDeCompletude(pointsPourCompletude, reponsesPourCompletude);
}

/** `Checklist · 5 sur 14` — composé hors JSX, où aucun littéral n'est admis (L0-11). */
function libelleAvancement(repondus: number, total: number): string {
  return (
    `${t("checklist.terrain.provenance_prefixe")}` +
    `${t("ponctuation.point_median")}${repondus} ` +
    `${t("checklist.terrain.sur")} ${total}`
  );
}

/** `Hors réseau · 2 à envoyer` — même patron que `libelleAvancement`. */
function libelleReseau(enAttente: number): string {
  return enAttente === 0
    ? t("checklist.terrain.hors_reseau")
    : `${t("checklist.terrain.hors_reseau")}` +
        `${t("ponctuation.point_median")}${enAttente} ` +
        `${t("checklist.terrain.a_envoyer")}`;
}

/** `1 obligatoire` — composé, jamais un gabarit JSX (L0-11). */
function libelleObligatoireManquant(n: number): string {
  return `${n} ${t("checklist.terrain.obligatoire_manquant")}`;
}

/** `3/4` — le compteur d'une rubrique, composé hors JSX (L0-11). */
function libelleCompteur(repondus: number, total: number): string {
  return `${repondus}/${total}`;
}

/**
 * L'AVANCEMENT ET LE RÉSEAU (point 1, 9L04D) — un trait de 3 px, puis le
 * compte à gauche, l'état réseau à droite. `enAttente` porte TOUTE la file
 * de cette identité, jamais seulement celle de cette intervention — même
 * convention que `BoutonEnvoyer`.
 */
function Avancement({
  repondus,
  total,
  utilisateurId,
  societeId,
}: {
  readonly repondus: number;
  readonly total: number;
  readonly utilisateurId: string;
  readonly societeId: string;
}) {
  const [horsLigne, setHorsLigne] = useState(false);
  const [enAttente, setEnAttente] = useState(0);

  useEffect(() => {
    setHorsLigne(!navigator.onLine);
    function rafraichirCompte(): void {
      void compterEnAttente({ utilisateurId, societeId }).then(setEnAttente);
    }
    rafraichirCompte();
    const surEnLigne = () => setHorsLigne(false);
    const surHorsLigne = () => setHorsLigne(true);
    window.addEventListener("online", surEnLigne);
    window.addEventListener("offline", surHorsLigne);
    window.addEventListener(EVENEMENT_FILE_MODIFIEE, rafraichirCompte);
    return () => {
      window.removeEventListener("online", surEnLigne);
      window.removeEventListener("offline", surHorsLigne);
      window.removeEventListener(EVENEMENT_FILE_MODIFIEE, rafraichirCompte);
    };
  }, [utilisateurId, societeId]);

  const proportion = total === 0 ? 0 : Math.min(1, repondus / total);

  return (
    <div className="flex flex-col gap-2">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={repondus}
        className="bg-app-terrain-filet h-[3px] w-full overflow-hidden rounded-full"
      >
        <div
          className="bg-app-bleu-plein h-full rounded-full"
          style={{ width: `${proportion * 100}%` }}
        />
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <p role="status" className="text-app-terrain-encre text-16 font-medium">
          {libelleAvancement(repondus, total)}
        </p>
        {!horsLigne ? null : (
          <p
            role="status"
            className="text-app-terrain-encre-secondaire text-13"
          >
            {libelleReseau(enAttente)}
          </p>
        )}
      </div>
    </div>
  );
}

/** La légende des trois symboles — UNE FOIS, en tête (point 2, 9L04D). */
function Legende() {
  return (
    <p className="text-app-terrain-encre-secondaire text-13">
      {t("checklist.terrain.legende")}
    </p>
  );
}

/** Les classes PARTAGÉES d'une pastille — composées hors JSX, jamais en littéral dans le rendu. */
const CLASSES_PASTILLE =
  "flex h-11 w-[46px] items-center justify-center rounded-md text-16 font-semibold";
const CLASSES_PASTILLE_AU_REPOS = `text-app-terrain-encre ${CLASSES_PASTILLE}`;

/**
 * LES TROIS PASTILLES conforme/non-conforme/sans-objet (point 3, 9L04D) —
 * symboles ✓ ✕ – (`checklist.terrain.symbole_*`, UN SEUL ENDROIT à changer
 * en lettres). Un second appui sur la pastille déjà choisie RETIRE la
 * réponse (voir le docblock du module, « LE RETRAIT »).
 *
 * TROIS ÉLÉMENTS ÉCRITS À PART, JAMAIS UN TABLEAU `.map()` (revue, même
 * motif que l'ancien `champDuType` CK5) — le gardien L0-11 ne distingue pas,
 * dans un tableau de paires destructuré en JSX, la VALEUR interne (jamais
 * affichée) du LIBELLÉ traduit (affiché) : il rougit sur les deux à la fois.
 */
function PastillesConformite({
  valeur,
  onChange,
}: {
  readonly valeur: unknown;
  readonly onChange: (valeur: unknown) => void;
}) {
  return (
    <div
      role="group"
      className="bg-app-terrain-champ-fond flex gap-1 rounded-md p-1"
    >
      <button
        type="button"
        aria-pressed={valeur === "conforme"}
        aria-label={t("checklist.terrain.option_conforme")}
        onClick={() => onChange(valeur === "conforme" ? null : "conforme")}
        className={
          valeur === "conforme"
            ? `bg-app-terrain-vert-plein text-app-terrain-vert-plein-encre ${CLASSES_PASTILLE}`
            : CLASSES_PASTILLE_AU_REPOS
        }
      >
        {t("checklist.terrain.symbole_conforme")}
      </button>
      <button
        type="button"
        aria-pressed={valeur === "non_conforme"}
        aria-label={t("checklist.terrain.non_conforme")}
        onClick={() =>
          onChange(valeur === "non_conforme" ? null : "non_conforme")
        }
        className={
          valeur === "non_conforme"
            ? `bg-app-terrain-rouge-plein text-app-terrain-rouge-plein-encre ${CLASSES_PASTILLE}`
            : CLASSES_PASTILLE_AU_REPOS
        }
      >
        {t("checklist.terrain.symbole_non_conforme")}
      </button>
      <button
        type="button"
        aria-pressed={valeur === "sans_objet"}
        aria-label={t("checklist.terrain.option_sans_objet")}
        onClick={() => onChange(valeur === "sans_objet" ? null : "sans_objet")}
        className={
          valeur === "sans_objet"
            ? `bg-app-gris-bord text-app-terrain-vert-plein-encre ${CLASSES_PASTILLE}`
            : CLASSES_PASTILLE_AU_REPOS
        }
      >
        {t("checklist.terrain.symbole_sans_objet")}
      </button>
    </div>
  );
}

/** LA COCHE RONDE « FAIT » (point 3, 9L04D) — remplace la case native. */
function CocheRonde({
  libelle,
  valeur,
  onChange,
}: {
  readonly libelle: string;
  readonly valeur: unknown;
  readonly onChange: (valeur: unknown) => void;
}) {
  const faite = valeur === true;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={faite}
      aria-label={libelle}
      onClick={() => onChange(faite ? null : true)}
      className={
        faite
          ? "bg-app-terrain-vert-plein text-app-terrain-vert-plein-encre flex size-11 items-center justify-center rounded-full text-16 font-semibold"
          : "border-app-terrain-filet text-app-terrain-encre flex size-11 items-center justify-center rounded-full border-2 text-16 font-semibold"
      }
    >
      {faite ? t("checklist.terrain.symbole_conforme") : null}
    </button>
  );
}

/** LES SEGMENTS DE CHOIX, pleine largeur, 2 à 4 options (point 3, 9L04D). */
function SegmentsChoix({
  libelle,
  options,
  valeur,
  onChange,
}: {
  readonly libelle: string;
  readonly options: readonly string[];
  readonly valeur: unknown;
  readonly onChange: (valeur: unknown) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={libelle}
      className="bg-app-terrain-champ-fond flex w-full gap-1 rounded-md p-1"
    >
      {options.map((option) => {
        const choisie = valeur === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={choisie}
            onClick={() => onChange(choisie ? null : option)}
            className={
              choisie
                ? "bg-app-bleu-plein text-app-bleu-plein-encre h-11 flex-1 rounded-md text-16 font-semibold"
                : "text-app-terrain-encre h-11 flex-1 rounded-md text-16 font-medium"
            }
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function champDuType(
  point: PointChecklistEcran,
  valeur: unknown,
  onChange: (valeur: unknown) => void,
  photo: {
    readonly interventionId: string;
    readonly utilisateurId: string;
    readonly societeId: string;
    readonly sansSession: boolean;
  },
): ReactNode {
  switch (point.typeReponse) {
    case "conforme_non_conforme_sans_objet":
      return <PastillesConformite valeur={valeur} onChange={onChange} />;
    case "valeur_mesuree":
      return (
        <label className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            aria-label={point.libelle}
            value={typeof valeur === "number" ? valeur : ""}
            onChange={(e) =>
              onChange(e.target.value === "" ? null : Number(e.target.value))
            }
            className="bg-app-terrain-champ-fond text-app-terrain-encre h-12 w-[84px] rounded-md border-none text-right text-16 font-semibold"
          />
          {point.unite === null ? null : (
            <span className="text-app-terrain-encre text-16 font-medium">
              {point.unite}
            </span>
          )}
        </label>
      );
    case "case_faite":
      return (
        <CocheRonde
          libelle={point.libelle}
          valeur={valeur}
          onChange={onChange}
        />
      );
    case "choix_dans_une_liste":
      if (point.choix.length <= MAX_OPTIONS_SEGMENTS) {
        return (
          <SegmentsChoix
            libelle={point.libelle}
            options={point.choix}
            valeur={valeur}
            onChange={onChange}
          />
        );
      }
      return (
        <select
          aria-label={point.libelle}
          value={typeof valeur === "string" ? valeur : ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : e.target.value)
          }
          className="bg-app-terrain-champ-fond text-app-terrain-encre rounded-md border-none px-2 py-1.5 text-16 font-medium"
        >
          <option value="">{t("checklist.terrain.choisir")}</option>
          {point.choix.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    case "texte_libre":
      return (
        <input
          type="text"
          aria-label={point.libelle}
          value={typeof valeur === "string" ? valeur : ""}
          maxLength={2000}
          onChange={(e) =>
            onChange(e.target.value.length === 0 ? null : e.target.value)
          }
          className="bg-app-terrain-champ-fond text-app-terrain-encre h-12 w-40 rounded-md border-none px-2 text-16 font-medium"
        />
      );
    case "photo":
      // AUCUN `onChange` ICI (9K28-CHECKLIST-REPONSE-PHOTO) — une réponse
      // `photo` ne passe JAMAIS par la différence JSON du geste « checklist »
      // (`validerReponsePoint` la refuse toujours) : `PhotosTerrain` écrit
      // directement sa propre réponse par la route des photos, MÊME
      // COMPOSANT, MÊME ROUTE que les photos d'intervention, jamais une
      // seconde chaîne d'envoi. `valeur` ne porte ici que le NOMBRE de
      // photos déjà liées (`valeurChecklistAffichee`), simple affichage.
      return (
        <div className="flex flex-col items-end gap-2">
          {typeof valeur !== "number" ? null : (
            <p className="text-app-terrain-vert-plein text-13 font-medium">
              {valeur} {t("checklist.terrain.photos_ajoutees")}
            </p>
          )}
          <PhotosTerrain
            action={`/api/terrain/${photo.interventionId}/photos`}
            libelleAjouter={t("checklist.terrain.ajouter_photo")}
            interventionId={photo.interventionId}
            utilisateurId={photo.utilisateurId}
            societeId={photo.societeId}
            sansSession={photo.sansSession}
            checklistPointId={point.id}
          />
        </div>
      );
    default:
      return null;
  }
}

/** UN POINT = UNE LIGNE (point 3, 9L04D) — hauteur minimale 64 px. */
function PointLigne({
  point,
  valeur,
  onChange,
  photo,
}: {
  readonly point: PointChecklistEcran;
  readonly valeur: unknown;
  readonly onChange: (valeur: unknown) => void;
  readonly photo: {
    readonly interventionId: string;
    readonly utilisateurId: string;
    readonly societeId: string;
    readonly sansSession: boolean;
  };
}) {
  // Choix, texte et photo veulent leur propre largeur : le libellé garde sa
  // ligne, la commande suit sur la ligne suivante, pleine largeur (point 3).
  const surSaPropreLigne =
    point.typeReponse === "choix_dans_une_liste" &&
    point.choix.length <= MAX_OPTIONS_SEGMENTS;

  return (
    <div
      id={`checklist-point-${point.id}`}
      className={
        surSaPropreLigne
          ? "border-app-terrain-filet flex min-h-16 flex-col gap-2 border-b py-3 last:border-b-0"
          : "border-app-terrain-filet flex min-h-16 flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0"
      }
    >
      <div className="flex flex-col gap-1">
        <span className="text-app-terrain-encre text-16 font-medium">
          {point.libelle}
        </span>
        {point.consigne === null ? null : (
          <p className="text-app-terrain-encre-secondaire text-13">
            {point.consigne}
          </p>
        )}
        {!point.obligatoire || estRepondu(valeur) ? null : (
          <span className="text-app-marque text-13">
            {t("checklist.parametrage.point_obligatoire")}
          </span>
        )}
      </div>
      <div className={surSaPropreLigne ? "w-full" : undefined}>
        {champDuType(point, valeur, onChange, photo)}
      </div>
    </div>
  );
}

/**
 * UNE RUBRIQUE (point 4, 9L04D) — dépliée par défaut tant qu'elle n'est pas
 * complète ; complète, elle se replie D'ELLE-MÊME. `ouverteManuelle` prime
 * SEULEMENT tant que la rubrique reste incomplète : revenir complet oblige
 * le repli, sans exception — « une rubrique complète se replie d'elle-même »
 * ne connaît aucune réouverture automatique.
 */
function Rubrique({
  section,
  points,
  valeurs,
  onChange,
  photo,
  ouverteManuelle,
  onBasculer,
}: {
  readonly section: string;
  readonly points: readonly PointChecklistEcran[];
  readonly valeurs: Readonly<Record<string, unknown>>;
  readonly onChange: (point: PointChecklistEcran, valeur: unknown) => void;
  readonly photo: {
    readonly interventionId: string;
    readonly utilisateurId: string;
    readonly societeId: string;
    readonly sansSession: boolean;
  };
  readonly ouverteManuelle: boolean | undefined;
  readonly onBasculer: (section: string, ouvrir: boolean) => void;
}) {
  const completude = completudeDe(points, valeurs);
  const complete = completude.pointsRepondus === completude.totalPoints;
  const ouverte = complete
    ? ouverteManuelle === true
    : (ouverteManuelle ?? true);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={ouverte}
        onClick={() => onBasculer(section, !ouverte)}
        className="flex h-14 w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-app-terrain-encre-secondaire text-13 font-medium tracking-[0.6px] uppercase">
          {section}
        </span>
        <span className="flex items-center gap-2">
          {completude.obligatoiresManquants.length === 0 ? null : (
            <span className="text-app-marque text-13">
              {libelleObligatoireManquant(
                completude.obligatoiresManquants.length,
              )}
            </span>
          )}
          <span className="text-app-terrain-encre-secondaire text-13">
            {libelleCompteur(completude.pointsRepondus, completude.totalPoints)}
          </span>
          <span
            aria-hidden="true"
            className="text-app-terrain-encre-secondaire"
          >
            {ouverte
              ? t("checklist.terrain.symbole_rubrique_ouverte")
              : t("checklist.terrain.symbole_rubrique_fermee")}
          </span>
        </span>
      </button>
      {!ouverte ? null : (
        <div className="flex flex-col">
          {points.map((point) => (
            <PointLigne
              key={point.id}
              point={point}
              valeur={valeurs[point.id] ?? null}
              onChange={(valeur) => onChange(point, valeur)}
              photo={photo}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ChecklistTerrain({
  interventionId,
  utilisateurId,
  societeId,
  checklistModeleLibelle,
  points,
  sansSession = false,
}: {
  readonly interventionId: string;
  readonly utilisateurId: string;
  readonly societeId: string;
  readonly checklistModeleLibelle: string;
  readonly points: readonly PointChecklistEcran[];
  /** LA COQUILLE `/terrain-hors-reseau` (9K28-CHECKLIST-REPONSE-PHOTO) — voir
   * le docblock du même nom dans `photos-terrain.tsx` : un point `photo`
   * embarque sa propre `PhotosTerrain`, qui doit y recevoir le même repli. */
  readonly sansSession?: boolean;
}) {
  const [valeurs, setValeurs] = useState<Record<string, unknown>>(() =>
    valeursInitiales(points),
  );
  const [etatRubriques, setEtatRubriques] = useState<Record<string, boolean>>(
    {},
  );
  const [pointASauter, setPointASauter] = useState<string | null>(null);
  const differenceRef = useRef<Record<string, unknown>>({});

  // LE LIEN DU REFUS « TERMINER » DÉPLIE SA RUBRIQUE ET Y SAUTE (CK7) — voir
  // `EVENEMENT_CHECKLIST_SAUTER_AU_POINT` : `RapportTerrainAutomatique`, un
  // composant FRÈRE, ne peut pas ouvrir cet état directement.
  useEffect(() => {
    function ecouter(evenement: Event): void {
      const detail = (evenement as CustomEvent<DetailChecklistSauterAuPoint>)
        .detail;
      if (detail.interventionId !== interventionId) {
        return;
      }
      const point = points.find((p) => p.id === detail.checklistPointId);
      if (point !== undefined) {
        setEtatRubriques((precedent) => ({
          ...precedent,
          [point.section]: true,
        }));
      }
      setPointASauter(detail.checklistPointId);
    }
    window.addEventListener(EVENEMENT_CHECKLIST_SAUTER_AU_POINT, ecouter);
    return () => {
      window.removeEventListener(EVENEMENT_CHECKLIST_SAUTER_AU_POINT, ecouter);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `points` est stable par rendu de la fiche
  }, [interventionId]);

  useEffect(() => {
    if (pointASauter === null) {
      return;
    }
    document
      .getElementById(`checklist-point-${pointASauter}`)
      ?.scrollIntoView({ block: "center" });
    setPointASauter(null);
  }, [pointASauter]);

  // UNE SAISIE DÉJÀ EN FILE (REPRISE HORS RÉSEAU) PREND LE PAS, POINT PAR
  // POINT — jamais l'ensemble des valeurs serveur, qui effacerait une
  // réponse saisie hors réseau depuis la dernière ouverture de cette fiche.
  useEffect(() => {
    let annule = false;
    void listerFilePourIntervention(interventionId, {
      utilisateurId,
      societeId,
    }).then((entrees) => {
      if (annule) {
        return;
      }
      const enAttente = entrees.find(
        (e): e is EntreeFile & { readonly geste: GesteChecklist } =>
          e.geste.type === "checklist",
      );
      if (enAttente === undefined) {
        return;
      }
      differenceRef.current = { ...enAttente.geste.difference };
      setValeurs((precedent) => ({
        ...precedent,
        ...enAttente.geste.difference,
      }));
    });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois au montage, par intervention
  }, [interventionId]);

  function enregistrer(point: PointChecklistEcran, valeur: unknown): void {
    setValeurs((precedent) => ({ ...precedent, [point.id]: valeur }));
    differenceRef.current = { ...differenceRef.current, [point.id]: valeur };
    void ajouterSaisie({
      interventionId,
      utilisateurId,
      societeId,
      geste: { type: "checklist", difference: differenceRef.current },
    });
    if (
      point.typeReponse === "conforme_non_conforme_sans_objet" &&
      valeur === "non_conforme"
    ) {
      signalerChecklistNonConforme({
        interventionId,
        ligne: ligneNonConforme(point.section, point.libelle),
      });
    }
  }

  const groupes = parSection(points);
  const completudeGlobale = completudeDe(points, valeurs);

  return (
    <section className="bg-app-surface flex flex-col gap-4 rounded-lg px-4 py-3.5">
      <h2 className="text-app-terrain-encre-secondaire text-13 font-medium tracking-[0.6px] uppercase">
        {t("checklist.terrain.provenance_prefixe")}
        {t("ponctuation.deux_points")}
        {checklistModeleLibelle}
      </h2>
      <Avancement
        repondus={completudeGlobale.pointsRepondus}
        total={completudeGlobale.totalPoints}
        utilisateurId={utilisateurId}
        societeId={societeId}
      />
      <Legende />
      <div className="flex flex-col">
        {[...groupes.entries()].map(([section, pointsSection]) => (
          <Rubrique
            key={section}
            section={section}
            points={pointsSection}
            valeurs={valeurs}
            onChange={enregistrer}
            photo={{ interventionId, utilisateurId, societeId, sansSession }}
            ouverteManuelle={etatRubriques[section]}
            onBasculer={(section, ouvrir) =>
              setEtatRubriques((precedent) => ({
                ...precedent,
                [section]: ouvrir,
              }))
            }
          />
        ))}
      </div>
    </section>
  );
}
