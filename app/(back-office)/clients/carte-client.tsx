import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { CarteEntite } from "@/components/ui/carte-entite";
import { type FicheClient, type SitesDUnClient } from "@/lib/clients";
import { t } from "@/lib/i18n/fr";
import { CLASSES_LIEN } from "@/lib/theme/apparence";

import {
  codeEtCommune,
  compteurEquipements,
  compteurSites,
  referentClient,
} from "./presentation";

/**
 * LA CARTE D'UN CLIENT — extraite de `page.tsx` (D122/CS1, audit du
 * 28/09/2026) : un fichier de `page.tsx` n'accepte que les exports que
 * Next.js reconnaît (`default`, `metadata`, …), et un composant exporté pour
 * un gardien de rendu (`tests/unit/clients/carte-badge.test.tsx`) doit donc
 * vivre ailleurs — même raison que `BarreDeNavigation` vit hors d'un
 * `layout.tsx`.
 */
export function CarteClient({
  client,
  sites,
  nombreEquipements,
}: {
  readonly client: FicheClient;
  readonly sites: SitesDUnClient | undefined;
  readonly nombreEquipements: number;
}) {
  const referent = referentClient(client.commercial_referent);
  return (
    <CarteEntite
      titre={
        <Link href={`/clients/${client.id}`} className={CLASSES_LIEN}>
          {client.raison_sociale}
        </Link>
      }
      badge={
        client.actif ? (
          <Badge ton="vert">{t("client.actif")}</Badge>
        ) : (
          <Badge ton="gris">{t("clients.inactif")}</Badge>
        )
      }
      lignes={
        referent === null
          ? [codeEtCommune(client.code_externe, sites)]
          : [codeEtCommune(client.code_externe, sites), referent]
      }
      compteurs={[compteurSites(sites), compteurEquipements(nombreEquipements)]}
    />
  );
}
