import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { validerRapport } from "@/lib/interventions/depot";

import { avecFilet, versLaFiche } from "../../actions";

/**
 * VALIDER LE RAPPORT (RG-INT-03, D135, 9H1) — ce que `peutCloturer` exige
 * désormais avant de clore.
 *
 * **Aucune saisie** : même régime que `reprendre` — le geste CONFIRME, il ne
 * configure rien.
 *
 * `exigerCapacite("valider_rapport")` : cette capacité n'a AUCUNE ligne
 * `restreint` dans la matrice (`lib/auth/habilitations.ts`) — ni l'ADV ni le
 * technicien n'y figurent, contrairement à `cloturer_intervention`. Un rôle
 * sans elle n'atteint pas `validerRapport` du tout ; c'est ce dépôt qui juge
 * ensuite s'il y a quelque chose à valider (la porte ne juge jamais la
 * PORTÉE, voir `lib/auth/porte.ts`).
 */
export async function POST(
  _requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(params));
}

async function traiter(params: Promise<{ id: string }>): Promise<Response> {
  const { id } = await params;
  return avecFilet(id, "valider-rapport", async () => {
    const contexte = await exigerCapacite("valider_rapport");
    if (contexte === null) {
      return versLaFiche(id, await motifDuRefus());
    }
    const resultat = await validerRapport(contexte, id);
    return versLaFiche(id, resultat.accepte ? undefined : resultat.cle);
  });
}
