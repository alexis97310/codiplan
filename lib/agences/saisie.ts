import { z } from "zod";

import { schemaFuseau, schemaTerritoire } from "@/lib/calendar";

/**
 * Ce qu'on a le droit d'écrire sur une agence — validation d'entrée (ticket
 * AGENCE-1 ; chapitre 11 ; invariant I7 ; CLAUDE.md §2 : Zod sur toute entrée
 * serveur, sans exception).
 *
 * Ce module est PUR : aucune base, aucun contexte de session — les mêmes
 * règles vaudraient pour un import futur.
 *
 * **`territoire` est OBLIGATOIRE et n'est JAMAIS déduit du fuseau** (D46,
 * complément 1) : le fuseau dit quelle heure il est, le territoire dit quels
 * jours sont fériés. `schemaTerritoire` (`lib/calendar`) exige un code ISO
 * 3166-1 alpha-2 — la même contrainte que porte la base
 * (`agence_territoire_iso_alpha2`).
 *
 * **`fuseau_horaire` est FACULTATIF** (D5) : vide, l'agence hérite du fuseau
 * de la société. `null` et l'absence du champ disent donc la même chose ici —
 * il n'y a pas de distinction « ne pas toucher » à la création, puisqu'il n'y
 * a encore rien à ne pas toucher.
 *
 * **Et la société n'est JAMAIS une entrée** : aucun schéma d'ici ne porte de
 * `societe_id` — il vient du contexte de session et de lui seul.
 */

/** Libellé — obligatoire, non vide après suppression des blancs. */
const libelle = z.string().trim().min(1).max(200);

/**
 * Code de l'agence — la clé naturelle qu'un humain reconnaît (« DUCOS »,
 * « KONE », « DOLBEAU »). Unique par société (`@@unique([societe_id, code])`),
 * la base tranche l'unicité — ce schéma ne fait que refuser une saisie vide.
 */
const code = z.string().trim().min(1).max(50);

const fuseauFacultatif = schemaFuseau.nullable();

/**
 * Création d'une agence. L'identifiant est attribué par le serveur (I10), la
 * société vient du contexte. Le schéma est `strict()` pour que fournir l'un ou
 * l'autre soit un REFUS plutôt qu'un champ ignoré.
 */
export const schemaCreationAgence = z
  .object({
    code,
    libelle,
    territoire: schemaTerritoire,
    fuseau_horaire: fuseauFacultatif.default(null),
    actif: z.boolean().default(true),
  })
  .strict();
export type CreationAgence = z.output<typeof schemaCreationAgence>;

/**
 * Modification d'une agence. Tous les champs sont facultatifs — une
 * modification partielle est le cas normal.
 *
 * **`code` N'EST PAS modifiable.** C'est la clé qu'un import Excel résout
 * (`COLONNES_SITES`, `lib/imports/modeles.ts`) et celle qu'un humain nomme au
 * téléphone : la laisser bouger silencieusement déplacerait la cible d'un
 * classeur déjà préparé sans qu'aucun message ne le dise. Rien dans le
 * chapitre 10 n'exige qu'elle puisse changer — une fiche créée sous le mauvais
 * code se recrée, elle ne se corrige pas ici.
 */
export const schemaModificationAgence = z
  .object({
    libelle: libelle.optional(),
    territoire: schemaTerritoire.optional(),
    fuseau_horaire: fuseauFacultatif.optional(),
    actif: z.boolean().optional(),
  })
  .strict();
export type ModificationAgence = z.output<typeof schemaModificationAgence>;
