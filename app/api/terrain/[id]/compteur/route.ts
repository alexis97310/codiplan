import { type ContexteActif } from "@/lib/auth/contexte";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { maintenant } from "@/lib/calendar/fuseau";
import { fuseauDuTechnicien } from "@/lib/calendar/technicien";
import { avecContexteApplicatif } from "@/lib/db/client";
import {
  arreterLeCompteur,
  demarrerLeCompteur,
} from "@/lib/interventions/depot-compteur";
import { perimetreDuPlanning } from "@/lib/interventions/perimetre-technicien";

/**
 * LE COMPTEUR, DEPUIS LE TERRAIN (R5-02, D119).
 *
 * ## UN SEUL POINT D'ENTRÉE POUR DEUX GESTES, et ce n'est pas une économie
 *
 * `demarrer` et `arreter` sont deux valeurs d'un champ, pas deux routes. *Les
 * deux gestes portent sur le MÊME objet — le compteur de cette personne — et
 * la base n'en tolère qu'un ouvert* : deux routes auraient deux endroits où
 * vérifier la session et deux endroits où reporter un refus, pour une question
 * qui n'a qu'une réponse à la fois.
 *
 * ## L'INSTANT EST POSÉ ICI, ET IL EST LU AVEC SON FUSEAU
 *
 * Ni la règle ni le dépôt ne lisent l'horloge : ils la reçoivent. Elle est lue
 * par `maintenant(fuseau)`, **et le fuseau est celui de l'AGENCE de
 * rattachement** — jamais celui de l'appareil ni celui du serveur (L0-08, D72).
 * *Un `new Date()` aurait rendu le même instant aujourd'hui et aurait été le
 * premier endroit où l'heure du serveur s'invite* ; le gardien de L0-08 l'a
 * refusé, à raison.
 *
 * **Tant que le terrain est connecté, l'heure du serveur EST l'heure du
 * terrain** — le geste et l'écriture sont dans la même seconde. Le jour où la
 * file de synchronisation existera, c'est l'APPAREIL qui la fournira, et seule
 * cette ligne changera : *l'ordre d'arrivée n'est pas l'ordre des faits*
 * (L2-03).
 *
 * ## L'ÉCHANGE D'AUTHENTIFICATION EST OUVERT ICI (D64)
 *
 * Cette route atteint l'authentification — elle lit la session —, et la
 * bibliothèque y réécrit des lignes qu'elle nomme par leur `id`. Sans échange,
 * ces écritures sont refusées **en silence** par les politiques de désignation.
 * *L'oubli échoue du bon côté — la fonctionnalité cesse de marcher, aucune
 * porte ne s'ouvre* —, et c'est ce qui rend le gardien de la population
 * déduite suffisant.
 *
 * ## LE PÉRIMÈTRE EST RELU ICI, ET CE N'EST PAS UNE SECONDE LECTURE
 *
 * L'écran n'est pas un contrôle d'accès : une route se forge à la main. Ce qui
 * est relu n'est pas *« cette intervention est-elle la sienne »* — la politique
 * et le dépôt s'en chargent — mais *« ce compte relève-t-il du terrain »*, la
 * même question que la page pose pour décider si elle existe. **Un rôle à accès
 * complet n'a rien à faire ici** : le compteur écrirait alors son identité à lui
 * sur un segment de travail.
 */

/** Redirige après un POST — 303, pour que le navigateur suive en GET. */
function versLaFiche(id: string, cle?: string): Response {
  const suffixe = cle === undefined ? "" : `?motif=${encodeURIComponent(cle)}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/terrain/${id}${suffixe}` },
  });
}

/**
 * LE PÉRIMÈTRE, AU-DESSUS DE LA CAPACITÉ (D-12).
 *
 * `exigerCapacite("saisir_rapport")` prouve que le rôle a le DROIT de saisir
 * un rapport — `admin_societe`, `responsable_materiel` et `responsable_sav`
 * l'ont aussi. Le filtre par PÉRIMÈTRE reste ici, inchangé : un rôle à accès
 * complet sur le planning n'a rien à faire sur SON compteur à lui, et c'est
 * une question de portée que la porte ne sait pas juger (voir son docblock).
 */
async function contexteDuTerrain(): Promise<ContexteActif | null> {
  const contexte = await exigerCapacite("saisir_rapport");
  if (contexte === null) {
    return null;
  }
  return perimetreDuPlanning(contexte).acces === "restreint" ? contexte : null;
}

export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return dansUnEchangeAuth(() => traiter(requete, id));
}

async function traiter(requete: Request, id: string): Promise<Response> {
  const contexte = await contexteDuTerrain();
  if (contexte === null) {
    return versLaFiche(id, "auth.refus");
  }

  const formulaire = await requete.formData();
  const geste = formulaire.get("geste");
  const instant = maintenant(
    await avecContexteApplicatif(contexte, (tx) =>
      fuseauDuTechnicien(tx, {
        societeId: contexte.societeId,
        utilisateurId: contexte.utilisateurId,
      }),
    ),
  ).instant;

  if (geste === "demarrer") {
    const resultat = await demarrerLeCompteur(contexte, id, instant);
    return versLaFiche(id, resultat.accepte ? undefined : resultat.cle);
  }
  if (geste === "arreter") {
    const resultat = await arreterLeCompteur(contexte, instant);
    return versLaFiche(id, resultat.accepte ? undefined : resultat.cle);
  }
  // Un geste inconnu n'est pas une panne : c'est un formulaire forgé, et il
  // reçoit le même refus que tout le reste — jamais un message qui nomme ce
  // qu'il aurait fallu écrire.
  return versLaFiche(id, "compteur.refus.geste_inconnu");
}
