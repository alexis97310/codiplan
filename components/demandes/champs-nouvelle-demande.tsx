"use client";

import { useEffect, useState } from "react";

import { Choix } from "@/components/ui/choix";
import {
  SelecteurRecherche,
  type OptionRecherche,
} from "@/components/ui/selecteur-recherche";

/**
 * LES CHAMPS DU VOLET « NOUVELLE DEMANDE » (D188, partie 2 ; M:3183-3186).
 *
 * ## Pourquoi un composant client minimal plutôt que `ChampSiteEtMachines`
 *
 * `components/interventions/site-et-machines.tsx` porte la colonne de
 * contexte, le contact, la présélection d'une création LIÉE à une demande ou
 * un site : tout un territoire d'un autre lot (9EP/9EQ). Ce volet-ci n'a que
 * QUATRE champs (Source, Client, Site, Machine) et JAMAIS de présélection —
 * une demande se dépose toujours à vide. Reprendre ce composant aurait
 * importé un territoire interdit pour un besoin plus étroit ; la cascade
 * client → site → machine, elle, suit le MÊME patron (`SelecteurRecherche`,
 * puis `/api/recherche/site/[id]` une fois le site choisi).
 *
 * ## CE QU'IL NE FAIT TOUJOURS PAS
 *
 * Aucune présélection de la MACHINE : une demande créée ici n'a jamais de
 * contexte à reprendre, à la différence d'une intervention née d'une fiche.
 * Seuls `source` et `description` se resoumettent après un refus
 * (`champsResoumis` de la route) — machine est à ressaisir, écart nommé par
 * D188.
 *
 * ## CE QUI A CHANGÉ (défaut mesuré en ligne par Alexis le 21/10/2026,
 * 9G8-TERRAIN-CONFIRMATIONS-ET-ACCES)
 *
 * **Le SITE, lui, SE présélectionne désormais quand le client choisi n'en a
 * qu'UN** — mesuré : il fallait le retaper alors qu'aucun autre choix
 * n'existait. Ce n'est plus l'écart que D188 nommait pour le site ; il reste
 * entier pour la machine, ci-dessus. La présélection s'efface d'elle-même
 * dès que le client change ou qu'il en porte plusieurs (`siteUnique` suit
 * `clientId`, jamais mémorisé au-delà).
 */

type OptionSite = OptionRecherche;

export function ChampsNouvelleDemande({
  legendeSource,
  optionsSource,
  sourceInitiale,
  libelleClient,
  libelleSite,
  libelleMachine,
  libelleDescription,
  descriptionInitiale,
  aideClientManquant,
  libelleAucunResultat,
  libelleVoirPlus,
  libelleChoisirSiteDabord,
  texteSansMachine,
}: Readonly<{
  legendeSource: string;
  optionsSource: readonly {
    readonly valeur: string;
    readonly libelle: string;
  }[];
  sourceInitiale?: string;
  libelleClient: string;
  libelleSite: string;
  libelleMachine: string;
  libelleDescription: string;
  descriptionInitiale?: string;
  /** L'aide sous le champ Site, tant qu'aucun client n'est choisi. */
  aideClientManquant: string;
  libelleAucunResultat: string;
  libelleVoirPlus: string;
  libelleChoisirSiteDabord: string;
  texteSansMachine: string;
}>) {
  const [clientId, setClientId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [siteUnique, setSiteUnique] = useState<OptionSite | null>(null);
  const [machines, setMachines] = useState<readonly OptionRecherche[]>([]);

  // LE SITE UNIQUE D'UN CLIENT SE PRÉSÉLECTIONNE (défaut mesuré en ligne par
  // Alexis le 21/10/2026, 9G8-TERRAIN-CONFIRMATIONS-ET-ACCES) — s'efface dès
  // que le client change ou qu'il en porte plusieurs (ou zéro).
  useEffect(() => {
    if (clientId === "") {
      setSiteUnique(null);
      return;
    }
    let annule = false;
    fetch(`/api/recherche/sites?client=${clientId}`, {
      headers: { accept: "application/json" },
    })
      .then((reponse) => (reponse.ok ? reponse.json() : null))
      .then(
        (corps: { resultats: readonly OptionSite[]; total: number } | null) => {
          if (annule || corps === null) {
            return;
          }
          if (corps.total === 1 && corps.resultats.length === 1) {
            setSiteUnique(corps.resultats[0]);
            setSiteId(corps.resultats[0].id);
          } else {
            setSiteUnique(null);
          }
        },
      )
      .catch(() => {
        // La coupure réseau laisse le champ vide, à ressaisir — même
        // discipline que les machines ci-dessous.
      });
    return () => {
      annule = true;
    };
  }, [clientId]);

  useEffect(() => {
    if (siteId === "") {
      setMachines([]);
      return;
    }
    let annule = false;
    fetch(`/api/recherche/site/${siteId}`, {
      headers: { accept: "application/json" },
    })
      .then((reponse) => (reponse.ok ? reponse.json() : null))
      .then((corps: { machines: OptionRecherche[] } | null) => {
        if (!annule && corps !== null) {
          setMachines(corps.machines);
        }
      })
      .catch(() => {
        // La coupure réseau laisse la liste vide plutôt que de bloquer le
        // volet — même discipline que `ChampSiteEtMachines`.
      });
    return () => {
      annule = true;
    };
  }, [siteId]);

  return (
    <>
      <Choix
        nom="source"
        legende={legendeSource}
        options={optionsSource}
        valeurInitiale={sourceInitiale}
        obligatoire
      />
      <SelecteurRecherche<OptionRecherche>
        nom="client_id"
        url="/api/recherche/clients"
        libelle={libelleClient}
        libelleAucunResultat={libelleAucunResultat}
        libelleVoirPlus={libelleVoirPlus}
        obligatoire
        onChoix={(option) => {
          setClientId(option?.id ?? "");
          setSiteId("");
        }}
      />
      <SelecteurRecherche<OptionSite>
        key={`${clientId}:${siteUnique?.id ?? ""}`}
        nom="site_id"
        url="/api/recherche/sites"
        parametres={clientId === "" ? undefined : { client: clientId }}
        libelle={libelleSite}
        libelleAucunResultat={libelleAucunResultat}
        libelleVoirPlus={libelleVoirPlus}
        obligatoire
        disabled={clientId === ""}
        aide={clientId === "" ? aideClientManquant : undefined}
        valeurInitiale={siteUnique ?? undefined}
        onChoix={(option) => setSiteId(option?.id ?? "")}
      />
      <label className="flex flex-col gap-1 text-13 font-bold">
        {libelleMachine}
        <select
          name="machine_id"
          disabled={siteId === ""}
          defaultValue=""
          className="border-app-bord bg-app-surface rounded-md border px-3 py-1.5 text-[13px] font-bold disabled:opacity-50"
        >
          <option value="">
            {siteId === "" ? libelleChoisirSiteDabord : texteSansMachine}
          </option>
          {machines.map((machine) => (
            <option key={machine.id} value={machine.id}>
              {machine.libelle}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-13 font-bold">
        {libelleDescription}
        <textarea
          name="description"
          required
          minLength={1}
          maxLength={4000}
          rows={4}
          defaultValue={descriptionInitiale}
          className="border-app-bord bg-app-surface rounded-md border px-3 py-1.5 text-[13px] font-bold"
        />
      </label>
    </>
  );
}
