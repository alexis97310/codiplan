import type { Metadata } from "next";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { ActionsBonIntervention } from "@/components/interventions/actions-bon";
import { exigerCapacite } from "@/lib/auth/porte";
import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import { lireBonIntervention } from "@/lib/interventions/bon";
import { peutGenererLeBon } from "@/lib/interventions/cycle-de-vie";
import { accesAuxMontants } from "@/lib/interventions/montants-visibles";
import type { StatutIntervention } from "@/lib/interventions/saisie";
import { libellesDesMachines } from "@/lib/machines/depot";
import { formatMoney } from "@/lib/money";
import { CLASSES_STATUT } from "@/lib/theme/statuts";

import {
  aucuneMachineSurLeSite,
  dateHeureLocale,
  machinesAffichees,
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
 * ## Le montant obéit à LA MÊME règle que la fiche, jamais une seconde
 *
 * `accesAuxMontants` décide déjà qui voit la valorisation de vente
 * (`lib/interventions/montants-visibles.ts`, D37, arbitrage 3.8). Ce bon ne
 * réécrit rien : si le rôle n'y a pas droit, TOUT le bloc de valorisation —
 * taux, forfait, total — est remplacé par le motif, exactement comme sur la
 * fiche.
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
  const bon = await lireBonCache(contexte, id);
  if (bon === null) {
    return { title: t("intervention.bon.titre") };
  }
  return {
    title: `${t("intervention.bon.titre")} ${referenceAffichee(bon.ligne)}`,
  };
}

export default async function PageBonIntervention({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contexte = await exigerCapaciteCache("consulter_planning");
  if (contexte === null) {
    redirect(`/interventions/${id}?motif=intervention.bon.refus.acces`);
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
  const montants = accesAuxMontants(contexte.role);
  const libellesMachines = await libellesDesMachines(
    contexte,
    bon.ligne.machines.map((m) => m.machine_id),
  );
  const machines = machinesAffichees(bon.ligne, libellesMachines);
  const aucuneMachine = bon.ligne.machines.length === 0;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <ActionsBonIntervention />

      <div className="zone-impression-bon bg-app-surface border-app-bord flex flex-col gap-5 rounded-lg border p-6 text-[13px]">
        <header className="border-app-bord flex items-start justify-between gap-4 border-b pb-3">
          <div>
            <h1 className="text-[18px] font-extrabold">
              {bon.societe.raisonSociale}
            </h1>
            <p className="text-app-encre-faible text-[12px]">
              {t("intervention.bon.titre")} {referenceAffichee(bon.ligne)}
            </p>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${CLASSES_STATUT[statut]}`}
          >
            {t(`statut.${statut}`)}
          </span>
        </header>

        <dl className="grid grid-cols-[132px_1fr] gap-x-3 gap-y-2.5">
          <Ligne
            libelle={t("intervention.client")}
            valeur={bon.client ?? "—"}
          />
          <Ligne libelle={mot("site")} valeur={bon.site ?? "—"} />
          <Ligne libelle={mot("agence")} valeur={bon.agence ?? "—"} />
          <Ligne
            libelle={t("intervention.machine")}
            valeur={aucuneMachine ? aucuneMachineSurLeSite() : machines}
          />
        </dl>

        <section className="flex flex-col gap-2">
          <h2 className="text-[13px] font-bold">{segmentsSurSiteTitre()}</h2>
          {bon.segments.length === 0 ? (
            <p className="text-app-encre-faible text-[12px]">
              {t("intervention.bon.aucun_segment")}
            </p>
          ) : (
            <>
              <table className="w-full border-collapse text-[12.5px]">
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
                          : minutes(segment.minutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl className="grid grid-cols-[132px_1fr] gap-x-3 gap-y-2.5">
                <Ligne
                  libelle={tempsTotalSurSiteLibelle()}
                  valeur={minutes(bon.minutesTotal)}
                />
              </dl>
            </>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-[13px] font-bold">
            {t("intervention.bon.valorisation_titre")}
          </h2>
          {!montants.montre ? (
            <p className="text-app-oxyde text-[12.5px]">{t(montants.cle)}</p>
          ) : bon.taux === null ? (
            <p className="text-app-oxyde text-[12.5px]">
              {t("intervention.bon.taux_absent")}
            </p>
          ) : (
            <dl className="grid grid-cols-[132px_1fr] gap-x-3 gap-y-2.5">
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
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-[13px] font-bold">
            {t("intervention.bon.prestations_titre")}
          </h2>
          {bon.prestationsRealisees.length === 0 ? (
            <p className="text-app-encre-faible text-[12px]">
              {t("intervention.bon.aucune_prestation")}
            </p>
          ) : (
            <ul className="list-disc pl-4 text-[12.5px]">
              {bon.prestationsRealisees.map((prestation) => (
                <li key={prestation.id}>{prestation.libelle}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-[13px] font-bold">
            {t("intervention.bon.commentaire_titre")}
          </h2>
          <p className="text-[12.5px] whitespace-pre-wrap">
            {bon.commentaireTechnicien ?? (
              <span className="text-app-encre-faible">
                {t("intervention.bon.aucun_commentaire")}
              </span>
            )}
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-[13px] font-bold">
            {t("intervention.bon.suite_titre")}
          </h2>
          <p className="text-[12.5px] whitespace-pre-wrap">
            {bon.suiteADonner ?? (
              <span className="text-app-encre-faible">
                {t("intervention.bon.aucune_suite")}
              </span>
            )}
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-[13px] font-bold">
            {t("intervention.bon.photos_titre")}
          </h2>
          {bon.photos.length === 0 ? (
            <p className="text-app-encre-faible text-[12px]">
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
                  <figcaption className="text-app-encre-faible text-[10.5px]">
                    {photo.libelle}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-[13px] font-bold">
            {t("intervention.bon.signature_titre")}
          </h2>
          {bon.signature === null ? (
            <p className="text-app-encre-faible text-[12px]">
              {t("intervention.bon.aucune_signature")}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- tracé encodé en mémoire, jamais un fichier statique */}
              <img
                src={bon.signature.image_base64}
                alt={t("intervention.bon.signature_titre")}
                className="border-app-bord h-[80px] w-[180px] rounded border object-contain"
              />
              <p className="text-app-encre-faible text-[10.5px]">
                {t("intervention.bon.signature_le")}{" "}
                {dateHeureLocale(bon.signature.cree_le, bon.fuseau)}
              </p>
            </div>
          )}
        </section>

        {bon.societe.mentionsLegales === null ? null : (
          <p className="text-app-encre-faible border-app-bord border-t pt-3 text-[10.5px]">
            {bon.societe.mentionsLegales}
          </p>
        )}
      </div>
    </div>
  );
}

function minutes(total: number): string {
  const heures = Math.floor(total / 60);
  const reste = String(total % 60).padStart(2, "0");
  return heures === 0 ? `${reste} min` : `${heures} h ${reste}`;
}

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <>
      <dt className="text-app-encre-faible text-[12px]">{libelle}</dt>
      <dd className="font-semibold break-all">{valeur}</dd>
    </>
  );
}
