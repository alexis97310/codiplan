/**
 * LE TEXTE DE LA SCÈNE DE 9EK-TP-UX5-2-CREATIONS-2, HORS DU FICHIER DE
 * SPÉCIFICATION — même raison que `scene-9ek.ts` : le gardien L0-11 prend
 * une constante déclarée en tête d'un fichier qui interroge l'écran pour une
 * chaîne visible écrite en dur (forme 3) ; une valeur IMPORTÉE lui est
 * invisible (forme 6a). Ce module porte le texte de la scène, rien de plus.
 *
 * **PRÉFIXE `9EKM-`, PAS `9EK-`** — `9EK-TP-UX5-2-CREATIONS-1.spec.ts`
 * nettoie en `afterAll` tout `client`/`site` dont le libellé COMMENCE PAR
 * `9EK-` (`startsWith`, insensible à la casse) : une machine rattachée à un
 * client balayé par ce nettoyage étranger échouerait à sa propre suppression
 * (clé étrangère `Restrict`). `"9EKM-".startsWith("9EK-")` est FAUX — le
 * quatrième caractère diverge (« M » contre « - ») — ce préfixe est donc à
 * l'abri du nettoyage de l'autre fichier.
 */
export const PREFIXE_9EKM = "9EKM-";
export const RAISON_CLIENT_9EKM = `${PREFIXE_9EKM}Client (scène)`;
export const LIBELLE_SITE_9EKM = `${PREFIXE_9EKM}Site (scène)`;
export const LIBELLE_FAMILLE_A_9EKM = `${PREFIXE_9EKM}Famille A`;
export const LIBELLE_FAMILLE_B_9EKM = `${PREFIXE_9EKM}Famille B`;
export const CODE_FAMILLE_A_9EKM = "9EKMFAMA";
export const CODE_FAMILLE_B_9EKM = "9EKMFAMB";
export const MARQUE_MODELE_A_9EKM = `${PREFIXE_9EKM}MARQUE-A`;
export const MARQUE_MODELE_B_9EKM = `${PREFIXE_9EKM}MARQUE-B`;
export const REFERENCE_MODELE_A_9EKM = "REF-A";
export const REFERENCE_MODELE_B_9EKM = "REF-B";
export const NUMERO_SERIE_9EKM = `${PREFIXE_9EKM}SN-1`;
export const REFERENCE_INTERNE_9EKM = `${PREFIXE_9EKM}R1`;
