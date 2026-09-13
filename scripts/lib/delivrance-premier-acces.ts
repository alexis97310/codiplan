import type { Envoi } from "@/lib/courriel/message";

/**
 * LA DÉLIVRANCE DU LIEN DE PREMIER ACCÈS — à QUI il part, et QUELLE identité
 * il ouvre (13/09/2026, complément de Q8).
 *
 * ## Le défaut que ce module répare, et il est mesuré
 *
 * `envoyerSiDemande(demande, email, url)` envoyait à `email`, **et `email` est
 * l'argument qui DÉSIGNE l'identité** : `reemettreJetonPremierAcces` la cherche
 * par `utilisateur.findUnique({ where: { email } })`. Le destinataire n'était
 * donc pas un paramètre — c'était l'adresse de l'identité.
 *
 * Or les neuf identités du semis portent des adresses en `@codima.test`, et
 * **`.test` est réservé par la RFC 2606** : il ne résout chez aucun
 * prestataire. *Le lien partait dans le vide, et la seule porte d'une base
 * semée est le lien de premier accès* (D65 : le semis pose
 * `compte.mot_de_passe = NULL`). L'autre voie — ouvrir une identité à une vraie
 * adresse — est fermée elle aussi : `ouvrirPremierCompte` refuse dès que la
 * société porte une habilitation, et le semis en pose sur les deux sociétés.
 *
 * ## POURQUOI CE MODULE EXISTE PLUTÔT QU'UN `??` DANS LE SCRIPT
 *
 * Un `destinataire ?? email` écrit dans le corps du script serait juste et
 * **inéprouvable** : `amorcage-premier-compte.mts` est un `.mts` dont la
 * dernière ligne exécute `principal()`, si bien que l'importer, c'est le jouer.
 * Ce qui doit être mesuré — *le défaut rend l'adresse de l'identité*, *la
 * dissociation se lit dans la sortie* — vit donc ici, comme
 * `scripts/lib/arguments.ts` vit hors du même script pour la même raison.
 */

/**
 * À qui le lien part, et quelle identité il ouvre.
 *
 * `dissociee` est **dérivée**, jamais reçue : deux champs indépendants dont
 * l'un dit ce que les deux autres disent déjà, c'est la divergence silencieuse
 * du §9 (01/09) offerte gratuitement.
 */
export type Delivrance = {
  /** L'adresse qui DÉSIGNE l'identité — celle que la base cherche. */
  readonly identite: string;
  /** La boîte qui reçoit le message. */
  readonly destinataire: string;
  /** Les deux diffèrent-elles ? */
  readonly dissociee: boolean;
};

/**
 * Résout la délivrance. **Sans `--destinataire`, RIEN NE CHANGE** : le lien
 * part à l'adresse de l'identité, exactement comme avant le 13/09/2026.
 *
 * *Une chaîne vide vaut une absence* — le flux GitHub passe une entrée
 * facultative, et une entrée facultative non renseignée arrive vide, jamais
 * absente. Sans cela, `--destinataire ""` enverrait à personne en silence.
 */
export function resoudreDelivrance(
  identite: string,
  destinataireDemande: string | null,
): Delivrance {
  const demande = destinataireDemande?.trim() ?? "";
  const destinataire = demande === "" ? identite : demande;
  return { identite, destinataire, dissociee: destinataire !== identite };
}

/**
 * Ce que la sortie dit d'un envoi. **LES DEUX ADRESSES, TOUJOURS.**
 *
 * *Elles sont imprimées même quand elles coïncident*, et c'est une décision :
 * si la mention de l'identité n'apparaissait qu'en cas de dissociation, ce
 * serait son ABSENCE qui porterait le sens — et une absence a exactement la
 * forme d'un succès (§9, 31/08). En les imprimant toutes les deux, le lecteur
 * les COMPARE : il observe, il n'infère pas d'une convention qu'il faudrait
 * connaître.
 *
 * La ligne d'avertissement, elle, ne s'ajoute qu'en cas de dissociation — elle
 * ne porte aucun fait que les deux adresses ne portent déjà, elle en dit la
 * conséquence.
 */
export function lignesDelivrance(
  envoi: Envoi,
  delivrance: Delivrance,
): readonly string[] {
  const pour = `POUR L'IDENTITÉ ${delivrance.identite}`;
  const avertissement = delivrance.dissociee
    ? [
        `  DESTINATAIRE DISSOCIÉ : le lien n'est pas parti à l'adresse de ` +
          `l'identité. Qui le suit entre dans l'application sous ` +
          `${delivrance.identite}.`,
      ]
    : [];

  if (envoi.parti) {
    return [
      `  Courriel ENVOYÉ à ${delivrance.destinataire} ${pour} — ` +
        `référence ${envoi.reference}.`,
      ...avertissement,
      "  Cette référence dit que le prestataire a pris la charge du message ; " +
        "elle ne prouve pas qu'il a été reçu.",
    ];
  }
  // LE REFUS EST BAVARD, ET IL DIT CE QUI RESTE VRAI. Un « échec d'envoi » seul
  // laisserait croire que le geste entier a raté — alors que le jeton, lui, est
  // bien émis et imprimé par l'appelant.
  return [
    `  COURRIEL NON ENVOYÉ à ${delivrance.destinataire}, ${pour}.`,
    `  ${envoi.motif}`,
    "  Le jeton, lui, EST émis : l'URL ci-dessus reste valable une heure.",
  ];
}
