import type { Metadata } from "next";

import Link from "next/link";
import { Page } from "@/components/mise-en-page/page";
import { OptionsAgence } from "@/components/agences/options";
import { ActionPrimaire } from "@/components/ui/action-primaire";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SelecteurRecherche } from "@/components/ui/selecteur-recherche";
import { agencesProposables } from "@/lib/agences/proposables";
import { obtenirSession } from "@/lib/auth/session";
import { lireClient } from "@/lib/clients/depot";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { ZONES_GEOGRAPHIQUES } from "@/lib/sites/zones";

import {
  libelleNouveauSite,
  libelleRattachement,
  libelleRetourSites,
} from "../presentation";

export const metadata: Metadata = { title: libelleNouveauSite() };

/**
 * LA CRÉATION D'UN LIEU D'INTERVENTION (L3-16, D75).
 *
 * ## DEUX CHAMPS SANS VALEUR PAR DÉFAUT, ET C'EST LA SAISIE QUI L'EXIGE
 *
 * Le client et le **rattachement** sont obligatoires, et `saisie.ts` écrit
 * pourquoi : *« il n'existe aucune valeur par défaut qui ne soit pas un
 * mensonge — la choisir pour l'utilisateur reviendrait à décider d'où part le
 * temps de trajet »* (D56). Les deux listes déroulantes n'ont donc **aucune
 * option présélectionnée**.
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

  // AGENCE-ACTIVE (9AY-AA-1) : une agence inactive ne se propose plus pour
  // un site NEUF — il n'y a encore aucun rattachement à garder ici, à la
  // différence de `/sites/[id]`.
  const agences = await avecContexteApplicatif(session.contexte, (tx) =>
    agencesProposables(tx),
  );

  // LA SAISIE GARDÉE APRÈS UN REFUS (9BR-TP-A4b-MESSAGES, CS42) — ce que
  // `versLeFormulaire` (`app/api/sites/creer/formulaire.ts`) reporte dans
  // l'URL. Un paramètre absent retombe sur le champ vide, comme avant.
  const valeur = (nom: string): string =>
    typeof params[nom] === "string" ? params[nom] : "";

  return (
    <Page
      chemin="/sites"
      titre={libelleNouveauSite()}
      actions={
        <Link href="/sites" className="text-app-encre-faible text-13 font-bold">
          {libelleRetourSites()}
        </Link>
      }
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          data-motif={motif}
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-13 font-bold"
        >
          {t(motif)}
        </p>
      ) : null}

      <form
        method="post"
        action="/api/sites/creer"
        className="bg-app-surface border-app-bord flex flex-col gap-4 rounded-lg border px-4 py-4"
      >
        {/* LE RATTACHEMENT N'A AUCUNE OPTION PRÉSÉLECTIONNÉE — voir l'entête,
            c'est D56. Le CLIENT, lui, PEUT l'être depuis FICHE-360-1/LIENS-1
            (`?client=`) : ce n'est pas le champ que D56 protège — prérempli
            depuis la fiche client, il ne décide de rien sur le trajet. */}
        <SelecteurRecherche
          nom="client_id"
          url="/api/recherche/clients"
          libelle={t("site.client")}
          libelleAucunResultat={t("selecteur.aucun_resultat")}
          libelleVoirPlus={t("selecteur.voir_plus")}
          obligatoire
          valeurInitiale={
            clientInitial === null
              ? undefined
              : { id: clientInitial.id, libelle: clientInitial.raison_sociale }
          }
        />

        <label className="flex flex-col gap-1 text-13 font-bold">
          {libelleRattachement()}
          <select
            name="agence_id"
            required
            defaultValue={valeur("agence_id")}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
          >
            <option value="" disabled />
            <OptionsAgence agences={agences} />
          </select>
        </label>

        <label className="flex flex-col gap-1 text-13 font-bold">
          {t("site.libelle")}
          <input
            name="libelle"
            required
            defaultValue={valeur("libelle")}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
          />
        </label>

        <label className="flex flex-col gap-1 text-13 font-bold">
          {t("site.commune")}
          <input
            name="commune"
            defaultValue={valeur("commune")}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
          />
        </label>

        <label className="flex flex-col gap-1 text-13 font-bold">
          {t("site.zone_geo")}
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
          {t("site.temps_trajet_min")}
          <input
            name="temps_trajet_min"
            defaultValue={valeur("temps_trajet_min")}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
          />
          <span className="text-app-encre-faible text-12 font-bold">
            {t("site.temps_trajet_min.aide")}
          </span>
        </label>

        <div>
          <ActionPrimaire>{t("sites.action.creer")}</ActionPrimaire>
        </div>
      </form>
    </Page>
  );
}
