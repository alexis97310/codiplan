import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { obtenirSession } from "@/lib/auth/session";
import { dateCivile } from "@/lib/calendar/fuseau";
import {
  documentsDeLaMachine,
  type DocumentDeMachine,
} from "@/lib/documents/depot";
import { t } from "@/lib/i18n/fr";
import { lireMachine, type FicheMachine } from "@/lib/machines/depot";

/**
 * LA FICHE D'UNE MACHINE ET SES DOCUMENTS (L8-02 ; D93, L8-01, L8-05).
 *
 * ## CET ÉCRAN EST L'APPELANT QUI MANQUAIT
 *
 * Le socle du lot 8 est en base depuis L8-01 à L8-06 — la cible exclusive, les
 * deux classes, les deux formes de politique de D93, les deux dates de L8-06.
 * **L'union, elle, ne vivait que dans un scénario d'isolation** : le harnais
 * composait son `where` à la main, et rien dans la production ne le composait.
 * C'est exactement la divergence mesurée à L1-02b — *les scénarios étaient
 * verts parce que le harnais armait une garantie que la production n'armait
 * pas* — et elle se soigne en donnant à la lecture un appelant réel.
 *
 * ## L'ORIGINE EST UNE COLONNE, PAS UNE NUANCE DE GRIS
 *
 * *Un document de modèle se corrige une fois pour toutes ; un document de
 * machine n'existe que là.* Les mêler ferait supprimer une notice de gamme en
 * croyant nettoyer un exemplaire — et le geste porterait sur cinq cents
 * machines sans que rien ne le dise.
 *
 * ## CE QU'IL N'AFFICHE PAS, ET C'EST ÉCRIT PLUTÔT QUE TU
 *
 * **Aucun lien de téléchargement.** `document.objet_cle` dit où sont les
 * octets, et **aucun code ne la remplit** : le stockage d'objets de L8-05 n'a
 * pas encore d'appelant. Un lien qui mènerait à rien se lirait comme une panne
 * ; l'écran dit donc en une ligne pourquoi il n'y en a pas. *C'est le motif de
 * blocage de R2-13, appliqué avant de commettre la faute.*
 *
 * **Ni compteur, ni contrat** — les deux colonnes que la maquette montre au
 * parc et qu'aucune table ne porte.
 *
 * ## AUCUNE COMPARAISON DE SOCIÉTÉ N'EST ÉCRITE ICI
 *
 * `lireMachine` et `documentsDeLaMachine` lisent sous le contexte cloisonné.
 * Une fiche hors périmètre et une fiche inexistante rendent la MÊME chose : les
 * distinguer ferait un oracle (D35, D50).
 */
export default async function PageMachine({
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

  const { id } = await params;
  const machine = await lireMachine(session.contexte, id);
  if (machine === null) {
    notFound();
  }
  const documents = await documentsDeLaMachine(session.contexte, id);
  // `null` a DÉJÀ été traité par `lireMachine` : si la machine est visible, ses
  // documents le sont. Le garder ici en ferait un second lieu de décision.
  const lignes = documents ?? [];

  const colonnes = [
    { cle: "libelle", libelle: t("machine.documents.colonne_libelle") },
    {
      cle: "origine",
      libelle: t("machine.documents.colonne_origine"),
      largeur: "150px",
    },
    {
      cle: "classe",
      libelle: t("machine.documents.colonne_classe"),
      largeur: "120px",
    },
    { cle: "fichier", libelle: t("machine.documents.colonne_fichier") },
  ];

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <Link href="/parc" className="text-app-encre-faible text-[12.5px]">
          {t("machine.retour")}
        </Link>
        <h1 className="text-[22px] font-extrabold tracking-tight">
          {referenceMachine(machine)}
        </h1>
        <p className="text-app-encre-faible text-[13px]">
          {identiteMachine(machine)}
        </p>
      </header>

      <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-[10px] border px-4 py-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Fait
            libelle={t("parc.colonne_serie")}
            valeur={machine.numero_serie}
          />
          <Fait
            libelle={t("parc.colonne_lieu")}
            valeur={lieuMachine(machine)}
          />
          <Fait
            libelle={t("parc.colonne_mise_en_service")}
            valeur={dateAffichee(machine.date_mise_en_service)}
          />
          <Fait libelle={t("parc.colonne_statut")} valeur={machine.statut} />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-extrabold tracking-tight">
          {t("machine.documents.titre")}
        </h2>
        <p className="text-app-encre-faible text-[12.5px]">
          {t("machine.documents.sous_titre")}
        </p>
        <div className="bg-app-surface border-app-bord overflow-hidden rounded-[10px] border">
          <Tableau colonnes={colonnes} minimum="720px">
            {lignes.length === 0 ? (
              <LignePleine colonnes={colonnes.length}>
                {t("machine.documents.vide")}
              </LignePleine>
            ) : null}
            {lignes.map((document) => (
              <LigneDocument key={document.id} document={document} />
            ))}
          </Tableau>
        </div>
        <p className="text-app-encre-faible text-[11.5px]">
          {t("machine.documents.sans_octets")}
        </p>
      </section>
    </main>
  );
}

function LigneDocument({ document }: { readonly document: DocumentDeMachine }) {
  return (
    <tr>
      <Cellule>{document.libelle}</Cellule>
      <Cellule>{t(`machine.documents.origine.${document.origine}`)}</Cellule>
      <Cellule>{t(`machine.documents.classe.${document.classe}`)}</Cellule>
      <Cellule mono>{document.nom_fichier}</Cellule>
    </tr>
  );
}

function Fait({
  libelle,
  valeur,
}: Readonly<{ libelle: string; valeur: string }>) {
  return (
    <p className="flex flex-col gap-0.5 text-[12.5px] font-semibold">
      {libelle}
      <span className="text-[13px] font-normal">{valeur}</span>
    </p>
  );
}

/**
 * La référence affichée — `numero`, ou `Local-<6 caractères>` (I10).
 *
 * **Elle est recopiée de l'écran du parc, et c'est délibéré.** Un helper commun
 * devrait porter le préfixe en paramètre — `MAC-` ici, `INT-` au planning —,
 * c'est-à-dire ne plus rien décider. *Ce qui se partagerait n'est pas la règle,
 * c'est sa forme*, et partager une forme ne vaut pas le détour.
 */
function referenceMachine(machine: {
  id: string;
  numero: number | null;
}): string {
  if (machine.numero !== null) {
    return `MAC-${String(machine.numero).padStart(6, "0")}`;
  }
  return `Local-${machine.id.replaceAll("-", "").slice(-6).toUpperCase()}`;
}

function identiteMachine(machine: FicheMachine): string {
  const marque = machine.modele.marque;
  const reference = machine.modele.reference;
  const famille = machine.modele.famille.libelle;
  return `${marque} ${reference} — ${famille}`;
}

function lieuMachine(machine: FicheMachine): string {
  const site = machine.site.commune;
  const libelle = machine.site.libelle;
  return site === null
    ? `${machine.client.raison_sociale} — ${libelle}`
    : `${machine.client.raison_sociale} — ${libelle}, ${site}`;
}

/** `null` s'écrit « — », jamais une date vide qui se lirait comme une donnée. */
function dateAffichee(date: Date | null): string {
  return date === null ? "—" : dateCivile(date);
}
