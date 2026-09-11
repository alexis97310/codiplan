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
type EnMain = { readonly id: string; readonly dureeMin: number };

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
        // LA DURÉE EST CONSERVÉE — c'est la règle de la vue jour. Déplacer une
        // intervention n'est pas la redimensionner ; le redimensionnement est
        // au lot 3, avec Schedule-X.
        corps.set("heure_debut", String(cible.minutes));
        corps.set("duree_min", String(main.dureeMin));
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
 * fait exactement ce que la maquette décrit, et Schedule-X viendra au lot 3
 * avec le redimensionnement, qui lui n'est pas natif.
 */
export function BlocPosable({
  interventionId,
  dureeMin,
  className,
  children,
}: Readonly<{
  interventionId: string;
  /** Conservée au déplacement. Voir `deposer`. */
  dureeMin: number;
  className?: string;
  children: React.ReactNode;
}>) {
  return (
    <div
      data-bloc={interventionId}
      draggable
      onDragStart={(evenement) => {
        evenement.dataTransfer.setData(
          FORMAT,
          JSON.stringify({ id: interventionId, dureeMin }),
        );
        // `text/plain` en plus : certains navigateurs n'engagent pas un glissé
        // dont aucun format standard n'est renseigné.
        evenement.dataTransfer.setData("text/plain", interventionId);
        evenement.dataTransfer.effectAllowed = "move";
      }}
      className={`cursor-grab active:cursor-grabbing ${className ?? ""}`}
    >
      {children}
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
      return { id: brut.id, dureeMin: brut.dureeMin };
    }
    return null;
  } catch {
    return null;
  }
}
