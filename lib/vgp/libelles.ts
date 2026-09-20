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

/**
 * L'ÉCHÉANCE DÉDUITE, et `null` quand il n'y a rien à déduire (R3-11).
 *
 * ## POURQUOI ELLE EXISTE — mesuré SUR UNE IMAGE, le 13/09/2026
 *
 * Une machine vérifiée il y a quatorze mois sous une périodicité de six mois
 * affichait « Information reçue — 13/07/2025 », **et rien d'autre**. L'échéance
 * était calculée par `etatDeLInformation` et rendue par `listerLeRegistre` ;
 * seule la colonne manquait. *Un œil qui lit cette ligne voit une machine
 * renseignée* — c'est-à-dire exactement le registre à moitié rempli qui
 * ressemble à un registre complet (D88).
 *
 * ## CE QU'ELLE N'INVENTE PAS
 *
 * **Aucune durée** : ni seuil, ni tolérance, ni « bientôt » (L9-05). La date
 * vient d'une périodicité SAISIE, et le nombre de jours est une soustraction
 * déjà faite. **Aucun verdict** : jamais « à jour », jamais « conforme » — un
 * dépassement d'échéance déclarée n'est pas une non-conformité, c'est une date
 * passée (D88).
 *
 * ## ET `null` N'EST PAS UN TIRET
 *
 * Il dit à l'appelant *« cette colonne n'a rien à montrer pour cette ligne »* —
 * l'état « hors registre » et l'état « sans information » se disent déjà tout
 * entiers dans la colonne voisine, et les répéter ici ferait deux lectures d'un
 * même fait. C'est l'ÉCRAN qui choisit le signe, et un signe n'est pas une
 * phrase.
 */
export function libelleEcheance(etat: EtatInformation): string | null {
  if (etat.etat !== "information_recue") {
    return null;
  }
  if (etat.prochaineEcheance === null) {
    // « Aucun rythme déclaré » et « échéance lointaine » ne se corrigent pas au
    // même endroit : le premier se corrige à la FAMILLE ou au MODÈLE.
    return t("vgp.echeance.sans_rythme");
  }
  const date = dateCivile(etat.prochaineEcheance);
  if (etat.joursAvantEcheance !== null && etat.joursAvantEcheance < 0) {
    const joursDepasses = -etat.joursAvantEcheance;
    // Accordé au nombre réel (lot AV-14, 19/09/2026) — « (1 jours) » était
    // l'un des cinq pluriels invariants mesurés à demeure. Un ternaire local,
    // jamais `decompte()` : ce fichier vit dans `lib/`, qui ne dépend jamais
    // de `app/` (§6).
    const unite =
      joursDepasses === 1 ? t("vgp.echeance.jour_un") : t("vgp.echeance.jours");
    return `${t("vgp.echeance.depassee")} — ${date} (${joursDepasses} ${unite})`;
  }
  return `${t("vgp.echeance.declaree")} — ${date}`;
}
