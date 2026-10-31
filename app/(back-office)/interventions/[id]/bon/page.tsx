import type { Metadata } from "next";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { ActionsBonIntervention } from "@/components/interventions/actions-bon";
import { Carte } from "@/components/ui/carte";
import { exigerCapacite } from "@/lib/auth/porte";
import { dateCivile } from "@/lib/calendar/fuseau";
import { enDuree } from "@/lib/calendar/duree";
import { estUuid } from "@/lib/identifiant";
import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  libellePieceRemplacee,
  lireBonIntervention,
} from "@/lib/interventions/bon";
import { peutGenererLeBon } from "@/lib/interventions/cycle-de-vie";
import { aSectionPiecesRemplacees } from "@/lib/interventions/depot-rapport-terrain";
import {
  accesAuxMontants,
  aDroitRoleAuxMontants,
} from "@/lib/interventions/montants-visibles";
import { profilDuBon, type TuileBon } from "@/lib/interventions/profil-bon";
import type {
  IssueSignature,
  StatutIntervention,
  TypeIntervention,
} from "@/lib/interventions/saisie";
import { versionDuBon } from "@/lib/interventions/version-bon";
import { formatMoney } from "@/lib/money";
import { lireAfficherMontants } from "@/lib/societes/identite";
import { CLASSES_STATUT } from "@/lib/theme/statuts";

import {
  aucuneMachineSurLeSite,
  dateHeureLocale,
  dateLocale,
  heureDuCreneau,
  objetDuBloc,
  referenceAffichee,
  segmentsSurSiteTitre,
  tempsTotalSurSiteLibelle,
} from "../../presentation";

/**
 * LE BON D'INTERVENTION IMPRIMABLE (lot 16 BON-1, complété par BON-2) — mis
 * en page pour un A4.
 *
 * ## LES CINQ BLOCS DE BON-2
 *
 * Prestations réalisées, commentaire, suite à donner, photos, signature :
 * chacun affiche son ABSENCE plutôt que de disparaître — *un bloc vide remis
 * à un client se lit comme un oubli, pas comme un « pas encore »* (§9,
 * doctrine constante de ce dépôt). Rien n'est recalculé ici : ce sont les
 * lectures de `lireBonIntervention`, saisies depuis le terrain
 * (`app/(mobile)/terrain/[id]`).
 *
 * ## La porte est celle du planning, jamais réécrite
 *
 * `consulter_planning` est la même capacité qui gouverne déjà l'accès au
 * planning et à la fiche — `○` pour le technicien, exactement le rôle qui
 * doit pouvoir imprimer ce bon sur le site du client. Le périmètre PAR
 * PERSONNE, lui, est tenu par `lireBonIntervention` (même lecture que
 * `lireFicheIntervention`) : cette page ne le recalcule pas.
 *
 * ## Version client, version interne — jamais les deux à la fois (D186)
 *
 * Le bon par défaut est la VERSION CLIENT (QT-8 (a), arbitrage 3.8) : la
 * section de valorisation ne s'affiche pas DU TOUT — ni montant, ni motif.
 * *Jamais sur le bon client : une version client sans montant, une version
 * interne* — un motif remis au client dirait encore « ce n'est pas pour
 * vous », une phrase qui n'a rien à faire sur son document. Seul
 * `?version=interne` rend la section, et seulement pour un rôle qui a le
 * droit DU RÔLE (`aDroitRoleAuxMontants`, `lib/interventions/
 * montants-visibles.ts`) : `versionDuBon` (`lib/interventions/version-bon.ts`)
 * tranche les deux à la fois, par égalité stricte. En version interne, le
 * bloc ne change pas de comportement : si le rôle n'a pas droit, si le taux
 * est introuvable, ou si la société a désactivé l'affichage
 * (9I8-AFFICHAGE-DES-MONTANTS, `accesAuxMontants`), le motif habituel
 * remplace le montant. **Le commutateur, lui, ignore le réglage de société** —
 * sinon « désactivé » ferait disparaître jusqu'au motif qui le dit.
 *
 * ## Un taux introuvable efface le total AVEC LUI
 *
 * Voir l'entête de `lib/interventions/bon.ts` : si `tauxEnVigueur` ne trouve
 * plus, aujourd'hui, de taux pour la date de cette intervention, ce bon ne
 * peut plus garantir qu'un montant se reproduit — la section entière se
 * remplace par cette seule absence, jamais par un montant qu'on ne peut plus
 * justifier.
 */

/**
 * MÉMOÏSÉES PAR REQUÊTE (VISUEL-1, 23/09/2026) — voir le même commentaire sur
 * `lireClientCache` dans `app/(back-office)/clients/[id]/page.tsx`. Ici c'est
 * `exigerCapacite` elle-même qui est mémoïsée : un seul argument stable
 * (`"consulter_planning"`), donc une seule lecture de session par rendu.
 */
const exigerCapaciteCache = cache(exigerCapacite);
const lireBonCache = cache(lireBonIntervention);

/** LE TITRE D'ONGLET PORTE LA RÉFÉRENCE DE L'INTERVENTION (VISUEL-1). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const contexte = await exigerCapaciteCache("consulter_planning");
  if (contexte === null) {
    return { title: t("intervention.bon.titre") };
  }
  const { id } = await params;
  // UN IDENTIFIANT MAL FORMÉ EST UN REFUS, JAMAIS UNE PANNE
  // (9EJ-CORRECTIFS-AUDIT-TUILES-ID, ADDENDUM 1 de 9DU-TP-NAV3-RECHERCHE-RAIL)
  // — même garde que `clients/[id]`, jamais une lecture tentée sur un
  // identifiant qui n'en est pas un.
  if (!estUuid(id)) {
    return { title: t("intervention.bon.titre") };
  }
  const bon = await lireBonCache(contexte, id);
  if (bon === null) {
    return { title: t("intervention.bon.titre") };
  }
  const perfil = profilDuBon(bon.ligne.type as TypeIntervention);
  return {
    title: `${perfil.titreDocument} ${referenceAffichee(bon.ligne)}`,
  };
}

export default async function PageBonIntervention({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const contexte = await exigerCapaciteCache("consulter_planning");
  if (contexte === null) {
    redirect(`/interventions/${id}?motif=intervention.bon.refus.acces`);
  }
  // UN IDENTIFIANT MAL FORMÉ EST UN REFUS, JAMAIS UNE PANNE (ADDENDUM 1 de
  // 9DU-TP-NAV3-RECHERCHE-RAIL) — même garde que `clients/[id]`.
  if (!estUuid(id)) {
    notFound();
  }

  const bon = await lireBonCache(contexte, id);
  if (bon === null) {
    // Hors périmètre et inexistante rendent LA MÊME chose (D35, D50) — même
    // traitement que la fiche.
    notFound();
  }

  const statut = bon.ligne.statut as StatutIntervention;
  // ── LE BON N'EXISTE QUE POUR UN TRAVAIL FAIT (AFFICHAGE-MATERIEL-1) ──────
  //
  // *Mesuré en production le 23/09/2026 : le lien était proposé et l'URL
  // rendait le bon sur une intervention encore `planifiee`.* Même mécanisme
  // que le refus d'accès ci-dessus — une redirection vers la fiche, avec le
  // motif en bannière — jamais un bon à moitié vide, jamais une erreur.
  const verdictBon = peutGenererLeBon(statut);
  if (verdictBon.refuse) {
    redirect(`/interventions/${id}?motif=${verdictBon.cle}`);
  }
  const perfil = profilDuBon(bon.ligne.type as TypeIntervention);
  const afficherMontants = await lireAfficherMontants(contexte);
  const montants = accesAuxMontants(contexte.role, afficherMontants);
  // LE COMMUTATEUR CLIENT/INTERNE SUIT LE DROIT DU RÔLE SEUL, JAMAIS LE
  // RÉGLAGE DE SOCIÉTÉ (9I8-AFFICHAGE-DES-MONTANTS) — voir l'en-tête
  // d'`aDroitRoleAuxMontants` : sinon, « désactivé par la société » ferait
  // disparaître le commutateur avec les montants, et le motif qui doit
  // justement s'afficher en version interne ne s'afficherait jamais.
  const droitRole = aDroitRoleAuxMontants(contexte.role);
  const parametres = await searchParams;
  const interne = versionDuBon(parametres.version, droitRole) === "interne";
  const aucuneMachine = bon.machinesIdentifiees.length === 0;
  // LA DATE ET L'HEURE PLANIFIÉES (BON-3) — même composition que la fiche
  // (`FICHE-INTERVENTION-1`) : `date_planifiee` est un jour CIVIL
  // (`dateCivile`), l'heure, si le créneau en porte une, est lue dans le
  // fuseau de l'AGENCE (`heureDuCreneau`) — jamais une seconde lecture qui
  // pourrait diverger (§9, 01/09).
  const heurePlanifiee = heureDuCreneau(bon.ligne, bon.fuseau);
  const datePlanifieeAffichee =
    bon.ligne.date_planifiee === null
      ? t("statut.a_planifier")
      : heurePlanifiee === null
        ? dateCivile(bon.ligne.date_planifiee)
        : `${dateCivile(bon.ligne.date_planifiee)} ${heurePlanifiee}`;
  // LA DATE DE L'EN-TÊTE (9I7C-RESERVES) — la clôture, plus proche du
  // travail réellement fait, prime sur la date planifiée quand elle existe
  // (`bon.clotureeLe` est un instant, lu dans le fuseau de l'agence par
  // `dateLocale` — jamais `dateCivile`, réservée aux colonnes `@db.Date`).
  const dateDocumentAffichee =
    bon.clotureeLe !== null
      ? dateLocale(bon.clotureeLe, bon.fuseau)
      : bon.ligne.date_planifiee === null
        ? null
        : dateCivile(bon.ligne.date_planifiee);

  // ── LES SEPT TUILES DE CONTENU, DANS L'ORDRE DE `perfil.ordreTuiles` ─────
  //
  // Un `Record` plutôt qu'un `switch` : chaque tuile se construit une seule
  // fois, puis `perfil.ordreTuiles` ne fait que choisir l'ORDRE de lecture —
  // jamais une seconde écriture du contenu selon la nature de l'intervention.
  const TUILES: Record<TuileBon, React.ReactNode> = {
    client: (
      <Carte key="client" titre={t("intervention.client")}>
        <dl className="grid grid-cols-1 gap-x-3 gap-y-2.5 px-4 py-3.5 text-[13px] font-bold sm:grid-cols-[132px_1fr]">
          <Ligne
            libelle={t("intervention.client")}
            valeur={bon.client ?? "—"}
          />
          <Ligne libelle={mot("site")} valeur={bon.site ?? "—"} />
          <Ligne libelle={t("site.adresse")} valeur={bon.adresseSite ?? "—"} />
          <Ligne
            libelle={t("intervention.contact_sur_place")}
            valeur={bon.contact ?? "—"}
          />
        </dl>
      </Carte>
    ),
    materiel: (
      <Carte key="materiel" titre={t("intervention.machine")}>
        <dl className="grid grid-cols-1 gap-x-3 gap-y-2.5 px-4 py-3.5 text-[13px] font-bold sm:grid-cols-[132px_1fr]">
          <Ligne
            libelle={t("intervention.machine")}
            valeur={
              aucuneMachine
                ? aucuneMachineSurLeSite()
                : bon.machinesIdentifiees.join(", ")
            }
          />
        </dl>
      </Carte>
    ),
    intervention: (
      <Carte key="intervention" titre={t("intervention.titre")}>
        <dl className="grid grid-cols-1 gap-x-3 gap-y-2.5 px-4 py-3.5 text-[13px] font-bold sm:grid-cols-[132px_1fr]">
          <Ligne
            libelle={t("intervention.date")}
            valeur={datePlanifieeAffichee}
          />
          <Ligne
            libelle={t("intervention.type")}
            valeur={objetDuBloc(bon.ligne)}
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
            {segmentsSurSiteTitre()}
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
                        {dateHeureLocale(segment.debut, bon.fuseau)}
                      </td>
                      <td className="py-1 pr-2">
                        {segment.fin === null
                          ? t("intervention.bon.segment_en_cours")
                          : dateHeureLocale(segment.fin, bon.fuseau)}
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
                  libelle={tempsTotalSurSiteLibelle()}
                  valeur={enDuree(bon.minutesTotal)}
                />
              </dl>
            </>
          )}
        </div>
      </Carte>
    ),
    commentaires: (
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
    ),
    pieces: (
      <Carte key="pieces" titre={t("intervention.bon.pieces_titre")}>
        <div className="px-4 py-3.5">
          <ul className="list-disc pl-4 text-13 font-bold">
            {bon.piecesRemplacees.map((piece, index) => (
              <li key={index}>{libellePieceRemplacee(piece)}</li>
            ))}
          </ul>
        </div>
      </Carte>
    ),
    prestations: (
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
    ),
    suite: (
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
    ),
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
                {ligneSignature(
                  bon.signature.signataire_nom,
                  bon.signature.signataire_qualite,
                  dateHeureLocale(bon.signature.cree_le, bon.fuseau),
                )}
              </p>
            </div>
          ) : (
            // LES DEUX AUTRES ISSUES (9DE-TP-CY1, D-S5) — aucune image, un
            // motif à la place. Composé en UNE SEULE chaîne, comme
            // `ligneSignature` ci-dessous : une chaîne JSX littérale, même
            // entre accolades, est refusée par le gardien `react/jsx-no-
            // literals`.
            <p className="text-app-encre-faible text-[12px] font-bold">
              {ligneSignatureAbsenteOuRefusee(
                bon.signature.issue,
                bon.signature.motif,
              )}
            </p>
          )}
        </div>
      </Carte>
    ),
  };

  // ── VALORISATION — hors des sept tuiles ci-dessus (absente de la demande
  // d'Alexis, 2bis), toujours juste après la tuile « Intervention », quelle
  // que soit la nature : `profilDuBon` ne réordonne que les sept tuiles de
  // contenu, jamais ce bloc réservé aux rôles qui ont le droit de voir un
  // montant (`accesAuxMontants`).
  const valorisationTuile = !interne ? null : (
    <Carte key="valorisation" titre={t("intervention.bon.valorisation_titre")}>
      <div className="px-4 py-3.5">
        {!montants.montre ? (
          <p className="text-app-oxyde text-13 font-bold print:hidden">
            {t(montants.cle)}
          </p>
        ) : bon.taux === null ? (
          <p className="text-app-oxyde text-13 font-bold">
            {t("intervention.bon.taux_absent")}
          </p>
        ) : (
          <dl className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-[132px_1fr]">
            <Ligne
              libelle={t("intervention.cloture.taux")}
              valeur={formatMoney(bon.taux, bon.devise)}
            />
            {bon.forfaitMontant === null ||
            bon.forfaitLibelle === null ? null : (
              <Ligne
                libelle={t("intervention.forfait_deplacement")}
                valeur={`${bon.forfaitLibelle}${t("ponctuation.separateur")}${formatMoney(bon.forfaitMontant, bon.devise)}`}
              />
            )}
            <Ligne
              libelle={t("intervention.cloture.total")}
              valeur={
                bon.montantTotal === null
                  ? t("intervention.cloture.total_inconnu")
                  : formatMoney(bon.montantTotal, bon.devise)
              }
            />
          </dl>
        )}
      </div>
    </Carte>
  );

  // ── LES CONDITIONS DE FACTURATION, SANS AUCUN MONTANT (9I8B-CONDITIONS-DE-
  // FACTURATION-SANS-MONTANT, décisions d'Alexis du 29/10/2026 ; reprise
  // 9I8B1 du 31/10/2026) — sur LES DEUX versions, juste AVANT la tuile
  // « Signature du client », quelle que soit la nature : la règle de ne
  // montrer aucun montant sur le bon reste entière, ces lignes n'en portent
  // jamais.
  const conditionsTuile =
    bon.conditionsFacturation.length === 0 ? null : (
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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <Link
          href={`/interventions/${id}`}
          className="text-app-marque text-[13px] font-bold"
        >
          {t("intervention.bon.retour_fiche")} {referenceAffichee(bon.ligne)}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          {droitRole ? (
            <div className="flex items-center gap-2 text-[12px] font-bold">
              <Link
                href={`/interventions/${id}/bon`}
                aria-current={interne ? undefined : "page"}
                data-bloc="bon-version-client"
                className={
                  interne ? "text-app-encre-faible" : "text-app-marque"
                }
              >
                {t("intervention.bon.version_client")}
              </Link>
              <Link
                href={`/interventions/${id}/bon?version=interne`}
                aria-current={interne ? "page" : undefined}
                data-bloc="bon-version-interne"
                className={
                  interne ? "text-app-marque" : "text-app-encre-faible"
                }
              >
                {t("intervention.bon.version_interne")}
              </Link>
            </div>
          ) : null}
          <ActionsBonIntervention />
        </div>
      </div>

      {/*
        9I7-BON-INTERVENTION-EN-TUILES (demande d'Alexis du 28/10/2026,
        verbatim) — chaque partie du bon dans sa propre tuile `Carte`, même
        gabarit que 9I6, empilées en une seule colonne (A4 portrait, jamais
        la grille à deux colonnes de la fiche). `zone-impression-bon` passe
        de l'ancienne carte unique à CE conteneur : c'est lui que l'impression
        isole désormais, tuile par tuile.
      */}
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
                  {perfil.titreDocument} {referenceAffichee(bon.ligne)}
                </p>
                {dateDocumentAffichee === null ? null : (
                  <p
                    data-bloc="bon-date"
                    className="text-app-encre-faible text-[12px] font-bold"
                  >
                    {t("intervention.bon.date_bon")}
                    {t("ponctuation.deux_points")}
                    {dateDocumentAffichee}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {interne ? (
                <span
                  data-bloc="bon-badge-interne"
                  className="text-app-oxyde border-app-oxyde rounded-full border px-2 py-0.5 text-12 font-bold"
                >
                  {t("intervention.bon.version_interne")}
                </span>
              ) : null}
              <span
                className={`rounded-full px-2 py-0.5 text-12 font-bold ${CLASSES_STATUT[statut]}`}
              >
                {t(`statut.${statut}`)}
              </span>
            </div>
          </div>
        </Carte>

        {perfil.ordreTuiles.flatMap((tuile) => {
          // LA TUILE « PIECES » NE S'AFFICHE JAMAIS VIDE, ET JAMAIS HORS DES
          // TROIS NATURES CONCERNÉES (9I7B, point 4 du ticket) — à la
          // différence des autres tuiles, qui affichent toujours leur
          // absence (voir l'entête du module).
          if (
            tuile === "pieces" &&
            (!aSectionPiecesRemplacees(bon.ligne.type as TypeIntervention) ||
              bon.piecesRemplacees.length === 0)
          ) {
            return [];
          }
          const noeuds = TUILES[tuile];
          if (tuile === "intervention") {
            return [noeuds, valorisationTuile];
          }
          // LA TUILE « SIGNATAIRE » EST TOUJOURS LA DERNIÈRE DE
          // `perfil.ordreTuiles`, QUELLE QUE SOIT LA NATURE — placer les
          // conditions de facturation ici, c'est les placer juste avant la
          // signature pour le curatif ET le préventif, sans avoir à
          // dupliquer la logique de `profilDuBon`.
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
        {interne ? (
          <p
            data-bloc="bon-mention-interne"
            className="text-app-oxyde border-app-bord border-t pt-3 text-12 font-extrabold"
          >
            {t("intervention.bon.mention_interne")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** « Client absent — Motif : … » ou « Refus de signer — Motif : … » (9DE-TP-CY1, D-S5). */
function ligneSignatureAbsenteOuRefusee(
  issue: Exclude<IssueSignature, "signee">,
  motif: string | null,
): string {
  const entete =
    issue === "client_absent"
      ? t("intervention.realisation.signature_absente")
      : t("intervention.realisation.signature_refusee");
  return `${entete}${t("ponctuation.separateur")}${t("intervention.realisation.motif_libelle")} ${motif}`;
}

/**
 * « Signé par NOM (QUALITÉ) le DATE » — ou « Signé le DATE » pour une
 * signature antérieure à BON-4 (76-BON-4, SAV-10), qui ne porte pas de nom.
 * Une qualité absente retire ses parenthèses, elle ne les vide jamais.
 */
function ligneSignature(
  nom: string | null,
  qualite: string | null,
  date: string,
): string {
  if (nom === null) {
    return `${t("intervention.bon.signature_le")} ${date}`;
  }
  const suffixeQualite = qualite === null ? "" : ` (${qualite})`;
  return `${t("intervention.bon.signe_par")} ${nom}${suffixeQualite} ${t("intervention.bon.le")} ${date}`;
}

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <>
      <dt className="text-app-encre-faible text-[12px] font-bold">{libelle}</dt>
      <dd className="font-semibold break-words hyphens-auto">{valeur}</dd>
    </>
  );
}
