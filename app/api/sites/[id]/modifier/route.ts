import { z } from "zod";

import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { modifierSite } from "@/lib/sites/depot";
import { schemaModificationSite } from "@/lib/sites/saisie";

import { champ } from "../../../interventions/actions";

/**
 * MODIFIER UN LIEU D'INTERVENTION (L3-16, D56, D75).
 *
 * ## LE REFUS DE D56 EST NOMMÉ, ET IL VIENT DE LA SAISIE
 *
 * Zod pose l'exigence : *changer le rattachement sans revoir le temps de trajet
 * laisserait un nombre qui décrit un trajet depuis une agence dont le site ne
 * dépend plus.* Elle la marque `temps_trajet_min_exige_avec_agence`, et cette
 * route la traduit en la clé que l'écran sait rendre.
 *
 * *Rendre « saisie invalide » pour tout aurait été vrai et inutile* — c'est la
 * faute que L3-01b a corrigée sur le déplacement d'intervention, et elle se
 * commettrait ici à l'identique.
 *
 * ## RIEN N'EST TRANSMIS QUI N'AIT ÉTÉ SAISI
 *
 * Le schéma de modification est **partiel** : un champ absent du formulaire
 * n'est pas écrit. Les champs sont donc lus un par un plutôt que passés en
 * bloc — *un `Object.fromEntries` sur le formulaire enverrait des clés que le
 * schéma refuse (`strict`), et le refus serait juste sur une cause fausse.*
 */

/** Les champs que ce formulaire porte. Liste close : le schéma est `strict`. */
const CHAMPS = [
  "libelle",
  "commune",
  "consignes_acces",
  "zone_geo",
  // **Le rattachement est modifiable, et c'est ce qui rend D56 vivant** : sans
  // lui, l'exigence « ne le change pas sans revoir le trajet » serait vraie et
  // inatteignable. La fiche montre les deux champs CÔTE À CÔTE, si bien qu'une
  // modification par l'écran décide toujours des deux — *on n'exige pas qu'on
  // mesure, on exige qu'on décide.* Le refus reste atteignable par tout
  // appelant PARTIEL : l'import de L1-08, une correction à la main.
  "agence_id",
  "temps_trajet_min",
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
            ? `/sites/${id}`
            : `/sites/${id}?motif=${encodeURIComponent(cle)}`,
      },
    });

  const contexte = await exigerCapacite("gerer_client_site");
  if (contexte === null) {
    return versLaFiche("auth.refus");
  }

  // **UN IDENTIFIANT MAL FORMÉ EST UN REFUS, JAMAIS UNE PANNE.** *Mesuré le
  // 11/09/2026 : `/api/sites/nouveau/modifier` rendait un `500` — Prisma levait
  // `P2023` en tentant de lire « nouveau » comme un UUID.* Un segment d'URL est
  // une entrée, et une entrée se contrôle avant d'atteindre la base. Le refus
  // est celui de la fiche introuvable : *un identifiant mal formé et un
  // identifiant hors périmètre rendent la même chose*, sans quoi on apprendrait
  // à distinguer les deux (D35, D50).
  if (!z.uuid().safeParse(id).success) {
    return versLaFiche("site.refus.fiche_introuvable");
  }

  const formulaire = await requete.formData();
  const brut: Record<string, unknown> = {};
  for (const nom of CHAMPS) {
    if (!formulaire.has(nom)) continue;
    const valeur = champ(formulaire, nom);
    brut[nom] =
      nom === "temps_trajet_min"
        ? // **Le champ VIDE est une valeur pleine** : il dit « reviens à
          // l'estimation par zone » (D23), et c'est la sortie que D56 laisse
          // ouverte. Le confondre avec « absent » ferait échouer le refus sur
          // le cas même qu'il autorise.
          valeur === null
          ? null
          : Number(valeur)
        : valeur;
  }

  const saisie = schemaModificationSite.safeParse(brut);
  if (!saisie.success) {
    const surLeTrajet = saisie.error.issues.some(
      (probleme) => probleme.message === "temps_trajet_min_exige_avec_agence",
    );
    return versLaFiche(
      surLeTrajet ? "site.refus.trajet_a_revoir" : "site.refus.saisie",
    );
  }

  const resultat = await modifierSite(contexte, id, saisie.data);
  return versLaFiche(
    resultat.accepte ? "sites.modifie" : `site.refus.${resultat.motif}`,
  );
}
