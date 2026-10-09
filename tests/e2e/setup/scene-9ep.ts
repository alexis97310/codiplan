/**
 * LE TEXTE DE LA SCÈNE DES CAPTURES DE 9EP-CORRECTIFS-SOLDE-CREATIONS, HORS
 * DU FICHIER DE SPÉCIFICATION — même raison que `scene-9ek.ts` : le gardien
 * L0-11 prend une constante déclarée en tête d'un fichier qui interroge
 * l'écran pour une chaîne visible écrite en dur (forme 3) ; une valeur
 * IMPORTÉE lui est invisible (forme 6a). Ce module porte le texte de la
 * scène, rien de plus.
 */
export const PREFIXE_9EP = "9EP-";
export const RAISON_CLIENT_9EP = `${PREFIXE_9EP}Client (scène)`;
export const LIBELLE_SITE_9EP = `${PREFIXE_9EP}Site (scène)`;
export const LIBELLE_FAMILLE_9EP = `${PREFIXE_9EP}Famille`;
export const CODE_FAMILLE_9EP = "9EPFAM";
export const MARQUE_MODELE_9EP = `${PREFIXE_9EP}MARQUE`;
export const REFERENCE_MODELE_9EP = "REF-9EP";
export const NUMERO_SERIE_9EP = `${PREFIXE_9EP}SN-1`;
export const QR_TOKEN_9EP = "9EPQRTOKEN000000000001";
// UN SEUL HOMONYME (capture « 1 homonyme ») — raison sociale UNIQUE, jamais
// confondue avec la paire ci-dessous.
export const RAISON_HOMONYME_SEUL_9EP = `${PREFIXE_9EP}Garage Lefèvre (scène)`;
// DEUX HOMONYMES (capture « 2 homonymes ») — même forme normalisée (casse,
// espaces), jamais la même chaîne que `RAISON_HOMONYME_SEUL_9EP` ci-dessus.
export const RAISON_HOMONYME_PAIRE_9EP = `${PREFIXE_9EP}Garage Dupont (scène)`;
export const RAISON_HOMONYME_PAIRE_9EP_VARIANTE = `${PREFIXE_9EP}  garage   DUPONT (scène)`;
export const RAISON_SANS_HOMONYME_9EP = `${PREFIXE_9EP}Sans homonyme (scène)`;
