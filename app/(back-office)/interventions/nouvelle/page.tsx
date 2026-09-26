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
import { contactsDuClient } from "@/lib/contacts/depot";
import { lireDemandePourCreation } from "@/lib/demandes/depot";
import { machinesDesSites } from "@/lib/machines/depot";
import { lireSite } from "@/lib/sites/depot";
import { uuidv7 } from "@/lib/db/uuid";

import { libelleClientSite } from "../../presentation";
import {
  agenceDeduiteDuSite,
  aideRechercheSite,
  libelleChampObligatoire,
  libelleChoisirLeLieuDabord,
} from "../presentation";

import { BoutonCreer } from "./bouton-creer";

export const metadata: Metadata = { title: t("planning.creer") };

/**
 * UN PARAMÈTRE D'URL VALIDÉ CONTRE UNE LISTE CLOSE (56-FORMULAIRES-2) — le
 * retour au formulaire après un refus de saisie (`versLeFormulaire`,
 * `app/api/interventions/creer/route.ts`) peut porter n'importe quel texte :
 * `type` et `priorité` ne préremplissent leur `<select>` que si la valeur
 * appartient encore à la liste, jamais une erreur pour le reste (LIENS-1).
 */
function valeurAutorisee(
  valeur: string | string[] | undefined,
  valeurs: readonly string[],
): string | undefined {
  return typeof valeur === "string" && valeurs.includes(valeur)
    ? valeur
    : undefined;
}

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
 *
 * ## `?demande=<id>` PRÉREMPLIT DEPUIS UNE DEMANDE (68-DEMANDES-2, SAV-11)
 *
 * Le lien « Créer une intervention depuis cette demande » de la fiche d'une
 * demande (`/demandes/[id]`) mène ici avec ce paramètre. Lu SOUS LE MÊME
 * CONTEXTE CLOISONNÉ que `?site=`/`?machine=` — `lireDemandePourCreation`
 * rend `null` pour une demande hors périmètre ou inexistante, et le
 * paramètre est alors ignoré en silence, exactement comme un `?site=` forgé
 * (LIENS-1). Quand elle résout, elle prime sur `?site=`/`?machine=`/
 * `?contact_id=` pour préremplir le lieu, la machine, le contact,
 * l'urgence et la panne, et son `id` voyage en champ caché
 * (`demande_id`) : c'est ce que `creerIntervention`
 * (`lib/interventions/depot.ts`) vérifie et écrit.
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

  // LA DEMANDE D'ORIGINE (68-DEMANDES-2) — résolue AVANT le site et la
  // machine ci-dessous, dont elle prime les paramètres quand elle résout.
  const demandeParam =
    typeof params.demande === "string" ? params.demande : undefined;
  const demandeBrute =
    demandeParam === undefined
      ? null
      : await lireDemandePourCreation(session.contexte, demandeParam);

  // LE SITE ET LA MACHINE PRÉREMPLIS (LIENS-1, « + Intervention » depuis une
  // fiche machine) — résolus SOUS le contexte cloisonné ci-dessous : la
  // validation contre CE périmètre est ce qui distingue un paramètre
  // légitime d'un identifiant forgé.
  const siteParam =
    typeof params.site === "string" ? params.site : demandeBrute?.site_id;
  const machineParam =
    typeof params.machine === "string"
      ? params.machine
      : (demandeBrute?.machine_id ?? undefined);

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
          libelle: libelleClientSite(
            clientDuSite.raison_sociale,
            siteBrut.libelle,
          ),
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

  // LE CONTACT SUR PLACE PRÉREMPLI (56-FORMULAIRES-2) — même discipline que
  // la machine ci-dessus : le contact doit appartenir au SITE présélectionné
  // (le sien, ou celui du client quand il n'est rattaché à aucun site — même
  // filtre qu'`/api/recherche/site/[id]`), sinon il est ignoré en silence.
  const contactParam =
    typeof params.contact_id === "string"
      ? params.contact_id
      : (demandeBrute?.contact_id ?? undefined);
  const contactsDuSiteInitial =
    siteInitial === undefined || clientDuSite === null
      ? []
      : (await contactsDuClient(session.contexte, clientDuSite.id)).filter(
          (contact) =>
            contact.site_id === null || contact.site_id === siteInitial.id,
        );
  const contactIdInitiale =
    contactParam !== undefined &&
    contactsDuSiteInitial.some((contact) => contact.id === contactParam)
      ? contactParam
      : undefined;

  // LE TYPE, LA PRIORITÉ, LA PANNE ET LA RÉFÉRENCE CLIENT PRÉREMPLIS
  // (56-FORMULAIRES-2) — ce que `versLeFormulaire` renvoie après un refus de
  // SAISIE (`app/api/interventions/creer/route.ts`). `type` et `priorite`
  // sont vérifiés contre leur liste close ; la panne et la référence sont du
  // texte libre, rendu tel quel (React échappe déjà tout affichage).
  const typeInitial = valeurAutorisee(params.type, TYPES_INTERVENTION);
  const prioriteInitiale =
    valeurAutorisee(params.priorite, PRIORITES) ??
    (demandeBrute === null ? undefined : demandeBrute.urgence);
  const descriptionInitiale =
    typeof params.description === "string"
      ? params.description
      : (demandeBrute?.description ?? undefined);
  const referenceClientInitiale =
    typeof params.reference_client === "string"
      ? params.reference_client
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
        {demandeBrute === null ? null : (
          <>
            <input type="hidden" name="demande_id" value={demandeBrute.id} />
            <p className="text-app-encre-faible text-[11.5px]">
              {t("intervention.depuis_demande")}
            </p>
          </>
        )}
        <ChampSiteEtMachines
          libelleSite={libelleChampObligatoire(mot("site"))}
          libelleMachines={t("intervention.machine")}
          texteAucuneMachine={t("intervention.machine.aucune_au_site")}
          libelleAucuneMachineChoisie={t("intervention.machine.aucune_choisie")}
          libelleContact={t("intervention.contact_sur_place")}
          libelleAucunContact={t("intervention.aucun_contact")}
          libelleAucunResultatSite={t("selecteur.aucun_resultat")}
          libelleVoirPlusSite={t("selecteur.voir_plus")}
          aideSite={aideRechercheSite()}
          libelleChoisirSiteDabord={libelleChoisirLeLieuDabord()}
          texteAgenceDeduite={agenceDeduiteDuSite()}
          siteInitial={siteInitial}
          machineIdInitiale={machineIdInitiale}
          contactIdInitiale={contactIdInitiale}
        />

        <Choix
          nom="type"
          libelle={t("intervention.type")}
          valeurs={TYPES_INTERVENTION}
          prefixe="type_intervention"
          valeurInitiale={typeInitial}
          obligatoire
          optionVide={t("intervention.creation.choisir_nature")}
        />
        <Choix
          nom="priorite"
          libelle={t("intervention.priorite")}
          valeurs={PRIORITES}
          prefixe="priorite"
          defaut="p3"
          valeurInitiale={prioriteInitiale}
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
          {libelleChampObligatoire(t("intervention.panne_signalee"))}
          <textarea
            name="description"
            required
            aria-required="true"
            rows={4}
            defaultValue={descriptionInitiale}
            className="border-input bg-background rounded-md border px-3 py-2 font-normal"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("intervention.reference_client")}
          <input
            name="reference_client"
            type="text"
            defaultValue={referenceClientInitiale}
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
  valeurInitiale,
  obligatoire = false,
  optionVide,
}: {
  nom: string;
  libelle: string;
  valeurs: readonly string[];
  prefixe: string;
  defaut?: string;
  /** Reprise après un refus de saisie (56-FORMULAIRES-2) — prime sur `defaut`. */
  valeurInitiale?: string;
  /** Marque le champ (92-CREATION-2). Seul un champ qui porte aussi
   * `optionVide` (99P-GR1-NATURE) est réellement vide au rendu, donc
   * réellement obligatoire au sens du navigateur : `priorite` et
   * `mode_valorisation` portent déjà une valeur par défaut, `obligatoire`
   * n'y ajoute qu'un repère visuel. */
  obligatoire?: boolean;
  /**
   * UNE PREMIÈRE OPTION VIDE, NON SÉLECTIONNABLE (99P-GR1-NATURE) — sélectionnée
   * par défaut tant qu'aucune `valeurInitiale` ne prime, elle force un choix
   * explicite. Sans elle, un `<select>` simple retient TOUJOURS sa première
   * valeur : un appel curatif partait en « Préventif sous contrat » (audit du
   * 26/09, constat B1), sans que personne n'ait rien choisi.
   */
  optionVide?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {obligatoire ? libelleChampObligatoire(libelle) : libelle}
      <select
        name={nom}
        defaultValue={
          valeurInitiale ?? (optionVide === undefined ? defaut : "")
        }
        required={optionVide !== undefined}
        aria-required={obligatoire ? "true" : undefined}
        className="border-input bg-background rounded-md border px-3 py-2 font-normal"
      >
        {optionVide === undefined ? null : (
          <option value="" disabled>
            {optionVide}
          </option>
        )}
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
