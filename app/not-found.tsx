import { Carte } from "@/components/ui/carte";
import { LienPrimaire } from "@/components/ui/action-primaire";
import { t } from "@/lib/i18n/fr";

/**
 * LA PAGE INTROUVABLE — posée à la racine de `app/` (AV-11).
 *
 * Elle remplace la page d'erreur crue de Next pour toute adresse qui ne
 * correspond à aucune route, quel que soit le segment. Une page introuvable
 * propose une SORTIE : un écran sans sortie est une impasse, et `/` reste
 * atteignable quel que soit l'état de session — c'est le seul chemin qu'aucun
 * segment ne peut lui retirer.
 *
 * Elle ne nomme rien de plus qu'« aucun écran ne correspond » : dire pourquoi
 * — société, droit, ressource supprimée — serait un canal d'information
 * soumis au cloisonnement comme une requête (D50).
 */
export default function Introuvable() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-16">
      <Carte titre={t("etat.introuvable.titre")} className="w-full max-w-md">
        <div className="flex flex-col items-center gap-4 px-4 py-8 text-center">
          <p className="text-app-encre-faible text-[13px]">
            {t("etat.introuvable.description")}
          </p>
          <LienPrimaire href="/">{t("etat.retour_accueil")}</LienPrimaire>
        </div>
      </Carte>
    </div>
  );
}
