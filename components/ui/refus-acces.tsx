import Link from "next/link";

import { Role } from "@/lib/auth/roles";
import { t } from "@/lib/i18n/fr";
import { chromeDeLaRequete } from "@/lib/navigation/chrome";

/**
 * LA PAGE DE REFUS NOMMÉ (QT-2, D152) — jamais un renvoi silencieux.
 *
 * Quand un écran du back-office est entièrement fermé à un rôle, la page le
 * rend à la PLACE de son contenu habituel — même gabarit (`<Page>`), même
 * titre — plutôt que de rediriger vers `/connexion` ou `/arrivee`, qui
 * mentiraient sur la raison : la session est valide, le rôle ne porte
 * simplement pas la capacité que cet écran exige.
 *
 * **LE LIEN DÉPEND DU RÔLE (défaut mesuré en ligne par Alexis le 21/10/2026,
 * 9G8-TERRAIN-CONFIRMATIONS-ET-ACCES)** — un ADV qui ouvrait `/parametres/
 * equipe` voyait « ← Retour à ma journée », le vocabulaire du TECHNICIEN, un
 * rôle qu'il n'est pas. Depuis D139, le back-office est de toute façon fermé
 * au technicien AVANT d'atteindre cette page (`app/(back-office)/
 * layout.tsx`) — ce composant ne le voit donc plus jamais en pratique, mais
 * la distinction reste écrite ici, pour tout rôle de bureau qui manquerait
 * une capacité précise.
 */
/**
 * UNE FONCTION, JAMAIS UN `const` AU TEXTE CALCULÉ PAR TERNAIRE — même
 * piège que documenté en tête de `compteur-terrain.tsx` (gardien L0-11).
 */
function libelleDuRetour(estTechnicien: boolean): string {
  if (estTechnicien) {
    return t("terrain.retour");
  }
  return t("planning.retour_fleche");
}

export async function RefusAcces() {
  const { role } = await chromeDeLaRequete();
  const estTechnicien = role === Role.technicien;
  return (
    <div
      role="status"
      className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre flex flex-col gap-2 rounded-lg border px-4 py-6 text-13 font-bold"
    >
      <p>{t("auth.refus_droit")}</p>
      <p>
        <Link
          href={estTechnicien ? "/terrain" : "/planning"}
          className="underline"
        >
          {libelleDuRetour(estTechnicien)}
        </Link>
      </p>
    </div>
  );
}
