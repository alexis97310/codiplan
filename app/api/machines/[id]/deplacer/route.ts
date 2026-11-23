import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { deplacerMachine } from "@/lib/machines/depot";
import { schemaDeplacementMachine } from "@/lib/machines/saisie";

import { champ } from "../../../interventions/actions";

/**
 * DÉPLACER UNE MACHINE VERS UN AUTRE SITE (9L20-DEPLACER-MACHINE, décision
 * d'Alexis du 10/11/2026) — le geste daté qui remplace la saisie ignorée en
 * silence de l'ancien formulaire de correction (voir `lib/machines/
 * depot.ts`, `deplacerMachine`).
 *
 * **La confirmation (« autre client ») est lue directement sur le
 * formulaire**, jamais validée par Zod — même discipline que la
 * confirmation des sorties du parc (`changer-statut/route.ts`) : sa seule
 * présence ne prouve rien, c'est `deplacerMachine` qui décide si elle était
 * réellement exigée.
 *
 * **Réservée au bureau depuis D280 (23/11/2026, 9L34)** : la capacité
 * `deplacer_machine`, pas `gerer_machine` — le technicien gère la machine
 * mais ne la déplace jamais.
 */
export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete, params));
}

function versLaFiche(id: string, motif?: string, nombre?: number): Response {
  const parametres = new URLSearchParams();
  if (motif !== undefined) {
    parametres.set("motif", motif);
  }
  if (nombre !== undefined) {
    parametres.set("nombre", String(nombre));
  }
  const suffixe = parametres.size === 0 ? "" : `?${parametres.toString()}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/parc/${id}${suffixe}` },
  });
}

async function traiter(
  requete: Request,
  params: Promise<{ id: string }>,
): Promise<Response> {
  const { id } = await params;
  const formulaire = await requete.formData();

  const contexte = await exigerCapacite("deplacer_machine");
  if (contexte === null) {
    return versLaFiche(id, await motifDuRefus());
  }

  const saisie = schemaDeplacementMachine.safeParse({
    nouveau_site_id: champ(formulaire, "nouveau_site_id") ?? "",
  });
  if (!saisie.success) {
    return versLaFiche(id, "machine.deplacer.refus.saisie");
  }
  const confirmationAutreClient =
    champ(formulaire, "confirmation_autre_client") !== null;

  const resultat = await deplacerMachine(
    contexte,
    id,
    saisie.data,
    confirmationAutreClient,
  );
  if (!resultat.accepte) {
    if (resultat.motif === "interventions_ouvertes") {
      return versLaFiche(
        id,
        "machine.deplacer.refus.interventions_ouvertes",
        resultat.nombre,
      );
    }
    return versLaFiche(id, `machine.deplacer.refus.${resultat.motif}`);
  }
  return versLaFiche(id, "machine.deplacer.reussi");
}
