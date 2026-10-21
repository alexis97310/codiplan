/**
 * LA COPIE ANCIENNE, TOLÉRÉE (9F4H6A-COQUILLE-ANCIENNE-COPIE, point 1).
 *
 * `lireCopie` (`copie-locale.ts`) rend l'objet IndexedDB TEL QUEL, sans
 * contrôle de forme ni de version (voir son en-tête). `catalogue` (sur
 * l'instantané) et `prestationsRealiseesIds` (sur chaque fiche) sont nés tous
 * les deux au même point de 9F4H6 : une copie écrite par un appareil AVANT ce
 * lot, et jamais rafraîchie depuis (pas de réseau, pas de nouvel instantané),
 * ne les porte pas. Sans ce fichier, `catalogue.map(...)` dans
 * `components/terrain/consultation-hors-reseau.tsx` lève sur `undefined` —
 * le mode hors réseau cesse de fonctionner pour ce téléphone précis.
 *
 * ## DEUX ABSENCES, DEUX RÉPONSES DIFFÉRENTES
 *
 * `catalogue` absent devient `[]` — le même cas que « catalogue jamais
 * emporté » que `terrain.prestations.catalogue_indisponible_hors_reseau`
 * nomme déjà (9F4H4B-OUVERTURE-A-FROID) : aucune nouvelle clé n'est due.
 *
 * `prestationsRealiseesIds` absent devient `[]` AUSSI, mais avec un second
 * signal, `indisponibles: true` — jamais un simple ensemble vide : un
 * ensemble vide dirait « rien n'a été fait », quand la vérité est « on ne
 * sait pas ». `components/terrain/consultation-hors-reseau.tsx` lit ce
 * signal pour rendre les prestations NON cochables sur cette fiche plutôt que
 * de risquer d'écraser un travail déjà réalisé, servi au prochain
 * « Terminer » sous un ensemble vide.
 */

import type {
  FicheJSON,
  InstantaneJSON,
} from "@/app/api/terrain/instantane/route";

/**
 * LA COPIE ENTIÈRE, VALIDÉE (9F4H6B-FILE-ANCIEN-FORMAT, point 2) — `lireCopie`
 * rend l'objet IndexedDB tel quel (voir l'en-tête de `copie-locale.ts`) ; une
 * copie PARTIELLEMENT écrite (coupure pendant l'écriture, quota dépassé en
 * cours de `put`) ou corrompue par une version future peut n'avoir ni
 * `journee` ni `fiches` — deux champs du CŒUR de la forme, présents depuis la
 * toute première version de cette copie (9F4H1), jamais ajoutés après coup
 * comme `catalogue` ou `prestationsRealiseesIds` (voir plus bas). Sans ce
 * contrôle, `copie.journee.fuseau` et `copie.fiches[id]`
 * (`consultation-hors-reseau.tsx`) lèvent au rendu. Une copie qui échoue ici
 * est traitée EXACTEMENT comme son absence totale — `ConsultationHorsReseau`
 * affiche le même message : une copie sans son cœur n'est pas plus
 * utilisable qu'aucune copie.
 */
export function copieUtilisable(copie: InstantaneJSON): boolean {
  const journee = copie.journee as unknown;
  if (typeof journee !== "object" || journee === null) {
    return false;
  }
  const j = journee as Record<string, unknown>;
  const tableauxPresents =
    Array.isArray(j.enRetard) &&
    Array.isArray(j.aujourdhui) &&
    Array.isArray(j.demain) &&
    Array.isArray(j.sansDate);
  if (!tableauxPresents || typeof j.fuseau !== "string") {
    return false;
  }
  return typeof copie.fiches === "object" && copie.fiches !== null;
}

/** `copie.catalogue`, sûr quelle que soit l'ancienneté de la copie —
 * un ÉLÉMENT invalide (`null`, `id`/`libelle` absents ou non-chaînes) est
 * écarté plutôt que de faire lever `p.id` dans `consultation-hors-reseau.tsx`
 * au lieu de faire échouer tout le catalogue pour une seule ligne abîmée. */
export function catalogueDeLaCopie(copie: InstantaneJSON): {
  readonly catalogue: InstantaneJSON["catalogue"];
  readonly indisponible: boolean;
} {
  if (!Array.isArray(copie.catalogue)) {
    return { catalogue: [], indisponible: true };
  }
  const valide = copie.catalogue.filter(
    (p): p is InstantaneJSON["catalogue"][number] =>
      typeof p === "object" &&
      p !== null &&
      typeof (p as Record<string, unknown>).id === "string" &&
      typeof (p as Record<string, unknown>).libelle === "string",
  );
  return { catalogue: valide, indisponible: false };
}

/** `fiche.prestationsRealiseesIds`, sûr — voir l'en-tête : `[]` ne veut
 * jamais dire « rien de fait » quand `indisponibles` est vrai. Un élément qui
 * n'est pas une chaîne est écarté, jamais gardé tel quel. */
export function prestationsRealiseesDeLaFiche(fiche: FicheJSON): {
  readonly ids: readonly string[];
  readonly indisponibles: boolean;
} {
  if (!Array.isArray(fiche.prestationsRealiseesIds)) {
    return { ids: [], indisponibles: true };
  }
  return {
    ids: fiche.prestationsRealiseesIds.filter(
      (id): id is string => typeof id === "string",
    ),
    indisponibles: false,
  };
}

/** `fiche.photos`, sûr — un élément qui n'est pas une chaîne est écarté. */
export function photosDeLaFiche(fiche: FicheJSON): readonly string[] {
  return Array.isArray(fiche.photos)
    ? fiche.photos.filter((p): p is string => typeof p === "string")
    : [];
}

/** `fiche.rapport`, sûr — absent ou d'une forme invalide devient
 * `{commentaireTechnicien: null, suiteADonner: null}`, jamais un plantage. */
export function rapportDeLaFiche(fiche: FicheJSON): FicheJSON["rapport"] {
  const rapport = fiche.rapport as unknown;
  if (typeof rapport !== "object" || rapport === null) {
    return { commentaireTechnicien: null, suiteADonner: null };
  }
  const r = rapport as Record<string, unknown>;
  return {
    commentaireTechnicien:
      typeof r.commentaireTechnicien === "string"
        ? r.commentaireTechnicien
        : null,
    suiteADonner: typeof r.suiteADonner === "string" ? r.suiteADonner : null,
  };
}
