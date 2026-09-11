import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { Champ, Formulaire, Message } from "@/components/session/formulaire";
import { etatArriveeOuAnonyme } from "@/lib/auth/arrivee";
import { preparationDeLUrl } from "@/lib/auth/enrolement";
import { t } from "@/lib/i18n/fr";

/**
 * PARCOURS D'ENRÔLEMENT DU SECOND FACTEUR (ticket L1-02f, décision D58).
 *
 * **C'est le seul écran de libre-service du produit**, et il n'ouvre qu'une
 * transition, dans un seul sens : un compte peut se doter d'un second facteur,
 * il ne peut jamais s'en défaire. La page le DIT, parce qu'un utilisateur a le
 * droit de savoir qu'un geste est définitif avant de le faire.
 *
 * Deux étapes sur un même écran, distinguées par ce que l'URL porte : tant que
 * la clé n'a pas été révélée, on demande le mot de passe ; une fois révélée, on
 * l'affiche avec les codes de secours et on demande le code.
 *
 * **La clé et les codes de secours ne s'affichent qu'une fois.** Ils ne sont
 * relisibles nulle part — D59 a retiré le stockage en clair des codes de
 * secours, et c'est très exactement ce que cela veut dire.
 */
export default async function PageEnrolement({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const etat = await etatArriveeOuAnonyme(await headers());
  if (etat.issue === "anonyme") {
    redirect("/connexion");
  }
  if (etat.issue !== "enrolement_requis") {
    // Rien à enrôler : soit le compte porte déjà son facteur, soit son rôle ne
    // l'exige pas. Dans les deux cas, cet écran n'a rien à lui demander.
    redirect("/arrivee");
  }

  const { cle, codesSecours, motif } = preparationDeLUrl(await searchParams);

  if (cle === "") {
    return (
      <Formulaire
        action="/api/session/enrolement"
        titre={t("enrolement.titre")}
        accroche={t("enrolement.accroche")}
        valider={t("enrolement.reveler")}
      >
        <Message motif={motif === "" ? undefined : motif} />
        <p className="text-muted-foreground text-sm">
          {t("enrolement.definitif")}
        </p>
        <input type="hidden" name="etape" value="preparer" />
        <Champ
          nom="motDePasse"
          type="password"
          libelle={t("enrolement.mot_de_passe")}
        />
      </Formulaire>
    );
  }

  return (
    <Formulaire
      action="/api/session/enrolement"
      titre={t("enrolement.titre")}
      accroche={t("enrolement.cle.aide")}
      valider={t("enrolement.confirmer")}
    >
      <Message motif={motif === "" ? undefined : motif} />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t("enrolement.cle")}</span>
        <code className="bg-muted rounded-md px-3 py-2 font-mono text-sm break-all">
          {cle}
        </code>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">
          {t("enrolement.codes_secours")}
        </span>
        <p className="text-muted-foreground text-sm">
          {t("enrolement.codes_secours.aide")}
        </p>
        <ul className="bg-muted grid grid-cols-2 gap-1 rounded-md px-3 py-2 font-mono text-sm">
          {codesSecours.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
      </div>

      <input type="hidden" name="etape" value="confirmer" />
      <Champ
        nom="code"
        type="text"
        libelle={t("enrolement.code")}
        motif="[0-9]{6}"
      />
    </Formulaire>
  );
}
