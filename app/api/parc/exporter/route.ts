import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { peut } from "@/lib/auth/habilitations";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import {
  cleJour,
  instantDuJour,
  jourDe,
  maintenant,
  schemaFuseau,
} from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { classeurDUneFeuille, nomDuFichierExport } from "@/lib/excel/export";
import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  rechercherLeParcPourExport,
  type LigneDeParc,
} from "@/lib/machines/depot";
import { schemaRechercheParc } from "@/lib/machines/saisie";

/** Le signe d'absence — même convention que `/parc` (page.tsx), non partagée (choix du dépôt, voir `referenceMachine`). */
const ABSENT = "—";

function referenceMachine(machine: {
  id: string;
  numero: number | null;
}): string {
  if (machine.numero !== null) {
    return `MAC-${String(machine.numero).padStart(6, "0")}`;
  }
  return `Local-${machine.id.replaceAll("-", "").slice(-6).toUpperCase()}`;
}

function lieuAffiche(machine: LigneDeParc): string {
  const commune = machine.site.commune;
  const libelle = machine.site.libelle;
  return commune === null || commune === libelle
    ? libelle
    : `${libelle} — ${commune}`;
}

function anneeDeVenteAffichee(machine: LigneDeParc): string {
  return machine.date_vente === null
    ? ABSENT
    : String(machine.date_vente.getUTCFullYear());
}

/**
 * `GET /api/parc/exporter` — LE PARC MACHINES, EN `.xlsx` (MO-9, D169).
 *
 * **Mêmes paramètres d'adresse que `/parc`**, `page` ignoré : l'export rend
 * TOUTES les fiches du filtre (`rechercherLeParcPourExport`, sans
 * `skip`/`take`), jamais la seule page affichée.
 *
 * **Deux capacités, comme D150** — `importer_exporter` ET `consulter_parc_complet`,
 * la capacité de lecture que `nav.parc_machines` exige déjà
 * (`lib/navigation/entrees.ts`) : le `peut()` de la matrice, jamais un niveau
 * inventé pour cette seule route. `/parc` lui-même ne porte aucune garde de
 * capacité (le périmètre par personne, QT-2, suffit à son accès) — cette
 * route ne lui en ajoute pas, elle ajoute `importer_exporter`, qui gouverne
 * l'EXPORT, pas la lecture de l'écran.
 */
export async function GET(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapacite("importer_exporter");
  if (contexte === null || !peut(contexte.role, "consulter_parc_complet")) {
    return Response.json({ motif: await motifDuRefus() }, { status: 403 });
  }

  const url = new URL(requete.url);
  const criteres = schemaRechercheParc.safeParse({
    texte: url.searchParams.get("q") ?? "",
    statut: url.searchParams.get("statut") ?? undefined,
    client_id: url.searchParams.get("client") || null,
    site_id: url.searchParams.get("site") || null,
    famille_id: url.searchParams.get("famille") || null,
    // LES QUATRE AUTRES CRITÈRES DE `hrefExportParc` (9EB-TP-UX3-2-LISTES-2)
    // — `vue` et les trois filtres de 9DT : sans eux, exporter depuis une
    // vue ou un lien d'indicateur rendrait un fichier dont les lignes ne
    // correspondent PLUS à celles de l'écran qui l'a ouvert (« mêmes id »,
    // mesuré par ce ticket).
    vue: url.searchParams.get("vue") ?? undefined,
    incompletes: url.searchParams.get("incompletes") ?? undefined,
    ajoutee_du: url.searchParams.get("ajoutee_du") ?? "",
    ajoutee_au: url.searchParams.get("ajoutee_au") ?? "",
    origine: url.searchParams.get("origine") ?? "",
  });
  if (!criteres.success) {
    return Response.json({ erreur: "requete_invalide" }, { status: 400 });
  }

  const societe = await avecContexteApplicatif(contexte, (tx) =>
    tx.societe.findFirst({
      where: { id: contexte.societeId },
      select: { fuseau_horaire: true },
    }),
  );
  const fuseau = schemaFuseau.parse(societe?.fuseau_horaire);
  // LE JOUR CIVIL DE LA SOCIÉTÉ (9EB-TP-UX3-2-LISTES-2) — la vue « garantie »
  // en a besoin, même raison que `/parc` (page.tsx).
  const aujourdHui = instantDuJour(jourDe(maintenant(fuseau).local));
  const lignes = await rechercherLeParcPourExport(
    contexte,
    criteres.data,
    aujourdHui,
  );

  const entetes = [
    t("parc.export_colonne_reference"),
    t("parc.kv_client"),
    mot("site"),
    mot("agence"),
    t("parc.kv_famille"),
    t("parc.export_colonne_marque"),
    t("parc.export_colonne_reference_modele"),
    t("parc.kv_serie"),
    t("parc.export_colonne_annee_vente"),
    t("parc.export_colonne_statut"),
  ];
  const corps = lignes.map((ligne) => [
    referenceMachine(ligne),
    ligne.client.raison_sociale,
    lieuAffiche(ligne),
    ligne.site.agence.libelle,
    ligne.modele.famille?.libelle ?? ABSENT,
    ligne.modele.marque,
    ligne.modele.reference,
    ligne.complet ? ligne.numero_serie : ABSENT,
    anneeDeVenteAffichee(ligne),
    t(`statut_machine.${ligne.statut}`),
  ]);

  const classeur = await classeurDUneFeuille(entetes, corps);
  const jourIso = cleJour(jourDe(maintenant(fuseau).local));
  return new Response(new Uint8Array(classeur), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomDuFichierExport("parc", jourIso)}"`,
    },
  });
}
