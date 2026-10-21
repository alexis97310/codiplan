"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import type {
  FicheJSON,
  InstantaneJSON,
  LigneJSON,
} from "@/app/api/terrain/instantane/route";
import { PhotosTerrain } from "@/components/interventions/photos-terrain";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import type { StatutIntervention } from "@/lib/interventions/saisie";
import { lireCopie } from "@/lib/terrain/copie-locale";
import {
  catalogueDeLaCopie,
  copieUtilisable,
  photosDeLaFiche,
  prestationsRealiseesDeLaFiche,
  rapportDeLaFiche,
} from "@/lib/terrain/copie-validee";

import { BandeauReseau } from "./bandeau-reseau";
import { BoutonCompteurTerrain } from "./compteur-terrain";
import { RapportTerrainAutomatique } from "./rapport-automatique";
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
  // UNE COPIE SANS `journee` NI `fiches` N'EST PAS PLUS UTILISABLE QU'AUCUNE
  // COPIE (point 2, 9F4H6B-FILE-ANCIEN-FORMAT) — voir `copieUtilisable`.
  if (copie === null || !copieUtilisable(copie)) {
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
      <BandeauReseau
        genereLe={copie.genereLe}
        fuseau={copie.journee.fuseau}
        fiche={id !== null}
      />
      {id === null ? (
        <Journee copie={copie} />
      ) : (
        <Fiche
          fiche={copie.fiches[id] ?? null}
          utilisateurId={copie.utilisateurId}
          societeId={copie.societeId}
          {...catalogueDeLaCopie(copie)}
        />
      )}
      <LienRetourSelonReseau />
    </main>
  );
}

/**
 * « REVENIR À MA JOURNÉE » (point 3, 9F4H4B-OUVERTURE-A-FROID) — n'apparaît
 * que quand le réseau est revenu : depuis la coquille, SANS session, rien ne
 * peut être envoyé ; `/terrain` (session normale) reprend la main, et c'est
 * là que « Envoyer » apparaît. Même mécanisme que `BandeauReseau` (online +
 * offline), jamais un second `fetch` pour la même question.
 */
function LienRetourSelonReseau() {
  const [enLigne, setEnLigne] = useState(false);

  useEffect(() => {
    setEnLigne(navigator.onLine);
    const surEnLigne = () => setEnLigne(true);
    const surHorsLigne = () => setEnLigne(false);
    window.addEventListener("online", surEnLigne);
    window.addEventListener("offline", surHorsLigne);
    return () => {
      window.removeEventListener("online", surEnLigne);
      window.removeEventListener("offline", surHorsLigne);
    };
  }, []);

  if (!enLigne) {
    return null;
  }

  return (
    <Link href="/terrain" className="text-16 font-bold underline">
      {t("terrain.hors_reseau.revenir_a_ma_journee")}
    </Link>
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

/** `Site : Atelier Ducos` — composé hors du JSX, où aucun littéral n'est
 * admis (L0-11). Même idiome que `/terrain` (`page.tsx`, `lieuDit`), jamais
 * une seconde composition du même fait. */
function lieuDit(libelle: string): string {
  return `${mot("site")} : ${libelle}`;
}

/**
 * LA FICHE DEVIENT UNE FICHE DE TRAVAIL (point 2, 9F4H4B-OUVERTURE-A-FROID,
 * décision D120 d'Alexis) — compteur, rapport, signature et « Terminer »
 * RÉUTILISENT les MÊMES composants que `/terrain/[id]` (jamais une seconde
 * forme du même geste, §9 du 01/09) ; chaque geste part dans la MÊME file
 * que 9F4H3 (`lib/terrain/file-saisies.ts`), sous l'identité de l'instantané
 * (`utilisateurId`/`societeId`) — jamais celle d'une session, qui n'existe
 * pas ici.
 *
 * ## DEUX LIMITES MESURÉES, ET ACCEPTÉES (le temps déjà mesuré, le compteur
 * déjà ouvert AILLEURS)
 *
 * `/api/terrain/instantane` (hors territoire de ce lot — ses routes le sont
 * toutes, SAUF le catalogue des prestations, promesse D216 tenue par 9F4H6)
 * n'emporte ni les MINUTES déjà mesurées côté serveur (seulement le verdict
 * `peutTerminer` déjà tranché), ni si un compteur tourne déjà AILLEURS sur
 * un autre appareil de la même personne. `minutesConnues=0`,
 * `segmentOuvertConnu=null`, `ici=false` : le pire qu'ils puissent causer
 * est un refus local trop prudent (jamais un geste accepté à tort),
 * rattrapé de toute façon par le serveur au moment de l'envoi réel. Voir la
 * passation pour le détail.
 */
function Fiche({
  fiche,
  utilisateurId,
  societeId,
  catalogue,
  indisponible: catalogueIndisponible,
}: {
  readonly fiche: FicheJSON | null;
  readonly utilisateurId: string;
  readonly societeId: string;
  readonly catalogue: InstantaneJSON["catalogue"];
  /** Le catalogue n'a pas pu être lu sur CETTE copie — voir
   * `lib/terrain/copie-validee.ts`. */
  readonly indisponible: boolean;
}) {
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
  const nombrePhotos = photosDeLaFiche(fiche).length;
  // UNE COPIE ÉCRITE AVANT 9F4H6 NE PORTE NI L'UN NI L'AUTRE
  // (9F4H6A-COQUILLE-ANCIENNE-COPIE, point 1) — les deux absences se
  // traitent comme UNE SEULE, par le même message existant : voir l'en-tête
  // de `lib/terrain/copie-validee.ts`.
  const { ids: prestationsInitiales, indisponibles: idsIndisponibles } =
    prestationsRealiseesDeLaFiche(fiche);
  const catalogueIndisponibleHorsReseau =
    catalogueIndisponible || idsIndisponibles;
  // AUCUNE SESSION ICI (point 2) — le statut EN LIGNE d'un compteur ouvert
  // sur CET appareil, pour CETTE fiche, est inconnu tant que la file n'a
  // pas été relue ; `BoutonCompteurTerrain` la relit lui-même dès son
  // montage et prend le dessus sur `ici` dès qu'une entrée existe (voir son
  // docblock). `enPause` reprend le même calcul que `/terrain/[id]` quand
  // rien d'autre n'est su : un statut déjà « en_cours » sans compteur connu
  // ICI est une pause, jamais un nouveau départ.
  const enPause = fiche.statut === "en_cours";
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

      <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
        <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
          {t("terrain.compteur")}
        </h2>
        {fiche.verdictDemarrer.refuse ? (
          <p className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3 py-2 text-16 font-bold">
            {libelleCle(fiche.verdictDemarrer.cle)}
          </p>
        ) : (
          <BoutonCompteurTerrain
            interventionId={fiche.id}
            utilisateurId={utilisateurId}
            societeId={societeId}
            ici={false}
            enPause={enPause}
            fuseau={fiche.fuseau}
            sansSession
          />
        )}
      </section>

      <RapportTerrainAutomatique
        interventionId={fiche.id}
        utilisateurId={utilisateurId}
        societeId={societeId}
        statut={fiche.statut as StatutIntervention}
        minutesConnues={0}
        segmentOuvertConnu={null}
        rapportInitial={{
          commentaire_technicien: rapportDeLaFiche(fiche).commentaireTechnicien,
          suite_a_donner: rapportDeLaFiche(fiche).suiteADonner,
        }}
        prestations={
          catalogueIndisponibleHorsReseau
            ? []
            : catalogue.map((p) => ({ id: p.id, libelle: p.libelle }))
        }
        prestationsInitiales={prestationsInitiales}
        catalogueIndisponibleHorsReseau={catalogueIndisponibleHorsReseau}
        sansSession
        dejaSignee={fiche.signatureIssue !== null}
        afficherTerminer={fiche.statut === "en_cours"}
        verdictTerminerRefuseCle={
          fiche.verdictTerminer.refuse ? fiche.verdictTerminer.cle : null
        }
        sectionPhotos={
          <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
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
            <PhotosTerrain
              action={`/api/terrain/${fiche.id}/photos`}
              libelleAjouter={t("terrain.photos.ajouter")}
              interventionId={fiche.id}
              utilisateurId={utilisateurId}
              societeId={societeId}
              sansSession
            />
          </section>
        }
      />

      <p
        role="status"
        className="border-app-bord bg-app-surface text-app-encre-faible rounded-lg border px-4 py-3 text-16 font-bold"
      >
        {t("terrain.hors_reseau.saisies_gardees")}
      </p>
    </>
  );
}
