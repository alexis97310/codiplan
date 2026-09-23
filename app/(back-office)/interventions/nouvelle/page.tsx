import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { Button } from "@/components/ui/button";
import {
  ChampSiteEtMachines,
  type ContactOption,
  type MachineOption,
  type SiteOption,
} from "@/components/interventions/site-et-machines";
import { obtenirSession } from "@/lib/auth/session";
import { avecContexteApplicatif } from "@/lib/db/client";
import { contactsDuClient } from "@/lib/contacts/depot";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  PRIORITES,
  TYPES_INTERVENTION,
  MODES_VALORISATION,
} from "@/lib/interventions/saisie";
import { machinesDesSites } from "@/lib/machines/depot";
import { comparerAlphanumerique } from "@/lib/tri/collation";

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
  // fiche machine) — lus à côté de `motif`, jamais avant la lecture cloisonnée
  // de `lieux`/`machines` ci-dessous : la validation contre CE périmètre est
  // ce qui distingue un paramètre légitime d'un identifiant forgé.
  const siteParam = typeof params.site === "string" ? params.site : undefined;
  const machineParam =
    typeof params.machine === "string" ? params.machine : undefined;

  // LE SITE D'UN CLIENT INACTIF N'EST PAS PROPOSÉ ICI (RG-PLA-08, D129 ;
  // audité le 21/09/2026, lot SEMIS-2). *Mesuré en production* : la liste
  // montrait « Ancien client — Ancien chantier (démonstration, inactif) »,
  // alors que RG-PLA-08 masque déjà ce client du planning — une intervention
  // s'y créait donc sans jamais pouvoir apparaître nulle part. Même critère
  // que le planning applique sans aucune case pour le lever
  // (`filtreClientActif(false)`, `lib/interventions/depot.ts`) : `client:
  // { actif: true }`, jamais une seconde lecture de `client.actif` qui
  // diverge de la première en silence (§9, 01/09). Le SITE n'est pas
  // concerné — RG-PLA-08 ne tranche que sur le client, et un site inactif
  // d'un client actif reste proposé.
  const lieuxBruts = await avecContexteApplicatif(session.contexte, (tx) =>
    tx.site.findMany({
      where: { client: { actif: true } },
      select: {
        id: true,
        libelle: true,
        client_id: true,
        client: { select: { raison_sociale: true } },
      },
      take: 200,
    }),
  );
  // TRIÉE ET GROUPÉE PAR CLIENT (LISTES-1, 23/09/2026) — la sélection
  // déroulante mesurée en production (139 lignes, « non triée de façon
  // cohérente ») se lisait par le libellé du SITE seul, si bien que deux
  // sites du même client n'étaient jamais voisins dans la liste. Le tri par
  // client d'abord — `lib/tri/collation.ts`, insensible à la casse et aux
  // accents — les rend contigus ; le libellé complet (« CLIENT — site »,
  // `libelleDuLieu` ci-dessous) porte déjà le nom du client, si bien que ce
  // regroupement se lit sans `<optgroup>`. Un tri EN JAVASCRIPT et non un
  // second `ORDER BY` : la liste est déjà bornée à 200 lignes, une seule
  // lecture, donc aucun coût de pagination à préserver (voir la note de
  // `lib/sites/depot.ts` pour la raison de fond).
  const lieux = [...lieuxBruts].sort((a, b) => {
    const parClient = comparerAlphanumerique(
      a.client.raison_sociale,
      b.client.raison_sociale,
    );
    if (parClient !== 0) {
      return parClient;
    }
    const parSite = comparerAlphanumerique(a.libelle, b.libelle);
    return parSite !== 0 ? parSite : a.id.localeCompare(b.id);
  });
  // LES MACHINES DES SITES PROPOSÉS (chantier INT-MACHINE 2.1) — bornées aux
  // sites déjà lus ci-dessus, jamais le parc entier : le composant client ne
  // filtre QUE dans ce qu'il reçoit.
  const machines = await machinesDesSites(
    session.contexte,
    lieux.map((lieu) => lieu.id),
  );
  // LES CONTACTS DES CLIENTS PROPOSÉS (PARCOURS-1) — « contact sur place »,
  // facultatif. Un seul appel par CLIENT distinct (pas par site : un contact
  // sans site est un contact du client tout entier, `contactsDuClient` lit
  // déjà les deux) — les lieux répètent souvent le même client.
  const clientsDistincts = [...new Set(lieux.map((lieu) => lieu.client_id))];
  const contacts = (
    await Promise.all(
      clientsDistincts.map((clientId) =>
        contactsDuClient(session.contexte, clientId),
      ),
    )
  ).flat();

  // UN PARAMÈTRE QUI NE CORRESPOND À RIEN DE LISIBLE EST IGNORÉ EN SILENCE
  // (LIENS-1) — `lieux` et `machines` viennent d'être lus SOUS le contexte
  // cloisonné : un `site` hors périmètre ou inexistant n'y figure pas, et le
  // formulaire retombe alors sur son état par défaut (premier site, aucune
  // machine cochée), jamais sur un message d'erreur ni un identifiant hors
  // périmètre affiché.
  const siteInitial =
    siteParam !== undefined && lieux.some((lieu) => lieu.id === siteParam)
      ? siteParam
      : undefined;
  const machineIdsInitiales =
    machineParam !== undefined &&
    siteInitial !== undefined &&
    machines.some((m) => m.id === machineParam && m.siteId === siteInitial)
      ? [machineParam]
      : [];

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
        <ChampSiteEtMachines
          sites={lieux.map((lieu): SiteOption => ({
            id: lieu.id,
            clientId: lieu.client_id,
            libelle: libelleDuLieu(lieu),
          }))}
          machines={machines.map((machine): MachineOption => ({
            id: machine.id,
            siteId: machine.siteId,
            libelle: machine.libelle,
          }))}
          contacts={contacts.map((contact): ContactOption => ({
            id: contact.id,
            clientId: contact.client_id,
            siteId: contact.site_id,
            libelle: contact.nom,
          }))}
          libelleSite={mot("site")}
          libelleMachines={t("intervention.machine")}
          texteAucuneMachine={t("intervention.machine.aucune_au_site")}
          libelleAucuneMachineChoisie={t("intervention.machine.aucune_choisie")}
          libelleContact={t("intervention.contact_sur_place")}
          libelleAucunContact={t("intervention.aucun_contact")}
          siteInitial={siteInitial}
          machineIdsInitiales={machineIdsInitiales}
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

        <Button type="submit">{t("intervention.action.creer")}</Button>
      </form>
    </Page>
  );
}

/** Le lieu, nommé par son client puis par lui-même. */
function libelleDuLieu(lieu: {
  libelle: string;
  client: { raison_sociale: string };
}): string {
  return `${lieu.client.raison_sociale} — ${lieu.libelle}`;
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
