import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LienPrimaire } from "@/components/ui/action-primaire";
import { Badge } from "@/components/ui/badge";
import { Page } from "@/components/mise-en-page/page";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { peut } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import { lireFuseau } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { demandesOuvertes } from "@/lib/demandes/depot";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import { CLASSES_LIEN } from "@/lib/theme/apparence";

import {
  instantLisible,
  parLaPlusAncienne,
  tonDuStatutDemande,
} from "./presentation";

export const metadata: Metadata = { title: t("demande.titre") };

/**
 * LA FILE DE QUALIFICATION (DEMANDES-1, sur L2-06).
 *
 * ## Le constat qui ouvre ce ticket
 *
 * `lib/demandes/depot.ts` porte tout le cycle de vie d'une demande depuis le
 * 14/09/2026 (L2-06) — et zéro route, zéro écran ne l'appelait avant ce lot
 * (`docs/backlog.md`, ticket L2-06b). Le tableau de bord affichait un compteur
 * « demandes ouvertes » qui ne menait NULLE PART — un chiffre sans chemin, la
 * même faute que le zéro muet que ce dépôt corrige ailleurs (D125/D128). Cet
 * écran EST ce chemin.
 *
 * ## L'ORDRE — voir `parLaPlusAncienne`
 *
 * `demandesOuvertes` (le dépôt) ordonne par urgence puis par dépôt, pour SON
 * usage à elle (le tableau de bord). Une file d'attente répond à une autre
 * question, et l'ordre choisi ICI est écrit à côté de la fonction qui le pose.
 *
 * ## D123 — UN TABLEAU, JAMAIS DES CARTES
 *
 * `demande` est transactionnel — une file d'actions à traiter — et non un
 * référentiel qu'on consulte pour ce qu'il EST : le tableau dense de
 * `Tableau`, comme `/imports`, `/vgp`, `/parametres`, jamais `CarteEntite`,
 * réservée aux deux seuls écrans référentiels de la maquette (D123).
 *
 * ## LE CLOISONNEMENT N'EST PAS ÉCRIT ICI
 *
 * `demande` est de forme « parc » (D102) : `demandesOuvertes` lit SOUS le
 * contexte cloisonné, et un compte de portail n'y verrait que les siennes sans
 * qu'aucune ligne de cet écran le sache — mais aucun compte de portail
 * n'atteint cette route : le portail est hors périmètre de ce ticket (dépôt
 * exclu, D102 note déjà que la même lecture SERT le portail le jour où il
 * existe).
 *
 * ## L'ACCÈS DIRECT À LA CRÉATION (89-DEMANDES-3, 25/09/2026)
 *
 * « Créer une intervention », même style et même position qu'au registre
 * (`/interventions`) : `LienPrimaire` vers `/interventions/nouvelle`, gardé
 * par la MÊME capacité que les autres écrans qui posent ce lien
 * (`clients/[id]`, `sites/[id]`) — `creer_demande`, jamais une seconde
 * lecture du critère.
 */
export default async function PageDemandes({
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
  const contexte = session.contexte;
  const params = await searchParams;
  const motif = params.motif;
  const peutCreerIntervention =
    contexte.role !== null && peut(contexte.role, "creer_demande");

  const demandes = await demandesOuvertes(contexte);
  const file = parLaPlusAncienne(demandes);

  // LES LIBELLÉS DE CLIENT ET DE SITE, résolus en DEUX lectures groupées —
  // jamais une par ligne, qui multiplierait les requêtes par la taille de la
  // file (même discipline que `libellesDesMachines`).
  const clientIds = [...new Set(file.map((d) => d.client_id))];
  const siteIds = [...new Set(file.map((d) => d.site_id))];
  const [clients, sites, societe] = await Promise.all([
    clientIds.length === 0
      ? Promise.resolve([])
      : avecContexteApplicatif(contexte, (tx) =>
          tx.client.findMany({
            where: { id: { in: clientIds } },
            select: { id: true, raison_sociale: true },
          }),
        ),
    siteIds.length === 0
      ? Promise.resolve([])
      : avecContexteApplicatif(contexte, (tx) =>
          tx.site.findMany({
            where: { id: { in: siteIds } },
            select: { id: true, libelle: true },
          }),
        ),
    avecContexteApplicatif(contexte, (tx) =>
      tx.societe.findFirst({
        where: { id: contexte.societeId as string },
        select: { fuseau_horaire: true },
      }),
    ),
  ]);
  const fuseau = lireFuseau(societe?.fuseau_horaire);
  const raisonSocialeParClient = new Map(
    clients.map((c) => [c.id, c.raison_sociale]),
  );
  const libelleParSite = new Map(sites.map((s) => [s.id, s.libelle]));

  const colonnes = [
    { cle: "client", libelle: t("intervention.client") },
    { cle: "site", libelle: mot("site") },
    { cle: "urgence", libelle: t("demande.urgence"), largeur: "100px" },
    { cle: "description", libelle: t("demande.description") },
    { cle: "source", libelle: t("demande.source"), largeur: "160px" },
    {
      cle: "deposee",
      libelle: t("demande.colonne_deposee_le"),
      largeur: "150px",
    },
    { cle: "statut", libelle: t("demande.colonne_statut"), largeur: "120px" },
  ];

  return (
    <Page
      chemin="/demandes"
      titre={t("demande.titre")}
      sousTitre={t("demandes.sous_titre")}
      actions={
        peutCreerIntervention ? (
          <LienPrimaire href="/interventions/nouvelle">
            {t("planning.creer")}
          </LienPrimaire>
        ) : undefined
      }
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          data-motif={motif}
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(motif)}
        </p>
      ) : null}

      <section className="bg-app-surface border-app-bord rounded-lg border">
        <Tableau colonnes={colonnes} minimum="960px">
          {file.length === 0 ? (
            <LignePleine colonnes={colonnes.length}>
              {t("demandes.vide")}
            </LignePleine>
          ) : (
            file.map((demande) => (
              <tr key={demande.id} data-demande={demande.id}>
                <Cellule>
                  <Link
                    href={`/clients/${demande.client_id}`}
                    className={CLASSES_LIEN}
                  >
                    {raisonSocialeParClient.get(demande.client_id) ??
                      t("demande.sans_valeur")}
                  </Link>
                </Cellule>
                <Cellule>
                  <Link
                    href={`/sites/${demande.site_id}`}
                    className={CLASSES_LIEN}
                  >
                    {libelleParSite.get(demande.site_id) ??
                      t("demande.sans_valeur")}
                  </Link>
                </Cellule>
                <Cellule>{t(`priorite.${demande.urgence}`)}</Cellule>
                <Cellule>
                  <Link
                    href={`/demandes/${demande.id}`}
                    className={CLASSES_LIEN}
                  >
                    {demande.description}
                  </Link>
                </Cellule>
                <Cellule>{t(`demande.source.${demande.source}`)}</Cellule>
                <Cellule>{instantLisible(demande.depose_le, fuseau)}</Cellule>
                <Cellule>
                  <Badge ton={tonDuStatutDemande(demande.statut)}>
                    {t(`demande.statut.${demande.statut}`)}
                  </Badge>
                </Cellule>
              </tr>
            ))
          )}
        </Tableau>
      </section>
    </Page>
  );
}
