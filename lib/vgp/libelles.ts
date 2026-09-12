import { dateCivile } from "@/lib/calendar/fuseau";
import { t } from "@/lib/i18n/fr";

import { type EtatInformation } from "./information";

/**
 * CE QU'UN ÉCRAN A LE DROIT DE DIRE D'UNE MACHINE (L9-02, D88).
 *
 * ## POURQUOI CETTE FONCTION EST DANS `lib/` ET NON DANS L'ÉCRAN
 *
 * L'acceptation de L9-02 porte sur un COMPORTEMENT : *« aucun écran du lot ne
 * rend un état sans le dater ; l'absence d'information a un libellé propre,
 * distinct de "conforme" et de "non conforme" ».* Écrite dans un composant,
 * cette règle ne serait éprouvable que par un rendu — et le jour où un second
 * écran du lot afficherait l'état, il le ferait à sa façon, **sans qu'aucun
 * test ne rougisse**. C'est la divergence du §9 (01/09) : deux lectures d'un
 * même critère, chacune verte.
 *
 * **Il n'y a donc qu'un seul endroit où un état d'information devient du
 * texte**, et c'est lui que le gardien lit.
 *
 * ## CE QUE LA FONCTION NE PEUT PAS DIRE
 *
 * Ni « conforme », ni « non conforme », ni « à jour », ni « en retard ». *Les
 * VGP sont commandées par les clients ; CODIPLAN n'apprend leur résultat que si
 * on le lui dit*, et déduire la conformité d'une règle que le produit porterait
 * serait engager une responsabilité que personne ne lui a donnée (D88 §1).
 *
 * ## ET AUCUN ÉTAT NE SORT SANS SA DATE
 *
 * « Sans information » sans depuis quand serait le blanc que D88 refuse : *on
 * saurait qu'on ne sait pas, sans savoir depuis combien de temps.* Quand la
 * date de mise en service manque elle aussi, la fonction le **DIT** — elle ne
 * rend jamais un tiret, qui se lirait comme « rien à signaler ».
 */
export function libelleEtatInformation(etat: EtatInformation): string {
  if (etat.etat === "hors_registre") {
    return t("vgp.information.hors_registre");
  }
  if (etat.etat === "sans_information") {
    if (etat.depuis === null) {
      return t("vgp.information.depuis_inconnu");
    }
    return `${t("vgp.information.sans_information")} — ${dateCivile(etat.depuis)}`;
  }
  return `${t("vgp.information.recue")} — ${dateCivile(etat.derniereInformation)}`;
}
