import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { obtenirSession } from "@/lib/auth/session";
import { dateCivile } from "@/lib/calendar/fuseau";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import {
  listerLeParc,
  resumerLeParc,
  type LigneDeParc,
} from "@/lib/machines/depot";
import { CLASSES_LIEN } from "@/lib/theme/apparence";

/**
 * L'ÉCRAN « PARC MACHINES » (R2-21 ; D95, D6, I10).
 *
 * ## Il ouvre une entrée de la barre qui était INERTE depuis D95
 *
 * *« Une entrée inerte dit ce que le produit sera ; un lien vers un écran vide
 * dirait qu'il est cassé »* — et pendant ce temps, la deuxième colonne de la
 * maquette ne menait nulle part. La fiche machine existe depuis L2-01 : ce qui
 * manquait n'était pas le droit de lire le parc, c'était **un appelant**. C'est
 * la maladie que le §6 nomme à propos du portail, et elle se soigne de la même
 * façon.
 *
 * ## DEUX COLONNES DE LA MAQUETTE SONT ABSENTES, ET C'EST ÉCRIT
 *
 * Elle montre huit colonnes, dont **« Compteur »** et **« Contrat »**. Ni l'un
 * ni l'autre n'existe : il n'y a pas de table de relevés, et les contrats sont
 * au lot 4. *Afficher une colonne vide dirait que la donnée manque ; afficher
 * un zéro dirait qu'elle vaut zéro.* Les deux colonnes ne sont donc pas rendues
 * — c'est exactement le motif pour lequel R2-13 reste bloqué, appliqué ici avant
 * de commettre la faute.
 *
 * Ses quatre indicateurs de tête ne sont pas repris non plus, pour la même
 * raison : deux d'entre eux — « sous contrat », « garantie expirant » — n'ont
 * aucune source. **Ce qui est affiché est ce qui se compte sur les lignes
 * rendues**, et rien d'autre.
 *
 * ## CE QU'IL NE FAIT PAS ENCORE
 *
 * Ni recherche, ni export, ni pagination. La borne d'affichage est dite à
 * l'écran plutôt que tue : *un tableau tronqué en silence fait croire à un parc
 * plus petit qu'il n'est*, et c'est pire qu'un tableau qui annonce sa borne.
 */

/**
 * Combien de fiches l'écran rend.
 *
 * **Ce n'est pas un cloisonnement** : celui-là est prononcé par la politique de
 * `machine`, de forme « parc ». C'est une borne d'AFFICHAGE, et elle existe
 * parce qu'un parc réel compte des milliers de lignes — *le fichier de
 * l'exploitation en porte 292 pour un seul client.*
 */
const LIGNES_AFFICHEES = 200;

export default async function PageParc() {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }

  const lignes = await listerLeParc(session.contexte, LIGNES_AFFICHEES);
  const resume = resumerLeParc(lignes);

  const colonnes = [
    {
      cle: "reference",
      libelle: t("parc.colonne_reference"),
      largeur: "150px",
    },
    { cle: "modele", libelle: t("parc.colonne_modele") },
    { cle: "serie", libelle: t("parc.colonne_serie"), largeur: "180px" },
    { cle: "lieu", libelle: t("parc.colonne_lieu") },
    {
      cle: "mise_en_service",
      libelle: t("parc.colonne_mise_en_service"),
      largeur: "140px",
    },
    { cle: "statut", libelle: t("parc.colonne_statut"), largeur: "140px" },
  ];

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">
            {t("parc.titre")}
          </h1>
          <p className="text-app-encre-faible text-[13px]">
            {t("parc.sous_titre")}
          </p>
        </div>
        <p className="text-app-encre-faible text-[12.5px]">
          {decompte(resume.total, t("parc.total_un"), t("parc.total"))}
          {resume.incompletes === 0
            ? ""
            : separateur(
                decompte(
                  resume.incompletes,
                  t("parc.incompletes_un"),
                  t("parc.incompletes"),
                ),
              )}
        </p>
      </header>

      <section className="bg-app-surface border-app-bord overflow-hidden rounded-[10px] border">
        <Tableau colonnes={colonnes} minimum="980px">
          {lignes.length === 0 ? (
            <LignePleine colonnes={colonnes.length}>
              {t("parc.vide")}
            </LignePleine>
          ) : null}
          {lignes.map((machine) => (
            <LigneMachine key={machine.id} machine={machine} />
          ))}
        </Tableau>
      </section>

      {/*
        LE REGISTRE DES VGP SE REJOINT D'ICI, et non par la barre : celle-ci est
        une liste CLOSE confrontée à la maquette (D95), qui n'y porte aucune
        entrée « VGP ». Une douzième entrée la ferait rougir à raison — le même
        traitement que l'écran des lieux, qui se rejoint par un lien.
      */}
      <Link href="/vgp" className={`text-[12.5px] ${CLASSES_LIEN}`}>
        {t("vgp.lien_depuis_parc")}
      </Link>

      <p className="text-app-encre-faible text-[11.5px]">{t("parc.borne")}</p>
    </main>
  );
}

function LigneMachine({ machine }: { readonly machine: LigneDeParc }) {
  return (
    <tr>
      <Cellule mono>
        {/*
          LA RÉFÉRENCE EST LE LIEN VERS LA FICHE, et c'est ce qui donne un
          appelant à l'union de L8-02. Une entrée dont l'écran n'existe pas est
          INERTE, jamais un lien (D95) — ici l'écran existe, donc le lien se
          pose.
        */}
        <Link href={`/parc/${machine.id}`} className={CLASSES_LIEN}>
          {referenceMachine(machine)}
        </Link>
        {machine.numero === null ? (
          <span className="text-app-encre-faible block font-sans text-[10.5px]">
            {t("parc.non_synchronisee")}
          </span>
        ) : null}
      </Cellule>
      <Cellule>
        {machine.modele.reference}
        <span className="text-app-encre-faible block text-[11.5px]">
          {familleAffichee(machine)}
        </span>
      </Cellule>
      <Cellule mono>
        {machine.numero_serie}
        {machine.complet ? null : (
          <span className="text-app-orange-encre block font-sans text-[10.5px] font-bold">
            {t("parc.a_completer")}
          </span>
        )}
      </Cellule>
      <Cellule>
        {machine.client.raison_sociale}
        <span className="text-app-encre-faible block text-[11.5px]">
          {lieuAffiche(machine)}
        </span>
      </Cellule>
      <Cellule>{dateAffichee(machine.date_mise_en_service)}</Cellule>
      <Cellule>{statutAffiche(machine.statut)}</Cellule>
    </tr>
  );
}

/**
 * LA RÉFÉRENCE AFFICHÉE — `numero`, ou `Local-<6 caractères>` (I10).
 *
 * Le numéro est attribué par le serveur à la première synchronisation, et
 * **personne ne l'attribue aujourd'hui** : la référence est donc toujours locale
 * pour l'instant, et l'écran le DIT plutôt que d'afficher un vide.
 *
 * *Elle n'est pas partagée avec celle du planning*, et ce n'est pas un oubli :
 * une intervention se préfixe `INT-`, une machine `MAC-`. Un helper commun
 * devrait porter le préfixe en paramètre, c'est-à-dire ne plus rien décider.
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

/** Un décompte et son unité, composés hors du JSX (L0-11). */
function decompte(nombre: number, un: string, plusieurs: string): string {
  // **« 1 fiches à compléter »** — mesuré le 13/09/2026 SUR UNE IMAGE, et par
  // aucune assertion : le libellé était au pluriel en dur, et le défaut ne
  // pouvait apparaître que le jour où le parc porterait EXACTEMENT une fiche
  // incomplète. *C'est le §9 du 09/09 — un défaut invisible à toute assertion
  // et évident sur une capture* : on n'écrit pas d'assertion sur un invariant
  // qu'on n'a pas encore vu.
  //
  // Le singulier est une CLÉ du dictionnaire, jamais un `s` retranché : le
  // français ne s'accorde pas par troncature, et une règle de morphologie
  // écrite dans un composant serait une chaîne visible en dur (L0-11).
  // **LES DEUX LIBELLÉS SONT RÉSOLUS PAR L'APPELANT**, et ce n'est pas un
  // détour : une CLÉ passée en argument depuis du JSX se lit comme une chaîne
  // visible écrite en dur, et le gardien de L0-11 l'a refusée — à raison, il ne
  // peut pas distinguer une clé d'un libellé.
  return `${nombre} ${nombre === 1 ? un : plusieurs}`;
}

/** Le séparateur des deux décomptes — un signe, jamais une phrase. */
function separateur(suite: string): string {
  return ` · ${suite}`;
}

const ABSENT = "—";

function familleAffichee(machine: LigneDeParc): string {
  const libelle = machine.modele.famille?.libelle;
  return libelle === undefined ? ABSENT : `${t("parc.famille")} : ${libelle}`;
}

function lieuAffiche(machine: LigneDeParc): string {
  const commune = machine.site.commune;
  return commune === null
    ? machine.site.libelle
    : `${machine.site.libelle} — ${commune}`;
}

/**
 * La date de mise en service, ou son absence.
 *
 * **La lecture en UTC vit dans `dateCivile`**, et plus ici : elle était écrite
 * deux fois le jour où la fiche d'intervention a eu besoin d'afficher une date
 * d'expiration (L3-02). *Ce qui reste ici est la seule chose propre à cet
 * écran : ce qu'on écrit quand il n'y a pas de date.*
 */
function dateAffichee(date: Date | null): string {
  return date === null ? ABSENT : dateCivile(date);
}

/** Le libellé d'un statut — au dictionnaire, jamais écrit dans le composant. */
function statutAffiche(statut: string): string {
  const cle = `statut_machine.${statut}`;
  return estCleTraduction(cle) ? t(cle) : statut;
}
