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
 * ce lot, voir la description de la PR). **Au plus une** depuis PARCOURS-1
 * (23/09/2026, arbitrage Alexis : « une intervention ne peut pas avoir 2
 * machines ») — un `<select>` simple, sans `multiple`. Le choix reste
 * facultatif : aucune machine sélectionnée est le cas ordinaire à la création
 * (dépannage à l'aveugle, voir `schemaCreation`).
 *
 * **LE CONTACT SUR PLACE (PARCOURS-1) SUIT LA MÊME LOGIQUE QUE LA MACHINE** —
 * c'est pour cela qu'il vit ici plutôt que dans un composant séparé : filtrer
 * par site choisi exige le même état `siteId`, tenu côté client, et un second
 * composant le dupliquerait (§9, 01/09). Un contact du CLIENT (`site_id`
 * nul) reste proposé quel que soit le site choisi ; un contact d'un AUTRE
 * site du même client ne l'est pas.
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

export type ContactOption = {
  readonly id: string;
  readonly clientId: string;
  /** `null` = contact du client, proposé quel que soit le site choisi. */
  readonly siteId: string | null;
  readonly libelle: string;
};

export function ChampSiteEtMachines({
  sites,
  machines,
  contacts = [],
  libelleSite,
  libelleMachines,
  texteAucuneMachine,
  libelleAucuneMachineChoisie,
  libelleContact,
  libelleAucunContact,
  siteInitial,
  machineIdsInitiales = [],
}: Readonly<{
  sites: readonly SiteOption[];
  machines: readonly MachineOption[];
  contacts?: readonly ContactOption[];
  libelleSite: string;
  libelleMachines: string;
  texteAucuneMachine: string;
  /** L'option vide du sélecteur — « on n'en choisit aucune », pas « il n'y en a pas ». */
  libelleAucuneMachineChoisie: string;
  /** Absent = pas de champ contact (ce lot ne s'en sert que d'un formulaire). */
  libelleContact?: string;
  libelleAucunContact?: string;
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
  const contactsDuLieu = contacts.filter(
    (c) =>
      c.clientId === siteChoisi?.clientId &&
      (c.siteId === null || c.siteId === siteId),
  );

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
        {/*
          UN SEUL `<select>`, PLUS `multiple` (PARCOURS-1) — le champ reste
          nommé `machine_ids` : `FormData.getAll` y trouve zéro ou un
          identifiant, exactement ce que `schemaCreation.machine_ids`
          attend. L'option vide, en tête, est le cas ordinaire (dépannage à
          l'aveugle).
        */}
        <select
          name="machine_ids"
          defaultValue={machineIdsInitiales[0] ?? ""}
          className="border-input bg-background rounded-md border px-3 py-2 font-normal"
        >
          <option value="">{libelleAucuneMachineChoisie}</option>
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

      {libelleContact === undefined ? null : (
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {libelleContact}
          <select
            name="contact_id"
            defaultValue=""
            className="border-input bg-background rounded-md border px-3 py-2 font-normal"
          >
            <option value="">{libelleAucunContact}</option>
            {contactsDuLieu.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.libelle}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  );
}
