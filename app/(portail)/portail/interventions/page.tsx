import type { Metadata } from "next";

import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { estRolePortail } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { t } from "@/lib/i18n/fr";
import { ENTREES_PORTAIL } from "@/lib/navigation/entrees";
import { parcDuClient, rattachementsDuCompte } from "@/lib/portail/depot";

import { interventionsDuParc } from "./depot";
import {
  dateDeLIntervention,
  identifiantDeLIntervention,
  siteDeLIntervention,
  sousTitreDesInterventions,
} from "./presentation";

export const metadata: Metadata = { title: t("portail.interventions.titre") };

/**
 * LA LISTE DES INTERVENTIONS DU PORTAIL (9J07-PORTAIL-INTERVENTION-ETAT,
 * CLI-2.5, CLI-2.7) — L'ÉTAT COURANT SEUL.
 *
 * ## LA LECTURE DU CONTEXTE — IDENTIQUE AUX AUTRES ÉCRANS DU PORTAIL (D70,
 * D92), JAMAIS UNE SECONDE DÉSIGNATION
 *
 * Même chemin que `/portail/demandes` et `/portail/contacts` : rôle du
 * portail exigé, puis le PREMIER rattachement de ce compte sur la société
 * active.
 *
 * ## FORME « PARC », AUCUN FILTRE ÉCRIT ICI
 *
 * `interventionsDuParc` (`./depot.ts`) lit sous le contexte — société, client
 * et périmètre de sites sont ceux que `intervention` porte déjà, exactement
 * comme `parcDuClient`. Aucune comparaison n'est recomposée dans cette page.
 *
 * ## AUCUNE ENTRÉE DE MENU N'EST AJOUTÉE
 *
 * Même état que `/portail/contacts` et `/portail/demandes` : cet écran n'est
 * atteignable que par son URL directe — gap nommé en passation, pas une
 * omission silencieuse.
 */
export default async function PageInterventionsPortail() {
  const session = await obtenirSession(await headers());
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

  const rattachements = await rattachementsDuCompte(
    session.contexte.utilisateurId,
  );
  const surCetteSociete = rattachements.filter(
    (r) => r.societeId === session.contexte.societeId,
  );
  const premier = surCetteSociete[0];
  if (premier === undefined) {
    redirect("/arrivee");
  }

  const contexte = { ...session.contexte, clientId: premier.clientId };
  const [interventions, parc] = await Promise.all([
    interventionsDuParc(contexte),
    parcDuClient(contexte),
  ]);
  const siteParId = new Map(parc.sites.map((site) => [site.id, site.libelle]));

  return (
    <Page
      chemin="/portail/interventions"
      entrees={ENTREES_PORTAIL}
      titre={t("portail.interventions.titre")}
      sousTitre={sousTitreDesInterventions()}
    >
      <section className="flex flex-col gap-3">
        <p className="text-app-encre-faible text-13 font-bold">
          {t("portail.interventions.bloc.titre")}
          {t("ponctuation.parenthese_ouvrante")}
          {interventions.length}
          {t("ponctuation.parenthese_fermante")}
        </p>
        {interventions.length === 0 ? (
          <p className="text-[13px] font-bold">
            {t("portail.interventions.vide")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {interventions.map((intervention) => (
              <li key={intervention.id}>
                <Link
                  href={`/portail/interventions/${intervention.id}`}
                  className="bg-app-surface border-app-bord hover:border-app-marque flex flex-col gap-2 rounded-lg border px-4 py-3 text-[13px] font-bold"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span>
                      {identifiantDeLIntervention(
                        intervention.numero,
                        intervention.annee,
                      )}
                    </span>
                    <span className="text-app-encre-faible">
                      {t(`statut.${intervention.statut}`)}
                    </span>
                    <span className="text-app-encre-faible">
                      {dateDeLIntervention(intervention)}
                    </span>
                  </div>
                  <div className="text-app-encre-faible flex flex-wrap gap-x-4 gap-y-1 text-12 font-bold">
                    <span>{t(`type_intervention.${intervention.type}`)}</span>
                    <span>
                      {siteDeLIntervention(intervention.siteId, siteParId)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}
