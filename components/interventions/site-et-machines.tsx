"use client";

import { useState } from "react";

/**
 * LE SITE ET SES MACHINES — un composant CLIENT qui filtre localement
 * (chantier INT-MACHINE 2.1, 20/09/2026).
 *
 * ## Pourquoi un composant client, et pourquoi il ne reçoit que des DONNÉES
 *
 * Le site est choisi dans un `<select>` AVANT la soumission du formulaire,
 * sans rechargement serveur entre les deux : la liste des machines proposées
 * doit donc se filtrer DANS LE NAVIGATEUR, au moment où le site change. C'est
 * la seule raison de sortir du serveur ici — le reste de l'écran de création
 * (`app/(back-office)/interventions/nouvelle/page.tsx`) reste un composant
 * serveur ordinaire.
 *
 * **Il ne reçoit que des tableaux sérialisables — `sites`, `machines` — et
 * des chaînes déjà traduites.** *Jamais une fonction* : une page SERVEUR qui
 * passerait une fonction à un composant `"use client"` rend un écran mort dès
 * sa livraison — sans que le typecheck, le build, les tests unitaires ni le
 * contrôle d'atteignabilité ne le voient (mesuré sur #266). Les libellés qui
 * s'affichent ici sont donc composés PAR L'APPELANT, avec `t()`, avant d'être
 * transmis comme de simples chaînes.
 *
 * ## Ce qu'il filtre, et ce qu'il ne décide pas
 *
 * Une machine d'un AUTRE site n'est jamais proposée — la liste ne montre que
 * les machines du site choisi, jamais le parc entier (arbitrage par défaut de
 * ce lot, voir la description de la PR). Le choix reste facultatif : aucune
 * machine sélectionnée est le cas ordinaire à la création (dépannage à
 * l'aveugle, voir `schemaCreation`), et ce composant ne rend `required` sur
 * rien.
 */

export type SiteOption = {
  readonly id: string;
  readonly clientId: string;
  readonly libelle: string;
};

export type MachineOption = {
  readonly id: string;
  readonly siteId: string;
  readonly libelle: string;
};

export function ChampSiteEtMachines({
  sites,
  machines,
  libelleSite,
  libelleMachines,
  texteAucuneMachine,
  siteInitial,
  machineIdsInitiales = [],
}: Readonly<{
  sites: readonly SiteOption[];
  machines: readonly MachineOption[];
  libelleSite: string;
  libelleMachines: string;
  texteAucuneMachine: string;
  /**
   * LE SITE PRÉSÉLECTIONNÉ (LIENS-1, « + Intervention » depuis une fiche
   * machine). Déjà validé par l'appelant serveur contre `sites` — ce
   * composant ne revérifie rien, il retombe sur le premier site si la valeur
   * ne s'y trouve pas.
   */
  siteInitial?: string;
  /** Les machines déjà cochées — validées de la même façon que `siteInitial`. */
  machineIdsInitiales?: readonly string[];
}>) {
  const [siteId, setSiteId] = useState<string>(
    siteInitial ?? sites[0]?.id ?? "",
  );
  const siteChoisi = sites.find((site) => site.id === siteId) ?? sites[0];
  const machinesDuSite = machines.filter((m) => m.siteId === siteId);

  return (
    <>
      <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold">
        {libelleSite}
        <select
          name="site"
          required
          value={
            siteChoisi === undefined
              ? ""
              : `${siteChoisi.clientId}:${siteChoisi.id}`
          }
          onChange={(evenement) => {
            const [, id] = evenement.target.value.split(":");
            setSiteId(id ?? "");
          }}
          className="border-app-bord bg-app-surface rounded-md border px-3 py-2 text-[13px] font-normal"
        >
          {sites.map((site) => (
            <option key={site.id} value={`${site.clientId}:${site.id}`}>
              {site.libelle}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {libelleMachines}
        <select
          name="machine_ids"
          multiple
          size={Math.min(5, Math.max(3, machinesDuSite.length))}
          defaultValue={[...machineIdsInitiales]}
          className="border-input bg-background rounded-md border px-3 py-2 font-normal"
        >
          {machinesDuSite.map((machine) => (
            <option key={machine.id} value={machine.id}>
              {machine.libelle}
            </option>
          ))}
        </select>
      </label>
      {machinesDuSite.length === 0 ? (
        <p className="text-app-encre-faible -mt-2 text-[11.5px]">
          {texteAucuneMachine}
        </p>
      ) : null}
    </>
  );
}
