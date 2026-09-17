"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

import { estCleTraduction, t, type CleTraduction } from "@/lib/i18n/fr";

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
type EnMain = {
  readonly id: string;
  readonly dureeMin: number;
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
};

/** Le type MIME du glissé. Nommé, pour qu'un glissé étranger ne soit pas lu. */
const FORMAT = "application/x-codiplan-intervention";

type Depot = {
  readonly deposer: (main: EnMain, cible: CibleDeDepot) => void;
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
export function Posable({ children }: Readonly<{ children: React.ReactNode }>) {
  const [motif, setMotif] = useState<CleTraduction | null>(null);

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

  const deposer = useCallback((main: EnMain, cible: CibleDeDepot) => {
    if (enVol.current.has(main.id)) {
      return;
    }
    const corps = new FormData();
    corps.set("date_planifiee", cible.jour);
    if (cible.technicienId !== null) {
      corps.set("technicien_id", cible.technicienId);
    }
    if (cible.minutes !== null) {
      // DEUX GESTES, UNE SEULE ROUTE (L3-01b).
      //
      // **Déplacer** conserve la durée et change le début — *déplacer une
      // intervention n'est pas la redimensionner.* **Redimensionner** garde
      // le début et fait de la case visée la DERNIÈRE occupée : la durée
      // court jusqu'à la fin de ce pas, si bien que relâcher sur la case de
      // départ laisse exactement un pas — jamais zéro.
      const redimensionne = main.bord === "fin" && main.debutMinutes !== null;
      const debut = redimensionne ? main.debutMinutes! : cible.minutes;
      const duree = redimensionne
        ? cible.minutes + cible.pasMinutes - main.debutMinutes!
        : main.dureeMin;
      corps.set("heure_debut", String(debut));
      corps.set("duree_min", String(duree));
    }
    enVol.current.add(main.id);
    void (async () => {
      let issue: IssueDepot;
      try {
        const reponse = await fetch(`/api/interventions/${main.id}/deplacer`, {
          method: "POST",
          body: corps,
          headers: { accept: "application/json" },
        });
        const rendu: unknown = await reponse.json().catch(() => null);
        issue = interpreterReponseDepot({ ok: reponse.ok, corps: rendu });
      } catch {
        // Le `fetch` a REJETÉ — coupure réseau, délai dépassé, requête
        // annulée. Sans ce `catch`, ce rejet partait non intercepté et
        // l'écran restait tel quel : un TROISIÈME silence, que
        // `interpreterReponseDepot` ne peut pas nommer puisqu'il ne reçoit
        // jamais d'appel dans ce cas.
        issue = { issue: "connexion_interrompue" };
      } finally {
        enVol.current.delete(main.id);
      }
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

  return (
    <Contexte.Provider value={{ deposer }}>
      {motif === null ? null : (
        <p
          // `role="alert"` pour le lecteur d'écran, `data-refus` pour les
          // scénarios : Next rend lui-même un annonceur de route portant
          // `role="alert"`, et viser le rôle seul viserait deux éléments.
          data-refus={motif}
          role="alert"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(motif)}
        </p>
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
 */
function urlDeRechargement(avertissements: readonly CleTraduction[]): string {
  const url = new URL(window.location.href);
  url.searchParams.delete(PARAMETRE_AVERTISSEMENT);
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
  className,
  children,
}: Readonly<{
  interventionId: string;
  /** Conservée au déplacement. Voir `deposer`. */
  dureeMin: number;
  /**
   * Minutes locales du début. **Sans elle, pas de poignée** : redimensionner,
   * c'est laisser le début où il est, et on ne laisse pas où il est ce qu'on ne
   * connaît pas. Une vue qui n'a pas d'heure — la file d'attente — n'en passe
   * pas, et la poignée n'apparaît pas.
   */
  debutMinutes?: number | null;
  className?: string;
  children: React.ReactNode;
}>) {
  const engager = (bord: "bloc" | "fin") => (evenement: React.DragEvent) => {
    evenement.dataTransfer.setData(
      FORMAT,
      JSON.stringify({
        id: interventionId,
        dureeMin,
        bord,
        debutMinutes: debutMinutes ?? null,
      }),
    );
    // `text/plain` en plus : certains navigateurs n'engagent pas un glissé
    // dont aucun format standard n'est renseigné.
    evenement.dataTransfer.setData("text/plain", interventionId);
    evenement.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      data-bloc={interventionId}
      draggable
      onDragStart={engager("bloc")}
      className={`relative cursor-grab active:cursor-grabbing ${className ?? ""}`}
    >
      {children}
      {/*
        LA POIGNÉE DE REDIMENSIONNEMENT (L3-01b).

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
      {debutMinutes === null || debutMinutes === undefined ? null : (
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
          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
        />
      )}
    </div>
  );
}

/** UNE CASE QUI ACCEPTE UN DÉPÔT. */
export function CasePosable({
  cible,
  className,
  style,
  children,
}: Readonly<{
  cible: CibleDeDepot;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}>) {
  const { deposer } = useDepot();
  const [survolee, setSurvolee] = useState(false);
  return (
    <td
      data-depot-jour={cible.jour}
      data-depot-technicien={cible.technicienId ?? ""}
      {...(cible.minutes === null ? {} : { "data-depot-heure": cible.minutes })}
      onDragOver={(evenement) => {
        // Sans `preventDefault`, le navigateur refuse le dépôt : c'est ce qui
        // distingue une case qui accepte d'une case qui regarde passer.
        evenement.preventDefault();
        evenement.dataTransfer.dropEffect = "move";
        setSurvolee(true);
      }}
      onDragLeave={() => setSurvolee(false)}
      onDrop={(evenement) => {
        evenement.preventDefault();
        setSurvolee(false);
        const main = lireLaMain(evenement.dataTransfer);
        if (main !== null) {
          deposer(main, cible);
        }
      }}
      className={`${className ?? ""} ${survolee ? "outline-app-marque outline-2 -outline-offset-2" : ""}`}
      style={style}
    >
      {children}
    </td>
  );
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
      typeof brut.dureeMin === "number"
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
      };
    }
    return null;
  } catch {
    return null;
  }
}
