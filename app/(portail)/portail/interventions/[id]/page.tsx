import type { Metadata } from "next";

import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { Page } from "@/components/mise-en-page/page";
import { CLASSE_BOUTON_PORTAIL } from "@/components/portail/gabarit";
import { estRolePortail } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { maintenant, lireFuseau } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estUuid } from "@/lib/identifiant";
import { t } from "@/lib/i18n/fr";
import { ENTREES_PORTAIL } from "@/lib/navigation/entrees";
import { parcDuClient, rattachementsDuCompte } from "@/lib/portail/depot";
import { historiqueInterventionDuClient } from "@/lib/portail/historique-etats";
import { commentairesVisiblesClient } from "@/lib/portail/interventions";

import { ficheInterventionDuParc } from "../depot";
import {
  dateDeLIntervention,
  identifiantDeLIntervention,
  siteDeLIntervention,
  tempsParEtatDeLIntervention,
  titreDeLaFicheIntervention,
} from "../presentation";

/**
 * LA FICHE INTERVENTION DU PORTAIL (9J07-PORTAIL-INTERVENTION-ETAT, CLI-2.5,
 * CLI-2.7) — L'ÉTAT COURANT, ET LES COMMENTAIRES QUI LUI SONT DESTINÉS.
 *
 * ## DEUX LECTURES, JAMAIS UN SECOND SELECT SUR LES COMMENTAIRES
 *
 * `ficheInterventionDuParc` (`../depot.ts`) rend l'état — statut, nature,
 * date, site — sous la MÊME politique « parc » que la liste, une lecture par
 * id. `commentairesVisiblesClient` (`lib/portail/interventions.ts`, 9J05)
 * rend les deux commentaires destinés au client : cette page les APPELLE,
 * elle ne compose à aucun moment son propre `select` sur
 * `commentaire_technicien`/`suite_a_donner` — un second lecteur serait une
 * seconde source du même risque de fuite (`note_interne` n'est accessible
 * depuis AUCUN des deux modules).
 *
 * `null`, sur l'une ou l'autre lecture, couvre AUSSI BIEN une intervention
 * inexistante qu'une intervention hors périmètre (D35, D50) — cette fiche ne
 * les distingue pas non plus.
 */
const sessionCache = cache(async () => obtenirSession(await headers()));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const session = await sessionCache();
  if (
    session === null ||
    session.contexte.societeId === null ||
    session.contexte.role === null ||
    !estRolePortail(session.contexte.role)
  ) {
    return { title: t("portail.interventions.titre") };
  }
  const { id } = await params;
  if (!estUuid(id)) {
    return { title: t("portail.interventions.titre") };
  }
  const rattachements = await rattachementsDuCompte(
    session.contexte.utilisateurId,
  );
  const premier = rattachements.find(
    (r) => r.societeId === session.contexte.societeId,
  );
  if (premier === undefined) {
    return { title: t("portail.interventions.titre") };
  }
  const fiche = await ficheInterventionDuParc(
    { ...session.contexte, clientId: premier.clientId },
    id,
  );
  return {
    title:
      fiche === null
        ? t("portail.interventions.titre")
        : titreDeLaFicheIntervention(fiche),
  };
}

export default async function PageFicheInterventionPortail({
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
        titre={t("portail.interventions.titre")}
        sousTitre={t("portail.reserve")}
      />
    );
  }

  const { id } = await params;
  // UN IDENTIFIANT MAL FORMÉ EST UN REFUS, JAMAIS UNE PANNE — même garde que
  // `/portail/machines/[id]`.
  if (!estUuid(id)) {
    notFound();
  }

  const rattachements = await rattachementsDuCompte(
    session.contexte.utilisateurId,
  );
  const premier = rattachements.find(
    (r) => r.societeId === session.contexte.societeId,
  );
  if (premier === undefined) {
    redirect("/arrivee");
  }

  const contexte = { ...session.contexte, clientId: premier.clientId };
  const [fiche, commentaires, parc, historique, societe] = await Promise.all([
    ficheInterventionDuParc(contexte, id),
    commentairesVisiblesClient(contexte, id),
    parcDuClient(contexte),
    historiqueInterventionDuClient(contexte, id),
    avecContexteApplicatif(contexte, (tx) =>
      tx.societe.findFirst({
        where: { id: contexte.societeId as string },
        select: { fuseau_horaire: true },
      }),
    ),
  ]);
  if (fiche === null || commentaires === null) {
    notFound();
  }
  const siteParId = new Map(parc.sites.map((site) => [site.id, site.libelle]));
  const fuseau = lireFuseau(societe?.fuseau_horaire);

  const titreFiche = titreDeLaFicheIntervention(fiche);
  const sansCommentaire =
    commentaires.commentaireTechnicien === null &&
    commentaires.suiteADonner === null;
  // LE TEMPS PAR ÉTAT (9J08B-PORTAIL-TEMPS-PAR-ETAT) — « maintenant » posé UNE
  // fois ici, jamais relu dans la fonction de présentation.
  const tempsParEtat = tempsParEtatDeLIntervention(
    historique,
    fiche.statut,
    maintenant(fuseau).instant,
    fuseau,
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
        { libelle: titreFiche },
      ]}
      titre={titreFiche}
      sousTitre={t("portail.interventions.fiche.sous_titre")}
    >
      <dl className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5 text-[13px] font-bold">
        <LigneFiche
          libelle={t("intervention.statut")}
          valeur={t(`statut.${fiche.statut}`)}
        />
        <LigneFiche
          libelle={t("intervention.type")}
          valeur={t(`type_intervention.${fiche.type}`)}
        />
        <LigneFiche
          libelle={t("intervention.date")}
          valeur={dateDeLIntervention(fiche)}
        />
        <LigneFiche
          libelle={t("intervention.numero")}
          valeur={identifiantDeLIntervention(fiche.numero, fiche.annee)}
        />
      </dl>

      <p className="text-13 font-bold">
        {siteDeLIntervention(fiche.siteId, siteParId)}
      </p>

      <section className="text-app-encre-faible flex flex-col gap-2 text-13 font-bold">
        {sansCommentaire ? (
          <p>{t("portail.interventions.sans_commentaire")}</p>
        ) : (
          <>
            {commentaires.commentaireTechnicien === null ? null : (
              <p>
                <span className="text-app-encre font-extrabold">
                  {t("portail.interventions.commentaire_technicien")}
                  {t("ponctuation.deux_points")}
                </span>{" "}
                {commentaires.commentaireTechnicien}
              </p>
            )}
            {commentaires.suiteADonner === null ? null : (
              <p>
                <span className="text-app-encre font-extrabold">
                  {t("portail.interventions.suite_a_donner")}
                  {t("ponctuation.deux_points")}
                </span>{" "}
                {commentaires.suiteADonner}
              </p>
            )}
          </>
        )}
      </section>

      <section className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5 text-[13px] font-bold">
        <p className="text-app-encre-faible text-13 font-bold">
          {t("portail.interventions.temps_par_etat.titre")}
        </p>
        {tempsParEtat.lignes.length === 0 ? (
          <p className="text-app-encre-faible text-[12px] font-bold">
            {t("portail.interventions.temps_par_etat.aucune")}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {tempsParEtat.lignes.map((ligne) => (
              <li key={ligne.libelle} className="flex justify-between gap-3">
                <span>
                  {ligne.libelle}
                  {!ligne.enCours ? null : (
                    <>
                      {t("ponctuation.parenthese_ouvrante")}
                      {t(
                        "portail.interventions.temps_par_etat.en_cours_suffixe",
                      )}
                      {t("ponctuation.parenthese_fermante")}
                    </>
                  )}
                </span>
                <span className="text-app-encre-faible">{ligne.duree}</span>
              </li>
            ))}
          </ul>
        )}
        {tempsParEtat.indisponibleAvant === null ? null : (
          <p className="text-app-encre-faible text-[12px] font-bold">
            {tempsParEtat.indisponibleAvant}
          </p>
        )}
      </section>

      {/*
        LE LIEN VERS LE BON (9J08A-REPRISE-9J08, CLI-2.6) — SEULEMENT une fois
        l'intervention CLÔTURÉE : `bonInterventionDuParc` refuse nommément un
        bon demandé plus tôt (point 2 du ticket), ce lien évite simplement de
        le proposer avant ce palier.
      */}
      {fiche.statut === "cloturee" ? (
        <div>
          <Link
            href={`/portail/interventions/${id}/bon`}
            className={CLASSE_BOUTON_PORTAIL}
          >
            {t("portail.interventions.bon.lien")}
          </Link>
        </div>
      ) : fiche.statut === "terminee" ? (
        <p className="text-app-encre-faible text-13 font-bold">
          {t("portail.interventions.bon.refus_non_cloturee")}
        </p>
      ) : null}
    </Page>
  );
}

/** Une ligne étiquetée de la fiche (I8, 9K06) — même patron que `LigneIdentite` de `/mon-compte`. */
function LigneFiche({
  libelle,
  valeur,
}: Readonly<{ libelle: string; valeur: string }>) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-app-encre-faible">{libelle}</dt>
      <dd>{valeur}</dd>
    </div>
  );
}
