"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Carte } from "@/components/ui/carte";
import { CaseACocher } from "@/components/ui/case-a-cocher";
import { ActionPrimaire } from "@/components/ui/action-primaire";
import { t } from "@/lib/i18n/fr";
import { TYPES_REPONSE_CHECKLIST } from "@/lib/checklists/saisie";

type TypeReponse = (typeof TYPES_REPONSE_CHECKLIST)[number];

/** Une ligne de l'éditeur — toujours du TEXTE, converti au moment de soumettre. */
type LignePoint = {
  readonly cle: string;
  section: string;
  ordre: string;
  libelle: string;
  consigne: string;
  obligatoire: boolean;
  typeReponse: TypeReponse;
  unite: string;
  toleranceMin: string;
  toleranceMax: string;
  choixTexte: string;
};

export type PointInitial = {
  readonly section: string;
  readonly ordre: number;
  readonly libelle: string;
  readonly consigne: string | null;
  readonly obligatoire: boolean;
  readonly typeReponse: string;
  readonly unite: string | null;
  readonly toleranceMin: string | null;
  readonly toleranceMax: string | null;
  readonly choix: readonly string[];
};

function cleNouvelle(): string {
  return Math.random().toString(36).slice(2);
}

function ligneVide(ordre: number): LignePoint {
  return {
    cle: cleNouvelle(),
    section: "",
    ordre: String(ordre),
    libelle: "",
    consigne: "",
    obligatoire: false,
    typeReponse: "conforme_non_conforme_sans_objet",
    unite: "",
    toleranceMin: "",
    toleranceMax: "",
    choixTexte: "",
  };
}

function depuisPointInitial(point: PointInitial): LignePoint {
  return {
    cle: cleNouvelle(),
    section: point.section,
    ordre: String(point.ordre),
    libelle: point.libelle,
    consigne: point.consigne ?? "",
    obligatoire: point.obligatoire,
    typeReponse: point.typeReponse as TypeReponse,
    unite: point.unite ?? "",
    toleranceMin: point.toleranceMin ?? "",
    toleranceMax: point.toleranceMax ?? "",
    choixTexte: point.choix.join("\n"),
  };
}

/**
 * Traduit une ligne du formulaire vers la forme attendue par
 * `schemaPointChecklist` (`lib/checklists/saisie.ts`) — un champ hors du
 * type de la ligne est simplement OMIS, jamais envoyé vide : le dépôt ne
 * regarde que ceux de son propre type (choix_dans_une_liste excepté, qui les
 * exige).
 */
function versLaSaisie(ligne: LignePoint): Record<string, unknown> {
  const commun = {
    section: ligne.section,
    ordre: Number(ligne.ordre),
    libelle: ligne.libelle,
    consigne: ligne.consigne.trim() === "" ? undefined : ligne.consigne,
    obligatoire: ligne.obligatoire,
    typeReponse: ligne.typeReponse,
  };
  if (ligne.typeReponse === "valeur_mesuree") {
    return {
      ...commun,
      unite: ligne.unite.trim() === "" ? undefined : ligne.unite,
      toleranceMin:
        ligne.toleranceMin.trim() === ""
          ? undefined
          : Number(ligne.toleranceMin),
      toleranceMax:
        ligne.toleranceMax.trim() === ""
          ? undefined
          : Number(ligne.toleranceMax),
    };
  }
  if (ligne.typeReponse === "choix_dans_une_liste") {
    return {
      ...commun,
      choix: ligne.choixTexte
        .split("\n")
        .map((choix) => choix.trim())
        .filter((choix) => choix !== ""),
    };
  }
  return commun;
}

export function EditeurVersion({
  action,
  pointsInitiaux,
  hrefAnnuler,
}: {
  readonly action: string;
  readonly pointsInitiaux: readonly PointInitial[];
  readonly hrefAnnuler: string;
}) {
  const [lignes, setLignes] = useState<readonly LignePoint[]>(() =>
    pointsInitiaux.length === 0
      ? [ligneVide(1)]
      : pointsInitiaux.map(depuisPointInitial),
  );

  function modifier(cle: string, changement: Partial<LignePoint>): void {
    setLignes((avant) =>
      avant.map((ligne) =>
        ligne.cle === cle ? { ...ligne, ...changement } : ligne,
      ),
    );
  }

  function ajouter(): void {
    setLignes((avant) => [...avant, ligneVide(avant.length + 1)]);
  }

  function retirer(cle: string): void {
    setLignes((avant) => avant.filter((ligne) => ligne.cle !== cle));
  }

  const json = JSON.stringify(lignes.map(versLaSaisie));

  return (
    <form action={action} method="post" className="flex flex-col gap-4">
      <input type="hidden" name="points" value={json} readOnly />
      {lignes.length === 0 ? (
        <p className="text-app-encre-faible text-13 font-bold">
          {t("checklist.parametrage.aucun_point")}
        </p>
      ) : null}
      <div className="flex flex-col gap-3">
        {lignes.map((ligne, index) => (
          <Carte key={ligne.cle} className="flex flex-col gap-2 p-3">
            <div className="flex flex-wrap gap-2">
              <ChampLigne
                libelle={t("checklist.parametrage.point_section")}
                valeur={ligne.section}
                onChange={(v) => modifier(ligne.cle, { section: v })}
              />
              <ChampLigne
                libelle={t("checklist.parametrage.point_ordre")}
                valeur={ligne.ordre}
                type="number"
                largeur="w-20"
                onChange={(v) => modifier(ligne.cle, { ordre: v })}
              />
              <ChampLigne
                libelle={t("checklist.parametrage.point_libelle")}
                valeur={ligne.libelle}
                large
                onChange={(v) => modifier(ligne.cle, { libelle: v })}
              />
            </div>
            <ChampLigne
              libelle={t("checklist.parametrage.point_consigne")}
              valeur={ligne.consigne}
              large
              onChange={(v) => modifier(ligne.cle, { consigne: v })}
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex flex-col gap-1 text-12 font-bold">
                {t("checklist.parametrage.point_type_reponse")}
                <select
                  value={ligne.typeReponse}
                  onChange={(e) =>
                    modifier(ligne.cle, {
                      typeReponse: e.target.value as TypeReponse,
                    })
                  }
                  className="border-app-bord bg-app-surface rounded-md border px-2 py-1 text-13 font-bold"
                >
                  {TYPES_REPONSE_CHECKLIST.map((type) => (
                    <option key={type} value={type}>
                      {t(`checklist.parametrage.type_reponse.${type}` as const)}
                    </option>
                  ))}
                </select>
              </label>
              <CaseACocher
                name={`obligatoire-${index}`}
                libelle={t("checklist.parametrage.point_obligatoire")}
                checked={ligne.obligatoire}
                onChange={() =>
                  modifier(ligne.cle, { obligatoire: !ligne.obligatoire })
                }
                className="flex items-center gap-2"
              />
            </div>
            {ligne.typeReponse === "valeur_mesuree" ? (
              <div className="flex flex-wrap gap-2">
                <ChampLigne
                  libelle={t("checklist.parametrage.point_unite")}
                  valeur={ligne.unite}
                  largeur="w-24"
                  onChange={(v) => modifier(ligne.cle, { unite: v })}
                />
                <ChampLigne
                  libelle={t("checklist.parametrage.point_tolerance_min")}
                  valeur={ligne.toleranceMin}
                  type="number"
                  largeur="w-28"
                  onChange={(v) => modifier(ligne.cle, { toleranceMin: v })}
                />
                <ChampLigne
                  libelle={t("checklist.parametrage.point_tolerance_max")}
                  valeur={ligne.toleranceMax}
                  type="number"
                  largeur="w-28"
                  onChange={(v) => modifier(ligne.cle, { toleranceMax: v })}
                />
                <p className="text-app-encre-faible w-full text-12 font-bold">
                  {t("checklist.parametrage.point_tolerance_aide")}
                </p>
              </div>
            ) : null}
            {ligne.typeReponse === "choix_dans_une_liste" ? (
              <label className="flex flex-col gap-1 text-12 font-bold">
                {t("checklist.parametrage.point_choix")}
                <textarea
                  value={ligne.choixTexte}
                  onChange={(e) =>
                    modifier(ligne.cle, { choixTexte: e.target.value })
                  }
                  rows={3}
                  className="border-app-bord bg-app-surface rounded-md border px-2 py-1 text-13 font-bold"
                />
              </label>
            ) : null}
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => retirer(ligne.cle)}
              >
                {t("checklist.parametrage.retirer_point")}
              </Button>
            </div>
          </Carte>
        ))}
      </div>
      <div className="flex justify-start">
        <Button type="button" variant="outline" onClick={ajouter}>
          {t("checklist.parametrage.ajouter_point")}
        </Button>
      </div>
      <div className="flex justify-end gap-2">
        <a
          href={hrefAnnuler}
          className="border-app-bord rounded-md border px-3 py-1.5 text-13 font-bold"
        >
          {t("checklist.parametrage.annuler")}
        </a>
        <ActionPrimaire>
          {t("checklist.parametrage.publier_action")}
        </ActionPrimaire>
      </div>
    </form>
  );
}

function ChampLigne({
  libelle,
  valeur,
  onChange,
  type = "text",
  large,
  largeur,
}: {
  readonly libelle: string;
  readonly valeur: string;
  readonly onChange: (valeur: string) => void;
  readonly type?: "text" | "number";
  readonly large?: boolean;
  readonly largeur?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-12 font-bold">
      {libelle}
      <input
        type={type}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        className={`border-app-bord bg-app-surface rounded-md border px-2 py-1 text-13 font-bold ${
          large ? "min-w-64" : (largeur ?? "w-36")
        }`}
      />
    </label>
  );
}
