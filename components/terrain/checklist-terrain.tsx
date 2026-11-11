"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { CaseACocher } from "@/components/ui/case-a-cocher";
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
  EVENEMENT_CHECKLIST_SAUTER_AU_POINT,
  listerFilePourIntervention,
  signalerChecklistNonConforme,
  type DetailChecklistSauterAuPoint,
  type EntreeFile,
  type GesteChecklist,
} from "@/lib/terrain/file-saisies";

/**
 * LA TUILE DE SAISIE CHECKLIST, SUR LA FICHE TERRAIN (9K21-CHECKLIST-
 * TERRAIN-SAISIE, CK5) — repliée par défaut, un résumé en tête (« 12/15
 * points, 1 non conforme »). N'est rendue QUE si un gabarit s'est résolu
 * (`checklist.disponible === true` côté page) : rien ne change pour les
 * interventions sans checklist.
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

function sansLaCle(
  objet: Readonly<Record<string, unknown>>,
  cle: string,
): Record<string, unknown> {
  const copie = { ...objet };
  delete copie[cle];
  return copie;
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

function resume(
  points: readonly PointChecklistEcran[],
  valeurs: Readonly<Record<string, unknown>>,
): string {
  const pointsPourCompletude: PointPourCompletude[] = points.map((point) => ({
    id: point.id,
    section: point.section,
    libelle: point.libelle,
    obligatoire: point.obligatoire,
  }));
  const reponsesPourCompletude: ReponsePourCompletude[] = points
    .filter((point) => Object.hasOwn(valeurs, point.id))
    .map((point) => ({
      checklistPointId: point.id,
      nonConforme: valeurs[point.id] === "non_conforme",
    }));
  const completude = etatDeCompletude(
    pointsPourCompletude,
    reponsesPourCompletude,
  );
  const base = `${completude.pointsRepondus}/${completude.totalPoints} ${t(
    "checklist.terrain.points",
  )}`;
  return completude.nonConformes === 0
    ? base
    : `${base}${t("ponctuation.virgule")}${completude.nonConformes} ${t(
        "checklist.terrain.non_conforme",
      )}`;
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
      // TROIS BOUTONS ÉCRITS À PART, JAMAIS UN TABLEAU `.map()` (revue) — le
      // gardien L0-11 (`sans-chaine-visible-en-dur.test.ts`) ne distingue pas,
      // dans un tableau de paires destructuré en JSX, la VALEUR interne
      // (`"conforme"`, jamais affichée) du LIBELLÉ traduit (`libelleOption`,
      // affiché) : il rougit sur les deux à la fois. Trois éléments, chacun
      // sa propre valeur ET son propre `t(...)`, n'a jamais ce problème.
      return (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={valeur === "conforme" ? "default" : "outline"}
            size="lg"
            className="flex-1 text-16"
            onClick={() => onChange("conforme")}
          >
            {t("checklist.terrain.option_conforme")}
          </Button>
          <Button
            type="button"
            variant={valeur === "non_conforme" ? "default" : "outline"}
            size="lg"
            className="flex-1 text-16"
            onClick={() => onChange("non_conforme")}
          >
            {t("checklist.terrain.non_conforme")}
          </Button>
          <Button
            type="button"
            variant={valeur === "sans_objet" ? "default" : "outline"}
            size="lg"
            className="flex-1 text-16"
            onClick={() => onChange("sans_objet")}
          >
            {t("checklist.terrain.option_sans_objet")}
          </Button>
        </div>
      );
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
            className="border-app-bord bg-app-surface w-28 rounded-md border px-2 py-1.5 text-16 font-bold"
          />
          {point.unite === null ? null : (
            <span className="text-16 font-bold">{point.unite}</span>
          )}
        </label>
      );
    case "case_faite":
      return (
        <CaseACocher
          name={`checklist_${point.id}`}
          libelle={t("checklist.parametrage.type_reponse.case_faite")}
          checked={valeur === true}
          onChange={() => onChange(valeur === true ? null : true)}
        />
      );
    case "choix_dans_une_liste":
      return (
        <select
          aria-label={point.libelle}
          value={typeof valeur === "string" ? valeur : ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : e.target.value)
          }
          className="border-app-bord bg-app-surface rounded-md border px-2 py-1.5 text-16 font-bold"
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
          className="border-app-bord bg-app-surface rounded-md border px-2 py-1.5 text-16 font-bold"
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
        <div className="flex flex-col gap-2">
          {typeof valeur !== "number" ? null : (
            <p className="text-app-vert-encre text-16 font-bold">
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

function PointChecklistChamp({
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
  return (
    <div
      id={`checklist-point-${point.id}`}
      className="border-app-bord flex flex-col gap-2 rounded-md border p-2"
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-16 font-bold">{point.libelle}</span>
        {!point.obligatoire ? null : (
          <span className="text-app-encre-faible text-12 font-bold uppercase">
            {t("checklist.parametrage.point_obligatoire")}
          </span>
        )}
      </div>
      {point.consigne === null ? null : (
        <p className="text-app-encre-faible text-16 font-bold">
          {point.consigne}
        </p>
      )}
      {champDuType(point, valeur, onChange, photo)}
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
  const [ouvert, setOuvert] = useState(false);
  const [pointASauter, setPointASauter] = useState<string | null>(null);
  const differenceRef = useRef<Record<string, unknown>>({});

  // LE LIEN DU REFUS « TERMINER » DÉPLIE LA TUILE ET Y SAUTE (CK7) — voir
  // `EVENEMENT_CHECKLIST_SAUTER_AU_POINT` : `RapportTerrainAutomatique`, un
  // composant FRÈRE, ne peut pas ouvrir cet état directement.
  useEffect(() => {
    function ecouter(evenement: Event): void {
      const detail = (evenement as CustomEvent<DetailChecklistSauterAuPoint>)
        .detail;
      if (detail.interventionId !== interventionId) {
        return;
      }
      setOuvert(true);
      setPointASauter(detail.checklistPointId);
    }
    window.addEventListener(EVENEMENT_CHECKLIST_SAUTER_AU_POINT, ecouter);
    return () => {
      window.removeEventListener(EVENEMENT_CHECKLIST_SAUTER_AU_POINT, ecouter);
    };
  }, [interventionId]);

  useEffect(() => {
    if (pointASauter === null || !ouvert) {
      return;
    }
    document
      .getElementById(`checklist-point-${pointASauter}`)
      ?.scrollIntoView({ block: "center" });
    setPointASauter(null);
  }, [pointASauter, ouvert]);

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
    setValeurs((precedent) =>
      valeur === null
        ? sansLaCle(precedent, point.id)
        : { ...precedent, [point.id]: valeur },
    );
    differenceRef.current =
      valeur === null
        ? sansLaCle(differenceRef.current, point.id)
        : { ...differenceRef.current, [point.id]: valeur };
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

  return (
    <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
      <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
        {t("checklist.terrain.provenance_prefixe")}
        {t("ponctuation.deux_points")}
        {checklistModeleLibelle}
      </h2>
      <p role="status" className="text-16 font-bold">
        {resume(points, valeurs)}
      </p>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full text-16"
        aria-expanded={ouvert}
        onClick={() => setOuvert((precedent) => !precedent)}
      >
        {ouvert
          ? t("checklist.terrain.masquer_detail")
          : t("checklist.terrain.afficher_detail")}
      </Button>
      {!ouvert ? null : (
        <div className="flex flex-col gap-4">
          {[...groupes.entries()].map(([section, pointsSection]) => (
            <div key={section} className="flex flex-col gap-3">
              <h3 className="text-16 font-extrabold">{section}</h3>
              {pointsSection.map((point) => (
                <PointChecklistChamp
                  key={point.id}
                  point={point}
                  valeur={valeurs[point.id] ?? null}
                  onChange={(valeur) => enregistrer(point, valeur)}
                  photo={{
                    interventionId,
                    utilisateurId,
                    societeId,
                    sansSession,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
