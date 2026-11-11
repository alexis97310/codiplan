import type { Metadata } from "next";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { ActionsBonIntervention } from "@/components/interventions/actions-bon";
import {
  Ligne,
  TuileChecklist,
  TuileClient,
  TuileCommentaires,
  TuileConditionsFacturation,
  TuileMateriel,
  TuilePieces,
  TuilePrestations,
  TuileSuite,
} from "@/components/interventions/bon-tuiles";
import { Page } from "@/components/mise-en-page/page";
import { Carte } from "@/components/ui/carte";
import { estRolePortail } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { dateCivile, jourDe, versLocal } from "@/lib/calendar/fuseau";
import { enDuree } from "@/lib/calendar/duree";
import { estUuid } from "@/lib/identifiant";
import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import { profilDuBon, type TuileBon } from "@/lib/interventions/profil-bon";
import {
  aSectionPiecesRemplacees,
  type TypeIntervention,
} from "@/lib/interventions/saisie";
import { ENTREES_PORTAIL } from "@/lib/navigation/entrees";
import { rattachementsDuCompte } from "@/lib/portail/depot";
import { CLASSES_STATUT } from "@/lib/theme/statuts";

import { bonInterventionDuParc } from "../../depot";
import { identifiantDeLIntervention } from "../../presentation";
import {
  dateHeureLocaleDuBonPortail,
  dateLocaleDuBonPortail,
  ligneSignatureAbsenteOuRefuseeDuBonPortail,
  ligneSignatureDuBonPortail,
  segmentsSurSiteTitreDuBonPortail,
  tempsTotalSurSiteLibelleDuBonPortail,
} from "./presentation";

/**
 * LE BON D'INTERVENTION TÉLÉCHARGEABLE DU PORTAIL (9J08A-REPRISE-9J08,
 * CLI-2.6) — LECTURE DÉDIÉE, FORME « PARC » SEULE, VERSION CLIENT FORCÉE.
 *
 * ## Pourquoi cette page n'est pas le bon back-office rejoué
 *
 * `lireBonIntervention` (back-office) filtre par `restrictionParPersonne`, une
 * fonction du périmètre PAR PERSONNE qui lève une erreur pour tout rôle
 * étranger à `consulter_planning` — dont le rôle portail. Cette page appelle
 * `bonInterventionDuParc` (`../../depot.ts`), qui compose le MÊME bon
 * (`composerBon`, `lib/interventions/bon.ts`, partagée, jamais recopiée) sous
 * la seule politique RLS « parc » (D84), exactement comme le reste du
 * portail.
 *
 * ## Jamais de montant, jamais de version interne
 *
 * Cette page n'importe aucun des mécanismes qui composent la section de
 * valorisation du bon back-office — elle n'a ici aucun équivalent — et
 * aucun paramètre de requête n'est jamais lu ni relayé (3.8, D37, 9I8B,
 * point 3 du ticket 9J08). Un gardien statique
 * (`tests/unit/portail/bon-sans-montant.test.ts`) le tient.
 *
 * ## La clôture, condition propre au portail
 *
 * `bonInterventionDuParc` refuse, nommément, un bon dont `cloturee_le` est
 * encore `null` — voir son en-tête. Le back-office n'est pas concerné.
 *
 * ## Le nom du technicien et les segments (9J22-PORTAIL-BON-TECHNICIEN-TEMPS)
 *
 * Décision d'Alexis du 06/11/2026 (« Oui, les deux ») : le client voit, pour
 * SES PROPRES interventions seulement, le nom du technicien et les temps
 * passés. `lireBonDuParc` les rend désormais normalement sous ce contexte —
 * la migration `20261107050000_portail_bon_technicien_temps_9j22` a ajouté
 * une politique de filiation, scopée au client, sur `segment_travail` ET sur
 * `utilisateur` (voir le docblock de `lireBonDuParc`,
 * `lib/interventions/bon.ts`) ; AUCUN montant ni taux ne les accompagne
 * (3.8, D37, 9I8B, et le reste de cette page) — un segment n'en porte
 * d'ailleurs aucun.
 */

const sessionCache = cache(async () => obtenirSession(await headers()));

async function contexteEtBon(id: string) {
  const session = await sessionCache();
  if (
    session === null ||
    session.contexte.societeId === null ||
    session.contexte.role === null ||
    !estRolePortail(session.contexte.role)
  ) {
    return null;
  }
  const rattachements = await rattachementsDuCompte(
    session.contexte.utilisateurId,
  );
  const premier = rattachements.find(
    (r) => r.societeId === session.contexte.societeId,
  );
  if (premier === undefined) {
    return null;
  }
  const contexte = { ...session.contexte, clientId: premier.clientId };
  return bonInterventionDuParc(contexte, id);
}
const contexteEtBonCache = cache(contexteEtBon);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!estUuid(id)) {
    return { title: t("intervention.bon.titre") };
  }
  const resultat = await contexteEtBonCache(id);
  if (resultat === null || resultat.etat !== "disponible") {
    return { title: t("intervention.bon.titre") };
  }
  const perfil = profilDuBon(resultat.bon.ligne.type as TypeIntervention);
  return {
    title: `${perfil.titreDocument} ${identifiantDeLIntervention(resultat.bon.ligne.numero, resultat.bon.ligne.annee)}`,
  };
}

export default async function PageBonInterventionPortail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await sessionCache();
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null || session.contexte.role === null) {
    redirect("/arrivee");
  }
  if (!estRolePortail(session.contexte.role)) {
    return (
      <Page
        chemin="/portail/interventions"
        entrees={ENTREES_PORTAIL}
        titre={t("intervention.bon.titre")}
        sousTitre={t("portail.reserve")}
      />
    );
  }

  const { id } = await params;
  // UN IDENTIFIANT MAL FORMÉ EST UN REFUS, JAMAIS UNE PANNE — même garde que
  // `/portail/interventions/[id]`.
  if (!estUuid(id)) {
    notFound();
  }

  const resultat = await contexteEtBonCache(id);
  if (resultat === null) {
    redirect("/arrivee");
  }
  if (resultat.etat === "introuvable") {
    // Hors périmètre et inexistante rendent LA MÊME chose (D35, D50).
    notFound();
  }
  if (resultat.etat === "non_cloturee") {
    return (
      <Page
        chemin="/portail/interventions"
        entrees={ENTREES_PORTAIL}
        filAriane={[
          {
            libelle: t("portail.interventions.titre"),
            href: "/portail/interventions",
          },
          { libelle: t("intervention.bon.titre") },
        ]}
        titre={t("intervention.bon.titre")}
        sousTitre={t("portail.interventions.bon.refus_non_cloturee")}
      />
    );
  }

  const { bon } = resultat;
  const typeLigne = bon.ligne.type as TypeIntervention;
  const perfil = profilDuBon(typeLigne);
  // `cloturee_le` est garanti non nul par `bonInterventionDuParc` ci-dessus.
  const dateDocumentAffichee = dateLocaleDuBonPortail(
    bon.clotureeLe as Date,
    bon.fuseau,
  );
  const jourReferenceGarantie = jourDe(
    versLocal(bon.clotureeLe as Date, bon.fuseau),
  );
  const reference = identifiantDeLIntervention(
    bon.ligne.numero,
    bon.ligne.annee,
  );

  const TUILES: Record<TuileBon, React.ReactNode> = {
    client: <TuileClient bon={bon} />,
    materiel: (
      <TuileMateriel bon={bon} jourReferenceGarantie={jourReferenceGarantie} />
    ),
    intervention: (
      <Carte key="intervention" titre={t("intervention.titre")}>
        <dl className="grid grid-cols-1 gap-x-3 gap-y-2.5 px-4 py-3.5 text-[13px] font-bold sm:grid-cols-[132px_1fr]">
          <Ligne
            libelle={t("intervention.date")}
            valeur={
              bon.ligne.date_planifiee === null
                ? t("statut.a_planifier")
                : dateCivile(bon.ligne.date_planifiee)
            }
          />
          <Ligne
            libelle={t("intervention.type")}
            valeur={t(`type_intervention.${typeLigne}`)}
          />
          {bon.technicienAffecte === null ? null : (
            <Ligne
              libelle={t("intervention.technicien")}
              valeur={bon.technicienAffecte}
            />
          )}
          <Ligne libelle={mot("agence")} valeur={bon.agence ?? "—"} />
          <Ligne
            libelle={t("intervention.panne_signalee")}
            valeur={bon.ligne.description ?? "—"}
          />
          <Ligne
            libelle={t("intervention.reference_client")}
            valeur={bon.ligne.reference_client ?? "—"}
          />
        </dl>
        <div
          className={`flex flex-col gap-2 px-4 pb-3.5 ${bon.segments.length === 0 ? "print:hidden" : ""}`}
        >
          <h3 className="text-app-encre-faible text-[12px] font-bold">
            {segmentsSurSiteTitreDuBonPortail()}
          </h3>
          {bon.segments.length === 0 ? (
            <p className="text-app-encre-faible text-[12px] font-bold">
              {t("intervention.bon.aucun_segment")}
            </p>
          ) : (
            <>
              <table className="w-full border-collapse text-13 font-bold">
                <thead>
                  <tr className="border-app-bord border-b text-left">
                    <th className="py-1 pr-2 font-semibold">
                      {t("intervention.bon.segment_technicien")}
                    </th>
                    <th className="py-1 pr-2 font-semibold">
                      {t("intervention.bon.segment_arrivee")}
                    </th>
                    <th className="py-1 pr-2 font-semibold">
                      {t("intervention.bon.segment_depart")}
                    </th>
                    <th className="py-1 font-semibold">
                      {t("intervention.bon.segment_duree")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bon.segments.map((segment) => (
                    <tr
                      key={`${segment.technicien}-${segment.debut.toISOString()}`}
                      className="border-app-bord-faible border-b"
                    >
                      <td className="py-1 pr-2">{segment.technicien}</td>
                      <td className="py-1 pr-2">
                        {dateHeureLocaleDuBonPortail(segment.debut, bon.fuseau)}
                      </td>
                      <td className="py-1 pr-2">
                        {segment.fin === null
                          ? t("intervention.bon.segment_en_cours")
                          : dateHeureLocaleDuBonPortail(
                              segment.fin,
                              bon.fuseau,
                            )}
                      </td>
                      <td className="py-1">
                        {segment.minutes === null
                          ? t("intervention.bon.segment_en_cours")
                          : enDuree(segment.minutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl className="grid grid-cols-[132px_minmax(0,1fr)] gap-x-3 gap-y-2.5">
                <Ligne
                  libelle={tempsTotalSurSiteLibelleDuBonPortail()}
                  valeur={enDuree(bon.minutesTotal)}
                />
              </dl>
            </>
          )}
        </div>
      </Carte>
    ),
    commentaires: <TuileCommentaires bon={bon} />,
    pieces: <TuilePieces bon={bon} />,
    prestations: <TuilePrestations bon={bon} />,
    checklist: <TuileChecklist bon={bon} />,
    suite: <TuileSuite bon={bon} />,
    signataire: (
      <Carte
        key="signataire"
        titre={t("intervention.bon.signature_titre")}
        className={bon.signature === null ? "print:hidden" : undefined}
      >
        <div className="px-4 py-3.5">
          {bon.signature === null ? (
            <p className="text-app-encre-faible text-[12px] font-bold">
              {t("intervention.bon.aucune_signature")}
            </p>
          ) : bon.signature.issue === "signee" ? (
            <div className="flex flex-col gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- tracé encodé en mémoire, jamais un fichier statique */}
              <img
                src={bon.signature.image_base64 ?? undefined}
                alt={t("intervention.bon.signature_titre")}
                className="border-app-bord h-[80px] w-[180px] rounded border object-contain"
              />
              <p className="text-app-encre-faible text-12 font-bold">
                {ligneSignatureDuBonPortail(
                  bon.signature.signataire_nom,
                  bon.signature.signataire_qualite,
                  dateLocaleDuBonPortail(bon.signature.cree_le, bon.fuseau),
                )}
              </p>
            </div>
          ) : (
            <p className="text-app-encre-faible text-[12px] font-bold">
              {ligneSignatureAbsenteOuRefuseeDuBonPortail(
                bon.signature.issue,
                bon.signature.motif,
              )}
            </p>
          )}
        </div>
      </Carte>
    ),
  };

  const conditionsTuile = <TuileConditionsFacturation bon={bon} />;

  return (
    <Page
      chemin="/portail/interventions"
      entrees={ENTREES_PORTAIL}
      filAriane={[
        {
          libelle: t("portail.interventions.titre"),
          href: "/portail/interventions",
        },
        { libelle: `${t("intervention.bon.titre")} ${reference}` },
      ]}
      titre={t("intervention.bon.titre")}
      sousTitre={reference}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-end gap-3 print:hidden">
          <ActionsBonIntervention />
        </div>

        <div className="zone-impression-bon flex flex-col gap-4">
          <Carte className="flex flex-col gap-3 p-6 text-[13px] font-bold">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                {bon.societe.logoEmpreinte === null ? null : (
                  // eslint-disable-next-line @next/next/no-img-element -- octets servis par une route applicative, pas un fichier statique optimisable
                  <img
                    src={`/api/societe/logo?v=${bon.societe.logoEmpreinte}`}
                    alt={t("societe.logo_alt")}
                    className="max-h-12 w-auto max-w-24 object-contain print:max-h-[15mm] print:w-auto"
                  />
                )}
                <div>
                  <h1 className="text-[18px] font-extrabold">
                    {bon.societe.raisonSociale}
                  </h1>
                  <p className="text-app-encre-faible text-[12px] font-bold">
                    {perfil.titreDocument} {reference}
                  </p>
                  <p className="text-app-encre-faible text-[12px] font-bold">
                    {t("intervention.bon.date_bon")}
                    {t("ponctuation.deux_points")}
                    {dateDocumentAffichee}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-12 font-bold ${CLASSES_STATUT[bon.ligne.statut]}`}
              >
                {t(`statut.${bon.ligne.statut}`)}
              </span>
            </div>
          </Carte>

          {perfil.ordreTuiles.flatMap((tuile) => {
            if (
              tuile === "pieces" &&
              (!aSectionPiecesRemplacees(typeLigne) ||
                bon.piecesRemplacees.length === 0)
            ) {
              return [];
            }
            const noeuds = TUILES[tuile];
            if (tuile === "signataire") {
              return [conditionsTuile, noeuds];
            }
            return [noeuds];
          })}

          {bon.societe.mentionsLegales === null ? null : (
            <p className="text-app-encre-faible border-app-bord border-t pt-3 text-12 font-bold whitespace-pre-wrap">
              {bon.societe.mentionsLegales}
            </p>
          )}
        </div>
      </div>
    </Page>
  );
}
