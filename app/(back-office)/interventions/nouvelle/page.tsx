import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { ChampSiteEtMachines } from "@/components/interventions/site-et-machines";
import { obtenirSession } from "@/lib/auth/session";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  PRIORITES,
  TYPES_INTERVENTION,
  MODES_VALORISATION,
} from "@/lib/interventions/saisie";
import { lireClient } from "@/lib/clients/depot";
import { machinesDesSites } from "@/lib/machines/depot";
import { lireSite } from "@/lib/sites/depot";
import { uuidv7 } from "@/lib/db/uuid";

import { BoutonCreer } from "./bouton-creer";

export const metadata: Metadata = { title: t("planning.creer") };

/**
 * CRÉER UNE DEMANDE D'INTERVENTION (lot 2, D84 ; PARCOURS-1, 23/09/2026,
 * arbitrage Alexis).
 *
 * ## Ce que l'écran ne demande PAS, et pourquoi il vaut mieux qu'il ne demande
 * pas
 *
 * **L'agence** et **le forfait de déplacement** ne sont pas des champs. Le lieu
 * d'intervention les détermine tous les deux — l'un par son rattachement (D56),
 * l'autre par sa zone (D23, RG-TAR-06). Les faire saisir donnerait à
 * l'utilisateur le pouvoir de contredire la donnée, et donnerait au dépôt deux
 * lectures d'un même critère.
 *
 * **NI LA DATE, NI LE TECHNICIEN, DEPUIS PARCOURS-1** — ni un et l'autre ne
 * sont plus des champs de CET écran : *« lors de la création d'intervention,
 * on ne peut pas décider ni de la date d'intervention, ni du technicien
 * affecté : il doit y avoir un ordre précis — Créer demande d'intervention →
 * Planifier et qualifier l'intervention. »* (Alexis, 23/09/2026) C'est la
 * fiche, une fois l'intervention créée, qui porte le geste PLANIFIER — les
 * deux, avec l'heure et la durée, ensemble.
 *
 * La liste des lieux est celle du périmètre de l'appelant : elle est lue SOUS
 * le contexte cloisonné, et un compte portail restreint n'y voit que les siens.
 *
 * ## LE SITE SE CHERCHE MAINTENANT SUR LE SERVEUR (SELECTEURS-1, 24/09/2026)
 *
 * Cet écran lisait AVANT ce lot `tx.site.findMany({ ..., take: 200 })` — le
 * 201e site ne pouvait recevoir aucune intervention (SAV-08) —, puis les
 * machines et les contacts de TOUS ces sites d'un coup. `ChampSiteEtMachines`
 * interroge maintenant `/api/recherche/sites` (`clientActif=1`, qui applique
 * RG-PLA-08) et `/api/recherche/site/[id]` UNE FOIS le site choisi. Cette
 * page ne lit plus que ce qu'il faut pour résoudre `?site=`/`?machine=`
 * (LIENS-1) — un site, jamais 200.
 *
 * ## L'`id` SE TIRE AU RENDU, PAS À LA RÉCEPTION (55-FORMULAIRES-1, SAV-02)
 *
 * Un `<input type="hidden">` porte désormais l'identifiant de l'intervention
 * à naître, tiré UNE FOIS quand la page se rend. Un double clic sur « Créer »
 * soumet donc deux fois LE MÊME `id` : la route (`/api/interventions/creer`)
 * le relit sous le contexte cloisonné avant d'écrire, et la seconde
 * soumission ne crée rien — elle redirige vers la fiche que la première a
 * déjà créée. `BoutonCreer` (local à cet écran) ajoute un filet visuel : le
 * bouton se désactive dès le premier clic.
 */
export default async function PageNouvelleIntervention({
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
  // LE SITE ET LA MACHINE PRÉREMPLIS (LIENS-1, « + Intervention » depuis une
  // fiche machine) — résolus SOUS le contexte cloisonné ci-dessous : la
  // validation contre CE périmètre est ce qui distingue un paramètre
  // légitime d'un identifiant forgé.
  const siteParam = typeof params.site === "string" ? params.site : undefined;
  const machineParam =
    typeof params.machine === "string" ? params.machine : undefined;

  // UN PARAMÈTRE QUI NE CORRESPOND À RIEN DE LISIBLE EST IGNORÉ EN SILENCE
  // (LIENS-1) — `lireSite` lit SOUS le contexte cloisonné : un site hors
  // périmètre ou inexistant rend `null`, et le formulaire retombe alors sur
  // son état vide, jamais sur un message d'erreur ni un identifiant hors
  // périmètre affiché.
  //
  // LE SITE D'UN CLIENT INACTIF N'EST PAS PROPOSÉ ICI (RG-PLA-08, D129) —
  // même critère qu'`app/api/recherche/sites/route.ts` avec `clientActif=1`,
  // posé une seule fois par `rechercherSites` (`lib/sites/depot.ts`) : `client:
  // { actif: true }`, jamais une seconde lecture qui diverge en silence
  // (§9, 01/09).
  const siteBrut =
    siteParam === undefined
      ? null
      : await lireSite(session.contexte, siteParam);
  const clientDuSite =
    siteBrut === null
      ? null
      : await lireClient(session.contexte, siteBrut.client_id);
  const siteInitial =
    siteBrut === null || clientDuSite === null || !clientDuSite.actif
      ? undefined
      : {
          id: siteBrut.id,
          libelle: `${clientDuSite.raison_sociale} — ${siteBrut.libelle}`,
          clientId: clientDuSite.id,
        };

  const machinesDuSiteInitial =
    siteInitial === undefined
      ? []
      : await machinesDesSites(session.contexte, [siteInitial.id]);
  const machineIdInitiale =
    machineParam !== undefined &&
    machinesDuSiteInitial.some((machine) => machine.id === machineParam)
      ? machineParam
      : undefined;

  // TIRÉ ICI, UNE SEULE FOIS PAR RENDU (55-FORMULAIRES-1) — la route relit cet
  // `id` sous le contexte cloisonné avant d'écrire : un double clic soumet
  // deux fois le même formulaire, donc deux fois le même `id`, et la seconde
  // soumission ne crée rien.
  const idIntervention = uuidv7();

  return (
    <Page
      chemin="/interventions/nouvelle"
      titre={t("planning.creer")}
      actions={
        <Link href="/planning" className="text-app-encre-faible text-[12.5px]">
          {t("planning.retour_fleche")}
        </Link>
      }
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(motif)}
        </p>
      ) : null}

      {/*
        LA SAISIE RESTE ÉTROITE, ET C'EST UNE DÉCISION (R2-08).

        *Un formulaire à champs pleine largeur sur 1360 px est plus difficile à
        remplir qu'un formulaire étroit* : l'œil parcourt la ligne entière entre
        l'étiquette et le champ. La largeur utile est celle de l'ÉCRAN ; celle
        d'un formulaire est celle de sa colonne. Le cadre est donc borné ici,
        sous le titre qui, lui, occupe la page.
      */}
      <form
        action="/api/interventions/creer"
        method="post"
        className="bg-app-surface border-app-bord flex max-w-[640px] flex-col gap-4 rounded-lg border px-4 py-4"
      >
        <input type="hidden" name="id" value={idIntervention} />
        <ChampSiteEtMachines
          libelleSite={mot("site")}
          libelleMachines={t("intervention.machine")}
          texteAucuneMachine={t("intervention.machine.aucune_au_site")}
          libelleAucuneMachineChoisie={t("intervention.machine.aucune_choisie")}
          libelleContact={t("intervention.contact_sur_place")}
          libelleAucunContact={t("intervention.aucun_contact")}
          libelleAucunResultatSite={t("selecteur.aucun_resultat")}
          libelleVoirPlusSite={t("selecteur.voir_plus")}
          siteInitial={siteInitial}
          machineIdInitiale={machineIdInitiale}
        />
        <p className="text-app-encre-faible -mt-2 text-[11.5px]">
          {t("intervention.deduit_du_lieu")}
        </p>

        <Choix
          nom="type"
          libelle={t("intervention.type")}
          valeurs={TYPES_INTERVENTION}
          prefixe="type_intervention"
        />
        <Choix
          nom="priorite"
          libelle={t("intervention.priorite")}
          valeurs={PRIORITES}
          prefixe="priorite"
          defaut="p3"
        />
        <Choix
          nom="mode_valorisation"
          libelle={t("intervention.mode_valorisation")}
          valeurs={MODES_VALORISATION}
          prefixe="mode_valorisation"
          defaut="temps_passe"
        />

        {/*
          LA PANNE SIGNALÉE / LE TRAVAIL DEMANDÉ — OBLIGATOIRE (PARCOURS-1).
          *Ni la date ni le technicien ne sont plus des champs de cet écran* :
          voir la note de tête. Le geste PLANIFIER, sur la fiche, les pose
          ensuite, tous les quatre ensemble.
        */}
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("intervention.panne_signalee")}
          <textarea
            name="description"
            required
            rows={4}
            className="border-input bg-background rounded-md border px-3 py-2 font-normal"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("intervention.reference_client")}
          <input
            name="reference_client"
            type="text"
            className="border-input bg-background rounded-md border px-3 py-2 font-normal"
          />
        </label>

        <BoutonCreer>{t("intervention.action.creer")}</BoutonCreer>
      </form>
    </Page>
  );
}

function Choix({
  nom,
  libelle,
  valeurs,
  prefixe,
  defaut,
}: {
  nom: string;
  libelle: string;
  valeurs: readonly string[];
  prefixe: string;
  defaut?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {libelle}
      <select
        name={nom}
        defaultValue={defaut}
        className="border-input bg-background rounded-md border px-3 py-2 font-normal"
      >
        {valeurs.map((valeur) => {
          const cle = `${prefixe}.${valeur}`;
          return (
            <option key={valeur} value={valeur}>
              {estCleTraduction(cle) ? t(cle) : valeur}
            </option>
          );
        })}
      </select>
    </label>
  );
}
