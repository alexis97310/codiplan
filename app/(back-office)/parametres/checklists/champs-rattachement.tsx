import { CaseACocher } from "@/components/ui/case-a-cocher";
import { t } from "@/lib/i18n/fr";
import type {
  LigneFamille,
  LigneModele,
  LigneSousType,
} from "@/lib/materiel/depot";

/**
 * LE RATTACHEMENT D'UN MODÈLE DE CHECKLIST (sous-type, famille ou modèle de
 * machine) et la case « Exige une machine » — partagés par la création, la
 * duplication ET le départ depuis un gabarit (9L04B-GABARIT-RATTACHEMENT) :
 * même composant, mêmes libellés, mêmes options de société. AU PLUS un
 * rattachement et l'appartenance à la société courante ne sont PAS vérifiés
 * ici : la base les tient (contrainte CHECK et clés étrangères composites,
 * D238) — ce composant ne fait que poser les trois champs du formulaire.
 */
export function ChampsRattachement({
  sousTypes,
  familles,
  machinesModeles,
  sousTypeId,
  familleId,
  modeleId,
  exigeMachine,
}: {
  readonly sousTypes: readonly LigneSousType[];
  readonly familles: readonly LigneFamille[];
  readonly machinesModeles: readonly LigneModele[];
  readonly sousTypeId?: string;
  readonly familleId?: string;
  readonly modeleId?: string;
  readonly exigeMachine?: boolean;
}) {
  return (
    <>
      <SelectRattachement
        id="sous_type_id"
        libelle={t("checklist.parametrage.sous_type")}
        libelleAucun={t("checklist.parametrage.sous_type_aucun")}
        options={sousTypes.map((s) => ({ id: s.id, libelle: s.libelle }))}
        valeur={sousTypeId}
      />
      <SelectRattachement
        id="famille_id"
        libelle={t("checklist.parametrage.famille")}
        libelleAucun={t("checklist.parametrage.famille_aucune")}
        options={familles.map((f) => ({ id: f.id, libelle: f.libelle }))}
        valeur={familleId}
      />
      <SelectRattachement
        id="modele_id"
        libelle={t("checklist.parametrage.modele")}
        libelleAucun={t("checklist.parametrage.modele_aucun")}
        options={machinesModeles.map((m) => ({
          id: m.id,
          libelle: `${m.marque} ${m.reference}`,
        }))}
        valeur={modeleId}
      />
      <p className="text-app-encre-faible text-12 font-bold">
        {t("checklist.parametrage.modele_aide")}
      </p>
      <CaseACocher
        name="exige_machine"
        libelle={t("checklist.parametrage.exige_machine")}
        defaultChecked={exigeMachine}
        className="flex items-center gap-2"
      />
    </>
  );
}

function SelectRattachement({
  id,
  libelle,
  libelleAucun,
  options,
  valeur,
}: {
  readonly id: string;
  readonly libelle: string;
  readonly libelleAucun: string;
  readonly options: readonly {
    readonly id: string;
    readonly libelle: string;
  }[];
  readonly valeur?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-app-encre-faible text-12 font-bold">
        {libelle}
      </label>
      <select
        id={id}
        name={id}
        defaultValue={valeur ?? ""}
        className="border-app-bord bg-app-surface min-w-44 rounded-md border px-2 py-1 text-13 font-bold"
      >
        <option value="">{libelleAucun}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.libelle}
          </option>
        ))}
      </select>
    </div>
  );
}
