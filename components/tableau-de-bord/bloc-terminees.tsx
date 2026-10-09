import Link from "next/link";

import { Carte } from "@/components/ui/carte";
import { Icone } from "@/components/ui/icone";
import { t } from "@/lib/i18n/fr";

/**
 * « TERMINÉES : VALIDER LE RAPPORT, PUIS CLÔTURER » — `controleCard()` de la
 * maquette du 28/09 (:2818-2822), responsable SAV seulement
 * (9EG-TP-UX6-TABLEAU-DE-BORD-1).
 *
 * **Sans la mention « rapport validé / à valider »** de la maquette — mesuré
 * (constat T5d de l'addendum du 09/10) : `temps_valide_le` n'est posé qu'à
 * l'instant de la CLÔTURE, jamais pendant que l'intervention est encore
 * « terminée » ; en faire un décompte distinct inventerait un état que ce
 * dépôt ne mesure pas encore. Le lot du registre l'ajoutera (D185, décision
 * 48).
 */
export type LigneTerminee = {
  readonly id: string;
  readonly reference: string;
  readonly clientNom: string;
  readonly technicienId: string | null;
  readonly datePlanifiee: Date | null;
  readonly signature?: {
    readonly issue: string;
    readonly motif: string | null;
    readonly signataireNom: string | null;
  };
};

export function BlocTerminees({
  lignes,
  nomDuTechnicien,
  jourEcrit,
}: Readonly<{
  readonly lignes: readonly LigneTerminee[];
  readonly nomDuTechnicien: (technicienId: string | null) => string;
  readonly jourEcrit: (date: Date | null) => string;
}>) {
  return (
    <Carte
      titre={t("tableau_de_bord.bloc_controle_titre")}
      icone="check-circle"
      compte={lignes.length}
    >
      {lignes.map((ligne) => (
        <Link
          key={ligne.id}
          href={`/interventions/${ligne.id}?depuis=tableau_de_bord`}
          className="border-app-bord flex items-center gap-[10px] border-b px-[16px] py-[12px] text-13 font-bold last:border-b-0"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold">
              {ligne.clientNom}
              {t("ponctuation.point_median")}
              {ligne.reference}
            </div>
            <div className="text-app-encre-faible truncate text-12 font-bold">
              {nomDuTechnicien(ligne.technicienId)}
              {t("ponctuation.point_median")}
              {jourEcrit(ligne.datePlanifiee)}
              {t("ponctuation.point_median")}
              {texteSignature(ligne.signature)}
            </div>
          </div>
          <Icone nom="chev-r" taille={16} />
        </Link>
      ))}
    </Carte>
  );
}

function texteSignature(signature: LigneTerminee["signature"]): string {
  if (signature === undefined) {
    return t("tableau_de_bord.bloc_controle_sans_signature");
  }
  if (signature.issue === "client_absent") {
    return t("tableau_de_bord.bloc_controle_absent");
  }
  if (signature.issue === "refus_signature") {
    return t("tableau_de_bord.bloc_controle_refus");
  }
  return `${t("tableau_de_bord.bloc_controle_signee_prefixe")} ${signature.signataireNom ?? ""}`;
}
