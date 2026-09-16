import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LienPrimaire } from "@/components/ui/action-primaire";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { annuaireDesPersonnes, type Annuaire } from "@/lib/auth/annuaire";
import { obtenirSession } from "@/lib/auth/session";
import { dateCivile } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  listerInterventions,
  type LignePlanning,
} from "@/lib/interventions/depot";
import { personnesANommer, quiTravaille } from "@/lib/interventions/personnes";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { CLASSES_STATUT } from "@/lib/theme/statuts";

import { referenceAffichee } from "./presentation";

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
 * ## LA LISTE EST BORNÉE, ET L'ÉCRAN LE DIT
 *
 * Comme `/clients` (L1-01) : une liste non bornée casse au volume sur un parc
 * de démonstration qui porte 226 machines et 615 clients. La recherche, le
 * filtre et la pagination sont un autre ticket ; celui-ci se contente de ne
 * pas mentir sur ce qu'il montre (`interventions.borne`, sous le tableau).
 *
 * ## LE CLOISONNEMENT N'EST PAS ÉCRIT ICI
 *
 * `listerInterventions` lit sous le contexte cloisonné, et la forme « parc »
 * décide. Une comparaison de société écrite au-dessus serait une seconde
 * lecture d'un même critère, et c'est celle qui vieillit sans rougir.
 */

/** Ce que l'écran rend. Une BORNE D'AFFICHAGE, jamais un cloisonnement. */
const INTERVENTIONS_MONTREES = 200;

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
  const motif = (await searchParams).motif;

  const lignes = await listerInterventions(
    session.contexte,
    INTERVENTIONS_MONTREES,
  );
  // L'UNION des identités que CETTE liste doit nommer est celle des LIGNES
  // rendues, et rien d'autre : à la différence de la vue jour du planning,
  // aucune colonne ne provient d'un référentiel vide à remplir.
  const annuaire = await avecContexteApplicatif(session.contexte, (tx) =>
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
    <main className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">
            {t("interventions.titre")}
          </h1>
          <p className="text-app-encre-faible text-[13px]">
            {t("interventions.sous_titre")}
          </p>
        </div>
        <LienPrimaire href="/interventions/nouvelle">
          {t("planning.creer")}
        </LienPrimaire>
      </header>

      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(motif)}
        </p>
      ) : null}

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

      <p className="text-app-encre-faible text-[11.5px]">
        {t("interventions.borne")}
      </p>
    </main>
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
