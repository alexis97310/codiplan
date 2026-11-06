import { explicationRegle } from "@/lib/interventions/presentation-partagee";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { formatMoney } from "@/lib/money";

import type {
  BaremePortail,
  ForfaitDuBareme,
} from "@/app/api/portail/tarifs/lecture";

/**
 * CE QUE L'ÉCRAN DU BARÈME PORTAIL ÉCRIT, COMPOSÉ HORS DU JSX (L0-11) —
 * même raison que `../presentation.ts`.
 *
 * **ÉCRITE ICI PLUTÔT QU'IMPORTÉE DE `app/(back-office)/parametres/
 * forfaits/presentation.ts`** (§6 : chaque domaine porte la sienne) : aucun
 * fichier du dépôt n'importe aujourd'hui d'un groupe de routes vers l'autre,
 * et cette page est en lecture seule — elle n'a besoin ni du verdict de
 * sélection ni du rang, seulement de dire ce qu'un forfait exige.
 */

/**
 * Un pourcentage lu d'un `Decimal` de société, DÉJÀ en texte
 * (`Decimal.toString()`, posé par `./lecture.ts`) — jamais un `toFixed` ni
 * `Intl` ici : le gardien I3 (`tests/unit/money/sans-decimales-en-dur.test.ts`)
 * refuse les deux sur tout le dépôt applicatif, pourcentage compris, et la
 * précision exacte est déjà celle que `Decimal.toString()` a rendue.
 */
export function pourcentageAffiche(valeurEnTexte: string): string {
  return `${valeurEnTexte.replace(".", ",")} %`;
}

function zoneAffichee(zone: string): string {
  const cle = `zone.${zone}`;
  return estCleTraduction(cle) ? t(cle) : zone;
}

function categorieAffichee(type: string): string {
  const cle = `type_forfait.${type}`;
  return estCleTraduction(cle) ? t(cle) : type;
}

/**
 * Ce qu'un forfait exige, en clair — même logique que `resumeConditions`
 * du back-office (l'absence de condition sur un axe n'écarte rien, voir
 * `lib/tarification/forfaits.ts`), écrite ici pour cette page.
 */
function conditionsAffichees(forfait: {
  readonly zoneGeo: readonly string[];
  readonly familleId: string | null;
  readonly typeIntervention: readonly string[];
}): string {
  const parts: string[] = [];
  if (forfait.zoneGeo.length > 0) {
    parts.push(forfait.zoneGeo.map((zone) => zoneAffichee(zone)).join(", "));
  }
  if (forfait.familleId !== null) {
    parts.push(t("forfaits.condition_famille"));
  }
  if (forfait.typeIntervention.length > 0) {
    parts.push(forfait.typeIntervention.join(", "));
  }
  return parts.length === 0 ? t("forfaits.sans_condition") : parts.join(" · ");
}

export type ForfaitAffiche = {
  readonly id: string;
  readonly libelle: string;
  readonly categorie: string;
  readonly conditions: string;
  readonly montant: string;
};

export type BaremeAffiche = {
  readonly tauxHoraire: string;
  readonly majoration: string;
  readonly regleFacturation: string;
  readonly forfaits: readonly ForfaitAffiche[];
};

function forfaitAffiche(
  forfait: ForfaitDuBareme,
  devise: BaremePortail["devise"],
): ForfaitAffiche {
  return {
    id: forfait.id,
    libelle: forfait.libelle,
    categorie: categorieAffichee(forfait.type),
    conditions: conditionsAffichees(forfait),
    montant: formatMoney(forfait.montant, devise),
  };
}

export function baremeAffiche(bareme: BaremePortail): BaremeAffiche {
  return {
    tauxHoraire:
      bareme.tauxHoraire === null
        ? t("portail.tarifs.taux_absent")
        : formatMoney(bareme.tauxHoraire, bareme.devise),
    majoration: pourcentageAffiche(bareme.majorationHorsOuverturePct),
    regleFacturation: explicationRegle(bareme.regleArrondi),
    forfaits: bareme.forfaits.map((f) => forfaitAffiche(f, bareme.devise)),
  };
}
