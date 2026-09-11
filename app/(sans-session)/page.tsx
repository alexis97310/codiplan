import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/fr";

export default function PageAccueil() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6">
      <h1 className="text-4xl font-semibold tracking-tight">
        {t("accueil.titre")}
      </h1>
      <p className="text-muted-foreground text-lg">{t("accueil.accroche")}</p>
      <p className="text-muted-foreground text-sm">{t("accueil.socle")}</p>
      <div>
        <Button asChild variant="outline">
          <a href="https://github.com/alexis97310/codiplan/tree/main/docs">
            {t("accueil.action")}
          </a>
        </Button>
      </div>
    </main>
  );
}
