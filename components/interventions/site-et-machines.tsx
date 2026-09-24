"use client";

import { useEffect, useState } from "react";

import {
  SelecteurRecherche,
  type OptionRecherche,
} from "@/components/ui/selecteur-recherche";

/**
 * LE SITE ET SES MACHINES — un composant CLIENT qui cherche le site sur le
 * SERVEUR, et charge ses machines et ses contacts une fois qu'il est choisi
 * (SELECTEURS-1, 24/09/2026 ; chantier INT-MACHINE 2.1, 20/09/2026).
 *
 * ## Ce que SELECTEURS-1 change ici
 *
 * `app/(back-office)/interventions/nouvelle/page.tsx` lisait AVANT ce lot
 * `tx.site.findMany({ ..., take: 200 })`, puis les machines et les contacts de
 * TOUS ces sites d'un coup — le 201e site ne pouvait recevoir aucune
 * intervention (SAV-08). Le site se cherche maintenant par
 * `SelecteurRecherche` (`/api/recherche/sites`, `clientActif=1` — RG-PLA-08),
 * et ses machines/contacts sont lus par `/api/recherche/site/[id]` UNE FOIS
 * le site choisi — jamais le parc ni le carnet de contacts entiers.
 *
 * ## Il ne reçoit toujours que des données et des chaînes déjà traduites
 *
 * *Jamais une fonction* transmise par une page SERVEUR (panne #266). Les deux
 * routes qu'il appelle sont nommées par leur URL, pas par une fonction reçue.
 *
 * ## Ce qu'il filtre, et ce qu'il ne décide pas
 *
 * **Au plus une machine** (PARCOURS-1, 23/09/2026) — un `<select>` simple,
 * sans `multiple`. Le choix reste facultatif. Les machines et les contacts
 * restent des `<select>` ORDINAIRES : ils sont bornés à UN site, jamais au
 * référentiel entier — ce n'est pas le problème que ce lot répare.
 */

/** Un site, tel que `/api/recherche/sites` le rend — avec son client. */
type OptionSite = OptionRecherche & { readonly clientId: string };

type OptionAuSite = {
  readonly machines: readonly OptionRecherche[];
  readonly contacts: readonly OptionRecherche[];
};

const VIDE: OptionAuSite = { machines: [], contacts: [] };

export function ChampSiteEtMachines({
  libelleSite,
  libelleMachines,
  texteAucuneMachine,
  libelleAucuneMachineChoisie,
  libelleContact,
  libelleAucunContact,
  libelleAucunResultatSite,
  libelleVoirPlusSite,
  siteInitial,
  machineIdInitiale,
}: Readonly<{
  libelleSite: string;
  libelleMachines: string;
  texteAucuneMachine: string;
  libelleAucuneMachineChoisie: string;
  /** Absent = pas de champ contact (ce lot ne s'en sert que d'un formulaire). */
  libelleContact?: string;
  libelleAucunContact?: string;
  libelleAucunResultatSite: string;
  libelleVoirPlusSite: string;
  /**
   * LE SITE PRÉSÉLECTIONNÉ (LIENS-1, « + Intervention » depuis une fiche
   * machine). Déjà validé par l'appelant serveur.
   */
  siteInitial?: OptionSite;
  /** La machine déjà cochée — validée de la même façon que `siteInitial`. */
  machineIdInitiale?: string;
}>) {
  const [siteId, setSiteId] = useState<string>(siteInitial?.id ?? "");
  const [auSite, setAuSite] = useState<OptionAuSite>(VIDE);
  const [machineChoisie, setMachineChoisie] = useState<string>("");

  useEffect(() => {
    if (siteId === "") {
      setAuSite(VIDE);
      return;
    }
    let annule = false;
    fetch(`/api/recherche/site/${siteId}`, {
      headers: { accept: "application/json" },
    })
      .then((reponse) => (reponse.ok ? reponse.json() : null))
      .then((corps: OptionAuSite | null) => {
        if (!annule && corps !== null) {
          setAuSite(corps);
        }
      })
      .catch(() => {
        // La coupure réseau laisse la liste vide plutôt que de faire
        // échouer tout l'écran : le terrain n'est pas concerné ici (I4 ne
        // porte que sur l'application technicien), mais un back-office sans
        // réseau ne doit pas se retrouver bloqué sur une page blanche.
      });
    return () => {
      annule = true;
    };
  }, [siteId]);

  useEffect(() => {
    setMachineChoisie((precedente) => {
      if (auSite.machines.some((machine) => machine.id === precedente)) {
        return precedente;
      }
      // La présélection ne vaut QUE pour le site présélectionné lui-même —
      // un changement vers un AUTRE site ne doit jamais la rouvrir.
      if (
        siteId !== "" &&
        siteId === siteInitial?.id &&
        machineIdInitiale !== undefined &&
        auSite.machines.some((machine) => machine.id === machineIdInitiale)
      ) {
        return machineIdInitiale;
      }
      return "";
    });
  }, [auSite, siteId, siteInitial, machineIdInitiale]);

  return (
    <>
      <SelecteurRecherche<OptionSite>
        nom="site"
        url="/api/recherche/sites"
        parametres={{ clientActif: "1" }}
        libelle={libelleSite}
        libelleAucunResultat={libelleAucunResultatSite}
        libelleVoirPlus={libelleVoirPlusSite}
        obligatoire
        valeurInitiale={siteInitial}
        versValeurChamp={(option) => `${option.clientId}:${option.id}`}
        onChoix={(option) => setSiteId(option?.id ?? "")}
      />

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
          value={machineChoisie}
          onChange={(evenement) => setMachineChoisie(evenement.target.value)}
          className="border-input bg-background rounded-md border px-3 py-2 font-normal"
        >
          <option value="">{libelleAucuneMachineChoisie}</option>
          {auSite.machines.map((machine) => (
            <option key={machine.id} value={machine.id}>
              {machine.libelle}
            </option>
          ))}
        </select>
      </label>
      {siteId !== "" && auSite.machines.length === 0 ? (
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
            {auSite.contacts.map((contact) => (
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
