import { schemaForfait, type SaisieForfait } from "@/lib/tarification/forfaits";

import { champ } from "../../interventions/actions";

/**
 * LA SAISIE D'UN FORFAIT, LUE D'UN FORMULAIRE (R2-20).
 *
 * Écrite **une fois** et appelée par la création comme par la modification :
 * les deux routes lisent les mêmes champs, et une seconde lecture aurait
 * divergé au premier champ ajouté.
 *
 * ## LA TRADUCTION QUI COMPTE : « toutes les zones » → `null`
 *
 * Le `<select>` rend la **chaîne vide** pour « toutes les zones ». La base, elle,
 * n'accepte que `NULL` — la contrainte `condition_multivaluee_valide` **refuse
 * `{}`**, mesuré. C'est ici, et ici seulement, que le vide du formulaire devient
 * l'absence de condition ; le dépôt, lui, ne voit jamais que `null` ou une liste
 * non vide.
 *
 * *Une case à cocher absente du corps vaut « décochée »* : un formulaire HTML
 * n'envoie pas les cases non cochées, et le lire autrement rendrait tout forfait
 * cumulable par accident.
 */
export function saisieForfaitRecue(formulaire: FormData): SaisieForfait | null {
  const zone = champ(formulaire, "zone_geo");
  const rang = champ(formulaire, "rang");
  const montant = champ(formulaire, "montant_mineur");

  const analyse = schemaForfait.safeParse({
    code: champ(formulaire, "code") ?? "",
    libelle: champ(formulaire, "libelle") ?? "",
    type: champ(formulaire, "type") ?? "",
    rang: rang === null ? Number.NaN : Number(rang),
    montant_mineur: montant === null ? Number.NaN : Number(montant),
    // LE VIDE DEVIENT L'ABSENCE — voir l'en-tête.
    zone_geo: zone === null || zone === "" ? null : [zone],
    cumulable_temps: formulaire.get("cumulable_temps") !== null,
    actif: formulaire.get("actif") !== null,
  });

  return analyse.success ? analyse.data : null;
}
