import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { saisieVerificationRecue } from "@/lib/vgp/saisie-verification";
import { enregistrerVerification } from "@/lib/vgp/verification";

/**
 * ENREGISTRER UNE VÉRIFICATION VGP — LE SEUL CHEMIN D'ÉCRITURE (D114, R2-13).
 *
 * **Le refus retourne sur le formulaire avec son motif**, jamais sur une page
 * blanche — même raison que `/api/parametres/forfaits/creer` : *un refus qui
 * renvoie ailleurs fait perdre la saisie.*
 *
 * ## `document_id` RESTE NUL — VOIR `FormulaireVerification`
 *
 * Aucun champ de document n'est lu ici : le formulaire n'en porte pas
 * (aucun sélecteur de document n'existe encore à réutiliser ailleurs dans le
 * dépôt). `schemaVerificationVgp` le défaut déjà à `null`.
 *
 * **D131 (23/09/2026, DROITS-1).** `exigerCapacite` remplace `contexteCourant()` :
 * `enregistrer_vgp` était absente du §5.2, arbitrée avec « clôturer ». Le ○
 * du technicien passe la porte ; `enregistrerVerification` juge en base si la
 * machine est portée par une de SES interventions non annulées.
 */
export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete, params));
}

async function traiter(
  requete: Request,
  params: Promise<{ id: string }>,
): Promise<Response> {
  const { id } = await params;
  const vers = (cle: string): Response =>
    new Response(null, {
      status: 303,
      headers: {
        Location: `/vgp/enregistrer/${id}?motif=${encodeURIComponent(cle)}`,
      },
    });

  const contexte = await exigerCapacite("enregistrer_vgp");
  if (contexte === null) {
    return vers("auth.refus");
  }

  const saisie = saisieVerificationRecue(await requete.formData(), id);
  if (saisie === null) {
    return vers("vgp.verifier.refus.saisie");
  }

  try {
    await enregistrerVerification(contexte, saisie);
  } catch {
    // La forme « filiation » de la politique RLS (`vgp_verification`, parent
    // `machine`) refuse l'écriture si la machine n'est pas visible sous cette
    // société — même raison que `lireMachine` rend `null` pour la même cause.
    return vers("vgp.verifier.refus.introuvable");
  }

  return new Response(null, {
    status: 303,
    headers: { Location: "/vgp" },
  });
}
