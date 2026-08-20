-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin_plateforme', 'editeur_commercial', 'editeur_support', 'direction', 'responsable_materiel', 'responsable_sav', 'adv', 'technicien', 'client');

-- CreateTable
CREATE TABLE "devise" (
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "decimales" INTEGER NOT NULL,
    "symbole" TEXT,

    CONSTRAINT "devise_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "parite" (
    "id" TEXT NOT NULL,
    "devise_code" TEXT NOT NULL,
    "date_effet" DATE NOT NULL,
    "taux" DECIMAL(18,8) NOT NULL,
    "source" TEXT NOT NULL,

    CONSTRAINT "parite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "societe" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "raison_sociale" TEXT NOT NULL,
    "pays" TEXT NOT NULL,
    "territoire" TEXT NOT NULL,
    "fuseau_horaire" TEXT NOT NULL,
    "devise_code" TEXT NOT NULL,
    "taux_horaire_defaut" DECIMAL(18,4) NOT NULL,
    "majoration_hors_ouverture_pct" DECIMAL(5,2) NOT NULL,
    "logo_url" TEXT,
    "couleur_primaire" TEXT NOT NULL,
    "couleur_secondaire" TEXT NOT NULL,
    "mentions_legales" TEXT,
    "langue" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "societe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agence" (
    "id" TEXT NOT NULL,
    "societe_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "adresse" JSONB,
    "fuseau_horaire" TEXT,
    "calendrier_id" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "agence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilisateur" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mot_de_passe_hash" TEXT,
    "mfa_actif" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "derniere_connexion" TIMESTAMP(3),

    CONSTRAINT "utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilisateur_societe" (
    "id" TEXT NOT NULL,
    "utilisateur_id" TEXT NOT NULL,
    "societe_id" TEXT NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "utilisateur_societe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilisateur_client" (
    "id" TEXT NOT NULL,
    "utilisateur_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "societe_id" TEXT NOT NULL,
    "perimetre_sites" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "utilisateur_client_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parite_devise_code_date_effet_key" ON "parite"("devise_code", "date_effet");

-- CreateIndex
CREATE UNIQUE INDEX "societe_code_key" ON "societe"("code");

-- CreateIndex
CREATE UNIQUE INDEX "agence_societe_id_code_key" ON "agence"("societe_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateur_email_key" ON "utilisateur"("email");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateur_societe_utilisateur_id_societe_id_key" ON "utilisateur_societe"("utilisateur_id", "societe_id");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateur_client_utilisateur_id_client_id_key" ON "utilisateur_client"("utilisateur_id", "client_id");

-- AddForeignKey
ALTER TABLE "parite" ADD CONSTRAINT "parite_devise_code_fkey" FOREIGN KEY ("devise_code") REFERENCES "devise"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "societe" ADD CONSTRAINT "societe_devise_code_fkey" FOREIGN KEY ("devise_code") REFERENCES "devise"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agence" ADD CONSTRAINT "agence_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilisateur_societe" ADD CONSTRAINT "utilisateur_societe_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilisateur_societe" ADD CONSTRAINT "utilisateur_societe_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilisateur_client" ADD CONSTRAINT "utilisateur_client_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilisateur_client" ADD CONSTRAINT "utilisateur_client_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

