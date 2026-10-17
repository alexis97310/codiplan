"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import type {
  FicheJSON,
  InstantaneJSON,
  LigneJSON,
} from "@/app/api/terrain/instantane/route";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import { lireCopie } from "@/lib/terrain/copie-locale";

import { BandeauReseau } from "./bandeau-reseau";
import {
  heureLocale,
  libelleDatesSuite,
  libelleJoursSuivantsVide,
  libelleTitreDemain,
  premiereLignePanne,
} from "./presentation";

/** L'identifiant d'une fiche : `/terrain-hors-reseau?id=<uuid>` (lien direct)
 * OU l'URL D'ORIGINE que le service worker a servie par cette coquille —
 * `/terrain/<uuid>`, inchangée dans la barre d'adresse (point 4). */
function ficheDemandee(
  cheminReel: string,
  parametres: string | null,
): string | null {
  const correspond = /^\/terrain\/([0-9a-f-]{36})$/.exec(cheminReel);
  return correspond?.[1] ?? parametres;
}

export function ConsultationHorsReseau() {
  const parametres = useSearchParams();
  const [copie, setCopie] = useState<InstantaneJSON | null | "chargement">(
    "chargement",
  );

  useEffect(() => {
    void lireCopie().then((valeur) =>
      setCopie(valeur as unknown as InstantaneJSON | null),
    );
  }, []);

  if (copie === "chargement") {
    return null;
  }
  if (copie === null) {
    return (
      <p
        role="status"
        className="border-app-bord bg-app-surface text-app-encre-faible rounded-lg border px-4 py-6 text-center text-16 font-bold"
      >
        {t("terrain.hors_reseau.aucune_copie")}
      </p>
    );
  }

  const id = ficheDemandee(
    typeof window === "undefined" ? "" : window.location.pathname,
    parametres.get("id"),
  );

  return (
    <main className="flex flex-col gap-4">
      <BandeauReseau genereLe={copie.genereLe} fuseau={copie.journee.fuseau} />
      {id === null ? (
        <Journee copie={copie} />
      ) : (
        <Fiche fiche={copie.fiches[id] ?? null} />
      )}
    </main>
  );
}

function Journee({ copie }: { readonly copie: InstantaneJSON }) {
  const { journee } = copie;
  return (
    <>
      {/* LA FRAÎCHEUR DE LA COPIE EST DITE UNE SEULE FOIS — par le bandeau
          ci-dessous, jamais recomposée ici (§9, 01/09) : cette page n'existe
          que pour la consultation hors réseau, le bandeau y est donc
          toujours visible. */}
      <header className="flex flex-col gap-1">
        <h1 className="text-24 font-extrabold tracking-tight">
          {t("terrain.hors_reseau.titre")}
        </h1>
      </header>

      {journee.enRetard.length === 0 ? null : (
        <Section
          titre={t("terrain.en_retard")}
          lignes={journee.enRetard}
          fuseau={journee.fuseau}
        />
      )}
      <Section
        titre={t("terrain.aujourdhui")}
        lignes={journee.aujourdhui}
        fuseau={journee.fuseau}
        vide={t("terrain.rien_aujourdhui")}
      />
      <Section
        titre={libelleTitreDemain(journee.jour)}
        lignes={journee.demain}
        fuseau={journee.fuseau}
        vide={t("terrain.demain.vide")}
      />
      <section className="flex flex-col gap-2">
        <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
          {t("terrain.jours_suivants.titre")}
        </h2>
        <p className="bg-app-surface border-app-bord flex flex-col gap-1 rounded-lg border px-4 py-3">
          {journee.suite.nombre === 0 ? (
            <span className="text-app-encre-faible text-16 font-bold">
              {libelleJoursSuivantsVide(journee.jour)}
            </span>
          ) : (
            <>
              <span className="text-16 font-semibold">
                {journee.suite.nombre}{" "}
                {journee.suite.nombre === 1
                  ? t("terrain.jours_suivants.intervention_singulier")
                  : t("terrain.jours_suivants.interventions_pluriel")}
              </span>
              <span className="text-app-encre-faible text-16 font-bold">
                {libelleDatesSuite(journee.suite.dates)}
              </span>
            </>
          )}
        </p>
      </section>
      {journee.sansDate.length === 0 ? null : (
        <Section
          titre={t("terrain.sans_date")}
          lignes={journee.sansDate}
          fuseau={journee.fuseau}
        />
      )}
    </>
  );
}

function Section({
  titre,
  lignes,
  fuseau,
  vide,
}: {
  readonly titre: string;
  readonly lignes: readonly LigneJSON[];
  readonly fuseau: InstantaneJSON["journee"]["fuseau"];
  readonly vide?: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
        {titre}
      </h2>
      {lignes.length === 0 ? (
        vide === undefined ? null : (
          <p className="bg-app-surface border-app-bord text-app-encre-faible rounded-lg border px-4 py-6 text-center text-16 font-bold">
            {vide}
          </p>
        )
      ) : (
        <ul className="flex flex-col gap-2">
          {lignes.map((ligne) => (
            <Carte key={ligne.id} ligne={ligne} fuseau={fuseau} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Carte({
  ligne,
  fuseau,
}: {
  readonly ligne: LigneJSON;
  readonly fuseau: InstantaneJSON["journee"]["fuseau"];
}) {
  const cleStatut = `statut.${ligne.statut}`;
  const panne = premiereLignePanne(ligne.panne);
  return (
    <li>
      <Link
        href={`/terrain-hors-reseau?id=${ligne.id}`}
        className="bg-app-surface border-app-bord flex flex-col gap-1.5 rounded-lg border px-4 py-3"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-16 font-bold tabular-nums">
            {ligne.creneauDebut === null
              ? t("terrain.sans_creneau")
              : heureLocale(new Date(ligne.creneauDebut), fuseau)}
          </span>
          <span
            className={
              "rounded-full px-2 py-0.5 text-12 font-bold " +
              "bg-app-surface border-app-bord border"
            }
          >
            {estCleTraduction(cleStatut) ? t(cleStatut) : ligne.statut}
          </span>
        </div>
        <p className="text-16 font-semibold">{ligne.client}</p>
        <p className="text-app-encre-faible text-16 font-bold">
          {lieuDit(ligne.site)}
        </p>
        {ligne.machinesLibelles.length === 0 ? null : (
          <p className="text-app-encre-faible truncate text-16 font-bold">
            {ligne.machinesLibelles.join(t("ponctuation.point_median"))}
          </p>
        )}
        {panne === null ? null : (
          <p className="truncate text-16 font-bold">{panne}</p>
        )}
      </Link>
    </li>
  );
}

/** La clé de `Verdict.cle`, si le dictionnaire la connaît — sinon la clé
 * brute, jamais une chaîne inventée (même idiome que `/terrain/[id]`). */
function libelleCle(cle: string): string {
  return estCleTraduction(cle) ? t(cle) : cle;
}

/** `issue` ne partage pas sa racine avec sa clé i18n (`client_absent` →
 * `option_absent`, `refus_signature` → `option_refus`) : une correspondance
 * explicite plutôt qu'une composition de chaîne qui manquerait les deux. */
function libelleIssueSignature(issue: string): string {
  if (issue === "signee") return t("terrain.signature.option_signee");
  if (issue === "client_absent") return t("terrain.signature.option_absent");
  if (issue === "refus_signature") return t("terrain.signature.option_refus");
  return issue;
}

/** `Site : Atelier Ducos` — composé hors du JSX, où aucun littéral n'est
 * admis (L0-11). Même idiome que `/terrain` (`page.tsx`, `lieuDit`), jamais
 * une seconde composition du même fait. */
function lieuDit(libelle: string): string {
  return `${mot("site")} : ${libelle}`;
}

function Fiche({ fiche }: { readonly fiche: FicheJSON | null }) {
  if (fiche === null) {
    return (
      <p
        role="status"
        className="border-app-bord bg-app-surface text-app-encre-faible rounded-lg border px-4 py-6 text-center text-16 font-bold"
      >
        {t("terrain.hors_reseau.fiche_introuvable")}
      </p>
    );
  }
  const nombrePhotos = fiche.photos.length;
  return (
    <>
      <Link href="/terrain-hors-reseau" className="text-16 font-bold underline">
        {t("terrain.retour")}
      </Link>
      <header>
        <h1 className="text-18 font-extrabold tracking-tight">
          {fiche.client ?? t("terrain.client_inconnu")}
        </h1>
      </header>

      <section className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5">
        <p className="text-16 font-bold">
          {lieuDit(fiche.lieu ?? t("terrain.inconnu"))}
        </p>
      </section>

      {fiche.contact === null ? null : (
        <section className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5">
          <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
            {t("intervention.contact_sur_place")}
          </h2>
          <p className="text-16 font-bold">{fiche.contact.nom}</p>
          {fiche.contact.numeros.length === 0 ? (
            <p className="text-app-encre-faible text-16 font-bold">
              {t("terrain.contact_sans_numero")}
            </p>
          ) : (
            <p className="flex flex-wrap gap-3">
              {fiche.contact.numeros.map((numero) => (
                <a
                  key={numero}
                  href={`tel:${numero}`}
                  className="text-16 font-bold underline"
                >
                  {numero}
                </a>
              ))}
            </p>
          )}
        </section>
      )}

      {fiche.machinesLibelles.length === 0 ? null : (
        <section className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5">
          <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
            {t("intervention.machine")}
          </h2>
          <ul className="flex flex-col gap-1.5 text-16 font-bold">
            {fiche.machinesLibelles.map((libelle) => (
              <li key={libelle}>{libelle}</li>
            ))}
          </ul>
        </section>
      )}

      {fiche.panne === null ? null : (
        <section className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5">
          <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
            {t("intervention.panne_signalee")}
          </h2>
          <p className="text-16 font-bold">{fiche.panne}</p>
        </section>
      )}

      <section className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5">
        <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
          {t("terrain.rapport.titre")}
        </h2>
        <p className="text-16 font-bold">
          {fiche.rapport.commentaireTechnicien ?? t("terrain.inconnu")}
        </p>
        {fiche.rapport.suiteADonner === null ? null : (
          <p className="text-app-encre-faible text-16 font-bold">
            {fiche.rapport.suiteADonner}
          </p>
        )}
      </section>

      <section className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5">
        <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
          {t("terrain.prestations.titre")}
        </h2>
        {fiche.prestationsRealisees.length === 0 ? (
          <p className="text-app-encre-faible text-16 font-bold">
            {t("terrain.prestations.aucune")}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-16 font-bold">
            {fiche.prestationsRealisees.map((libelle) => (
              <li key={libelle}>{libelle}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5">
        <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
          {t("terrain.photos.titre")}
        </h2>
        <p className="text-16 font-bold">
          {nombrePhotos === 0
            ? t("terrain.photos.aucune")
            : `${nombrePhotos} ${
                nombrePhotos === 1
                  ? t("terrain.hors_reseau.photo_singulier")
                  : t("terrain.hors_reseau.photos_pluriel")
              }`}
        </p>
      </section>

      <section className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5">
        <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
          {t("terrain.signature.titre")}
        </h2>
        <p className="text-16 font-bold">
          {fiche.signatureIssue === null
            ? t("terrain.inconnu")
            : libelleIssueSignature(fiche.signatureIssue)}
        </p>
      </section>

      <section className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5">
        <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
          {t("terrain.terminer.titre")}
        </h2>
        <p className="text-16 font-bold">
          {fiche.verdictTerminer.refuse
            ? libelleCle(fiche.verdictTerminer.cle)
            : t("terrain.hors_reseau.terminer_disponible")}
        </p>
      </section>
    </>
  );
}
