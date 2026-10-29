/**
 * L'ENVOI DE LA FILE — LE BOUTON « ENVOYER » (9F4H3-HORS-RESEAU-ENVOYER,
 * point 2 ; décision n° 105 d'Alexis : PAS D'ENVOI AUTOMATIQUE).
 *
 * ## L'ORDRE D'ENVOI COMPTE
 *
 * Démarrer → arrêter → rapport/prestations/photos → signature → terminer
 * (addendum pilote, mesuré sur le cycle de vie terrain) : signer puis
 * terminer avant que le rapport ne soit parti ferait accepter un « Terminer »
 * sur un rapport qui n'existe pas encore côté serveur. Cet ordre est un
 * PIPELINE FIXE, jamais l'heure d'enregistrement dans la file — un rapport
 * modifié après l'arrêt du compteur reste envoyé avant la signature, qui
 * reste envoyée avant « terminer », quel que soit l'ordre réel des frappes.
 *
 * ## UNE INTERVENTION À LA FOIS, ARRÊT AU PREMIER REFUS
 *
 * Un refus sur UNE intervention (ex. annulée au bureau pendant la coupure)
 * arrête l'envoi de CETTE intervention — la saisie refusée reste en file
 * avec son motif, les suivantes de la MÊME intervention aussi, intactes —
 * mais n'empêche jamais l'envoi des AUTRES interventions de la file.
 */

import { cleBrouillon } from "./brouillon";
import {
  CLE_MOTIF_FORMAT_INCONNU,
  listerFile,
  marquerRefusee,
  retirerSaisie,
  signalerPrestationsEnvoyees,
  type EntreeFile,
  type Geste,
} from "./file-saisies";

type Identite = { readonly utilisateurId: string; readonly societeId: string };

const ORDRE_PIPELINE: Readonly<Record<Geste["type"], number>> = {
  compteur: 0,
  rapport: 1,
  prestations: 2,
  photo: 3,
  signature: 4,
  terminer: 5,
};

function routeDe(type: Geste["type"]): string {
  return type === "photo" ? "photos" : type;
}

function corpsDe(entree: EntreeFile): FormData {
  const corps = new FormData();
  const geste = entree.geste;
  switch (geste.type) {
    case "compteur":
      corps.set("geste", geste.action);
      corps.set("instant_appareil", entree.instantAppareil);
      corps.set("operation_id", entree.id);
      // ADDENDUM n°1 (9F4H4B) — distingue CE renvoi du tout premier essai EN
      // LIGNE (`compteur-terrain.tsx`), qui envoie la même paire sans ce
      // champ : seul CE geste-ci est « saisi hors réseau ».
      corps.set("depuis_file", "1");
      return corps;
    case "rapport":
      corps.set("commentaire_technicien", geste.commentaire);
      corps.set("suite_a_donner", geste.suite);
      // LE REMPLACEMENT INTÉGRAL (9I7B) — voyage dans la MÊME requête que le
      // commentaire et la suite, jamais une route séparée. `?? []` : un
      // geste construit avant ce ticket ne porte pas ce champ.
      corps.set("pieces_remplacees", JSON.stringify(geste.pieces ?? []));
      return corps;
    case "prestations":
      // `?? []` EN FILET, JAMAIS LA GARDE (9F4H6B-FILE-ANCIEN-FORMAT, point 1)
      // — `gesteReconnu` (`file-saisies.ts`) a déjà migré l'ancien format ou
      // écarté toute forme inconnue avant que cette entrée n'atteigne ici ;
      // ce repli évite seulement qu'un second défaut de validation lève
      // DANS ce `try` sans motif, comme le faisait l'ancien format avant ce
      // correctif.
      for (const id of geste.ajouterIds ?? []) {
        corps.append("ajouter_id", id);
      }
      for (const id of geste.retirerIds ?? []) {
        corps.append("retirer_id", id);
      }
      // ADDENDUM (9F4H6A) — voir le même commentaire sur `compteur` : seule
      // la DIFFÉRENCE voyage depuis la file, jamais l'ensemble (point 2).
      corps.set("depuis_file", "1");
      return corps;
    case "signature":
      for (const [cle, valeur] of Object.entries(geste.champs)) {
        corps.set(cle, valeur);
      }
      corps.set("operation_id", entree.id);
      return corps;
    case "photo":
      corps.set("fichier", geste.blob, geste.nomFichier);
      if (geste.libelle.length > 0) {
        corps.set("libelle", geste.libelle);
      }
      // REJEU SANS DOUBLON (9F4H2A-REJEU-SANS-DOUBLON, point 3) : même
      // patron que `compteur`/`signature`/`terminer` ci-dessus — `entree.id`
      // voyage avec la saisie tant qu'elle reste en file, donc à travers
      // chaque renvoi tant qu'aucune réponse n'est arrivée.
      corps.set("operation_id", entree.id);
      return corps;
    case "terminer":
      corps.set("instant_appareil", entree.instantAppareil);
      corps.set("operation_id", entree.id);
      // ADDENDUM n°1 (9F4H4B) — voir le même commentaire sur `compteur`.
      corps.set("depuis_file", "1");
      return corps;
  }
}

async function envoyerUneEntree(
  entree: EntreeFile,
): Promise<{ readonly ok: boolean; readonly motif: string | null }> {
  try {
    const reponseServeur = await fetch(
      `/api/terrain/${entree.interventionId}/${routeDe(entree.geste.type)}`,
      {
        method: "POST",
        body: corpsDe(entree),
        headers: { Accept: "application/json" },
      },
    );
    return (await reponseServeur.json()) as {
      readonly ok: boolean;
      readonly motif: string | null;
    };
  } catch {
    // Toujours pas de réseau — la saisie reste en file, sans motif.
    return { ok: false, motif: null };
  }
}

/** Après tous les types connus (point 2, 9F4H6C-FILE-ROBUSTESSE) — voir `rangDansPipeline`. */
const RANG_INCONNU = Object.keys(ORDRE_PIPELINE).length;

/**
 * UN RANG TOUJOURS DÉFINI, MÊME POUR UN TYPE QU'`ORDRE_PIPELINE` N'ÉNUMÈRE
 * PAS (point 2, 9F4H6C-FILE-ROBUSTESSE) — `ORDRE_PIPELINE[type]` sur un type
 * absent du dictionnaire rendait `undefined`, et `undefined - nombre` vaut
 * `NaN` : un comparateur qui rend `NaN` n'est PAS cohérent (`NaN !== 0` est
 * vrai, donc `diff !== 0` s'y arrête, mais aucune relation d'ordre total
 * n'en sort), et `Array.prototype.sort` mélangeait l'ordre plutôt que de s'y
 * arrêter proprement. Mesuré par la revue : 33 ordres d'insertion sur 120
 * mal triés dès qu'un type inconnu rejoignait la file.
 */
function rangDansPipeline(type: Geste["type"]): number {
  // `Object.hasOwn`, JAMAIS `in` (BAS, 9F4H6D-PRESTATIONS-SANS-PERTE, point
  // 5) — `in` remonte le PROTOTYPE : `"constructor" in ORDRE_PIPELINE` rend
  // `true` (`Object.prototype.constructor`), et `ORDRE_PIPELINE["constructor"]`
  // n'est pas un nombre — `NaN` de nouveau, le même défaut que ce module
  // corrige déjà pour un type ABSENT du dictionnaire.
  return Object.hasOwn(ORDRE_PIPELINE, type)
    ? ORDRE_PIPELINE[type]
    : RANG_INCONNU;
}

function trieeParPipeline(entrees: readonly EntreeFile[]): EntreeFile[] {
  return [...entrees].sort((a, b) => {
    const diff =
      rangDansPipeline(a.geste.type) - rangDansPipeline(b.geste.type);
    return diff !== 0 ? diff : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function parIntervention(
  entrees: readonly EntreeFile[],
): ReadonlyMap<string, EntreeFile[]> {
  const groupes = new Map<string, EntreeFile[]>();
  for (const entree of entrees) {
    const liste = groupes.get(entree.interventionId) ?? [];
    liste.push(entree);
    groupes.set(entree.interventionId, liste);
  }
  return groupes;
}

/**
 * ENVOIE TOUTE LA FILE D'UNE IDENTITÉ — intervention par intervention, dans
 * le pipeline fixe ci-dessus. `surProgres` est appelé après CHAQUE entrée
 * (acceptée ou refusée) : le bouton « Envoyer » s'en sert pour réafficher le
 * compte restant pendant l'envoi, sans attendre la fin de toute la file.
 */
export async function envoyerFile(
  identite: Identite,
  surProgres?: () => void,
): Promise<void> {
  const entrees = await listerFile(identite);
  for (const [, groupe] of parIntervention(entrees)) {
    for (const entree of trieeParPipeline(groupe)) {
      // UNE FORME INCONNUE NE SE TENTE JAMAIS (9F4H6B-FILE-ANCIEN-FORMAT,
      // point 1) — `listerFile` a déjà posé ce motif (`gesteReconnu`,
      // `file-saisies.ts`) pour toute entrée que ni la forme courante ni une
      // ancienne migrée ne reconnaissent ; l'envoyer lèverait sans jamais
      // pouvoir réussir. `continue`, jamais `break` : cette entrée précise
      // reste bloquée, mais les SUIVANTES de la même intervention (photos,
      // signature, terminer) ne doivent plus geler avec elle.
      if (entree.motifRefus === CLE_MOTIF_FORMAT_INCONNU) {
        surProgres?.();
        continue;
      }
      const resultat = await envoyerUneEntree(entree);
      if (resultat.ok) {
        await retirerSaisie(entree.id);
        if (entree.geste.type === "prestations") {
          // LA FICHE, SI ELLE EST MONTÉE, DOIT SAVOIR QUELLE DIFFÉRENCE EST
          // RÉELLEMENT PARTIE (9F4H6C-FILE-ROBUSTESSE, point 1) — cet envoi
          // peut avoir été déclenché depuis « Ma journée », donc hors de
          // son montage ; sans ce signal, sa « dernière base connue »
          // resterait périmée jusqu'au prochain rafraîchissement des props
          // serveur.
          signalerPrestationsEnvoyees({
            interventionId: entree.interventionId,
            ajouterIds: entree.geste.ajouterIds,
            retirerIds: entree.geste.retirerIds,
          });
        }
        if (entree.geste.type === "terminer") {
          try {
            window.localStorage.removeItem(cleBrouillon(entree.interventionId));
          } catch {
            /* voir `effacerBrouillon` dans rapport-automatique.tsx */
          }
        }
        surProgres?.();
      } else {
        await marquerRefusee(entree.id, resultat.motif);
        surProgres?.();
        // ARRÊT pour CETTE intervention — les entrées suivantes du même
        // groupe restent en file, intactes (point 3 : rien ne se perd).
        break;
      }
    }
  }
}
