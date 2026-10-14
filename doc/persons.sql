CREATE TABLE IF NOT EXISTS public.albums_persons
(
    "albumId" uuid NOT NULL,
    "personId" uuid NOT NULL,
    "ownerId" uuid NOT NULL,
    PRIMARY KEY ("albumId", "ownerId", "personId"),
    CONSTRAINT fk_albums FOREIGN KEY ("albumId")
        REFERENCES public.album (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_person_group FOREIGN KEY ("ownerId", "personId")
        REFERENCES public.person ("ownerId", "personGroupId")
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.albums_persons
        WHERE "ownerId" IS NULL
    ) THEN
        RAISE EXCEPTION 'Backfill albums_persons.ownerId before applying the composite key';
    END IF;
END;
$$;

ALTER TABLE public.albums_persons
    ALTER COLUMN "ownerId" SET NOT NULL;

ALTER TABLE public.albums_persons
    DROP CONSTRAINT IF EXISTS albums_persons_pkey;

ALTER TABLE public.albums_persons
    ADD CONSTRAINT albums_persons_pkey
    PRIMARY KEY ("albumId", "ownerId", "personId");

ALTER TABLE public.albums_persons
    DROP CONSTRAINT IF EXISTS fk_person_group;

ALTER TABLE public.albums_persons
    ADD CONSTRAINT fk_person_group
    FOREIGN KEY ("ownerId", "personId")
    REFERENCES public.person ("ownerId", "personGroupId")
    ON UPDATE CASCADE
    ON DELETE CASCADE;

DROP FUNCTION IF EXISTS insert_assets_for_person(UUID);

CREATE OR REPLACE FUNCTION insert_assets_for_person(
    person_group_id UUID,
    person_owner_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    inserted_count INTEGER;
BEGIN
    WITH inserted_rows AS (
        INSERT INTO public.album_asset ("albumId", "assetId")
        SELECT ap."albumId", af."assetId"
        FROM public.albums_persons ap
        INNER JOIN public.asset_face af
            ON af."personGroupId" = ap."personId"
        WHERE ap."personId" = person_group_id
            AND (person_owner_id IS NULL OR ap."ownerId" = person_owner_id)
        ON CONFLICT ("albumId", "assetId") DO NOTHING
        RETURNING 1
    )
    SELECT COUNT(*) INTO inserted_count FROM inserted_rows;
    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION person_assets_to_album_function()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."personGroupId" IS NOT NULL THEN
        PERFORM insert_assets_for_person(NEW."personGroupId", NULL);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS person_assets_to_album ON public.asset_face;
CREATE TRIGGER person_assets_to_album
AFTER INSERT OR UPDATE OF "personGroupId" ON public.asset_face
    FOR EACH ROW EXECUTE FUNCTION person_assets_to_album_function();
