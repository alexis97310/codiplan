import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  EnTete,
  Etiquette,
  Mesure,
  Page,
  Panneau,
  Vide,
} from "@/components/charte/socle";
import { etatArrivee } from "@/lib/auth/arrivee";
import { obtenirSession } from "@/lib/auth/session";
import { maintenant } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n/fr";
import { fuseauDeLaSocieteActive } from "@/lib/planning/depot";
import {
  type CompositionHeures,
  type FicheTechnicien,
  type HabilitationDatee,
  lireLesTechniciens,
} from "@/lib/techniciens/depot";

/**
 * L'ÉCRAN DES TECHNICIENS (ticket L2-13) — D9, D76.
 *
 * **Le taux d'occupation n'est JAMAIS rendu seul** (D76) : la barre segmentée
 * montre les quatre composantes, la formule est écrite à côté du nom, et les
 * deux termes du rapport sont affichés. Un pourcentage isolé se lirait comme un
 * rendement, et quelqu'un déciderait dessus.
 *
 * **Une habilitation expirée s'affiche**, en oxyde, avec le nombre de jours
 * écoulés (D81) : elle refuse une affectation, elle ne masque pas sa ligne.
 */
export default async function PageTechniciens() {
  const entetes = await headers();
  const etat = await etatArrivee(entetes);
  if (etat.issue === "anonyme") {
    redirect("/connexion");
  }
  if (etat.issue === "enrolement_requis") {
    redirect("/enrolement");
  }
  if (etat.issue === "sans_societe") {
    redirect("/arrivee");
  }

  const session = await obtenirSession(entetes);
  if (session === null) {
    redirect("/connexion");
  }

  const fuseau = (await fuseauDeLaSocieteActive(session.contexte)) ?? "UTC";
  const jour = maintenant(fuseau).local;
  const techniciens = await lireLesTechniciens(session.contexte, jour);

  return (
    <Page>
      <EnTete
        titre={t("techniciens.titre")}
        accroche={t("techniciens.accroche")}
      />

      {techniciens.length === 0 ? (
        <Vide
          titre={t("techniciens.vide.titre")}
          invitation={t("techniciens.vide.invitation")}
        />
      ) : (
        techniciens.map((technicien) => (
          <Fiche key={technicien.id} technicien={technicien} />
        ))
      )}

      <p>
        <a className="text-bleu underline" href="/arrivee">
          {t("navigation.retour")}
        </a>
      </p>
    </Page>
  );
}

function Fiche({ technicien }: { technicien: FicheTechnicien }) {
  return (
    <Panneau titre={technicien.nom}>
      <p className="text-gris mb-3 text-sm">{technicien.agence}</p>
      {technicien.calendrierPropre ? (
        <p className="mb-3">
          <Etiquette texte={t("techniciens.horaires_propres")} ton="ambre" />
        </p>
      ) : null}

      <h3 className="mb-2 text-sm">{t("techniciens.habilitations")}</h3>
      {technicien.habilitations.length === 0 ? (
        <p className="text-gris max-w-[65ch] text-sm">
          {t("techniciens.habilitations.aucune")}
        </p>
      ) : (
        <ul className="mb-5 flex flex-col gap-1">
          {technicien.habilitations.map((habilitation) => (
            <Habilitation key={habilitation.code} habilitation={habilitation} />
          ))}
        </ul>
      )}

      <Heures heures={technicien.heures} />
    </Panneau>
  );
}

/** Une habilitation, et l'EFFET de son échéance — jamais la date seule. */
function Habilitation({ habilitation }: { habilitation: HabilitationDatee }) {
  const effet = habilitation.effet;
  const expiree = effet.nature === "expiree";

  return (
    <li
      className={
        expiree
          ? "border-oxyde bg-oxyde-fond text-oxyde flex flex-wrap items-baseline justify-between gap-x-4 border-l-4 px-2 py-1 text-sm"
          : "border-trait flex flex-wrap items-baseline justify-between gap-x-4 border-l-4 px-2 py-1 text-sm"
      }
    >
      <span>
        <span className="font-bold">{habilitation.code}</span>{" "}
        <span>{habilitation.libelle}</span>
      </span>
      <span className={expiree ? "font-bold" : "text-gris"}>
        {effet.nature === "sans_echeance"
          ? t("techniciens.sans_echeance")
          : effet.nature === "expiree"
            ? `${t("techniciens.expiree_depuis")} ${effet.joursDepuis} ${t("techniciens.jours")}`
            : `${t("techniciens.valable_jours")} ${effet.joursRestants} ${t("techniciens.jours")}`}
      </span>
    </li>
  );
}

function heuresEtMinutes(minutes: number): string {
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return reste === 0 ? `${heures} h` : `${heures} h ${reste}`;
}

/**
 * Un segment de la barre, et son entrée de légende.
 *
 * **Les quatre segments sont écrits un par un**, jamais parcourus depuis un
 * tableau. Un tableau serait plus court ; il ferait aussi voyager les libellés
 * et les classes à l'intérieur du JSX, où le gardien des chaînes visibles les
 * lit — à raison — comme du texte d'écran. *Quatre appels explicites valent
 * mieux qu'une boucle qui oblige à exempter quelque chose.*
 */
function Segment({
  minutes,
  total,
  classe,
}: {
  minutes: number;
  total: number;
  classe: string;
}) {
  if (minutes === 0) {
    return null;
  }
  return (
    <span className={classe} style={{ width: `${(minutes / total) * 100}%` }} />
  );
}

function EntreeHeures({
  libelle,
  minutes,
  classe,
}: {
  libelle: string;
  minutes: number;
  classe: string;
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden
        className={cn("inline-block h-3 w-3 rounded-sm", classe)}
      />
      {libelle}
      <span className="font-bold">{heuresEtMinutes(minutes)}</span>
    </li>
  );
}

/**
 * La barre segmentée et sa formule.
 *
 * Les quatre segments sont proportionnels au TEMPS SAISI, et la barre ne
 * prétend pas remplir les heures travaillées : la différence est du temps non
 * pointé, et l'afficher comme un cinquième segment inventerait une donnée.
 */
function Heures({ heures }: { heures: CompositionHeures }) {
  const total =
    heures.interventionMinutes +
    heures.trajetMinutes +
    heures.atelierMinutes +
    heures.autresMinutes;

  return (
    <section>
      <h3 className="mb-2 text-sm">{t("techniciens.heures.titre")}</h3>

      {total === 0 ? (
        <p className="text-gris max-w-[65ch] text-sm">
          {t("techniciens.heures.aucune")}
        </p>
      ) : (
        <>
          <div
            className="border-trait flex h-5 w-full overflow-hidden rounded-sm border"
            role="img"
            aria-label={t("techniciens.heures.titre")}
          >
            <Segment
              minutes={heures.interventionMinutes}
              total={total}
              classe="bg-bleu"
            />
            <Segment
              minutes={heures.trajetMinutes}
              total={total}
              classe="bg-gris"
            />
            <Segment
              minutes={heures.atelierMinutes}
              total={total}
              classe="bg-vert"
            />
            <Segment
              minutes={heures.autresMinutes}
              total={total}
              classe="bg-ambre"
            />
          </div>

          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <EntreeHeures
              libelle={t("techniciens.heures.intervention")}
              minutes={heures.interventionMinutes}
              classe="bg-bleu"
            />
            <EntreeHeures
              libelle={t("techniciens.heures.trajet")}
              minutes={heures.trajetMinutes}
              classe="bg-gris"
            />
            <EntreeHeures
              libelle={t("techniciens.heures.atelier")}
              minutes={heures.atelierMinutes}
              classe="bg-vert"
            />
            <EntreeHeures
              libelle={t("techniciens.heures.autres")}
              minutes={heures.autresMinutes}
              classe="bg-ambre"
            />
          </ul>
        </>
      )}

      <dl className="mt-4 flex flex-col gap-1.5">
        <Mesure
          libelle={t("techniciens.heures.intervention")}
          valeur={heuresEtMinutes(heures.interventionMinutes)}
        />
        <Mesure
          libelle={t("techniciens.heures.travaillees")}
          valeur={heuresEtMinutes(heures.travailleesMinutes)}
        />
        <Mesure
          libelle={t("techniciens.occupation")}
          valeur={
            heures.travailleesMinutes === 0
              ? t("techniciens.occupation.indisponible")
              : `${Math.round((heures.interventionMinutes / heures.travailleesMinutes) * 100)} %`
          }
          accent="bleu"
        />
      </dl>

      {/* LA FORMULE, à côté du nom, JAMAIS le pourcentage seul (D76). */}
      <p className="text-gris mt-1 max-w-[65ch] text-xs">
        {t("techniciens.occupation.formule")}
      </p>
      <p className="text-gris mt-1 max-w-[65ch] text-xs">
        {t("techniciens.occupation.absences")}
      </p>
    </section>
  );
}
