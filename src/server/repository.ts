"use server"
import { auth } from '@/auth';
import { environment } from '@/env/environment';
import pg from 'pg';

const { Pool } = pg;
const client = new Pool({
    database: environment.database.databaseName,
    user: environment.database.username,
    password: environment.database.password,
    host: environment.database.host,
    port: parseInt(environment.database.port)
});

async function getImmichUserId(): Promise<string> {
    const userId = (await auth())?.user?.userId;
    if (!userId) {
        throw new Error("Immich user ID is unavailable. Sign in again.")
    }
    return userId;
}

export interface AlbumPerson {
    id: string;
    albumId: string;
    ownerId: string;
    name?: string;
}

export async function createRelTable() {
    await client.query(`
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
        )
      `)
}

export async function listAlbumPeople(albumId: string): Promise<AlbumPerson[]> {
    const userId = await getImmichUserId();

	const data = await client.query(`
    SELECT ap."albumId", ap."personId", ap."ownerId", p."name"
    FROM public.albums_persons ap
    INNER JOIN person p
    ON p."ownerId" = ap."ownerId"
    AND p."personGroupId" = ap."personId"
    WHERE ap."albumId" = $1
    AND ap."ownerId" = $2
  `, [albumId, userId]);

	return data.rows.map((row) => ({
        id: row.personId,
        albumId: row.albumId,
        ownerId: row.ownerId,
        name: row.name
    }));

}

export async function addToAlbum(personIds: string[], albumId: string) {
    const userId = await getImmichUserId();
    const query = `
        INSERT INTO public.albums_persons ("albumId", "ownerId", "personId")
        SELECT $1, $2, unnest($3::uuid[])
        ON CONFLICT ("albumId", "ownerId", "personId") DO NOTHING
    `;
    await client.query(query, [albumId, userId, personIds]);
}

export async function addAssetsToAlbum(personId: string) {
    const userId = await getImmichUserId();
    const query = `
        select * from insert_assets_for_person($1, $2)
    `
    await client.query(query, [personId, userId]);
}

export async function removeFromAlbum(personId: string, albumId: string) {
    const userId = await getImmichUserId();
    const query = `
        DELETE FROM public.albums_persons
        WHERE "albumId" = $1 AND "personId" = $2 AND "ownerId" = $3
    `;
    await client.query(query, [albumId, personId, userId]);
}