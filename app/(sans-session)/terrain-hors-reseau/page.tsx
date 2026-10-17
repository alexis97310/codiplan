import type { Metadata } from "next";

import { Suspense } from "react";

import { ConsultationHorsReseau } from "@/components/terrain/consultation-hors-reseau";
import { t } from "@/lib/i18n/fr";

export const metadata: Metadata = { title: t("terrain.hors_reseau.titre") };

/**
 * `/terrain-hors-reseau` — LA COQUILLE SANS DONNÉE (point 4,
 * 9F4H1-HORS-RESEAU-CONSULTATION).
 *
 * ## PUBLIQUE, ET IDENTIQUE POUR TOUT LE MONDE — C'EST LE CRITÈRE D'ADMISSION
 * DU SERVICE WORKER
 *
 * Même règle que `/sante` et `/connexion` (`public/sw.js`, en-tête) : *une
 * route entre dans la coquille si elle est identique pour tout le monde.*
 * Cette page ne lit NI session NI base — tout ce qui distingue une personne
 * d'une autre vient d'IndexedDB, lu par le composant client, APRÈS que le
 * HTML, identique pour tout le monde, a été servi par le cache.
 *
 * ## POURQUOI ELLE EST ATTEIGNABLE PAR DEUX CHEMINS
 *
 * Un lien direct (`?id=<uuid>`), et la redirection du service worker quand
 * `/terrain` ou `/terrain/<uuid>` échoue hors réseau — l'URL D'ORIGINE reste
 * alors dans la barre d'adresse, et c'est `ConsultationHorsReseau` qui la lit
 * pour savoir quelle fiche ouvrir (voir son commentaire).
 */
export default function PageTerrainHorsReseau() {
  return (
    <Suspense>
      <ConsultationHorsReseau />
    </Suspense>
  );
}
