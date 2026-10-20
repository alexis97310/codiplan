import {
  avertirApresPlanification,
  clesAvertissementCourriel,
} from "@/lib/avertissements/planification";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { transmettreIntervention } from "@/lib/interventions/depot";

import { avecFilet, champ, versLaFiche } from "../../actions";

/**
 * TRANSMETTRE une Planifiée au technicien (QG-5, D141,
 * 9CO-PG-G14A-TRANSMETTRE) — Planifiée → Affectée. Le courriel au technicien
 * part APRÈS que cette transaction a validé, jamais dans
 * `transmettreIntervention` — même discipline que « Affecter » et
 * « Déplacer » (AVERTISSEMENTS-1).
 *
 * ## DEUX FORMES DE RÉPONSE, UNE SEULE DÉCISION (R2-19)
 *
 * Le formulaire de la fiche attend une redirection ; le tiroir du planning
 * (PG-C5) attend une réponse JSON qu'il lit sans quitter l'écran — même
 * négociation que `.../deplacer`.
 */
export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete, params));
}

/**
 * LA CONFIRMATION D'UNE DATE PASSÉE (D123 d'Alexis, 19/10/2026) — lue sur un
 * CORPS DE FORMULAIRE, quand il y en a un. Le tiroir du planning (PG-C5) ne
 * poste AUCUN corps (juste l'en-tête `accept`) : `requete.formData()` y
 * échouerait, faute de `Content-Type` qu'elle reconnaît — ce geste-là ne
 * confirme donc jamais, ce qui laisse la porte fermée plutôt que de planter.
 */
async function confirmerDatePasseeDepuisRequete(
  requete: Request,
): Promise<boolean> {
  const typeContenu = requete.headers.get("content-type") ?? "";
  if (
    !typeContenu.includes("multipart/form-data") &&
    !typeContenu.includes("application/x-www-form-urlencoded")
  ) {
    return false;
  }
  const formulaire = await requete.formData();
  return champ(formulaire, "confirmer_date_passee") === "1";
}

async function traiter(
  requete: Request,
  params: Promise<{ id: string }>,
): Promise<Response> {
  const { id } = await params;
  return avecFilet(id, "transmettre", async () => {
    const enJson = (requete.headers.get("accept") ?? "").includes(
      "application/json",
    );
    const repondre = (
      cle?: string,
      avertissements?: readonly string[],
      confirmable?: boolean,
    ): Response =>
      enJson
        ? Response.json({
            accepte: cle === undefined,
            cle: cle ?? null,
            avertissements: avertissements ?? null,
            confirmable: confirmable === true,
          })
        : versLaFiche(id, cle, avertissements);

    // `exigerCapaciteComplete`, PAS `exigerCapacite` (04/10/2026,
    // 9DKA-REPRISE-9DK, TR-5/D136) — le ○ du technicien sur `modifier_planning`
    // n'ouvre que `app/api/absences/declarer/route.ts`, jamais celle-ci.
    const contexte = await exigerCapaciteComplete("modifier_planning");
    if (contexte === null) {
      return repondre(await motifDuRefus());
    }
    const confirmerDatePassee = await confirmerDatePasseeDepuisRequete(requete);
    const resultat = await transmettreIntervention(
      contexte,
      id,
      confirmerDatePassee,
    );
    // AVERTISSEMENTS-1 : le courriel part APRÈS que la transaction a validé.
    const compteRenduCourriel =
      resultat.accepte && resultat.etatAvant !== undefined
        ? await avertirApresPlanification(contexte, id, resultat.etatAvant)
        : null;
    const avertissementsReunis = resultat.accepte
      ? [
          ...(resultat.avertissements ?? []),
          ...(compteRenduCourriel === null
            ? []
            : clesAvertissementCourriel(compteRenduCourriel)),
        ]
      : [];
    return repondre(
      resultat.accepte ? undefined : resultat.cle,
      resultat.accepte && avertissementsReunis.length > 0
        ? avertissementsReunis
        : undefined,
      resultat.accepte ? undefined : resultat.confirmable,
    );
  });
}
