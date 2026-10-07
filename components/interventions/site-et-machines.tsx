"use client";

import { useEffect, useState } from "react";

import { Choix } from "@/components/ui/choix";
import { SectionFormulaire } from "@/components/ui/section-formulaire";
import {
  SelecteurRecherche,
  type OptionRecherche,
} from "@/components/ui/selecteur-recherche";

/**
 * LE SITE ET SES MACHINES — un composant CLIENT qui cherche le site sur le
 * SERVEUR, et charge ses machines, ses contacts et son donneur d'ordre une
 * fois qu'il est choisi (SELECTEURS-1, 24/09/2026 ; chantier INT-MACHINE 2.1,
 * 20/09/2026 ; TP-UX5-1-FORMULAIRES, 07/10/2026).
 *
 * ## Ce que SELECTEURS-1 change ici
 *
 * `app/(back-office)/interventions/nouvelle/page.tsx` lisait AVANT ce lot
 * `tx.site.findMany({ ..., take: 200 })`, puis les machines et les contacts de
 * TOUS ces sites d'un coup — le 201e site ne pouvait recevoir aucune
 * intervention (SAV-08). Le site se cherche maintenant par
 * `SelecteurRecherche` (`/api/recherche/sites`, `clientActif=1` — RG-PLA-08),
 * et ses machines/contacts/donneur d'ordre sont lus par
 * `/api/recherche/site/[id]` UNE FOIS le site choisi — jamais le parc ni le
 * carnet de contacts entiers.
 *
 * ## Il ne reçoit toujours que des données et des chaînes déjà traduites
 *
 * *Jamais une fonction* transmise par une page SERVEUR (panne #266). Les deux
 * routes qu'il appelle sont nommées par leur URL, pas par une fonction reçue.
 *
 * ## Ce qu'il filtre, et ce qu'il ne décide pas
 *
 * **Au plus une machine** (PARCOURS-1, 23/09/2026) — un `<select>` simple,
 * sans `multiple`, ou — depuis TP-UX5-1-FORMULAIRES, jusqu'à
 * `SEUIL_CHOIX_VISIBLES` machines — un groupe de boutons radio visibles
 * (maquette du 28/09) : même champ `machine_ids`, même règle, deux rendus.
 * Le choix reste facultatif. Contact reste un `<select>` ORDINAIRE : il est
 * borné à UN site, jamais au référentiel entier — ce n'est pas le problème
 * que ce lot répare.
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
 *
 * ## LA COLONNE DE DROITE (TP-UX5-1-FORMULAIRES, maquette du 28/09)
 *
 * « Récapitulatif » et « Qui sera prévenu » lisent le MÊME état que les
 * champs de gauche — le site choisi, et le `donneurOrdre` que
 * `/api/recherche/site/[id]` rend désormais. Une colonne tenue par un AUTRE
 * composant ne verrait jamais cet état ; c'est pourquoi ce composant rend
 * la disposition à deux colonnes ENTIÈRE (D125, QE-13a), `children` portant
 * ce que la section « Ce qui est demandé » et le pied de la carte ont à
 * dire — des nœuds déjà traduits par la page SERVEUR, jamais une fonction.
 */

/** Un site, tel que `/api/recherche/sites` le rend — avec son client. */
type OptionSite = OptionRecherche & { readonly clientId: string };

/** Le donneur d'ordre d'un site, tel que `/api/recherche/site/[id]` le rend — jamais de courriel. */
type DonneurOrdre = { readonly nom: string };

type OptionAuSite = {
  readonly machines: readonly OptionRecherche[];
  readonly contacts: readonly OptionRecherche[];
  readonly donneurOrdre: DonneurOrdre | null;
};

const VIDE: OptionAuSite = { machines: [], contacts: [], donneurOrdre: null };

/**
 * AU-DELÀ, LE `<select>` (TP-UX5-1-FORMULAIRES) — la maquette du 28/09 montre
 * des cartes jusqu'à ce nombre ; une liste plus longue retombe sur la liste
 * déroulante déjà en place, jamais sur un pavé de boutons qui déborderait.
 */
const SEUIL_CHOIX_VISIBLES = 6;

export function ChampSiteEtMachines({
  titreSection,
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
  clientFiltre,
  titreRecapitulatif,
  texteRecapitulatifVide,
  titrePrevenu,
  textePrevenuVide,
  textePrevenuNommeSuffixe,
  textePrevenuAucun,
  textePrevenuTechnicien,
  children,
}: Readonly<{
  /** Le titre de la section 1 (TP-UX5-1-FORMULAIRES, maquette du 28/09). */
  titreSection: string;
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
  /**
   * BORNE LA RECHERCHE DE SITE À UN SEUL CLIENT (TP-A1, `?client=` sur
   * `interventions/nouvelle`) — déjà validé par l'appelant serveur
   * (`lireClient` sous le contexte cloisonné), comme `siteInitial`. La route
   * `/api/recherche/sites` accepte déjà `client` ; ce lot ne fait que le lui
   * passer.
   */
  clientFiltre?: string;
  /** La colonne de droite (TP-UX5-1-FORMULAIRES) — titres et phrases vides. */
  titreRecapitulatif: string;
  texteRecapitulatifVide: string;
  titrePrevenu: string;
  textePrevenuVide: string;
  textePrevenuNommeSuffixe: string;
  textePrevenuAucun: string;
  textePrevenuTechnicien: string;
  /** La section « Ce qui est demandé » et le pied de la carte — des nœuds déjà traduits. */
  children: React.ReactNode;
}>) {
  const [siteId, setSiteId] = useState<string>(siteInitial?.id ?? "");
  const [siteLibelleChoisi, setSiteLibelleChoisi] = useState<string>(
    siteInitial?.libelle ?? "",
  );
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

  const optionsMachine = [
    { valeur: "", libelle: libelleAucuneMachineChoisie },
    ...auSite.machines.map((machine) => ({
      valeur: machine.id,
      libelle: machine.libelle,
    })),
  ];

  return (
    <div className="grid grid-cols-1 gap-4 min-[901px]:grid-cols-[minmax(0,1fr)_280px]">
      <div className="flex flex-col gap-4">
        <SectionFormulaire numero={1} titre={titreSection}>
          <SelecteurRecherche<OptionSite>
            nom="site"
            url="/api/recherche/sites"
            parametres={
              clientFiltre === undefined
                ? { clientActif: "1" }
                : { clientActif: "1", client: clientFiltre }
            }
            libelle={libelleSite}
            aide={aideSite}
            libelleAucunResultat={libelleAucunResultatSite}
            libelleVoirPlus={libelleVoirPlusSite}
            obligatoire
            valeurInitiale={siteInitial}
            versValeurChamp={(option) => `${option.clientId}:${option.id}`}
            onChoix={(option) => {
              setSiteId(option?.id ?? "");
              setSiteLibelleChoisi(option?.libelle ?? "");
            }}
          />
          {/* LA NOTE VIT SOUS LE CHAMP QU'ELLE EXPLIQUE (92-CREATION-2,
              constat 8) — avant ce lot elle suivait tout
              `ChampSiteEtMachines`, donc en pratique sous Contact, sans lien
              visible avec le Site dont elle parle. */}
          <p className="text-app-encre-faible -mt-2 text-12 font-bold">
            {texteAgenceDeduite}
          </p>

          {/*
            JUSQU'À `SEUIL_CHOIX_VISIBLES` MACHINES, DES CHOIX VISIBLES
            (TP-UX5-1-FORMULAIRES, maquette du 28/09) — AU-DELÀ, le
            `<select>` déjà en place. Tant qu'aucun site n'est choisi, le
            `<select>` désactivé reste affiché : la carte ne peut rien
            proposer avant (92-CREATION-2, constat 7), choix visibles ou non.
          */}
          {siteId !== "" && auSite.machines.length <= SEUIL_CHOIX_VISIBLES ? (
            <Choix
              nom="machine_ids"
              legende={libelleMachines}
              options={optionsMachine}
              valeur={machineChoisie}
              onChange={setMachineChoisie}
            />
          ) : (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {libelleMachines}
              {/*
                UN SEUL `<select>`, PLUS `multiple` (PARCOURS-1) — le champ
                reste nommé `machine_ids` : `FormData.getAll` y trouve zéro
                ou un identifiant, exactement ce que
                `schemaCreation.machine_ids` attend. L'option vide, en tête,
                est le cas ordinaire (dépannage à l'aveugle).

                DÉSACTIVÉ TANT QU'AUCUN SITE N'EST CHOISI (92-CREATION-2,
                constat 7) — la liste ne PEUT rien proposer avant, et le
                disait mal.
              */}
              <select
                name="machine_ids"
                value={machineChoisie}
                disabled={siteId === ""}
                onChange={(evenement) =>
                  setMachineChoisie(evenement.target.value)
                }
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
          )}
          {siteId !== "" && auSite.machines.length === 0 ? (
            <p className="text-app-encre-faible -mt-2 text-12 font-bold">
              {texteAucuneMachine}
            </p>
          ) : null}

          {/*
            L'EMPLACEMENT DES ALERTES DE DOUBLON ET DE RETOUR, SOUS LA
            MACHINE (constat 6, TP-UX5-1-FORMULAIRES) — AUCUNE lecture ici :
            la lecture (« une intervention est déjà ouverte sur cette
            machine », « un curatif a été clôturé sous 30 jours ») reste à
            faire dans un lot ultérieur.
          */}
          <div data-alertes-creation />

          {libelleContact === undefined ? null : (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {libelleContact}
              <select
                name="contact_id"
                value={contactChoisi}
                disabled={siteId === ""}
                onChange={(evenement) =>
                  setContactChoisi(evenement.target.value)
                }
                className="border-input bg-background rounded-md border px-3 py-2 font-normal disabled:opacity-50"
              >
                <option value="">
                  {siteId === ""
                    ? libelleChoisirSiteDabord
                    : libelleAucunContact}
                </option>
                {auSite.contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.libelle}
                  </option>
                ))}
              </select>
            </label>
          )}
        </SectionFormulaire>

        {children}
      </div>

      <aside className="flex flex-col gap-4" data-bloc="colonne-creation">
        <section
          data-bloc="recapitulatif"
          className="bg-app-surface border-app-bord flex flex-col gap-1.5 rounded-lg border p-4"
        >
          <h2 className="text-14 font-bold">{titreRecapitulatif}</h2>
          {siteId === "" ? (
            <p className="text-app-encre-faible text-13 font-bold">
              {texteRecapitulatifVide}
            </p>
          ) : (
            <>
              <p className="text-13 font-bold">{siteLibelleChoisi}</p>
              <p className="text-app-encre-faible text-12 font-bold">
                {texteAgenceDeduite}
              </p>
            </>
          )}
        </section>
        <section
          data-bloc="qui-sera-prevenu"
          className="bg-app-surface border-app-bord flex flex-col gap-1.5 rounded-lg border p-4"
        >
          <h2 className="text-14 font-bold">{titrePrevenu}</h2>
          {siteId === "" ? (
            <p className="text-app-encre-faible text-13 font-bold">
              {textePrevenuVide}
            </p>
          ) : (
            <>
              {auSite.donneurOrdre === null ? (
                <p className="text-app-rouge-encre text-13 font-bold">
                  {textePrevenuAucun}
                </p>
              ) : (
                <p className="text-13 font-bold">
                  <b>{auSite.donneurOrdre.nom}</b>
                  {textePrevenuNommeSuffixe}
                </p>
              )}
              <p className="text-app-encre-faible text-12 font-bold">
                {textePrevenuTechnicien}
              </p>
            </>
          )}
        </section>
      </aside>
    </div>
  );
}
