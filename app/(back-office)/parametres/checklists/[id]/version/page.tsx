import type { Metadata } from "next";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { RefusAcces } from "@/components/ui/refus-acces";
import { peutPleinement } from "@/lib/auth/habilitations";
import { Role } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import {
  listerLesVersionsChecklist,
  obtenirModeleChecklist,
  type PointPublie,
  type VersionPubliee,
} from "@/lib/checklists/depot";
import { estUuid } from "@/lib/identifiant";
import { t } from "@/lib/i18n/fr";

import { EditeurVersion, type PointInitial } from "./editeur-version";

export const metadata: Metadata = {
  title: t("checklist.parametrage.version_titre"),
};

/**
 * PUBLIER UNE VERSION (9K19-CHECKLIST-PARAMETRAGE, CK3) — « Publier » (aucune
 * version encore) et « Modifier » (l'éditeur prérempli de la dernière
 * version) soumettent le MÊME écran : `publierVersion` crée TOUJOURS la
 * version N+1 (D235). L'éditeur de points (`EditeurVersion`, "use client")
 * a besoin de plus de place qu'un volet de 440 px — écran plein, pas volet.
 */
export default async function PageVersionChecklist({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }

  if (session.contexte.role === Role.technicien) {
    return (
      <Page
        chemin="/parametres/checklists"
        titre={t("checklist.parametrage.version_titre")}
      >
        <RefusAcces />
      </Page>
    );
  }
  if (
    session.contexte.role === null ||
    !peutPleinement(session.contexte.role, "parametrer_societe")
  ) {
    return (
      <Page
        chemin="/parametres/checklists"
        titre={t("checklist.parametrage.version_titre")}
      >
        <RefusAcces />
      </Page>
    );
  }

  const { id } = await params;
  if (!estUuid(id)) {
    notFound();
  }
  const modele = await obtenirModeleChecklist(session.contexte, id);
  if (modele === null) {
    notFound();
  }

  const versions = await listerLesVersionsChecklist(session.contexte, id);
  const derniere = versions[0];

  return (
    <Page
      chemin="/parametres/checklists"
      titre={t("checklist.parametrage.version_titre")}
      filAriane={[
        { libelle: t("nav.societes_tarifs"), href: "/parametres" },
        {
          libelle: t("checklist.parametrage.titre"),
          href: "/parametres/checklists",
        },
        { libelle: modele.code },
      ]}
      sousTitre={modele.libelle}
    >
      <div className="flex flex-col gap-6">
        <EditeurVersion
          action={`/api/parametres/checklists/${modele.id}/publier`}
          pointsInitiaux={
            derniere === undefined ? [] : versPointsInitiaux(derniere)
          }
          hrefAnnuler="/parametres/checklists"
        />

        <section className="flex flex-col gap-2">
          <h2 className="text-16 font-bold">
            {t("checklist.parametrage.versions_precedentes")}
          </h2>
          {versions.length === 0 ? (
            <p className="text-app-encre-faible text-13 font-bold">
              {t("checklist.parametrage.aucune_version_precedente")}
            </p>
          ) : (
            versions.map((version) => (
              <details
                key={version.id}
                className="border-app-bord rounded-md border p-3"
              >
                <summary className="cursor-pointer text-13 font-bold">
                  {libelleVersion(version.numero)}
                </summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {version.points.map((point) => (
                    <li key={point.id} className="text-12 font-bold">
                      {libellePoint(point)}
                    </li>
                  ))}
                </ul>
              </details>
            ))
          )}
        </section>
      </div>
    </Page>
  );
}

const TIRET = " — ";

/** « Version n°2 » — composé hors du JSX (L0-11). */
function libelleVersion(numero: number): string {
  return `${t("checklist.parametrage.version_numero_prefixe")} n°${numero}`;
}

/** « Sécurité — Niveau d'huile » — composé hors du JSX (L0-11). */
function libellePoint(point: PointPublie): string {
  return `${point.section}${TIRET}${point.libelle}`;
}

function versPointsInitiaux(version: VersionPubliee): readonly PointInitial[] {
  return version.points.map((point: PointPublie) => ({
    section: point.section,
    ordre: point.ordre,
    libelle: point.libelle,
    consigne: point.consigne,
    obligatoire: point.obligatoire,
    typeReponse: point.typeReponse,
    unite: point.unite,
    toleranceMin:
      point.toleranceMin === null ? null : point.toleranceMin.toString(),
    toleranceMax:
      point.toleranceMax === null ? null : point.toleranceMax.toString(),
    choix: point.choix,
  }));
}
