import { z } from "zod";

/**
 * SAISIE D'UN DOCUMENT ET D'UN FICHIER DU BAC (lot 8, tickets L8-01 à L8-07 ;
 * arbitrages D87, D93, D94).
 *
 * ## LA CIBLE EST UNE SOMME, PAS DEUX CHAMPS FACULTATIFS
 *
 * Un document s'accroche **au modèle** — notice, fiche technique, manuel
 * d'atelier, identiques pour tous les exemplaires — **ou à la machine** —
 * certificat de conformité, procès-verbal de mise en service, propres à un
 * exemplaire. *Jamais aux deux.* La base le refuse par
 * `num_nonnulls(modele_id, machine_id) = 1` ; la saisie l'exprime par une union
 * discriminée, si bien qu'un appelant ne peut pas **écrire** l'état interdit —
 * là où deux champs nullables l'auraient laissé le composer, puis le faire
 * refuser par un message de base de données.
 *
 * **Les deux verrous ne se recouvrent pas et aucun ne remplace l'autre** : la
 * base garde tous les chemins, y compris une console ; le type garde celui-ci,
 * et il le garde à la COMPILATION.
 *
 * ## CE QUE CE MODULE NE FAIT PAS
 *
 * **Il ne calcule aucune empreinte et ne touche aucun octet.** L'empreinte
 * SHA-256 est fournie par le chemin qui a reçu le fichier ; ce module vérifie sa
 * FORME — 64 hexadécimaux minuscules — et rien d'autre. Une empreinte en
 * majuscules et la même en minuscules seraient deux documents distincts, et la
 * déduplication laisserait passer le doublon qu'elle existe pour attraper.
 *
 * **Il n'invente aucune date.** `date_document` et `date_expiration` existent
 * dès le premier jour (L8-06) et **aucun code ne les lit** : ni seuil, ni
 * tolérance, ni « bientôt » — c'est la doctrine du registre VGP, et elle vaut
 * ici pour la même raison (§8, un délai ne s'invente pas).
 *
 * **Il ne décide d'aucune classe par défaut.** `client` ou `interne` : celui qui
 * dépose choisit. Un défaut se tromperait dans un sens ou dans l'autre, et *un
 * document mal classé est pire qu'un document absent.*
 */

/** Un texte obligatoire, une fois les espaces de bordure retirés. */
const texteNonVide = z.string().trim().min(1);

/**
 * Les DEUX classes de visibilité, et deux seulement (L8-03).
 *
 * **Closes ici ET en base**, à l'inverse des zones géographiques : ce n'est pas
 * la nomenclature d'un territoire, c'est la question « le client a-t-il le droit
 * de lire ce document », qui se pose de la même façon chez toute société.
 *
 * *À cinq valeurs, personne ne classe juste.*
 */
export const CLASSES_DOCUMENT = ["client", "interne"] as const;
export type ClasseDocument = (typeof CLASSES_DOCUMENT)[number];

/** Les trois états d'un fichier du bac (L8-07). */
export const STATUTS_DOCUMENT_RECU = ["a_traiter", "classe", "ecarte"] as const;
export type StatutDocumentRecu = (typeof STATUTS_DOCUMENT_RECU)[number];

/**
 * L'empreinte SHA-256, en hexadécimal MINUSCULE.
 *
 * La casse n'est pas normalisée ici, elle est REFUSÉE. Normaliser accepterait
 * deux écritures d'un même condensat et laisserait croire que le producteur a
 * un contrat ; refuser dit où le contrat se tient.
 */
export const empreinteSha256 = z.string().regex(/^[0-9a-f]{64}$/);

/**
 * LA CIBLE D'UN DOCUMENT — une somme, jamais deux champs facultatifs.
 *
 * *Voir l'en-tête : c'est la forme que L2-04 a mesurée comme fonctionnelle, et
 * l'union discriminée en est la traduction au niveau du type.*
 */
export const cibleDocument = z.discriminatedUnion("cible", [
  z.object({ cible: z.literal("modele"), modele_id: z.uuid() }),
  z.object({ cible: z.literal("machine"), machine_id: z.uuid() }),
]);
export type CibleDocument = z.infer<typeof cibleDocument>;

/** Les colonnes de la cible, telles que la base les attend. */
export function colonnesDeCible(cible: CibleDocument): {
  modele_id: string | null;
  machine_id: string | null;
} {
  return cible.cible === "modele"
    ? { modele_id: cible.modele_id, machine_id: null }
    : { modele_id: null, machine_id: cible.machine_id };
}

/** La fiche d'un document, telle qu'un appelant la compose. */
export const schemaDocument = z.object({
  cible: cibleDocument,
  classe: z.enum(CLASSES_DOCUMENT),
  libelle: texteNonVide,
  nom_fichier: texteNonVide,
  type_mime: texteNonVide,
  taille_octets: z.number().int().positive(),
  empreinte: empreinteSha256,
  /**
   * Où sont les octets. **Fournie par l'appelant, jamais fabriquée ici** : le
   * module de stockage n'existe pas, faute d'appelant (D93), et inventer une
   * convention de nommage l'engagerait à sa place.
   */
  objet_cle: texteNonVide,
  date_document: z.date().nullable().default(null),
  date_expiration: z.date().nullable().default(null),
});
export type SaisieDocument = z.infer<typeof schemaDocument>;

/** Un fichier déposé au bac, avant tout rapprochement (L8-07). */
export const schemaDocumentRecu = z.object({
  empreinte: empreinteSha256,
  nom_fichier: texteNonVide,
  type_mime: texteNonVide,
  taille_octets: z.number().int().positive(),
  objet_cle: texteNonVide,
  apercu_objet_cle: z.string().trim().min(1).nullable().default(null),
});
export type SaisieDocumentRecu = z.infer<typeof schemaDocumentRecu>;

/**
 * LE CLASSEMENT D'UN FICHIER DU BAC — il exige une cible NOMMÉE.
 *
 * **Il n'existe aucune fonction qui classe seule**, et c'est le cœur de L8-07 :
 * *un rapprochement faux accroche la notice d'un compresseur à un pont
 * élévateur, et personne ne le voit avant qu'un technicien suive la mauvaise
 * procédure.* C'est de la sécurité, pas de la qualité de données — le mode de
 * défaillance n'est pas « une fiche est mal remplie », c'est un geste dangereux
 * exécuté avec confiance.
 *
 * Le type le dit : la cible est OBLIGATOIRE et vient de l'appelant. Une
 * proposition ne se transforme pas en classement toute seule.
 */
export const schemaClassement = z.object({
  cible: cibleDocument,
  classe: z.enum(CLASSES_DOCUMENT),
  libelle: texteNonVide,
});
export type Classement = z.infer<typeof schemaClassement>;

/**
 * L'ÉCARTEMENT — il exige un MOTIF, et la base l'exige aussi.
 *
 * *Un écartement sans motif est un écartement que personne ne pourra rejuger.*
 * L'équivalence est écrite en base dans les DEUX sens — ni écarté sans motif,
 * ni motif sans écartement —, et le second sens est celui qu'on oublie (D88).
 */
export const schemaEcartement = z.object({ motif: texteNonVide });
export type Ecartement = z.infer<typeof schemaEcartement>;
