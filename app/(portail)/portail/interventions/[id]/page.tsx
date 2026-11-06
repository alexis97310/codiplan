import type { Metadata } from "next";

import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { Page } from "@/components/mise-en-page/page";
import { estRolePortail } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { estUuid } from "@/lib/identifiant";
import { t } from "@/lib/i18n/fr";
import { ENTREES_PORTAIL } from "@/lib/navigation/entrees";
import { parcDuClient, rattachementsDuCompte } from "@/lib/portail/depot";
import { commentairesVisiblesClient } from "@/lib/portail/interventions";

import { ficheInterventionDuParc } from "../depot";
import {
  dateDeLIntervention,
  identifiantDeLIntervention,
  siteDeLIntervention,
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
  const [fiche, commentaires, parc] = await Promise.all([
    ficheInterventionDuParc(contexte, id),
    commentairesVisiblesClient(contexte, id),
    parcDuClient(contexte),
  ]);
  if (fiche === null || commentaires === null) {
    notFound();
  }
  const siteParId = new Map(parc.sites.map((site) => [site.id, site.libelle]));

  const titreFiche = titreDeLaFicheIntervention(fiche);
  const sansCommentaire =
    commentaires.commentaireTechnicien === null &&
    commentaires.suiteADonner === null;

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
      <section className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5 text-[13px] font-bold">
        <span>{t(`statut.${fiche.statut}`)}</span>
        <span>{t(`type_intervention.${fiche.type}`)}</span>
        <span>{dateDeLIntervention(fiche)}</span>
        <span>{siteDeLIntervention(fiche.siteId, siteParId)}</span>
        <span>{identifiantDeLIntervention(fiche.numero, fiche.annee)}</span>
      </section>

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

      {/*
        LE LIEN VERS LE BON (9J08A-REPRISE-9J08, CLI-2.6) — SEULEMENT une fois
        l'intervention CLÔTURÉE : `bonInterventionDuParc` refuse nommément un
        bon demandé plus tôt (point 2 du ticket), ce lien évite simplement de
        le proposer avant ce palier.
      */}
      {fiche.statut === "cloturee" ? (
        <Link
          href={`/portail/interventions/${id}/bon`}
          className="text-app-marque text-[13px] font-bold"
        >
          {t("portail.interventions.bon.lien")}
        </Link>
      ) : null}
    </Page>
  );
}
