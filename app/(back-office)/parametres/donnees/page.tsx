import type { Metadata } from "next";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Carte } from "@/components/ui/carte";
import { Kpi } from "@/components/ui/kpi";
import { Page } from "@/components/mise-en-page/page";
import { RefusAcces } from "@/components/ui/refus-acces";
import { peutPleinement } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import {
  instantDuJour,
  jourDe,
  maintenant,
  schemaFuseau,
} from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { compterClients } from "@/lib/clients/depot";
import { schemaRechercheClient } from "@/lib/clients/saisie";
import { t } from "@/lib/i18n/fr";
import { compterInterventionsSansDuree } from "@/lib/interventions/depot";
import { compterLeParc } from "@/lib/machines/depot";
import { schemaRechercheParc } from "@/lib/machines/saisie";
import { famillesADeterminer } from "@/lib/vgp/registre";

export const metadata: Metadata = { title: t("donnees_a_completer.titre") };

/**
 * « DONNÉES À COMPLÉTER » — LA PORTE DÉTECTIVE DE L'ADV (9DT-TP-MOD2-
 * INDICATEURS-DONNEES, QE-19, MO-7, D170).
 *
 * ## CE QU'ELLE RASSEMBLE, ET POURQUOI ICI
 *
 * Quatre points que l'audit du 28/09 (MO-7) nomme comme déjà DÉTECTÉS —
 * chacun porte déjà sa propre liste ailleurs dans le dépôt — mais jamais
 * RASSEMBLÉS sous un même toit : un ADV qui veut savoir « qu'est-ce qu'il
 * reste à compléter » devait déjà savoir où chercher chacun séparément.
 *
 * **Chaque chiffre est `.length` (ou le compte) de la LISTE qu'il ouvre**
 * (§9, 01/09) — jamais un second calcul : `compterInterventionsSansDuree`,
 * `famillesADeterminer`, `compterClients` (avec `sans_code_externe`),
 * `compterLeParc` (avec `incompletes`) sont les MÊMES fonctions que les
 * écrans de destination.
 *
 * ## CE QUE CE LOT N'AJOUTE PAS (CHOIX DU PILOTE, D170)
 *
 * Le ticket nomme explicitement cinq AUTRES points (sites sans zone/trajet,
 * agences sans horaires, imports avec rejets, personne prévenue, zones sans
 * forfait) comme HORS DE CE LOT. Ils n'ont ni ligne ni requête ici.
 */
export default async function PageDonneesACompleter() {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }
  const contexte = session.contexte;

  // OUVERTE À L'ADV (QE-19, D170) — même capacité que la porte du hub
  // (`lib/navigation/portes-parametrage.ts`) : `gerer_client_site` couvre
  // exactement admin_societe, direction, adv.
  if (
    contexte.role === null ||
    !peutPleinement(contexte.role, "gerer_client_site")
  ) {
    return (
      <Page chemin="/parametres" titre={t("donnees_a_completer.titre")}>
        <RefusAcces />
      </Page>
    );
  }

  const societe = await avecContexteApplicatif(contexte, (tx) =>
    tx.societe.findFirst({
      where: { id: contexte.societeId as string },
      select: { fuseau_horaire: true },
    }),
  );
  const fuseau = schemaFuseau.parse(societe?.fuseau_horaire);
  const debutDuJour = instantDuJour(jourDe(maintenant(fuseau).local));

  const baseClients = schemaRechercheClient.parse({});
  const baseParc = schemaRechercheParc.parse({});

  const [
    interventionsSansDuree,
    familles,
    clientsSansCode,
    machinesIncompletes,
  ] = await Promise.all([
    compterInterventionsSansDuree(contexte, debutDuJour),
    famillesADeterminer(contexte),
    compterClients(contexte, { ...baseClients, sans_code_externe: true }),
    compterLeParc(contexte, { ...baseParc, incompletes: true }),
  ]);

  return (
    <Page
      chemin="/parametres"
      titre={t("donnees_a_completer.titre")}
      // FIL D'ARIANE (9DR-TP-NAV2-RETOURS-FIL, D168) — remplace
      // `<RetourParametres />`, retiré.
      filAriane={[
        { libelle: t("nav.societes_tarifs"), href: "/parametres" },
        { libelle: t("donnees_a_completer.titre") },
      ]}
      sousTitre={t("donnees_a_completer.sous_titre")}
    >
      <Carte>
        <div className="grid gap-3 p-[16px] sm:grid-cols-2 lg:grid-cols-4">
          <div data-bloc="kpi-interventions-sans-duree">
            <Kpi
              libelle={t("donnees_a_completer.kpi_interventions_sans_duree")}
              valeur={interventionsSansDuree}
              href="/interventions?sans_duree_a_venir=1&vue=toutes"
            />
          </div>
          <div data-bloc="kpi-vgp-a-determiner">
            <Kpi
              libelle={t("donnees_a_completer.kpi_vgp_a_determiner")}
              valeur={familles.length}
              href="/vgp/a-determiner"
            />
          </div>
          <div data-bloc="kpi-clients-sans-code">
            {/* `sans_equipement=1` ACCOMPAGNE `sans_code_externe=1` — sans
                lui, `/clients` masquerait par défaut (LISTES-1) tout client
                sans équipement, et la liste montrerait MOINS de lignes que
                ce chiffre n'en compte (`baseClients` ci-dessus porte
                `inclure_sans_equipement: true`, le défaut HORS de l'écran
                `/clients`) — exactement la divergence que §9 (01/09) nomme. */}
            <Kpi
              libelle={t("donnees_a_completer.kpi_clients_sans_code")}
              valeur={clientsSansCode}
              href="/clients?sans_code_externe=1&sans_equipement=1"
            />
          </div>
          <div data-bloc="kpi-machines-incompletes">
            <Kpi
              libelle={t("donnees_a_completer.kpi_machines_incompletes")}
              valeur={machinesIncompletes}
              href="/parc?incompletes=1"
            />
          </div>
        </div>
      </Carte>
    </Page>
  );
}
