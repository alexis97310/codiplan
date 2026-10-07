/**
 * LE RETOUR AU FORMULAIRE APRÈS UN REFUS DE SAISIE (56-FORMULAIRES-2).
 *
 * `versLePlanning` (`../actions`) fait quitter l'écran et perd tout ce que
 * l'utilisateur avait saisi — c'est le constat de ce lot. Un refus de SAISIE
 * (le schéma, le lieu, la panne) revient ICI, au formulaire, avec ce qui avait
 * été soumis ; un refus de DROIT (`exigerCapacite` → `null`) garde
 * `versLePlanning`, inchangé.
 *
 * Vit dans un fichier À PART de `route.ts` : Next.js n'autorise sur un module
 * de route que les gestionnaires HTTP et sa poignée d'exports de
 * configuration — un export ordinaire y échoue le typage (`tsc` sur
 * `.next/types`). Ce module n'est pas une route, il n'a pas cette contrainte,
 * et reste testable directement.
 *
 * La description est TRONQUÉE à 1000 caractères dans l'URL : au-delà, une
 * panne longue ferait une adresse déraisonnable pour un simple retour d'écran
 * — la valeur pleine reste dans `description` côté serveur, jamais perdue
 * avant ce refus, seul le retour visuel est borné.
 */
const LIMITE_DESCRIPTION_URL = 1000;

export function versLeFormulaire(
  cle: string,
  champs: Readonly<{
    site?: string;
    machine?: string;
    type?: string;
    priorite?: string;
    description?: string;
    reference_client?: string;
    contact_id?: string;
    duree_min?: string;
    demande?: string;
    mode_valorisation?: string;
    // « + CRÉER ICI » (PG-D5-CREER-ICI) — la case reprise au même titre que
    // les autres champs : un refus de saisie ne doit pas faire perdre le
    // technicien, le jour ni l'heure d'où l'on vient.
    poser_technicien?: string;
    poser_date?: string;
    poser_heure?: string;
  }>,
): Response {
  const parametres = new URLSearchParams({ motif: cle });
  const valeurs: Readonly<Record<string, string | undefined>> = {
    site: champs.site,
    machine: champs.machine,
    type: champs.type,
    priorite: champs.priorite,
    description: champs.description?.slice(0, LIMITE_DESCRIPTION_URL),
    reference_client: champs.reference_client,
    contact_id: champs.contact_id,
    // LA DURÉE PRÉVUE (PG-B6-DUREE-A-LA-CREATION) — reprise au même titre que
    // les autres champs : un refus de saisie ne doit pas faire retaper une
    // durée choisie.
    duree_min: champs.duree_min,
    // LA DEMANDE D'ORIGINE ET LE MODE DE VALORISATION (9BR-TP-A4b-MESSAGES,
    // IN-03) — un refus de saisie perdait le champ caché `demande_id` (la
    // page rouvrait donc « hors demande ») et retombait toujours sur
    // « Temps passé », quel que soit le mode déjà choisi.
    demande: champs.demande,
    mode_valorisation: champs.mode_valorisation,
    poser_technicien: champs.poser_technicien,
    poser_date: champs.poser_date,
    poser_heure: champs.poser_heure,
  };
  for (const [nom, valeur] of Object.entries(valeurs)) {
    if (valeur !== undefined) {
      parametres.set(nom, valeur);
    }
  }
  return new Response(null, {
    status: 303,
    headers: { Location: `/interventions/nouvelle?${parametres.toString()}` },
  });
}

/**
 * LE MOTIF D'UN REFUS DE SCHÉMA (TP-UX5-1-FORMULAIRES) — extrait de
 * `route.ts` pour rester testable SANS session ni base, même raison que
 * `versLeFormulaire` ci-dessus.
 *
 * Trois motifs désignent un champ avec CERTITUDE : `type`, `description`,
 * et depuis la décision 15 d'Alexis du 05/10/2026 `priorite` — devenue
 * obligatoire À CETTE ROUTE SEULE (`schemaCreation` garde son
 * `.default("p3")` pour la réserve VGP et la reprise d'import, qui
 * n'appellent jamais cette fonction). Tout le reste retombe sur le repli
 * « lieu inconnu », jamais le champ Site à coup sûr.
 */
export function motifDuRefusDeSaisie(erreur: {
  readonly issues: ReadonlyArray<{
    readonly path: ReadonlyArray<PropertyKey>;
  }>;
}):
  | "intervention.refus.nature_manquante"
  | "intervention.refus.panne_manquante"
  | "intervention.refus.priorite_manquante"
  | "intervention.refus.lieu_inconnu" {
  const surLeType = erreur.issues.some((probleme) =>
    probleme.path.includes("type"),
  );
  const surLaDescription = erreur.issues.some((probleme) =>
    probleme.path.includes("description"),
  );
  const surLaPriorite = erreur.issues.some((probleme) =>
    probleme.path.includes("priorite"),
  );
  if (surLeType) {
    return "intervention.refus.nature_manquante";
  }
  if (surLaDescription) {
    return "intervention.refus.panne_manquante";
  }
  if (surLaPriorite) {
    return "intervention.refus.priorite_manquante";
  }
  return "intervention.refus.lieu_inconnu";
}
