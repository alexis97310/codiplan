import {
  avertirApresTransmissionGroupee,
  type CompteRenduRecapitulatif,
} from "@/lib/avertissements/planification";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { configurationCourriel } from "@/lib/courriel";
import { avecContexteApplicatif } from "@/lib/db/client";
import {
  debutDuJourSociete,
  listerPlanifieesATransmettre,
  transmettreEnGroupe,
} from "@/lib/interventions/depot";

import { versLePlanning } from "../actions";

/**
 * `POST /api/interventions/transmettre` — TRANSMETTRE PLUSIEURS PLANIFIÉES
 * D'UN COUP (QG-5, D141, 9CP-PG-G14B-TRANSMETTRE-GROUPE) : « Transmettre
 * demain » (une sélection cochée, `id` répété) et « Transmettre toutes les
 * planifiées prêtes » (`toutes=1`, résolue ICI plutôt que sur une liste
 * d'identifiants postée par le navigateur — un `id` manquant à l'envoi du
 * formulaire ne doit pas rester hors de « toutes »).
 *
 * **Toujours un POST natif, toujours une redirection 303 vers `/planning`** —
 * contrairement à `.../[id]/transmettre`, aucun tiroir n'appelle cette route
 * en JSON : le dialogue « Transmettre demain » et le bouton « Transmettre
 * toutes… » soumettent chacun un formulaire ordinaire.
 *
 * **Le compte-rendu voyage par des NOMBRES et des CLÉS FERMÉES, jamais par du
 * texte** (L1-02f, D50, même discipline que `clesAvertissementCourriel`) :
 * `transmis`/`techniciens`/`echecsCourriel` sont des entiers — un nombre
 * forgé rend au plus un compte faux, jamais un texte injecté — et
 * `refusee=<id>:<cle>` ne porte qu'une clé du dictionnaire, jamais le motif
 * technique d'un refus.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  // `exigerCapaciteComplete`, PAS `exigerCapacite` (04/10/2026,
  // 9DKA-REPRISE-9DK, TR-5/D136) — le ○ du technicien sur `modifier_planning`
  // n'ouvre que `app/api/absences/declarer/route.ts`, jamais celle-ci.
  const contexte = await exigerCapaciteComplete("modifier_planning");
  if (contexte === null) {
    return versLePlanning(await motifDuRefus());
  }

  const formulaire = await requete.formData();
  const idsCoches = formulaire
    .getAll("id")
    .filter((valeur): valeur is string => typeof valeur === "string");

  const ids =
    idsCoches.length > 0
      ? idsCoches
      : formulaire.get("toutes") === "1"
        ? (
            await listerPlanifieesATransmettre(contexte, {
              // DÉCISION D'ALEXIS DU 02/10/2026, POINT 7 (D141, 9CT-RETOUCHES-5)
              // — « toutes » exclut les Planifiées déjà passées ; la borne est
              // lue CÔTÉ SERVEUR, jamais depuis l'horloge de l'appareil (même
              // discipline que `debutDuJourSociete` lui-même). Elle est lue
              // dans une transaction DISTINCTE de celle du tri qu'elle borne
              // (`listerPlanifieesATransmettre` ci-dessous) : sans
              // conséquence à une seconde près, l'écart entre les deux
              // lectures étant négligeable face au grain « jour » du tri.
              aPartirDe: await avecContexteApplicatif(contexte, (tx) =>
                debutDuJourSociete(tx, contexte),
              ),
            })
          ).pretes.map((p) => p.id)
        : [];

  const { transmises, refusees } = await transmettreEnGroupe(contexte, ids);
  // UN ÉCHEC D'AVERTISSEMENT NE TRANSFORME JAMAIS UNE TRANSMISSION DÉJÀ
  // VALIDÉE EN 500 (9CT-RETOUCHES-5) : les lignes ci-dessus ont déjà écrit en
  // base, et `envoyerCourriel` ne lève jamais (lib/courriel/index.ts) — ce
  // filet ne couvre donc qu'un accident d'infrastructure sur la RELECTURE de
  // `avertirApresTransmissionGroupee`, jamais un envoi lent ou refusé par le
  // prestataire.
  let comptesRendus: readonly CompteRenduRecapitulatif[] = [];
  if (transmises.length > 0) {
    try {
      comptesRendus = await avertirApresTransmissionGroupee(
        contexte,
        transmises,
      );
    } catch (erreur) {
      console.error(
        `intervention transmettre (${transmises.join(",")})`,
        erreur,
      );
      comptesRendus = [];
    }
  }

  // UN COMPTE-RENDU NON PARTI EST TRACÉ, JAMAIS AVALÉ EN SILENCE
  // (9DB-RETOUCHES-10) — identifiants et type de l'état seulement. Le motif
  // qu'`envoyerCourriel` rend ne porte jamais d'adresse (lib/courriel/resend.ts,
  // lib/courriel/configuration.ts) : il peut donc être tracé en entier, mais
  // jamais le contenu d'un courriel, et jamais une adresse.
  for (const compteRendu of comptesRendus) {
    if (compteRendu.envoi.type === "parti") {
      continue;
    }
    console.error(
      `intervention transmettre courriel (technicien ${compteRendu.technicienId}, ${compteRendu.nombre}) — ${compteRendu.envoi.type}`,
      ...(compteRendu.envoi.type === "non_parti"
        ? [compteRendu.envoi.motif]
        : []),
    );
  }

  const parametres = new URLSearchParams();
  parametres.set("transmis", String(transmises.length));
  // UN TECHNICIEN N'EST COMPTÉ « PRÉVENU » QUE SI SON COURRIEL EST PARTI
  // (9DB-RETOUCHES-10) — `comptesRendus.length` comptait les récapitulatifs
  // TENTÉS, pas les envois réussis : une seule intervention transmise avec un
  // échec de courriel affichait à la fois « 1 technicien prévenu » ET « 1
  // technicien n'a pas reçu son courriel », pour la MÊME personne.
  parametres.set(
    "techniciens",
    String(comptesRendus.filter((c) => c.envoi.type === "parti").length),
  );
  parametres.set(
    "echecsCourriel",
    String(comptesRendus.filter((c) => c.envoi.type !== "parti").length),
  );
  // LE CANAL DE COURRIEL N'EST PAS CONFIGURÉ — UNE CAUSE NOMMÉE, PAS UN ÉCHEC
  // GÉNÉRIQUE (9DB-RETOUCHES-10, constat de production du 03/10/2026) : sans
  // elle, l'écran ne peut dire que « n'a pas reçu son courriel », ce qui
  // laisse croire à un accident d'envoi alors que RIEN n'a pu partir. Le
  // drapeau est une valeur FERMÉE, jamais le motif technique (même discipline
  // que les nombres ci-dessus) : `configurationCourriel` ne connaît que des
  // NOMS de variables (I9), jamais un secret.
  if (
    comptesRendus.length > 0 &&
    !configurationCourriel(process.env).configure
  ) {
    parametres.set("courriel", "non_configure");
  }
  for (const refus of refusees) {
    parametres.append("refusee", `${refus.id}:${refus.cle}`);
  }
  return new Response(null, {
    status: 303,
    headers: { Location: `/planning?${parametres.toString()}` },
  });
}
