import {
  schemaAttributionHabilitation,
  schemaCreationHabilitation,
  schemaExigenceSite,
  schemaModificationHabilitation,
  type AttributionHabilitation,
  type CreationHabilitation,
  type ExigenceSite,
  type ModificationHabilitation,
} from "@/lib/habilitations/saisie";

import { champ } from "../interventions/actions";

/**
 * LA SAISIE DU RÉFÉRENTIEL DES HABILITATIONS, LUE D'UN FORMULAIRE (ÉQUIPE-2).
 *
 * Même forme que `saisiePrestationRecue` : la durée de validité ABSENTE du
 * champ devient `null`, JAMAIS zéro — zéro dirait « expire le jour même », ce
 * qui n'est pas ce qu'une case vide veut dire (D76, D88). `null` est envoyé à
 * chaque soumission, création comme modification : il n'y a pas de mise à
 * jour partielle ici, l'écran renvoie l'état complet du formulaire.
 */
function dureeRecue(formulaire: FormData): number | null {
  const brut = champ(formulaire, "duree_validite_mois");
  return brut === null ? null : Number(brut);
}

export function creationHabilitationRecue(
  formulaire: FormData,
): CreationHabilitation | null {
  const analyse = schemaCreationHabilitation.safeParse({
    code: champ(formulaire, "code") ?? "",
    libelle: champ(formulaire, "libelle") ?? "",
    duree_validite_mois: dureeRecue(formulaire),
  });
  return analyse.success ? analyse.data : null;
}

/**
 * « Actif » suit la règle de `saisieTechnicienRecue` : une case à cocher
 * absente du corps vaut « décochée », un formulaire HTML n'envoyant pas les
 * cases non cochées.
 */
export function modificationHabilitationRecue(
  formulaire: FormData,
): ModificationHabilitation | null {
  const analyse = schemaModificationHabilitation.safeParse({
    code: champ(formulaire, "code") ?? "",
    libelle: champ(formulaire, "libelle") ?? "",
    duree_validite_mois: dureeRecue(formulaire),
    actif: formulaire.get("actif") !== null,
  });
  return analyse.success ? analyse.data : null;
}

/** Le retour vers le référentiel, avec son motif s'il y en a un. */
export function versLeReferentiel(cle?: string): Response {
  const suffixe = cle === undefined ? "" : `?motif=${encodeURIComponent(cle)}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/parametres/habilitations${suffixe}` },
  });
}

/**
 * LA SAISIE D'UNE ATTRIBUTION, LUE D'UN FORMULAIRE.
 *
 * Les dates viennent d'un `<input type="date">` — `YYYY-MM-DD` — que
 * `z.coerce.date()` du schéma lit directement, en UTC : c'est la même lecture
 * qu'un littéral `DATE` ISO, sans le passage par un `Date` local qui
 * décalerait le jour sous UTC+11.
 */
export function attributionRecue(
  formulaire: FormData,
): AttributionHabilitation | null {
  const analyse = schemaAttributionHabilitation.safeParse({
    utilisateur_id: champ(formulaire, "utilisateur_id") ?? "",
    habilitation_id: champ(formulaire, "habilitation_id") ?? "",
    date_obtention: champ(formulaire, "date_obtention") ?? "",
    date_expiration: champ(formulaire, "date_expiration"),
  });
  return analyse.success ? analyse.data : null;
}

/** Le retour vers la fiche d'équipe, avec son motif s'il y en a un. */
export function versLEquipe(cle?: string): Response {
  const suffixe = cle === undefined ? "" : `?motif=${encodeURIComponent(cle)}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/parametres/equipe${suffixe}` },
  });
}

/**
 * LA SAISIE D'UNE EXIGENCE DE SITE, LUE D'UN FORMULAIRE.
 *
 * « Bloquant » suit la règle des cases à cocher : ABSENTE du corps, elle vaut
 * « décochée » — et le schéma la défaut à `true` seulement quand la CLÉ
 * elle-même est absente de l'entrée, pas quand elle vaut `false`. Cet écran
 * envoie donc toujours la clé, jamais en s'appuyant sur ce défaut.
 */
export function exigenceRecue(formulaire: FormData): ExigenceSite | null {
  const analyse = schemaExigenceSite.safeParse({
    site_id: champ(formulaire, "site_id") ?? "",
    habilitation_id: champ(formulaire, "habilitation_id") ?? "",
    bloquant: formulaire.get("bloquant") !== null,
  });
  return analyse.success ? analyse.data : null;
}

/** Le retour vers la fiche d'un site, avec son motif s'il y en a un. */
export function versLeSite(siteId: string, cle?: string): Response {
  const suffixe = cle === undefined ? "" : `?motif=${encodeURIComponent(cle)}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/sites/${siteId}${suffixe}` },
  });
}
