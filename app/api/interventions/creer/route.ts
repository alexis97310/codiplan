import { Prisma } from "@prisma/client";
import { z } from "zod";

import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import {
  creerIntervention,
  interventionDejaCreee,
} from "@/lib/interventions/depot";
import { schemaCreation } from "@/lib/interventions/saisie";
import { uuidv7 } from "@/lib/db/uuid";

import { champ, versLaFiche, versLePlanning } from "../actions";
import { versLeFormulaire } from "./formulaire";

/**
 * CRÉER UNE INTERVENTION — UNE DEMANDE (lot 2, D84 ; PARCOURS-1, 23/09/2026,
 * arbitrage Alexis).
 *
 * Le lieu arrive sous la forme `client:site` — un seul champ pour un couple qui
 * ne se dissocie jamais. Le faire saisir en deux listes laisserait choisir un
 * lieu d'un autre client, et il faudrait alors le refuser : autant ne pas le
 * proposer.
 *
 * L'identifiant est un UUID v7 attribué ICI (I10) : c'est la même règle qui
 * permettra à l'application mobile d'en générer un hors ligne.
 *
 * **NI DATE, NI TECHNICIEN** — ce formulaire ne les poste plus, `schemaCreation`
 * ne les porte plus : *« lors de la création d'intervention, on ne peut pas
 * décider ni de la date d'intervention, ni du technicien affecté »* (Alexis,
 * 23/09/2026). C'est `PLANIFIER`, sur la fiche, qui les pose — tous ensemble.
 *
 * ## UN DOUBLE CLIC NE CRÉE QU'UNE INTERVENTION (55-FORMULAIRES-1, SAV-02)
 *
 * L'écran pose désormais l'`id` au RENDU, dans un champ caché — la seconde
 * soumission d'un même formulaire le rejoue donc À L'IDENTIQUE. Avant
 * d'écrire, cette route relit SOUS LE CONTEXTE CLOISONNÉ si cet `id` désigne
 * déjà une intervention de la société active (`interventionDejaCreee`) : si
 * oui, rien n'est recréé, et la réponse est LA MÊME redirection qu'un succès.
 * Un `id` absent ou malformé retombe sur le tirage serveur d'aujourd'hui —
 * rien ne change pour un appel qui ne porte pas ce champ.
 *
 * La lecture est cloisonnée (I1) : un `id` d'une AUTRE société ne s'y voit
 * jamais, exactement comme un `id` inconnu. Si un tel `id` est malgré tout
 * réemployé pour créer, la contrainte d'unicité globale sur `intervention.id`
 * (I10) refuse l'écriture ; ce refus est traité comme n'importe quelle panne
 * technique — rien n'est écrit, et la fiche d'autrui n'est jamais révélée.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

const IDENTIFIANT_UUID = z.string().uuid();

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapacite("creer_demande");
  if (contexte === null) {
    return versLePlanning("auth.refus");
  }
  const formulaire = await requete.formData();
  const lieu = (champ(formulaire, "site") ?? "").split(":");
  // CE QUI AVAIT ÉTÉ SOUMIS, capturé AVANT toute validation (56-FORMULAIRES-2)
  // — c'est ce qui part vers `versLeFormulaire` si `schemaCreation` ou
  // `creerIntervention` refusent : la page `nouvelle` ignore en silence tout
  // champ inconnu ou hors liste (LIENS-1), donc une valeur invalide ici ne
  // fait jamais une erreur, seulement un champ vide au retour.
  const champsResoumis = {
    site: lieu[1],
    machine: champ(formulaire, "machine_ids") ?? undefined,
    type: champ(formulaire, "type") ?? undefined,
    priorite: champ(formulaire, "priorite") ?? undefined,
    description: champ(formulaire, "description") ?? undefined,
    reference_client: champ(formulaire, "reference_client") ?? undefined,
    contact_id: champ(formulaire, "contact_id") ?? undefined,
  };

  const idPropose = champ(formulaire, "id");
  const id =
    idPropose !== null && IDENTIFIANT_UUID.safeParse(idPropose).success
      ? idPropose
      : uuidv7();

  const existante = await interventionDejaCreee(contexte, id);
  if (existante !== null) {
    return versLaFiche(existante);
  }

  const saisie = schemaCreation.safeParse({
    id,
    client_id: lieu[0],
    site_id: lieu[1],
    // AU PLUS UNE MACHINE (PARCOURS-1) — le champ reste FACULTATIF, et ce
    // n'est pas un raccourci : le dépannage à l'aveugle — on sait qu'un
    // compresseur est en panne, pas lequel — reste le cas ordinaire, et
    // RG-INT-01 n'exige une machine qu'avant de DÉMARRER, contrôle tenu en
    // base par un déclencheur. `schemaCreation.machine_ids` refuse un second
    // identifiant ; `<select>` (non `multiple` depuis ce lot) n'en soumet de
    // toute façon jamais plus d'un.
    //
    // **L'OPTION VIDE SE FILTRE ICI** — mesuré : un `<select>` simple, à la
    // différence d'un `multiple` dont rien n'est coché, soumet TOUJOURS une
    // valeur, y compris celle de son option « aucune machine » (`value=""`).
    // Sans ce filtre, `machine_ids` valait `[""]`, `uuid()` la refusait, et
    // TOUTE création sans machine tombait dans le refus générique.
    machine_ids: formulaire.getAll("machine_ids").filter((v) => v !== ""),
    type: champ(formulaire, "type"),
    priorite: champ(formulaire, "priorite") ?? "p3",
    mode_valorisation: champ(formulaire, "mode_valorisation") ?? "temps_passe",
    description: champ(formulaire, "description"),
    contact_id: champ(formulaire, "contact_id"),
    reference_client: champ(formulaire, "reference_client"),
    // LA DEMANDE D'ORIGINE (68-DEMANDES-2) — un champ caché posé par
    // `/interventions/nouvelle` seulement quand l'écran a été ouvert depuis
    // la fiche d'une demande (`?demande=<id>`). Absent, `champ()` rend `null`
    // et `schemaCreation` retombe sur son défaut.
    demande_id: champ(formulaire, "demande_id"),
  });
  if (!saisie.success) {
    // LE REFUS NOMME CE QUI CLOCHE (L3-01b) : la panne signalée est le champ
    // le plus probable d'un oubli, et « lieu inconnu » pour tout enverrait
    // chercher au mauvais endroit.
    const surLaDescription = saisie.error.issues.some((probleme) =>
      probleme.path.includes("description"),
    );
    return versLeFormulaire(
      surLaDescription
        ? "intervention.refus.panne_manquante"
        : "intervention.refus.lieu_inconnu",
      champsResoumis,
    );
  }

  let resultat;
  try {
    resultat = await creerIntervention(contexte, saisie.data);
  } catch (erreur) {
    // L'`id` PROPOSÉ PEUT APPARTENIR À UNE AUTRE SOCIÉTÉ — la lecture
    // ci-dessus ne le révèle jamais (I1), et c'est alors la contrainte
    // d'unicité globale sur `intervention.id` (I10) qui refuse l'écriture.
    // Même refus qu'une panne technique ordinaire : rien n'est écrit, jamais
    // la fiche d'autrui.
    if (
      erreur instanceof Prisma.PrismaClientKnownRequestError &&
      erreur.code === "P2002"
    ) {
      return versLePlanning("intervention.refus.erreur_serveur");
    }
    throw erreur;
  }
  if (!resultat.accepte) {
    return versLeFormulaire(resultat.cle, champsResoumis);
  }
  return versLaFiche(resultat.fiche.id);
}
