import { Carte } from "@/components/ui/carte";
import { t } from "@/lib/i18n/fr";

/**
 * LE CHARGEMENT — posé à la racine de `app/` (AV-11).
 *
 * Il vaut pour tout écran, quel que soit le segment : Next l'insère à la place
 * de ce qui met du temps à répondre, jusqu'ici sans aucun état pour le dire —
 * un écran lent ne montrait rien. Il dit qu'on ATTEND, jamais qu'il n'y a
 * rien : ce n'est pas `EtatVide` (§9, D88 — un vide sans mot se lit comme une
 * mesure), et rien ici ne mesure quoi que ce soit.
 *
 * Aucun délai, aucune barre de progression : personne n'a fixé de valeur pour
 * l'un ou l'autre (§8), et `role="status"` suffit à ce qu'un lecteur d'écran
 * l'annonce sans qu'un humain ait à deviner.
 */
export default function Chargement() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-16">
      <Carte className="w-full max-w-md">
        <p
          role="status"
          aria-live="polite"
          className="text-app-encre-faible px-4 py-10 text-center text-[13px]"
        >
          {t("etat.chargement")}
        </p>
      </Carte>
    </div>
  );
}
