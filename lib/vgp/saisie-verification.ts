import {
  schemaVerificationVgp,
  type SaisieVerificationVgp,
} from "./verification";

/**
 * LA SAISIE D'UNE VÉRIFICATION VGP, LUE D'UN FORMULAIRE (lot A5+A7, second
 * temps).
 *
 * ## POURQUOI CETTE FONCTION EST PURE, ET DANS `lib/vgp/`
 *
 * `saisieForfaitRecue` (`app/api/parametres/forfaits/saisie-recue.ts`) vit à
 * côté de la route qui l'appelle, et rien ne l'éprouve seule — elle ne se
 * mesure qu'à travers un scénario de bout en bout. Celle-ci vit dans `lib/`
 * précisément pour pouvoir être éprouvée SANS base ni session
 * (`tests/unit/vgp/saisie-verification.test.ts`) : la traduction d'un
 * `FormData` en `SaisieVerificationVgp` ne dépend d'aucune des deux.
 *
 * ## `document_id` RESTE NUL — CE MODULE NE LE LIT PAS
 *
 * Voir `components/vgp/formulaire-verification.tsx` : aucun champ de document
 * n'existe encore dans le formulaire.
 */
export function saisieVerificationRecue(
  formulaire: FormData,
  machineId: string,
): SaisieVerificationVgp | null {
  // `new Date("AAAA-MM-JJ")` — une chaîne SANS heure — s'interprète en UTC
  // par la spécification ECMA-262, jamais en heure locale : composer un
  // suffixe d'heure à la main ajouterait des chiffres qui ne diraient rien
  // (et que le gardien L9-05 refuserait, à raison, de laisser passer pour
  // une périodicité).
  const dateBrute = champTexte(formulaire, "date_verification");
  const analyse = schemaVerificationVgp.safeParse({
    machine_id: machineId,
    date_verification: dateBrute === null ? undefined : new Date(dateBrute),
    organisme: champTexte(formulaire, "organisme") ?? "",
    reference_rapport: champTexte(formulaire, "reference_rapport"),
    origine: champTexte(formulaire, "origine") ?? "",
    document_id: null,
    observations: observationsRecues(formulaire),
  });
  return analyse.success ? analyse.data : null;
}

/** Un champ de formulaire, en chaîne non vide, ou `null`. */
function champTexte(formulaire: FormData, nom: string): string | null {
  const valeur = formulaire.get(nom);
  if (typeof valeur !== "string" || valeur.trim().length === 0) {
    return null;
  }
  return valeur.trim();
}

/**
 * Une observation par ligne, vidée de ses blancs, jamais une ligne vide.
 *
 * **Vide n'est pas `null`** — voir `schemaVerificationVgp` : un tableau vide
 * est un fait (« rien à signaler »), et `observations` porte un défaut `[]`,
 * jamais `null`.
 */
export function observationsRecues(formulaire: FormData): string[] {
  const brut = formulaire.get("observations");
  if (typeof brut !== "string") {
    return [];
  }
  return brut
    .split("\n")
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne.length > 0);
}
