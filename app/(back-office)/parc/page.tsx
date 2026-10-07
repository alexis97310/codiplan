import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LienPrimaire } from "@/components/ui/action-primaire";
import { Button } from "@/components/ui/button";
import { BarreDeFiltres } from "@/components/ui/barre-de-filtres";
import { Badge, type TonBadge } from "@/components/ui/badge";
import { Kpi } from "@/components/ui/kpi";
import {
  CarteListe,
  CarteVide,
  DetailBody,
  DetailHero,
  Kv,
  KvLigne,
  MaitreDetail,
  RangeeMaitreDetail,
  Timeline,
  TimelineItem,
} from "@/components/ui/maitre-detail";
import { Pagination } from "@/components/ui/pagination";
import { PuceMenu, PuceVue, ResumeListe } from "@/components/ui/puces-filtre";
import { Page } from "@/components/mise-en-page/page";
import { peut } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import {
  dateCivile,
  instantDuJour,
  jourDe,
  maintenant,
  schemaFuseau,
} from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { t, type CleTraduction } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  compterLeParc,
  compterPanneAvecInterventionOuverte,
  JOURS_GARANTIE,
  optionsDeFiltreDuParc,
  rechercherLeParc,
  type LigneDeParc,
} from "@/lib/machines/depot";
import { teteDeLHistorique } from "@/lib/machines/historique";
import {
  LIMITE_RECHERCHE_PAR_DEFAUT,
  schemaRechercheParc,
  type RechercheParc,
  type VueParc,
} from "@/lib/machines/saisie";
import { type LigneIntervention } from "@/lib/interventions/depot";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { trierAlphanumeriquement } from "@/lib/tri/collation";

import { referenceAffichee } from "../interventions/presentation";
import {
  decompte,
  hrefDeLaPage,
  libelleClientSite,
  libellePage,
} from "../presentation";

import {
  detailTuileEnPanne,
  detailTuileGarantie,
  detailTuileMachinesSuivies,
  finDeGarantieAffichee,
  hrefExportParc,
  retourActuelDuParc,
} from "./presentation";

export const metadata: Metadata = { title: t("parc.titre") };

/**
 * L'ÉCRAN « PARC MACHINES » — AU GABARIT DU 28/09 (9EB-TP-UX3-2-LISTES-2,
 * QE-10 (a), QE-13b (a) du 03/10/2026 ; prolonge 9EB-TP-UX3-2-LISTES-1 et
 * D179 au parc).
 *
 * ## CE QUI CHANGE PAR RAPPORT À N-10/N-12 (D125, D126)
 *
 * Les trois anciens KPI (« Machines affichées », « Garanties < 90 jours »,
 * « En panne ou arrêtées ») deviennent trois TUILES-PORTES, chacune un lien
 * (D140) vers la vue qu'elle compte — et une quatrième vue, « Sorties du
 * parc », n'a qu'une puce, jamais de tuile (la maquette ne lui en donne pas).
 * Les quatre `<select>` de LISTES-1 restent (Q3 du pilote, 08/10/2026) ; la
 * recherche et le filtre « État » composent toujours `filtreDuParc` avec les
 * quatre puces de vue, jamais l'inverse.
 *
 * ## `vue` — LE DÉFAUT EST DANS LA PAGE, PAS DANS LE SCHÉMA (Q1 du pilote)
 *
 * `schemaRechercheParc` donne `vue="tout"`, non filtrant — c'est CETTE page
 * qui impose `parc` quand l'adresse ne porte NI `vue` NI un critère posé par
 * un lien (`incompletes`, `ajoutee_du`/`ajoutee_au`, `origine`, `client`,
 * `site`) : même disposition que la vue par défaut de `/clients` (D179). Les
 * liens existants qui posent déjà un de ces critères (`hrefParc` des
 * indicateurs, « Données à compléter », les tuiles « Équipements » des
 * fiches client et site) gardent ainsi leur population d'avant ce ticket,
 * sorties comprises — ils ne portent jamais `vue`, et le défaut du schéma
 * s'applique. Une fois choisie, la vue voyage en CHAMP CACHÉ du formulaire de
 * recherche, pour qu'une recherche relancée ne la réinitialise pas (même
 * disposition que `etat` sur `/clients`).
 *
 * ## TUILES ET PUCES NE COMPTENT PAS LA MÊME CHOSE (constat de la maquette)
 *
 * Les PUCES comptent la recherche EN COURS, vue par vue (compteur = lignes de
 * la liste que son lien ouvre, avec le MÊME `q`, `statut`, client, site,
 * famille et filtres de 9DT). Les TUILES comptent un périmètre plus large —
 * Client/Site/Famille, SANS le texte de recherche ni les autres critères —
 * exactement ce que la maquette fait dire à ses `notes` : « filtrées par
 * client, site ou famille, les tuiles comptent dans ce périmètre ».
 *
 * ## ÉCARTS NOMMÉS DE CE TICKET
 *
 * - **PV-07 (repli au téléphone)** n'est PAS fait : `components/ui/maitre-
 *   detail.tsx` est hors territoire (gardé par deux gardiens), et une ligne
 *   continue d'ouvrir l'aperçu sous la liste à moins de 901 px plutôt que la
 *   fiche directement.
 * - **La sous-ligne de la liste reste un `string`** (`RangeeMaitreDetail`,
 *   hors territoire) : le n° de série n'y est pas en chasse fixe, à la
 *   différence de `.l2` dans la maquette.
 * - **« Dernières interventions » reste une `TimelineItem` de deux chaînes**
 *   (même raison) : la pastille de statut n'y est pas COLORÉE, elle reste le
 *   mot du dictionnaire (`statut.<valeur>`) — le mapping existe
 *   (`CLASSES_STATUT`), mais le composant n'a pas de créneau pour une classe
 *   de couleur sans toucher `maitre-detail.tsx`. Chaque ligne reste un LIEN.
 */

const ABSENT = "—";

/** Les événements que la frise de l'aperçu affiche — et que la requête ramène. */
const EVENEMENTS_DE_L_APERCU = 3;

/** Les quatre vues qu'un humain choisit — `tout` ne l'est jamais (voir la note de tête). */
const VUES_PARC_AFFICHEES = ["parc", "panne", "garantie", "sorties"] as const;
type VueParcAffichee = (typeof VUES_PARC_AFFICHEES)[number];

const LIBELLE_VUE_PARC: Record<VueParcAffichee, CleTraduction> = {
  parc: "parc.vue_parc",
  panne: "parc.vue_panne",
  garantie: "parc.vue_garantie",
  sorties: "parc.vue_sorties",
};

/** Les critères d'une TUILE — Client/Site/Famille seuls, jamais le texte (voir la note de tête). */
function criteresTuile(
  contexte: Pick<RechercheParc, "client_id" | "site_id" | "famille_id">,
  vue: VueParc,
): RechercheParc {
  return {
    texte: null,
    statut: "tous",
    client_id: contexte.client_id,
    site_id: contexte.site_id,
    famille_id: contexte.famille_id,
    vue,
    incompletes: false,
    ajoutee_du: null,
    ajoutee_au: null,
    origine: null,
    page: 1,
  };
}

/** Le lien d'une TUILE — Client/Site/Famille, PLUS la vue (chiffre = lignes que ce lien ouvre). */
function hrefTuile(
  contexte: Pick<RechercheParc, "client_id" | "site_id" | "famille_id">,
  vue: VueParcAffichee,
): string {
  const recherche = new URLSearchParams();
  if (contexte.client_id !== null) recherche.set("client", contexte.client_id);
  if (contexte.site_id !== null) recherche.set("site", contexte.site_id);
  if (contexte.famille_id !== null) {
    recherche.set("famille", contexte.famille_id);
  }
  recherche.set("vue", vue);
  return `/parc?${recherche.toString()}`;
}

export default async function PageParc({
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
  const contexte = session.contexte;

  const societe = await avecContexteApplicatif(contexte, (tx) =>
    tx.societe.findFirst({
      where: { id: contexte.societeId as string },
      select: { fuseau_horaire: true },
    }),
  );
  const fuseau = schemaFuseau.parse(societe?.fuseau_horaire);
  // LA CIVILE, JAMAIS L'INSTANT (DATES-1) : la vue « garantie » et le champ
  // « Fin de garantie » de l'aperçu comparent `garantie_fin`, une
  // `@db.Date` posée à minuit UTC, à cet instant.
  const aujourdHui = instantDuJour(jourDe(maintenant(fuseau).local));

  const params = await searchParams;

  // LE DÉFAUT DE VUE (Q1 du pilote) — voir la note de tête : `parc` quand
  // l'adresse ne porte NI `vue` NI un critère posé par un lien.
  const aUnCritereDeLien =
    typeof params.incompletes === "string" ||
    typeof params.ajoutee_du === "string" ||
    typeof params.ajoutee_au === "string" ||
    typeof params.origine === "string" ||
    typeof params.client === "string" ||
    typeof params.site === "string";
  const vueBrute =
    typeof params.vue === "string"
      ? params.vue
      : aUnCritereDeLien
        ? undefined
        : "parc";

  const criteres = schemaRechercheParc.safeParse({
    texte: typeof params.q === "string" ? params.q : "",
    statut: typeof params.statut === "string" ? params.statut : undefined,
    // LES TROIS FILTRES COMBINABLES DE LISTES-1 (23/09/2026) — dans l'URL,
    // comme `statut` l'est déjà. **La chaîne VIDE compte comme absente** :
    // l'option « Tous les … » du `<select>` porte `value=""`, et un
    // formulaire soumet CE champ même non touché — un `z.uuid()` refuse une
    // chaîne vide, et sans ce garde le premier filtre choisi ferait échouer
    // `safeParse` en silence, rendant zéro ligne pour une raison que rien à
    // l'écran n'explique (mesuré par le scénario de bout en bout de ce ticket).
    client_id:
      typeof params.client === "string" && params.client.length > 0
        ? params.client
        : null,
    site_id:
      typeof params.site === "string" && params.site.length > 0
        ? params.site
        : null,
    famille_id:
      typeof params.famille === "string" && params.famille.length > 0
        ? params.famille
        : null,
    vue: vueBrute,
    // LE LIEN DE LA TUILE « DONNÉES À COMPLÉTER » ET CEUX DE « INDICATEURS DU
    // MOIS » (9DT-TP-MOD2-INDICATEURS-DONNEES, QT-20, MO-7) — posés par un
    // lien, jamais par un champ de ce formulaire.
    incompletes:
      typeof params.incompletes === "string" ? params.incompletes : undefined,
    ajoutee_du: typeof params.ajoutee_du === "string" ? params.ajoutee_du : "",
    ajoutee_au: typeof params.ajoutee_au === "string" ? params.ajoutee_au : "",
    origine: typeof params.origine === "string" ? params.origine : "",
    page: typeof params.page === "string" ? params.page : undefined,
  });

  // LECTURES INDÉPENDANTES, LANCÉES SANS `await` PUIS REJOINTES PAR UN SEUL
  // `Promise.all` — une promesse démarre son travail dès sa création.
  // `totalFiltre` GARDE sa propre écriture, `const totalFiltre =
  // criteres.success ? await compterLeParc(…)`, intacte : c'est la variable
  // que le gardien de l'incident du 16/09 identifie par ce texte exact
  // (`tests/unit/ui/lot-parc.test.ts`).
  const lignesPromesse = criteres.success
    ? rechercherLeParc(contexte, criteres.data, aujourdHui)
    : Promise.resolve<readonly LigneDeParc[]>([]);
  // LES OPTIONS DES TROIS FILTRES (LISTES-1) — indépendantes de `criteres` :
  // elles listent ce qui EXISTE dans le parc, jamais ce que la recherche en
  // cours a retenu, sans quoi choisir un filtre rétrécirait les autres listes
  // déroulantes à chaque clic.
  const optionsPromesse = optionsDeFiltreDuParc(contexte);
  // LES QUATRE PUCES — MÊME recherche, SEULE `vue` change (voir la note de
  // tête : le compteur doit être le nombre de lignes que son lien ouvre).
  const comptesVuePromesse = criteres.success
    ? Promise.all(
        VUES_PARC_AFFICHEES.map(
          async (vue) =>
            [
              vue,
              await compterLeParc(
                contexte,
                { ...criteres.data, vue },
                aujourdHui,
              ),
            ] as const,
        ),
      ).then(
        (paires) =>
          Object.fromEntries(paires) as Record<VueParcAffichee, number>,
      )
    : Promise.resolve({ parc: 0, panne: 0, garantie: 0, sorties: 0 });
  // LES TROIS TUILES — Client/Site/Famille, SANS LE TEXTE (voir la note de
  // tête). Le contexte reste valide même si `criteres` a échoué : une
  // tuile ne doit pas dépendre d'une recherche texte invalide pour compter.
  const contextePourTuiles = {
    client_id: criteres.success ? criteres.data.client_id : null,
    site_id: criteres.success ? criteres.data.site_id : null,
    famille_id: criteres.success ? criteres.data.famille_id : null,
  };
  const tuilesPromesse = Promise.all([
    compterLeParc(
      contexte,
      criteresTuile(contextePourTuiles, "parc"),
      aujourdHui,
    ),
    compterLeParc(
      contexte,
      criteresTuile(contextePourTuiles, "panne"),
      aujourdHui,
    ),
    compterLeParc(
      contexte,
      criteresTuile(contextePourTuiles, "garantie"),
      aujourdHui,
    ),
    compterLeParc(
      contexte,
      criteresTuile(contextePourTuiles, "sorties"),
      aujourdHui,
    ),
    compterPanneAvecInterventionOuverte(contexte, contextePourTuiles),
  ]);
  // LE TOTAL DE LA PAGINATION — LA MÊME `filtreDuParc` que la liste.
  const totalFiltre = criteres.success
    ? await compterLeParc(contexte, criteres.data, aujourdHui)
    : 0;
  const [
    lignes,
    options,
    comptesVue,
    [
      tuileMachinesSuivies,
      tuileEnPanne,
      tuileGarantie,
      tuileSorties,
      panneAvecInterventionOuverte,
    ],
  ] = await Promise.all([
    lignesPromesse,
    optionsPromesse,
    comptesVuePromesse,
    tuilesPromesse,
  ]);
  const totalPages = Math.max(
    1,
    Math.ceil(totalFiltre / LIMITE_RECHERCHE_PAR_DEFAUT),
  );

  const machineParam =
    typeof params.machine === "string" ? params.machine : undefined;
  const selection =
    lignes.find((ligne) => ligne.id === machineParam) ?? lignes[0];
  const historique =
    selection === undefined
      ? []
      : await teteDeLHistorique(contexte, selection.id, EVENEMENTS_DE_L_APERCU);

  const q = typeof params.q === "string" ? params.q : undefined;
  const statutActif = criteres.success ? criteres.data.statut : "tous";
  const clientActif = criteres.success ? criteres.data.client_id : null;
  const siteActif = criteres.success ? criteres.data.site_id : null;
  const familleActive = criteres.success ? criteres.data.famille_id : null;
  const vueActive: VueParc = criteres.success ? criteres.data.vue : "tout";
  const clientsTries = trierAlphanumeriquement(
    options.clients,
    (c) => c.libelle,
  );
  // TRIÉES PAR CLIENT PUIS SITE (85-PARC-SITES) — le filtre se lit désormais
  // « Client — Site » (voir `sitesTries.map` plus bas), et un ordre posé sur
  // le seul libellé du site aurait mélangé les clients dans le menu déroulant
  // pendant que l'affichage les groupe visuellement.
  const sitesTries = trierAlphanumeriquement(
    options.sites,
    (s) => s.client,
    (s) => s.libelle,
  );
  const famillesTriees = trierAlphanumeriquement(
    options.familles,
    (f) => f.libelle,
  );
  // LE RETOUR AU PARC TEL QU'ON L'AVAIT LAISSÉ (79-LIENS-3) — porté par le
  // lien « Fiche complète », rejoué par `retourVersParc` depuis la fiche.
  const retourParc = retourActuelDuParc(params);

  // LES CRITÈRES ACTIFS, EN `URLSearchParams` — UNE SEULE ÉCRITURE, partagée
  // par `hrefSansCritere` (une puce retirable) et `hrefVue` (une puce de
  // vue, qui ne retire rien mais REMPLACE `vue`) : deux lectures du même
  // critère divergeraient en silence (§9, 01/09).
  const parametresActifs = (): URLSearchParams => {
    const recherche = new URLSearchParams();
    if (q !== undefined && q.length > 0) recherche.set("q", q);
    if (statutActif !== "tous") recherche.set("statut", statutActif);
    if (clientActif !== null) recherche.set("client", clientActif);
    if (siteActif !== null) recherche.set("site", siteActif);
    if (familleActive !== null) recherche.set("famille", familleActive);
    if (vueActive !== "tout") recherche.set("vue", vueActive);
    if (criteres.success && criteres.data.incompletes) {
      recherche.set("incompletes", "1");
    }
    if (criteres.success && criteres.data.ajoutee_du !== null) {
      recherche.set("ajoutee_du", criteres.data.ajoutee_du.toISOString());
    }
    if (criteres.success && criteres.data.ajoutee_au !== null) {
      recherche.set("ajoutee_au", criteres.data.ajoutee_au.toISOString());
    }
    if (criteres.success && criteres.data.origine !== null) {
      recherche.set("origine", criteres.data.origine);
    }
    return recherche;
  };
  /** Une puce RETIRABLE (Q3 du pilote) — les critères actifs, moins celui-ci. */
  const hrefSansCritere = (cle: string): string => {
    const recherche = parametresActifs();
    recherche.delete(cle);
    const chaine = recherche.toString();
    return chaine.length === 0 ? "/parc" : `/parc?${chaine}`;
  };
  /** Une puce DE VUE — les critères actifs, `vue` REMPLACÉE par celle-ci. */
  const hrefVue = (vue: VueParcAffichee): string => {
    const recherche = parametresActifs();
    recherche.set("vue", vue);
    return `/parc?${recherche.toString()}`;
  };

  return (
    <Page
      chemin="/parc"
      titre={t("parc.titre")}
      sousTitre={t("parc.sous_titre_tuiles")}
      // « + Machine » — GAP COMBLÉ (AT-07 bis, 18/09/2026) : voir
      // app/(back-office)/parc/nouvelle/page.tsx et
      // lib/machines/ecarts-maquette.ts. « Scanner un QR code » reste un
      // écart nommé — aucun écran de lecture de QR n'existe.
      actions={
        <>
          {contexte.role !== null &&
          peut(contexte.role, "importer_exporter") ? (
            <a
              href={hrefExportParc({
                q,
                statut: statutActif,
                client: clientActif,
                site: siteActif,
                famille: familleActive,
                vue: vueActive,
                incompletes:
                  criteres.success && criteres.data.incompletes ? "1" : null,
                ajoutee_du:
                  criteres.success && criteres.data.ajoutee_du !== null
                    ? criteres.data.ajoutee_du.toISOString()
                    : null,
                ajoutee_au:
                  criteres.success && criteres.data.ajoutee_au !== null
                    ? criteres.data.ajoutee_au.toISOString()
                    : null,
                origine: criteres.success ? criteres.data.origine : null,
              })}
              className={CLASSES_LIEN}
            >
              {t("export.bouton")}
            </a>
          ) : null}
          <LienPrimaire href="/parc/nouvelle">
            {t("parc.action.nouvelle")}
          </LienPrimaire>
        </>
      }
    >
      <div className="-mt-4 flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div data-bloc="kpi-affichees">
            <Kpi
              libelle={t("parc.tuile_machines_suivies")}
              valeur={tuileMachinesSuivies}
              detail={detailTuileMachinesSuivies(tuileSorties)}
              href={hrefTuile(contextePourTuiles, "parc")}
            />
          </div>
          <div data-bloc="kpi-en-panne">
            <Kpi
              ton="rouge"
              libelle={t("parc.tuile_en_panne")}
              valeur={tuileEnPanne}
              detail={detailTuileEnPanne(panneAvecInterventionOuverte)}
              href={hrefTuile(contextePourTuiles, "panne")}
            />
          </div>
          <div data-bloc="kpi-garantie">
            <Kpi
              ton="orange"
              libelle={t("parc.tuile_garanties_finissent")}
              valeur={tuileGarantie}
              detail={detailTuileGarantie(tuileGarantie, JOURS_GARANTIE)}
              href={hrefTuile(contextePourTuiles, "garantie")}
            />
          </div>
        </div>

        <div data-bloc="toolbar" className="flex flex-wrap items-end gap-2">
          <div data-bloc="recherche" className="contents">
            <BarreDeFiltres
              action="/parc"
              parametre="q"
              valeur={q}
              libelleChamp={t("parc.recherche_placeholder_tuiles")}
              libelleBouton={t("parc.recherche_action")}
              enfants={
                <span data-bloc="filtre-statut" className="contents">
                  {/* LA VUE COURANTE VOYAGE EN CHAMP CACHÉ (Q1 du pilote) —
                      une recherche relancée (statut, client…) ne doit pas
                      réinitialiser la vue active. */}
                  <input type="hidden" name="vue" value={vueActive} />
                  <span className="flex flex-col gap-0">
                    <label
                      className="text-app-encre-faible text-12 leading-none font-bold uppercase"
                      htmlFor="statut"
                    >
                      {t("parc.filtre_statut.libelle")}
                    </label>
                    <select
                      id="statut"
                      name="statut"
                      defaultValue={statutActif}
                      className="border-app-bord bg-app-surface h-[40px] w-[100px] truncate rounded-[9px] border px-3"
                    >
                      <option value="tous">
                        {t("parc.filtre_statut.tous")}
                      </option>
                      <option value="en_service">
                        {t("statut_machine.en_service")}
                      </option>
                      <option value="en_panne">
                        {t("statut_machine.en_panne")}
                      </option>
                      <option value="arretee">
                        {t("statut_machine.arretee")}
                      </option>
                    </select>
                  </span>
                  <span className="flex flex-col gap-0">
                    <label
                      className="text-app-encre-faible text-12 leading-none font-bold uppercase"
                      htmlFor="client"
                    >
                      {t("parc.filtre_client.libelle")}
                    </label>
                    <select
                      id="client"
                      name="client"
                      defaultValue={clientActif ?? ""}
                      className="border-app-bord bg-app-surface h-[40px] w-[105px] truncate rounded-[9px] border px-3"
                    >
                      <option value="">{t("parc.filtre_client.tous")}</option>
                      {clientsTries.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.libelle}
                        </option>
                      ))}
                    </select>
                  </span>
                  <span className="flex flex-col gap-0">
                    <label
                      className="text-app-encre-faible text-12 leading-none font-bold uppercase"
                      htmlFor="site"
                    >
                      {mot("site")}
                    </label>
                    <select
                      id="site"
                      name="site"
                      defaultValue={siteActif ?? ""}
                      className="border-app-bord bg-app-surface h-[40px] w-[105px] truncate rounded-[9px] border px-3"
                    >
                      <option value="">{t("parc.filtre_site.tous")}</option>
                      {sitesTries.map((option) => (
                        <option key={option.id} value={option.id}>
                          {libelleClientSite(option.client, option.libelle)}
                        </option>
                      ))}
                    </select>
                  </span>
                  <span className="flex flex-col gap-0">
                    <label
                      className="text-app-encre-faible text-12 leading-none font-bold uppercase"
                      htmlFor="famille"
                    >
                      {t("parc.famille")}
                    </label>
                    <select
                      id="famille"
                      name="famille"
                      defaultValue={familleActive ?? ""}
                      className="border-app-bord bg-app-surface h-[40px] w-[100px] truncate rounded-[9px] border px-3"
                    >
                      <option value="">{t("parc.filtre_famille.tous")}</option>
                      {famillesTriees.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.libelle}
                        </option>
                      ))}
                    </select>
                  </span>
                </span>
              }
            />
          </div>
        </div>

        <div
          aria-label={t("parc.filtre_vue_libelle")}
          className="flex flex-wrap items-center gap-2"
        >
          {VUES_PARC_AFFICHEES.map((vue) => (
            <PuceVue
              key={vue}
              libelle={t(LIBELLE_VUE_PARC[vue])}
              compteur={comptesVue[vue]}
              actif={vueActive === vue}
              href={hrefVue(vue)}
            />
          ))}
          {clientActif === null ? null : (
            <PuceMenu
              libelle={t("parc.puce_client")}
              valeur={
                clientsTries.find((c) => c.id === clientActif)?.libelle ?? ""
              }
              href={hrefSansCritere("client")}
            />
          )}
          {siteActif === null ? null : (
            <PuceMenu
              libelle={mot("site")}
              valeur={sitesTries.find((s) => s.id === siteActif)?.libelle ?? ""}
              href={hrefSansCritere("site")}
            />
          )}
          {familleActive === null ? null : (
            <PuceMenu
              libelle={t("parc.famille")}
              valeur={
                famillesTriees.find((f) => f.id === familleActive)?.libelle ??
                ""
              }
              href={hrefSansCritere("famille")}
            />
          )}
          {statutActif === "tous" ? null : (
            <PuceMenu
              libelle={t("parc.puce_etat")}
              valeur={t(`statut_machine.${statutActif}`)}
              href={hrefSansCritere("statut")}
            />
          )}
          {criteres.success && criteres.data.incompletes ? (
            <PuceMenu
              libelle={t("parc.puce_incompletes")}
              valeur=""
              href={hrefSansCritere("incompletes")}
            />
          ) : null}
          {criteres.success && criteres.data.origine !== null ? (
            <PuceMenu
              libelle={t("parc.puce_origine")}
              valeur={t(`source_creation.${criteres.data.origine}`)}
              href={hrefSansCritere("origine")}
            />
          ) : null}
          {criteres.success && criteres.data.ajoutee_du !== null ? (
            <PuceMenu
              libelle={t("parc.puce_ajoutee_du")}
              valeur={dateCivile(criteres.data.ajoutee_du)}
              href={hrefSansCritere("ajoutee_du")}
            />
          ) : null}
          {criteres.success && criteres.data.ajoutee_au !== null ? (
            <PuceMenu
              libelle={t("parc.puce_ajoutee_au")}
              valeur={dateCivile(criteres.data.ajoutee_au)}
              href={hrefSansCritere("ajoutee_au")}
            />
          ) : null}
        </div>

        <ResumeListe
          texte={decompte(totalFiltre, t("parc.total_un"), t("parc.total"))}
          complement={t("parc.resume_complement")}
        />
      </div>

      {/* 9CL-RETOUCHES-2A-REPRISE — même compensation que le bloc filtres/KPI
          ci-dessus, sur l'autre gap-5 de `Page` : voir la note à `-mt-4
          flex flex-col gap-0` plus haut. */}
      <div className="-mt-4">
        {lignes.length === 0 ? (
          <CarteVide
            titre={t("parc.aucune_trouvee")}
            detail={t("parc.aucune_trouvee_detail")}
            action={
              <Button
                variant="outline"
                size="sm"
                asChild
                data-bloc="reinitialiser"
              >
                <Link href="/parc">{t("parc.reinitialiser")}</Link>
              </Button>
            }
          />
        ) : (
          <MaitreDetail
            liste={
              <CarteListe
                titre={t("parc.resultats")}
                compte={decompte(
                  totalFiltre,
                  t("parc.total_un"),
                  t("parc.total"),
                )}
              >
                {lignes.map((machine) => (
                  <RangeeMaitreDetail
                    key={machine.id}
                    href={hrefDeLaLigne(
                      q,
                      statutActif,
                      clientActif,
                      siteActif,
                      familleActive,
                      vueActive,
                      criteres.success ? criteres.data.page : 1,
                      machine.id,
                    )}
                    selectionnee={selection?.id === machine.id}
                    titre={titreDeLaLigne(machine)}
                    sousTitre={sousTitreDeLaLigne(machine)}
                    badge={
                      <Badge ton={TONS_STATUT[machine.statut]}>
                        {statutAffiche(machine.statut)}
                      </Badge>
                    }
                  />
                ))}
              </CarteListe>
            }
            apercu={
              selection === undefined ? null : (
                <section className="bg-app-surface border-app-bord overflow-hidden rounded-lg border">
                  <DetailHero
                    symbole={t("parc.symbole_machine")}
                    reference={referenceMachine(selection)}
                    titre={selection.modele.reference}
                    badge={
                      <Badge ton={TONS_STATUT[selection.statut]}>
                        {statutAffiche(selection.statut)}
                      </Badge>
                    }
                    action={
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={hrefFicheComplete(selection.id, retourParc)}
                        >
                          {t("parc.fiche_complete")}
                        </Link>
                      </Button>
                    }
                  />
                  <DetailBody>
                    <Kv>
                      <KvLigne
                        dt={t("parc.kv_famille")}
                        dd={champOuNonRenseigne(
                          selection.modele.famille?.libelle ?? null,
                        )}
                      />
                      <KvLigne
                        dt={t("parc.export_colonne_marque")}
                        dd={selection.modele.marque}
                      />
                      <KvLigne
                        dt={t("parc.apercu_champ_reference")}
                        dd={selection.modele.reference}
                      />
                      <KvLigne
                        dt={t("parc.kv_serie")}
                        dd={numeroDeSerieAffiche(selection)}
                      />
                      <KvLigne
                        dt={t("parc.export_colonne_annee_vente")}
                        dd={champOuNonRenseigne(anneeDeVenteBrute(selection))}
                      />
                      <KvLigne
                        dt={`${t("parc.kv_client")} · ${mot("site")}`}
                        dd={
                          <Link
                            href={`/sites/${selection.site.id}`}
                            className={CLASSES_LIEN}
                          >
                            {libelleClientSite(
                              selection.client.raison_sociale,
                              selection.site.libelle,
                            )}
                          </Link>
                        }
                      />
                      <KvLigne
                        dt={t("parc.apercu_champ_garantie")}
                        dd={champOuNonRenseigne(
                          selection.garantie_fin === null
                            ? null
                            : finDeGarantieAffichee(
                                selection.garantie_fin,
                                aujourdHui,
                              ),
                        )}
                      />
                      <KvLigne
                        dt={mot("agence")}
                        dd={agenceAffichee(selection)}
                      />
                    </Kv>
                    <h3 className="mt-[18px] text-[15px] font-bold">
                      {t("parc.derniers_evenements")}
                    </h3>
                    {historique.length === 0 ? (
                      <p className="text-app-encre-faible mt-2 text-13 font-bold">
                        {t("parc.aucun_evenement")}
                      </p>
                    ) : (
                      <Timeline>
                        {historique.map((ligne) => (
                          <Link
                            key={ligne.id}
                            href={`/interventions/${ligne.id}?depuis=machine&depuis_id=${selection.id}`}
                            className="block"
                          >
                            <TimelineItem
                              titre={t(`type_intervention.${ligne.type}`)}
                              detail={detailEvenement(ligne)}
                            />
                          </Link>
                        ))}
                      </Timeline>
                    )}
                  </DetailBody>
                </section>
              )
            }
          />
        )}
      </div>

      <Pagination
        page={criteres.success ? criteres.data.page : 1}
        totalPages={totalPages}
        libelleResultats={decompte(
          totalFiltre,
          t("parc.total_un"),
          t("parc.total"),
        )}
        libellePage={libellePage(
          criteres.success ? criteres.data.page : 1,
          totalPages,
        )}
        libellePrecedent={t("pagination.precedent")}
        libelleSuivant={t("pagination.suivant")}
        hrefPage={(page) =>
          hrefDeLaPage(
            "/parc",
            {
              q,
              statut: statutActif === "tous" ? undefined : statutActif,
              client: clientActif ?? undefined,
              site: siteActif ?? undefined,
              famille: familleActive ?? undefined,
              vue: vueActive === "tout" ? undefined : vueActive,
            },
            page,
          )
        }
      />
    </Page>
  );
}

/**
 * L'URL D'UNE LIGNE DU MAÎTRE-DÉTAIL — les critères actifs, PLUS le
 * paramètre `machine` (N-10). Même base que `hrefDeLaPage`
 * (`../presentation.ts`), à laquelle ce ticket ajoute un septième
 * paramètre (`vue`) : aucune des deux fonctions n'est réécrite en dupliquant
 * l'autre, celle-ci compose directement sur `URLSearchParams`, la même
 * brique que `hrefDeLaPage` emploie déjà.
 */
function hrefDeLaLigne(
  q: string | undefined,
  statut: string,
  clientId: string | null,
  siteId: string | null,
  familleId: string | null,
  vue: VueParc,
  page: number,
  machineId: string,
): string {
  const recherche = new URLSearchParams();
  if (q !== undefined && q.length > 0) {
    recherche.set("q", q);
  }
  if (statut !== "tous") {
    recherche.set("statut", statut);
  }
  if (clientId !== null) {
    recherche.set("client", clientId);
  }
  if (siteId !== null) {
    recherche.set("site", siteId);
  }
  if (familleId !== null) {
    recherche.set("famille", familleId);
  }
  if (vue !== "tout") {
    recherche.set("vue", vue);
  }
  recherche.set("page", String(page));
  recherche.set("machine", machineId);
  return `/parc?${recherche.toString()}`;
}

/**
 * L'URL DE LA FICHE COMPLÈTE — la requête active du parc, encodée dans
 * `retour`, pour que `retourVersParc` (`[id]/page.tsx`) la rejoue au clic
 * sur « Retour » (79-LIENS-3). Sans requête active (retour vide), le lien
 * reste nu — comportement inchangé.
 */
function hrefFicheComplete(machineId: string, retourParc: string): string {
  return retourParc.length === 0
    ? `/parc/${machineId}`
    : `/parc/${machineId}?retour=${encodeURIComponent(retourParc)}`;
}

/**
 * LE TON DE LA PASTILLE DE STATUT — dérivé de l'exemple de la maquette pour
 * les trois statuts qu'elle montre (En service → vert, En panne → rouge,
 * Arrêtée → orange) ; les trois statuts terminaux n'ont aucun précédent dans
 * la maquette et prennent le gris neutre — un jugement, écrit comme tel.
 */
const TONS_STATUT: Record<LigneDeParc["statut"], TonBadge> = {
  en_service: "vert",
  en_panne: "rouge",
  arretee: "orange",
  remplacee: "gris",
  ferraillee: "gris",
  fusionnee: "gris",
};

/** LA RÉFÉRENCE AFFICHÉE — `numero`, ou `Local-<6 caractères>` (I10). */
function referenceMachine(machine: {
  id: string;
  numero: number | null;
}): string {
  if (machine.numero !== null) {
    return `MAC-${String(machine.numero).padStart(6, "0")}`;
  }
  return `Local-${machine.id.replaceAll("-", "").slice(-6).toUpperCase()}`;
}

/** Le signe d'absence, résolu par un APPEL plutôt que par la constante nue (L0-11). */
function texteAbsent(): string {
  return ABSENT;
}

/**
 * UN CHAMP DE L'APERÇU, OU « NON RENSEIGNÉ » EN GRIS — gabarit du 28/09
 * (9EB-TP-UX3-2-LISTES-2) : les huit champs de `machinePreview()` qui
 * peuvent manquer (famille, année de vente, fin de garantie) le disent en
 * clair plutôt que par le signe d'absence court que la LISTE continue
 * d'employer — ce ticket ne change que les HUIT CHAMPS de l'aperçu, jamais
 * la ligne ni les autres écrans (D126 : « une absence reste absente »,
 * jamais tue ni inventée).
 */
function champOuNonRenseigne(valeur: string | null): React.ReactNode {
  if (valeur === null) {
    return (
      <span className="text-app-encre-faible">{t("parc.non_renseigne")}</span>
    );
  }
  return valeur;
}

function numeroDeSerieAffiche(machine: LigneDeParc): React.ReactNode {
  if (machine.complet) {
    return machine.numero_serie;
  }
  return (
    <>
      {texteAbsent()}
      <span className="mt-[3px] block font-sans">
        <Badge ton="orange">{t("parc.a_completer")}</Badge>
      </span>
    </>
  );
}

function familleAffichee(machine: LigneDeParc): string {
  return machine.modele.famille?.libelle ?? texteAbsent();
}

/**
 * LE TITRE DE LA LIGNE — famille · marque référence (maquette, `row()` :
 * `fam(x).nom + " · " + modele(x).marque + " " + modele(x).ref`). D126 avait
 * posé « marque référence » seul pour N-12 ; la maquette du 28/09 y ajoute
 * la famille en tête — un ajout, jamais un retrait des deux faits que D126
 * demandait déjà.
 */
function titreDeLaLigne(machine: LigneDeParc): string {
  return `${familleAffichee(machine)} · ${machine.modele.marque} ${machine.modele.reference}`;
}

/**
 * LA SOUS-LIGNE DE LA LIGNE — client · site · n° de série (maquette, `row()` :
 * `cli(s.client).nom + " · " + s.libelle + " · " + x.sn`). Le CLIENT revient
 * dans la ligne, qu'il avait quittée pour N-12 : la maquette du 28/09 le
 * replace dans la sous-ligne plutôt que dans l'aperçu seul — un ÉCART à N-12
 * que D125/QE-13a (D137) autorise explicitement (« la maquette du 28/09
 * REMPLACE l'ancienne »).
 *
 * `RangeeMaitreDetail.sousTitre` reste un `string` (hors territoire,
 * `components/ui/maitre-detail.tsx`) : le n° de série n'y est donc pas en
 * chasse fixe, à la différence de `.l2` dans la maquette (écart nommé, voir
 * la note de tête de ce fichier).
 */
function sousTitreDeLaLigne(machine: LigneDeParc): string {
  const serie = machine.complet ? machine.numero_serie : texteAbsent();
  return `${machine.client.raison_sociale} · ${machine.site.libelle} · ${serie}`;
}

/**
 * L'ANNÉE DE VENTE, BRUTE (`null` si absente) — `champOuNonRenseigne` en
 * décide l'affichage ; cette fonction ne compose aucun texte de rechange.
 */
function anneeDeVenteBrute(machine: LigneDeParc): string | null {
  return machine.date_vente === null
    ? null
    : String(machine.date_vente.getUTCFullYear());
}

function agenceAffichee(machine: LigneDeParc): string {
  return machine.site.agence.libelle;
}

function statutAffiche(statut: LigneDeParc["statut"]): string {
  return t(`statut_machine.${statut}`);
}

/**
 * L'ÉVÉNEMENT DE LA FRISE — date · référence · statut (en mot, voir la note
 * de tête : la pastille COLORÉE n'a pas de créneau dans `TimelineItem` sans
 * toucher `maitre-detail.tsx`, hors territoire — le statut reste donc le mot
 * du dictionnaire, jamais une classe de couleur). `referenceAffichee` est le
 * même que la fiche machine (`parc/[id]/page.tsx`), importé depuis
 * `../interventions/presentation` comme elle le fait déjà.
 */
function detailEvenement(
  ligne: Pick<LigneIntervention, "id" | "numero" | "date_planifiee" | "statut">,
): string {
  const date =
    ligne.date_planifiee === null
      ? texteAbsent()
      : dateCivile(ligne.date_planifiee);
  return `${date} · ${referenceAffichee(ligne)} · ${t(`statut.${ligne.statut}`)}`;
}
