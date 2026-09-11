"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useState } from "react";

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
  const router = useRouter();
  const [motif, setMotif] = useState<CleTraduction | null>(null);

  const deposer = useCallback(
    (main: EnMain, cible: CibleDeDepot) => {
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
      void (async () => {
        const reponse = await fetch(`/api/interventions/${main.id}/deplacer`, {
          method: "POST",
          body: corps,
          headers: { accept: "application/json" },
        });
        const rendu: unknown = await reponse.json().catch(() => null);
        const cle =
          rendu !== null &&
          typeof rendu === "object" &&
          "cle" in rendu &&
          typeof rendu.cle === "string"
            ? rendu.cle
            : null;
        if (cle === null) {
          setMotif(null);
          // La base a accepté : l'écran se relit du SERVEUR, il ne se devine
          // pas. C'est ce qui garantit qu'il ne montre rien de plus.
          router.refresh();
          return;
        }
        setMotif(estCleTraduction(cle) ? cle : "intervention.refus.inconnue");
      })();
    },
    [router],
  );

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
