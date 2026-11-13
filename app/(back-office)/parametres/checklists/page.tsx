import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Carte } from "@/components/ui/carte";
import { CaseACocher } from "@/components/ui/case-a-cocher";
import { Champ } from "@/components/ui/champ";
import { EtatVide } from "@/components/ui/etat-vide";
import { ActionPrimaire, LienPrimaire } from "@/components/ui/action-primaire";
import { ListeCartes } from "@/components/ui/liste-cartes";
import { Cellule, Tableau } from "@/components/ui/tableau";
import { Volet } from "@/components/ui/volet";
import { Page } from "@/components/mise-en-page/page";
import { RefusAcces } from "@/components/ui/refus-acces";
import { peutPleinement } from "@/lib/auth/habilitations";
import { Role } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import {
  listerLesModelesChecklist,
  type LigneModeleChecklist,
  type RattachementChecklist,
} from "@/lib/checklists/depot";
import { GABARITS_DE_DEPART } from "@/lib/checklists/gabarits-de-depart";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { ChampsRattachement } from "./champs-rattachement";
import { VoletPartirGabarit } from "./volet-partir-gabarit";
import {
  listerLesFamilles,
  listerLesModeles,
  listerLesSousTypes,
  type LigneFamille,
  type LigneModele,
  type LigneSousType,
} from "@/lib/materiel/depot";
import {
  TYPES_INTERVENTION,
  type TypeIntervention,
} from "@/lib/interventions/saisie";

export const metadata: Metadata = { title: t("checklist.parametrage.titre") };

/**
 * LE PARAMÉTRAGE DES CHECKLISTS (9K19-CHECKLIST-PARAMETRAGE, CK3) — liste,
 * création d'un modèle, bascule d'activité. La publication d'une version
 * (« Publier »/« Modifier ») vit sur son propre écran,
 * `/parametres/checklists/[id]/version` : l'éditeur de points, par section,
 * a besoin de plus de place qu'un volet de 440 px.
 *
 * Même patron que `/parametres/materiel` : un volet piloté par l'URL
 * (`?volet=creer`), jamais de formulaire déplié dans la liste.
 */
export default async function PageChecklists({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }

  // FERMÉ AU TECHNICIEN (QT-2, D152) — « Autres pages /parametres/* ».
  if (session.contexte.role === Role.technicien) {
    return (
      <Page
        chemin="/parametres/checklists"
        titre={t("checklist.parametrage.titre")}
      >
        <RefusAcces />
      </Page>
    );
  }

  const peutEcrire =
    session.contexte.role !== null &&
    peutPleinement(session.contexte.role, "parametrer_societe");
  if (!peutEcrire) {
    return (
      <Page
        chemin="/parametres/checklists"
        titre={t("checklist.parametrage.titre")}
      >
        <RefusAcces />
      </Page>
    );
  }

  const params = await searchParams;
  const motif = typeof params.motif === "string" ? params.motif : undefined;
  const volet = typeof params.volet === "string" ? params.volet : undefined;
  const sourceId =
    typeof params.source === "string" ? params.source : undefined;

  const [modeles, sousTypes, familles, machinesModeles] = await Promise.all([
    listerLesModelesChecklist(session.contexte),
    listerLesSousTypes(session.contexte),
    listerLesFamilles(session.contexte),
    listerLesModeles(session.contexte),
  ]);

  const nomSousType = new Map(sousTypes.map((s) => [s.id, s.libelle]));
  const nomFamille = new Map(familles.map((f) => [f.id, f.libelle]));
  const nomModele = new Map(
    machinesModeles.map((m) => [m.id, `${m.marque} ${m.reference}`]),
  );
  const sousTypesActifs = sousTypes.filter((s) => s.actif);
  const famillesActives = familles.filter((f) => f.actif);
  const modelesActifs = machinesModeles.filter((m) => m.actif);

  return (
    <Page
      chemin="/parametres/checklists"
      titre={t("checklist.parametrage.titre")}
      filAriane={[
        { libelle: t("nav.societes_tarifs"), href: "/parametres" },
        { libelle: t("checklist.parametrage.titre") },
      ]}
      sousTitre={t("checklist.parametrage.sous_titre")}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" asChild>
            <Link href="/parametres/checklists?volet=gabarit">
              {t("checklist.parametrage.partir_gabarit")}
            </Link>
          </Button>
          <LienPrimaire href="/parametres/checklists?volet=creer">
            {t("checklist.parametrage.creer_modele")}
          </LienPrimaire>
        </div>

        {motif !== undefined && estCleTraduction(motif) ? (
          <p
            role="status"
            className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-13 font-bold"
          >
            {t(motif)}
          </p>
        ) : null}

        {modeles.length === 0 ? (
          <EtatVide titre={t("checklist.parametrage.aucun_modele")}>
            {t("checklist.parametrage.aucun_modele_detail")}
          </EtatVide>
        ) : (
          <div className="flex flex-col gap-3">
            <Carte className="max-[900px]:hidden">
              <Tableau colonnes={colonnes()} minimum="900px">
                {modeles.map((modele) => (
                  <tr key={modele.id}>
                    <Cellule fort>{modele.code}</Cellule>
                    <Cellule>{modele.libelle}</Cellule>
                    <Cellule>
                      {rattachementLisible(
                        modele.rattachement,
                        nomSousType,
                        nomFamille,
                        nomModele,
                      )}
                    </Cellule>
                    <Cellule>
                      {libellesDesTypesChecklist(modele.typesIntervention)}
                    </Cellule>
                    <Cellule>
                      {modele.exigeMachine
                        ? t("checklist.parametrage.oui")
                        : t("checklist.parametrage.non")}
                    </Cellule>
                    <Cellule>
                      {modele.actif
                        ? t("checklist.parametrage.actif")
                        : t("checklist.parametrage.inactif")}
                    </Cellule>
                    <Cellule>{versionAffichee(modele)}</Cellule>
                    <Cellule>
                      <ActionsLigne modele={modele} />
                    </Cellule>
                  </tr>
                ))}
              </Tableau>
            </Carte>

            <ListeCartes libelle={t("checklist.parametrage.titre")}>
              {modeles.map((modele) => (
                <CarteModeleChecklist
                  key={modele.id}
                  modele={modele}
                  rattachement={rattachementLisible(
                    modele.rattachement,
                    nomSousType,
                    nomFamille,
                    nomModele,
                  )}
                />
              ))}
            </ListeCartes>
          </div>
        )}
      </div>

      {volet === "creer" ? (
        <VoletCreerModele
          sousTypes={sousTypesActifs}
          familles={famillesActives}
          machinesModeles={modelesActifs}
        />
      ) : null}

      {volet === "dupliquer" && sourceId !== undefined
        ? (() => {
            const source = modeles.find((modele) => modele.id === sourceId);
            return source === undefined ? null : (
              <VoletDupliquerModele
                source={source}
                sousTypes={sousTypesActifs}
                familles={famillesActives}
                machinesModeles={modelesActifs}
              />
            );
          })()
        : null}

      {volet === "gabarit" ? (
        <VoletPartirGabarit
          gabarits={GABARITS_DE_DEPART}
          sousTypes={sousTypesActifs}
          familles={famillesActives}
          machinesModeles={modelesActifs}
        />
      ) : null}
    </Page>
  );
}

function colonnes() {
  return [
    { cle: "code", libelle: t("checklist.parametrage.code"), largeur: "120px" },
    { cle: "libelle", libelle: t("checklist.parametrage.libelle") },
    {
      cle: "rattachement",
      libelle: t("checklist.parametrage.rattachement"),
      largeur: "200px",
    },
    {
      cle: "types",
      libelle: t("checklist.parametrage.colonne_types"),
      largeur: "160px",
    },
    {
      cle: "exige_machine",
      libelle: t("checklist.parametrage.exige_machine"),
      largeur: "140px",
    },
    {
      cle: "activite",
      libelle: t("checklist.parametrage.colonne_activite"),
      largeur: "100px",
    },
    {
      cle: "version",
      libelle: t("checklist.parametrage.colonne_derniere_version"),
      largeur: "180px",
    },
    { cle: "actions", libelle: "", largeur: "260px" },
  ];
}

/** Le rattachement d'un modèle, lisible — AU PLUS UN niveau (D238). */
function rattachementLisible(
  rattachement: RattachementChecklist,
  nomSousType: ReadonlyMap<string, string>,
  nomFamille: ReadonlyMap<string, string>,
  nomModele: ReadonlyMap<string, string>,
): string {
  if (rattachement.niveau === "sous_type") {
    return (
      nomSousType.get(rattachement.id) ??
      t("checklist.parametrage.sous_type_non_lisible")
    );
  }
  if (rattachement.niveau === "famille") {
    return (
      nomFamille.get(rattachement.id) ??
      t("checklist.parametrage.famille_non_lisible")
    );
  }
  if (rattachement.niveau === "modele") {
    return (
      nomModele.get(rattachement.id) ??
      t("checklist.parametrage.modele_non_lisible")
    );
  }
  return t("checklist.parametrage.rattachement_aucun");
}

/**
 * « Toutes » quand VIDE (9K30A, D235 amendée) — jamais une liste vide qui
 * aurait l'air d'un oubli. Même idiome que `libellesDesTypes`, `app/
 * (back-office)/parametres/prestations/page.tsx` (9K29, D243).
 */
function libellesDesTypesChecklist(types: readonly TypeIntervention[]): string {
  if (types.length === 0) {
    return t("checklist.parametrage.type_intervention_toutes");
  }
  return types.map((type) => libelleTypeIntervention(type)).join(", ");
}

/** « Version n°2 » — composé hors du JSX (L0-11), ou l'absence. */
function versionAffichee(modele: LigneModeleChecklist): string {
  if (modele.derniereVersion === null) {
    return t("checklist.parametrage.aucune_version");
  }
  return `${t("checklist.parametrage.version_numero_prefixe")} n°${modele.derniereVersion.numero}`;
}

function ActionsLigne({ modele }: { readonly modele: LigneModeleChecklist }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href={`/parametres/checklists/${modele.id}/version`}>
          {modele.derniereVersion === null
            ? t("checklist.parametrage.publier")
            : t("checklist.parametrage.modifier_version")}
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link
          href={`/parametres/checklists?volet=dupliquer&source=${modele.id}`}
        >
          {t("checklist.parametrage.dupliquer")}
        </Link>
      </Button>
      <form
        action={`/api/parametres/checklists/${modele.id}/activite`}
        method="post"
      >
        <input
          type="hidden"
          name="actif"
          value={modele.actif ? INACTIF : ACTIF}
        />
        <Button type="submit" variant="outline" size="sm">
          {modele.actif
            ? t("checklist.parametrage.desactiver")
            : t("checklist.parametrage.activer")}
        </Button>
      </form>
    </div>
  );
}

const ACTIF = "oui";
const INACTIF = "non";

function CarteModeleChecklist({
  modele,
  rattachement,
}: {
  readonly modele: LigneModeleChecklist;
  readonly rattachement: string;
}) {
  return (
    <li>
      <Carte className="flex flex-col gap-2 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-13 font-bold">{modele.libelle}</span>
          <span className="text-app-encre-faible text-12 font-bold">
            {modele.code}
          </span>
        </div>
        <div className="text-app-encre-faible text-12 font-bold">
          {t("checklist.parametrage.rattachement")}
          {t("ponctuation.deux_points")}
          {rattachement}
        </div>
        <div className="text-app-encre-faible text-12 font-bold">
          {t("checklist.parametrage.colonne_types")}
          {t("ponctuation.deux_points")}
          {libellesDesTypesChecklist(modele.typesIntervention)}
        </div>
        <div className="text-12 font-bold">{versionAffichee(modele)}</div>
        <ActionsLigne modele={modele} />
      </Carte>
    </li>
  );
}

function VoletCreerModele({
  sousTypes,
  familles,
  machinesModeles,
}: {
  readonly sousTypes: readonly LigneSousType[];
  readonly familles: readonly LigneFamille[];
  readonly machinesModeles: readonly LigneModele[];
}) {
  return (
    <Volet
      surtitre={t("checklist.parametrage.titre")}
      titre={t("checklist.parametrage.creer_modele")}
      hrefFermer="/parametres/checklists"
    >
      <form
        action="/api/parametres/checklists/creer"
        method="post"
        className="flex flex-col gap-3"
      >
        <Champ id="code" nom="code" libelle={t("checklist.parametrage.code")} />
        <Champ
          id="libelle"
          nom="libelle"
          libelle={t("checklist.parametrage.libelle")}
          large
        />
        <ChampsRattachementEtNature
          sousTypes={sousTypes}
          familles={familles}
          machinesModeles={machinesModeles}
        />
        <div className="flex justify-end gap-2">
          <Link
            href="/parametres/checklists"
            className="border-app-bord rounded-md border px-3 py-1.5 text-13 font-bold"
          >
            {t("checklist.parametrage.annuler")}
          </Link>
          <ActionPrimaire>
            {t("checklist.parametrage.creer_action")}
          </ActionPrimaire>
        </div>
      </form>
    </Volet>
  );
}

/**
 * DUPLIQUER UN MODÈLE (9K20-CHECKLIST-DUPLIQUER-DEPART) — même formulaire
 * que « Créer un modèle », posté vers `/api/parametres/checklists/[id]/
 * dupliquer` (`id` = la source) ; libellé et rattachement REPRIS de la
 * source, le code reste vide et obligatoire (une copie ne partage jamais le
 * code de sa source).
 */
function VoletDupliquerModele({
  source,
  sousTypes,
  familles,
  machinesModeles,
}: {
  readonly source: LigneModeleChecklist;
  readonly sousTypes: readonly LigneSousType[];
  readonly familles: readonly LigneFamille[];
  readonly machinesModeles: readonly LigneModele[];
}) {
  return (
    <Volet
      surtitre={t("checklist.parametrage.titre")}
      titre={t("checklist.parametrage.dupliquer_titre")}
      hrefFermer="/parametres/checklists"
    >
      <form
        action={`/api/parametres/checklists/${source.id}/dupliquer`}
        method="post"
        className="flex flex-col gap-3"
      >
        <p className="text-app-encre-faible text-12 font-bold">
          {t("checklist.parametrage.dupliquer_source_prefixe")}
          {t("ponctuation.deux_points")}
          {source.libelle}
        </p>
        <Champ id="code" nom="code" libelle={t("checklist.parametrage.code")} />
        <Champ
          id="libelle"
          nom="libelle"
          libelle={t("checklist.parametrage.libelle")}
          valeur={source.libelle}
          large
        />
        <ChampsRattachementEtNature
          sousTypes={sousTypes}
          familles={familles}
          machinesModeles={machinesModeles}
          typesIntervention={source.typesIntervention}
          sousTypeId={
            source.rattachement.niveau === "sous_type"
              ? source.rattachement.id
              : undefined
          }
          familleId={
            source.rattachement.niveau === "famille"
              ? source.rattachement.id
              : undefined
          }
          modeleId={
            source.rattachement.niveau === "modele"
              ? source.rattachement.id
              : undefined
          }
          exigeMachine={source.exigeMachine}
        />
        <div className="flex justify-end gap-2">
          <Link
            href="/parametres/checklists"
            className="border-app-bord rounded-md border px-3 py-1.5 text-13 font-bold"
          >
            {t("checklist.parametrage.annuler")}
          </Link>
          <ActionPrimaire>
            {t("checklist.parametrage.dupliquer_action")}
          </ActionPrimaire>
        </div>
      </form>
    </Volet>
  );
}

/** Les champs de nature et de rattachement, partagés par création et duplication. */
function ChampsRattachementEtNature({
  sousTypes,
  familles,
  machinesModeles,
  typesIntervention,
  sousTypeId,
  familleId,
  modeleId,
  exigeMachine,
}: {
  readonly sousTypes: readonly LigneSousType[];
  readonly familles: readonly LigneFamille[];
  readonly machinesModeles: readonly LigneModele[];
  readonly typesIntervention?: readonly TypeIntervention[];
  readonly sousTypeId?: string;
  readonly familleId?: string;
  readonly modeleId?: string;
  readonly exigeMachine?: boolean;
}) {
  return (
    <>
      <fieldset className="flex basis-full flex-col gap-1">
        <legend className="text-app-encre-faible text-12 font-bold">
          {t("checklist.parametrage.types_intervention")}
        </legend>
        <div className="flex flex-wrap gap-2">
          {TYPES_INTERVENTION.map((type) => (
            <CaseACocher
              key={type}
              name="types_intervention"
              value={type}
              defaultChecked={typesIntervention?.includes(type) ?? false}
              libelle={libelleTypeIntervention(type)}
              className="flex items-center gap-1.5 text-13 font-bold"
            />
          ))}
        </div>
        <p className="text-app-encre-faible text-12 font-bold">
          {t("checklist.parametrage.types_intervention_indice")}
        </p>
      </fieldset>
      <ChampsRattachement
        sousTypes={sousTypes}
        familles={familles}
        machinesModeles={machinesModeles}
        sousTypeId={sousTypeId}
        familleId={familleId}
        modeleId={modeleId}
        exigeMachine={exigeMachine}
      />
    </>
  );
}

/** La nature d'intervention, lisible — les neuf clés de `type_intervention.*`. */
function libelleTypeIntervention(type: TypeIntervention): string {
  const cle = `type_intervention.${type}`;
  return estCleTraduction(cle) ? t(cle) : type;
}
