import {
  MOTIF_TELEVERSEMENT,
  lireLeTeleversement,
} from "@/lib/imports/televersement";
import { controlerFeuille } from "@/lib/excel/controle";
import { lireClasseur } from "@/lib/excel/classeur";
import { enregistrerLeControle } from "@/lib/imports/depot";
import { MODELE_CLIENTS } from "@/lib/imports/modeles";
import { indexerLeParcClients } from "@/lib/imports/parc-clients";

import { champ, contexteCourant } from "../../interventions/actions";

/**
 * TÉLÉVERSER UN CLASSEUR ET EN PRODUIRE LE RAPPORT (L1-11 ; I6, RG-IMP-01).
 *
 * **Cette route ne CRÉE aucune fiche.** Elle lit, elle contrôle, elle
 * enregistre un rapport — et elle s'arrête là. *C'est la première moitié de
 * I6, et la séparer de la seconde est tout l'objet du ticket* : un import qui
 * écrirait dans la foulée du téléversement n'aurait jamais été validé par
 * personne.
 *
 * **UN SEUL TYPE POUR L'INSTANT, et l'écran le dit.** `appliquerLeLotDeClients`
 * est la seule fonction d'application qui existe (mesuré : `grep "^export async
 * function appliquer" lib/imports/` rend une ligne). *Accepter un fichier de
 * contacts ici produirait un rapport qu'aucun bouton ne pourrait appliquer* —
 * un écran qui promet et ne tient pas.
 *
 * **La feuille lue est la PREMIÈRE, et c'est le MARQUEUR qui juge.** Un gabarit
 * que CODIPLAN publie porte `CODIPLAN-<type>-v<n>` en A1 (D31) ; si le fichier
 * n'est pas celui qu'on croit, `controlerFeuille` le refuse à la première
 * cellule, avant d'avoir compté quoi que ce soit. *Chercher une feuille par son
 * nom aurait ajouté une seconde règle d'identification à côté de celle qui
 * existe*, et deux lectures d'un même critère divergent en silence (§9, 01/09).
 *
 * **Aucun octet n'est conservé.** `import_lot.objet_cle` reste nulle : le
 * stockage d'objets n'a aucun appelant, et *une place réservée est une décision
 * prise par personne*. Le classeur vit le temps de la requête.
 */
export async function POST(requete: Request): Promise<Response> {
  const versLIndex = (cle: string): Response =>
    new Response(null, {
      status: 303,
      headers: { Location: `/imports?motif=${encodeURIComponent(cle)}` },
    });

  const contexte = await contexteCourant();
  if (contexte === null) {
    return versLIndex("auth.refus");
  }

  const formulaire = await requete.formData();
  const televerse = await lireLeTeleversement(formulaire.get("classeur"));
  if (!televerse.accepte) {
    return versLIndex(`imports.refus.${televerse.motif}`);
  }

  // *Le nom du fichier est une donnée de l'appelant* : il est repris tel quel
  // dans le rapport, jamais interprété — ni pour deviner le type, ni pour
  // chercher une feuille. `classeurTeleverse` l'a déjà borné en longueur.
  const nom = champ(formulaire, "nom") ?? televerse.nom;

  const feuilles = await lireClasseur(televerse.octets);
  const premiere = feuilles[0];
  if (premiere === undefined) {
    return versLIndex(`imports.refus.${MOTIF_TELEVERSEMENT.sansFeuille}`);
  }

  const parc = await indexerLeParcClients(contexte);
  const controle = controlerFeuille(premiere, MODELE_CLIENTS, parc);
  if (!controle.lisible) {
    // *Le rapport d'un fichier illisible n'est pas enregistré*, et c'est la
    // règle du module de contrôle reprise ici : il n'a compté aucune ligne, il
    // n'y a donc rien à valider plus tard. L'écran redit ce qui bloque.
    const anomalie = controle.anomalies[0];
    return versLIndex(
      anomalie === undefined
        ? `imports.refus.${MOTIF_TELEVERSEMENT.illisible}`
        : `import.anomalie.${anomalie.code}`,
    );
  }

  const { lotId } = await enregistrerLeControle(
    contexte,
    {
      nom,
      type: MODELE_CLIENTS.type,
      version: MODELE_CLIENTS.version,
    },
    controle.lignes,
  );
  return new Response(null, {
    status: 303,
    headers: { Location: `/imports/${lotId}` },
  });
}
