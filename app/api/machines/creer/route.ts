import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { creerMachine } from "@/lib/machines/depot";
import { schemaMachine } from "@/lib/machines/saisie";

import { champ } from "../../interventions/actions";

const STATUTS_REFUSES_A_LA_CREATION = [
  "remplacee",
  "ferraillee",
  "fusionnee",
] as const;

/**
 * CRÉER UNE FICHE MACHINE (AT-07 bis, 18/09/2026) — le premier appelant de
 * `creerMachineDans` depuis un écran (R6-03).
 *
 * **Deux formes de réponse, une seule décision** — même raisonnement que
 * `app/api/interventions/[id]/deplacer/route.ts` : le formulaire attend une
 * réponse JSON qu'il interprète lui-même (D-06, `FormulaireMachine`), la
 * négociation portant sur l'en-tête `Accept` que ce composant pose.
 *
 * **Le refus revient sur le formulaire, jamais sur la liste** : perdre la
 * saisie apprendrait à ne plus faire confiance à l'écran (même raison que
 * `app/api/clients/creer/route.ts`).
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const enJson = (requete.headers.get("accept") ?? "").includes(
    "application/json",
  );
  const versLeFormulaire = (cle: string): Response =>
    enJson
      ? Response.json({ accepte: false, cle, id: null })
      : new Response(null, {
          status: 303,
          headers: {
            Location: `/parc/nouvelle?motif=${encodeURIComponent(cle)}`,
          },
        });
  const versLaFiche = (id: string): Response =>
    enJson
      ? Response.json({ accepte: true, cle: null, id })
      : new Response(null, {
          status: 303,
          headers: {
            Location: `/parc/${id}?motif=${encodeURIComponent("machine.creee")}`,
          },
        });

  const contexte = await exigerCapacite("gerer_machine");
  if (contexte === null) {
    return versLeFormulaire(await motifDuRefus());
  }

  const formulaire = await requete.formData();

  // TROIS ÉTATS SEULEMENT À LA CRÉATION (décision d'Alexis du 05/10/2026,
  // n° 21, PV-27 ; D184) — `schemaMachine` continue d'accepter les six
  // statuts, pour la modification et l'import ; cette route-ci, seule, en
  // refuse trois. Posé AVANT `schemaMachine.safeParse` : un statut refusé ici
  // ne doit jamais atteindre le dépôt.
  const statutBrut = champ(formulaire, "statut");
  if (
    statutBrut !== null &&
    STATUTS_REFUSES_A_LA_CREATION.includes(
      statutBrut as (typeof STATUTS_REFUSES_A_LA_CREATION)[number],
    )
  ) {
    return versLeFormulaire("machine.refus.statut_creation");
  }

  const saisie = schemaMachine.safeParse({
    modele_id: champ(formulaire, "modele_id") ?? "",
    client_id: champ(formulaire, "client_id") ?? "",
    site_id: champ(formulaire, "site_id") ?? "",
    numero_serie: champ(formulaire, "numero_serie") ?? "",
    reference_interne: champ(formulaire, "reference_interne"),
    localisation: champ(formulaire, "localisation"),
    facture_origine: champ(formulaire, "facture_origine"),
    date_mise_en_service: dateDuFormulaire(
      champ(formulaire, "date_mise_en_service"),
    ),
    date_vente: dateDuFormulaire(champ(formulaire, "date_vente")),
    garantie_fin: dateDuFormulaire(champ(formulaire, "garantie_fin")),
    statut: champ(formulaire, "statut") ?? undefined,
    criticite: champ(formulaire, "criticite") ?? undefined,
  });
  if (!saisie.success) {
    return versLeFormulaire("machine.refus.saisie");
  }

  const resultat = await creerMachine(contexte, saisie.data);
  if (!resultat.accepte) {
    return versLeFormulaire(`machine.refus.${resultat.motif}`);
  }
  return versLaFiche(resultat.id);
}

/**
 * `2026-09-18` (un `<input type="date">`) en `Date` UTC minuit, ou `null`. En
 * UTC : ces trois colonnes sont `@db.Date`, sans fuseau, et un `Date` local
 * décalerait le jour d'un cran sous UTC+11 (même raison que `heure_debut`
 * dans `app/api/interventions/[id]/deplacer/route.ts`).
 */
function dateDuFormulaire(valeur: string | null): Date | null {
  return valeur === null ? null : new Date(`${valeur}T00:00:00.000Z`);
}
