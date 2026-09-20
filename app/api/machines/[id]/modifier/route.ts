import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { modifierMachine } from "@/lib/machines/depot";
import { schemaMachine } from "@/lib/machines/saisie";

import { champ } from "../../../interventions/actions";

/**
 * CORRIGER UNE FICHE MACHINE (AT-07 bis, 18/09/2026) — le premier appelant de
 * `modifierMachineDans` depuis un écran.
 *
 * **`modele_id`, `client_id` et `site_id` voyagent en champs CACHÉS**, posés
 * par `FormulaireMachine` avec la valeur actuelle de la fiche : `schemaMachine`
 * les exige tous les trois, alors que `modifierMachineDans` n'en écrit
 * aucun (voir sa note de tête, `lib/machines/depot.ts`). Les recevoir sans
 * les écrire n'est pas une incohérence — c'est `champsMachine` qui les
 * réclame, et cette route ne rejuge pas cette exigence pour l'ignorer à
 * moitié.
 */
export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete, params));
}

async function traiter(
  requete: Request,
  params: Promise<{ id: string }>,
): Promise<Response> {
  const { id } = await params;
  const enJson = (requete.headers.get("accept") ?? "").includes(
    "application/json",
  );
  const versLeFormulaire = (cle: string): Response =>
    enJson
      ? Response.json({ accepte: false, cle, id: null })
      : new Response(null, {
          status: 303,
          headers: {
            Location: `/parc/${id}/modifier?motif=${encodeURIComponent(cle)}`,
          },
        });
  const versLaFiche = (): Response =>
    enJson
      ? Response.json({ accepte: true, cle: null, id })
      : new Response(null, {
          status: 303,
          headers: {
            Location: `/parc/${id}?motif=${encodeURIComponent("machine.modifiee")}`,
          },
        });

  const contexte = await exigerCapacite("gerer_machine");
  if (contexte === null) {
    return versLeFormulaire("auth.refus");
  }

  const formulaire = await requete.formData();
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
    criticite: champ(formulaire, "criticite") ?? undefined,
  });
  if (!saisie.success) {
    return versLeFormulaire("machine.refus.saisie");
  }

  const resultat = await modifierMachine(contexte, id, saisie.data);
  if (!resultat.accepte) {
    return versLeFormulaire(`machine.refus.${resultat.motif}`);
  }
  return versLaFiche();
}

/** Voir `app/api/machines/creer/route.ts` — même lecture, même raison. */
function dateDuFormulaire(valeur: string | null): Date | null {
  return valeur === null ? null : new Date(`${valeur}T00:00:00.000Z`);
}
