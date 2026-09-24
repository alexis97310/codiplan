import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { OptionsAgence } from "@/components/agences/options";
import { LienPrimaire } from "@/components/ui/action-primaire";
import { Badge, type TonBadge } from "@/components/ui/badge";
import { Kpi } from "@/components/ui/kpi";
import { Pagination } from "@/components/ui/pagination";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { annuaireDesPersonnes, type Annuaire } from "@/lib/auth/annuaire";
import { type ContexteSession } from "@/lib/auth/contexte";
import { obtenirSession } from "@/lib/auth/session";
import {
  dateCivile,
  instantDuJour,
  jourDe,
  maintenant,
  schemaFuseau,
  versLocal,
} from "@/lib/calendar/fuseau";
import { lundiDeLaSemaine } from "@/lib/calendar/semaine";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  compterInterventions,
  listerInterventions,
  type LignePlanning,
} from "@/lib/interventions/depot";
import { personnesANommer, quiTravaille } from "@/lib/interventions/personnes";
import {
  LIMITE_RECHERCHE_PAR_DEFAUT,
  schemaRechercheInterventions,
  STATUTS_INTERVENTION,
  TYPES_INTERVENTION,
  type Priorite,
} from "@/lib/interventions/saisie";
import { libellesDesMachines } from "@/lib/machines/depot";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { CLASSES_STATUT } from "@/lib/theme/statuts";

import { decompte, hrefDeLaPage, libellePage } from "../presentation";
import {
  libelleFiltreAgence,
  machinesAffichees,
  optionsFiltreTechnicien,
  optionToutesLesAgences,
  referenceAffichee,
} from "./presentation";

export const metadata: Metadata = { title: t("interventions.titre") };

/**
 * L'ÉCRAN « INTERVENTIONS » — le REGISTRE, canonique (N-01, 16/09/2026).
 *
 * ## CE QUE CE TICKET RÉPARE
 *
 * L'entrée « Interventions » de la barre de navigation était INERTE — elle
 * nommait `L2-08`, le ticket qui a livré la fiche et la création, jamais un
 * ticket de LISTE. Une intervention ne se rejoignait donc que depuis le
 * planning, qui n'en montre qu'un CALENDRIER : aucun endroit ne montrait le
 * registre complet, le sens même de l'entrée que la maquette réserve.
 *
 * ## UN OBJET, UN ÉCRAN CANONIQUE, UNE URL QUI LE NOMME
 *
 * `/interventions/{id}` remplace `/planning/{id}` par ce même ticket : une
 * intervention n'est pas davantage un sous-écran du planning que du parc ou
 * d'un client, et son URL cesse de nommer le premier écran par lequel on
 * l'atteignait — le programme des liens arrêtés le 16/09/2026.
 *
 * ## LA LISTE PAGINE, LA RECHERCHE ET LES FILTRES SONT REMPLIS (AT-07, 17/09/2026 ; étendue AT-07 bis, 18/09/2026)
 *
 * Comme `/clients` (L1-01) : une liste non bornée casse au volume sur un parc
 * de démonstration qui porte 226 machines et 615 clients. Le texte cherche sur
 * le client, le lieu et le `numero` de la référence affichée (`INT-00312`,
 * via `numeroDeReference`, `lib/interventions/depot.ts`) — jamais sur le
 * technicien (dont le nom vit dans l'annuaire, pas sur `intervention`). La
 * forme `Local-XXXXXX` de la référence reste un ÉCART NOMMÉ (voir la note de
 * tête de `numeroDeReference`) : `id` est `@db.Uuid`, et son filtre Prisma
 * ne sait pas comparer une sous-chaîne sans SQL brut, que le stack imposé
 * interdit hors migrations. Les quatre premiers filtres sont ceux que la
 * maquette annonce : agence, type, statut, période. Le CINQUIÈME, technicien
 * (57-REGISTRE-2), n'y figure pas — il répond à la question la plus courante
 * du bureau, « qu'a-t-il sur les bras ? », restée sans réponse sur ce
 * registre jusque-là ; « Non affectées » y porte les interventions sans
 * technicien, sur la même colonne que le libellé de repli de la colonne
 * « Technicien » (`quiTravaille`).
 *
 * ## LE CLIENT INACTIF SORT DE CETTE LISTE, ET LA CASE LE FAIT REVENIR (RG-PLA-08, D129)
 *
 * **Un CINQUIÈME contrôle, absent de la maquette et volontaire (même raison
 * que D128 pour un chiffre du tableau de bord)** : depuis l'arbitrage
 * d'exploitation du 19/09/2026, une intervention dont le CLIENT est inactif
 * ne s'affiche plus ici PAR DÉFAUT (`filtreClientActif`,
 * `lib/interventions/depot.ts`) — c'est la même règle que le planning, qui
 * l'applique sans aucune case pour la lever. *L'historique ne devient pas
 * inatteignable pour autant* : la case « Inclure les clients inactifs »
 * revient dessus depuis cet écran, et la fiche du CLIENT continue de tout
 * montrer, quel que soit son statut (`dernieresInterventionsDuClient`, qui ne
 * filtre jamais sur `actif`). Le SITE n'est pas concerné — la question reste
 * ouverte, RG-PLA-08 ne tranche que sur `client.actif`.
 *
 * ## LE CLOISONNEMENT N'EST PAS ÉCRIT ICI
 *
 * `listerInterventions` lit sous le contexte cloisonné, et la forme « parc »
 * décide. Une comparaison de société écrite au-dessus serait une seconde
 * lecture d'un même critère, et c'est celle qui vieillit sans rougir.
 */

export default async function PageInterventions({
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
  const params = await searchParams;
  const motif = params.motif;

  const criteres = schemaRechercheInterventions.safeParse({
    texte: typeof params.q === "string" ? params.q : "",
    agence_id: typeof params.agence === "string" ? params.agence : "",
    type: typeof params.type === "string" ? params.type : "",
    statut: typeof params.statut === "string" ? params.statut : "",
    du: typeof params.du === "string" ? params.du : "",
    au: typeof params.au === "string" ? params.au : "",
    technicien: typeof params.technicien === "string" ? params.technicien : "",
    inclure_clients_inactifs:
      typeof params.inclure_clients_inactifs === "string"
        ? params.inclure_clients_inactifs
        : undefined,
    sans_duree_a_venir:
      typeof params.sans_duree_a_venir === "string"
        ? params.sans_duree_a_venir
        : undefined,
    page: typeof params.page === "string" ? params.page : undefined,
  });

  // QUATRE LECTURES INDÉPENDANTES (lot PERF, mesuré sur 4fead41) — aucune ne
  // dépend du résultat d'une autre. `annuaire` et `libellesMachines`, eux,
  // dépendent des LIGNES rendues et restent dans un second `Promise.all`,
  // après celui-ci.
  const [agences, techniciensActifs, lignes, totalFiltre, kpi] =
    await Promise.all([
      // LES AGENCES DU FILTRE — sous le contexte cloisonné, comme
      // `sites/nouveau/page.tsx` le fait déjà pour son propre sélecteur.
      avecContexteApplicatif(contexte, (tx) =>
        tx.agence.findMany({
          select: { id: true, libelle: true, code: true },
          orderBy: [{ libelle: "asc" }, { id: "asc" }],
        }),
      ),
      // LES TECHNICIENS DU FILTRE (57-REGISTRE-2) — seuls les ACTIFS sont
      // proposés, même règle que `/interventions/nouvelle` et la fiche : un
      // technicien inactif n'entre pas dans une liste PROPOSÉE à une nouvelle
      // saisie, même si son historique reste consultable ailleurs.
      avecContexteApplicatif(contexte, (tx) =>
        tx.technicien.findMany({
          where: { actif: true },
          select: { utilisateur_id: true },
          orderBy: { utilisateur_id: "asc" },
        }),
      ),
      criteres.success
        ? listerInterventions(contexte, criteres.data)
        : Promise.resolve([]),
      // LE TOTAL DE LA PAGINATION — la MÊME `filtreDesInterventions` que la
      // liste, jamais une seconde lecture divergente du critère (AT-07).
      criteres.success
        ? compterInterventions(contexte, criteres.data)
        : Promise.resolve(0),
      kpiDuRegistre(contexte),
    ]);
  const totalPages = Math.max(
    1,
    Math.ceil(totalFiltre / LIMITE_RECHERCHE_PAR_DEFAUT),
  );
  // L'UNION des identités que CETTE liste doit nommer est celle des LIGNES
  // rendues, et rien d'autre : à la différence de la vue jour du planning,
  // aucune colonne ne provient d'un référentiel vide à remplir.
  //
  // `annuaire` ET `libellesMachines` SONT INDÉPENDANTS L'UN DE L'AUTRE, mais
  // dépendent tous deux de `lignes` ci-dessus — d'où ce second `Promise.all`,
  // jamais fondu dans le premier.
  const [annuaire, libellesMachines] = await Promise.all([
    // L'ANNUAIRE PORTE AUSSI LES TECHNICIENS ACTIFS (57-REGISTRE-2), pour le
    // `<select>` du filtre — un technicien dont aucune intervention n'est
    // encore posée n'a sinon aucun nom à proposer (même raisonnement que
    // `personnesANommer` pour la vue jour du planning : la population à
    // nommer est celle des COLONNES, pas seulement celle des lignes).
    avecContexteApplicatif(contexte, (tx) =>
      annuaireDesPersonnes(
        tx,
        personnesANommer(
          lignes,
          techniciensActifs.map((technicien) => ({
            id: technicien.utilisateur_id,
          })),
        ),
      ),
    ),
    // LES LIBELLÉS DE MACHINE — lus une seconde fois, sur les identifiants
    // que les lignes rendues portent déjà (même principe que l'annuaire
    // ci-dessus, et que `libellesDesSites`). AT-07 bis : `machines` était
    // déjà lu par ligne et jamais montré.
    libellesDesMachines(
      contexte,
      lignes.flatMap((ligne) => ligne.machines.map((m) => m.machine_id)),
    ),
  ]);

  const colonnes = [
    {
      cle: "reference",
      libelle: t("intervention.reference"),
      largeur: "120px",
    },
    { cle: "client", libelle: t("intervention.client") },
    // MACHINE SUIT DIRECTEMENT CLIENT — l'ORDRE de la maquette (D125) ;
    // « Site », un ajout réel qu'elle ne dessine pas, la suit plutôt que de
    // s'intercaler (D128 : gardé, jamais supprimé, mais pas au prix de
    // l'ordre que D125 fixe). Gardé par tests/unit/ui/lot-a3.test.ts.
    { cle: "machine", libelle: t("intervention.machine") },
    { cle: "site", libelle: mot("site") },
    {
      cle: "technicien",
      libelle: t("intervention.technicien"),
      largeur: "200px",
    },
    { cle: "date", libelle: t("intervention.date"), largeur: "120px" },
    { cle: "priorite", libelle: t("intervention.priorite"), largeur: "110px" },
    { cle: "statut", libelle: t("intervention.statut"), largeur: "150px" },
  ];

  return (
    <Page
      chemin="/interventions"
      titre={t("interventions.titre")}
      sousTitre={t("interventions.sous_titre")}
      actions={
        <LienPrimaire href="/interventions/nouvelle">
          {t("planning.creer")}
        </LienPrimaire>
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
        LE FILTRE POSÉ PAR LE LIEN DE LA TUILE (AFFICHAGE-MATERIEL-1) — un
        état qui ne vient d'aucune case du formulaire ci-dessous ne doit pas
        rester muet à l'écran, sinon la liste semble filtrée sans raison.
      */}
      {criteres.success && criteres.data.sans_duree_a_venir ? (
        <p
          role="status"
          className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t("interventions.filtre_sans_duree_a_venir")}
        </p>
      ) : null}

      {/* La recherche et les quatre filtres sont un FORMULAIRE `GET` : l'état
          vit dans l'URL, jamais dans un état de composant (AT-07). */}
      <form
        method="get"
        className="bg-app-surface border-app-bord flex flex-wrap items-end gap-3 rounded-lg border px-4 py-3.5"
      >
        <label className="flex flex-col gap-1 text-[12px] font-semibold">
          {t("interventions.recherche")}
          <input
            type="search"
            name="q"
            defaultValue={typeof params.q === "string" ? params.q : ""}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold">
          {libelleFiltreAgence()}
          <select
            name="agence"
            defaultValue={
              typeof params.agence === "string" ? params.agence : ""
            }
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
          >
            <option value="">{optionToutesLesAgences()}</option>
            <OptionsAgence agences={agences} />
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold">
          {t("intervention.type")}
          <select
            name="type"
            defaultValue={typeof params.type === "string" ? params.type : ""}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
          >
            <option value="">{t("interventions.filtre_type_tous")}</option>
            {TYPES_INTERVENTION.map((type) => (
              <option key={type} value={type}>
                {t(`type_intervention.${type}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold">
          {t("intervention.statut")}
          <select
            name="statut"
            defaultValue={
              typeof params.statut === "string" ? params.statut : ""
            }
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
          >
            <option value="">{t("interventions.filtre_statut_tous")}</option>
            {STATUTS_INTERVENTION.map((statut) => (
              <option key={statut} value={statut}>
                {t(`statut.${statut}`)}
              </option>
            ))}
          </select>
        </label>
        {/* LE FILTRE TECHNICIEN (57-REGISTRE-2) — « qu'a-t-il sur les
            bras ? », la question la plus courante du bureau, sans réponse
            avant ce ticket. `"aucun"` porte les interventions sans
            affectation, comme `filtreDesInterventions` le lit. */}
        <label className="flex flex-col gap-1 text-[12px] font-semibold">
          {t("intervention.technicien")}
          <select
            name="technicien"
            defaultValue={
              typeof params.technicien === "string" ? params.technicien : ""
            }
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
          >
            <option value="">
              {t("interventions.filtre_technicien_tous")}
            </option>
            <option value="aucun">
              {t("interventions.filtre_technicien_non_affectees")}
            </option>
            {optionsFiltreTechnicien(techniciensActifs, annuaire).map(
              (option) => (
                <option key={option.valeur} value={option.valeur}>
                  {option.libelle}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold">
          {t("interventions.filtre_periode_du")}
          <input
            type="date"
            name="du"
            defaultValue={typeof params.du === "string" ? params.du : ""}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold">
          {t("interventions.filtre_periode_au")}
          <input
            type="date"
            name="au"
            defaultValue={typeof params.au === "string" ? params.au : ""}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
          />
        </label>
        {/* RG-PLA-08 (D129) : le seul moyen de revoir, depuis ce registre,
            les interventions dont le client est devenu inactif — sans quoi
            leur historique deviendrait inatteignable depuis cet écran.
            L'ÉTAT AFFICHÉ SUIT LE CRITÈRE ANALYSÉ, jamais le paramètre brut :
            `?inclure_clients_inactifs=autre-chose-que-on` retombe à `false`
            dans le schéma (seul `"on"` est reconnu, une case décochée ne
            soumettant rien) — la case doit se lire décochée dans ce cas,
            sous peine de contredire les lignes réellement affichées. */}
        <label className="flex items-center gap-1.5 pb-1.5 text-[12.5px] font-semibold">
          <input
            type="checkbox"
            name="inclure_clients_inactifs"
            defaultChecked={
              criteres.success && criteres.data.inclure_clients_inactifs
            }
          />
          {t("interventions.filtre_inclure_clients_inactifs")}
        </label>
        <button
          type="submit"
          className="border-app-bord rounded-md border px-4 py-2 text-[13px] font-bold"
        >
          {t("interventions.rechercher")}
        </button>
      </form>

      {/* LES TROIS KPI DU BANDEAU — GAP COMBLÉ (audit du 18/09/2026) :
          interventions() de la maquette en pose trois, absents de cet écran.
          Voir `kpiDuRegistre` pour ce que chacun compte RÉELLEMENT — jamais
          les valeurs illustratives de la maquette. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi
          libelle={t("interventions.kpi_semaine")}
          valeur={kpi.planifieesCetteSemaine}
        />
        <Kpi
          ton="vert"
          libelle={t("interventions.kpi_en_cours")}
          valeur={kpi.enCours}
        />
        <Kpi
          ton="orange"
          libelle={t("interventions.kpi_en_attente")}
          valeur={kpi.enAttente}
        />
      </div>

      <section className="bg-app-surface border-app-bord overflow-hidden rounded-lg border">
        <Tableau colonnes={colonnes} minimum="920px">
          {lignes.length === 0 ? (
            <LignePleine colonnes={colonnes.length}>
              {t("interventions.vide")}
            </LignePleine>
          ) : null}
          {lignes.map((ligne) => (
            <LigneIntervention
              key={ligne.id}
              ligne={ligne}
              annuaire={annuaire}
              libellesMachines={libellesMachines}
            />
          ))}
        </Tableau>
      </section>

      <Pagination
        page={criteres.success ? criteres.data.page : 1}
        totalPages={totalPages}
        libelleResultats={decompte(
          totalFiltre,
          t("interventions.resultat_un"),
          t("interventions.resultat"),
        )}
        libellePage={libellePage(
          criteres.success ? criteres.data.page : 1,
          totalPages,
        )}
        libellePrecedent={t("pagination.precedent")}
        libelleSuivant={t("pagination.suivant")}
        hrefPage={(page) =>
          hrefDeLaPage(
            "/interventions",
            {
              q: typeof params.q === "string" ? params.q : undefined,
              agence:
                typeof params.agence === "string" ? params.agence : undefined,
              type: typeof params.type === "string" ? params.type : undefined,
              statut:
                typeof params.statut === "string" ? params.statut : undefined,
              du: typeof params.du === "string" ? params.du : undefined,
              au: typeof params.au === "string" ? params.au : undefined,
              technicien:
                typeof params.technicien === "string"
                  ? params.technicien
                  : undefined,
              // LE CRITÈRE ANALYSÉ, PAS LE PARAMÈTRE BRUT — même raison que
              // la case à cocher ci-dessus : reporter un `?…=autre-chose`
              // tel quel d'une page à l'autre propagerait une valeur que le
              // schéma ne lit pourtant jamais comme « coché ».
              inclure_clients_inactifs:
                criteres.success && criteres.data.inclure_clients_inactifs
                  ? "on"
                  : undefined,
            },
            page,
          )
        }
      />
    </Page>
  );
}

/**
 * LES TROIS KPI DU BANDEAU — GAP COMBLÉ (audit du 18/09/2026) :
 * `interventions()` de la maquette en pose trois (« Planifiées cette
 * semaine », « En cours », « En attente ») et l'écran n'en portait aucun.
 *
 * **Chacun compte un FAIT RÉEL, jamais la valeur illustrative de la
 * maquette** (27, 2, 5) — la même règle que les KPI de `/parc` (R2-21).
 * **Sur TOUTE la société, jamais sur la recherche en cours** : la maquette
 * les dessine au-dessus du formulaire, comme un bandeau fixe — changer un
 * filtre ne doit pas faire bouger ces trois nombres, la même raison que le
 * détail du premier KPI de `/parc` (« sur N machines au total »).
 *
 * - « Planifiées cette semaine » : `date_planifiee` dans la semaine ISO
 *   courante (lundi 00:00 à lundi suivant 00:00 EXCLU), dans le fuseau de la
 *   société — quel que soit le statut, une lecture littérale du libellé qui
 *   n'ajoute aucune condition que le chapitre 10 ne pose pas.
 * - « En cours » : `statut = "en_cours"`, la valeur exacte de
 *   `STATUTS_INTERVENTION`.
 * - « En attente » : `statut = "suspendue"` — RG-INT-06, la file d'attente
 *   de pièce.
 */
async function kpiDuRegistre(contexte: ContexteSession): Promise<{
  readonly planifieesCetteSemaine: number;
  readonly enCours: number;
  readonly enAttente: number;
}> {
  const societe = await avecContexteApplicatif(contexte, (tx) =>
    tx.societe.findFirst({
      where: { id: contexte.societeId as string },
      select: { fuseau_horaire: true },
    }),
  );
  const fuseau = schemaFuseau.parse(societe?.fuseau_horaire);
  const aujourdHui = jourDe(versLocal(maintenant(fuseau).instant, fuseau));
  const lundi = lundiDeLaSemaine(aujourdHui);
  const debutSemaine = instantDuJour(lundi);
  // BORNE EXCLUSIVE — même raison que `listerPlanning` (`lib/interventions/
  // depot.ts`) : `lt` et non `lte`, sans quoi le lundi suivant reviendrait
  // tout entier et la semaine compterait un jour de trop.
  const finSemaine = instantDuJour(lundi, 7);

  return avecContexteApplicatif(contexte, async (tx) => {
    const [planifieesCetteSemaine, enCours, enAttente] = await Promise.all([
      tx.intervention.count({
        where: { date_planifiee: { gte: debutSemaine, lt: finSemaine } },
      }),
      tx.intervention.count({ where: { statut: "en_cours" } }),
      tx.intervention.count({ where: { statut: "suspendue" } }),
    ]);
    return { planifieesCetteSemaine, enCours, enAttente };
  });
}

function LigneIntervention({
  ligne,
  annuaire,
  libellesMachines,
}: {
  readonly ligne: LignePlanning;
  readonly annuaire: Annuaire;
  readonly libellesMachines: ReadonlyMap<string, string>;
}) {
  return (
    <tr>
      <Cellule mono fort>
        <Link
          href={`/interventions/${ligne.id}?depuis=interventions`}
          className={CLASSES_LIEN}
        >
          {referenceAffichee(ligne)}
        </Link>
      </Cellule>
      <Cellule>{ligne.client.raison_sociale}</Cellule>
      <Cellule>{machinesAffichees(ligne, libellesMachines)}</Cellule>
      <Cellule>{ligne.site.libelle}</Cellule>
      <Cellule>{technicienAffiche(ligne, annuaire)}</Cellule>
      <Cellule>
        {ligne.date_planifiee === null
          ? t("planning.file_attente")
          : dateCivile(ligne.date_planifiee)}
      </Cellule>
      <Cellule>
        <Badge ton={TONS_PRIORITE[ligne.priorite]}>
          {t(`priorite.${ligne.priorite}`)}
        </Badge>
      </Cellule>
      <Cellule>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${CLASSES_STATUT[ligne.statut]}`}
        >
          {t(`statut.${ligne.statut}`)}
        </span>
      </Cellule>
    </tr>
  );
}

/**
 * LE TON DE LA PRIORITÉ — dérivé de l'exemple de la maquette
 * (`interventions()`, badge P1 en rouge) pour les deux bornes ; les deux
 * intermédiaires prennent l'orange et le gris, un jugement écrit comme tel.
 */
const TONS_PRIORITE: Record<Priorite, TonBadge> = {
  p1: "rouge",
  p2: "orange",
  p3: "gris",
  p4: "gris",
};

/**
 * LE TECHNICIEN AFFECTÉ — `quiTravaille` distingue déjà le refus légitime du
 * cloisonnement de l'oubli de l'écran (D88) ; seul le cas SANS AFFECTATION
 * change de libellé ici, parce que « Interventions non affectées » — le
 * pluriel d'une ligne de REGROUPEMENT du planning — n'a pas de sens répété
 * ligne à ligne dans un registre où chaque ligne est une seule intervention.
 */
function technicienAffiche(ligne: LignePlanning, annuaire: Annuaire): string {
  return ligne.technicien_id === null
    ? t("intervention.aucun_technicien")
    : quiTravaille(ligne.technicien_id, annuaire);
}
