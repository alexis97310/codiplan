import {
  schemaFamilleMateriel,
  schemaModeleMateriel,
  schemaSousTypeMateriel,
  type SaisieFamilleMateriel,
  type SaisieModeleMateriel,
  type SaisieSousTypeMateriel,
} from "@/lib/materiel/saisie";
import {
  paramsDeLaSuite,
  type Suite,
  type TypeVolet,
} from "@/lib/materiel/suite";

import { champ } from "../../interventions/actions";

/**
 * LES SAISIES DU RÉFÉRENTIEL MATÉRIEL, LUES D'UN FORMULAIRE (L1-05b).
 *
 * Écrites **une fois** et appelées par la création comme par la modification :
 * les routes lisent les mêmes champs, et une seconde lecture aurait divergé au
 * premier champ ajouté (§9, 01/09).
 *
 * ## LA TRADUCTION QUI COMPTE : UN CHAMP VIDE N'EST PAS ZÉRO
 *
 * `periodicite_jours` et `periodicite_compteur` sont **nulles quand la
 * maintenance n'est pas périodique**, et le schéma refuse zéro pour une raison
 * écrite : *une maintenance due tous les zéro jours est due en permanence.* Le
 * champ vide d'un formulaire HTML est la chaîne vide ; c'est ici — et ici
 * seulement — qu'elle devient l'absence. **`Number("")` vaut `0`**, et laisser
 * ce zéro passer aurait transformé « non périodique » en refus de la base, ou
 * pire, en une périodicité que personne n'a saisie.
 *
 * ## AUCUN CHAMP DE VGP N'EST LU, et le formulaire n'en porte aucun
 *
 * `assujettissement_vgp`, `vgp_periodicite_mois` et `vgp_reference_texte`
 * appartiennent au lot 9 et à ses règles (L9-03, L9-04, L9-06). *Les lire ici
 * ferait une seconde entrée sur la même règle, qui ne connaîtrait pas la
 * première.* La périodicité d'ENTRETIEN que ce formulaire porte n'est pas la
 * périodicité RÉGLEMENTAIRE, et l'écran le dit là où on la saisit.
 *
 * *Une case à cocher absente du corps vaut « décochée »* : un formulaire HTML
 * n'envoie pas les cases non cochées.
 */
export function saisieFamilleRecue(
  formulaire: FormData,
): SaisieFamilleMateriel | null {
  const analyse = schemaFamilleMateriel.safeParse({
    code: champ(formulaire, "code") ?? "",
    libelle: champ(formulaire, "libelle") ?? "",
    actif: formulaire.get("actif") !== null,
  });
  return analyse.success ? analyse.data : null;
}

export function saisieModeleRecue(
  formulaire: FormData,
): SaisieModeleMateriel | null {
  const analyse = schemaModeleMateriel.safeParse({
    famille_id: champ(formulaire, "famille_id") ?? "",
    sous_type_id: sousTypeOuAbsence(formulaire),
    marque: champ(formulaire, "marque") ?? "",
    reference: champ(formulaire, "reference") ?? "",
    caracteristiques: null,
    periodicite_jours: nombreOuAbsence(formulaire, "periodicite_jours"),
    periodicite_compteur: nombreOuAbsence(formulaire, "periodicite_compteur"),
    actif: formulaire.get("actif") !== null,
  });
  return analyse.success ? analyse.data : null;
}

/** LE VIDE DEVIENT L'ABSENCE, pour le `<select>` facultatif « Sous-type » (D238). */
function sousTypeOuAbsence(formulaire: FormData): string | null {
  const brut = champ(formulaire, "sous_type_id");
  return brut === null || brut === "" ? null : brut;
}

export function saisieSousTypeRecue(
  formulaire: FormData,
): SaisieSousTypeMateriel | null {
  const analyse = schemaSousTypeMateriel.safeParse({
    famille_id: champ(formulaire, "famille_id") ?? "",
    code: champ(formulaire, "code") ?? "",
    libelle: champ(formulaire, "libelle") ?? "",
    actif: formulaire.get("actif") !== null,
  });
  return analyse.success ? analyse.data : null;
}

/**
 * LE VIDE DEVIENT L'ABSENCE — voir l'en-tête.
 *
 * Elle est écrite ici plutôt qu'en ligne parce qu'elle sert **deux fois**, et
 * que la faute qu'elle évite est silencieuse : `Number("")` vaut `0`, et zéro
 * n'est pas une périodicité.
 */
function nombreOuAbsence(formulaire: FormData, nom: string): number | null {
  const brut = champ(formulaire, nom);
  return brut === null || brut === "" ? null : Number(brut);
}

/**
 * LE RETOUR VERS LE RÉFÉRENTIEL — sur le MÊME onglet, avec les MÊMES filtres
 * (9K18A-MATERIEL-RETOUR-ONGLET), jamais sur l'onglet Familles par défaut.
 *
 * `volet`, donné UNIQUEMENT au refus d'une création ou d'une modification,
 * rouvre le même volet plutôt que de le fermer — la saisie refusée reste sous
 * les yeux. `ligne`, donné au succès, repère la ligne créée ou modifiée pour
 * que `LigneReperee` (`components/materiel/ligne-reperee.tsx`) y défile.
 */
export function versLeReferentiel(options: {
  readonly suite: Suite;
  readonly motif?: string;
  readonly ligne?: string;
  readonly volet?: { readonly type: TypeVolet; readonly id?: string };
}): Response {
  const params = paramsDeLaSuite(options.suite);
  if (options.motif !== undefined) {
    params.set("motif", options.motif);
  }
  if (options.ligne !== undefined) {
    params.set("ligne", options.ligne);
  }
  if (options.volet !== undefined) {
    params.set("volet", options.volet.type);
    if (options.volet.id !== undefined) {
      params.set("id", options.volet.id);
    }
  }
  const requete = params.toString();
  const suffixe = requete === "" ? "" : `?${requete}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/parametres/materiel${suffixe}` },
  });
}

/** L'état visé par une bascule d'activité, ENVOYÉ et jamais déduit. */
export const ACTIF = "oui";
export const INACTIF = "non";
