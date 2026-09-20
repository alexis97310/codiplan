import { z } from "zod";

import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { modifierClient } from "@/lib/clients/depot";
import { schemaModificationClient } from "@/lib/clients/saisie";

import { champ } from "../../../interventions/actions";

/**
 * MODIFIER UNE FICHE CLIENT (14/09/2026, L1-01 rouvert par R3-12).
 *
 * ## RIEN N'EST TRANSMIS QUI N'AIT ÉTÉ SAISI
 *
 * Le schéma de modification est **partiel** : un champ absent du formulaire
 * n'est pas écrit. Les champs sont donc lus un par un plutôt que passés en
 * bloc — *un `Object.fromEntries` sur le formulaire enverrait des clés que le
 * schéma refuse (`strict`), et le refus serait juste sur une cause fausse.*
 *
 * ## L'ÉTAT EST UNE VALEUR, JAMAIS UNE CASE COCHÉE
 *
 * Le formulaire envoie `actif=true` ou `actif=false`, explicitement. **Une case
 * à cocher aurait été un piège silencieux** : décochée, elle est absente du
 * formulaire ; absente, elle est lue « ne touche pas à cette colonne » ; et la
 * désactivation n'aurait jamais eu lieu **pendant que l'écran affichait
 * "enregistré"**. *Un succès qui ne fait pas ce qu'on lui a demandé est pire
 * qu'un refus* (R2-20).
 *
 * Toute autre valeur que ces deux-là est un REFUS, jamais un défaut : on ne
 * devine pas l'état d'une fiche.
 */

/** Les champs que ce formulaire porte. Liste close : le schéma est `strict`. */
const CHAMPS = [
  "raison_sociale",
  "code_externe",
  "ridet",
  "categorie",
  "conditions_reglement",
  "commercial_referent",
] as const;

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
  const versLaFiche = (cle?: string): Response =>
    new Response(null, {
      status: 303,
      headers: {
        Location:
          cle === undefined
            ? `/clients/${id}`
            : `/clients/${id}?motif=${encodeURIComponent(cle)}`,
      },
    });

  const contexte = await exigerCapacite("gerer_client_site");
  if (contexte === null) {
    return versLaFiche("auth.refus");
  }

  // **UN IDENTIFIANT MAL FORMÉ EST UN REFUS, JAMAIS UNE PANNE** — la leçon de
  // `/api/sites/nouveau/modifier`, qui rendait un `500` parce que Prisma levait
  // `P2023` en lisant « nouveau » comme un UUID. Un segment d'URL est une
  // entrée, et une entrée se contrôle avant d'atteindre la base. Le refus est
  // celui de la fiche introuvable : *un identifiant mal formé et un identifiant
  // hors périmètre rendent la même chose*, sans quoi on apprendrait à
  // distinguer les deux (D35, D50).
  if (!z.uuid().safeParse(id).success) {
    return versLaFiche("client.refus.client_introuvable");
  }

  const formulaire = await requete.formData();
  const brut: Record<string, unknown> = {};
  for (const nom of CHAMPS) {
    if (!formulaire.has(nom)) continue;
    // `champ` rend `null` sur un champ vidé : c'est « efface-la », et le dépôt
    // le distingue d'`undefined`, qui est « ne touche pas ».
    brut[nom] = champ(formulaire, nom);
  }
  if (formulaire.has("actif")) {
    const etat = champ(formulaire, "actif");
    if (etat !== "true" && etat !== "false") {
      return versLaFiche("client.refus.saisie");
    }
    brut.actif = etat === "true";
  }

  const saisie = schemaModificationClient.safeParse(brut);
  if (!saisie.success) {
    return versLaFiche("client.refus.saisie");
  }

  const resultat = await modifierClient(contexte, id, saisie.data);
  return versLaFiche(
    resultat.accepte ? "clients.modifie" : `client.refus.${resultat.motif}`,
  );
}
