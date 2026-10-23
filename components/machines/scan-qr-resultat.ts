/**
 * LE RÉSULTAT D'UNE RÉSOLUTION DE SCAN — trois issues, jamais un oracle
 * (9G10-SCANNER-QR-APPLI, décision D144 d'Alexis).
 *
 * `rediriger` porte une destination déjà autorisée (D22 : le scan ouvre la
 * fiche de ce qu'on avait déjà le droit de voir, il n'ouvre jamais ce qu'on
 * n'avait pas). `introuvable` couvre à la fois un jeton inconnu et un jeton
 * d'une autre société — la même indiscernabilité que `resoudreParJeton`
 * (D35, D50) : ce fichier ne distingue pas ce que ce module-là ne distingue
 * pas. `hors_perimetre` ne se pose qu'une fois la machine RÉSOLUE dans sa
 * propre société ; il ne révèle rien de plus que « rien à faire ici ».
 */
export type ResultatScanQr =
  | { readonly suite: "rediriger"; readonly url: string }
  | { readonly suite: "introuvable" }
  | { readonly suite: "hors_perimetre" };
