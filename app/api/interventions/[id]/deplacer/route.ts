import {
  avertirApresPlanification,
  clesAvertissementCourriel,
} from "@/lib/avertissements/planification";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { deplacerIntervention } from "@/lib/interventions/depot";
import { schemaDeplacement } from "@/lib/interventions/saisie";

import { avecFilet, champ, versLaFiche } from "../../actions";

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
  return dansUnEchangeAuth(() => traiter(requete, params));
}

async function traiter(
  requete: Request,
  params: Promise<{ id: string }>,
): Promise<Response> {
  const { id } = await params;
  return avecFilet(id, "deplacer", async () => {
    // La négociation porte sur ce que l'APPELANT demande, jamais sur la forme de
    // ce qu'il envoie : un formulaire HTML ne sait pas poser d'en-tête.
    const enJson = (requete.headers.get("accept") ?? "").includes(
      "application/json",
    );
    const repondre = (
      cle?: string,
      avertissements?: readonly string[],
    ): Response =>
      enJson
        ? Response.json({
            accepte: cle === undefined,
            cle: cle ?? null,
            // **DES CLÉS, JAMAIS DU TEXTE** (L3-02) — le canal d'avertissement
            // est aussi étroit que celui du refus, et pour la même raison : sans
            // ce filtre, une réponse forgée ferait écrire n'importe quoi à la
            // page (L1-02f). Absent plutôt que vide quand il n'y a rien à dire.
            avertissements: avertissements ?? null,
          })
        : versLaFiche(id, cle, avertissements);

    const contexte = await exigerCapacite("modifier_planning");
    if (contexte === null) {
      return repondre(await motifDuRefus());
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
      // tirant la poignée à gauche du début du bloc (QG-3/D142, 30/09/2026 —
      // au-dessus quand l'axe des heures était vertical).* Un message unique
      // enverrait chercher une intervention disparue.
      const surLaDuree = saisie.error.issues.some((probleme) =>
        probleme.path.includes("duree_min"),
      );
      // ── TROIS FAÇONS DE MANQUER LE MÊME CRÉNEAU (PARCOURS-1, PG-A3a) ─────
      //
      // Le refine « une heure et une durée, ou rien » (`saisie.ts`) échoue sur
      // `duree_min` dans LES DEUX SENS, et ce n'est pas la même faute :
      //
      // - `heure !== null && duree === null` — une carte SANS durée connue
      //   déposée sur le planning (`pose.tsx` n'envoie alors aucun
      //   `duree_min`), ou le champ « Durée » laissé vide sur « Planifier ».
      //   C'est la durée qui manque.
      // - `heure === null && duree !== null` — le formulaire « Déplacer » de
      //   la fiche pré-remplit la durée d'une intervention déjà planifiée
      //   (99S) ; vider SEULEMENT l'heure laisse une durée orpheline. Un
      //   créneau se donne en entier (QG-4, 27/09/2026) : c'est l'heure qui
      //   manque, pas la durée.
      //
      // **`intervention.refus.duree_invalide` ne reste que pour le
      // redimensionnement** — le seul chemin qui envoie TOUJOURS un nombre
      // (`pose.tsx` calcule `cible.minutes + cible.pasMinutes -
      // main.debutMinutes!`, jamais une chaîne vide) et n'échoue que si ce
      // nombre n'est pas strictement positif : la poignée tirée à gauche du
      // début du bloc.
      if (surLaDuree && heure !== null && duree === null) {
        return repondre("intervention.refus.planification_duree_manquante");
      }
      if (surLaDuree && heure === null && duree !== null) {
        return repondre("intervention.refus.heure_obligatoire");
      }
      return repondre(
        surLaDuree
          ? "intervention.refus.duree_invalide"
          : "intervention.refus.inconnue",
      );
    }
    const resultat = await deplacerIntervention(contexte, saisie.data);
    // **L'AVERTISSEMENT D'HABILITATION NE VOYAGE PAS PAR ICI.** La fiche relit
    // ce verdict-là en base à chaque rendu, avec les codes et les dates que ce
    // canal ne peut pas porter : il y est déjà, et plus complet.
    //
    // **L'AVERTISSEMENT DE COURRIEL, LUI, LE DOIT** (AVERTISSEMENTS-1) — rien en
    // base ne garde le compte-rendu d'un envoi, qui est un fait EXPÉDIÉ, pas un
    // état qui se relit. `avertirApresPlanification` s'appelle APRÈS que cette
    // transaction a validé, jamais dans `deplacerIntervention` : un courriel ne
    // doit ni retarder ni annuler l'écriture qu'il annonce.
    const compteRenduCourriel =
      resultat.accepte && resultat.etatAvant !== undefined
        ? await avertirApresPlanification(contexte, id, resultat.etatAvant)
        : null;
    const avertissementsReunis = resultat.accepte
      ? [
          ...(resultat.avertissements ?? []),
          ...(compteRenduCourriel === null
            ? []
            : clesAvertissementCourriel(compteRenduCourriel)),
        ]
      : [];
    return repondre(
      resultat.accepte ? undefined : resultat.cle,
      resultat.accepte && avertissementsReunis.length > 0
        ? avertissementsReunis
        : undefined,
    );
  });
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
