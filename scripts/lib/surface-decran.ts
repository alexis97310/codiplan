/**
 * LA SURFACE D'ÉCRAN — ce dont une capture est la photographie (R1-02).
 *
 * ## LA QUESTION QUE LE README NE SAVAIT PAS RÉPONDRE
 *
 * Le README des captures nomme le commit photographié, et c'est la règle du §9
 * du 09/09 — *une affirmation portant sur un artefact construit nomme
 * l'empreinte où elle se vérifie.* Ce qu'il ne disait pas : **comment un
 * lecteur sait qu'aucun écran n'a bougé depuis.** La question se répond en une
 * commande, et *une commande tapée à la main est une commande qu'on ne tape
 * pas* — mesuré le 10/09/2026 : entre `b8c3f76` et `2fe6e8b`, 67 fichiers
 * changés et **aucun** de surface d'écran ; les images étaient exactes, et rien
 * dans le dossier ne le disait.
 *
 * ## DEUX MOITIÉS DE NATURE DIFFÉRENTE, ET UNE SEULE SE DÉCLARE
 *
 * **La moitié DÉDUITE ne s'écrit nulle part.** Un fichier qui porte l'une des
 * trois marques de `tests/unit/outils/rendu-visible.ts` — il rend du JSX, il
 * exporte les `metadata` de Next.js, il interroge l'écran — **est** de la
 * surface d'écran, par le fait. Un gardien exige que chacun tombe sous un
 * préfixe de `SURFACE_DECRAN` : la liste ci-dessous est donc une DÉCLARATION
 * confrontée à une source qu'elle ne contrôle pas, jamais une énumération
 * tenue à la main. *Une page écrite demain y entre le jour où elle est écrite,
 * ou le gardien rougit* — c'est la parade du §9 du 31/08, la propriété devenue
 * assertion plutôt que critère de sélection.
 *
 * **La moitié DÉCLARÉE porte son motif, parce qu'elle ne se déduit pas.** Trois
 * emplacements changent ce qu'un écran AFFICHE sans porter aucune marque : le
 * dictionnaire, où vit chaque mot qu'un humain lit (§5 de CLAUDE.md) ; le
 * thème, qui décide des couleurs ; et la feuille de style, seule forme sous
 * laquelle une palette se déclare (D95). Les oublier ferait dire « rien n'a
 * changé » le jour où tous les libellés ont changé.
 *
 * ## CE QUE CETTE LISTE NE VOIT PAS, ET C'EST ÉCRIT PLUTÔT QUE TU
 *
 * Un écran lit ce que le métier calcule — `lib/interventions/statistiques.ts`
 * décide du taux que le planning affiche, et il n'est pas ici. **La frontière
 * n'est pas « ce qui influence un écran » — ce serait le dépôt entier — mais
 * « ce qui RESTITUE » :** ce qui rend, ce qui nomme, ce qui colore. *Le verdict
 * dit donc « aucun fichier de restitution n'a changé », jamais « l'écran est
 * identique »*, et le rapport écrit la différence. C'est la forme 6 du §9 du
 * 26/08 appliquée à un périmètre : un contrôle annonce ce qu'il ne sait pas
 * arrêter, plutôt que de laisser croire qu'il l'arrête.
 */

/** Un morceau de surface d'écran, avec ce qui le fait en être. */
export type PortionDeSurface = {
  /** Préfixe de chemin, séparateurs `/`, terminé par `/` pour un répertoire. */
  readonly prefixe: string;
  /** Pourquoi un changement ici change ce qu'une capture montre. */
  readonly motif: string;
  /**
   * `deduite` : des fichiers y portent une marque de rendu, et un gardien
   * l'exige. `declaree` : aucun fichier n'y porte de marque, et c'est le motif
   * seul qui la fait entrer — donc il doit être lu.
   */
  readonly origine: "deduite" | "declaree";
};

export const SURFACE_DECRAN: readonly PortionDeSurface[] = [
  {
    prefixe: "app/",
    motif:
      "les écrans eux-mêmes — chaque page, chaque mise en page, et le groupe " +
      "de routes qui décide qu'un écran porte ou non la barre (R2-16)",
    origine: "deduite",
  },
  {
    prefixe: "components/",
    motif:
      "ce que les écrans assemblent — un tableau, une grille, une pastille de " +
      "statut : un composant change l'image sans que la page bouge d'une ligne",
    origine: "deduite",
  },
  {
    prefixe: "lib/i18n/",
    motif:
      "CHAQUE MOT qu'un humain lit en se servant de l'application (§5 de " +
      "CLAUDE.md). Aucun fichier n'y porte de marque de rendu — il ne rend " +
      "rien — et une prise de vue y survivrait à un changement de tous les " +
      "libellés",
    origine: "declaree",
  },
  {
    prefixe: "lib/theme/",
    motif:
      "la charte de la société active et les couleurs des huit statuts " +
      "(D51) — un code de lecture partagé, pas une préférence : une image " +
      "prise avant un changement de statut montre une autre couleur",
    origine: "declaree",
  },
  {
    prefixe: "app/globals.css",
    motif:
      "la SEULE forme sous laquelle une palette se déclare (D95) — " +
      "`lib/theme/apparence.ts` n'écrit aucune couleur, il nomme des rôles. " +
      "Nommé au fichier et non au répertoire : `app/` le couvre déjà, et " +
      "cette entrée existe pour que le motif soit LU",
    origine: "declaree",
  },
];

/**
 * L'état de la surface entre la prise de vue et aujourd'hui.
 *
 * **TROIS valeurs et jamais deux.** « Rien n'a changé » et « je ne sais pas »
 * ne se corrigent pas au même endroit, et les confondre sous un silence est
 * exactement ce que R1-02 refuse : un dépôt cloné en profondeur 1 ne connaît
 * pas l'empreinte photographiée, et rendrait « identique » en toute sincérité.
 */
export type EtatDeLaSurface =
  | { readonly etat: "identique"; readonly depuis: string }
  | {
      readonly etat: "change";
      readonly depuis: string;
      readonly fichiers: readonly string[];
    }
  | { readonly etat: "indecidable"; readonly pourquoi: string };

/** Un chemin de fichier relève-t-il de la surface d'écran ? */
export function estDeLaSurface(chemin: string): boolean {
  return SURFACE_DECRAN.some((portion) =>
    portion.prefixe.endsWith("/")
      ? chemin.startsWith(portion.prefixe)
      : chemin === portion.prefixe,
  );
}

/**
 * Le verdict, à partir des fichiers que `git diff --name-only` a rendus.
 *
 * La fonction ne LIT rien : ni dépôt, ni horloge, ni processus. L'appelant
 * fournit ce qu'il a observé, et c'est ce qui rend les deux moitiés du verdict
 * éprouvables sans dépôt fabriqué.
 */
export function etatDeLaSurface(
  empreinte: string,
  fichiersChanges: readonly string[],
): EtatDeLaSurface {
  const surface = [...new Set(fichiersChanges.filter(estDeLaSurface))].sort();
  if (surface.length === 0) {
    return { etat: "identique", depuis: empreinte };
  }
  return { etat: "change", depuis: empreinte, fichiers: surface };
}

/**
 * L'empreinte photographiée, LUE dans le README.
 *
 * *Le README est la seule source de ce fait* : c'est lui que la prise de vue
 * écrit, et le recopier ailleurs poserait une seconde lecture d'un même critère
 * (§9, 01/09). L'absence de l'empreinte est un refus, jamais une chaîne vide —
 * une empreinte vide comparerait le dépôt à rien et rendrait « identique ».
 */
export function empreintePhotographiee(readme: string): string | null {
  const trouve = /\*\*Commit photographié\*\*\s*\|\s*`([0-9a-f]{40})`/.exec(
    readme,
  );
  return trouve === null ? null : trouve[1];
}

/** Le rapport lu par un humain. Chaque ligne dit de quel côté du miroir elle vient. */
export function rapportDeLaSurface(etat: EtatDeLaSurface): string {
  const entete = [
    "Les écrans ont-ils changé depuis la prise de vue ?",
    "",
    "Ce qui est tenu pour SURFACE D'ÉCRAN (observé dans le dépôt) :",
    ...SURFACE_DECRAN.map(
      (p) => `  ${p.prefixe.padEnd(16)} ${p.origine} — ${p.motif}`,
    ),
    "",
  ];
  if (etat.etat === "indecidable") {
    return [
      ...entete,
      `VERDICT : INDÉCIDABLE — ${etat.pourquoi}`,
      "",
      "Ce n'est pas « rien n'a changé ». Aucune comparaison n'a eu lieu.",
    ].join("\n");
  }
  if (etat.etat === "identique") {
    return [
      ...entete,
      `VERDICT : AUCUN FICHIER DE RESTITUTION N'A CHANGÉ depuis ${etat.depuis.slice(0, 7)}.`,
      "",
      "Ce verdict ne dit PAS que les écrans sont identiques : ce qu'un écran",
      "AFFICHE dépend aussi de ce que le métier CALCULE, et ce calcul n'est pas",
      "de la surface. Il dit que rien de ce qui restitue n'a bougé.",
    ].join("\n");
  }
  return [
    ...entete,
    `VERDICT : ${etat.fichiers.length} fichier(s) de surface ont changé depuis ${etat.depuis.slice(0, 7)}.`,
    "",
    ...etat.fichiers.map((f) => `  ${f}`),
    "",
    "Les images du dossier sont donc ANTÉRIEURES à ces changements. Rejouer la",
    "prise de vue selon la procédure de docs/captures/README.md.",
  ].join("\n");
}
