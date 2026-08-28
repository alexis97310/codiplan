-- CODIPLAN — Thématisation par société (ticket L0-09).
--
-- Deux changements sur `societe`, et un seul sujet : la charte est une DONNÉE,
-- avec tout ce que cela implique — elle peut manquer, et elle doit avoir une
-- forme contrôlée.
--
-- 1. Les deux couleurs deviennent NULLABLES. « Société sans charte » doit être
--    un état représentable : sans cela, le provisionnement d'un nouveau client
--    inventerait deux couleurs pour satisfaire la contrainte, et plus personne
--    ne distinguerait ensuite un choix d'un remplissage. Une société sans
--    charte reçoit le thème neutre CODIPLAN, défini une fois dans
--    `lib/theme/defaut.ts` et identifié comme LE défaut.
--
-- 2. Une contrainte de FORME refuse ce qui n'est pas une couleur sRGB. C'est le
--    seul refus de couleur du dépôt, et il ne porte pas sur la teinte : un
--    jaune pâle est une couleur légitime, choisie par un client qui a le droit
--    de son identité visuelle. Sa lisibilité est traitée au rendu, par calcul
--    du contraste et choix de l'encre (D51). Ce qui est refusé ici est une
--    donnée cassée : `bleu`, `rgb(0,0,0)`, une chaîne vide.
--
-- Actions référentielles : aucune clé étrangère n'est créée ni modifiée ici
-- (CLAUDE.md §9 — toute clé nouvelle dit ses deux actions).

ALTER TABLE "societe"
  ALTER COLUMN "couleur_primaire" DROP NOT NULL,
  ALTER COLUMN "couleur_secondaire" DROP NOT NULL;

ALTER TABLE "societe"
  ADD CONSTRAINT "societe_couleur_primaire_forme"
  CHECK (
    "couleur_primaire" IS NULL
    OR "couleur_primaire" ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'
  );

ALTER TABLE "societe"
  ADD CONSTRAINT "societe_couleur_secondaire_forme"
  CHECK (
    "couleur_secondaire" IS NULL
    OR "couleur_secondaire" ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'
  );

COMMENT ON COLUMN "societe"."couleur_primaire" IS
  'Couleur d''identité de la société (L0-09). Nullable : une société sans charte reçoit le thème neutre CODIPLAN. La contrainte societe_couleur_primaire_forme contrôle la FORME (#rgb ou #rrggbb), jamais la teinte — la lisibilité se calcule au rendu (D51).';

COMMENT ON COLUMN "societe"."couleur_secondaire" IS
  'Couleur d''accentuation de la société (L0-09). Mêmes règles que couleur_primaire.';
