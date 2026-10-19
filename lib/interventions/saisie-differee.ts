import { z } from "zod";

/**
 * UNE SAISIE FAITE HORS RÉSEAU (9F4H2-HORS-RESEAU-HEURE-ET-REJEU, décisions
 * n° 107/108 d'Alexis, 14/10/2026) — partagée par `compteur/route.ts` et
 * `terminer/route.ts`, SANS AUCUNE AUTRE DÉPENDANCE : un module séparé plutôt
 * qu'un réexport depuis `depot-compteur.ts`, qui entraînerait
 * `fuseauDeLAgence` (donc `lib/calendar/*`) dans le graphe de `terminer`, que
 * rien là-bas n'atteint (mesuré :
 * `tests/unit/interventions/terrain-routes-json.test.ts`, qui mocke
 * `@/lib/calendar/fuseau` sans son export `MINUTES_PAR_JOUR`).
 *
 * `operationId` DEVIENT L'`id` du segment au démarrage du compteur (voir
 * `demarrerLeCompteur`) ou de la signature (voir `enregistrerSignature`) : un
 * renvoi du même `operationId` est ainsi reconnu SANS colonne dédiée —
 * l'identifiant lui-même PORTE la preuve du rejeu.
 *
 * `depuisFile` (9F4H4B, addendum n°1) — DISTINGUE le renvoi depuis la file
 * (`lib/terrain/envoi-file.ts`, point 2 de 9F4H3) du tout premier essai EN
 * LIGNE (`compteur-terrain.tsx`, `rapport-automatique.tsx`), qui envoie lui
 * aussi `operation_id` + `instant_appareil` (9F4H2, pour le rejeu lie-fi) mais
 * n'a jamais été « saisi hors réseau ». **FACULTATIF, et vrai par défaut** :
 * un appelant qui ne le précise pas (les épreuves d'isolation de 9F4H2, qui
 * simulent directement une saisie hors réseau au niveau du dépôt) garde
 * l'ancien contrat — seules les routes `compteur` et `terminer` le posent
 * explicitement à `false` pour un essai en ligne.
 */
export type SaisieDifferee = {
  readonly instantAppareil: Date;
  readonly operationId: string;
  readonly depuisFile?: boolean;
};

/**
 * UN DÉCALAGE EXPLICITE, TOUJOURS (9F4H2A-REJEU-SANS-DOUBLON, point 5) —
 * `Z` ou `±hh:mm`. `z.coerce.date()` seul acceptait aussi une forme SANS
 * décalage (« 2026-09-14T08:00:00 ») : `new Date(...)` la lit alors à
 * l'heure LOCALE DU SERVEUR, jamais celle de l'appareil — exactement
 * l'ambiguïté que D214 interdit. `new Date().toISOString()`, ce que
 * l'appareil envoie (`lib/terrain/file-saisies.ts`), porte toujours `Z`.
 */
const INSTANT_AVEC_DECALAGE = /(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * CE QU'UN FORMULAIRE DOIT PORTER POUR TENTER UNE SAISIE DIFFÉRÉE — les deux
 * champs vont ENSEMBLE (voir les routes `compteur` et `terminer`) : l'un sans
 * l'autre n'est traité ni comme hors réseau ni comme en ligne, les deux
 * routes exigent la PAIRE ou aucun des deux.
 */
export const schemaSaisieDifferee = z.object({
  instant_appareil: z
    .string()
    .regex(INSTANT_AVEC_DECALAGE)
    .pipe(z.coerce.date()),
  operation_id: z.uuid(),
});
