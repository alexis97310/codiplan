import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { classeurDesRejets } from "@/lib/excel/ecriture";
import { lireLeLot } from "@/lib/imports/depot";
import { t } from "@/lib/i18n/fr";

import { cleDuMotif } from "@/app/(back-office)/imports/types";

/**
 * `GET /api/imports/{id}/rejets` — LE FICHIER ANNOTÉ DES REJETS (RG-IMP-03).
 *
 * **Elle ne recalcule rien** — même règle que le rapport à l'écran (§9,
 * 01/09) : les lignes viennent de `import_lot_ligne`, avec le motif que
 * `controlerFeuille` a déjà tranché, et le libellé français vient de
 * `cleDuMotif` — la MÊME fonction que l'écran appelle, pour le MÊME lot. *Deux
 * traductions écrites séparément divergeraient au premier motif ajouté.*
 *
 * **Le refus revient sur le lot, comme `appliquer` et `annuler`** : un lot
 * introuvable ou d'une autre société rend le même refus (D35, D50), et
 * l'écran qui a offert ce lien est celui qui affichera pourquoi il a échoué.
 */
export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(_requete, params));
}

async function traiter(
  _requete: Request,
  params: Promise<{ id: string }>,
): Promise<Response> {
  const { id } = await params;
  const versLeLot = (cle: string): Response =>
    new Response(null, {
      status: 303,
      headers: {
        Location: `/imports/${encodeURIComponent(id)}?motif=${encodeURIComponent(cle)}`,
      },
    });

  const contexte = await exigerCapacite("importer_exporter");
  if (contexte === null) {
    return versLeLot("auth.refus");
  }

  const lot = await lireLeLot(contexte, id);
  if (lot === null) {
    return versLeLot("imports.refus.lot_introuvable");
  }

  const rejetees = lot.lignes.filter((ligne) => ligne.action === "rejet");
  const lignes = rejetees.map((ligne) => {
    const cleMotif =
      ligne.rejetMotif === null
        ? null
        : cleDuMotif(ligne.rejetMotif, lot.typeImport);
    return {
      // Même conversion que l'application (`lib/imports/application.ts`) : la
      // colonne est un JSON de chaînes, posée telle quelle par le contrôle.
      valeurs: ligne.valeurs as Record<string, string | undefined>,
      motifLisible: cleMotif === null ? (ligne.rejetMotif ?? "") : t(cleMotif),
    };
  });

  const classeur = await classeurDesRejets(
    lot.typeImport,
    lot.versionModele,
    lignes,
  );

  return new Response(new Uint8Array(classeur), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rejets-${lot.id}.xlsx"`,
    },
  });
}
