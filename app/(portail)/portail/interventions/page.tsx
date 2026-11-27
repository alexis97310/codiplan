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
 * ## LA LECTURE DU CONTEXTE — TOUS LES CLIENTS RATTACHÉS, PAS SEULEMENT LE
 * PREMIER (9L50-PORTAIL-PHOTOS-TOUS-CLIENTS)
 *
 * `app.client_id` ne désigne qu'UN client par lecture (D70) : un compte
 * rattaché à plusieurs clients de la même société n'a donc pas de lecture
 * unique pour « toutes mes interventions ». Cette page interroge chaque
 * rattachement et CONCATÈNE — jamais `premierSucces` (`lib/portail/depot.ts`),
 * réservée aux lectures PAR IDENTIFIANT : une intervention n'appartient qu'à
 * un seul client, une LISTE en porte plusieurs à la fois. Mesuré avant ce
 * ticket : un compte à deux clients ne voyait que les interventions du
 * premier — exactement le défaut relevé sur les photos (revue de 9L28).
 *
 * ## FORME « PARC », AUCUN FILTRE ÉCRIT ICI
 *
 * `interventionsDuParc` (`./depot.ts`) lit sous le contexte — société, client
 * et périmètre de sites sont ceux que `intervention` porte déjà, exactement
 * comme `parcDuClient`. Aucune comparaison n'est recomposée dans cette page ;
 * seule l'UNION de plusieurs lectures, une par client, l'est.
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
  if (surCetteSociete.length === 0) {
    redirect("/arrivee");
  }

  const [listesInterventions, listesSites] = await Promise.all([
    Promise.all(
      surCetteSociete.map((r) =>
        interventionsDuParc({ ...session.contexte, clientId: r.clientId }),
      ),
    ),
    Promise.all(
      surCetteSociete.map((r) =>
        parcDuClient({ ...session.contexte, clientId: r.clientId }),
      ),
    ),
  ]);
  const interventions = listesInterventions
    .flat()
    .sort((a, b) => b.creeLe.getTime() - a.creeLe.getTime());
  const siteParId = new Map(
    listesSites.flatMap((parc) =>
      parc.sites.map((site) => [site.id, site.libelle] as const),
    ),
  );

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
