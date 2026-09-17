import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { LienPrimaire } from "@/components/ui/action-primaire";
import { Pagination } from "@/components/ui/pagination";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { annuaireDesPersonnes, type Annuaire } from "@/lib/auth/annuaire";
import { obtenirSession } from "@/lib/auth/session";
import { dateCivile } from "@/lib/calendar/fuseau";
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
} from "@/lib/interventions/saisie";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { CLASSES_STATUT } from "@/lib/theme/statuts";

import { decompte, hrefDeLaPage, libellePage } from "../presentation";
import {
  libelleFiltreAgence,
  optionToutesLesAgences,
  referenceAffichee,
} from "./presentation";

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
 * ## LA LISTE PAGINE, LA RECHERCHE ET LES FILTRES SONT REMPLIS (AT-07, 17/09/2026)
 *
 * Comme `/clients` (L1-01) : une liste non bornée casse au volume sur un parc
 * de démonstration qui porte 226 machines et 615 clients. Le texte cherche sur
 * le client et le lieu — les colonnes VISIBLES qui identifient une ligne,
 * jamais sur la référence affichée (`INT-00312` ou `Local-XXXXXX`, qui n'est
 * pas une colonne stockée) ni sur le technicien (dont le nom vit dans
 * l'annuaire, pas sur `intervention`). Les quatre filtres sont ceux que la
 * maquette annonce : agence, type, statut, période — et eux seuls.
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

  // LES AGENCES DU FILTRE — sous le contexte cloisonné, comme
  // `sites/nouveau/page.tsx` le fait déjà pour son propre sélecteur.
  const agences = await avecContexteApplicatif(contexte, (tx) =>
    tx.agence.findMany({
      select: { id: true, libelle: true },
      orderBy: [{ libelle: "asc" }, { id: "asc" }],
    }),
  );

  const criteres = schemaRechercheInterventions.safeParse({
    texte: typeof params.q === "string" ? params.q : "",
    agence_id: typeof params.agence === "string" ? params.agence : "",
    type: typeof params.type === "string" ? params.type : "",
    statut: typeof params.statut === "string" ? params.statut : "",
    du: typeof params.du === "string" ? params.du : "",
    au: typeof params.au === "string" ? params.au : "",
    page: typeof params.page === "string" ? params.page : undefined,
  });

  const lignes = criteres.success
    ? await listerInterventions(contexte, criteres.data)
    : [];
  // LE TOTAL DE LA PAGINATION — la MÊME `filtreDesInterventions` que la
  // liste, jamais une seconde lecture divergente du critère (AT-07).
  const totalFiltre = criteres.success
    ? await compterInterventions(contexte, criteres.data)
    : 0;
  const totalPages = Math.max(
    1,
    Math.ceil(totalFiltre / LIMITE_RECHERCHE_PAR_DEFAUT),
  );
  // L'UNION des identités que CETTE liste doit nommer est celle des LIGNES
  // rendues, et rien d'autre : à la différence de la vue jour du planning,
  // aucune colonne ne provient d'un référentiel vide à remplir.
  const annuaire = await avecContexteApplicatif(contexte, (tx) =>
    annuaireDesPersonnes(tx, personnesANommer(lignes, [])),
  );

  const colonnes = [
    {
      cle: "reference",
      libelle: t("intervention.reference"),
      largeur: "120px",
    },
    { cle: "client", libelle: t("intervention.client") },
    { cle: "site", libelle: mot("site") },
    { cle: "statut", libelle: t("intervention.statut"), largeur: "150px" },
    {
      cle: "technicien",
      libelle: t("intervention.technicien"),
      largeur: "200px",
    },
    { cle: "date", libelle: t("intervention.date"), largeur: "120px" },
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

      {/* La recherche et les quatre filtres sont un FORMULAIRE `GET` : l'état
          vit dans l'URL, jamais dans un état de composant (AT-07). */}
      <form
        method="get"
        className="bg-app-surface border-app-bord flex flex-wrap items-end gap-3 rounded-[10px] border px-4 py-3.5"
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
            {agences.map((agence) => (
              <option key={agence.id} value={agence.id}>
                {agence.libelle}
              </option>
            ))}
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
        <button
          type="submit"
          className="border-app-bord rounded-md border px-4 py-2 text-[13px] font-bold"
        >
          {t("interventions.rechercher")}
        </button>
      </form>

      <section className="bg-app-surface border-app-bord overflow-hidden rounded-[10px] border">
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
            },
            page,
          )
        }
      />
    </Page>
  );
}

function LigneIntervention({
  ligne,
  annuaire,
}: {
  readonly ligne: LignePlanning;
  readonly annuaire: Annuaire;
}) {
  return (
    <tr>
      <Cellule mono fort>
        <Link href={`/interventions/${ligne.id}`} className={CLASSES_LIEN}>
          {referenceAffichee(ligne)}
        </Link>
      </Cellule>
      <Cellule>{ligne.client.raison_sociale}</Cellule>
      <Cellule>{ligne.site.libelle}</Cellule>
      <Cellule>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${CLASSES_STATUT[ligne.statut]}`}
        >
          {t(`statut.${ligne.statut}`)}
        </span>
      </Cellule>
      <Cellule>{technicienAffiche(ligne, annuaire)}</Cellule>
      <Cellule>
        {ligne.date_planifiee === null
          ? t("planning.file_attente")
          : dateCivile(ligne.date_planifiee)}
      </Cellule>
    </tr>
  );
}

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
