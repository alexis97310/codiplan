import { libelleAgenceAvecCode } from "@/lib/agences/presentation";

export type AgenceOption = {
  readonly id: string;
  readonly libelle: string;
  readonly code: string;
};

/**
 * LES OPTIONS D'UN MENU DE RATTACHEMENT (AGENCE-CODE-1).
 *
 * Partagé par tous les écrans où l'on CHOISIT une agence — le rattachement
 * d'un technicien (`parametres/equipe`), le filtre du registre
 * (`/interventions`), et le rattachement d'un site (`/sites/nouveau`,
 * `/sites/[id]`) : un seul endroit compose `libelleAgenceAvecCode`, pour
 * qu'un menu qui l'oublierait se voie au premier `grep`, pas au premier
 * incident. Voir `lib/agences/presentation.ts` pour la raison de la
 * composition elle-même.
 */
export function OptionsAgence({
  agences,
}: {
  readonly agences: readonly AgenceOption[];
}) {
  return (
    <>
      {agences.map((agence) => (
        <option key={agence.id} value={agence.id}>
          {libelleAgenceAvecCode(agence.libelle, agence.code)}
        </option>
      ))}
    </>
  );
}
