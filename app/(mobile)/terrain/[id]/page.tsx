import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { SignatureTerrain } from "@/components/interventions/signature-terrain";
import { Button } from "@/components/ui/button";
import { type ContexteActif } from "@/lib/auth/contexte";
import { obtenirSession } from "@/lib/auth/session";
import { dateCivile } from "@/lib/calendar/fuseau";
import { photosDeLIntervention } from "@/lib/documents/depot";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import { lireFicheIntervention } from "@/lib/interventions/depot";
import {
  compteurEnCours,
  mesureDeLIntervention,
} from "@/lib/interventions/depot-compteur";
import {
  derniereSignature,
  lireRapportTexte,
  prestationsRealisees,
} from "@/lib/interventions/depot-rapport-terrain";
import { perimetreDuPlanning } from "@/lib/interventions/perimetre-technicien";
import { listerLesPrestations } from "@/lib/prestations/depot";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { CLASSES_STATUT, type StatutAffiche } from "@/lib/theme/statuts";

/**
 * UNE INTERVENTION, VUE DU TERRAIN — et son compteur (R5-01, R5-02, D119).
 *
 * ## CE QU'ELLE MONTRE, ET CE QU'ELLE NE MONTRE PAS
 *
 * De quoi savoir où l'on va et ce qu'on y fait : le client, le lieu, le type,
 * le créneau, le statut. **Aucun montant** — la matrice du §5.2 ne donne au
 * technicien aucun `voir_montants_vente`, et un gardien statique le tient. Pas
 * de valorisation, pas de taux, pas de forfait.
 *
 * ## LE COMPTEUR, ET LES DEUX FAÇONS DONT IL PEUT REFUSER
 *
 * Le bouton proposé n'est pas choisi d'après CETTE intervention mais d'après le
 * **compteur de la personne** : si un compteur tourne ailleurs, l'écran le dit
 * et nomme l'autre intervention plutôt que de proposer un départ que la base
 * refuserait. *Proposer une action qui sera refusée est une promesse qu'on ne
 * tient pas* — et ici la promesse coûte un aller-retour sur un réseau de
 * brousse.
 *
 * ## DÉMARRER LE COMPTEUR, C'EST DÉMARRER L'INTERVENTION (D120)
 *
 * *« Il pourra démarrer son intervention, et qu'à ce moment le compteur
 * commence. »* Un seul geste, un seul bouton : l'intervention passe **en
 * cours** et le compteur part. **Aucune machine n'est exigée** — une
 * intervention peut porter sur autre chose qu'un équipement.
 *
 * Le bouton s'appelle donc « Démarrer l'intervention », et non « démarrer le
 * compteur » : *un libellé qui ne nomme que la moitié de ce qu'un bouton fait
 * est un libellé qui surprend.*
 *
 * **Et il n'y a toujours qu'UN bouton d'arrêt**, nommé « pause ». Sur les
 * segments, mettre en pause et arrêter sont le même geste — *en offrir deux qui
 * font la même chose serait mentir sur l'un des deux.* Ce qui les
 * distinguerait est de TERMINER l'intervention, et ce geste-là n'existe encore
 * nulle part.
 *
 * ## LE TEMPS AFFICHÉ EST CELUI DES SEGMENTS FERMÉS
 *
 * Un compteur qui tourne n'est pas ajouté au total : il est annoncé à part,
 * avec son heure de départ. *Un total qui change tout seul entre deux
 * rafraîchissements ne se relit pas*, et c'est le motif de D85 appliqué à un
 * nombre.
 */
export default async function PageInterventionTerrain({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ motif?: string }>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null || session.contexte.role === null) {
    redirect("/arrivee");
  }
  const contexte: ContexteActif = {
    ...session.contexte,
    societeId: session.contexte.societeId,
    role: session.contexte.role,
  };

  const perimetre = perimetreDuPlanning(contexte);
  if (perimetre.acces === "complet") {
    redirect("/planning");
  }
  if (perimetre.acces === "aucun") {
    redirect("/arrivee");
  }

  const { id } = await params;
  const motif = (await searchParams).motif;

  // La fiche est lue SOUS la restriction par personne : l'intervention d'un
  // autre technicien est « introuvable », et rien de plus (D35, D50).
  const fiche = await lireFicheIntervention(contexte, id);
  if (fiche === null) {
    notFound();
  }

  const mesure = await mesureDeLIntervention(contexte, id);
  const enCours = await compteurEnCours(contexte);
  const ailleurs =
    enCours !== null && enCours.interventionId !== id ? enCours : null;
  const ici = enCours !== null && enCours.interventionId === id;

  const ligne = fiche.ligne;
  const statut = ligne.statut as StatutAffiche;

  // ── LE RAPPORT DE TERRAIN (ticket 17-BON-2) ──────────────────────────────
  //
  // Cinq lectures indépendantes, comme `lireBonIntervention` : chacune tient
  // sa propre politique de cloisonnement, et les mêler en une seule
  // dupliquerait le critère de visibilité que chacune vérifie déjà.
  const [
    rapportTexte,
    prestationsCatalogue,
    prestationsFaites,
    photos,
    signature,
  ] = await Promise.all([
    lireRapportTexte(contexte, id),
    listerLesPrestations(contexte),
    prestationsRealisees(contexte, id),
    photosDeLIntervention(contexte, id),
    derniereSignature(contexte, id),
  ]);
  const prestationsActives = prestationsCatalogue.filter((p) => p.actif);
  const idsRealises = new Set(
    (prestationsFaites ?? []).map((p) => p.prestation_id),
  );

  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <Link href="/terrain" className={`text-[12.5px] ${CLASSES_LIEN}`}>
          {t("terrain.retour")}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[20px] font-extrabold tracking-tight">
            {fiche.client ?? t("terrain.client_inconnu")}
          </h1>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${CLASSES_STATUT[statut]}`}
          >
            {t(`statut.${statut}`)}
          </span>
        </div>
      </header>

      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(motif)}
        </p>
      ) : null}

      <section className="bg-app-surface border-app-bord rounded-lg border px-4 py-3.5">
        <dl className="grid grid-cols-[104px_1fr] gap-x-3 gap-y-2.5 text-[13px]">
          <Ligne libelle={mot("site")} valeur={fiche.lieu} />
          <Ligne
            libelle={t("intervention.type")}
            valeur={libelleDuType(ligne.type)}
          />
          <Ligne
            libelle={t("terrain.date")}
            valeur={
              ligne.date_planifiee === null
                ? null
                : dateCivile(ligne.date_planifiee)
            }
          />
        </dl>
      </section>

      <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
        <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
          {t("terrain.compteur")}
        </h2>

        <p className="text-[28px] font-extrabold tabular-nums">
          {enHeuresEtMinutes(mesure.minutes)}
        </p>
        <p className="text-app-encre-faible text-[12px]">
          {t("terrain.compteur.ferme")}
        </p>

        {ici ? (
          <p className="text-app-rouge-encre bg-app-rouge-fond rounded-md px-3 py-2 text-[12.5px] font-semibold">
            {t("terrain.compteur.tourne")}
          </p>
        ) : null}

        {ailleurs === null ? (
          <form action={`/api/terrain/${id}/compteur`} method="post">
            <input
              type="hidden"
              name="geste"
              value={ici ? "arreter" : "demarrer"}
            />
            <Button type="submit" className="w-full">
              {ici
                ? t("terrain.compteur.pause")
                : t("terrain.compteur.demarrer")}
            </Button>
          </form>
        ) : (
          // LE REFUS PREND LA PLACE DE L'ACTION, avec sa raison — jamais un
          // bouton grisé, qui laisse croire qu'il suffirait d'insister.
          <p className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3 py-2 text-[12.5px]">
            {t("terrain.compteur.ailleurs")}{" "}
            <Link
              href={`/terrain/${ailleurs.interventionId}`}
              className={CLASSES_LIEN}
            >
              {t("terrain.compteur.aller")}
            </Link>
          </p>
        )}
      </section>

      <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
        <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
          {t("terrain.rapport.titre")}
        </h2>
        <form
          action={`/api/terrain/${id}/rapport`}
          method="post"
          className="flex flex-col gap-3"
        >
          <label className="flex flex-col gap-1">
            <span className="text-[12.5px] font-medium">
              {t("terrain.rapport.commentaire_libelle")}
            </span>
            <textarea
              name="commentaire_technicien"
              rows={3}
              defaultValue={rapportTexte?.commentaire_technicien ?? ""}
              placeholder={t("terrain.rapport.commentaire_placeholder")}
              className="border-app-bord bg-app-surface rounded-md border px-2 py-1.5 text-[13px]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12.5px] font-medium">
              {t("terrain.rapport.suite_libelle")}
            </span>
            <textarea
              name="suite_a_donner"
              rows={2}
              defaultValue={rapportTexte?.suite_a_donner ?? ""}
              placeholder={t("terrain.rapport.suite_placeholder")}
              className="border-app-bord bg-app-surface rounded-md border px-2 py-1.5 text-[13px]"
            />
          </label>
          <Button type="submit" size="sm" className="self-start">
            {t("terrain.rapport.enregistrer")}
          </Button>
        </form>
      </section>

      <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
        <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
          {t("terrain.prestations.titre")}
        </h2>
        {prestationsActives.length === 0 ? (
          <p className="text-app-encre-faible text-[12.5px]">
            {t("terrain.prestations.aucune")}
          </p>
        ) : (
          <form
            action={`/api/terrain/${id}/prestations`}
            method="post"
            className="flex flex-col gap-2"
          >
            {prestationsActives.map((prestation) => (
              <label
                key={prestation.id}
                className="flex items-center gap-2 text-[13px]"
              >
                <input
                  type="checkbox"
                  name="prestation_id"
                  value={prestation.id}
                  defaultChecked={idsRealises.has(prestation.id)}
                />
                {prestation.libelle}
              </label>
            ))}
            <Button type="submit" size="sm" className="self-start">
              {t("terrain.prestations.enregistrer")}
            </Button>
          </form>
        )}
      </section>

      <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
        <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
          {t("terrain.photos.titre")}
        </h2>
        {(photos ?? []).length === 0 ? (
          <p className="text-app-encre-faible text-[12.5px]">
            {t("terrain.photos.aucune")}
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {(photos ?? []).map((photo) => (
              <li key={photo.id} className="flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- octets servis par une route applicative */}
                <img
                  src={`/api/documents/${photo.id}/octets`}
                  alt={photo.libelle}
                  className="border-app-bord aspect-square rounded border object-cover"
                />
                <span className="text-app-encre-faible truncate text-[10.5px]">
                  {photo.libelle}
                </span>
              </li>
            ))}
          </ul>
        )}
        <form
          action={`/api/terrain/${id}/photos`}
          method="post"
          encType="multipart/form-data"
          className="flex flex-col gap-2"
        >
          <input
            type="file"
            name="fichier"
            accept="image/*"
            capture="environment"
            required
            className="text-[12.5px]"
          />
          <input
            type="text"
            name="libelle"
            placeholder={t("terrain.photos.libelle_placeholder")}
            className="border-app-bord bg-app-surface rounded-md border px-2 py-1.5 text-[13px]"
          />
          <Button type="submit" size="sm" className="self-start">
            {t("terrain.photos.ajouter")}
          </Button>
        </form>
      </section>

      <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
        <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
          {t("terrain.signature.titre")}
        </h2>
        <SignatureTerrain
          action={`/api/terrain/${id}/signature`}
          dejaSignee={signature !== null}
        />
      </section>
    </main>
  );
}

/** Le libellé du type, ou son code si le dictionnaire l'ignore. */
function libelleDuType(type: string): string {
  const cle = `type_intervention.${type}`;
  return estCleTraduction(cle) ? t(cle) : type;
}

/**
 * `2 h 15` — et `0 min` quand rien n'a été mesuré, jamais un tiret.
 *
 * *Un tiret dirait « on ne sait pas »* ; ici on sait, et la réponse est zéro.
 * C'est la distinction que D88 fait sur les VGP, appliquée à une durée.
 */
function enHeuresEtMinutes(minutes: number): string {
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  if (heures === 0) {
    return `${reste} ${t("terrain.minutes")}`;
  }
  return `${heures} ${t("terrain.heures")} ${String(reste).padStart(2, "0")}`;
}

function Ligne({
  libelle,
  valeur,
}: {
  readonly libelle: string;
  readonly valeur: string | null;
}) {
  return (
    <>
      <dt className="text-app-encre-faible">{libelle}</dt>
      <dd className="font-medium">{valeur ?? t("terrain.inconnu")}</dd>
    </>
  );
}
