import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { peut } from "@/lib/auth/habilitations";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import {
  cleJour,
  dateCivile,
  instantDuJour,
  jourDe,
  maintenant,
  schemaFuseau,
} from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { classeurDUneFeuille, nomDuFichierExport } from "@/lib/excel/export";
import { t } from "@/lib/i18n/fr";
import { libelleEcheance, libelleEtatCourt } from "@/lib/vgp/libelles";
import {
  echeanceDepassee,
  echeanceEstAVenir,
  estSansInformation,
  listerLeRegistrePourExport,
  rechercheCorrespond,
  type LigneDeRegistre,
} from "@/lib/vgp/registre";

const ABSENT = "—";

/** Même lecture tolérante que `/vgp` (page.tsx) : une valeur inconnue retombe à « tous », jamais une erreur. */
const ETATS_FILTRE = ["depassees", "a_venir", "sans_information"] as const;
type EtatFiltre = (typeof ETATS_FILTRE)[number] | "tous";
function etatFiltreLu(valeur: string | null): EtatFiltre {
  return valeur !== null && (ETATS_FILTRE as readonly string[]).includes(valeur)
    ? (valeur as EtatFiltre)
    : "tous";
}

/**
 * LE MÊME FILTRE QUE `/vgp` (D122, VGP-4, TP-A2) — état, client, site puis
 * texte, composé depuis les QUATRE prédicats déjà partagés (`echeanceDepassee`,
 * `echeanceEstAVenir`, `estSansInformation`, `rechercheCorrespond`,
 * `lib/vgp/registre.ts`) : cette fonction ne réécrit AUCUNE règle, elle les
 * compose dans le même ordre que `/vgp` (page.tsx) le fait déjà.
 */
function filtrerPourExport(
  lignes: readonly LigneDeRegistre[],
  criteres: {
    readonly etat: EtatFiltre;
    readonly texte: string;
    readonly clientId: string | null;
    readonly siteId: string | null;
  },
): readonly LigneDeRegistre[] {
  const parEtat =
    criteres.etat === "depassees"
      ? lignes.filter((ligne) => echeanceDepassee(ligne.information))
      : criteres.etat === "a_venir"
        ? lignes.filter((ligne) => echeanceEstAVenir(ligne.information))
        : criteres.etat === "sans_information"
          ? lignes.filter((ligne) => estSansInformation(ligne.information))
          : lignes;
  return parEtat
    .filter(
      (ligne) =>
        criteres.clientId === null || ligne.clientId === criteres.clientId,
    )
    .filter(
      (ligne) => criteres.siteId === null || ligne.siteId === criteres.siteId,
    )
    .filter((ligne) => rechercheCorrespond(ligne, criteres.texte));
}

/** « Marque modèle » — même composition que `referenceMachineAffichee`, recopiée (même retenue que `/vgp`, page.tsx). */
function machineAffichee(ligne: LigneDeRegistre): string {
  return `${ligne.numero_serie} · ${ligne.marque} ${ligne.modele} · ${ligne.famille}`;
}

function dernierControleAffiche(ligne: LigneDeRegistre): string {
  return ligne.information.etat === "information_recue"
    ? dateCivile(ligne.information.derniereInformation)
    : ABSENT;
}

/**
 * `GET /api/vgp/exporter` — LE REGISTRE DES VGP, EN `.xlsx` (MO-9, D169).
 *
 * **Mêmes paramètres d'adresse que `/vgp`** — `etat`, `q`, `client`, `site` ;
 * `groupe` et `page` sont ignorés : l'export rend TOUTES les lignes du
 * filtre, jamais la seule page affichée, ni le regroupement par client qui
 * ne change aucune colonne. **Le même filtre que `/vgp`** — les mêmes quatre
 * prédicats partagés (`lib/vgp/registre.ts`), composés dans le même ordre
 * (`filtrerPourExport` ci-dessous).
 *
 * **Deux capacités, comme D150** — `importer_exporter` ET `consulter_parc_complet`,
 * la capacité de lecture que `nav.vgp` exige déjà (`lib/navigation/entrees.ts`).
 */
export async function GET(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapacite("importer_exporter");
  if (contexte === null || !peut(contexte.role, "consulter_parc_complet")) {
    return Response.json({ motif: await motifDuRefus() }, { status: 403 });
  }

  const societe = await avecContexteApplicatif(contexte, (tx) =>
    tx.societe.findFirst({
      where: { id: contexte.societeId },
      select: { fuseau_horaire: true },
    }),
  );
  const fuseau = schemaFuseau.parse(societe?.fuseau_horaire);
  const aujourdHui = instantDuJour(jourDe(maintenant(fuseau).local));

  const url = new URL(requete.url);
  const clientId = url.searchParams.get("client");
  const siteId = url.searchParams.get("site");
  const toutesLesLignes = await listerLeRegistrePourExport(
    contexte,
    aujourdHui,
  );
  const lignes = filtrerPourExport(toutesLesLignes, {
    etat: etatFiltreLu(url.searchParams.get("etat")),
    texte: url.searchParams.get("q") ?? "",
    clientId: clientId !== null && clientId.length > 0 ? clientId : null,
    siteId: siteId !== null && siteId.length > 0 ? siteId : null,
  });

  const entetes = [
    t("vgp.colonne_machine"),
    t("vgp.colonne_client"),
    t("vgp.colonne_dernier_controle"),
    t("vgp.colonne_echeance"),
    t("vgp.colonne_etat"),
  ];
  const corps = lignes.map((ligne) => [
    machineAffichee(ligne),
    `${ligne.client} · ${ligne.site}`,
    dernierControleAffiche(ligne),
    libelleEcheance(ligne.information) ?? ABSENT,
    libelleEtatCourt(ligne.information),
  ]);

  const classeur = await classeurDUneFeuille(entetes, corps);
  const jourIso = cleJour(jourDe(maintenant(fuseau).local));
  return new Response(new Uint8Array(classeur), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomDuFichierExport("vgp", jourIso)}"`,
    },
  });
}
