import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Carte } from "@/components/ui/carte";
import { Kpi } from "@/components/ui/kpi";
import { Page } from "@/components/mise-en-page/page";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { absencesDeLaPeriode } from "@/lib/absences/depot";
import { annuaireDesPersonnes, type Annuaire } from "@/lib/auth/annuaire";
import { obtenirSession } from "@/lib/auth/session";
import {
  instantDuJour,
  jourDe,
  maintenant,
  schemaFuseau,
} from "@/lib/calendar/fuseau";
import { schemaRechercheClient } from "@/lib/clients";
import {
  compterSansCodeExterne,
  libelleCodeExterneDeLaSociete,
} from "@/lib/clients/depot";
import { avecContexteApplicatif } from "@/lib/db/client";
import { demandesOuvertes } from "@/lib/demandes/depot";
import { t } from "@/lib/i18n/fr";
import {
  enAttenteDePiece,
  listerPlanning,
  type LignePlanning,
} from "@/lib/interventions/depot";
import { personnesANommer, quiTravaille } from "@/lib/interventions/personnes";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { CLASSES_STATUT } from "@/lib/theme/statuts";

import { titreSansCode } from "../clients/presentation";
import { referenceAffichee } from "../interventions/presentation";

import {
  detailEnAttenteDePiece,
  detailInterventionsDuJour,
  interventionsDuJour,
  techniciensIndisponibles,
} from "./presentation";

/**
 * LE TABLEAU DE BORD (AV-10) — le premier écran de la maquette (D95, R2-13),
 * enfin un ÉCRAN, pas une entrée inerte.
 *
 * ## CE QUE CE TICKET RÉPARE
 *
 * `pnpm chemins` mesure cinq fonctions de dépôt déjà écrites et **sans aucun
 * chemin depuis `app/`** — la maladie exacte que R3-12 nomme pour le parc et
 * les clients, ici pour l'exploitation du jour : `enAttenteDePiece`,
 * `demandesOuvertes`, `absencesDeLaPeriode` et `compterSansCodeExterne`
 * n'avaient AUCUN appelant ; `listerPlanning` en avait déjà (planning,
 * terrain), mais aucun ne comptait « aujourd'hui ». Cet écran est le premier
 * appelant des quatre premières, et un appelant SUPPLÉMENTAIRE de la
 * cinquième.
 *
 * ## LE SIXIÈME CHIFFRE N'EXISTE NULLE PART, ET IL NE S'INVENTE PAS (§8)
 *
 * R2-13 reste BLOQUÉ sur trois indicateurs qui supposent le lot 4 : *taux
 * d'occupation consolidé, préventif dans les délais, portefeuille de
 * contrats.* Rien ici ne les débloque — le calcul de
 * `lib/interventions/statistiques.ts` rend un taux PAR TECHNICIEN, déjà
 * appelé par `/planning` ; agréger plusieurs techniciens et plusieurs
 * calendriers d'agence en UN SEUL taux consolidé n'est écrit nulle part au
 * chapitre 10. La carte « Taux d'occupation » l'affiche donc `Non calculé`,
 * avec son motif — jamais un zéro, jamais un tiret : les deux se liraient
 * comme une mesure (doctrine §3).
 *
 * ## CE QUE LA MAQUETTE MONTRE ET QUE CET ÉCRAN NE MONTRE PAS ENCORE, NOMMÉ
 *
 * « Alertes », « Répartition par type », « Parc machines suivi » et
 * « Qualité de service » n'ont, à ce jour, aucune source qui ne soit soit
 * hors du périmètre de ce ticket (le parc, les sites, les clients — une autre
 * session y travaille), soit dépendante du lot 4 (contrats, préconisations).
 * Les ajouter aurait recopié un chiffre déjà affiché ailleurs ou inventé une
 * mesure : l'écart est écrit ici plutôt que tu (D95, §1 du CLAUDE.md).
 *
 * ## CE QUE CET ÉCRAN AJOUTE, ET QUI N'EST PAS DANS LA MAQUETTE
 *
 * « Demandes en attente de qualification » et « Techniciens indisponibles
 * aujourd'hui » ne figurent pas sur la maquette de 2026 : ce sont deux
 * fonctions de dépôt déjà écrites (`demandesOuvertes`, `absencesDeLaPeriode`)
 * dont aucun écran ne porte encore la lecture, et elles répondent à la même
 * question que le reste du bandeau — *qu'est-ce qui attend une décision
 * aujourd'hui ?*
 *
 * ## AUCUNE COMPARAISON DE SOCIÉTÉ N'EST ÉCRITE ICI
 *
 * Chaque lecture passe par son dépôt, sous le contexte cloisonné ; la forme
 * « parc » ou « interne » de chaque table décide, et rien n'est recomparé
 * au-dessus (§9, 01/09).
 */
export default async function PageTableauDeBord() {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }
  const contexte = session.contexte;

  // LE FUSEAU EST UNE DONNÉE, JAMAIS UN LITTÉRAL (L0-08) — le même geste que
  // `/parc` et `/vgp`.
  const societe = await avecContexteApplicatif(contexte, (tx) =>
    tx.societe.findFirst({
      where: { id: contexte.societeId as string },
      select: { fuseau_horaire: true },
    }),
  );
  const fuseau = schemaFuseau.parse(societe?.fuseau_horaire);
  const { instant, local } = maintenant(fuseau);
  const jour = jourDe(local);
  const debutDuJour = instantDuJour(jour);
  const finDuJour = instantDuJour(jour, 1);

  const [lignesPlanning, enAttente, demandes, absences, sansCodeExterne] =
    await Promise.all([
      listerPlanning(contexte, debutDuJour, finDuJour),
      enAttenteDePiece(contexte, instant),
      demandesOuvertes(contexte),
      absencesDeLaPeriode(contexte, debutDuJour, debutDuJour),
      compterSansCodeExterne(contexte, schemaRechercheClient.parse({})),
    ]);
  const libelleSociete = await libelleCodeExterneDeLaSociete(contexte);

  const lignesDuJour = interventionsDuJour(
    lignesPlanning,
    debutDuJour,
    finDuJour,
  );
  const annuaire = await avecContexteApplicatif(contexte, (tx) =>
    annuaireDesPersonnes(tx, personnesANommer(lignesDuJour, [])),
  );

  return (
    <Page
      titre={t("tableau_de_bord.titre")}
      sousTitre={t("tableau_de_bord.sous_titre")}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi
          libelle={t("tableau_de_bord.kpi_interventions_jour")}
          valeur={lignesDuJour.length}
          detail={detailInterventionsDuJour(lignesDuJour)}
        />
        <Kpi
          ton="rouge"
          libelle={t("tableau_de_bord.kpi_en_attente_piece")}
          valeur={enAttente.length}
          detail={detailEnAttenteDePiece(enAttente)}
        />
        <Kpi
          libelle={t("tableau_de_bord.kpi_demandes_ouvertes")}
          valeur={demandes.length}
        />
        <Kpi
          ton="orange"
          libelle={t("tableau_de_bord.kpi_absences_jour")}
          valeur={techniciensIndisponibles(absences)}
        />
        <Kpi libelle={titreSansCode(libelleSociete)} valeur={sansCodeExterne} />
        <Kpi
          libelle={t("tableau_de_bord.kpi_taux_occupation")}
          valeur={t("tableau_de_bord.taux_occupation_non_calcule")}
          detail={t("tableau_de_bord.taux_occupation_motif")}
        />
      </div>

      <Carte
        titre={t("tableau_de_bord.kpi_interventions_jour")}
        action={{
          libelle: t("tableau_de_bord.lien_planning"),
          href: "/planning",
        }}
      >
        <Tableau colonnes={COLONNES()} minimum="720px">
          {lignesDuJour.length === 0 ? (
            <LignePleine colonnes={4}>
              {t("tableau_de_bord.interventions_jour_vide")}
            </LignePleine>
          ) : null}
          {lignesDuJour.map((ligne) => (
            <LigneDuJour key={ligne.id} ligne={ligne} annuaire={annuaire} />
          ))}
        </Tableau>
      </Carte>
    </Page>
  );
}

function COLONNES() {
  return [
    {
      cle: "reference",
      libelle: t("intervention.reference"),
      largeur: "120px",
    },
    { cle: "client", libelle: t("intervention.client") },
    {
      cle: "technicien",
      libelle: t("intervention.technicien"),
      largeur: "200px",
    },
    { cle: "statut", libelle: t("intervention.statut"), largeur: "150px" },
  ];
}

function LigneDuJour({
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
      <Cellule>
        {ligne.technicien_id === null
          ? t("intervention.aucun_technicien")
          : quiTravaille(ligne.technicien_id, annuaire)}
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
