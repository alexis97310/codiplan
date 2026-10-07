import { Badge } from "@/components/ui/badge";
import { CarteEntite } from "@/components/ui/carte-entite";
import { type FicheClient, type SitesDUnClient } from "@/lib/clients";
import type { ResumeCarteClient } from "@/lib/clients/depot";
import { t } from "@/lib/i18n/fr";

import {
  chiffreAPlanifier,
  chiffreDerniereIntervention,
  chiffreMachines,
  chiffreSites,
  codeEtCommune,
  libelleDonneurOrdre,
} from "./presentation";

/**
 * LA CARTE D'UN CLIENT — gabarit de la maquette du 28/09 (`.ent`, QE-13c,
 * 9EB-TP-UX3-2-LISTES-1), qui REMPLACE le gabarit N-08/D123 de LISTES-1 sur
 * cette seule carte (D178). Extraite de `page.tsx` pour la même raison
 * qu'avant ce ticket (D122/CS1) : un gardien de rendu
 * (`tests/unit/clients/carte-badge.test.tsx`) a besoin d'un export que
 * `page.tsx` ne peut pas porter.
 *
 * **La carte entière ouvre la fiche** — `href` de `CarteEntite` — plutôt que
 * le seul titre souligné d'avant. **Le commercial référent disparaît** de
 * cette carte (il ne vivait que sur cette carte, jamais sur la fiche) : la
 * maquette du 28/09 ne le montre pas, elle montre le donneur d'ordre à sa
 * place — une notion différente, lue par `resumeDesCartesClients`.
 */
export function CarteClient({
  client,
  sites,
  resume,
  aujourdHui,
}: {
  readonly client: FicheClient;
  readonly sites: SitesDUnClient | undefined;
  readonly resume: ResumeCarteClient | undefined;
  readonly aujourdHui: Date;
}) {
  const donneurOrdre = resume?.donneurOrdre ?? null;
  return (
    <CarteEntite
      href={`/clients/${client.id}`}
      titre={client.raison_sociale}
      badge={
        client.actif ? (
          <Badge ton="vert">{t("client.actif")}</Badge>
        ) : (
          <Badge ton="gris">{t("clients.inactif")}</Badge>
        )
      }
      lignes={[
        codeEtCommune(client.code_externe, sites),
        donneurOrdre === null ? (
          <span className="text-app-orange-encre">
            {t("clients.donneur_ordre_aucun")}
          </span>
        ) : (
          libelleDonneurOrdre(donneurOrdre)
        ),
      ]}
      compteurs={[]}
      chiffres={[
        // `id` sur chaque chiffre (REPRISE-3) : la prise stable qu'un
        // scénario de bout en bout vise, plutôt qu'un compte total de `<b>`.
        { ...chiffreSites(sites), id: "sites" },
        { ...chiffreMachines(resume?.nombreMachines ?? 0), id: "machines" },
        {
          ...chiffreAPlanifier(resume?.nombreAPlanifier ?? 0),
          id: "a-planifier",
        },
        {
          ...chiffreDerniereIntervention(
            resume?.derniereIntervention ?? null,
            aujourdHui,
          ),
          id: "derniere-intervention",
        },
      ]}
    />
  );
}
