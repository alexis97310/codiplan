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
 * ## LES DEUX TRADUCTIONS QUI COMPTENT
 *
 * **« Aucune famille » → `null`.** Le `<select>` rend la chaîne vide, et c'est
 * ici — et ici seulement — qu'elle devient l'absence de parent. *Une famille
 * absente n'est pas une famille introuvable* : un déplacement, un diagnostic ou
 * une formation ne visent aucune famille de matériel, et c'est le premier parent
 * facultatif de ce dépôt.
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
 * n'envoie pas les cases non cochées.
 */
export function saisiePrestationRecue(
  formulaire: FormData,
): SaisiePrestation | null {
  const famille = champ(formulaire, "famille_id");
  const duree = champ(formulaire, "duree_standard_min");

  const analyse = schemaPrestation.safeParse({
    code: champ(formulaire, "code") ?? "",
    libelle: champ(formulaire, "libelle") ?? "",
    // LE VIDE DEVIENT L'ABSENCE — voir l'en-tête.
    famille_id: famille === null || famille === "" ? null : famille,
    duree_standard_min: duree === null ? null : Number(duree),
    actif: formulaire.get("actif") !== null,
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
