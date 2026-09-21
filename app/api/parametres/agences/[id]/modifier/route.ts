import { z } from "zod";

import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { modifierAgence } from "@/lib/agences/depot";
import { schemaModificationAgence } from "@/lib/agences/saisie";

import { champ } from "../../../../interventions/actions";

/**
 * MODIFIER UNE AGENCE (AGENCE-1).
 *
 * `code` n'est PAS de ces champs — voir l'en-tête de
 * `lib/agences/saisie.ts` : `schemaModificationAgence` est `strict()` et le
 * refuserait de toute façon, mais le formulaire ne l'envoie même pas, pour que
 * le refus ne se voie jamais.
 *
 * **`actif` n'est PAS de la boucle générique ci-dessous, et c'est délibéré.**
 * Une case à cocher DÉCOCHÉE n'apparaît pas dans `FormData` — ce n'est pas
 * « laisse ce champ tel quel », c'est « faux ». La confondre avec une absence
 * laisserait décocher la case sans que rien ne se désactive jamais.
 */

/** Les champs texte que ce formulaire porte. Liste close : le schéma est `strict`. */
const CHAMPS = ["libelle", "territoire", "fuseau_horaire"] as const;

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
  const versLeFormulaire = (cle: string): Response =>
    new Response(null, {
      status: 303,
      headers: {
        Location: `/parametres/agences/${id}/modifier?motif=${encodeURIComponent(cle)}`,
      },
    });

  const contexte = await exigerCapacite("parametrer_societe");
  if (contexte === null) {
    return versLeFormulaire("auth.refus");
  }

  // Un identifiant mal formé est un refus, jamais une panne — même correction
  // qu'à `app/api/sites/[id]/modifier/route.ts` (mesuré le 11/09/2026 sur
  // `/api/sites/nouveau/modifier`, qui rendait un 500).
  if (!z.uuid().safeParse(id).success) {
    return versLeFormulaire("agence.refus.introuvable");
  }

  const formulaire = await requete.formData();
  const brut: Record<string, unknown> = {
    // Toujours présent, jamais sauté (voir l'en-tête) : coché → présent →
    // `true` ; décoché → absent de `FormData` → `false`.
    actif: formulaire.has("actif"),
  };
  for (const nom of CHAMPS) {
    if (!formulaire.has(nom)) continue;
    brut[nom] = champ(formulaire, nom);
  }

  const saisie = schemaModificationAgence.safeParse(brut);
  if (!saisie.success) {
    return versLeFormulaire("agence.refus.saisie");
  }

  const resultat = await modifierAgence(contexte, id, saisie.data);
  return versLeFormulaire(
    resultat.accepte ? "agence.modifiee" : `agence.refus.${resultat.motif}`,
  );
}
