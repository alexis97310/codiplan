"use client";

import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { CaseACocher } from "@/components/ui/case-a-cocher";
import { enDuree } from "@/lib/calendar/duree";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { peutTerminer } from "@/lib/interventions/cycle-de-vie";
import type {
  IssueSignature,
  StatutIntervention,
} from "@/lib/interventions/saisie";
import {
  demarrerActiviteTerrain,
  terminerActiviteTerrain,
} from "@/lib/terrain/activite-saisie";
import { cleBrouillon } from "@/lib/terrain/brouillon";
import {
  ajouterSaisie,
  type DetailCompteurDemarreEnLigne,
  type DetailPrestationsEnvoyees,
  differencePrestations,
  EVENEMENT_COMPTEUR_DEMARRE_EN_LIGNE,
  EVENEMENT_FILE_MODIFIEE,
  EVENEMENT_PRESTATIONS_ENVOYEES,
  type EntreeFile,
  instantAvantEnvoi,
  listerFilePourIntervention,
  nouvelleOperation,
  retirerSaisieCoalescable,
} from "@/lib/terrain/file-saisies";

/**
 * LE RAPPORT DE TERRAIN, ENTIÈREMENT AUTOMATIQUE (9F4-TERRAIN-ENREGISTREMENT-
 * AUTO, décision d'Alexis n° 95) — commentaire, suite à donner, prestations
 * et signature s'enregistrent SEULS en arrière-plan ; plus aucun bouton
 * « Enregistrer » par bloc. Un seul geste reste manuel : « Terminer
 * l'intervention », en bas.
 *
 * ## UN SEUL COMPOSANT POUR POUVOIR TOUT ENVOYER AVANT DE TERMINER
 *
 * `flushTout` doit pouvoir atteindre l'état COURANT des quatre blocs pour
 * les envoyer avant le `POST terminer` — rapport, prestations et signature
 * vivent donc dans le MÊME composant que le bouton, plutôt que dans des
 * composants frères qu'il faudrait coordonner par un contexte. Les photos
 * restent un composant indépendant (`PhotosTerrain`, 9EWB) : la page les
 * passe en `sectionPhotos` pour garder l'ordre visuel d'origine sans sortir
 * de ce fichier le tracé qui les concerne.
 *
 * ## LE BROUILLON LOCAL — RIEN NE SE PERD (I4)
 *
 * Toute saisie est écrite dans `localStorage`, sous l'intervention, AVANT
 * même la tentative d'envoi réseau. Au montage, un brouillon trouvé prend le
 * pas sur les valeurs du serveur : c'est forcément lui le plus récent,
 * puisqu'il n'existe que si une saisie locale a eu lieu depuis le dernier
 * envoi réussi. Il n'est effacé qu'après un « Terminer » accepté.
 *
 * **Limite acceptée** : le TRACÉ de la signature n'est pas redessiné sur le
 * canevas après un rechargement — seule l'image déjà capturée (le PNG) est
 * conservée dans le brouillon et renvoyée. Redessiner un tracé reconstruit
 * depuis ses pixels aurait ajouté une complexité que la donnée elle-même ne
 * justifie pas : rien n'est perdu, seul l'aperçu visuel du trait l'est.
 */

type Etat =
  | "repos"
  | "attente"
  | "envoi"
  | "enregistre"
  | "echec"
  | "hors_ligne"
  | "echec_gardee";

export type PrestationOption = {
  readonly id: string;
  readonly libelle: string;
};

/** Une pièce remplacée telle que lue depuis le serveur (9I7B). */
export type PieceRemplaceeInitiale = {
  readonly designation: string;
  readonly reference: string | null;
  readonly quantite: number;
};

/** La forme ÉCRAN d'une ligne de pièce — `reference` reste une chaîne (jamais `null`) pour un `<input>` contrôlé. */
type LignePiece = {
  readonly id: string;
  readonly designation: string;
  readonly reference: string;
  readonly quantite: number;
};

/** Le relevé prêt pour l'envoi — lignes sans désignation écartées, référence vide devenue `null`. */
type PieceEnvoi = {
  readonly designation: string;
  readonly reference: string | null;
  readonly quantite: number;
};

function piecesDepuisInitiales(
  initiales: readonly PieceRemplaceeInitiale[],
): readonly LignePiece[] {
  return initiales.map((p) => ({
    id: crypto.randomUUID(),
    designation: p.designation,
    reference: p.reference ?? "",
    quantite: p.quantite,
  }));
}

function piecesPourEnvoi(lignes: readonly LignePiece[]): readonly PieceEnvoi[] {
  return lignes
    .filter((p) => p.designation.trim().length > 0)
    .map((p) => ({
      designation: p.designation.trim(),
      reference: p.reference.trim().length === 0 ? null : p.reference.trim(),
      quantite: p.quantite,
    }));
}

type SignatureBrouillon =
  | {
      readonly issue: "signee";
      readonly nom: string;
      readonly qualite: string;
      readonly image: string;
    }
  | {
      readonly issue: "client_absent" | "refus_signature";
      readonly motif: string;
    };

type Brouillon = {
  readonly commentaire: string;
  readonly suite: string;
  readonly prestationIds: readonly string[];
  /**
   * LA BASE SERVEUR CONNUE AU MOMENT DE L'ÉCRITURE (point 3,
   * 9F4H6E-PRESTATIONS-DIFFERENCE-EN-LIGNE) — sans elle, reprendre
   * `prestationIds` TEL QUEL au montage suivant écraserait tout ajout fait
   * par le BUREAU, sur le serveur, PENDANT que ce brouillon dormait (D143) :
   * `prestationIds` ne porte que ce que CET écran affichait, pas ce qu'il a
   * explicitement voulu changer. Absente d'un brouillon écrit par une
   * version antérieure à ce ticket — voir `fusionnerBrouillonPrestations`.
   */
  readonly prestationsBase?: readonly string[];
  readonly signature: SignatureBrouillon | null;
  /**
   * LES PIÈCES REMPLACÉES (9I7B) — absent d'un brouillon antérieur à ce
   * ticket, devient `[]` (voir `lireBrouillon`). Jamais une différence comme
   * les prestations : le remplacement est TOUJOURS intégral.
   */
  readonly pieces?: readonly LignePiece[];
};

/**
 * REJOUE LA PROPRE DIFFÉRENCE DU BROUILLON SUR LA BASE FRAÎCHE, JAMAIS SON
 * ENSEMBLE TEL QUEL (point 3, 9F4H6E-PRESTATIONS-DIFFERENCE-EN-LIGNE) — le
 * brouillon a pu être écrit AVANT un ajout du bureau (D143) ; comparer SA
 * propre sélection à SA propre base (toutes deux écrites ENSEMBLE par
 * `ecrireBrouillonCourant`) isole ce que le TECHNICIEN a changé, pour
 * l'appliquer PAR-DESSUS `prestationsInitiales` — même principe que la
 * fusion au rafraîchissement, ci-dessous.
 *
 * **Un brouillon d'une version antérieure, sans `prestationsBase`**
 * (9F4H6F-PRESTATIONS-ANCIEN-CLIENT) — AUCUNE différence n'est alors
 * connue, jamais une différence vide : avant ce correctif, le calcul
 * ci-dessous (`baseBrouillon = voulues`) rendait `ajoutees`/`retirees`
 * systématiquement vides, et `prestationsInitiales` écrasait purement et
 * simplement `brouillon.prestationIds` — la sélection locale du technicien
 * disparaissait EN SILENCE au remontage. `brouillon.prestationIds` est
 * repris TEL QUEL, exactement le comportement d'avant l'introduction de
 * `prestationsBase` : rien n'est perdu, même si un ajout du bureau fait
 * entre-temps n'est alors pas connu de CE brouillon-là.
 */
function fusionnerBrouillonPrestations(
  brouillon: Brouillon,
  prestationsInitiales: readonly string[],
): ReadonlySet<string> {
  if (brouillon.prestationsBase === undefined) {
    return new Set(brouillon.prestationIds);
  }
  const baseBrouillon = new Set(brouillon.prestationsBase);
  const voulues = new Set(brouillon.prestationIds);
  const ajoutees = [...voulues].filter((id) => !baseBrouillon.has(id));
  const retirees = [...baseBrouillon].filter((id) => !voulues.has(id));
  const fusion = new Set(prestationsInitiales);
  for (const id of ajoutees) {
    fusion.add(id);
  }
  for (const id of retirees) {
    fusion.delete(id);
  }
  return fusion;
}

function estTableauDeChaines(valeur: unknown): valeur is readonly string[] {
  return Array.isArray(valeur) && valeur.every((v) => typeof v === "string");
}

/**
 * LES PIÈCES D'UN BROUILLON, VALIDÉES (9I7B) — un brouillon antérieur à ce
 * ticket, corrompu, ou écrit par une version future incompatible devient
 * `[]`, jamais une levée : même doctrine que `prestationsBase` ci-dessus.
 */
function piecesValides(valeur: unknown): readonly LignePiece[] {
  if (!Array.isArray(valeur)) {
    return [];
  }
  return valeur
    .filter(
      (p): p is Record<string, unknown> => typeof p === "object" && p !== null,
    )
    .map((p) => ({
      id: typeof p.id === "string" ? p.id : crypto.randomUUID(),
      designation: typeof p.designation === "string" ? p.designation : "",
      reference: typeof p.reference === "string" ? p.reference : "",
      quantite: typeof p.quantite === "number" ? p.quantite : 1,
    }));
}

function lireBrouillon(interventionId: string): Brouillon | null {
  try {
    const brut = window.localStorage.getItem(cleBrouillon(interventionId));
    if (brut === null) {
      return null;
    }
    const valeur = JSON.parse(brut) as Brouillon;
    // `prestationsBase` NON VALIDÉ, SINON `new Set(...)` LÈVE (point 4,
    // 9F4H6F-PRESTATIONS-ANCIEN-CLIENT) — un brouillon corrompu (stockage
    // partagé, écriture d'une version future incompatible) où ce champ
    // n'est ni absent ni un tableau de chaînes ferait lever
    // `fusionnerBrouillonPrestations` à la première utilisation. Traité
    // comme absent plutôt que de faire échouer toute la reprise du
    // brouillon : la branche « ancien format » ci-dessus s'applique alors.
    return {
      ...valeur,
      prestationsBase: estTableauDeChaines(valeur.prestationsBase)
        ? valeur.prestationsBase
        : undefined,
      pieces: piecesValides(valeur.pieces),
    };
  } catch {
    return null;
  }
}

function effacerBrouillon(interventionId: string): void {
  try {
    window.localStorage.removeItem(cleBrouillon(interventionId));
  } catch {
    // Le stockage peut être indisponible (navigation privée) — le filet
    // qu'il offre disparaît alors avec lui, sans faire échouer la saisie.
  }
}

const DELAI_MAXIMAL_ENVOI_MS = 15_000;

/**
 * `sansSession` (point 2, 9F4H4D) — la COQUILLE `/terrain-hors-reseau`, où
 * aucune session n'existe jamais (voir le docblock du même nom dans
 * `compteur-terrain.tsx`). Un `"auth.refus"` (D-12, `lib/auth/porte.ts`) y
 * est rendu en `null`, exactement comme l'échec réseau ci-dessous : les
 * quatre appelants le mettent alors en file sans qu'aucun ne distingue les
 * deux cas, et sans que « Vos saisies sont gardées… » mente.
 */
async function envoyerJson(
  url: string,
  corps: FormData,
  sansSession = false,
): Promise<{ readonly ok: boolean; readonly motif: string | null } | null> {
  const limite = new AbortController();
  const minuteurAbandon = setTimeout(
    () => limite.abort(),
    DELAI_MAXIMAL_ENVOI_MS,
  );
  try {
    const reponseServeur = await fetch(url, {
      method: "POST",
      body: corps,
      headers: { Accept: "application/json" },
      signal: limite.signal,
    });
    const resultat = (await reponseServeur.json()) as {
      readonly ok: boolean;
      readonly motif: string | null;
    };
    if (sansSession && !resultat.ok && resultat.motif === "auth.refus") {
      return null;
    }
    return resultat;
  } catch {
    // Pas de réseau, requête abandonnée après `DELAI_MAXIMAL_ENVOI_MS`, ou la
    // requête n'a pas atteint le serveur — c'est exactement le cas que I4
    // demande de ne jamais faire échouer : le brouillon local reste, et sera
    // renvoyé (retour du réseau, ou prochain « Terminer »).
    return null;
  } finally {
    clearTimeout(minuteurAbandon);
  }
}

/**
 * LE VERDICT D'UN BLOC (point 1, 9F4A-TERMINER-SANS-PERTE) — « Terminer »
 * doit distinguer trois issues, jamais les réduire à un booléen : accepté
 * par le serveur (ou rien à envoyer), refusé AVEC SON MOTIF, ou jamais
 * parti faute de réseau. Sans ce détail, `onClickTerminer` ne peut pas
 * nommer, sous le bouton, ce qui bloque encore.
 */
type VerdictBloc =
  | { readonly etat: "accepte" }
  | { readonly etat: "hors_ligne" }
  | { readonly etat: "echec"; readonly motifCle: string | null };

function texteDuMotif(motifCle: string | null): string {
  if (motifCle === null) {
    return "";
  }
  return estCleTraduction(motifCle) ? t(motifCle) : motifCle;
}

/**
 * LE RÉSUMÉ DE « TERMINER » (D219, décision d'Alexis du 21/10/2026) — quatre
 * fonctions, jamais un `const` au texte calculé par ternaire (même piège que
 * `libelleDuBouton` documente dans `compteur-terrain.tsx`, gardien L0-11).
 */
function texteConfirmationTemps(minutesConnues: number): string {
  return `${t("terrain.terminer.confirmation.temps")} ${enDuree(minutesConnues)}`;
}

function texteConfirmationRapport(rempli: boolean): string {
  return rempli
    ? t("terrain.terminer.confirmation.rapport_rempli")
    : t("terrain.terminer.confirmation.rapport_vide");
}

function texteConfirmationPrestations(nombre: number): string {
  return `${t("terrain.terminer.confirmation.prestations")} ${nombre}`;
}

function texteConfirmationSignature(issue: IssueSignature | null): string {
  if (issue === "signee") {
    return t("terrain.signature.option_signee");
  }
  if (issue === "client_absent") {
    return t("terrain.signature.option_absent");
  }
  if (issue === "refus_signature") {
    return t("terrain.signature.option_refus");
  }
  return t("terrain.terminer.confirmation.signature_rien");
}

/**
 * UNE DIFFÉRENCE DÉJÀ ACCEPTÉE PAR LE SERVEUR, PAS ENCORE REFLÉTÉE DANS LES
 * PROPS (point 3, 9F4H6F-PRESTATIONS-ANCIEN-CLIENT) — voir le journal
 * `journalDiffsAccepteesRef` ci-dessous.
 */
type DiffAcceptee = {
  readonly ajouterIds: readonly string[];
  readonly retirerIds: readonly string[];
};

function memeEnsemble(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const valeur of a) {
    if (!b.has(valeur)) {
      return false;
    }
  }
  return true;
}

/**
 * LA MESURE DU COMPTEUR DANS LA FILE (point 4, C5 ; point 3, 9F4H3AC) —
 * apparie chronologiquement les gestes `compteur` restés en file : un
 * « démarrer » suivi d'un « arrêter » ferme un segment, dont la durée
 * s'ajoute à `minutes`. Les entrées sont déjà triées chronologiquement par
 * `listerFilePourIntervention` (tri par `id`, un UUID v7).
 *
 * **`segmentOuvertConnu` — un segment démarré EN LIGNE, connu du serveur au
 * moment du rendu** (point 3, 9F4H3AC) : son début amorce `debut` comme le
 * ferait un « démarrer » de la file, pour que la suite du parcours s'applique
 * sans distinguer les deux origines — un « arrêter » hors réseau qui le
 * referme mesure sa durée normalement ; aucun « arrêter » ne le laisse
 * `segmentOuvert`. Sans lui, un compteur démarré EN LIGNE puis jamais arrêté
 * dans la file semblait n'avoir AUCUN segment ouvert (la file, elle, est
 * vide), et retombait sur le refus « temps manquant » du repli ci-dessous
 * plutôt que sur son exception.
 *
 * **`segmentOuvert` — un « démarrer » que rien ne referme encore.** Son
 * temps n'est PAS mesurable ici : c'est le serveur qui fermera ce segment, à
 * l'instant même que porte la saisie « terminer » (`terminerIntervention`,
 * `lib/interventions/depot-rapport-terrain.ts`, ferme le segment ouvert sur
 * `effectif` AVANT d'appeler `mesurer`) — jamais « maintenant », qui n'a
 * aucun sens une fois la saisie simplement mise en file. Un appelant qui
 * traiterait `segmentOuvert` comme zéro minute referait l'erreur corrigée
 * par ce correctif (9F4H3AA) : refuser localement « temps manquant » pour un
 * compteur qui tourne, alors que le serveur, lui, mesurera un temps réel dès
 * l'envoi.
 */
function mesureCompteurDeLaFile(
  entrees: readonly EntreeFile[],
  segmentOuvertConnu: { readonly debut: string } | null,
): {
  readonly minutes: number;
  readonly segmentOuvert: boolean;
} {
  let minutes = 0;
  let debut: string | null = segmentOuvertConnu?.debut ?? null;
  for (const entree of entrees) {
    if (entree.geste.type !== "compteur") {
      continue;
    }
    if (entree.geste.action === "demarrer") {
      debut = entree.instantAppareil;
    } else if (debut !== null) {
      minutes += Math.floor(
        (new Date(entree.instantAppareil).getTime() -
          new Date(debut).getTime()) /
          60_000,
      );
      debut = null;
    }
  }
  return { minutes, segmentOuvert: debut !== null };
}

/**
 * LE POINT DU POINTEUR, À L'ÉCHELLE DE LA RÉSOLUTION DU CANEVAS (point 5,
 * 9G5-TERRAIN-ERGONOMIE) — le canevas de signature est désormais FLUIDE
 * (largeur CSS = largeur disponible), mais sa résolution de dessin
 * (`width`/`height` posés sur `<canvas>`) reste fixe. Sous 320 px de large
 * (un téléphone étroit), la taille AFFICHÉE (`rectangle.width`) est plus
 * petite que la résolution interne : un point relevé sans cette échelle
 * atterrit plus près du bord que le doigt qui l'a posé — le tracé dérive du
 * pointeur au lieu de le suivre.
 */
export function positionCanevas(
  point: { readonly clientX: number; readonly clientY: number },
  rectangle: {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  },
  resolution: { readonly width: number; readonly height: number },
): { readonly x: number; readonly y: number } {
  return {
    x: ((point.clientX - rectangle.left) * resolution.width) / rectangle.width,
    y: ((point.clientY - rectangle.top) * resolution.height) / rectangle.height,
  };
}

/**
 * L'ÉPAISSEUR DU TRAIT DE SIGNATURE, EN PIXELS CSS (point 1,
 * 9I2-SIGNATURE-TRAIT-ET-COLONNE-MOIS) — même chiffre quel que soit le
 * `devicePixelRatio` : voir `preparerTraitSignature`, qui la multiplie par
 * l'échelle de la résolution interne.
 */
const LARGEUR_TRAIT_SIGNATURE_CSS_PX = 2;

/**
 * POSE L'ÉPAISSEUR DU TRAIT AVANT CHAQUE DÉBUT DE TRACÉ, JAMAIS UNE SEULE
 * FOIS AU MONTAGE (point 1, 9I2-SIGNATURE-TRAIT-ET-COLONNE-MOIS) — le
 * `useLayoutEffect` ci-dessus pose `canvas.width`/`height` à la résolution
 * interne (taille affichée × `devicePixelRatio`), mais ni `ctx.scale` ni
 * `lineWidth` n'étaient jamais posés : le trait restait à 1 PIXEL PHYSIQUE,
 * soit ~0,33 px CSS sur un téléphone à DPR 3 — quasi invisible à l'écran ET
 * dans le PNG enregistré (`toDataURL`). `position()` convertit déjà le point
 * du pointeur à l'échelle de la résolution interne (`positionCanevas`
 * ci-dessus) : les coordonnées de tracé restent en pixels PHYSIQUES, donc
 * `lineWidth` doit l'être aussi — `ctx.scale` aurait fait doublon et dérivé
 * le tracé de ce que le doigt pose. Recalculée à chaque début de trait, pas
 * une fois pour toutes : redimensionner un canevas (`canvas.width = …`)
 * réinitialise `lineWidth` à sa valeur par défaut avec lui.
 */
function preparerTraitSignature(
  contexte: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
): void {
  const rectangle = canvas.getBoundingClientRect();
  const echelle = rectangle.width === 0 ? 1 : canvas.width / rectangle.width;
  contexte.lineWidth = LARGEUR_TRAIT_SIGNATURE_CSS_PX * echelle;
  contexte.lineCap = "round";
  contexte.lineJoin = "round";
}

/**
 * UNE FONCTION, JAMAIS UN `const` AU TEXTE CALCULÉ PAR TERNAIRE — le gardien
 * L0-11 (`constantesLitterales`, `tests/unit/outils/rendu-visible.ts`) résout
 * la valeur d'un `const` affecté par ternaire avec un contexte VIDE, pour
 * éviter une dépendance circulaire ; un appel `t("...")` niché dans cette
 * ternaire n'y est alors plus reconnu comme un accès au dictionnaire, et la
 * CLÉ elle-même est signalée comme une chaîne écrite en dur. Une fonction
 * n'est pas une `VariableDeclaration` à littéraux : ce piège ne s'applique
 * pas à elle.
 */
function texteIndicatif(
  etat: Etat,
  texteReussite: string,
  texteEchec: string,
): string {
  if (etat === "enregistre") {
    return texteReussite;
  }
  if (etat === "hors_ligne") {
    return t("terrain.auto.hors_ligne");
  }
  if (etat === "echec") {
    return texteEchec;
  }
  if (etat === "echec_gardee") {
    return t("terrain.file.echec_gardee");
  }
  return t("terrain.auto.enregistrement");
}

function classeIndicatif(etat: Etat): string {
  if (etat === "enregistre") {
    return "text-app-vert-encre";
  }
  if (etat === "echec" || etat === "echec_gardee") {
    return "text-app-rouge-encre";
  }
  return "text-app-encre-faible";
}

function Indicateur({
  etat,
  texteReussite,
  texteEchec,
}: {
  readonly etat: Etat;
  readonly texteReussite: string;
  /**
   * LE MESSAGE D'ÉCHEC, PROPRE À CHAQUE BLOC (9G1-CORRECTIFS-AUDIT-URGENTS,
   * point 3) — `texteIndicatif` disait toujours « Le rapport n'a pas pu être
   * enregistré », même pour un échec de PRESTATIONS ou de SIGNATURE : un
   * message faux, qui orientait le technicien vers le mauvais bloc. Chaque
   * appelant passe sa propre clé (`terrain.rapport.refus`,
   * `.prestations.refus`, `.signature.refus`).
   */
  readonly texteEchec: string;
}) {
  if (etat === "repos") {
    return null;
  }
  return (
    <p role="status" className={`text-16 font-bold ${classeIndicatif(etat)}`}>
      {texteIndicatif(etat, texteReussite, texteEchec)}
    </p>
  );
}

export function RapportTerrainAutomatique({
  interventionId,
  utilisateurId,
  societeId,
  statut,
  minutesConnues,
  segmentOuvertConnu,
  rapportInitial,
  prestations,
  prestationsInitiales,
  afficherPieces,
  piecesInitiales,
  conditionsFacturation,
  dejaSignee,
  afficherTerminer,
  verdictTerminerRefuseCle,
  sectionPhotos,
  catalogueIndisponibleHorsReseau = false,
  sansSession = false,
}: {
  readonly interventionId: string;
  readonly utilisateurId: string;
  readonly societeId: string;
  /** Le statut SERVEUR au moment du rendu — lu par `peutTerminer` local (point 4, C5). */
  readonly statut: StatutIntervention;
  /** Les minutes déjà mesurées côté serveur (segments fermés connus), hors file (point 4, C5). */
  readonly minutesConnues: number;
  /**
   * LE SEGMENT ENCORE OUVERT, CONNU DU SERVEUR AU MOMENT DU RENDU (point 3,
   * 9F4H3AC) — `mesure.ouvert` tel que `mesurer` (`lib/interventions/
   * compteur.ts`) le rend déjà, `null` si aucun segment ne tourne. Un
   * compteur démarré EN LIGNE (donc absent de la file) ne doit pas sembler
   * « sans segment ouvert » au verdict local de « Terminer » hors réseau :
   * voir `mesureCompteurDeLaFile`.
   */
  readonly segmentOuvertConnu: { readonly debut: string } | null;
  readonly rapportInitial: {
    readonly commentaire_technicien: string | null;
    readonly suite_a_donner: string | null;
  };
  readonly prestations: readonly PrestationOption[];
  readonly prestationsInitiales: readonly string[];
  /**
   * LA SECTION « PIÈCES REMPLACÉES » EST-ELLE CONCERNÉE ? (9I7B, décision
   * d'Alexis du 29/10/2026) — curatif, garantie, reprise seulement ; décidé
   * par l'appelant (`aSectionPiecesRemplacees`), jamais recalculé ici.
   */
  readonly afficherPieces: boolean;
  readonly piecesInitiales: readonly PieceRemplaceeInitiale[];
  /**
   * LES CONDITIONS DE FACTURATION, SANS AUCUN MONTANT (9I8B-CONDITIONS-DE-
   * FACTURATION-SANS-MONTANT) — des lignes de texte déjà composées côté
   * serveur (`lib/tarification/conditions.ts`), affichées AVANT la zone de
   * signature : *« les conditions de facturation doivent être affichées
   * lorsque le client signe »* (Alexis, 29/10/2026), jamais un chiffre.
   */
  readonly conditionsFacturation: readonly string[];
  readonly dejaSignee: boolean;
  readonly afficherTerminer: boolean;
  /**
   * LE REFUS SERVEUR DE « TERMINER » (9F4H3-HORS-RESEAU-ENVOYER) — `null` si
   * permis. Rendu ICI, jamais par la page : un « démarrer » mis en file
   * APRÈS ce rendu (donc inconnu du serveur) doit pouvoir faire TAIRE ce
   * refus sans jamais redemander `peutTerminer` au serveur — seul ce
   * composant connaît `enCoursLocalement`.
   */
  readonly verdictTerminerRefuseCle: string | null;
  readonly sectionPhotos: ReactNode;
  /**
   * LE CATALOGUE N'A JAMAIS ÉTÉ EMPORTÉ HORS RÉSEAU (9F4H4B-OUVERTURE-A-FROID,
   * point 2) — `prestations` vide signifie alors deux choses DIFFÉRENTES :
   * la société n'a AUCUNE prestation dans son catalogue (`terrain.prestations.
   * aucune`, le cas d'avant ce ticket), ou le catalogue existe mais n'a jamais
   * été envoyé par `/api/terrain/instantane` (hors territoire de ce lot —
   * voir sa passation). Confondre les deux dirait « rien à cocher » quand la
   * vraie réponse est « pas encore su ». `false` par défaut : rien ne change
   * pour la fiche EN LIGNE.
   */
  readonly catalogueIndisponibleHorsReseau?: boolean;
  /** LA COQUILLE `/terrain-hors-reseau` (9F4H4D, point 2) — voir le docblock
   * du même nom dans `compteur-terrain.tsx` et celui d'`envoyerJson`
   * ci-dessus : aucune session n'y existe jamais, et un refus `"auth.refus"`
   * y est donc traité comme une coupure réseau, jamais affiché. */
  readonly sansSession?: boolean;
}) {
  const router = useRouter();

  const [commentaire, setCommentaire] = useState(
    rapportInitial.commentaire_technicien ?? "",
  );
  const [suite, setSuite] = useState(rapportInitial.suite_a_donner ?? "");
  const [prestationsChoisies, setPrestationsChoisies] = useState<
    ReadonlySet<string>
  >(new Set(prestationsInitiales));
  const [pieces, setPieces] = useState<readonly LignePiece[]>(() =>
    piecesDepuisInitiales(piecesInitiales),
  );
  const [issueSignature, setIssueSignature] = useState<IssueSignature | null>(
    null,
  );
  const [nomSignataire, setNomSignataire] = useState("");
  const [qualiteSignataire, setQualiteSignataire] = useState("");
  const [motifSignature, setMotifSignature] = useState("");
  const [aTrace, setATrace] = useState(false);

  const [etatRapport, setEtatRapport] = useState<Etat>("repos");
  const [etatPrestations, setEtatPrestations] = useState<Etat>("repos");
  const [etatSignature, setEtatSignature] = useState<Etat>("repos");
  const [enEnvoiTerminer, setEnEnvoiTerminer] = useState(false);
  const [messageTerminer, setMessageTerminer] = useState<string | null>(null);
  // « TERMINER » MIS EN FILE HORS RÉSEAU (9F4H3-HORS-RESEAU-ENVOYER, point 1,
  // décision n° 108) — cette fiche a déjà envoyé « terminer » à la file ;
  // l'écran le dit à la place du bouton tant que « Envoyer » n'a pas réussi.
  const [termineLocalement, setTermineLocalement] = useState(false);
  // UN « DÉMARRER » MIS EN FILE HORS RÉSEAU, SANS QUE LE SERVEUR LE SACHE
  // ENCORE (point 1) — `afficherTerminer` est la vérité SERVEUR au moment du
  // RENDU de cette page ; si le compteur a été démarré hors réseau DEPUIS,
  // la section « Terminer » doit apparaître quand même, sinon « démarrer
  // puis terminer, tout hors réseau » (le parcours même que décrit le point
  // 4) resterait impossible : rien ne redemande `afficherTerminer` au
  // serveur avant le retour du réseau.
  const [enCoursLocalement, setEnCoursLocalement] = useState(false);
  // LA CONFIRMATION DE « TERMINER », AVEC SON RÉSUMÉ (D219, décision
  // d'Alexis du 21/10/2026) — même patron inline que `LigneRefus`
  // (`bouton-envoyer.tsx`) plutôt qu'un `<dialog>` modal : un geste d'écran
  // de plus, jamais un second aller-retour réseau.
  const [confirmationTerminerOuverte, setConfirmationTerminerOuverte] =
    useState(false);

  // JAMAIS DE RAFRAÎCHISSEMENT AUTOMATIQUE PENDANT UNE SAISIE DU RAPPORT
  // (point 2, 9F4H5-TERRAIN-VIVANT) — « attente » est le debounce qui
  // n'a pas encore tiré (l'utilisateur tape encore), « envoi » la requête en
  // vol : les deux comptent comme une activité en cours pour
  // `RafraichissementAutomatique`, qui lit ce jeton avant de rafraîchir.
  useEffect(() => {
    const jeton = `rapport-${interventionId}`;
    const enCours =
      etatRapport === "attente" ||
      etatRapport === "envoi" ||
      etatPrestations === "attente" ||
      etatPrestations === "envoi" ||
      etatSignature === "attente" ||
      etatSignature === "envoi" ||
      enEnvoiTerminer;
    if (enCours) {
      demarrerActiviteTerrain(jeton);
    } else {
      terminerActiviteTerrain(jeton);
    }
    return () => terminerActiviteTerrain(jeton);
  }, [
    interventionId,
    etatRapport,
    etatPrestations,
    etatSignature,
    enEnvoiTerminer,
  ]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const traceEnCoursRef = useRef(false);
  const minuteurRapportRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // LA RÉSOLUTION DE DESSIN SUIT LA TAILLE RÉELLEMENT AFFICHÉE (point 1,
  // 9H4-FINITIONS-AVANT-AUDIT) — au-delà de 320 px affichés (tablette), une
  // résolution interne fixe de 320×140 est étirée par le CSS : le trait
  // s'épaissit horizontalement et le PNG enregistré (`toDataURL`, 320×140)
  // ne ressemble plus à ce que le signataire a vu. Mesurée au moment où le
  // canevas apparaît, AVANT LA PEINTURE (`useLayoutEffect`, jamais
  // `useEffect`, pour ne jamais peindre la résolution fixe un instant).
  useLayoutEffect(() => {
    if (issueSignature !== "signee") {
      return;
    }
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    const rectangle = canvas.getBoundingClientRect();
    const echelle = window.devicePixelRatio || 1;
    const largeur = Math.max(1, Math.round(rectangle.width * echelle));
    const hauteur = Math.max(1, Math.round(rectangle.height * echelle));
    if (canvas.width !== largeur || canvas.height !== hauteur) {
      canvas.width = largeur;
      canvas.height = hauteur;
    }
  }, [issueSignature]);

  // VALEURS COURANTES, LUES PAR LES ENVOIS — jamais une fermeture périmée
  // d'un rendu antérieur (le minuteur du rapport ou l'écoute « online »
  // capturent ce composant une seule fois ; ces refs, elles, restent à jour).
  const commentaireRef = useRef(commentaire);
  const suiteRef = useRef(suite);
  const prestationsRef = useRef(prestationsChoisies);
  const piecesRef = useRef(pieces);
  const issueSignatureRef = useRef(issueSignature);
  const nomSignatureRef = useRef(nomSignataire);
  const qualiteSignatureRef = useRef(qualiteSignataire);
  const motifSignatureRef = useRef(motifSignature);
  const imageSignatureRef = useRef<string | null>(null);

  const derniereRapportEnvoyeeRef = useRef<{
    readonly commentaire: string;
    readonly suite: string;
    readonly pieces: readonly PieceEnvoi[] | undefined;
  }>({
    commentaire: rapportInitial.commentaire_technicien ?? "",
    suite: rapportInitial.suite_a_donner ?? "",
    // SECTION ABSENTE → `undefined`, JAMAIS `[]` (9I7B3, correctif de revue) —
    // voir `envoyerRapport` ci-dessous, même règle.
    pieces: afficherPieces
      ? piecesInitiales.map((p) => ({
          designation: p.designation,
          reference: p.reference,
          quantite: p.quantite,
        }))
      : undefined,
  });
  const dernierePrestationsEnvoyeesRef = useRef<ReadonlySet<string>>(
    new Set(prestationsInitiales),
  );
  /**
   * LES DERNIERS PROPS SERVEUR INCORPORÉS À L'ÉCRAN — JAMAIS TOUCHÉ PAR UN
   * ENVOI (point 2, 9F4H6E-PRESTATIONS-DIFFERENCE-EN-LIGNE) — sert UNIQUEMENT
   * de référence pour la fusion ci-dessous (`ajouteesLocalement`/
   * `retireesLocalement`), à la différence de `dernierePrestationsEnvoyeesRef`
   * qui avance AUSSI sur chaque envoi accepté. Sans cette séparation, un
   * retrait accepté EN LIGNE avançait `dernierePrestationsEnvoyeesRef` AVANT
   * qu'une relecture des props, déclenchée plus tôt mais résolue plus tard
   * (une relecture PÉRIMÉE), ne puisse comparer son ancien/nouveau contenu :
   * la prestation retirée, absente de l'ancienne base ELLE-MÊME DÉJÀ
   * AVANCÉE, ne ressortait plus comme un retrait local à réappliquer, et la
   * relecture périmée la RECOCHAIT. Cette référence-ci n'avance QUE quand la
   * fusion elle-même tourne : la comparaison reste juste quel que soit
   * l'ordre d'arrivée des réponses.
   */
  const derniersPropsPrestationsRef = useRef<ReadonlySet<string>>(
    new Set(prestationsInitiales),
  );
  /**
   * LE JOURNAL DES DIFFÉRENCES ACCEPTÉES DEPUIS LA DERNIÈRE LECTURE DES
   * PROPS (point 3, 9F4H6F-PRESTATIONS-ANCIEN-CLIENT) — une relecture des
   * props serveur (`router.refresh()`) peut se RÉSOUDRE après qu'un envoi
   * EN LIGNE de cette même fiche a déjà été accepté, tout en ayant été
   * LANCÉE avant lui (promesses résolues dans le désordre). L'effet qui
   * incorpore `prestationsInitiales` (plus bas) écrivait alors
   * `dernierePrestationsEnvoyeesRef` avec les props BRUTES, périmées :
   * l'acceptation la plus récente disparaissait de la base qui sert à
   * calculer les PROCHAINS envois, qui ne renvoyait alors plus jamais le
   * retrait si le technicien décochait ensuite cette même prestation (revue
   * du pilote sur `12853696`). Chaque entrée est purgée dès que les props
   * la reflètent déjà — un journal qui grandirait sans fin ne protégerait
   * plus rien.
   */
  const journalDiffsAccepteesRef = useRef<DiffAcceptee[]>([]);
  const derniereSignatureEnvoyeeRef = useRef<string | null>(null);

  function retenirDiffAcceptee(
    ajouterIds: readonly string[],
    retirerIds: readonly string[],
  ): void {
    if (ajouterIds.length === 0 && retirerIds.length === 0) {
      return;
    }
    journalDiffsAccepteesRef.current = [
      ...journalDiffsAccepteesRef.current,
      { ajouterIds, retirerIds },
    ];
  }

  function ecrireBrouillonCourant(): void {
    const signature: SignatureBrouillon | null =
      issueSignatureRef.current === "signee"
        ? imageSignatureRef.current === null
          ? null
          : {
              issue: "signee",
              nom: nomSignatureRef.current,
              qualite: qualiteSignatureRef.current,
              image: imageSignatureRef.current,
            }
        : issueSignatureRef.current === "client_absent" ||
            issueSignatureRef.current === "refus_signature"
          ? {
              issue: issueSignatureRef.current,
              motif: motifSignatureRef.current,
            }
          : null;
    const brouillon: Brouillon = {
      commentaire: commentaireRef.current,
      suite: suiteRef.current,
      prestationIds: [...prestationsRef.current],
      prestationsBase: [...dernierePrestationsEnvoyeesRef.current],
      signature,
      pieces: piecesRef.current,
    };
    try {
      window.localStorage.setItem(
        cleBrouillon(interventionId),
        JSON.stringify(brouillon),
      );
    } catch {
      // voir `effacerBrouillon` — le brouillon local n'est qu'un filet.
    }
  }

  async function envoyerRapport(): Promise<VerdictBloc> {
    if (minuteurRapportRef.current !== null) {
      clearTimeout(minuteurRapportRef.current);
      minuteurRapportRef.current = null;
    }
    const valeurs = {
      commentaire: commentaireRef.current,
      suite: suiteRef.current,
      // SECTION ABSENTE (type sans curatif/garantie/reprise) → `undefined`,
      // JAMAIS `[]` (9I7B3, correctif de revue) — un `[]` envoyé pour un type
      // qui ne porte pas la section est lu par le serveur comme des pièces
      // PRÉSENTES (même vides) et faisait refuser tout le rapport en bloc.
      pieces: afficherPieces ? piecesPourEnvoi(piecesRef.current) : undefined,
    };
    if (
      derniereRapportEnvoyeeRef.current.commentaire === valeurs.commentaire &&
      derniereRapportEnvoyeeRef.current.suite === valeurs.suite &&
      JSON.stringify(derniereRapportEnvoyeeRef.current.pieces) ===
        JSON.stringify(valeurs.pieces)
    ) {
      return { etat: "accepte" };
    }
    setEtatRapport("envoi");
    const corps = new FormData();
    corps.set("commentaire_technicien", valeurs.commentaire);
    corps.set("suite_a_donner", valeurs.suite);
    // LE REMPLACEMENT INTÉGRAL (9I7B) — voyage dans LA MÊME requête que le
    // commentaire et la suite, jamais une route séparée. Absent du corps
    // quand la section n'est pas affichée (9I7B3) : voir le commentaire sur
    // `valeurs.pieces` ci-dessus.
    if (valeurs.pieces !== undefined) {
      corps.set("pieces_remplacees", JSON.stringify(valeurs.pieces));
    }
    // RELEVÉ AVANT L'ENVOI, JAMAIS APRÈS LA RÉPONSE (point 2, 9F4H3AC) — voir
    // `retirerSaisieCoalescable`.
    const pasApresInstant = instantAvantEnvoi();
    const resultat = await envoyerJson(
      `/api/terrain/${interventionId}/rapport`,
      corps,
      sansSession,
    );
    if (resultat === null) {
      const gardee = await ajouterSaisie({
        interventionId,
        utilisateurId,
        societeId,
        geste: { type: "rapport", ...valeurs },
      });
      if (!gardee.gardee) {
        setEtatRapport("echec_gardee");
        return { etat: "echec", motifCle: "terrain.file.echec_gardee" };
      }
      setEtatRapport("hors_ligne");
      return { etat: "hors_ligne" };
    }
    if (resultat.ok) {
      derniereRapportEnvoyeeRef.current = valeurs;
      setEtatRapport("enregistre");
      // LA DERNIÈRE VALEUR GAGNE (point 1, C1) — un rapport resté en file
      // depuis une coupure antérieure est PÉRIMÉ dès que celui-ci, plus
      // récent, vient d'être accepté : sans ce retrait, « Envoyer » le
      // renverrait par-dessus et écraserait ce qui vient d'être enregistré.
      await retirerSaisieCoalescable({
        interventionId,
        utilisateurId,
        societeId,
        type: "rapport",
        pasApresInstant,
      });
      return { etat: "accepte" };
    }
    setEtatRapport("echec");
    return { etat: "echec", motifCle: resultat.motif };
  }

  function demarrerMinuteurRapport(): void {
    if (minuteurRapportRef.current !== null) {
      clearTimeout(minuteurRapportRef.current);
    }
    setEtatRapport("attente");
    minuteurRapportRef.current = setTimeout(() => {
      void envoyerRapport();
    }, 1500);
  }

  async function envoyerPrestations(): Promise<VerdictBloc> {
    const voulues = prestationsRef.current;
    const surLaBaseConnue = memeEnsemble(
      dernierePrestationsEnvoyeesRef.current,
      voulues,
    );
    const enAttente = (
      await listerFilePourIntervention(interventionId, {
        utilisateurId,
        societeId,
      })
    ).find((e) => e.geste.type === "prestations");
    // UN AJOUT **OU UN RETRAIT** EN FILE A PU PARTIR MALGRÉ UN ÉCHEC
    // APPARENT — réponse perdue après un POST qui avait pourtant atteint le
    // serveur (9F4H6C-FILE-ROBUSTESSE, point 1 ; généralisé au retrait par
    // 9F4H6D-PRESTATIONS-SANS-PERTE, point 3). Avant ce point 3, seul
    // `ajouterIds.length > 0` comptait : décocher D hors réseau (file
    // `{retirer:[D]}`), puis le recocher UNE FOIS LA RÉPONSE DU RETRAIT
    // elle-même perdue (le retrait a pourtant atteint le serveur) ramenait
    // l'écran à la base connue ({D}) — `surLaBaseConnue` redevenait vrai,
    // mais l'entrée, de pur retrait, ne remplissait pas la condition ; elle
    // était jetée EN SILENCE, et D restait absente du serveur. Tant que ce
    // doute existe (ajout OU retrait), revenir à la base connue n'autorise
    // JAMAIS à jeter l'entrée en silence.
    const gestePeutEtrePartie =
      surLaBaseConnue &&
      enAttente !== undefined &&
      enAttente.geste.type === "prestations" &&
      (enAttente.geste.ajouterIds.length > 0 ||
        enAttente.geste.retirerIds.length > 0);
    if (surLaBaseConnue && !gestePeutEtrePartie) {
      // REVENU À LA BASE CONNUE (point 3, 9F4H6B-FILE-ANCIEN-FORMAT) — cocher
      // C puis décocher C hors réseau laisse une entrée `{ajouter:[C]}` dans
      // la file (voir `basculerPrestation` → ce même appel, après le premier
      // coche) ; sans ce retrait, elle n'a plus aucune raison d'exister
      // (voulues === dernière base connue, donc différence vide) mais serait
      // tout de même rejouée au prochain « Envoyer » — un ajout jamais
      // demandé par le technicien, qui l'a décoché avant de repartir. Sans
      // conséquence si rien n'y est : `retirerSaisieCoalescable` ne retire
      // alors rien.
      await retirerSaisieCoalescable({
        interventionId,
        utilisateurId,
        societeId,
        type: "prestations",
      });
      return { etat: "accepte" };
    }
    setEtatPrestations("envoi");
    // LA DIFFÉRENCE AVEC LA BASE CONNUE, JAMAIS L'ENSEMBLE — MÊME EN LIGNE
    // (D143, décision d'Alexis du 22/10/2026 ; 9F4H6E-PRESTATIONS-
    // DIFFERENCE-EN-LIGNE) — avant ce ticket, cette branche envoyait
    // `voulues` tout entier (`prestation_id` répété), que la route faisait
    // alors correspondre à l'existant en effaçant tout le reste
    // (`definirPrestationsRealisees`) : une prestation cochée par le BUREAU
    // pendant que la fiche était ouverte, absente de `voulues` parce que cet
    // écran ne la connaît pas encore, disparaissait au premier geste du
    // technicien. Le même chemin serveur que le rejeu depuis la file
    // (`definirPrestationsRealiseesDepuisFile`) élimine ce risque : seule la
    // DIFFÉRENCE voyage, jamais ce qu'un autre appareil a ajouté.
    const diff = differencePrestations(
      dernierePrestationsEnvoyeesRef.current,
      voulues,
    );
    const corps = new FormData();
    for (const id of diff.ajouterIds) {
      corps.append("ajouter_id", id);
    }
    for (const id of diff.retirerIds) {
      corps.append("retirer_id", id);
    }
    // Voir `envoyerRapport` — même repère, même raison (point 2, 9F4H3AC).
    const pasApresInstant = instantAvantEnvoi();
    const resultat = await envoyerJson(
      `/api/terrain/${interventionId}/prestations`,
      corps,
      sansSession,
    );
    if (resultat === null) {
      // SI LA BASE N'A PAS BOUGÉ, LA DIFFÉRENCE NORMALE EST VIDE — ICI,
      // C'EST SON INVERSE QU'IL FAUT GARDER EN FILE (point 1 ci-dessus) :
      // elle annule l'ajout qui a PEUT-ÊTRE déjà atteint le serveur, et ne
      // coûte rien s'il n'a jamais abouti (« un retrait d'une prestation
      // absente est sans effet », `definirPrestationsRealiseesDepuisFile`).
      // Sinon, LA DIFFÉRENCE DÉJÀ CALCULÉE CI-DESSUS POUR L'ENVOI, JAMAIS
      // L'ENSEMBLE (point 2, 9F4H6A-COQUILLE-ANCIENNE-COPIE) — voir le
      // docblock de `differencePrestations` : l'ensemble résultant
      // effacerait au rejeu une prestation ajoutée ENTRE-TEMPS par
      // quelqu'un d'autre.
      const diffAGarder =
        gestePeutEtrePartie &&
        enAttente !== undefined &&
        enAttente.geste.type === "prestations"
          ? {
              ajouterIds: enAttente.geste.retirerIds,
              retirerIds: enAttente.geste.ajouterIds,
            }
          : diff;
      const gardee = await ajouterSaisie({
        interventionId,
        utilisateurId,
        societeId,
        geste: { type: "prestations", ...diffAGarder },
      });
      if (!gardee.gardee) {
        setEtatPrestations("echec_gardee");
        return { etat: "echec", motifCle: "terrain.file.echec_gardee" };
      }
      setEtatPrestations("hors_ligne");
      return { etat: "hors_ligne" };
    }
    if (resultat.ok) {
      // LA BASE AVANCE DE LA DIFFÉRENCE ENVOYÉE, JAMAIS DE `voulues` (point
      // 2, 9F4H6E-PRESTATIONS-DIFFERENCE-EN-LIGNE) — `voulues` est un
      // instantané pris AVANT cet envoi ; une fusion arrivée PENDANT
      // l'envoi (l'effet sur `prestationsInitiales` plus bas) peut avoir
      // avancé `dernierePrestationsEnvoyeesRef` entre-temps (ajout du
      // bureau) — l'écraser avec `voulues`, périmé, effacerait cet ajout de
      // la base qui sert à calculer les DIFFS FUTURS, qui oublierait alors
      // d'envoyer un retrait le concernant si le technicien le décochait.
      const suivante = new Set(dernierePrestationsEnvoyeesRef.current);
      for (const id of diff.ajouterIds) {
        suivante.add(id);
      }
      for (const id of diff.retirerIds) {
        suivante.delete(id);
      }
      dernierePrestationsEnvoyeesRef.current = suivante;
      // AU JOURNAL, POUR SURVIVRE À UNE RELECTURE DE PROPS PÉRIMÉE (point 3,
      // 9F4H6F-PRESTATIONS-ANCIEN-CLIENT) — voir le docblock de
      // `journalDiffsAccepteesRef`.
      retenirDiffAcceptee(diff.ajouterIds, diff.retirerIds);
      // LE BROUILLON SUIT L'ENVOI ACCEPTÉ (point 4, 9F4H6F-PRESTATIONS-
      // ANCIEN-CLIENT) — sans cette réécriture, `prestationsBase` du
      // brouillon restait celle d'AVANT cet envoi ; au remontage suivant,
      // `fusionnerBrouillonPrestations` rejouait alors une différence déjà
      // acceptée par le serveur, et `flushTout` la renvoyait — un retrait
      // ou un ajout refait à tort si le bureau avait changé la même
      // prestation entre-temps.
      ecrireBrouillonCourant();
      setEtatPrestations("enregistre");
      // Voir `envoyerRapport` — même retrait, même raison (point 1, C1).
      await retirerSaisieCoalescable({
        interventionId,
        utilisateurId,
        societeId,
        type: "prestations",
        pasApresInstant,
      });
      return { etat: "accepte" };
    }
    setEtatPrestations("echec");
    return { etat: "echec", motifCle: resultat.motif };
  }

  async function tenterEnvoiSignature(): Promise<VerdictBloc> {
    const issue = issueSignatureRef.current;
    if (issue === null) {
      return { etat: "accepte" };
    }
    let champs: Record<string, string> | null = null;
    if (issue === "signee") {
      const image = imageSignatureRef.current;
      const nom = nomSignatureRef.current.trim();
      if (image === null || nom.length === 0) {
        return { etat: "accepte" };
      }
      champs = {
        issue,
        image_base64: image,
        signataire_nom: nom,
        signataire_qualite: qualiteSignatureRef.current.trim(),
      };
    } else {
      const motif = motifSignatureRef.current.trim();
      if (motif.length === 0) {
        return { etat: "accepte" };
      }
      champs = { issue, motif };
    }
    const signature = JSON.stringify(champs);
    if (derniereSignatureEnvoyeeRef.current === signature) {
      return { etat: "accepte" };
    }
    setEtatSignature("envoi");
    // UN IDENTIFIANT DÈS LE PREMIER ESSAI (point 3, C7) — fabriqué AVANT cet
    // envoi, jamais après son échec : en « lie-fi » (la requête aboutit,
    // mais la réponse se perd), le serveur a déjà écrit la signature sous CET
    // `operation_id` ; un renvoi par la file qui en fabriquerait un second
    // ne la reconnaîtrait pas comme le MÊME geste.
    const operation = nouvelleOperation();
    const donnees = new FormData();
    for (const [cle, valeur] of Object.entries(champs)) {
      donnees.set(cle, valeur);
    }
    donnees.set("operation_id", operation.id);
    const resultat = await envoyerJson(
      `/api/terrain/${interventionId}/signature`,
      donnees,
      sansSession,
    );
    if (resultat === null) {
      const gardee = await ajouterSaisie({
        interventionId,
        utilisateurId,
        societeId,
        geste: { type: "signature", champs },
        id: operation.id,
        instantAppareil: operation.instantAppareil,
      });
      if (!gardee.gardee) {
        setEtatSignature("echec_gardee");
        return { etat: "echec", motifCle: "terrain.file.echec_gardee" };
      }
      setEtatSignature("hors_ligne");
      return { etat: "hors_ligne" };
    }
    if (resultat.ok) {
      derniereSignatureEnvoyeeRef.current = signature;
      setEtatSignature("enregistre");
      // Voir `envoyerRapport` — même retrait, même raison (point 1, C1).
      // `operation.instantAppareil`, déjà relevé AVANT cet envoi (point 3,
      // C7 ci-dessus), sert aussi de repère pour le retrait (point 2,
      // 9F4H3AC) — un second repère pris ici, après la réponse, referait
      // l'erreur que ce correctif corrige.
      await retirerSaisieCoalescable({
        interventionId,
        utilisateurId,
        societeId,
        type: "signature",
        pasApresInstant: operation.instantAppareil,
      });
      return { etat: "accepte" };
    }
    setEtatSignature("echec");
    return { etat: "echec", motifCle: resultat.motif };
  }

  /**
   * TOUT ENVOYER, ET RENDRE LE VERDICT DE CHAQUE BLOC (point 1,
   * 9F4A-TERMINER-SANS-PERTE) — `onClickTerminer` ne peut décider d'appeler
   * `/terminer` qu'en connaissant l'issue exacte des trois blocs, jamais sur
   * la seule foi que l'attente s'est terminée sans lever d'exception.
   */
  async function flushTout(): Promise<{
    readonly rapport: VerdictBloc;
    readonly prestations: VerdictBloc;
    readonly signature: VerdictBloc;
  }> {
    const rapport = await envoyerRapport();
    const prestations = await envoyerPrestations();
    const signature = await tenterEnvoiSignature();
    return { rapport, prestations, signature };
  }

  // LE BROUILLON LOCAL, REPRIS AU MONTAGE — voir l'en-tête du fichier.
  useEffect(() => {
    const brouillon = lireBrouillon(interventionId);
    if (brouillon === null) {
      return;
    }
    commentaireRef.current = brouillon.commentaire;
    setCommentaire(brouillon.commentaire);
    suiteRef.current = brouillon.suite;
    setSuite(brouillon.suite);
    const piecesDuBrouillon = brouillon.pieces ?? [];
    piecesRef.current = piecesDuBrouillon;
    setPieces(piecesDuBrouillon);
    // LA PROPRE DIFFÉRENCE DU BROUILLON, REJOUÉE SUR LA BASE FRAÎCHE (point
    // 3, 9F4H6E-PRESTATIONS-DIFFERENCE-EN-LIGNE) — jamais `prestationIds`
    // tel quel, qui effacerait un ajout du bureau fait pendant l'absence
    // (D143). Voir `fusionnerBrouillonPrestations`.
    const fusion = fusionnerBrouillonPrestations(
      brouillon,
      prestationsInitiales,
    );
    prestationsRef.current = fusion;
    setPrestationsChoisies(fusion);
    dernierePrestationsEnvoyeesRef.current = new Set(prestationsInitiales);
    derniersPropsPrestationsRef.current = new Set(prestationsInitiales);
    if (brouillon.signature !== null) {
      issueSignatureRef.current = brouillon.signature.issue;
      setIssueSignature(brouillon.signature.issue);
      if (brouillon.signature.issue === "signee") {
        nomSignatureRef.current = brouillon.signature.nom;
        setNomSignataire(brouillon.signature.nom);
        qualiteSignatureRef.current = brouillon.signature.qualite;
        setQualiteSignataire(brouillon.signature.qualite);
        imageSignatureRef.current = brouillon.signature.image;
        setATrace(true);
      } else {
        motifSignatureRef.current = brouillon.signature.motif;
        setMotifSignature(brouillon.signature.motif);
      }
    }
    void flushTout();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois au montage, par intervention
  }, [interventionId]);

  // UN « TERMINER » DÉJÀ MIS EN FILE (9F4H3, point 1) — relu au montage ET
  // à chaque modification de la file : un « démarrer » mis en file par
  // `BoutonCompteurTerrain` (un AUTRE composant, voir l'en-tête de
  // `lib/terrain/file-saisies.ts`) doit faire apparaître la section
  // « Terminer » sans attendre un rechargement de la page.
  useEffect(() => {
    function relire(): void {
      void listerFilePourIntervention(interventionId, {
        utilisateurId,
        societeId,
      }).then((entrees) => {
        setTermineLocalement(entrees.some((e) => e.geste.type === "terminer"));
        // AU MOINS UN « DÉMARRER », ET PAS SEULEMENT LE DERNIER GESTE —
        // démarrer PASSE l'intervention en cours UNE FOIS ; la mettre en
        // pause ensuite ne l'en fait pas ressortir (même règle que
        // `arreterLeCompteur`, qui ne touche jamais `intervention.statut`).
        setEnCoursLocalement(
          entrees.some(
            (e) => e.geste.type === "compteur" && e.geste.action === "demarrer",
          ),
        );
      });
    }
    relire();
    window.addEventListener(EVENEMENT_FILE_MODIFIEE, relire);
    return () => window.removeEventListener(EVENEMENT_FILE_MODIFIEE, relire);
  }, [interventionId, utilisateurId, societeId]);

  // UN « DÉMARRER » RÉUSSI EN LIGNE (D220, décision d'Alexis du 21/10/2026,
  // défaut mesuré : la REPRISE d'une intervention « terminée » laissait
  // « Terminer » disparu/grisé jusqu'à un rechargement complet) —
  // `BoutonCompteurTerrain` ne met RIEN en file pour ce cas (la requête a
  // réussi), donc l'effet ci-dessus (qui ne relit que la file) ne le voit
  // jamais. Ce signal dédié couvre exactement ce trou, sans attendre que
  // `router.refresh()` fasse son aller-retour.
  useEffect(() => {
    function surCompteurDemarreEnLigne(evenement: Event): void {
      const detail = (evenement as CustomEvent<DetailCompteurDemarreEnLigne>)
        .detail;
      if (detail.interventionId !== interventionId) {
        return;
      }
      setEnCoursLocalement(true);
    }
    window.addEventListener(
      EVENEMENT_COMPTEUR_DEMARRE_EN_LIGNE,
      surCompteurDemarreEnLigne,
    );
    return () =>
      window.removeEventListener(
        EVENEMENT_COMPTEUR_DEMARRE_EN_LIGNE,
        surCompteurDemarreEnLigne,
      );
  }, [interventionId]);

  // LA « DERNIÈRE BASE CONNUE » SUIT L'ÉTAT RÉELLEMENT ENVOYÉ, PAS SEULEMENT
  // CE QUE CE COMPOSANT A LUI-MÊME ENVOYÉ EN LIGNE (9F4H6C-FILE-ROBUSTESSE,
  // point 1) — deux sources, toutes deux nécessaires : la file peut avoir
  // envoyé la différence pendant que cette fiche était fermée (depuis
  // « Ma journée »), et le serveur peut avoir changé pour une raison qui n'a
  // rien à voir avec CETTE fiche (back-office). Sans ce suivi, `voulues`
  // décoché après un envoi réussi par la file semblait égal à la base
  // connue PÉRIMÉE et ne renvoyait rien (voir l'en-tête d'`envoyerPrestations`).
  useEffect(() => {
    function surPrestationsEnvoyees(evenement: Event): void {
      const detail = (evenement as CustomEvent<DetailPrestationsEnvoyees>)
        .detail;
      if (detail.interventionId !== interventionId) {
        return;
      }
      const suivant = new Set(dernierePrestationsEnvoyeesRef.current);
      for (const id of detail.ajouterIds) {
        suivant.add(id);
      }
      for (const id of detail.retirerIds) {
        suivant.delete(id);
      }
      dernierePrestationsEnvoyeesRef.current = suivant;
      // Même journal que `envoyerPrestations` — voir son docblock
      // (point 3, 9F4H6F-PRESTATIONS-ANCIEN-CLIENT) : cette acceptation
      // vient de LA FILE, pas de cette fiche, mais l'effet de relecture des
      // props ci-dessous ne distingue pas les deux sources.
      retenirDiffAcceptee(detail.ajouterIds, detail.retirerIds);
    }
    window.addEventListener(
      EVENEMENT_PRESTATIONS_ENVOYEES,
      surPrestationsEnvoyees,
    );
    return () =>
      window.removeEventListener(
        EVENEMENT_PRESTATIONS_ENVOYEES,
        surPrestationsEnvoyees,
      );
  }, [interventionId]);

  // L'AUTRE SOURCE : LE RAFRAÎCHISSEMENT DES PROPS SERVEUR (même point) —
  // `router.refresh()` (`bouton-envoyer.tsx`) relit `prestationsInitiales`
  // depuis la base ; cette fiche, elle, n'est jamais remontée, donc jamais
  // réinitialisée par la ligne `useRef(new Set(prestationsInitiales))` plus
  // haut, qui ne joue qu'une fois.
  //
  // L'ÉCRAN AVANCE AVEC LA BASE CONNUE (9F4H6D-PRESTATIONS-SANS-PERTE,
  // point 2) — se contenter de réécrire `dernierePrestationsEnvoyeesRef`
  // (ce que faisait ce correctif avant point 2) avance la base SANS avancer
  // l'écran : un ajout du bureau (D), survenu PENDANT que cette fiche est
  // ouverte, redevenait alors invisible jusqu'au prochain montage — pire,
  // le prochain envoi calculait sa différence contre une base qui connaît D
  // alors que l'écran, lui, ne l'a jamais affiché, et un retrait non voulu
  // de D pouvait s'ensuivre (voir `envoyerPrestations`). Toute modification
  // locale encore EN FILE — ce que l'écran porte au-delà de l'ANCIENNE base
  // connue — est réappliquée PAR-DESSUS la NOUVELLE base, pour ne RIEN
  // perdre et ne RIEN rejouer à tort.
  useEffect(() => {
    const basePropsBrute = new Set(prestationsInitiales);
    // LE JOURNAL D'ABORD, SUR LES PROPS BRUTES (point 3, 9F4H6F-PRESTATIONS-
    // ANCIEN-CLIENT) — voir le docblock de `journalDiffsAccepteesRef` :
    // cette relecture peut être PLUS ANCIENNE qu'un envoi déjà accepté EN
    // LIGNE depuis cette fiche ou depuis la file ; rejouer par-dessus les
    // entrées non encore reflétées évite de les effacer de la base qui sert
    // au calcul des PROCHAINS envois. Une entrée déjà reflétée est purgée.
    const nouvelleBase = new Set(basePropsBrute);
    const journalRestant: DiffAcceptee[] = [];
    for (const diffAcceptee of journalDiffsAccepteesRef.current) {
      const dejaReflete =
        diffAcceptee.ajouterIds.every((id) => nouvelleBase.has(id)) &&
        diffAcceptee.retirerIds.every((id) => !nouvelleBase.has(id));
      if (dejaReflete) {
        continue;
      }
      for (const id of diffAcceptee.ajouterIds) {
        nouvelleBase.add(id);
      }
      for (const id of diffAcceptee.retirerIds) {
        nouvelleBase.delete(id);
      }
      journalRestant.push(diffAcceptee);
    }
    journalDiffsAccepteesRef.current = journalRestant;

    // `derniersPropsPrestationsRef`, JAMAIS `dernierePrestationsEnvoyeesRef`
    // (point 2, 9F4H6E-PRESTATIONS-DIFFERENCE-EN-LIGNE) — voir le docblock
    // de la ref ci-dessus : cette comparaison doit rester insensible à ce
    // qu'un envoi EN LIGNE a pu, entre-temps, déjà faire avancer. Comparée
    // aux props BRUTES, jamais à `nouvelleBase` corrigée par le journal :
    // ce que CE technicien a localement changé ne dépend pas de ce qu'un
    // autre canal a déjà fait accepter.
    const ancienneBase = derniersPropsPrestationsRef.current;
    const ajouteesLocalement = [...prestationsRef.current].filter(
      (id) => !ancienneBase.has(id),
    );
    const retireesLocalement = [...ancienneBase].filter(
      (id) => !prestationsRef.current.has(id),
    );
    const fusion = new Set(nouvelleBase);
    for (const id of ajouteesLocalement) {
      fusion.add(id);
    }
    for (const id of retireesLocalement) {
      fusion.delete(id);
    }
    prestationsRef.current = fusion;
    setPrestationsChoisies(fusion);
    dernierePrestationsEnvoyeesRef.current = nouvelleBase;
    derniersPropsPrestationsRef.current = basePropsBrute;
    // LE BROUILLON SUIT LA FUSION, QUAND ELLE CHANGE RÉELLEMENT L'ÉCRAN
    // (point 3, 9F4H6E-PRESTATIONS-DIFFERENCE-EN-LIGNE) — sans cette
    // réécriture, un rechargement de page après cette fusion relirait un
    // brouillon ENCORE PÉRIMÉ (voir le montage ci-dessous) et perdrait ce
    // que ce rafraîchissement venait d'intégrer. Gardé sur un changement
    // RÉEL (`ajoutees`/`retirees` non vides) : un simple montage sans
    // aucune saisie locale ne doit pas créer de brouillon qui n'existait
    // pas encore.
    if (ajouteesLocalement.length > 0 || retireesLocalement.length > 0) {
      ecrireBrouillonCourant();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seule la liste compte, jamais sa référence
  }, [prestationsInitiales.join(",")]);

  // AUCUN ENVOI AUTOMATIQUE AU RETOUR DU RÉSEAU (9F4H3-HORS-RESEAU-ENVOYER,
  // décision n° 105 d'Alexis) — REMPLACE l'ancien écouteur `online` qui
  // relançait `flushTout()` : une saisie faite hors réseau est désormais
  // gardée dans la file (voir les branches `hors_ligne` ci-dessus) et ne
  // repart qu'au clic explicite sur « Envoyer » (`components/terrain/
  // bouton-envoyer.tsx`), jamais seule.

  function onChangeCommentaire(valeur: string): void {
    commentaireRef.current = valeur;
    setCommentaire(valeur);
    ecrireBrouillonCourant();
    demarrerMinuteurRapport();
  }

  function onChangeSuite(valeur: string): void {
    suiteRef.current = valeur;
    setSuite(valeur);
    ecrireBrouillonCourant();
    demarrerMinuteurRapport();
  }

  function ajouterPiece(): void {
    const suivant = [
      ...piecesRef.current,
      { id: crypto.randomUUID(), designation: "", reference: "", quantite: 1 },
    ];
    piecesRef.current = suivant;
    setPieces(suivant);
    ecrireBrouillonCourant();
    demarrerMinuteurRapport();
  }

  function modifierPiece(
    id: string,
    changement: Partial<
      Pick<LignePiece, "designation" | "reference" | "quantite">
    >,
  ): void {
    const suivant = piecesRef.current.map((p) =>
      p.id === id ? { ...p, ...changement } : p,
    );
    piecesRef.current = suivant;
    setPieces(suivant);
    ecrireBrouillonCourant();
    demarrerMinuteurRapport();
  }

  function retirerPiece(id: string): void {
    const suivant = piecesRef.current.filter((p) => p.id !== id);
    piecesRef.current = suivant;
    setPieces(suivant);
    ecrireBrouillonCourant();
    void envoyerRapport();
  }

  function basculerPrestation(id: string, cochee: boolean): void {
    const suivant = new Set(prestationsRef.current);
    if (cochee) {
      suivant.add(id);
    } else {
      suivant.delete(id);
    }
    prestationsRef.current = suivant;
    setPrestationsChoisies(suivant);
    ecrireBrouillonCourant();
    void envoyerPrestations();
  }

  function choisirIssue(valeur: IssueSignature): void {
    issueSignatureRef.current = valeur;
    setIssueSignature(valeur);
    ecrireBrouillonCourant();
  }

  function position(evenement: React.PointerEvent<HTMLCanvasElement>): {
    x: number;
    y: number;
  } {
    const canvas = evenement.currentTarget;
    return positionCanevas(evenement, canvas.getBoundingClientRect(), {
      width: canvas.width,
      height: canvas.height,
    });
  }

  function demarrerTrace(
    evenement: React.PointerEvent<HTMLCanvasElement>,
  ): void {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    const contexte = canvas.getContext("2d");
    if (contexte === null) {
      return;
    }
    traceEnCoursRef.current = true;
    preparerTraitSignature(contexte, canvas);
    const { x, y } = position(evenement);
    contexte.beginPath();
    contexte.moveTo(x, y);
  }

  function tracer(evenement: React.PointerEvent<HTMLCanvasElement>): void {
    if (!traceEnCoursRef.current) {
      return;
    }
    const contexte = canvasRef.current?.getContext("2d");
    if (contexte === null || contexte === undefined) {
      return;
    }
    const { x, y } = position(evenement);
    contexte.lineTo(x, y);
    contexte.stroke();
    setATrace(true);
  }

  function arreterTrace(): void {
    if (!traceEnCoursRef.current) {
      return;
    }
    traceEnCoursRef.current = false;
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    imageSignatureRef.current = canvas.toDataURL("image/png");
    ecrireBrouillonCourant();
    void tenterEnvoiSignature();
  }

  function effacerTrace(): void {
    const canvas = canvasRef.current;
    const contexte = canvas?.getContext("2d");
    if (
      canvas === null ||
      canvas === undefined ||
      contexte === null ||
      contexte === undefined
    ) {
      return;
    }
    contexte.clearRect(0, 0, canvas.width, canvas.height);
    setATrace(false);
    imageSignatureRef.current = null;
    ecrireBrouillonCourant();
  }

  /**
   * LA SIGNATURE, LOCALEMENT COMPLÈTE (point 4, C5) — une signature déjà
   * acceptée par le serveur (`dejaSignee`) compte, quel que soit le brouillon
   * affiché à l'écran. Sinon, seul un brouillon COMPLET compte : un tracé
   * sans nom, ou un motif resté vide, ne suffit pas — mêmes conditions que
   * `tenterEnvoiSignature` applique avant d'envoyer.
   */
  function issueSignatureLocaleComplete(): IssueSignature | null {
    if (dejaSignee) {
      return "signee";
    }
    const issue = issueSignatureRef.current;
    if (issue === "signee") {
      return imageSignatureRef.current !== null &&
        nomSignatureRef.current.trim().length > 0
        ? "signee"
        : null;
    }
    if (issue === "client_absent" || issue === "refus_signature") {
      return motifSignatureRef.current.trim().length > 0 ? issue : null;
    }
    return null;
  }

  async function onClickTerminer(): Promise<void> {
    setEnEnvoiTerminer(true);
    setMessageTerminer(null);
    // UN IDENTIFIANT DÈS LE PREMIER ESSAI (point 3, C7) — voir
    // `tenterEnvoiSignature` : le même `operation_id` voyage du premier
    // essai en ligne jusqu'à un éventuel renvoi par la file.
    const operation = nouvelleOperation();
    const verdict = await flushTout();

    // TERMINER HORS RÉSEAU (9F4H3-HORS-RESEAU-ENVOYER, point 1, décision
    // n° 108 d'Alexis) — ACCEPTÉ LOCALEMENT, signature comprise, plutôt que
    // refusé comme avant ce lot. Rapport, prestations et signature viennent
    // d'être mis en file par leurs propres branches `hors_ligne` ci-dessus ;
    // « terminer » les y rejoint. `peutTerminer` (temps mesuré compris)
    // N'EST PAS rejugé ici : le serveur reste l'arbitre final, à l'envoi
    // réel par « Envoyer » — un refus là-bas remet l'entrée en file avec son
    // motif (point 3 : rien ne se perd, rien n'est non plus accepté à tort).
    //
    // **GARDÉ SUR `!navigator.onLine` SEUL, ou sur la coquille** (9F4A,
    // revue ; 9F4H6, point 1) — un bloc qui échoue alors que l'APPAREIL se
    // croit en ligne (une route interceptée par une épreuve, un
    // aller-retour qui échoue une fois) reste le cas que 9F4A traitait
    // déjà : un refus clair, rejouable par un second clic, le brouillon
    // gardé — PAS une mise en file silencieuse que l'utilisateur ne saurait
    // pas distinguer d'un « Terminer » qui aurait réellement réussi. Le mode
    // avion RÉEL déclenche la décision 108 ; `sansSession` aussi, car dans
    // la coquille `/terrain-hors-reseau` aucune session n'existe JAMAIS
    // (voir `envoyerJson` ci-dessus) — un POST `/terminer` y reçoit
    // systématiquement `auth.refus`, jamais une vraie acceptation, donc ce
    // cas doit être traité EXACTEMENT comme une coupure réseau plutôt que de
    // tomber dans la branche `hors_ligne` ci-dessous, qui affiche le même
    // message mais ne garde jamais le geste « terminer » lui-même.
    if (!navigator.onLine || sansSession) {
      // LE VERDICT LOCAL (point 4, C5) — `peutTerminer`, importé TEL QUEL
      // (aucune recopie), jugé sur l'état LOCAL : le statut EFFECTIF (le
      // serveur dit `statut`, mais un « démarrer » mis en file depuis fait
      // ENTRER en cours sans que le serveur le sache), le temps mesuré
      // (connu du serveur + les segments encore dans la file) et la
      // signature LOCALEMENT complète. Un refus ici se nomme comme en
      // ligne et ne met RIEN en file (rien n'est accepté à tort).
      const entreesCompteur = await listerFilePourIntervention(interventionId, {
        utilisateurId,
        societeId,
      });
      const statutEffectif: StatutIntervention = enCoursLocalement
        ? "en_cours"
        : statut;
      const mesureCompteur = mesureCompteurDeLaFile(
        entreesCompteur,
        segmentOuvertConnu,
      );
      // UN SEGMENT ENCORE OUVERT N'EST PAS « TEMPS MANQUANT » (correctif
      // 9F4H3AA) — si un « démarrer » reste en file sans « arrêter », son
      // temps réel sera mesuré par le serveur à l'envoi, pas ici (voir
      // `mesureCompteurDeLaFile`). Sans ce repli, un technicien qui clique
      // « Terminer » directement, compteur encore en marche — le cas
      // ORDINAIRE, qui ne demande pas de mettre en pause avant de finir —
      // se voyait refuser localement « temps manquant » même après des
      // heures de travail, alors que le même geste EN LIGNE aurait réussi
      // (le serveur ferme le segment ouvert sur l'instant du « terminer »
      // avant de mesurer). `1` n'est pas une durée : seul `peutTerminer`
      // lit ce nombre, et seulement pour écarter `<= 0`.
      const tempsMesureLocal = mesureCompteur.segmentOuvert
        ? Math.max(minutesConnues + mesureCompteur.minutes, 1)
        : minutesConnues + mesureCompteur.minutes;
      const verdictLocal = peutTerminer(
        statutEffectif,
        tempsMesureLocal,
        issueSignatureLocaleComplete(),
      );
      if (verdictLocal.refuse) {
        setEnEnvoiTerminer(false);
        setMessageTerminer(texteDuMotif(verdictLocal.cle));
        return;
      }
      // JAMAIS « EN ATTENTE D'ENVOI » SI RAPPORT, PRESTATIONS OU SIGNATURE
      // N'ONT PAS ÉTÉ GARDÉS (point 4, 9F4H3AC) — `flushTout`, ci-dessus, a
      // pu échouer à mettre un de ces trois blocs en file (IndexedDB en
      // panne, `echec_gardee`) sans que « terminer » s'en aperçoive : rien
      // n'empêchait alors d'annoncer un envoi qui, à la reprise du réseau,
      // partirait sans le rapport, les prestations ou la signature promis.
      if (
        verdict.rapport.etat === "echec" ||
        verdict.prestations.etat === "echec" ||
        verdict.signature.etat === "echec"
      ) {
        setEnEnvoiTerminer(false);
        setMessageTerminer(t("terrain.file.echec_gardee"));
        return;
      }
      const gardee = await ajouterSaisie({
        interventionId,
        utilisateurId,
        societeId,
        geste: { type: "terminer" },
        id: operation.id,
        instantAppareil: operation.instantAppareil,
      });
      setEnEnvoiTerminer(false);
      if (!gardee.gardee) {
        // JAMAIS « EN ATTENTE D'ENVOI » SANS PREUVE (point 2, 9F4H3A) — rien
        // n'a été écrit : ni `termineLocalement`, ni le message qui dirait
        // que l'intervention attend d'être envoyée.
        setMessageTerminer(t("terrain.file.echec_gardee"));
        return;
      }
      setTermineLocalement(true);
      setMessageTerminer(t("terrain.terminer.en_attente_envoi"));
      return;
    }
    if (
      verdict.rapport.etat === "hors_ligne" ||
      verdict.prestations.etat === "hors_ligne" ||
      verdict.signature.etat === "hors_ligne"
    ) {
      setEnEnvoiTerminer(false);
      setMessageTerminer(t("terrain.terminer.sans_reseau"));
      return;
    }
    if (verdict.rapport.etat === "echec") {
      setEnEnvoiTerminer(false);
      setMessageTerminer(
        t("terrain.terminer.rapport_non_enregistre") +
          texteDuMotif(verdict.rapport.motifCle),
      );
      return;
    }
    if (verdict.prestations.etat === "echec") {
      setEnEnvoiTerminer(false);
      setMessageTerminer(
        t("terrain.terminer.prestations_non_enregistrees") +
          texteDuMotif(verdict.prestations.motifCle),
      );
      return;
    }
    if (verdict.signature.etat === "echec") {
      setEnEnvoiTerminer(false);
      setMessageTerminer(
        t("terrain.terminer.signature_non_enregistree") +
          texteDuMotif(verdict.signature.motifCle),
      );
      return;
    }

    const corpsTerminer = new FormData();
    corpsTerminer.set("operation_id", operation.id);
    corpsTerminer.set("instant_appareil", operation.instantAppareil);
    const resultat = await envoyerJson(
      `/api/terrain/${interventionId}/terminer`,
      corpsTerminer,
      sansSession,
    );
    if (resultat === null) {
      setMessageTerminer(t("terrain.terminer.sans_reseau"));
      setEnEnvoiTerminer(false);
      return;
    }
    if (resultat.ok) {
      effacerBrouillon(interventionId);
      const suffixe =
        resultat.motif === null
          ? ""
          : `?motif=${encodeURIComponent(resultat.motif)}`;
      router.push(`/terrain/${interventionId}${suffixe}`);
      router.refresh();
      return;
    }
    setEnEnvoiTerminer(false);
    setMessageTerminer(texteDuMotif(resultat.motif));
  }

  return (
    <>
      <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
        <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
          {t("terrain.rapport.titre")}
        </h2>
        <label className="flex flex-col gap-1">
          <span className="text-16 font-bold">
            {t("terrain.rapport.commentaire_libelle")}
          </span>
          <textarea
            name="commentaire_technicien"
            rows={3}
            value={commentaire}
            onChange={(e) => onChangeCommentaire(e.target.value)}
            onBlur={() => void envoyerRapport()}
            placeholder={t("terrain.rapport.commentaire_placeholder")}
            className="border-app-bord bg-app-surface rounded-md border px-2 py-1.5 text-16 font-bold"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-16 font-bold">
            {t("terrain.rapport.suite_libelle")}
          </span>
          <textarea
            name="suite_a_donner"
            rows={2}
            value={suite}
            onChange={(e) => onChangeSuite(e.target.value)}
            onBlur={() => void envoyerRapport()}
            placeholder={t("terrain.rapport.suite_placeholder")}
            className="border-app-bord bg-app-surface rounded-md border px-2 py-1.5 text-16 font-bold"
          />
        </label>
        <Indicateur
          etat={etatRapport}
          texteReussite={t("terrain.rapport.enregistre")}
          texteEchec={t("terrain.rapport.refus")}
        />
      </section>

      {!afficherPieces ? null : (
        <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
          <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
            {t("terrain.pieces.titre")}
          </h2>
          {pieces.length === 0 ? (
            <p className="text-app-encre-faible text-16 font-bold">
              {t("terrain.pieces.aucune")}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {pieces.map((piece) => (
                <div
                  key={piece.id}
                  className="border-app-bord flex flex-col gap-2 rounded-md border p-2"
                >
                  <label className="flex flex-col gap-1">
                    <span className="text-16 font-bold">
                      {t("terrain.pieces.designation_libelle")}
                    </span>
                    <input
                      type="text"
                      value={piece.designation}
                      maxLength={200}
                      onChange={(e) =>
                        modifierPiece(piece.id, { designation: e.target.value })
                      }
                      onBlur={() => void envoyerRapport()}
                      placeholder={t("terrain.pieces.designation_placeholder")}
                      className="border-app-bord bg-app-surface rounded-md border px-2 py-1.5 text-16 font-bold"
                    />
                  </label>
                  <div className="flex gap-2">
                    <label className="flex flex-1 flex-col gap-1">
                      <span className="text-16 font-bold">
                        {t("terrain.pieces.reference_libelle")}
                      </span>
                      <input
                        type="text"
                        value={piece.reference}
                        maxLength={80}
                        onChange={(e) =>
                          modifierPiece(piece.id, { reference: e.target.value })
                        }
                        onBlur={() => void envoyerRapport()}
                        className="border-app-bord bg-app-surface rounded-md border px-2 py-1.5 text-16 font-bold"
                      />
                    </label>
                    <label className="flex w-20 flex-col gap-1">
                      <span className="text-16 font-bold">
                        {t("terrain.pieces.quantite_libelle")}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={9999}
                        value={piece.quantite}
                        onChange={(e) =>
                          modifierPiece(piece.id, {
                            // MÊME BORNE QUE `schemaPieceRemplacee` (9I7B2,
                            // correctif de revue) : jamais une valeur que le
                            // serveur refuserait ensuite.
                            quantite: Math.min(
                              9999,
                              Math.max(
                                1,
                                Number.parseInt(e.target.value, 10) || 1,
                              ),
                            ),
                          })
                        }
                        onBlur={() => void envoyerRapport()}
                        className="border-app-bord bg-app-surface rounded-md border px-2 py-1.5 text-16 font-bold"
                      />
                    </label>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="text-16"
                    onClick={() => retirerPiece(piece.id)}
                  >
                    {t("terrain.pieces.retirer")}
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button
            type="button"
            size="lg"
            className="text-16"
            onClick={ajouterPiece}
          >
            {t("terrain.pieces.ajouter")}
          </Button>
        </section>
      )}

      <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
        <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
          {t("terrain.prestations.titre")}
        </h2>
        {prestations.length === 0 ? (
          <p className="text-app-encre-faible text-16 font-bold">
            {catalogueIndisponibleHorsReseau
              ? t("terrain.prestations.catalogue_indisponible_hors_reseau")
              : t("terrain.prestations.aucune")}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {/* LA CIBLE TACTILE DE 44 PX (point 5, 9G5-TERRAIN-ERGONOMIE) —
                un `<input type="checkbox">` nu n'offre, sous le pouce, que la
                taille du glyphe rendu par le navigateur. Même habillage que
                partout ailleurs (`CaseACocher`, CG8), jamais une seconde
                écriture de la même cible. */}
            {prestations.map((prestation) => (
              <CaseACocher
                key={prestation.id}
                name={`prestation_${prestation.id}`}
                libelle={prestation.libelle}
                checked={prestationsChoisies.has(prestation.id)}
                onChange={() =>
                  basculerPrestation(
                    prestation.id,
                    !prestationsChoisies.has(prestation.id),
                  )
                }
                className="flex items-center gap-2 text-16 font-bold"
              />
            ))}
          </div>
        )}
        <Indicateur
          etat={etatPrestations}
          texteReussite={t("terrain.prestations.enregistre")}
          texteEchec={t("terrain.prestations.refus")}
        />
      </section>

      {sectionPhotos}

      {conditionsFacturation.length === 0 ? null : (
        <section className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5">
          <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
            {t("tarification.conditions.titre")}
          </h2>
          {conditionsFacturation.map((ligne) => (
            <p key={ligne} className="text-16 font-bold">
              {ligne}
            </p>
          ))}
        </section>
      )}

      <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
        <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
          {t("terrain.signature.titre")}
        </h2>
        {dejaSignee ? (
          <p className="text-app-orange-encre bg-app-orange-fond border-app-orange-bord rounded-md border px-3 py-2 text-16 font-bold">
            {t("terrain.signature.deja_signee")}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="lg"
            variant={issueSignature === "signee" ? "default" : "outline"}
            className="text-16"
            onClick={() => choisirIssue("signee")}
          >
            {t("terrain.signature.option_signee")}
          </Button>
          <Button
            type="button"
            size="lg"
            variant={issueSignature === "client_absent" ? "default" : "outline"}
            className="text-16"
            onClick={() => choisirIssue("client_absent")}
          >
            {t("terrain.signature.option_absent")}
          </Button>
          <Button
            type="button"
            size="lg"
            variant={
              issueSignature === "refus_signature" ? "default" : "outline"
            }
            className="text-16"
            onClick={() => choisirIssue("refus_signature")}
          >
            {t("terrain.signature.option_refus")}
          </Button>
        </div>

        {issueSignature === "signee" ? (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-16 font-bold">
                {t("terrain.signature.nom_libelle")}
              </span>
              <input
                type="text"
                value={nomSignataire}
                onChange={(e) => {
                  nomSignatureRef.current = e.target.value;
                  setNomSignataire(e.target.value);
                  ecrireBrouillonCourant();
                }}
                onBlur={() => void tenterEnvoiSignature()}
                maxLength={120}
                className="border-app-bord bg-app-surface rounded-md border px-2 py-1.5 text-16 font-bold"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-16 font-bold">
                {t("terrain.signature.qualite_libelle")}
              </span>
              <input
                type="text"
                value={qualiteSignataire}
                onChange={(e) => {
                  qualiteSignatureRef.current = e.target.value;
                  setQualiteSignataire(e.target.value);
                  ecrireBrouillonCourant();
                }}
                onBlur={() => void tenterEnvoiSignature()}
                maxLength={80}
                className="border-app-bord bg-app-surface rounded-md border px-2 py-1.5 text-16 font-bold"
              />
            </label>
            {/* LA LARGEUR DISPONIBLE, PAS 320 PX FIXES (point 5,
                9G5-TERRAIN-ERGONOMIE) — 320 px dépassait les 311 px utiles à
                375 px (gouttières de la page et de la carte). `w-full`
                rend le canevas fluide ; sa RÉSOLUTION de dessin
                (`width`/`height`) est posée à la taille affichée par le
                `useLayoutEffect` ci-dessus (point 1, 9H4-FINITIONS-AVANT-
                AUDIT) — 320×140 n'est qu'un défaut avant sa première mesure.
                `position()` met le point du pointeur à l'échelle de cette
                résolution (`positionCanevas`, ci-dessus) — sans cette
                échelle, le tracé dérivait du doigt qui le pose. */}
            <canvas
              ref={canvasRef}
              width={320}
              height={140}
              className="border-app-bord bg-app-surface h-[140px] w-full touch-none rounded-md border"
              onPointerDown={demarrerTrace}
              onPointerMove={tracer}
              onPointerUp={arreterTrace}
              onPointerLeave={arreterTrace}
            />
            {aTrace ? null : (
              <p className="text-app-encre-faible text-16 font-bold">
                {t("terrain.signature.a_tracer")}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="self-start text-16"
              onClick={effacerTrace}
            >
              {t("terrain.signature.effacer")}
            </Button>
          </>
        ) : null}

        {issueSignature === "client_absent" ||
        issueSignature === "refus_signature" ? (
          <label className="flex flex-col gap-1">
            <span className="text-16 font-bold">
              {t("terrain.signature.motif_libelle")}
            </span>
            <textarea
              rows={3}
              value={motifSignature}
              onChange={(e) => {
                motifSignatureRef.current = e.target.value;
                setMotifSignature(e.target.value);
                ecrireBrouillonCourant();
              }}
              onBlur={() => void tenterEnvoiSignature()}
              placeholder={t("terrain.signature.motif_placeholder")}
              className="border-app-bord bg-app-surface rounded-md border px-2 py-1.5 text-16 font-bold"
            />
          </label>
        ) : null}

        <Indicateur
          etat={etatSignature}
          texteReussite={t("terrain.signature.enregistre")}
          texteEchec={t("terrain.signature.refus")}
        />
      </section>

      {afficherTerminer || enCoursLocalement ? (
        <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
          <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
            {t("terrain.terminer.titre")}
          </h2>
          {termineLocalement ? (
            // TERMINÉ LOCALEMENT, EN ATTENTE D'ENVOI (point 1, décision
            // n° 108) — plus de bouton tant que « Envoyer » n'a pas confirmé
            // auprès du serveur.
            <p
              role="status"
              className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3 py-2 text-16 font-bold"
            >
              {t("terrain.terminer.en_attente_envoi")}
            </p>
          ) : confirmationTerminerOuverte ? (
            <div className="flex flex-col gap-2">
              <p className="text-16 font-bold">
                {t("terrain.terminer.confirmation.titre")}
              </p>
              <ul className="list-disc pl-5 text-16 font-bold">
                <li>{texteConfirmationTemps(minutesConnues)}</li>
                <li>
                  {texteConfirmationRapport(commentaire.trim().length > 0)}
                </li>
                <li>
                  {texteConfirmationPrestations(prestationsChoisies.size)}
                </li>
                <li>
                  {texteConfirmationSignature(issueSignatureLocaleComplete())}
                </li>
              </ul>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="flex-1 text-16"
                  onClick={() => setConfirmationTerminerOuverte(false)}
                >
                  {t("terrain.terminer.confirmation.non")}
                </Button>
                <Button
                  type="button"
                  size="lg"
                  className="flex-1 text-16"
                  disabled={enEnvoiTerminer}
                  onClick={() => {
                    setConfirmationTerminerOuverte(false);
                    void onClickTerminer();
                  }}
                >
                  {t("terrain.terminer.confirmation.oui")}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Button
                type="button"
                size="lg"
                className="w-full text-16"
                disabled={enEnvoiTerminer}
                onClick={() => setConfirmationTerminerOuverte(true)}
              >
                {t("terrain.terminer.bouton")}
              </Button>
              {messageTerminer === null ? null : (
                <p
                  role="status"
                  className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3 py-2 text-16 font-bold"
                >
                  {messageTerminer}
                </p>
              )}
            </>
          )}
        </section>
      ) : verdictTerminerRefuseCle === null ? null : (
        // LE REFUS SERVEUR DE « TERMINER » (voir la docstring du prop) —
        // affiché seulement si aucune saisie locale ne l'a rendu caduc.
        <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
          <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
            {t("terrain.terminer.titre")}
          </h2>
          <p className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3 py-2 text-16 font-bold">
            {texteDuMotif(verdictTerminerRefuseCle)}
          </p>
        </section>
      )}
    </>
  );
}
