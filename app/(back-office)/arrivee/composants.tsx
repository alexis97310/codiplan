import { Button } from "@/components/ui/button";
import { type SocieteDuCompte } from "@/lib/auth/societe-active";
import { t } from "@/lib/i18n/fr";

/**
 * LE CHOIX D'UNE SOCIÉTÉ — un formulaire HTML, sans JavaScript.
 *
 * Il poste vers `/api/session/societe`, qui n'est qu'un passe-plat vers
 * `basculerSociete` : c'est elle qui relit l'habilitation en base, refuse un
 * rôle sans son second facteur, journalise, et applique le plancher de durée
 * de D35. *Rien de tout cela n'est recopié ici — deux lectures d'un même
 * critère divergeraient en silence (§9, 01/09).*
 *
 * La société ACTIVE est marquée plutôt que retirée de la liste : une liste dont
 * une entrée disparaît fait douter de l'habilitation, alors qu'elle est
 * simplement en cours d'usage.
 *
 * **D-04 (2/4) — l'accroche s'accorde au NOMBRE RÉEL de sociétés.** Cette
 * section se rend dès `societes.length > 0`, dans `page.tsx`, y compris pour
 * une seule : le pluriel « plusieurs sociétés » était donc affiché même à un
 * compte qui n'en a qu'une.
 *
 * **Vit hors de `page.tsx`** parce que Next.js refuse qu'un fichier de route
 * exporte autre chose que les champs qu'il reconnaît (`default`, `metadata`,
 * …) — un export `Choix` y ferait échouer `next build`. Il n'a pourtant
 * besoin d'aucune lecture : c'est un composant pur, ce qui permet de le
 * rendre et de le lire directement, sans base
 * (`tests/unit/app/arrivee-choix-aide.test.tsx`).
 */
export function Choix({
  societes,
  active,
}: {
  societes: readonly SocieteDuCompte[];
  active: string | null;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[14px] font-bold">{t("arrivee.choix.titre")}</h2>
      <p className="text-app-encre-faible text-[12.5px]">
        {t(
          societes.length === 1
            ? "arrivee.choix.aide_une"
            : "arrivee.choix.aide",
        )}
      </p>
      <ul className="flex flex-col gap-2">
        {societes.map((societe) => (
          <li key={societe.societeId}>
            <form
              action="/api/session/societe"
              method="post"
              className="bg-app-surface border-app-bord flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3"
            >
              <input type="hidden" name="societe" value={societe.societeId} />
              <span className="text-[13px] font-bold">
                {nomAffiche(societe)}
              </span>
              {/* Le rôle affiché est son LIBELLÉ (`role.<valeur>`,
                  `lib/i18n/fr.ts`), pas le nom brut de l'énumération — décision
                  de 99A-ARRIVEE, sur constat d'audit d'ergonomie : un compte
                  lisait « admin_societe » là où la ligne « Rôle » ci-dessus
                  faisait la même chose. Le NOM technique, lui, reste hors du
                  dictionnaire (L0-11) — seul son libellé y entre. */}
              <span className="text-app-encre-faible text-[11.5px]">
                {t(`role.${societe.role}`)}
              </span>
              {societe.societeId === active ? (
                <span className="text-app-encre-faible ml-auto text-[11.5px]">
                  {t("arrivee.choix.active")}
                </span>
              ) : (
                <Button type="submit" variant="outline" className="ml-auto">
                  {t("arrivee.choix.activer")}
                </Button>
              )}
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Le nom d'une société, ou son identifiant à défaut.
 *
 * La composition sort du JSX : ce qui se lit à l'écran vient du dictionnaire,
 * pas de la balise (L0-11).
 */
function nomAffiche(societe: SocieteDuCompte): string {
  if (societe.raisonSociale !== null) {
    return societe.raisonSociale;
  }
  return `${t("arrivee.choix.sans_nom")} ${societe.societeId.slice(0, 8)}`;
}
