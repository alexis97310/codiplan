import Link from "next/link";

import { t } from "@/lib/i18n/fr";

/**
 * LA PAGE DE REFUS NOMMÉ (QT-2, D152) — jamais un renvoi silencieux.
 *
 * Quand un écran du back-office est entièrement fermé à un rôle (le registre
 * et le tableau de bord pour un technicien, par exemple), la page le rend à
 * la PLACE de son contenu habituel — même gabarit (`<Page>`), même titre —
 * plutôt que de rediriger vers `/connexion` ou `/arrivee`, qui mentiraient
 * sur la raison : la session est valide, le rôle ne porte simplement pas la
 * capacité que cet écran exige.
 *
 * Le lien ramène vers `/terrain` (« Ma journée ») — la seule destination
 * qu'un technicien restreint est assuré de pouvoir ouvrir.
 */
export function RefusAcces() {
  return (
    <div
      role="status"
      className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre flex flex-col gap-2 rounded-lg border px-4 py-6 text-13 font-bold"
    >
      <p>{t("auth.refus_droit")}</p>
      <p>
        <Link href="/terrain" className="underline">
          {t("terrain.retour")}
        </Link>
      </p>
    </div>
  );
}
