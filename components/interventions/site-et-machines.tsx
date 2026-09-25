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
 *
 * ## CE QUE 92-CREATION-2 AJOUTE (audit d'ergonomie du 25/09/2026)
 *
 * Machine et Contact étaient déjà bornés à UN site (paragraphe ci-dessus),
 * mais rien ne le disait avant qu'un site soit choisi : les deux affichaient
 * « Aucune machine »/« Aucun contact », qu'on lise cette phrase comme « ce
 * lieu n'en a pas » ou comme « choisissez d'abord un lieu ». Les deux
 * `<select>` sont désormais désactivés tant que `siteId === ""`, avec la
 * mention `libelleChoisirSiteDabord` à la place de l'option vide ordinaire.
 * Tous les libellés — dont celui-ci — arrivent déjà composés par l'appelant
 * SERVEUR (`app/(back-office)/interventions/presentation.ts`), jamais
 * assemblés ici : le mot imposé « site » ne s'écrit qu'à son unique endroit.
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
  aideSite,
  libelleChoisirSiteDabord,
  texteAgenceDeduite,
  siteInitial,
  machineIdInitiale,
  contactIdInitiale,
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
  /** L'aide sous le champ Site — ce qu'on peut y taper (92-CREATION-2). */
  aideSite: string;
  /**
   * L'OPTION VIDE DE MACHINE ET DE CONTACT TANT QU'AUCUN SITE N'EST CHOISI
   * (92-CREATION-2, constat 7) — remplace « Aucune machine »/« Aucun
   * contact », qui ne disaient pas pourquoi la liste était vide.
   */
  libelleChoisirSiteDabord: string;
  /** La note sous le champ Site — l'agence s'en déduit (92-CREATION-2). */
  texteAgenceDeduite: string;
  /**
   * LE SITE PRÉSÉLECTIONNÉ (LIENS-1, « + Intervention » depuis une fiche
   * machine). Déjà validé par l'appelant serveur.
   */
  siteInitial?: OptionSite;
  /** La machine déjà cochée — validée de la même façon que `siteInitial`. */
  machineIdInitiale?: string;
  /**
   * LE CONTACT DÉJÀ CHOISI (56-FORMULAIRES-2, retour après un refus de
   * saisie) — validé de la même façon que `machineIdInitiale` : appartenir au
   * SITE présélectionné, sinon ignoré.
   */
  contactIdInitiale?: string;
}>) {
  const [siteId, setSiteId] = useState<string>(siteInitial?.id ?? "");
  const [auSite, setAuSite] = useState<OptionAuSite>(VIDE);
  const [machineChoisie, setMachineChoisie] = useState<string>("");
  const [contactChoisi, setContactChoisi] = useState<string>("");

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

  useEffect(() => {
    setContactChoisi((precedent) => {
      if (auSite.contacts.some((contact) => contact.id === precedent)) {
        return precedent;
      }
      // Même garde que pour la machine : la présélection ne rejoue jamais
      // sur un site autre que celui pour lequel elle a été résolue.
      if (
        siteId !== "" &&
        siteId === siteInitial?.id &&
        contactIdInitiale !== undefined &&
        auSite.contacts.some((contact) => contact.id === contactIdInitiale)
      ) {
        return contactIdInitiale;
      }
      return "";
    });
  }, [auSite, siteId, siteInitial, contactIdInitiale]);

  return (
    <>
      <SelecteurRecherche<OptionSite>
        nom="site"
        url="/api/recherche/sites"
        parametres={{ clientActif: "1" }}
        libelle={libelleSite}
        aide={aideSite}
        libelleAucunResultat={libelleAucunResultatSite}
        libelleVoirPlus={libelleVoirPlusSite}
        obligatoire
        valeurInitiale={siteInitial}
        versValeurChamp={(option) => `${option.clientId}:${option.id}`}
        onChoix={(option) => setSiteId(option?.id ?? "")}
      />
      {/* LA NOTE VIT SOUS LE CHAMP QU'ELLE EXPLIQUE (92-CREATION-2, constat 8) —
          avant ce lot elle suivait tout `ChampSiteEtMachines`, donc en
          pratique sous Contact, sans lien visible avec le Site dont elle
          parle. */}
      <p className="text-app-encre-faible -mt-2 text-[11.5px]">
        {texteAgenceDeduite}
      </p>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {libelleMachines}
        {/*
          UN SEUL `<select>`, PLUS `multiple` (PARCOURS-1) — le champ reste
          nommé `machine_ids` : `FormData.getAll` y trouve zéro ou un
          identifiant, exactement ce que `schemaCreation.machine_ids`
          attend. L'option vide, en tête, est le cas ordinaire (dépannage à
          l'aveugle).

          DÉSACTIVÉ TANT QU'AUCUN SITE N'EST CHOISI (92-CREATION-2, constat 7)
          — la liste ne PEUT rien proposer avant, et le disait mal.
        */}
        <select
          name="machine_ids"
          value={machineChoisie}
          disabled={siteId === ""}
          onChange={(evenement) => setMachineChoisie(evenement.target.value)}
          className="border-input bg-background rounded-md border px-3 py-2 font-normal disabled:opacity-50"
        >
          <option value="">
            {siteId === ""
              ? libelleChoisirSiteDabord
              : libelleAucuneMachineChoisie}
          </option>
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
            value={contactChoisi}
            disabled={siteId === ""}
            onChange={(evenement) => setContactChoisi(evenement.target.value)}
            className="border-input bg-background rounded-md border px-3 py-2 font-normal disabled:opacity-50"
          >
            <option value="">
              {siteId === "" ? libelleChoisirSiteDabord : libelleAucunContact}
            </option>
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
