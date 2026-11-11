import { Fragment } from "react";

import { Carte } from "@/components/ui/carte";
import { type JourLocal } from "@/lib/calendar/fuseau";
import { type RenduReponseChecklistBon } from "@/lib/checklists/depot";
import { t } from "@/lib/i18n/fr";
import { mot, motDansUnePhrase } from "@/lib/i18n/vocabulaire";
import {
  libellePieceRemplacee,
  type BonIntervention,
} from "@/lib/interventions/bon";
import { lignesDetailMachine } from "@/lib/machines/presentation";

/**
 * LES TUILES PARTAGÉES DU BON D'INTERVENTION (9K24-CHECKLIST-BONS, CK8) —
 * extraites du bureau (`app/(back-office)/interventions/[id]/bon/page.tsx`)
 * et du portail (`app/(portail)/portail/interventions/[id]/bon/page.tsx`),
 * qui les rendaient CHACUN, à l'identique (§9, 01/09 — une seconde écriture
 * qui n'a jamais eu à diverger).
 *
 * ## Ce qui N'EST PAS ici — et pourquoi
 *
 * `intervention` (la date affichée diverge : le bureau lit l'heure du
 * créneau, le portail non) et `signataire` (le bureau affiche l'heure de la
 * signature, le portail seulement sa date) rendent chacun un texte
 * DIFFÉRENT aujourd'hui — les extraire aurait changé un rendu que ce ticket
 * ne doit pas toucher. Elles restent dans chaque page, inchangées.
 */

export function Ligne({
  libelle,
  valeur,
}: {
  readonly libelle: string;
  readonly valeur: string;
}) {
  return (
    <>
      <dt className="text-app-encre-faible text-[12px] font-bold">{libelle}</dt>
      <dd className="font-semibold break-words hyphens-auto">{valeur}</dd>
    </>
  );
}

export function TuileClient({ bon }: { readonly bon: BonIntervention }) {
  return (
    <Carte key="client" titre={t("intervention.client")}>
      <dl className="grid grid-cols-1 gap-x-3 gap-y-2.5 px-4 py-3.5 text-[13px] font-bold sm:grid-cols-[132px_1fr]">
        <Ligne libelle={t("intervention.client")} valeur={bon.client ?? "—"} />
        <Ligne libelle={mot("site")} valeur={bon.site ?? "—"} />
        <Ligne libelle={t("site.adresse")} valeur={bon.adresseSite ?? "—"} />
        <Ligne
          libelle={t("intervention.contact_sur_place")}
          valeur={bon.contact ?? "—"}
        />
      </dl>
    </Carte>
  );
}

export function TuileMateriel({
  bon,
  jourReferenceGarantie,
}: {
  readonly bon: BonIntervention;
  readonly jourReferenceGarantie: JourLocal;
}) {
  const aucuneMachine = bon.machinesIdentifiees.length === 0;
  return (
    <Carte key="materiel" titre={t("intervention.machine")}>
      <dl className="grid grid-cols-1 gap-x-3 gap-y-2.5 px-4 py-3.5 text-[13px] font-bold sm:grid-cols-[132px_1fr]">
        {aucuneMachine ? (
          <Ligne
            libelle={t("intervention.machine")}
            valeur={`${t("intervention.bon.aucune_machine")} ${motDansUnePhrase("site")}.`}
          />
        ) : (
          bon.machinesDetaillees.map((machine, index) => (
            <Fragment key={`${machine.libelle}-${index}`}>
              <Ligne
                libelle={t("intervention.machine")}
                valeur={machine.libelle}
              />
              {lignesDetailMachine(machine.dates, jourReferenceGarantie).map(
                (detail) => (
                  <Ligne
                    key={detail.libelle}
                    libelle={detail.libelle}
                    valeur={detail.valeur}
                  />
                ),
              )}
            </Fragment>
          ))
        )}
      </dl>
    </Carte>
  );
}

export function TuileCommentaires({ bon }: { readonly bon: BonIntervention }) {
  return (
    <Carte
      key="commentaires"
      titre={t("intervention.commentaires_photos.titre")}
      className={
        bon.commentaireTechnicien === null && bon.photos.length === 0
          ? "print:hidden"
          : undefined
      }
    >
      <div className="flex flex-col gap-3 px-4 py-3.5">
        <div
          className={bon.commentaireTechnicien === null ? "print:hidden" : ""}
        >
          <h3 className="text-app-encre-faible text-[12px] font-bold">
            {t("intervention.bon.commentaire_titre")}
          </h3>
          <p className="text-13 font-bold whitespace-pre-wrap">
            {bon.commentaireTechnicien ?? (
              <span className="text-app-encre-faible">
                {t("intervention.bon.aucun_commentaire")}
              </span>
            )}
          </p>
        </div>
        <div className={bon.photos.length === 0 ? "print:hidden" : ""}>
          <h3 className="text-app-encre-faible text-[12px] font-bold">
            {t("intervention.bon.photos_titre")}
          </h3>
          {bon.photos.length === 0 ? (
            <p className="text-app-encre-faible text-[12px] font-bold">
              {t("intervention.bon.aucune_photo")}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {bon.photos.map((photo) => (
                <figure key={photo.id} className="flex flex-col gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element -- octets servis par une route applicative, pas un fichier statique optimisable */}
                  <img
                    src={`/api/documents/${photo.id}/octets`}
                    alt={photo.libelle}
                    className="border-app-bord aspect-square rounded border object-cover"
                  />
                  <figcaption className="text-app-encre-faible text-12 font-bold">
                    {photo.libelle}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </div>
    </Carte>
  );
}

export function TuilePieces({ bon }: { readonly bon: BonIntervention }) {
  return (
    <Carte key="pieces" titre={t("intervention.bon.pieces_titre")}>
      <div className="px-4 py-3.5">
        <ul className="list-disc pl-4 text-13 font-bold">
          {bon.piecesRemplacees.map((piece, index) => (
            <li key={index}>{libellePieceRemplacee(piece)}</li>
          ))}
        </ul>
      </div>
    </Carte>
  );
}

export function TuilePrestations({ bon }: { readonly bon: BonIntervention }) {
  return (
    <Carte
      key="prestations"
      titre={t("intervention.bon.prestations_titre")}
      className={
        bon.prestationsRealisees.length === 0 ? "print:hidden" : undefined
      }
    >
      <div className="px-4 py-3.5">
        {bon.prestationsRealisees.length === 0 ? (
          <p className="text-app-encre-faible text-[12px] font-bold">
            {t("intervention.bon.aucune_prestation")}
          </p>
        ) : (
          <ul className="list-disc pl-4 text-13 font-bold">
            {bon.prestationsRealisees.map((prestation) => (
              <li key={prestation.id}>{prestation.libelle}</li>
            ))}
          </ul>
        )}
      </div>
    </Carte>
  );
}

export function TuileSuite({ bon }: { readonly bon: BonIntervention }) {
  return (
    <Carte
      key="suite"
      titre={t("intervention.bon.suite_titre")}
      className={bon.suiteADonner === null ? "print:hidden" : undefined}
    >
      <div className="px-4 py-3.5">
        <p className="text-13 font-bold whitespace-pre-wrap">
          {bon.suiteADonner ?? (
            <span className="text-app-encre-faible">
              {t("intervention.bon.aucune_suite")}
            </span>
          )}
        </p>
      </div>
    </Carte>
  );
}

export function TuileConditionsFacturation({
  bon,
}: {
  readonly bon: BonIntervention;
}) {
  if (bon.conditionsFacturation.length === 0) {
    return null;
  }
  return (
    <Carte
      key="conditions-facturation"
      titre={t("tarification.conditions.titre")}
    >
      <div className="flex flex-col gap-1.5 px-4 py-3.5 text-[13px] font-bold">
        {bon.conditionsFacturation.map((ligne) => (
          <p key={ligne}>{ligne}</p>
        ))}
      </div>
    </Carte>
  );
}

/**
 * « 13 conformes, 2 non conformes, 1 sans objet » (CK8, point 3 du ticket) —
 * UNIQUEMENT les réponses « conforme/non conforme/sans objet » ; les
 * mesures, cases et textes n'entrent dans aucun des trois comptes.
 */
function resumeChecklistBon(resume: {
  readonly conformes: number;
  readonly nonConformes: number;
  readonly sansObjet: number;
}): string {
  const virgule = t("ponctuation.virgule");
  return (
    `${resume.conformes} ${t("checklist.bon.resume_conformes")}${virgule}` +
    `${resume.nonConformes} ${t("checklist.bon.resume_non_conformes")}${virgule}` +
    `${resume.sansObjet} ${t("checklist.bon.resume_sans_objet")}`
  );
}

/**
 * Le texte d'une réponse — déduit de `rendu.nature` SEUL, jamais d'un type
 * relu sur `checklist_point` (voir `checklistDuBon`, `lib/checklists/depot.ts`).
 */
function libelleRenduChecklist(rendu: RenduReponseChecklistBon): string {
  switch (rendu.nature) {
    case "conforme":
      return rendu.valeur === "conforme"
        ? t("checklist.terrain.option_conforme")
        : rendu.valeur === "non_conforme"
          ? t("checklist.terrain.non_conforme")
          : t("checklist.terrain.option_sans_objet");
    case "mesure":
      return rendu.unite === null
        ? String(rendu.valeur)
        : `${rendu.valeur} ${rendu.unite}`;
    case "case":
      return t("checklist.parametrage.type_reponse.case_faite");
    case "choix":
      return rendu.valeur;
    case "texte":
      return rendu.valeur;
  }
}

/**
 * LA TUILE CHECKLIST (9K24-CHECKLIST-BONS, CK8) — `null` : AUCUNE tuile, pas
 * de tuile vide (voir `BonIntervention.checklist`). Impression : chaque
 * SECTION évite de se couper (`break-inside: avoid`, `app/globals.css`,
 * sélecteur `[data-bloc="bon-checklist"] .checklist-section`), JAMAIS toute
 * la tuile — une checklist longue doit pouvoir continuer sur la page
 * suivante, contrairement aux autres tuiles du bon.
 */
export function TuileChecklist({ bon }: { readonly bon: BonIntervention }) {
  if (bon.checklist === null) {
    return null;
  }
  const { checklist } = bon;
  return (
    <Carte
      key="checklist"
      bloc="bon-checklist"
      titre={t("checklist.bon.titre")}
    >
      <div className="flex flex-col gap-3 px-4 py-3.5">
        {checklist.resume === null ? null : (
          <p className="text-13 font-bold">
            {resumeChecklistBon(checklist.resume)}
          </p>
        )}
        {checklist.sections.map((section) => (
          <div
            key={section.section}
            className="checklist-section flex flex-col gap-1.5"
          >
            <h3 className="text-app-encre-faible text-[12px] font-bold">
              {section.section}
            </h3>
            <ul className="flex flex-col gap-1">
              {section.points.map((point) => (
                <li key={point.id} className="text-13 font-bold">
                  <span>{point.libelle}</span>
                  {t("ponctuation.deux_points")}
                  <span
                    className={
                      point.rendu.nature === "conforme" &&
                      point.rendu.valeur === "non_conforme"
                        ? "text-app-oxyde font-extrabold"
                        : undefined
                    }
                  >
                    {libelleRenduChecklist(point.rendu)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Carte>
  );
}
