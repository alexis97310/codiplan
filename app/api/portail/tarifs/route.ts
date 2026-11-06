import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { formatMoney } from "@/lib/money";

import { contextePortailTarifs, refusPortailTarifs } from "./contexte";
import { lireBaremePortail } from "./lecture";

/**
 * GET /api/portail/tarifs — LE BARÈME, JAMAIS LE MONTANT D'UNE INTERVENTION
 * (9J20-PORTAIL-GRILLE-TARIFAIRE, CLI-7, décision verbatim d'Alexis :
 * « les montants (tous nos tarifs d'intervention) doivent être indiqués sur
 * la page client », option A — le barème seul).
 *
 * **« Afficher les montants » (9I8) NE GOUVERNE PAS cette route** — décision
 * du même message, sans objection d'Alexis : le barème reste visible même
 * quand ce réglage masque la valorisation d'une intervention précise
 * (`accesAuxMontants`, D37, arbitrage 3.8, inchangés par D232).
 */
async function traiter(): Promise<Response> {
  const porte = await contextePortailTarifs();
  if (porte === null) {
    const refus = await refusPortailTarifs();
    return Response.json({ erreur: refus.motif }, { status: refus.status });
  }

  const bareme = await lireBaremePortail(porte.societeId);
  return Response.json({
    devise: bareme.devise,
    tauxHoraire:
      bareme.tauxHoraire === null
        ? null
        : formatMoney(bareme.tauxHoraire, bareme.devise),
    majorationHorsOuverturePct: bareme.majorationHorsOuverturePct,
    regleArrondi: bareme.regleArrondi,
    forfaits: bareme.forfaits.map((f) => ({
      id: f.id,
      code: f.code,
      libelle: f.libelle,
      type: f.type,
      montant: formatMoney(f.montant, bareme.devise),
      conditions: {
        zoneGeo: f.zoneGeo,
        familleId: f.familleId,
        typeIntervention: f.typeIntervention,
      },
    })),
  });
}

export async function GET(): Promise<Response> {
  return dansUnEchangeAuth(() => traiter());
}
