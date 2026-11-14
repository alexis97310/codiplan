import {
  schemaPrestation,
  type SaisiePrestation,
} from "@/lib/prestations/saisie";

import { champ } from "../../interventions/actions";

/**
 * LA SAISIE D'UNE PRESTATION, LUE D'UN FORMULAIRE (R3-15).
 *
 * Écrite **une fois** et appelée par la création comme par la modification : les
 * deux routes lisent les mêmes champs, et une seconde lecture aurait divergé au
 * premier champ ajouté.
 *
 * ## LA TRADUCTION QUI COMPTE
 *
 * **« Durée non estimée » → `null`, JAMAIS zéro.** Le champ vide veut dire
 * *personne ne l'a encore estimée*, ce qui est l'état ordinaire d'un catalogue
 * qu'on remplit ; zéro dirait « instantané », et le schéma le refuse pour cette
 * raison exacte. *La troisième fois que ce dépôt sépare « je ne sais pas » de
 * « la valeur vaut rien »* (D76, D88).
 *
 * ## ET LA CHECKLIST N'EST PAS LUE
 *
 * R3-15 a tranché : *personne n'a dit ce que porte `checklist_type`*, et
 * l'inventer au premier écran qui l'écrit figerait sa forme pour toutes les
 * sociétés. Le champ n'existe pas dans le formulaire, et rien ne l'écrit.
 *
 * *Une case à cocher absente du corps vaut « décochée »* : un formulaire HTML
 * n'envoie pas les cases non cochées — même idiome pour `types` (9K29) et
 * `familles` (9L04J, D259) : AUCUNE case cochée = proposée PARTOUT (tous les
 * types, toute machine).
 */
export function saisiePrestationRecue(
  formulaire: FormData,
): SaisiePrestation | null {
  const duree = champ(formulaire, "duree_standard_min");

  const analyse = schemaPrestation.safeParse({
    code: champ(formulaire, "code") ?? "",
    libelle: champ(formulaire, "libelle") ?? "",
    duree_standard_min: duree === null ? null : Number(duree),
    actif: formulaire.get("actif") !== null,
    // AUCUNE CASE COCHÉE = PROPOSÉE POUR TOUS LES TYPES (9K29, D243) — même
    // idiome que `actif` : une case absente du corps vaut « décochée ».
    types: formulaire
      .getAll("types")
      .filter((valeur): valeur is string => typeof valeur === "string"),
    // AUCUNE CASE COCHÉE = GÉNÉRALE, PROPOSÉE SUR TOUTE MACHINE (9L04J,
    // D259) — REMPLACE l'ancien `famille_id` scalaire d'un unique `<select>`.
    familles: formulaire
      .getAll("familles")
      .filter((valeur): valeur is string => typeof valeur === "string"),
  });

  return analyse.success ? analyse.data : null;
}

/** Le retour vers le catalogue, avec son motif s'il y en a un. */
export function versLeCatalogue(cle?: string): Response {
  const suffixe = cle === undefined ? "" : `?motif=${encodeURIComponent(cle)}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/parametres/prestations${suffixe}` },
  });
}
