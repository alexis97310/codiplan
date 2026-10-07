import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { peut } from "@/lib/auth/habilitations";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import {
  cleJour,
  dateCivile,
  jourDe,
  maintenant,
  schemaFuseau,
} from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { classeurDUneFeuille, nomDuFichierExport } from "@/lib/excel/export";
import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import { annuaireDesPersonnes } from "@/lib/auth/annuaire";
import { listerInterventionsPourExport } from "@/lib/interventions/depot";
import { personnesANommer, quiTravaille } from "@/lib/interventions/personnes";
import { schemaRechercheInterventions } from "@/lib/interventions/saisie";
import { libellesDesMachines } from "@/lib/machines/depot";

import {
  machinesAffichees,
  motifCriteresInvalides,
  referenceAffichee,
} from "@/app/(back-office)/interventions/presentation";

/**
 * `GET /api/interventions/exporter` — LE REGISTRE DES INTERVENTIONS, EN
 * `.xlsx` (MO-9, D169).
 *
 * **Mêmes paramètres d'adresse que `/interventions`** — ce fichier parse la
 * même recherche (`schemaRechercheInterventions`), pour que le bouton
 * exporte exactement le filtre courant, jamais un second critère. `page` est
 * ignoré : l'export rend TOUTES les lignes du filtre, pas la seule page
 * affichée (`listerInterventionsPourExport`, sans `skip`/`take`).
 *
 * **Deux capacités, comme D150** — `importer_exporter` ET la capacité de
 * lecture de l'écran, `consulter_planning` (le niveau de la MATRICE, `peut`,
 * jamais `peutPleinement` : cette porte ne ferme pas plus que la matrice ne
 * le fait déjà). Le périmètre par personne (QT-2, D152) reste appliqué par
 * `listerInterventionsPourExport` lui-même — même défense que
 * `filtreDesInterventions`, pour le jour où un rôle recevrait `○` sur les
 * deux capacités à la fois.
 */
export async function GET(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const versLeRegistre = (cle: string): Response =>
    new Response(null, {
      status: 303,
      headers: { Location: `/interventions?motif=${encodeURIComponent(cle)}` },
    });

  const contexte = await exigerCapacite("importer_exporter");
  if (contexte === null || !peut(contexte.role, "consulter_planning")) {
    return versLeRegistre(await motifDuRefus());
  }

  const url = new URL(requete.url);
  const criteres = schemaRechercheInterventions.safeParse({
    texte: url.searchParams.get("q") ?? "",
    agence_id: url.searchParams.get("agence") ?? "",
    type: url.searchParams.get("type") ?? "",
    statut: url.searchParams.get("statut") ?? "",
    du: url.searchParams.get("du") ?? "",
    au: url.searchParams.get("au") ?? "",
    technicien: url.searchParams.get("technicien") ?? "",
    inclure_clients_inactifs:
      url.searchParams.get("inclure_clients_inactifs") ?? undefined,
    sans_duree_a_venir: url.searchParams.get("sans_duree_a_venir") ?? undefined,
    // LA PRIORITÉ, LE SUIVI, ET LES BORNES DE CRÉATION/CLÔTURE
    // (TP-UX3-1-REGISTRE-1 ; 9DT) — les MÊMES paramètres que la page, jamais
    // un sous-ensemble : l'export doit recevoir exactement le filtre que la
    // page applique (§9, 01/09).
    priorite: url.searchParams.get("priorite") ?? "",
    suivi: url.searchParams.get("suivi") ?? undefined,
    cree_du: url.searchParams.get("cree_du") ?? "",
    cree_au: url.searchParams.get("cree_au") ?? "",
    cloturee_du: url.searchParams.get("cloturee_du") ?? "",
    cloturee_au: url.searchParams.get("cloturee_au") ?? "",
    vue: url.searchParams.get("vue") ?? undefined,
    // LA SÉLECTION DU REGISTRE (TP-UX3-1-REGISTRE-2) — un paramètre `id`
    // RÉPÉTÉ (`getAll`, jamais `get` : cette route ne lisait jusqu'ici que
    // sa propre liste fermée de paramètres, aucun `id`), posé par
    // `components/ui/barre-selection.tsx` sur les lignes cochées, ajouté au
    // filtre UNIQUE (`filtreDesInterventions`) plutôt qu'une seconde
    // lecture.
    id: url.searchParams.getAll("id"),
  });
  if (!criteres.success) {
    return versLeRegistre(motifCriteresInvalides(criteres.error));
  }

  const lignes = await listerInterventionsPourExport(contexte, criteres.data);

  const [societe, libellesMachines] = await Promise.all([
    avecContexteApplicatif(contexte, (tx) =>
      tx.societe.findFirst({
        where: { id: contexte.societeId },
        select: { fuseau_horaire: true },
      }),
    ),
    libellesDesMachines(
      contexte,
      lignes.flatMap((ligne) => ligne.machines.map((m) => m.machine_id)),
    ),
  ]);
  const fuseau = schemaFuseau.parse(societe?.fuseau_horaire);
  const annuaire = await avecContexteApplicatif(contexte, (tx) =>
    annuaireDesPersonnes(tx, personnesANommer(lignes, [])),
  );

  const entetes = [
    t("intervention.reference"),
    t("intervention.client"),
    t("intervention.machine"),
    mot("site"),
    t("intervention.technicien"),
    t("intervention.date"),
    t("intervention.priorite"),
    t("intervention.statut"),
  ];
  const corps = lignes.map((ligne) => [
    referenceAffichee(ligne),
    ligne.client.raison_sociale,
    machinesAffichees(ligne, libellesMachines),
    ligne.site.libelle,
    ligne.technicien_id === null
      ? t("intervention.aucun_technicien")
      : quiTravaille(ligne.technicien_id, annuaire),
    ligne.date_planifiee === null
      ? t("planning.file_attente")
      : dateCivile(ligne.date_planifiee),
    t(`priorite.${ligne.priorite}`),
    t(`statut.${ligne.statut}`),
  ]);

  const classeur = await classeurDUneFeuille(entetes, corps);
  const jourIso = cleJour(jourDe(maintenant(fuseau).local));
  return new Response(new Uint8Array(classeur), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomDuFichierExport("interventions", jourIso)}"`,
    },
  });
}
