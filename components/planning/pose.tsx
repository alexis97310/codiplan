"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { dateCivile } from "@/lib/calendar/fuseau";
import { estCleTraduction, t, type CleTraduction } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  etatDeLaCase,
  type CarteSurvolee,
  type CaseSurvolee,
  type EtatDeSurvol,
  type MotifRefusSurvol,
} from "@/lib/interventions/survol";
import { CLASSES_TON } from "@/lib/theme/statuts";

import {
  FenetrePose,
  formatteMinutes,
} from "@/components/planning/fenetre-pose";

/**
 * LE GLISSER-DÉPOSER DU PLANNING (R2-19).
 *
 * *La maquette le prescrit depuis le premier jour — « Glisser-déposer pour
 * réaffecter », `cursor: grab` sur `.ev` —, et D95 en fait une source qui fait
 * foi. Ne pas l'avoir fait était un manquement, pas un choix.*
 *
 * ## L'ÉCRAN NE MONTRE JAMAIS UN ÉTAT QUE LA BASE N'A PAS ACCEPTÉ
 *
 * C'est la règle d'exploitation, et la façon la plus sûre de la tenir est de
 * **ne jamais anticiper** : le bloc ne quitte sa case qu'une fois la base
 * d'accord, et l'écran se relit alors du serveur. Il n'y a donc pas de « retour
 * à la position d'origine » à programmer — *il n'y a jamais eu de départ.*
 *
 * On y perd la sensation d'immédiateté d'un déplacement optimiste ; on y gagne
 * qu'aucun chemin de code ne peut laisser l'écran en avance sur la base. Sur un
 * réseau calédonien, un bloc qui se pose puis revient trois secondes plus tard
 * est pire qu'un bloc qui attend une seconde.
 *
 * ## « SE RELIRE DU SERVEUR » N'EST PLUS `router.refresh()` (N+1, 17/09/2026)
 *
 * *Mesuré, sur 20 essais consécutifs d'un dépôt accepté : 19 fois sur 20 le
 * rendu ne suivait pas l'écriture, parfois plus de 30 secondes.* La base
 * écrivait pourtant toujours, en moins de 50 ms — c'est le NAVIGATEUR qui
 * annulait lui-même la requête de rafraîchissement après en avoir reçu une
 * réponse 200 (`net::ERR_ABORTED`, mesuré au protocole). Trois causes
 * plausibles ont été éliminées par la mesure avant d'y renoncer : le déluge de
 * préfetch des liens de l'écran, la portée du `loading.tsx`, et
 * `revalidatePath` côté route — aucune n'a changé le taux d'échec.
 *
 * **Une réoptimisation locale du bloc — le déplacer dans l'état React dès la
 * réponse 200, sans attendre le serveur — a été examinée et écartée.** Le
 * bloc lui-même bougerait juste ; le panneau de charge et les trous de la vue
 * jour, eux, sont calculés depuis la base — calendriers, absences, trajets —
 * et resteraient faux jusqu'à ce que le rafraîchissement défaillant les
 * rattrape. *Un écran où le bloc dit vrai et le panneau à côté dit faux est
 * pire qu'un écran uniformément en retard* : le second se voit, le premier se
 * croit.
 *
 * `router.refresh()` est donc RETIRÉ du seul chemin où il mentait — un dépôt
 * ACCEPTÉ — et remplacé par un **rechargement complet** de la page, mesuré
 * fiable à 20/20 sur la même série : c'est exactement la navigation qu'un
 * `page.goto` neuf déclenche, celle que la mesure n'a jamais vue échouer. Les
 * trois refus techniques (règle métier, erreur serveur, connexion
 * interrompue) ne naviguent nulle part et gardent l'état React — rien n'a
 * jamais bougé à l'écran dans ces trois cas, et un rechargement n'y changerait
 * rien qu'on veuille garder.
 *
 * ## TOUT REFUS NOMME SON MOTIF
 *
 * *Un bloc qui revient à sa place sans explication apprend à ne plus faire
 * confiance à l'écran.* Le motif arrive de la route sous forme de CLÉ de
 * dictionnaire, jamais de texte : sans ce filtre, une réponse forgée ferait
 * écrire n'importe quoi à la page (L1-02f).
 *
 * ## CE N'EST PAS LA SEULE VOIE, ET CE N'EST PAS LA PRINCIPALE
 *
 * *Une fonction qui n'existe qu'à la souris exclut le tactile et le clavier.*
 * Chaque bloc reste un lien vers sa fiche, où le formulaire « Déplacer » fait
 * exactement la même chose — même route, même décision.
 */

/**
 * Ce qui est tenu pendant un glissé : l'intervention, et sa DURÉE.
 *
 * **Il voyage dans le `dataTransfer` du navigateur, jamais dans un état React.**
 * C'est ce à quoi le `dataTransfer` sert, et c'est surtout le seul endroit qui
 * survive à la séquence : `dragstart` et `drop` peuvent se suivre dans le même
 * lot de rendu, et un état posé au premier ne serait pas encore lu au second.
 * *Mesuré le 11/09/2026 : avec un état React, le dépôt ne postait rien.*
 */
export type EnMain = {
  readonly id: string;
  /** `null` quand l'intervention n'a ni créneau posé ni durée estimée. */
  readonly dureeMin: number | null;
  /**
   * Le BORD saisi (L3-01b). `"bloc"` déplace l'intervention en conservant sa
   * durée ; `"fin"` la REDIMENSIONNE en laissant son début où il est.
   *
   * *Un seul mécanisme pour les deux gestes, et c'est délibéré* : la case qui
   * accepte, la route qui décide, le refus qui se nomme — tout est déjà écrit.
   * Un second chemin aurait été une seconde lecture d'un même critère.
   */
  readonly bord: "bloc" | "fin";
  /** Minutes locales du DÉBUT, connues seulement quand on tire le bord bas. */
  readonly debutMinutes: number | null;
  /**
   * VIENT-ELLE DE LA FILE « À PLANIFIER » ? (PG-B2-FENETRE-POSE).
   *
   * *Une carte de la file n'a ni heure ni parfois de durée sûre : la poser
   * sur une case Semaine ou Jour n'écrit plus rien directement* — la case
   * ouvre `FenetrePose`, pré-remplie du technicien et du jour visés, et
   * c'est « Planifier » qui appelle la route. Une carte DÉJÀ planifiée
   * (`depuisFile: false`) garde le déplacement direct (PG-A7).
   */
  readonly depuisFile: boolean;
  /** Le titre affiché par `FenetrePose` — composé une fois, à l'engagement du glissé. */
  readonly libelle: string | null;
  /** Le fuseau de l'AGENCE DE L'INTERVENTION (jamais celui du technicien visé). */
  readonly fuseau: string | null;
};

/** Le type MIME du glissé. Nommé, pour qu'un glissé étranger ne soit pas lu. */
const FORMAT = "application/x-codiplan-intervention";

/**
 * LE DÉLAI D'UN DÉPLACEMENT DIRECT AVANT SON ÉCRITURE (PG-B5-ANNULER-DEPLACEMENT,
 * décision QG-6 d'Alexis du 27/09/2026) — fixe, en millisecondes. Exportée
 * pour que `tests/unit/planning/pose.test.tsx` avance des minuteries fausses
 * d'EXACTEMENT ce délai, jamais d'une valeur recopiée qui divergerait en
 * silence (§9, 01/09).
 */
export const DELAI_DEPLACEMENT_DIFFERE_MS = 10_000;

/**
 * UN DÉPLACEMENT DIRECT EN ATTENTE D'ÉCRITURE (PG-B5) — voir l'entête du
 * fichier. `libelle` est composé UNE FOIS, au dépôt, avec les `techniciens`
 * alors en portée : le construire à chaque rendu de `CasePosable` lui ferait
 * porter une prop que cette case n'a jamais reçue.
 */
type DeplacementEnAttente = {
  readonly main: EnMain;
  readonly cible: CibleDeDepot;
  readonly libelle: string;
};

type Depot = {
  readonly deposer: (main: EnMain, cible: CibleDeDepot) => void;
  readonly ouvrirPose: (demande: DemandeDOuverture) => void;
  /**
   * LES DÉPLACEMENTS DIRECTS EN ATTENTE D'ÉCRITURE (PG-B5), PAR INTERVENTION —
   * `BlocPosable` s'efface de son ANCIENNE case tant que la sienne y figure ;
   * `CasePosable` affiche le bandeau « Annuler » sur la case VISÉE (celle dont
   * le `cible` de l'entrée correspond au sien).
   */
  readonly enAttente: ReadonlyMap<string, DeplacementEnAttente>;
  /** Efface l'entrée et annule sa minuterie — SANS AUCUNE REQUÊTE (PG-B5). */
  readonly annulerDeplacement: (id: string) => void;
  /**
   * LA CARTE EN COURS DE GLISSÉ (PG-B4-SURVOL-CASES) — posée par
   * `BlocPosable` à `dragstart`, effacée à `dragend`. `CasePosable` la lit
   * pour juger son propre survol ; `null` hors glissé.
   *
   * *Pourquoi pas `dataTransfer.getData()` pendant le survol* : le navigateur
   * refuse de le rendre avant `drop` (seuls les TYPES du glissé sont lisibles
   * à `dragover`, jamais les VALEURS) — une restriction du standard, pas un
   * oubli d'implémentation. `BlocPosable` connaît déjà la carte en props ; la
   * faire aussi transiter par ce state évite d'attendre un `drop` pour la
   * lire une seconde fois.
   */
  readonly carteEnGlisse: CarteSurvolee | null;
  readonly commencerGlisse: (carte: CarteSurvolee) => void;
  readonly terminerGlisse: () => void;
  /** Le motif du survol EN COURS, pour l'unique région `aria-live` de `Posable`. */
  readonly signalerSurvol: (etat: EtatDeSurvol | null) => void;
};

/**
 * CE QU'IL FAUT POUR OUVRIR `FenetrePose` — depuis un dépôt (jour et
 * technicien connus) ou depuis le bouton « Poser » d'une carte de la file
 * (aucun des deux, comblés par `Posable` avec le jour du jour et le premier
 * technicien de la liste).
 */
export type DemandeDOuverture = {
  readonly interventionId: string;
  readonly libelle: string;
  readonly dureeMinInitiale: number | null;
  readonly technicienIdInitial: string | null;
  readonly jourInitial: string | null;
  readonly fuseau: string;
};

/** Ce qu'une case de dépôt sait d'elle-même. */
export type CibleDeDepot = {
  /** Le jour visé, `2026-09-16`. Toujours présent : un créneau se pose sur un jour. */
  readonly jour: string;
  /** La personne visée, ou `null` pour la file d'attente. */
  readonly technicienId: string | null;
  /**
   * Les minutes locales depuis minuit, telles que la colonne d'heures les
   * affiche, ou `null` en vue semaine — celle-ci n'a pas d'heure à donner, et
   * n'en invente pas.
   *
   * **Des MINUTES, jamais un instant** : l'instant demande le fuseau de
   * l'agence, que le navigateur ne connaît pas. Le dépôt le résout, une fois,
   * sous le fuseau qui décide.
   */
  readonly minutes: number | null;
  /**
   * Le PAS de la grille à cet endroit, en minutes (L3-01b).
   *
   * *Il vient de la vue, pas d'une constante* : `journee.ts` le règle au plus
   * fin des agences présentes, et il est paramétrable par agence. Un pas écrit
   * ici serait un second endroit où la grille se décide, et il deviendrait faux
   * le jour où une agence règle le sien.
   *
   * Il ne sert qu'au redimensionnement — la case visée est la DERNIÈRE occupée,
   * et sa fin est `minutes + pasMinutes`.
   */
  readonly pasMinutes: number;
  /**
   * CE QUE CETTE CASE PORTE DÉJÀ, POUR LE SURVOL (PG-B4-SURVOL-CASES) — les
   * mêmes données qui la dessinent déjà (absence, ouverture, férié), jamais
   * une requête. Voir `lib/interventions/survol.ts`.
   */
  readonly survol: CaseSurvolee;
};

/**
 * CE QUE LE DÉPÔT REND, INTERPRÉTÉ EN QUATRE ISSUES QUI NE SE CONFONDENT PAS
 * (D-06, 17/09/2026).
 *
 * ## Le défaut que cette fonction répare, et il a été mesuré
 *
 * `reponse.ok` n'était **jamais** lu, et `.json().catch(() => null)` faisait
 * tomber une réponse VIDE ou NON-JSON sur la branche du SUCCÈS — `cle` valait
 * `null` faute de mieux, exactement comme un refus accepté. Et le `fetch`
 * n'avait aucun `catch` : une coupure réseau partait en rejet non intercepté.
 * **Le silence avait exactement la forme du succès** (§9, 31/08) — le pire
 * des deux, parce qu'un planificateur qui déplace une intervention voit
 * l'écran dire que c'est fait quand ce n'est pas fait.
 *
 * ## Quatre issues, et jamais deux qui se ressemblent
 *
 * Un refus MÉTIER — la route a décidé, et le dit par sa clé — ne se confond
 * ni avec une ERREUR SERVEUR (la route a répondu un échec, ou un corps que
 * rien ne peut lire : *cela se réessaie*) ni avec une CONNEXION INTERROMPUE
 * (la réponse n'est jamais revenue : *cela demande de regarder ailleurs
 * qu'à l'écran*, du côté du réseau). Confondre les deux dernières enverrait
 * réessayer à l'aveugle une requête peut-être déjà appliquée, ou inversement.
 *
 * Fonction PURE, délibérément : ce qui doit être mesuré — qu'un appel qui
 * ÉCHOUE ne rend jamais la branche du succès — se mesure ici sans navigateur.
 */
export type IssueDepot =
  | {
      readonly issue: "enregistre";
      readonly avertissements: readonly CleTraduction[];
    }
  | { readonly issue: "refuse"; readonly cle: CleTraduction }
  | { readonly issue: "erreur_serveur" }
  | { readonly issue: "connexion_interrompue" };

/**
 * L'ÉCRITURE ELLE-MÊME — POST `.../deplacer`, sous la même garde
 * (`peutDeplacer`/`peutPlanifier`) qu'un dépôt direct ou qu'un « Planifier ».
 *
 * Extraite de `Posable.deposer` (PG-B3-TROUVER-CRENEAU-FICHE) pour que la
 * fenêtre ouverte depuis la fiche (`components/interventions/trouver-creneau.tsx`)
 * appelle la MÊME route par la MÊME fonction — jamais une seconde écriture du
 * même geste (§9, 01/09). Fonction pure côté appelant : elle ne décide rien de
 * ce qu'il faut afficher, elle rend l'issue et rien de plus.
 */
/**
 * LE CORPS DU FORMULAIRE — extrait de `posterDeplacement` (PG-B5) pour que
 * `envoyerImmediatement` (le repli `pagehide` d'un déplacement DIFFÉRÉ, voir
 * `Posable`) construise EXACTEMENT le même corps qu'un dépôt normal : deux
 * constructions d'un même formulaire divergeraient en silence (§9, 01/09).
 */
function construireFormulaireDeplacement(
  main: EnMain,
  cible: CibleDeDepot,
): FormData {
  const corps = new FormData();
  corps.set("date_planifiee", cible.jour);
  if (cible.technicienId !== null) {
    corps.set("technicien_id", cible.technicienId);
  }
  if (cible.minutes !== null) {
    // DEUX GESTES, UNE SEULE ROUTE (L3-01b) — voir le docblock d'origine sur
    // `deposer` : déplacer conserve la durée, redimensionner change la fin.
    const redimensionne = main.bord === "fin" && main.debutMinutes !== null;
    const debut = redimensionne ? main.debutMinutes! : cible.minutes;
    const duree = redimensionne
      ? cible.minutes + cible.pasMinutes - main.debutMinutes!
      : main.dureeMin;
    corps.set("heure_debut", String(debut));
    // UNE DURÉE INCONNUE NE PART PAS EN `0` (PG-A3a) : voir le docblock
    // d'origine — le champ est ABSENT plutôt qu'un zéro inventé.
    if (duree !== null) {
      corps.set("duree_min", String(duree));
    }
  } else if (main.debutMinutes !== null && main.dureeMin !== null) {
    // VUE SEMAINE : UN DÉPLACEMENT GARDE L'HEURE ET LA DURÉE (PG-A7) — voir
    // le docblock d'origine.
    corps.set("heure_debut", String(main.debutMinutes));
    corps.set("duree_min", String(main.dureeMin));
  }
  return corps;
}

export async function posterDeplacement(
  main: EnMain,
  cible: CibleDeDepot,
): Promise<IssueDepot> {
  const corps = construireFormulaireDeplacement(main, cible);
  try {
    const reponse = await fetch(`/api/interventions/${main.id}/deplacer`, {
      method: "POST",
      body: corps,
      headers: { accept: "application/json" },
    });
    const rendu: unknown = await reponse.json().catch(() => null);
    return interpreterReponseDepot({ ok: reponse.ok, corps: rendu });
  } catch {
    // Le `fetch` a REJETÉ — coupure réseau, délai dépassé, requête annulée.
    return { issue: "connexion_interrompue" };
  }
}

/**
 * LE REPLI DE FERMETURE (PG-B5) — appelé depuis `pagehide` pour qu'un
 * déplacement DIFFÉRÉ encore en attente ne soit jamais perdu si l'onglet se
 * ferme ou navigue ailleurs avant l'échéance. Aucune réponse n'est lue : la
 * page est en train de partir, et `posterDeplacement` (qui attend un
 * `fetch` ordinaire) n'aurait pas le temps de la lire non plus.
 * `navigator.sendBeacon` survit à la fermeture ; `fetch(..., { keepalive:
 * true })` est le repli des navigateurs qui ne le portent pas.
 */
function envoyerImmediatement(main: EnMain, cible: CibleDeDepot): void {
  const corps = construireFormulaireDeplacement(main, cible);
  const url = `/api/interventions/${main.id}/deplacer`;
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.sendBeacon === "function" &&
    navigator.sendBeacon(url, corps)
  ) {
    return;
  }
  void fetch(url, {
    method: "POST",
    body: corps,
    keepalive: true,
    headers: { accept: "application/json" },
  }).catch(() => {});
}

/**
 * LE NOM AFFICHÉ SUR LE BANDEAU D'UN DÉPLACEMENT DIFFÉRÉ (PG-B5) — les
 * `techniciens` du périmètre, jamais l'annuaire complet (`quiTravaille`,
 * `lib/interventions/personnes.ts`) : celui-ci lit une base que ce composant
 * client n'a pas, et cette case ne connaît que la liste déjà en props.
 */
function nomTechnicienPourBandeau(
  technicienId: string | null,
  techniciens: readonly { readonly id: string; readonly nom: string }[],
): string {
  if (technicienId === null) {
    return t("planning.deplacement.non_affecte");
  }
  return (
    techniciens.find((technicien) => technicien.id === technicienId)?.nom ??
    t("planning.deplacement.non_affecte")
  );
}

/**
 * LE TEXTE DU BANDEAU — « Déplacée — <technicien>, <jour> à <heure> »,
 * composé UNE FOIS au dépôt (voir `DeplacementEnAttente`). L'heure vient de
 * `cible.minutes` (vue Jour) ou, à défaut, de `main.debutMinutes` (vue
 * Semaine, qui CONSERVE l'heure — PG-A7) : `null` seulement si ni l'une ni
 * l'autre n'en connaît une.
 */
function libelleDeplacementDiffere(
  main: EnMain,
  cible: CibleDeDepot,
  techniciens: readonly { readonly id: string; readonly nom: string }[],
): string {
  const minutes = cible.minutes ?? main.debutMinutes;
  const jourTexte = dateCivile(new Date(`${cible.jour}T00:00:00.000Z`));
  return (
    t("planning.deplacement.en_attente") +
    t("ponctuation.separateur") +
    nomTechnicienPourBandeau(cible.technicienId, techniciens) +
    t("ponctuation.virgule") +
    jourTexte +
    (minutes === null ? "" : t("ponctuation.a") + formatteMinutes(minutes))
  );
}

export function interpreterReponseDepot(
  resultat: { readonly ok: boolean; readonly corps: unknown } | null,
): IssueDepot {
  if (resultat === null) {
    // Le `fetch` a lui-même échoué : rien n'a jamais atteint le serveur, ou sa
    // réponse n'est jamais revenue. On ne sait pas si le geste a été appliqué
    // — regarder ailleurs qu'à l'écran, pas réessayer à l'aveugle.
    return { issue: "connexion_interrompue" };
  }
  if (!resultat.ok) {
    // Le serveur A répondu, et son code dit l'échec. Un appel qui échoue à ce
    // niveau peut se rejouer : rien ne dit qu'il ait été appliqué.
    return { issue: "erreur_serveur" };
  }
  const { corps } = resultat;
  if (corps === null || typeof corps !== "object" || !("cle" in corps)) {
    // Un « succès » HTTP dont le corps est vide, illisible, ou ne porte pas la
    // forme que la route rend TOUJOURS (`{accepte, cle, avertissements}`)
    // n'est pas un succès : c'est un serveur qui n'a pas pu dire ce qu'il a
    // fait. Le prendre pour un succès serait exactement le défaut mesuré.
    return { issue: "erreur_serveur" };
  }
  const cleBrute = corps.cle;
  if (cleBrute !== null) {
    return {
      issue: "refuse",
      cle:
        typeof cleBrute === "string" && estCleTraduction(cleBrute)
          ? cleBrute
          : "intervention.refus.inconnue",
    };
  }
  return { issue: "enregistre", avertissements: clesLues(corps) };
}

const Contexte = createContext<Depot | null>(null);

function useDepot(): Depot {
  const depot = useContext(Contexte);
  if (depot === null) {
    throw new Error(
      "Un bloc ou une case de dépôt est rendu hors de `<Posable>` : le " +
        "planning n'aurait alors aucun moyen d'écrire ce qu'on y dépose.",
    );
  }
  return depot;
}

/**
 * Le cadre : il tient l'intervention en cours de glissé, poste le déplacement,
 * et affiche le refus.
 */
export function Posable({
  techniciens,
  aujourdhui,
  children,
}: Readonly<{
  /** Les techniciens du périmètre, triés par nom — pour le sélecteur du bouton « Poser ». */
  techniciens: readonly { readonly id: string; readonly nom: string }[];
  /** Le jour du jour, `AAAA-MM-JJ`, dans le fuseau de la société — défaut du bouton « Poser ». */
  aujourdhui: string;
  children: React.ReactNode;
}>) {
  const [motif, setMotif] = useState<CleTraduction | null>(null);
  const [poseOuverte, setPoseOuverte] = useState<DemandeDOuverture | null>(
    null,
  );
  const [carteEnGlisse, setCarteEnGlisse] = useState<CarteSurvolee | null>(
    null,
  );
  const [survolAnnonce, setSurvolAnnonce] = useState<EtatDeSurvol | null>(null);
  const commencerGlisse = useCallback(
    (carte: CarteSurvolee) => setCarteEnGlisse(carte),
    [],
  );
  const terminerGlisse = useCallback(() => {
    setCarteEnGlisse(null);
    setSurvolAnnonce(null);
  }, []);

  /**
   * LES DÉPÔTS EN VOL, PAR INTERVENTION (D-06, 17/09/2026).
   *
   * *Un geste répété ne pose pas deux fois* : relâcher deux fois le même bloc
   * pendant que la première demande vole enverrait deux requêtes concurrentes
   * dont l'ordre de retour n'est pas garanti — la seconde pourrait revenir
   * avant la première et se faire écraser par elle. Une `Ref`, pas un état :
   * ce qui s'affiche ne dépend jamais de cet ensemble, seul le TRAITEMENT du
   * dépôt en dépend, et un état qui ne sert à rien d'afficher n'a rien à faire
   * dans un rendu.
   */
  const enVol = useRef<Set<string>>(new Set());

  const ecrire = useCallback((main: EnMain, cible: CibleDeDepot) => {
    if (enVol.current.has(main.id)) {
      return;
    }
    enVol.current.add(main.id);
    void (async () => {
      // L'ÉCRITURE ELLE-MÊME vit dans `posterDeplacement` (PG-B3), partagée
      // avec `components/interventions/trouver-creneau.tsx` — même route,
      // même garde, jamais une seconde écriture du même geste.
      const issue = await posterDeplacement(main, cible);
      enVol.current.delete(main.id);
      switch (issue.issue) {
        case "enregistre":
          // LA BASE A ACCEPTÉ : L'ÉCRAN SE RELIT DU SERVEUR, PAR UN
          // RECHARGEMENT COMPLET plutôt que par `router.refresh()` — voir
          // la mesure du 17/09/2026 en tête de ce fichier. Un rechargement
          // détruit cet état React dans le même geste : nul besoin
          // d'effacer `motif` à la main.
          //
          // Les AVERTISSEMENTS voyagent dans l'URL de la page rechargée,
          // jamais dans un état qu'un rechargement effacerait avant qu'on
          // le lise — `app/(back-office)/planning/page.tsx` les lit et les
          // affiche, avec le même filtre sur les clés connues (L1-02f).
          window.location.assign(urlDeRechargement(issue.avertissements));
          return;
        case "refuse":
          setMotif(issue.cle);
          return;
        case "erreur_serveur":
        case "connexion_interrompue":
          setMotif(`intervention.refus.${issue.issue}`);
          return;
      }
    })();
  }, []);

  /**
   * LES DÉPLACEMENTS DIRECTS EN ATTENTE (PG-B5-ANNULER-DEPLACEMENT) — la
   * MINUTERIE de chaque déplacement, jamais affichée, vit dans une `Ref`
   * (même raison que `enVol` ci-dessus) ; ce qui S'AFFICHE (le bandeau, quelle
   * carte s'efface) vit dans l'état `enAttente`, seul lu par `BlocPosable` et
   * `CasePosable` via le contexte.
   */
  const minuteriesEnAttente = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());
  const [enAttente, setEnAttente] = useState<
    ReadonlyMap<string, DeplacementEnAttente>
  >(new Map());
  // MIROIR DE `enAttente`, LU PAR LE REPLI `pagehide` CI-DESSOUS — cet effet
  // n'est enregistré QU'UNE FOIS (voir plus bas) ; sans ce miroir, sa
  // fermeture capturerait la Map VIDE du tout premier rendu, jamais celle
  // d'un déplacement posé depuis (§9, 01/09 — une lecture figée divergerait
  // en silence de l'état réel).
  const enAttenteRef = useRef(enAttente);
  useEffect(() => {
    enAttenteRef.current = enAttente;
  }, [enAttente]);

  const annulerDeplacement = useCallback((id: string) => {
    const minuterie = minuteriesEnAttente.current.get(id);
    if (minuterie === undefined) {
      // L'échéance est déjà passée entre le clic et cet appel (rarissime, vu
      // le délai), ou l'`id` est inconnu : rien à annuler, rien à effacer.
      return;
    }
    clearTimeout(minuterie);
    minuteriesEnAttente.current.delete(id);
    setEnAttente((precedent) => {
      const suivant = new Map(precedent);
      suivant.delete(id);
      return suivant;
    });
  }, []);

  const deposer = useCallback(
    (main: EnMain, cible: CibleDeDepot) => {
      // LE REDIMENSIONNEMENT (bord "fin") NE CHANGE NI LA DATE NI L'HEURE DE
      // DÉBUT — `avertirApresPlanification` (`lib/avertissements/planification.ts`)
      // ne compare que ces deux-là (et le technicien) pour décider d'un
      // courriel : un redimensionnement seul n'en envoie jamais, donc rien
      // ne justifie d'en retarder l'écriture (PG-B5, § « LE CONSTAT »).
      if (main.bord === "fin") {
        ecrire(main, cible);
        return;
      }
      // UN DÉPLACEMENT DIRECT D'UNE CARTE DÉJÀ PLANIFIÉE (PG-B5-ANNULER-DEPLACEMENT,
      // décision QG-6 d'Alexis du 27/09/2026, délai fixé par lui) : différé
      // `DELAI_DEPLACEMENT_DIFFERE_MS`, pour qu'un « Annuler » n'envoie jamais
      // un SECOND courriel derrière celui du premier déplacement accepté (voir
      // l'entête du fichier). `main.depuisFile` est ici TOUJOURS `false` :
      // `CasePosable.onDrop` n'appelle `deposer` qu'après avoir écarté ce cas,
      // qu'il route vers `ouvrirPose` (`FenetrePose`) — et `FenetrePose`
      // confirme par `ecrire` directement, jamais par cette fonction-ci (voir
      // son `onConfirmer` plus bas) : son « Planifier » reste immédiat.
      //
      // Un second dépôt de LA MÊME carte pendant le délai REMPLACE le
      // précédent (nouvelle cible, minuterie relancée) plutôt que d'empiler
      // deux écritures futures pour un seul geste.
      const minuterieExistante = minuteriesEnAttente.current.get(main.id);
      if (minuterieExistante !== undefined) {
        clearTimeout(minuterieExistante);
      }
      const minuterie = setTimeout(() => {
        minuteriesEnAttente.current.delete(main.id);
        setEnAttente((precedent) => {
          const suivant = new Map(precedent);
          suivant.delete(main.id);
          return suivant;
        });
        ecrire(main, cible);
      }, DELAI_DEPLACEMENT_DIFFERE_MS);
      minuteriesEnAttente.current.set(main.id, minuterie);
      setEnAttente((precedent) =>
        new Map(precedent).set(main.id, {
          main,
          cible,
          libelle: libelleDeplacementDiffere(main, cible, techniciens),
        }),
      );
    },
    [ecrire, techniciens],
  );

  /**
   * LA PAGE SE FERME OU NAVIGUE PENDANT LE DÉLAI (PG-B5) — un déplacement
   * ACCEPTÉ n'est jamais perdu : `pagehide` se déclenche aussi bien pour un
   * onglet fermé qu'une navigation ailleurs, et c'est le SEUL évènement fiable
   * à ce moment-là (`beforeunload` ne l'est pas sur mobile). Enregistré UNE
   * SEULE FOIS : cette fonction lit `enAttenteRef.current`, jamais `enAttente`
   * directement, pour ne jamais fermer sur un instantané périmé.
   */
  useEffect(() => {
    function surFermeture() {
      for (const [id, deplacement] of enAttenteRef.current) {
        const minuterie = minuteriesEnAttente.current.get(id);
        if (minuterie !== undefined) {
          clearTimeout(minuterie);
        }
        envoyerImmediatement(deplacement.main, deplacement.cible);
      }
      minuteriesEnAttente.current.clear();
    }
    window.addEventListener("pagehide", surFermeture);
    return () => window.removeEventListener("pagehide", surFermeture);
  }, []);

  const ouvrirPose = useCallback(
    (demande: DemandeDOuverture) => {
      setPoseOuverte({
        ...demande,
        jourInitial: demande.jourInitial ?? aujourdhui,
      });
    },
    [aujourdhui],
  );

  return (
    <Contexte.Provider
      value={{
        deposer,
        ouvrirPose,
        carteEnGlisse,
        commencerGlisse,
        terminerGlisse,
        signalerSurvol: setSurvolAnnonce,
        enAttente,
        annulerDeplacement,
      }}
    >
      {motif === null ? null : (
        <p
          // `role="alert"` pour le lecteur d'écran, `data-refus` pour les
          // scénarios : Next rend lui-même un annonceur de route portant
          // `role="alert"`, et viser le rôle seul viserait deux éléments.
          data-refus={motif}
          role="alert"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-13"
        >
          {t(motif)}
        </p>
      )}
      {/*
        UNE SEULE RÉGION `aria-live` POUR TOUTES LES CASES (PG-B4) — jamais
        une par case : deux régions qui s'annoncent au même instant se
        chevaucheraient pour un lecteur d'écran, et laquelle a bougé le
        curseur en dernier ne se devine pas depuis le DOM seul.
      */}
      <p aria-live="polite" className="sr-only">
        {survolAnnonce !== null && !survolAnnonce.possible
          ? libelleMotifSurvol(survolAnnonce.motif)
          : ""}
      </p>
      {poseOuverte === null ? null : (
        <FenetrePose
          interventionId={poseOuverte.interventionId}
          libelle={poseOuverte.libelle}
          dureeMinInitiale={poseOuverte.dureeMinInitiale}
          technicienIdInitial={poseOuverte.technicienIdInitial}
          // `jourInitial` est toujours résolu par `ouvrirPose` ci-dessus.
          jour={poseOuverte.jourInitial as string}
          fuseau={poseOuverte.fuseau}
          techniciens={techniciens}
          onFermer={() => setPoseOuverte(null)}
          // ÉCRITURE IMMÉDIATE, JAMAIS `deposer` (PG-B5) : « Planifier »
          // vient de confirmer un geste explicite — voir l'entête de
          // `deposer` ci-dessus, dont ce `main` (`depuisFile: false`,
          // `bord: "bloc"`) serait autrement indiscernable d'un glisser-
          // déposer direct.
          onConfirmer={ecrire}
        />
      )}
      {children}
    </Contexte.Provider>
  );
}

/**
 * LA CLÉ DE PARAMÈTRE — un nom, écrit une fois, lu par `deposer` ET par la
 * page qui affiche les avertissements. Deux lectures d'un même nom qui
 * diverge en silence en changerait une sans l'autre (§9, 01/09).
 */
export const PARAMETRE_AVERTISSEMENT = "avertissement";

/**
 * L'URL DE RECHARGEMENT — la page courante, ses paramètres existants
 * conservés (`vue`, `jour`, `semaine`), plus un `avertissement` par clé.
 *
 * *Un `avertissement` déjà présent dans l'URL est retiré d'abord* : sans
 * cela, un second dépôt accepté à la suite du premier accumulerait les clés
 * du premier rechargement, jamais purgées puisqu'un rechargement démarre
 * d'une URL qui les porte encore.
 *
 * EXPORTÉE (9BW-AVERT-POSE-FICHE) — `components/interventions/trouver-creneau.tsx`
 * l'utilise aussi, pour que « Trouver un créneau » depuis la FICHE affiche les
 * avertissements et efface un vieux `motif`/`avertissement` de la même façon
 * que le planning, sans en tenir une seconde écriture (§9, 01/09).
 */
export function urlDeRechargement(
  avertissements: readonly CleTraduction[],
): string {
  const url = new URL(window.location.href);
  url.searchParams.delete(PARAMETRE_AVERTISSEMENT);
  // `motif` AUSSI (revue Codex de la PR #267, 20/09/2026) : c'est le
  // paramètre que `/planning` lit pour le bandeau ROUGE d'un refus de
  // création (chantier CRÉA-1). Sans ce retrait, un refus affiché puis un
  // dépôt ACCEPTÉ rechargeait la page avec `motif` encore dans l'URL
  // courante — le bandeau rouge d'un refus déjà vu restait affiché à côté
  // d'un dépôt qui, lui, vient de réussir.
  url.searchParams.delete("motif");
  for (const cle of avertissements) {
    url.searchParams.append(PARAMETRE_AVERTISSEMENT, cle);
  }
  return url.toString();
}

/**
 * UN BLOC QU'ON PEUT PRENDRE.
 *
 * `draggable` et rien de plus : aucune bibliothèque. *Ajouter une dépendance
 * est une décision, pas un réflexe* — le glisser-déposer natif du navigateur
 * fait exactement ce que la maquette décrit.
 *
 * **Cette phrase disait « Schedule-X viendra au lot 3 avec le redimensionnement,
 * qui lui n'est pas natif ». Elle est fausse des deux moitiés** *(mesuré le
 * 11/09/2026, L3-01b)* : le redimensionnement se fait avec le même `draggable`
 * que le déplacement — une poignée qui engage son propre glissé —, et il est
 * livré. Ce que L3-01 réclamait de Schedule-X, le planning le faisait déjà ;
 * l'adopter aujourd'hui serait une RÉÉCRITURE, pas une installation, et c'est
 * un arbitrage porté au registre plutôt qu'une décision de ticket (§2, D17).
 */
export function BlocPosable({
  interventionId,
  dureeMin,
  debutMinutes,
  avecRedimensionnement = true,
  depuisFile = false,
  libelle = null,
  fuseau = null,
  className,
  children,
}: Readonly<{
  interventionId: string;
  /** Conservée au déplacement. Voir `deposer`. `null` si elle est inconnue. */
  dureeMin: number | null;
  /**
   * Minutes locales du début, quand la carte en connaît une — SERT À DEUX
   * CHOSES DISTINCTES : poser la poignée de redimensionnement (vue Jour), et
   * CONSERVER l'heure au déplacement en vue Semaine (PG-A7, 28/09/2026), où
   * elle voyage sans jamais poser de poignée. `avecRedimensionnement` sépare
   * les deux : la valeur part toujours dans le glissé, la poignée non.
   */
  debutMinutes?: number | null;
  /**
   * `false` en vue Semaine (PG-A7) : redimensionner n'a de sens que là où une
   * case connaît des MINUTES (vue Jour) — `cible.minutes` y est toujours
   * `null`, et calculer une fin de redimensionnement dessus n'aurait aucun
   * sens. Ne retire QUE la poignée ; `debutMinutes` continue de voyager pour
   * conserver l'heure au déplacement.
   */
  avecRedimensionnement?: boolean;
  /** `true` pour une carte de la file « À planifier » (PG-B2). Voir `EnMain.depuisFile`. */
  depuisFile?: boolean;
  /** Le titre de `FenetrePose`, requis quand `depuisFile` est vrai. */
  libelle?: string | null;
  /** Le fuseau de l'agence de l'intervention, requis quand `depuisFile` est vrai. */
  fuseau?: string | null;
  className?: string;
  children: React.ReactNode;
}>) {
  const { commencerGlisse, terminerGlisse, enAttente } = useDepot();

  if (enAttente.has(interventionId)) {
    // LA CARTE EST EN DÉPLACEMENT DIFFÉRÉ (PG-B5-ANNULER-DEPLACEMENT) : elle
    // ne s'affiche plus à son ANCIENNE case tant que l'écriture n'a pas eu
    // lieu — seul le bandeau de la case VISÉE la montre, avec « Annuler »
    // (`CasePosable`, plus bas). L'effacer ici plutôt que la ternir
    // évite qu'une même intervention semble exister à deux endroits.
    return null;
  }

  const engager = (bord: "bloc" | "fin") => (evenement: React.DragEvent) => {
    evenement.dataTransfer.setData(
      FORMAT,
      JSON.stringify({
        id: interventionId,
        dureeMin,
        bord,
        debutMinutes: debutMinutes ?? null,
        depuisFile,
        libelle,
        fuseau,
      }),
    );
    // `text/plain` en plus : certains navigateurs n'engagent pas un glissé
    // dont aucun format standard n'est renseigné.
    evenement.dataTransfer.setData("text/plain", interventionId);
    evenement.dataTransfer.effectAllowed = "move";
    // POUR LE SURVOL (PG-B4) — voir l'entête de `Depot.carteEnGlisse` :
    // `dataTransfer` ne se relit pas à `dragover`, donc la carte voyage par
    // ce state, posé ICI où ses props sont déjà en main.
    commencerGlisse({ interventionId, dureeMin });
  };

  return (
    <div
      data-bloc={interventionId}
      draggable
      onDragStart={engager("bloc")}
      onDragEnd={terminerGlisse}
      className={`relative cursor-grab active:cursor-grabbing ${className ?? ""}`}
    >
      {children}
      {/*
        LA POIGNÉE DE REDIMENSIONNEMENT (L3-01b).

        **Sur le BORD DROIT depuis la frise (QG-3/D142, 30/09/2026)** — elle
        vivait sur le bord BAS quand l'axe des heures était vertical (les
        heures en lignes) ; l'axe est désormais horizontal (les heures en
        colonnes), et c'est la fin du bloc, jamais son bas, qui se tire.
        `cursor-ew-resize` avec elle : un curseur qui pointe encore de haut en
        bas décrirait un geste que le doigt ne fait plus. Le CALCUL de la durée
        (`construireFormulaireDeplacement`) est INCHANGÉ — seule l'orientation
        visuelle bouge, jamais la case visée ni la règle qui la juge.

        *Elle n'est pas la seule voie, et ce n'est pas la principale* : le
        formulaire « Déplacer » de la fiche porte déjà un champ de durée, et il
        est atteignable à la tabulation. Celle-ci est un raccourci à la souris,
        `aria-hidden` pour cette raison — l'annoncer à un lecteur d'écran
        promettrait un geste qu'aucun clavier ne peut faire.

        `stopPropagation` au démarrage : sans lui, le bloc entier engagerait un
        déplacement par-dessus le redimensionnement, et le dernier appelé
        gagnerait — *un geste qui dépend de l'ordre des gestionnaires est une
        décision prise par personne.*
      */}
      {!avecRedimensionnement ||
      debutMinutes === null ||
      debutMinutes === undefined ? null : (
        <span
          data-poignee={interventionId}
          draggable
          aria-hidden="true"
          onDragStart={(evenement) => {
            // **C'est CETTE ligne qui fait le redimensionnement**, et elle est
            // éprouvée par son jumeau : retirée, le scénario 5 tombe (mesuré le
            // 11/09/2026). Sans elle, le `dragstart` remonte au bloc, dont le
            // gestionnaire réécrit la charge avec `bord: "bloc"` — le glissé
            // part quand même, l'intervention se DÉPLACE au lieu de s'allonger,
            // et rien ne le dit : ni erreur, ni refus.
            evenement.stopPropagation();
            engager("fin")(evenement);
          }}
          className="absolute inset-y-0 right-0 w-2 cursor-ew-resize"
        />
      )}
    </div>
  );
}

/**
 * LE RACCOURCI CLAVIER ET TÉLÉPHONE DE `FenetrePose` (PG-B2-FENETRE-POSE).
 *
 * *Une fonction qui n'existe qu'au glissé exclut le clavier et le tactile*
 * (même principe que la poignée de redimensionnement, plus haut) : ce bouton
 * ouvre EXACTEMENT la même fenêtre qu'un dépôt, sans jour ni technicien
 * pré-remplis — `Posable.ouvrirPose` leur donne alors le jour du jour et le
 * premier technicien de la liste.
 */
export function BoutonPoser({
  interventionId,
  dureeMin,
  libelle,
  fuseau,
}: Readonly<{
  interventionId: string;
  dureeMin: number | null;
  libelle: string;
  fuseau: string;
}>) {
  const { ouvrirPose } = useDepot();
  return (
    <button
      type="button"
      onClick={() =>
        ouvrirPose({
          interventionId,
          libelle,
          dureeMinInitiale: dureeMin,
          technicienIdInitial: null,
          jourInitial: null,
          fuseau,
        })
      }
      className="border-app-bord text-app-encre-faible hover:bg-app-fond min-h-11 rounded-md border px-2.5 text-12 font-semibold sm:min-h-0 sm:py-1"
    >
      {t("planning.pose.bouton_poser")}
    </button>
  );
}

/** UNE CASE QUI ACCEPTE UN DÉPÔT. */
export function CasePosable({
  cible,
  className,
  style,
  etat,
  children,
}: Readonly<{
  cible: CibleDeDepot;
  className?: string;
  style?: React.CSSProperties;
  /**
   * `data-etat` FACULTATIF (QG-3/D142, 30/09/2026) — la frise dessine chaque
   * intervention UNE SEULE FOIS, en largeur (`blocsDeLaLigne`), et les cases
   * qu'elle couvre au-delà de la première ne portent plus de lien répété :
   * une épreuve qui comptait les cases « occupées » par la présence d'un `<a>`
   * ne peut plus le faire (`blocage-agenda-visible.spec.ts`). `undefined` ne
   * pose aucun attribut — la vue Semaine, qui ne le fournit pas, est
   * inchangée.
   */
  etat?: string;
  children: React.ReactNode;
}>) {
  const {
    deposer,
    ouvrirPose,
    carteEnGlisse,
    signalerSurvol,
    enAttente,
    annulerDeplacement,
  } = useDepot();
  const [etatSurvol, setEtatSurvol] = useState<EtatDeSurvol | null>(null);
  // CETTE CASE EST-ELLE LA CIBLE D'UN DÉPLACEMENT DIFFÉRÉ (PG-B5) ? — comparée
  // sur les trois champs qui identifient une case (`jour`, `technicienId`,
  // `minutes`), jamais sur l'identité de l'objet `cible` : celui-ci est
  // reconstruit à chaque rendu par `VueSemaine`/`VueJour`.
  const deplacementVise = deplacementViseParCetteCase(enAttente, cible);
  return (
    <td
      data-depot-jour={cible.jour}
      data-depot-technicien={cible.technicienId ?? ""}
      {...(cible.minutes === null ? {} : { "data-depot-heure": cible.minutes })}
      {...(etat === undefined ? {} : { "data-etat": etat })}
      {...(etatSurvol === null
        ? {}
        : {
            "data-survol": etatSurvol.possible ? "possible" : etatSurvol.motif,
          })}
      onDragOver={(evenement) => {
        // Sans `preventDefault`, le navigateur refuse le dépôt : c'est ce qui
        // distingue une case qui accepte d'une case qui regarde passer.
        evenement.preventDefault();
        evenement.dataTransfer.dropEffect = "move";
        // PG-B4-SURVOL-CASES — un INDICE tiré des données déjà chargées,
        // jamais une requête ; voir `lib/interventions/survol.ts`. Recalculé
        // à chaque `dragover` : React ne réémet l'état QUE s'il change (même
        // motif -> même référence de rendu), donc aucun coût observable à le
        // reposer à chaque pixel survolé.
        const etat =
          carteEnGlisse === null
            ? null
            : etatDeLaCase(carteEnGlisse, cible.survol, {
                // Les habilitations d'un site ne sont pas chargées par la
                // page du planning aujourd'hui — voir le docblock de
                // `etatDeLaCase` : un DONT-KNOW n'invente pas de refus.
                habilitationManquante: null,
              });
        setEtatSurvol(etat);
        signalerSurvol(etat);
      }}
      onDragLeave={() => {
        setEtatSurvol(null);
        signalerSurvol(null);
      }}
      onDrop={(evenement) => {
        evenement.preventDefault();
        setEtatSurvol(null);
        signalerSurvol(null);
        const main = lireLaMain(evenement.dataTransfer);
        if (main === null) {
          return;
        }
        if (main.depuisFile) {
          // UNE CARTE DE LA FILE N'ÉCRIT JAMAIS DIRECTEMENT (PG-B2) : la case
          // ne connaît qu'un jour et un technicien, jamais une heure sûre —
          // `FenetrePose` les complète avant d'appeler la même route.
          //
          // Sans fuseau lisible, le glissé n'est pas celui de `BlocPosable`
          // (qui le fournit toujours pour une carte de la file) : un contenu
          // illisible n'écrit rien, même famille que `lireLaMain` plus bas.
          if (main.fuseau !== null) {
            ouvrirPose({
              interventionId: main.id,
              libelle: main.libelle ?? "",
              dureeMinInitiale: main.dureeMin,
              technicienIdInitial: cible.technicienId,
              jourInitial: cible.jour,
              fuseau: main.fuseau,
            });
          }
          return;
        }
        deposer(main, cible);
      }}
      className={`relative ${className ?? ""} ${classeDeSurvol(etatSurvol)}`}
      style={style}
    >
      {children}
      {deplacementVise === null ? null : (
        <BandeauDeplacementDiffere
          id={deplacementVise[0]}
          libelle={deplacementVise[1].libelle}
          onAnnuler={() => annulerDeplacement(deplacementVise[0])}
        />
      )}
      {etatSurvol === null || etatSurvol.possible ? null : (
        // LE MOTIF EN CLAIR, PAS SEULEMENT LA COULEUR (accessibilité, PG-B4)
        // — `aria-hidden` : la même information est déjà ANNONCÉE par
        // l'unique région `aria-live` de `Posable`, l'annoncer deux fois
        // ferait entendre deux fois la même phrase à un lecteur d'écran.
        <span
          aria-hidden="true"
          className="bg-app-rouge-fond text-app-rouge-encre pointer-events-none absolute inset-x-0.5 bottom-0.5 z-10 truncate rounded px-1 text-12 font-semibold"
        >
          {libelleMotifSurvol(etatSurvol.motif)}
        </span>
      )}
    </td>
  );
}

/**
 * LA CASE VISÉE PAR UN DÉPLACEMENT DIFFÉRÉ (PG-B5) — comparée sur `jour`,
 * `technicienId` et `minutes`, les trois champs qui identifient une case sans
 * ambiguïté (`data-depot-*` porte déjà exactement ces trois-là). `null` si
 * aucune entrée d'`enAttente` ne vise CETTE case.
 */
function deplacementViseParCetteCase(
  enAttente: ReadonlyMap<string, DeplacementEnAttente>,
  cible: CibleDeDepot,
): readonly [string, DeplacementEnAttente] | null {
  for (const entree of enAttente) {
    const [, deplacement] = entree;
    if (
      deplacement.cible.jour === cible.jour &&
      deplacement.cible.technicienId === cible.technicienId &&
      deplacement.cible.minutes === cible.minutes
    ) {
      return entree;
    }
  }
  return null;
}

/**
 * LE BANDEAU D'UN DÉPLACEMENT DIFFÉRÉ (PG-B5) — « Déplacée — <technicien>,
 * <jour> à <heure> · Annuler », posé sur la case VISÉE, jamais l'ancienne
 * (qui s'efface, voir `BlocPosable`). Le ton `avertissement` (existant,
 * jamais une couleur neuve — même règle que `classeDeSurvol`) signale un
 * état réversible, pas encore écrit.
 */
function BandeauDeplacementDiffere({
  id,
  libelle,
  onAnnuler,
}: Readonly<{
  id: string;
  libelle: string;
  onAnnuler: () => void;
}>) {
  return (
    <p
      data-deplacement-en-attente={id}
      className={`pointer-events-none absolute inset-0.5 z-20 flex items-center justify-center gap-1 truncate rounded border px-1 text-center text-12 font-semibold ${CLASSES_TON.avertissement}`}
    >
      <span className="truncate">{libelle}</span>
      {t("ponctuation.point_median")}
      <button
        type="button"
        data-annuler-deplacement={id}
        onClick={onAnnuler}
        className="pointer-events-auto underline"
      >
        {t("planning.pose.annuler")}
      </button>
    </p>
  );
}

/**
 * LE MOTIF EN CLAIR — « Agence » vient de `mot("agence")`, jamais écrit en
 * dur (vocabulaire imposé, §9) : c'est le seul des quatre motifs qui porte
 * ce mot.
 */
function libelleMotifSurvol(motif: MotifRefusSurvol): string {
  if (motif === "agence_fermee") {
    return `${mot("agence")} ${t("planning.survol.agence_fermee_suffixe")}`;
  }
  return t(`planning.survol.${motif}`);
}

/** Les jetons EXISTANTS de la palette — succès, refus — jamais une couleur neuve (PG-B4). */
function classeDeSurvol(etat: EtatDeSurvol | null): string {
  if (etat === null) {
    return "";
  }
  return etat.possible
    ? "outline-app-vert-bord outline-2 -outline-offset-2"
    : "outline-app-rouge-bord outline-2 -outline-offset-2";
}

/**
 * LES CLÉS D'AVERTISSEMENT D'UNE RÉPONSE — et rien d'autre qu'elle porterait.
 *
 * *Une réponse est une entrée, et une entrée se contrôle.* Tout ce qui n'est
 * pas une clé connue du dictionnaire est **écarté en silence** : afficher une
 * clé inconnue reviendrait à laisser écrire la page par qui forge la réponse,
 * et rendre un refus sur un avertissement transformerait une information en
 * panne.
 */
function clesLues(rendu: unknown): readonly CleTraduction[] {
  if (
    rendu === null ||
    typeof rendu !== "object" ||
    !("avertissements" in rendu) ||
    !Array.isArray(rendu.avertissements)
  ) {
    return [];
  }
  return rendu.avertissements.filter(
    (valeur): valeur is CleTraduction =>
      typeof valeur === "string" && estCleTraduction(valeur),
  );
}

/**
 * Ce que le glissé porte, ou `null` si ce n'est pas un glissé du planning.
 *
 * *Un contenu illisible n'écrit rien.* La forme est vérifiée avant d'être
 * employée : le `dataTransfer` est une entrée, et une entrée se contrôle.
 */
function lireLaMain(donnees: DataTransfer): EnMain | null {
  try {
    const brut: unknown = JSON.parse(donnees.getData(FORMAT));
    if (
      typeof brut === "object" &&
      brut !== null &&
      "id" in brut &&
      typeof brut.id === "string" &&
      "dureeMin" in brut &&
      (typeof brut.dureeMin === "number" || brut.dureeMin === null)
    ) {
      return {
        id: brut.id,
        dureeMin: brut.dureeMin,
        // **Le défaut est le DÉPLACEMENT**, et c'est le sens de défaillance
        // voulu : un glissé dont le bord est illisible déplace sans
        // redimensionner, ce qui conserve la durée. L'inverse inventerait une
        // durée à partir de rien.
        bord:
          "bord" in brut && brut.bord === "fin"
            ? ("fin" as const)
            : ("bloc" as const),
        debutMinutes:
          "debutMinutes" in brut && typeof brut.debutMinutes === "number"
            ? brut.debutMinutes
            : null,
        // **Le défaut est `false`** : un glissé étranger ou antérieur à
        // PG-B2 (sans ce champ) se déplace comme avant, jamais comme une
        // carte de la file qu'on n'a pas demandée.
        depuisFile: "depuisFile" in brut && brut.depuisFile === true,
        libelle:
          "libelle" in brut && typeof brut.libelle === "string"
            ? brut.libelle
            : null,
        fuseau:
          "fuseau" in brut && typeof brut.fuseau === "string"
            ? brut.fuseau
            : null,
      };
    }
    return null;
  } catch {
    return null;
  }
}
