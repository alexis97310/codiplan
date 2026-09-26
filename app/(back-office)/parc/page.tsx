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
import { Page } from "@/components/mise-en-page/page";
import { obtenirSession } from "@/lib/auth/session";
import {
  dateCivile,
  instantDuJour,
  jourDe,
  maintenant,
  schemaFuseau,
} from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  compterLeParc,
  optionsDeFiltreDuParc,
  rechercherLeParc,
  resumerLeParc,
  resumerLeParcFiltre,
  type LigneDeParc,
} from "@/lib/machines/depot";
import { teteDeLHistorique } from "@/lib/machines/historique";
import {
  LIMITE_RECHERCHE_PAR_DEFAUT,
  schemaRechercheParc,
} from "@/lib/machines/saisie";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { trierAlphanumeriquement } from "@/lib/tri/collation";

import {
  decompte,
  hrefDeLaPage,
  libelleClientSite,
  libellePage,
} from "../presentation";

import { retourActuelDuParc } from "./presentation";

export const metadata: Metadata = { title: t("parc.titre") };

/**
 * L'ÉCRAN « PARC MACHINES » — MAÎTRE-DÉTAIL (N-10, D125 ; R2-21, AT-04, I10).
 *
 * ## CE QU'UNE LIGNE MONTRE (N-12, D126)
 *
 * D125 dit OÙ — `.machine-row` reste un `<h3>`, une sous-ligne, une pastille
 * de statut — et D126 dit QUOI : Alexis, 18/09/2026, à propos du parc cette
 * fois (la fiche l'avait déjà reçu en N-11) — *« il faut afficher
 * principalement la famille du matériel, la marque, la référence, le numéro
 * de série, l'année »*. Le titre porte marque + référence du modèle
 * (`titreDeLaLigne`) ; la sous-ligne porte famille · n° de série · année de
 * vente (`sousTitreDeLaLigne`). Le CLIENT quitte la ligne — il reste en tête
 * de l'aperçu, où la maquette le place déjà — et aucune seconde sous-ligne
 * n'est ajoutée : les trois faits tiennent sur celle que la maquette dessine.
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
 * ## LA FRISE NE COMPOSE RIEN QUE `teteDeLHistorique` NE SACHE DÉJÀ DIRE
 *
 * Elle porte les trois événements les plus récents de la machine
 * SÉLECTIONNÉE, et d'elle seule — jamais une boucle sur toute la page, qui
 * ferait un aller-retour par ligne rendue. Une machine sans intervention
 * rend son ÉTAT VIDE, jamais un événement inventé.
 *
 * **Et la requête ne ramène que ces trois-là** (PARC-1). Elle lisait
 * l'historique entier puis le tronquait ; depuis que la base porte des
 * archives, une machine qui a quinze ans de factures faisait traverser
 * quinze ans de lignes au réseau pour en garder trois. La borne est passée
 * à la lecture, et c'est CETTE page qui la nomme — elle sait ce qu'elle
 * affiche, la requête ne le devine pas.
 */

const ABSENT = "—";

/** Les événements que la frise de l'aperçu affiche — et que la requête ramène. */
const EVENEMENTS_DE_L_APERCU = 3;

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
  // LA CIVILE, JAMAIS L'INSTANT (DATES-1) : `resumerLeParc` compare
  // `garantie_fin`, une `@db.Date` posée à minuit UTC, à cet instant.
  const aujourdHui = instantDuJour(jourDe(maintenant(fuseau).local));

  const params = await searchParams;
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
    page: typeof params.page === "string" ? params.page : undefined,
  });

  // QUATRE LECTURES INDÉPENDANTES (lot PERF, mesuré sur 4fead41) — aucune ne
  // dépend du résultat d'une autre. Les trois premières sont LANCÉES ici,
  // sans `await` — une promesse démarre son travail dès sa création, jamais
  // à son `await` — puis rejointes plus bas par un seul `Promise.all`.
  // `totalFiltre` GARDE sa propre écriture, `const totalFiltre =
  // criteres.success ? await compterLeParc(…)`, intacte : c'est la variable
  // que le gardien de l'incident du 16/09 identifie par ce texte exact
  // (`tests/unit/ui/lot-parc.test.ts`), et ce `await` ne re-sérialise rien —
  // les trois lectures lancées avant lui courent déjà pendant qu'on l'attend.
  const lignesPromesse = criteres.success
    ? rechercherLeParc(contexte, criteres.data)
    : Promise.resolve<readonly LigneDeParc[]>([]);
  const resumePromesse = criteres.success
    ? resumerLeParcFiltre(contexte, criteres.data, aujourdHui)
    : Promise.resolve(resumerLeParc([], aujourdHui));
  // LE TOTAL GÉNÉRAL, SANS AUCUN FILTRE — le détail du premier KPI
  // (« sur N machines au total ») porte sur LA SOCIÉTÉ, jamais sur la
  // recherche en cours : changer le filtre ne doit pas faire bouger ce
  // nombre-là.
  const totalGeneralPromesse = compterLeParc(contexte, {
    texte: null,
    statut: "tous",
    client_id: null,
    site_id: null,
    famille_id: null,
    page: 1,
  });
  // LES OPTIONS DES TROIS FILTRES (LISTES-1) — indépendantes de `criteres` :
  // elles listent ce qui EXISTE dans le parc, jamais ce que la recherche en
  // cours a retenu, sans quoi choisir un filtre rétrécirait les autres listes
  // déroulantes à chaque clic.
  const optionsPromesse = optionsDeFiltreDuParc(contexte);
  // LE TOTAL DE LA PAGINATION, RÉUTILISÉ COMME VALEUR DU PREMIER KPI (voir la
  // note de tête) — la MÊME `filtreDuParc` que la liste et que le résumé.
  const totalFiltre = criteres.success
    ? await compterLeParc(contexte, criteres.data)
    : 0;
  const [lignes, resume, totalGeneral, options] = await Promise.all([
    lignesPromesse,
    resumePromesse,
    totalGeneralPromesse,
    optionsPromesse,
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

  return (
    <Page
      chemin="/parc"
      titre={t("parc.titre")}
      sousTitre={t("parc.sous_titre")}
      // « + Machine » — GAP COMBLÉ (AT-07 bis, 18/09/2026) : voir
      // app/(back-office)/parc/nouvelle/page.tsx et
      // lib/machines/ecarts-maquette.ts. « Scanner un QR code » reste un
      // écart nommé — aucun écran de lecture de QR n'existe.
      actions={
        <LienPrimaire href="/parc/nouvelle">
          {t("parc.action.nouvelle")}
        </LienPrimaire>
      }
    >
      {/* 99C-PARC-TRI (26/09/2026) — TOOLBAR ET KPI COMPACTS, dans UN SEUL
          bloc plutôt que deux séparés par le `gap-5` de `Page` (`gap-2`
          ci-dessous) : l'audit d'ergonomie du 25/09 (constat 30) mesure une
          liste réduite à une bande sous trois cartes KPI, à 1280×800. La
          largeur FIXE des quatre filtres (`w-[…px] truncate`, contre une
          largeur naturelle qui suit le plus long libellé — mesurée jusqu'à
          284 px pour le filtre Site) tient désormais la barre entière sur UNE
          SEULE ligne, « Réinitialiser » compris (déplacé dans `enfants`, donc
          dans le MÊME flux que les filtres, pour partager leur ligne au lieu
          d'en ouvrir une troisième à lui seul) — un libellé plus long que la
          largeur choisie se coupe avec une ellipse (`truncate`), jamais au
          milieu d'un mot. Chaque px compte pour tenir les 480 px de liste
          visible (mesuré ci-dessous) : ce `gap-2` (8 px), plus serré que le
          `gap-5` (20 px) de `Page`, remplace la SEULE respiration entre la
          barre et les KPI qui reste sous ce contrôle de cette page. */}
      <div className="flex flex-col gap-0">
        <div data-bloc="toolbar" className="flex flex-wrap items-end gap-2">
          <div data-bloc="recherche" className="contents">
            <BarreDeFiltres
              action="/parc"
              parametre="q"
              valeur={q}
              libelleChamp={t("parc.recherche_champ")}
              libelleBouton={t("parc.recherche_action")}
              enfants={
                <span data-bloc="filtre-statut" className="contents">
                  {/* GR10 (27/09/2026, audit GR du 26/09, constat G13) — les
                      QUATRE libellés étaient `sr-only` : un ADV qui n'a pas
                      encore choisi de statut/client/site/famille lisait
                      quatre champs muets, chacun devinable seulement par
                      essai. Chaque libellé devient un TEXTE VISIBLE, minuscule
                      et posé AU-DESSUS de son champ — `leading-none`, sans
                      marge, pour que l'ajout ne fasse PAS déborder la barre
                      sous les 480 px de liste visible mesurés par 99C
                      (constat 30, `parc-tri.spec.ts`) : le `gap-2` vertical
                      entre la barre et les KPI, seule respiration sous le
                      contrôle de cette page (voir la note plus haut), passe à
                      zéro pour compenser. Les `id` ne bougent pas. */}
                  <span className="flex flex-col gap-0">
                    <label
                      className="text-app-encre-faible text-[9px] leading-[8px] font-bold uppercase"
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
                  {/* LISTES-1 (23/09/2026) — trois filtres COMBINABLES avec
                      celui du statut, chacun dans l'URL. Les options sont
                      triées par `lib/tri/collation.ts` (LISTES-1). */}
                  <span className="flex flex-col gap-0">
                    <label
                      className="text-app-encre-faible text-[9px] leading-[8px] font-bold uppercase"
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
                      className="text-app-encre-faible text-[9px] leading-[8px] font-bold uppercase"
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
                      className="text-app-encre-faible text-[9px] leading-[8px] font-bold uppercase"
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
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    data-bloc="reinitialiser"
                  >
                    <Link href="/parc">{t("parc.reinitialiser")}</Link>
                  </Button>
                </span>
              }
            />
          </div>
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
                    clientActif,
                    siteActif,
                    familleActive,
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
                      <Link href={hrefFicheComplete(selection.id, retourParc)}>
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
                      dd={familleAffichee(selection)}
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
            {
              q,
              statut: statutActif === "tous" ? undefined : statutActif,
              client: clientActif ?? undefined,
              site: siteActif ?? undefined,
              famille: familleActive ?? undefined,
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
 * (`../presentation.ts`), à laquelle ce ticket ajoute un sixième
 * paramètre : aucune des deux fonctions n'est réécrite en dupliquant
 * l'autre, celle-ci compose directement sur `URLSearchParams`, la même
 * brique que `hrefDeLaPage` emploie déjà. LISTES-1 (23/09/2026) y ajoute les
 * trois filtres combinables — client, site, famille — pour que cliquer une
 * ligne ne perde jamais le filtre actif.
 */
function hrefDeLaLigne(
  q: string | undefined,
  statut: string,
  clientId: string | null,
  siteId: string | null,
  familleId: string | null,
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
  return `${enPanne} ${t("parc.kpi_en_panne_detail_panne")} · ${decompte(arretees, t("parc.kpi_en_panne_detail_arretee_un"), t("parc.kpi_en_panne_detail_arretees"))}`;
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

function familleAffichee(machine: LigneDeParc): string {
  return machine.modele.famille?.libelle ?? texteAbsent();
}

/**
 * LE TITRE DE LA LIGNE — marque puis référence du modèle (D126, appliqué à la
 * ligne du parc par N-12 comme la fiche l'a déjà reçu en N-11 :
 * `docs/arbitrages.md`). Recopié de `bannerTitre` de `/parc/[id]`, jamais
 * importé — la même retenue que `referenceMachine` assume déjà dans ce
 * dépôt.
 */
function titreDeLaLigne(machine: LigneDeParc): string {
  return `${machine.modele.marque} ${machine.modele.reference}`;
}

/**
 * LA SOUS-LIGNE DE LA LIGNE — famille · n° de série · année de vente (D126).
 *
 * Trois faits, jamais quatre : le CLIENT quitte la ligne — il reste en tête
 * de l'aperçu, où la maquette le place déjà (`dl.kv`, ci-dessous) — et la
 * RÉFÉRENCE INTERNE n'y entre pas non plus : D126 ne la demande qu'à la
 * bannière de la FICHE (« en seconde ligne, plus discrète »), un emplacement
 * que `.machine-row` ne porte pas. La forme de la maquette ne bouge pas — un
 * `<h3>`, un `<p>`, une pastille — et cette ligne ne lui ajoute pas de seconde
 * sous-ligne.
 *
 * `date_vente` est nulle sur tout le jeu de démonstration (mesuré N-11) : le
 * signe d'absence s'affiche, jamais un zéro ni la mise en service à sa place
 * (D126, « ce que ça ne décide pas »).
 */
function sousTitreDeLaLigne(machine: LigneDeParc): string {
  const serie = machine.complet ? machine.numero_serie : texteAbsent();
  return `${familleAffichee(machine)} · ${serie} · ${anneeDeVenteAffichee(machine)}`;
}

/**
 * L'ANNÉE DE VENTE, sur quatre chiffres (D126) — recopiée de `/parc/[id]`
 * (même raison que `referenceMachine`) : `date_vente` est une colonne
 * `@db.Date`, aucun fuseau ne s'y applique.
 */
function anneeDeVenteAffichee(machine: LigneDeParc): string {
  return machine.date_vente === null
    ? texteAbsent()
    : String(machine.date_vente.getUTCFullYear());
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
