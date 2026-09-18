/**
 * LES DEUX COULEURS D'UN QR CODE — noir sur blanc, TOUJOURS (N-11).
 *
 * ## Pourquoi ce fichier existe, et pourquoi ce n'est pas `--app-encre`
 *
 * `--app-encre` et `--app-surface` sont la CHARTE de la société active
 * (`docs/constitution/organisation-du-code.md`, `lib/theme/`) : une donnée
 * propre à chaque société, pas une règle du produit. Un lecteur de code-barres
 * exige un contraste maximal entre les modules et le fond — bien au-delà du
 * seuil WCAG 4,5:1 que `lib/theme/statuts.ts` calcule déjà pour les pastilles
 * de statut — et une charte qui poserait un jour une encre claire sur un fond
 * clair rendrait une étiquette imprimée illisible par un scanner, sans qu'un
 * seul test d'accessibilité ne le voie : ce n'est pas un problème de contraste
 * pour l'œil, c'est un problème de décodage pour une machine.
 *
 * **C'est exactement la raison que `statuts.ts` écrit déjà pour lui-même** —
 * *« la lisibilité se CALCULE : seuil 4,5:1, garanti par le choix noir/blanc »*
 * — appliquée à un second cas où la couleur est une PROPRIÉTÉ PHYSIQUE du
 * signe plutôt qu'un choix d'apparence. Ces deux valeurs vivent donc ici,
 * jamais dans `components/ui/qr-code.tsx` : c'est le seul répertoire que le
 * gardien de L0-09 exempte (`tests/unit/theme/sans-couleur-en-dur.test.ts`).
 *
 * La valeur d'encre est celle que `docs/maquette/codiplan-maquette-complete.
 * html` dessine déjà pour son propre QR de démonstration (`drawQr()`,
 * `ctx.fillStyle="#07111f"`) — mesurée, pas choisie une seconde fois.
 */
export const QR_ENCRE = "#07111f";
export const QR_FOND = "#ffffff";
