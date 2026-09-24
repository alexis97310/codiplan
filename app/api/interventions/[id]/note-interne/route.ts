import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { enregistrerNoteInterne } from "@/lib/interventions/depot";
import { schemaNoteInterne } from "@/lib/interventions/saisie";

import { avecFilet, champ, versLaFiche } from "../../actions";

/**
 * LA NOTE INTERNE (50-INTERVENTIONS-2) — visible et modifiable par les rôles
 * BACK-OFFICE seulement, jamais sur le terrain, le bon, le portail ou un
 * courriel.
 *
 * `modifier_planning` — la même capacité que « Déplacer »/« Planifier » sur
 * cette même fiche : elle ne compte AUCUN rôle terrain (`TEC`) dans la
 * matrice, à la différence de `consulter_planning` qui l'accorde en
 * « restreint ». La réutiliser plutôt qu'inventer une capacité évite d'ouvrir,
 * par une requête forgée, une écriture que le technicien ne voit jamais à
 * l'écran.
 *
 * Un champ vidé écrit `null` — `champ()` le fait déjà avant que le schéma ne
 * le refasse, et les deux s'accordent : une note qu'on efface n'est pas une
 * note vide.
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
  return avecFilet(id, "note-interne", async () => {
    const contexte = await exigerCapacite("modifier_planning");
    if (contexte === null) {
      return versLaFiche(id, "auth.refus");
    }
    const formulaire = await requete.formData();
    const saisie = schemaNoteInterne.safeParse({
      intervention_id: id,
      note_interne: champ(formulaire, "note_interne") ?? "",
    });
    if (!saisie.success) {
      return versLaFiche(id, "intervention.refus.inconnue");
    }
    const resultat = await enregistrerNoteInterne(contexte, saisie.data);
    return versLaFiche(
      id,
      resultat === null ? "intervention.refus.inconnue" : undefined,
    );
  });
}
