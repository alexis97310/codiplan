import { deplacerIntervention } from "@/lib/interventions/depot";
import { schemaDeplacement } from "@/lib/interventions/saisie";

import { champ, contexteCourant, versLaFiche } from "../../actions";

/**
 * DÉPLACER — changer de créneau, changer de technicien, ou les deux.
 *
 * **Le journal du déplacement n'est pas écrit ici.** Qui, quand, d'où vers où :
 * c'est `journal_audit` qui le porte, par déclencheur, avec les valeurs avant
 * et après (I8, D55). Un journal écrit par la couche applicative se contourne
 * par une requête ; celui-là non.
 *
 * ## DEUX FORMES DE RÉPONSE, UNE SEULE DÉCISION (R2-19)
 *
 * Le formulaire de la fiche attend une redirection ; le glisser-déposer du
 * planning attend une réponse qu'il puisse lire sans quitter l'écran. **Les
 * deux passent par le même appel à `deplacerIntervention`** : c'est la forme de
 * la RÉPONSE qui change, jamais la décision.
 *
 * *Une seconde route pour le glisser-déposer aurait été une seconde lecture
 * d'un même critère, et deux lectures d'un même critère divergent en silence
 * (§9, 01/09) — celle qui n'aurait pas de formulaire pour la rappeler à l'ordre
 * aurait dérivé la première.*
 */
export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  // La négociation porte sur ce que l'APPELANT demande, jamais sur la forme de
  // ce qu'il envoie : un formulaire HTML ne sait pas poser d'en-tête.
  const enJson = (requete.headers.get("accept") ?? "").includes(
    "application/json",
  );
  const repondre = (cle?: string): Response =>
    enJson
      ? Response.json({ accepte: cle === undefined, cle: cle ?? null })
      : versLaFiche(id, cle);

  const contexte = await contexteCourant();
  if (contexte === null) {
    return repondre("auth.refus");
  }
  const formulaire = await requete.formData();
  const date = champ(formulaire, "date_planifiee");
  const heure = champ(formulaire, "heure_debut");
  const duree = champ(formulaire, "duree_min");
  const saisie = schemaDeplacement.safeParse({
    intervention_id: id,
    // Une date de formulaire est un JOUR — `2026-09-14` —, lu en UTC et jamais
    // par un `Date` local : UTC+11 décale le jour d'un cran, et le 14 se
    // rangerait au 13.
    date_planifiee: date === null ? null : new Date(`${date}T00:00:00.000Z`),
    // L'HEURE ARRIVE EN MINUTES LOCALES — `08:30` ou `510` —, jamais en
    // instant : l'instant demande le fuseau de l'agence, que ni un formulaire
    // ni un navigateur ne connaissent. Le dépôt le résout, une seule fois.
    debut_minutes: heure === null ? null : minutesLocales(heure),
    duree_min: duree === null ? null : Number(duree),
    technicien_id: champ(formulaire, "technicien_id"),
  });
  if (!saisie.success) {
    // **LE REFUS NOMME CE QUI CLOCHE** (L3-01b). « Inconnue » pour tout était
    // vrai tant qu'une seule chose pouvait manquer ; le redimensionnement
    // ajoute un second motif — *une durée nulle ou négative, qu'on obtient en
    // tirant la poignée au-dessus du début du bloc.* Un message unique
    // enverrait chercher une intervention disparue.
    const surLaDuree = saisie.error.issues.some((probleme) =>
      probleme.path.includes("duree_min"),
    );
    return repondre(
      surLaDuree
        ? "intervention.refus.duree_invalide"
        : "intervention.refus.inconnue",
    );
  }
  const resultat = await deplacerIntervention(contexte, saisie.data);
  return repondre(resultat.accepte ? undefined : resultat.cle);
}

/**
 * `08:30` ou `510` — les deux formes que l'écran envoie, une seule lecture.
 *
 * Le formulaire de la fiche emploie un champ `time`, qui rend `HH:MM` ; le
 * glisser-déposer connaît déjà les minutes de la ligne d'heures qu'il vise.
 * Rend `NaN` sur tout le reste, et Zod refuse — *un refus vaut mieux qu'une
 * heure inventée.*
 */
function minutesLocales(valeur: string): number {
  const horaire = /^(\d{1,2}):(\d{2})$/.exec(valeur);
  if (horaire !== null) {
    return Number(horaire[1]) * 60 + Number(horaire[2]);
  }
  return /^\d+$/.test(valeur) ? Number(valeur) : Number.NaN;
}
