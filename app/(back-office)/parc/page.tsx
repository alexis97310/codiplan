import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

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
import { Page } from "@/components/mise-en-page/page";
import { obtenirSession } from "@/lib/auth/session";
import { maintenant, schemaFuseau, dateCivile } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  compterLeParc,
  rechercherLeParc,
  resumerLeParc,
  resumerLeParcFiltre,
  type LigneDeParc,
} from "@/lib/machines/depot";
import { historiqueDeLaMachine } from "@/lib/machines/historique";
import {
  LIMITE_RECHERCHE_PAR_DEFAUT,
  schemaRechercheParc,
} from "@/lib/machines/saisie";
import { CLASSES_LIEN } from "@/lib/theme/apparence";

import { decompte, hrefDeLaPage, libellePage } from "../presentation";

/**
 * L'ÉCRAN « PARC MACHINES » — MAÎTRE-DÉTAIL (N-10, D125 ; R2-21, AT-04, I10).
 *
 * ## CE QUI CHANGE, ET POURQUOI MAINTENANT
 *
 * Jusqu'ici cet écran restait le tableau de l'ANCIENNE maquette
 * (`CODIPLAN_Maquette.html`, D95) pendant que `codiplan-maquette-complete.
 * html` y dessine, dans sa fonction `parc()`, un maître-détail complet.
 * D122 avait borné l'autorité de la seconde maquette au seul VOCABULAIRE
 * d'écran, en laissant la disposition à D95 ; D125 (18/09/2026) déplace cette
 * frontière pour les quatorze écrans que `codiplan-maquette-complete.html`
 * dessine, `/parc` en tête. Voir `docs/arbitrages.md`.
 *
 * ## LA SÉLECTION VIT DANS L'URL, jamais dans un composant
 *
 * `?machine=<id>` — rendue côté serveur, sans `"use client"` ni état React.
 * *Tranché par le ticket N-10* : la sélection survit au rechargement et se
 * partage par lien, et l'écran reste un composant serveur comme tous les
 * autres de ce dépôt.
 *
 * ## LE PREMIER KPI COMPTE LE PÉRIMÈTRE FILTRÉ, PAS LA PAGE
 *
 * « Machines affichées » aurait pu se lire deux façons une fois la liste
 * PAGINÉE (AT-07) : la page (50) ou tout le périmètre filtré (des centaines).
 * La seconde lecture est retenue — LE MÊME NOMBRE que la pagination — parce
 * que deux chiffres qui se contrediraient côte à côte sous le même écran
 * seraient la pire forme de divergence (§9, 01/09), et c'est très exactement
 * ce que `resumerLeParcFiltre` refuse déjà pour les trois autres KPI.
 *
 * ## CE QUE L'EN-TÊTE NE PORTE PLUS
 *
 * Le décompte qui y vivait (« N machines · M fiches à compléter ») EN EST
 * PARTI : `head()` de la maquette n'y pose que des boutons, tous deux des
 * écarts nommés ici (`lib/machines/ecarts-maquette.ts` —
 * `ECARTS_MAQUETTE_ACTIONS_PARC`, aucun des deux ne menant à un écran qui
 * existe). Le décompte devient le détail du premier KPI.
 *
 * ## LA FRISE NE COMPOSE RIEN QUE `historiqueDeLaMachine` NE SACHE DÉJÀ DIRE
 *
 * Elle porte les trois événements les plus récents de la machine
 * SÉLECTIONNÉE, et d'elle seule — jamais une boucle sur toute la page, qui
 * ferait un aller-retour par ligne rendue. Une machine sans intervention
 * rend son ÉTAT VIDE, jamais un événement inventé.
 */

const ABSENT = "—";

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
  const aujourdHui = maintenant(fuseau).instant;

  const params = await searchParams;
  const criteres = schemaRechercheParc.safeParse({
    texte: typeof params.q === "string" ? params.q : "",
    statut: typeof params.statut === "string" ? params.statut : undefined,
    page: typeof params.page === "string" ? params.page : undefined,
  });

  const lignes = criteres.success
    ? await rechercherLeParc(contexte, criteres.data)
    : [];
  const resume = criteres.success
    ? await resumerLeParcFiltre(contexte, criteres.data, aujourdHui)
    : resumerLeParc([], aujourdHui);
  // LE TOTAL DE LA PAGINATION, RÉUTILISÉ COMME VALEUR DU PREMIER KPI (voir la
  // note de tête) — la MÊME `filtreDuParc` que la liste et que le résumé.
  const totalFiltre = criteres.success
    ? await compterLeParc(contexte, criteres.data)
    : 0;
  // LE TOTAL GÉNÉRAL, SANS AUCUN FILTRE — le détail du premier KPI
  // (« sur N machines au total ») porte sur LA SOCIÉTÉ, jamais sur la
  // recherche en cours : changer le filtre ne doit pas faire bouger ce
  // nombre-là.
  const totalGeneral = await compterLeParc(contexte, {
    texte: null,
    statut: "tous",
    page: 1,
  });
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
      : (await historiqueDeLaMachine(contexte, selection.id)).slice(0, 3);

  const q = typeof params.q === "string" ? params.q : undefined;
  const statutActif = criteres.success ? criteres.data.statut : "tous";

  return (
    <Page
      chemin="/parc"
      titre={t("parc.titre")}
      sousTitre={t("parc.sous_titre")}
    >
      <div data-bloc="toolbar" className="flex flex-wrap items-center gap-2">
        <div data-bloc="recherche" className="contents">
          <BarreDeFiltres
            action="/parc"
            parametre="q"
            valeur={q}
            libelleChamp={t("parc.recherche_champ")}
            libelleBouton={t("parc.recherche_action")}
            enfants={
              <span data-bloc="filtre-statut" className="contents">
                <label className="sr-only" htmlFor="statut">
                  {t("parc.filtre_statut.libelle")}
                </label>
                <select
                  id="statut"
                  name="statut"
                  defaultValue={statutActif}
                  className="border-app-bord bg-app-surface rounded-md border px-2.5 py-1.5 text-[12.5px]"
                >
                  <option value="tous">{t("parc.filtre_statut.tous")}</option>
                  <option value="en_service">
                    {t("statut_machine.en_service")}
                  </option>
                  <option value="en_panne">
                    {t("statut_machine.en_panne")}
                  </option>
                  <option value="arretee">{t("statut_machine.arretee")}</option>
                </select>
              </span>
            }
          />
        </div>
        <Button variant="outline" size="sm" asChild data-bloc="reinitialiser">
          <Link href="/parc">{t("parc.reinitialiser")}</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div data-bloc="kpi-affichees">
          <Kpi
            libelle={t("parc.kpi_affichees")}
            valeur={totalFiltre}
            detail={detailAffichees(totalGeneral, resume.incompletes)}
          />
        </div>
        <div data-bloc="kpi-garantie">
          <Kpi
            ton="orange"
            libelle={t("parc.kpi_garantie")}
            valeur={resume.garantieExpirant90j}
          />
        </div>
        <div data-bloc="kpi-en-panne">
          <Kpi
            ton="rouge"
            libelle={t("parc.kpi_en_panne")}
            valeur={resume.enPanneOuArretees}
            detail={detailEnPanne(resume)}
          />
        </div>
      </div>

      {lignes.length === 0 ? (
        <CarteVide
          titre={t("parc.aucune_trouvee")}
          detail={t("parc.aucune_trouvee_detail")}
          action={
            <Button variant="outline" size="sm" asChild>
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
                    criteres.success ? criteres.data.page : 1,
                    machine.id,
                  )}
                  selectionnee={selection?.id === machine.id}
                  titre={machine.modele.reference}
                  sousTitre={`${referenceMachine(machine)} · ${machine.client.raison_sociale}`}
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
                      <Link href={`/parc/${selection.id}`}>
                        {t("parc.fiche_complete")}
                      </Link>
                    </Button>
                  }
                />
                <DetailBody>
                  <Kv>
                    <KvLigne
                      dt={t("parc.kv_client")}
                      dd={selection.client.raison_sociale}
                    />
                    <KvLigne dt={mot("site")} dd={lieuAffiche(selection)} />
                    <KvLigne
                      dt={t("parc.kv_serie")}
                      dd={numeroDeSerieAffiche(selection)}
                    />
                    <KvLigne
                      dt={t("parc.kv_famille")}
                      dd={familleKv(selection)}
                    />
                    <KvLigne
                      dt={`${mot("agence")} ${t("parc.kv_agence_suffixe")}`}
                      dd={agenceAffichee(selection)}
                    />
                    {/* « Contrat » — écart nommé (lib/machines/
                        ecarts-maquette.ts, ECARTS_MAQUETTE_APERCU_PARC) :
                        aucune table de contrat n'existe (lot 4). L'entrée
                        RESTE, avec le signe d'absence — c'est la structure
                        qui doit être identique (D125). */}
                    <KvLigne dt={t("parc.kv_contrat")} dd={texteAbsent()} />
                  </Kv>
                  <h3 className="mt-[18px] text-[15px] font-bold">
                    {t("parc.derniers_evenements")}
                  </h3>
                  {historique.length === 0 ? (
                    <p className="text-app-encre-faible mt-2 text-[12.5px]">
                      {t("parc.aucun_evenement")}
                    </p>
                  ) : (
                    <Timeline>
                      {historique.map((ligne) => (
                        <TimelineItem
                          key={ligne.id}
                          titre={t(`type_intervention.${ligne.type}`)}
                          detail={detailEvenement(ligne)}
                        />
                      ))}
                    </Timeline>
                  )}
                </DetailBody>
              </section>
            )
          }
        />
      )}

      {/* LE REGISTRE DES VGP SE REJOINT D'ICI — écart nommé DANS L'AUTRE
          SENS (lib/machines/ecarts-maquette.ts, ECARTS_MAQUETTE_AJOUTS_PARC) :
          la maquette ne le dessine pas, mais c'est le seul appelant de /vgp
          depuis cet écran (AT-04). */}
      <Link href="/vgp" className={`text-[12.5px] ${CLASSES_LIEN}`}>
        {t("vgp.lien_depuis_parc")}
      </Link>

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
            { q, statut: statutActif === "tous" ? undefined : statutActif },
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
 * (`../presentation.ts`), à laquelle ce ticket ajoute un cinquième
 * paramètre : aucune des deux fonctions n'est réécrite en dupliquant
 * l'autre, celle-ci compose directement sur `URLSearchParams`, la même
 * brique que `hrefDeLaPage` emploie déjà.
 */
function hrefDeLaLigne(
  q: string | undefined,
  statut: string,
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
  recherche.set("page", String(page));
  recherche.set("machine", machineId);
  return `/parc?${recherche.toString()}`;
}

/** Le détail du premier KPI — le décompte qui vivait dans l'en-tête (§1). */
function detailAffichees(totalGeneral: number, incompletes: number): string {
  const base = `${t("parc.kpi_sur")} ${decompte(totalGeneral, t("parc.total_un"), t("parc.total"))} ${t("parc.kpi_affichees_total")}`;
  return incompletes === 0
    ? base
    : `${base} · ${decompte(incompletes, t("parc.incompletes_un"), t("parc.incompletes"))}`;
}

function detailEnPanne(resume: ReturnType<typeof resumerLeParc>): string {
  const enPanne = resume.parStatut.en_panne ?? 0;
  const arretees = resume.parStatut.arretee ?? 0;
  return `${enPanne} ${t("parc.kpi_en_panne_detail_panne")} · ${arretees} ${t("parc.kpi_en_panne_detail_arretees")}`;
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

function familleKv(machine: LigneDeParc): string {
  return machine.modele.famille?.libelle ?? texteAbsent();
}

function agenceAffichee(machine: LigneDeParc): string {
  return machine.site.agence.libelle;
}

function lieuAffiche(machine: LigneDeParc): string {
  const commune = machine.site.commune;
  const libelle = machine.site.libelle;
  return commune === null || commune === libelle
    ? libelle
    : `${libelle} — ${commune}`;
}

function statutAffiche(statut: LigneDeParc["statut"]): string {
  return t(`statut_machine.${statut}`);
}

/**
 * L'ÉVÉNEMENT DE LA FRISE — date puis référence, jamais un technicien : la
 * table `technicien` du chapitre 11 n'existe pas encore
 * (`docs/constitution/organisation-du-code.md`), et `CHAMPS_LIGNE`
 * (`lib/interventions/depot.ts`) n'expose que `technicien_id`, une identité
 * brute sans nom à afficher.
 */
function detailEvenement(ligne: { date_planifiee: Date | null }): string {
  return ligne.date_planifiee === null
    ? texteAbsent()
    : dateCivile(ligne.date_planifiee);
}
