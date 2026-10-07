import type { Metadata } from "next";

import Link from "next/link";
import { Page } from "@/components/mise-en-page/page";
import { OptionsAgence } from "@/components/agences/options";
import { BarreActionCollee } from "@/components/ui/action-primaire";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { CaseACocher } from "@/components/ui/case-a-cocher";
import { Message } from "@/components/ui/message";
import { RefusAcces } from "@/components/ui/refus-acces";
import { SectionFormulaire } from "@/components/ui/section-formulaire";
import { SelecteurRecherche } from "@/components/ui/selecteur-recherche";
import { agencesProposables } from "@/lib/agences/proposables";
import { peut } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import { lireClient } from "@/lib/clients/depot";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import {
  libelleChampFacultatif,
  libelleChampObligatoire,
} from "@/lib/i18n/obligatoire";
import { rechercherSites } from "@/lib/sites/depot";
import { schemaRechercheSite } from "@/lib/sites/saisie";
import { ZONES_GEOGRAPHIQUES } from "@/lib/sites/zones";

import {
  aideAgenceUnique,
  libelleCreerSite,
  libelleNouveauSite,
  libelleRattachement,
  libelleRetourSites,
  libelleSectionQuiEtNomDuSite,
  titreSitesExistants,
} from "../presentation";
import { BoutonCreer } from "../../interventions/nouvelle/bouton-creer";

export const metadata: Metadata = { title: libelleNouveauSite() };

/**
 * LA CRÉATION D'UN LIEU D'INTERVENTION, AU GABARIT DU 28/09
 * (9EK-TP-UX5-2-CREATIONS-1, TP-UX5-2 ; D125, QE-13a, QT-18 (a)).
 *
 * ## DEUX CHAMPS SANS VALEUR PAR DÉFAUT, ET C'EST LA SAISIE QUI L'EXIGE
 *
 * Le client et le **rattachement** sont obligatoires, et `saisie.ts` écrit
 * pourquoi : *« il n'existe aucune valeur par défaut qui ne soit pas un
 * mensonge — la choisir pour l'utilisateur reviendrait à décider d'où part le
 * temps de trajet »* (D56). **SAUF quand une seule agence est active**
 * (CS41, décision d'Alexis du 05/10/2026) : ce n'est alors plus un choix —
 * il n'y a rien d'autre à choisir — et l'agence arrive présélectionnée, avec
 * l'aide qui le dit. Deux agences actives ou plus : aucune présélection,
 * comme avant.
 *
 * ## Le client est cherché, pas chargé d'un bloc (SELECTEURS-1)
 *
 * Une société en porte déjà 576 : le `<select>` d'avant ce lot était rempli
 * par `rechercherClients` sous sa limite par défaut, si bien que le 51e
 * client ne pouvait recevoir aucun site depuis cet écran (SAV-17). Le champ
 * client interroge maintenant `/api/recherche/clients`, cloisonnée comme
 * toute lecture d'ici.
 *
 * ## Les listes sont lues SOUS le contexte cloisonné
 *
 * Un compte ne peut proposer que ce qu'il a le droit de lire, et aucune
 * comparaison de société n'est écrite ici.
 *
 * ## CE QUE LA MAQUETTE DIT ET QUE LE CODE DÉMENT (D128)
 *
 * Les horaires d'accès ne sont PAS saisis ici (aucun éditeur de plages
 * n'existe nulle part) ; une zone absente laisse le FORFAIT de déplacement
 * intact (un forfait sans zone s'applique partout) ; les consignes ne sont
 * lues que sur la fiche, jamais par l'application technicien. Les phrases de
 * la maquette qui le prétendaient ont été retirées plutôt que recopiées.
 */
export default async function PageNouveauSite({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }

  // D153 (03/10/2026, TP-S3) — même capacité que la route qui reçoit ce
  // formulaire (`gerer_client_site`) ; remplace la garde QT-2 (D152) qui ne
  // fermait que le technicien.
  if (
    session.contexte.role === null ||
    !peut(session.contexte.role, "gerer_client_site")
  ) {
    return (
      <Page chemin="/sites" titre={libelleNouveauSite()}>
        <RefusAcces />
      </Page>
    );
  }

  const params = await searchParams;
  const motif = params.motif;

  // LE CLIENT PRÉREMPLI (LIENS-1, « + Site » depuis une fiche client ; même
  // forme pour FICHE-360-1, `/sites/nouveau?client=`) — résolu SOUS le
  // contexte cloisonné : un identifiant hors périmètre ou inexistant rend
  // `null`, et le champ retombe sur son état vide plutôt que d'afficher un
  // identifiant qu'on ne sait pas nommer.
  const clientParam =
    typeof params.client === "string" ? params.client : undefined;
  const clientInitial =
    clientParam === undefined
      ? null
      : await lireClient(session.contexte, clientParam);

  // LES SITES EXISTANTS DE CE CLIENT (9EK-TP-UX5-2-CREATIONS-1) — même
  // lecture que la colonne de droite d'une fiche, bornée au client résolu
  // ci-dessus. Absente si `?client=` ne résout à rien.
  const sitesExistants =
    clientInitial === null
      ? []
      : await rechercherSites(
          session.contexte,
          schemaRechercheSite.parse({ client_id: clientInitial.id }),
        );

  // AGENCE-ACTIVE (9AY-AA-1) : une agence inactive ne se propose plus pour
  // un site NEUF — il n'y a encore aucun rattachement à garder ici, à la
  // différence de `/sites/[id]`.
  const agences = await avecContexteApplicatif(session.contexte, (tx) =>
    agencesProposables(tx),
  );
  // CS41 (décision d'Alexis du 05/10/2026) — `agencesProposables` ne rend
  // déjà que les agences ACTIVES pour un site neuf (pas de `garder` ici) :
  // une seule ligne veut dire une seule agence active.
  const seuleAgenceActive = agences.length === 1 ? agences[0] : undefined;

  // LA SAISIE GARDÉE APRÈS UN REFUS (9BR-TP-A4b-MESSAGES, CS42) — ce que
  // `versLeFormulaire` (`app/api/sites/creer/formulaire.ts`) reporte dans
  // l'URL. Un paramètre absent retombe sur le champ vide, comme avant.
  const valeur = (nom: string): string =>
    typeof params[nom] === "string" ? params[nom] : "";
  const agenceGardee = valeur("agence_id");
  const agenceParDefaut =
    agenceGardee !== "" ? agenceGardee : (seuleAgenceActive?.id ?? "");

  return (
    <Page
      chemin="/sites"
      titre={libelleNouveauSite()}
      sousTitre={t("sites.nouveau.sous_titre")}
      actions={
        <Link href="/sites" className="text-app-encre-faible text-13 font-bold">
          {libelleRetourSites()}
        </Link>
      }
    >
      {typeof motif === "string" && motif === "clients.cree" ? (
        <Message ton="succes" titre={t("clients.cree")} />
      ) : typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          data-motif={motif}
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-13 font-bold"
        >
          {t(motif)}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 min-[901px]:grid-cols-[minmax(0,1fr)_280px]">
        <form
          method="post"
          action="/api/sites/creer"
          className="flex flex-col gap-5 pb-20 min-[901px]:pb-0"
        >
          <SectionFormulaire numero={1} titre={libelleSectionQuiEtNomDuSite()}>
            {/* LE RATTACHEMENT N'A AUCUNE OPTION PRÉSÉLECTIONNÉE SOUS DEUX
                AGENCES ACTIVES OU PLUS — voir l'entête, c'est D56. SOUS UNE
                SEULE, CS41 la présélectionne. Le CLIENT, lui, PEUT l'être
                depuis FICHE-360-1/LIENS-1 (`?client=`) : ce n'est pas le
                champ que D56 protège — prérempli depuis la fiche client, il
                ne décide de rien sur le trajet. */}
            <SelecteurRecherche
              nom="client_id"
              url="/api/recherche/clients"
              libelle={libelleChampObligatoire(t("site.client"))}
              libelleAucunResultat={t("selecteur.aucun_resultat")}
              libelleVoirPlus={t("selecteur.voir_plus")}
              obligatoire
              aide={t("site.client.aide_distinction")}
              valeurInitiale={
                clientInitial === null
                  ? undefined
                  : {
                      id: clientInitial.id,
                      libelle: clientInitial.raison_sociale,
                    }
              }
            />

            <label className="flex flex-col gap-1 text-13 font-bold">
              {libelleChampObligatoire(t("site.libelle"))}
              <input
                name="libelle"
                required
                defaultValue={valeur("libelle")}
                className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
              />
            </label>

            <label className="flex flex-col gap-1 text-13 font-bold">
              {libelleChampObligatoire(libelleRattachement())}
              <select
                name="agence_id"
                required
                defaultValue={agenceParDefaut}
                className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
              >
                <option value="" disabled />
                <OptionsAgence agences={agences} />
              </select>
              {seuleAgenceActive === undefined ? null : (
                <span className="text-app-encre-faible text-12 font-bold">
                  {aideAgenceUnique()}
                </span>
              )}
            </label>
          </SectionFormulaire>

          <SectionFormulaire numero={2} titre={t("sites.nouveau.section_ou")}>
            <label className="flex flex-col gap-1 text-13 font-bold">
              {libelleChampFacultatif(t("site.adresse"))}
              <input
                name="adresse"
                defaultValue={valeur("adresse")}
                className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
              />
              <span className="text-app-encre-faible text-12 font-bold">
                {t("site.adresse.aide")}
              </span>
            </label>

            <label className="flex flex-col gap-1 text-13 font-bold">
              {libelleChampFacultatif(t("site.commune"))}
              <input
                name="commune"
                defaultValue={valeur("commune")}
                className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
              />
            </label>

            <label className="flex flex-col gap-1 text-13 font-bold">
              {libelleChampFacultatif(t("site.zone_geo"))}
              <select
                name="zone_geo"
                defaultValue={valeur("zone_geo")}
                className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
              >
                <option value="" />
                {ZONES_GEOGRAPHIQUES.map((zone) => (
                  <option key={zone} value={zone}>
                    {t(`site.zone.${zone}`)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-13 font-bold">
              {libelleChampFacultatif(t("site.temps_trajet_min"))}
              <input
                name="temps_trajet_min"
                defaultValue={valeur("temps_trajet_min")}
                className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
              />
              <span className="text-app-encre-faible text-12 font-bold">
                {t("site.temps_trajet_min.aide")}
              </span>
            </label>

            <label className="flex flex-col gap-1 text-13 font-bold">
              {libelleChampFacultatif(t("site.consignes_acces"))}
              <textarea
                name="consignes_acces"
                defaultValue={valeur("consignes_acces")}
                rows={3}
                className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
              />
            </label>

            <CaseACocher
              name="sous_contrat"
              value="1"
              defaultChecked={false}
              libelle={t("site.sous_contrat")}
            />
          </SectionFormulaire>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/sites"
              className="text-app-encre-faible text-13 font-bold"
            >
              {t("sites.nouveau.annuler")}
            </Link>
            <BarreActionCollee>
              <BoutonCreer>{libelleCreerSite()}</BoutonCreer>
            </BarreActionCollee>
          </div>
        </form>

        <aside className="flex flex-col gap-4">
          {clientInitial === null ? null : (
            <section className="bg-app-surface border-app-bord flex flex-col gap-1.5 rounded-lg border p-4">
              <h2 className="text-14 font-bold">{titreSitesExistants()}</h2>
              {sitesExistants.length === 0 ? (
                <p className="text-app-encre-faible text-13 font-bold">
                  {t("sites.existants.aucun")}
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {sitesExistants.map((site) => (
                    <li key={site.id} className="text-13 font-bold">
                      <Link href={`/sites/${site.id}`} className="underline">
                        {site.libelle}
                      </Link>
                      {site.commune === null ? null : (
                        <>
                          {t("ponctuation.point_median")}
                          {site.commune}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          <section className="bg-app-surface border-app-bord flex flex-col gap-1.5 rounded-lg border p-4">
            <h2 className="text-14 font-bold">
              {t("sites.nouveau.aide_usage_titre")}
            </h2>
            <p className="text-app-encre-faible text-13 font-bold">
              {t("sites.nouveau.aide_usage_zone_trajet")}
            </p>
          </section>
        </aside>
      </div>
    </Page>
  );
}
