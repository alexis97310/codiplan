/**
 * « NOUVELLE INTERVENTION » — LA MÉMOIRE LOCALE À L'APPAREIL (9F4H5-TERRAIN-
 * VIVANT, point 3). Arbitrage 3.19 maintenu (`docs/arbitrages.md`) : aucune
 * notification du téléphone, décision D130 d'Alexis (20/10/2026) — l'annonce
 * se fait DANS l'appli, sur Ma journée, jamais par le système.
 *
 * ## DEUX ENSEMBLES, PAS UN
 *
 * `connues` — toute intervention déjà apparue dans la liste sur CET appareil,
 * pour CE compte (`utilisateurId`) : sert à détecter une arrivée, une seule
 * fois. `enAttente` — les interventions détectées comme nouvelles et PAS
 * ENCORE OUVERTES : c'est elle qui porte la pastille et l'annonce, et elle
 * SURVIT à un rafraîchissement (§9, 01/09 — un rafraîchissement automatique,
 * `components/terrain/rafraichissement-auto.tsx`, point 2, ne doit jamais
 * faire disparaître une pastille que le technicien n'a pas encore vue).
 * Confondre les deux ferait disparaître la pastille au PROCHAIN
 * rafraîchissement plutôt qu'à l'OUVERTURE de la fiche, ce que le ticket
 * interdit explicitement.
 *
 * Aucune migration (hors territoire de ce ticket) : rien de ceci n'existe
 * côté serveur, et rien ne doit y exister — c'est une mémoire D'APPAREIL.
 */

function cleConnues(utilisateurId: string): string {
  return `codiplan.terrain.${utilisateurId}.connues`;
}

function cleEnAttente(utilisateurId: string): string {
  return `codiplan.terrain.${utilisateurId}.nouvelles_en_attente`;
}

function lireEnsemble(cle: string): ReadonlySet<string> | null {
  try {
    const brut = window.localStorage.getItem(cle);
    if (brut === null) {
      return null;
    }
    return new Set(JSON.parse(brut) as readonly string[]);
  } catch {
    return null;
  }
}

function ecrireEnsemble(cle: string, valeurs: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(cle, JSON.stringify([...valeurs]));
  } catch {
    // Le stockage peut être indisponible (navigation privée) — cette
    // mémoire n'est qu'un confort d'affichage, jamais une condition de
    // fonctionnement (I4) : rien n'échoue si elle manque.
  }
}

/**
 * LA PART PURE (éprouvée sans navigateur, D-13) — quels ids, parmi ceux
 * affichés, sont ABSENTS de `connues` ? `connues === null` signifie
 * « jamais affiché sur cet appareil pour ce compte » : rien n'est nouveau au
 * tout premier affichage, par construction (le ticket l'exige en toutes
 * lettres).
 */
export function idsNouveaux(
  connues: ReadonlySet<string> | null,
  idsAffiches: readonly string[],
): readonly string[] {
  if (connues === null) {
    return [];
  }
  return idsAffiches.filter((id) => !connues.has(id));
}

export type MiseAJourVues = {
  readonly enAttente: ReadonlySet<string>;
  readonly nouveaux: readonly string[];
};

/**
 * LIT, COMPARE, ÉCRIT — en un seul passage (jamais deux lectures séparées,
 * qui s'exposeraient à une mise à jour entre les deux). Appelée à chaque
 * rendu de Ma journée (montage, et après chaque rafraîchissement
 * automatique) avec la liste COMPLÈTE des ids actuellement affichés.
 */
export function mettreAJourVues(
  utilisateurId: string,
  idsAffiches: readonly string[],
): MiseAJourVues {
  const connues = lireEnsemble(cleConnues(utilisateurId));
  const nouveaux = idsNouveaux(connues, idsAffiches);

  const connuesMaj = new Set(connues ?? []);
  for (const id of idsAffiches) {
    connuesMaj.add(id);
  }
  ecrireEnsemble(cleConnues(utilisateurId), connuesMaj);

  const enAttenteMaj = new Set(lireEnsemble(cleEnAttente(utilisateurId)) ?? []);
  for (const id of nouveaux) {
    enAttenteMaj.add(id);
  }
  ecrireEnsemble(cleEnAttente(utilisateurId), enAttenteMaj);

  return { enAttente: enAttenteMaj, nouveaux };
}

/**
 * LA FICHE A ÉTÉ OUVERTE — sa pastille s'efface, DE FAÇON PERSISTANTE (point
 * 3 : « La pastille disparaît quand la fiche a été ouverte »). Appelée au
 * clic sur la carte, avant la navigation.
 */
export function marquerOuverte(utilisateurId: string, id: string): void {
  const enAttente = lireEnsemble(cleEnAttente(utilisateurId));
  if (enAttente === null || !enAttente.has(id)) {
    return;
  }
  const maj = new Set(enAttente);
  maj.delete(id);
  ecrireEnsemble(cleEnAttente(utilisateurId), maj);
}
