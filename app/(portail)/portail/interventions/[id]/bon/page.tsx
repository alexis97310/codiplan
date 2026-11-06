import type { Metadata } from "next";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache, Fragment } from "react";

import { ActionsBonIntervention } from "@/components/interventions/actions-bon";
import { Page } from "@/components/mise-en-page/page";
import { Carte } from "@/components/ui/carte";
import { estRolePortail } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { dateCivile, jourDe, versLocal } from "@/lib/calendar/fuseau";
import { estUuid } from "@/lib/identifiant";
import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import { libellePieceRemplacee } from "@/lib/interventions/bon";
import { profilDuBon, type TuileBon } from "@/lib/interventions/profil-bon";
import {
  aSectionPiecesRemplacees,
  type TypeIntervention,
} from "@/lib/interventions/saisie";
import { lignesDetailMachine } from "@/lib/machines/presentation";
import { ENTREES_PORTAIL } from "@/lib/navigation/entrees";
import { rattachementsDuCompte } from "@/lib/portail/depot";
import { CLASSES_STATUT } from "@/lib/theme/statuts";

import { bonInterventionDuParc } from "../../depot";
import { identifiantDeLIntervention } from "../../presentation";
import {
  aucuneMachineDuBonPortail,
  dateLocaleDuBonPortail,
  ligneSignatureAbsenteOuRefuseeDuBonPortail,
  ligneSignatureDuBonPortail,
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
 * ## Ce qui manque structurellement, et pourquoi ce n'est pas réparé ici
 *
 * `segments` est toujours vide et le technicien affecté toujours
 * irrésolu sous le contexte portail (`lireBonDuParc`, `lib/interventions/
 * bon.ts`) : deux politiques RLS existantes (`segment_travail`, forme
 * « interne » D94 ; `utilisateur`, décision du 07/09/2026) excluent
 * structurellement tout contexte qui porte `app.client_id`. Cette page ne
 * les contourne pas (§8 : aucune politique RLS n'est à toucher ici) — elle
 * omet simplement le tableau des segments et le nom du technicien, que rien
 * ne remplirait jamais pour ce rôle.
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
  const aucuneMachine = bon.machinesIdentifiees.length === 0;
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
          {aucuneMachine ? (
            <Ligne
              libelle={t("intervention.machine")}
              valeur={aucuneMachineDuBonPortail()}
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

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <>
      <dt className="text-app-encre-faible text-[12px] font-bold">{libelle}</dt>
      <dd className="font-semibold break-words hyphens-auto">{valeur}</dd>
    </>
  );
}
