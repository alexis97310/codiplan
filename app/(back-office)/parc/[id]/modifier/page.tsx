import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { FormulaireMachine } from "@/components/parc/formulaire-machine";
import { obtenirSession } from "@/lib/auth/session";
import { estCleTraduction, t, type CleTraduction } from "@/lib/i18n/fr";
import { lireMachine, type FicheMachine } from "@/lib/machines/depot";

export const metadata: Metadata = { title: t("machine.modifier.titre") };

/**
 * CORRIGER UNE FICHE MACHINE (AT-07 bis — R6-03).
 *
 * **Le modèle, le client, le site et le statut ne sont pas des champs de ce
 * formulaire** — voir la note de tête de `modifierMachineDans`
 * (`lib/machines/depot.ts`) et celle de `FormulaireMachine` : ils
 * s'affichent en lecture seule, dans l'ordre de D126, et voyagent en champs
 * cachés vers la route pour satisfaire `schemaMachine`, qui les exige sans
 * que `modifierMachineDans` les écrive.
 */
export default async function PageModifierMachine({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }
  const contexte = session.contexte;

  const { id } = await params;
  const machine = await lireMachine(contexte, id);
  if (machine === null) {
    notFound();
  }

  const motif = (await searchParams).motif;
  const motifInitial: CleTraduction | undefined =
    typeof motif === "string" && estCleTraduction(motif) ? motif : undefined;

  return (
    <Page
      chemin="/parc"
      titre={t("machine.modifier.titre")}
      sousTitre={t("machine.modifier.sous_titre")}
      actions={
        <Link
          href={`/parc/${machine.id}`}
          className="text-app-encre-faible text-[12.5px]"
        >
          {t("machine.modifier.retour")}
        </Link>
      }
    >
      <FormulaireMachine
        mode="modification"
        action={`/api/machines/${machine.id}/modifier`}
        motifSucces="machine.modifiee"
        modeles={[]}
        clients={[]}
        sites={[]}
        motifInitial={motifInitial}
        lectureSeule={{
          modeleId: machine.modele_id,
          clientId: machine.client_id,
          siteId: machine.site_id,
          familleLibelle:
            machine.modele.famille?.libelle ?? t("parc.a_completer"),
          marque: machine.modele.marque,
          reference: machine.modele.reference,
          clientLibelle: machine.client.raison_sociale,
          siteLibelle: machine.site.libelle,
        }}
        valeurs={{
          numeroSerie: machine.numero_serie,
          referenceInterne: machine.reference_interne ?? "",
          localisation: machine.localisation ?? "",
          factureOrigine: machine.facture_origine ?? "",
          dateMiseEnService: dateFormulaire(machine.date_mise_en_service),
          dateVente: dateFormulaire(machine.date_vente),
          garantieFin: dateFormulaire(machine.garantie_fin),
          criticite: machine.criticite,
        }}
      />
    </Page>
  );
}

/**
 * `Date` UTC minuit vers `2026-09-18` pour un `<input type="date">`, ou la
 * chaîne vide. **En UTC**, jamais via un `Date` local : ces colonnes sont
 * `@db.Date`, sans fuseau (même lecture que `anneeDeVenteAffichee` sur
 * `/parc`).
 */
function dateFormulaire(date: FicheMachine["date_vente"]): string {
  if (date === null) {
    return "";
  }
  const annee = String(date.getUTCFullYear()).padStart(4, "0");
  const mois = String(date.getUTCMonth() + 1).padStart(2, "0");
  const jour = String(date.getUTCDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}
