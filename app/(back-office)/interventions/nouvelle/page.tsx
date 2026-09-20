import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { Button } from "@/components/ui/button";
import {
  ChampSiteEtMachines,
  type MachineOption,
  type SiteOption,
} from "@/components/interventions/site-et-machines";
import { annuaireDesPersonnes } from "@/lib/auth/annuaire";
import { obtenirSession } from "@/lib/auth/session";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import { quiTravaille } from "@/lib/interventions/personnes";
import {
  PRIORITES,
  TYPES_INTERVENTION,
  MODES_VALORISATION,
} from "@/lib/interventions/saisie";
import { machinesDesSites } from "@/lib/machines/depot";

/**
 * CRÉER UNE INTERVENTION DEPUIS LE PLANNING (lot 2, D84).
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
  const motif = (await searchParams).motif;

  const lieux = await avecContexteApplicatif(session.contexte, (tx) =>
    tx.site.findMany({
      select: {
        id: true,
        libelle: true,
        client_id: true,
        client: { select: { raison_sociale: true } },
      },
      orderBy: { libelle: "asc" },
      take: 200,
    }),
  );
  // LES MACHINES DES SITES PROPOSÉS (chantier INT-MACHINE 2.1) — bornées aux
  // sites déjà lus ci-dessus, jamais le parc entier : le composant client ne
  // filtre QUE dans ce qu'il reçoit.
  const machines = await machinesDesSites(
    session.contexte,
    lieux.map((lieu) => lieu.id),
  );
  // LES TECHNICIENS PROPOSABLES (chantier TECH-1) — actifs seulement : un
  // technicien qui a quitté l'entreprise ne s'affecte pas à une intervention
  // qui n'existe pas encore (voir la note de tête sur la nouvelle saisie).
  const { techniciens, annuaire } = await avecContexteApplicatif(
    session.contexte,
    async (tx) => {
      const techniciensActifs = await tx.technicien.findMany({
        where: { actif: true },
        select: { utilisateur_id: true },
        orderBy: { utilisateur_id: "asc" },
      });
      return {
        techniciens: techniciensActifs,
        annuaire: await annuaireDesPersonnes(
          tx,
          techniciensActifs.map((technicien) => technicien.utilisateur_id),
        ),
      };
    },
  );

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
          libelleSite={mot("site")}
          libelleMachines={t("intervention.machine")}
          texteAucuneMachine={t("intervention.machine.aucune_au_site")}
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

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("intervention.date")}
          <input
            name="date_planifiee"
            type="date"
            className="border-input bg-background rounded-md border px-3 py-2 font-normal"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("intervention.technicien")}
          <select
            name="technicien_id"
            defaultValue=""
            className="border-input bg-background rounded-md border px-3 py-2 font-normal"
          >
            <option value="">{t("intervention.aucun_technicien")}</option>
            {techniciens.map((technicien) => (
              <option
                key={technicien.utilisateur_id}
                value={technicien.utilisateur_id}
              >
                {quiTravaille(technicien.utilisateur_id, annuaire)}
              </option>
            ))}
          </select>
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
