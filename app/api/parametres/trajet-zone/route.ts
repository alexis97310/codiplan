import { reglerTrajetZone, retirerTrajetZone } from "@/lib/sites/depot";
import {
  schemaRetraitTrajetZone,
  schemaTrajetZone,
} from "@/lib/sites/trajet-zone";

import { champ, contexteCourant } from "../../interventions/actions";

/**
 * RÉGLER OU RETIRER UN TEMPS DE TRAJET PAR ZONE (R3-03, D107).
 *
 * **Deux gestes, une route, et le formulaire dit lequel.** Le bouton de retrait
 * porte `retirer=1` ; sans lui, c'est un réglage. *Deux routes auraient partagé
 * la même validation de zone et le même refus* — c'est-à-dire deux lectures d'un
 * même critère (§9, 01/09).
 *
 * **Aucune comparaison de société n'est écrite ici**, ni au-dessus de la
 * politique : la forme « société » de `temps_trajet_zone` décide, et le contexte
 * cloisonné la pose. Une zone réglée depuis une session dont la société n'est
 * pas la bonne n'écrit rien — elle ne se trompe pas de société.
 *
 * **La borne est vérifiée DEUX FOIS** : par Zod ici, pour que le refus soit
 * lisible, et par la contrainte `CHECK` en base, pour qu'il soit tenu. *La
 * seconde est celle qui garde* — Zod ne voit ni un import, ni une correction
 * faite à la main.
 *
 * **ET LE REFUS DES ÎLES EST LE MÊME QUE CELUI D'UNE VALEUR HORS BORNES.** Un
 * message distinct n'aurait rien appris à personne : l'écran n'affiche déjà
 * aucun champ pour cette zone, et le seul moyen d'atteindre cette branche est un
 * formulaire forgé. *Un refus a le droit d'être lisible, jamais d'être
 * informatif* (D50).
 */
export async function POST(requete: Request): Promise<Response> {
  const vers = (cle?: string) =>
    new Response(null, {
      status: 303,
      headers: {
        Location: `/parametres/trajets${cle === undefined ? "" : `?motif=${encodeURIComponent(cle)}`}`,
      },
    });

  const contexte = await contexteCourant();
  if (contexte === null) {
    return vers("auth.refus");
  }
  const formulaire = await requete.formData();

  // LE RETRAIT rend la main au défaut de D107 : il n'écrit pas zéro, il efface
  // la ligne. Et il accepte une zone SANS estimation — retirer une ligne qu'une
  // main aurait écrite dans une console est un nettoyage, jamais un réglage.
  if (champ(formulaire, "retirer") !== null) {
    const retrait = schemaRetraitTrajetZone.safeParse({
      zone: champ(formulaire, "zone"),
    });
    if (!retrait.success) {
      return vers("trajets.refus");
    }
    await retirerTrajetZone(contexte, retrait.data.zone);
    // Zéro ligne touchée n'est PAS une erreur : la zone n'était pas réglée, et
    // l'état d'arrivée est celui qu'on voulait. *Un geste idempotent qui refuse
    // la seconde fois apprend à cliquer deux fois pour vérifier.*
    return vers();
  }

  const minutes = champ(formulaire, "minutes");
  const reglage = schemaTrajetZone.safeParse({
    zone: champ(formulaire, "zone"),
    minutes: minutes === null ? Number.NaN : Number(minutes),
  });
  if (!reglage.success) {
    return vers("trajets.refus");
  }
  await reglerTrajetZone(contexte, reglage.data);
  return vers();
}
