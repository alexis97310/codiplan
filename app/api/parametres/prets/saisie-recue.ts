import {
  schemaAppareilPret,
  type SaisieAppareilPret,
} from "@/lib/prets/saisie";

import { champ } from "../../interventions/actions";

/**
 * LA SAISIE DU PARC DE PRÊT, LUE D'UN FORMULAIRE (9L61-PRET-2-ECRANS-BUREAU).
 *
 * Écrite une fois, appelée par la création comme par la modification — même
 * raison que `app/api/parametres/materiel/saisie-recue.ts` (§9, 01/09).
 * `champ()` rend déjà `null` pour un champ vide : exactement ce que
 * `marque`/`modele`/`numero_serie` attendent (`nullable()`), aucune
 * traduction supplémentaire n'est nécessaire ici.
 */
export function saisieAppareilPretRecue(
  formulaire: FormData,
): SaisieAppareilPret | null {
  const analyse = schemaAppareilPret.safeParse({
    designation: champ(formulaire, "designation") ?? "",
    marque: champ(formulaire, "marque"),
    modele: champ(formulaire, "modele"),
    numero_serie: champ(formulaire, "numero_serie"),
  });
  return analyse.success ? analyse.data : null;
}

/** L'état visé par une bascule (activité ou statut), ENVOYÉ et jamais déduit. */
export const ACTIF = "oui";
export const INACTIF = "non";

/**
 * LE RETOUR VERS LE PARC DE PRÊT — pas d'onglet, pas de filtre à reporter
 * (à la différence du référentiel matériel) : une seule liste, jamais de
 * ligne repérée (aucun écran n'y défile) — `motif` et `volet` suffisent.
 */
export function versLeParcDePret(options: {
  readonly motif?: string;
  readonly volet?: { readonly id?: string };
}): Response {
  const params = new URLSearchParams();
  if (options.motif !== undefined) {
    params.set("motif", options.motif);
  }
  if (options.volet !== undefined) {
    params.set("volet", "appareil");
    if (options.volet.id !== undefined) {
      params.set("id", options.volet.id);
    }
  }
  const requete = params.toString();
  const suffixe = requete === "" ? "" : `?${requete}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/parametres/prets${suffixe}` },
  });
}
