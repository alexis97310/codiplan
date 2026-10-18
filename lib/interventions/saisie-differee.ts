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
 */
export type SaisieDifferee = {
  readonly instantAppareil: Date;
  readonly operationId: string;
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
