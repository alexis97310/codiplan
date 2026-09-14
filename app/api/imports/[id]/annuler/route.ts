import { annulerLeLotDeClients } from "@/lib/imports/annulation";

import { contexteCourant } from "../../../interventions/actions";

/**
 * ANNULER UN LOT — PARTIELLEMENT ET SÛREMENT (L1-11 ; I6, D15, D54, RG-IMP-02).
 *
 * **Elle ne s'arrête pas au premier refus et ne force rien** : c'est
 * `annulerLeLotDeClients` qui restaure ce qui peut l'être et refuse le reste
 * AVEC SON MOTIF — modifiée depuis, référencée depuis. *Ni délai ni rang de lot*
 * (D54) : le critère ligne à ligne mesure directement ce que ces deux bornes
 * approchaient.
 *
 * **DEUX ISSUES DE SUCCÈS, ET JAMAIS UNE.** « Tout a été défait » et « une
 * partie a été refusée » sont deux états, et les dire du même mot ferait lire
 * « annulé » sur une annulation qui ne l'est qu'à moitié. *C'est la même
 * famille que « sans information » contre « à jour » au registre des VGP
 * (D88) : une réponse partielle ne s'affiche jamais comme une réponse pleine.*
 *
 * **CE QU'ON NE SAIT PAS DIRE, écrit plutôt que tu** : *quelles* lignes ont été
 * refusées, et pourquoi. `annulerLeLotDeClients` le rend — `LigneAnnulee` porte
 * son rang et son motif — et **rien ne le conserve** : le lot passe à `annule`,
 * les lignes gardent leur action d'origine, et aucune colonne ne porte le
 * verdict de l'annulation. Le reconstituer à la lecture demanderait de
 * redemander à la base ce que chaque fiche est devenue, *c'est-à-dire une
 * seconde lecture d'un critère que l'annulation a déjà tranché* (§9, 01/09) —
 * et elle divergerait au premier changement de l'une des deux.
 * *Condition de réouverture, vérifiable : le jour où une colonne de
 * `import_lot_ligne` porte le verdict de l'annulation.*
 */
export async function POST(
  _requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const versLeLot = (cle: string): Response =>
    new Response(null, {
      status: 303,
      headers: {
        Location: `/imports/${encodeURIComponent(id)}?motif=${encodeURIComponent(cle)}`,
      },
    });

  const contexte = await contexteCourant();
  if (contexte === null) {
    return versLeLot("auth.refus");
  }

  const resultat = await annulerLeLotDeClients(contexte, id);
  if (!resultat.annule) {
    return versLeLot(`imports.refus.${resultat.motif}`);
  }
  // Le partiel se LIT sur ce que l'annulation vient de rendre, jamais sur une
  // relecture de la base : c'est le seul instant où l'information existe.
  const refusees = resultat.lignes.filter((ligne) => !ligne.defaite).length;
  return versLeLot(
    refusees === 0 ? "imports.annule" : "imports.annule_partiel",
  );
}
