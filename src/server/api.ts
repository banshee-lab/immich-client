"use server"
import { NoCoverImg } from "@/app/ui/album/item";
import { auth } from "@/auth";
import { environment } from "@/env/environment";
import axios from "axios";

const axiosClient = axios.create({
    baseURL: environment.api.url + "/api",
    headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
})

export interface AuthenticationResponse {
    accessToken: string,
    userId: string,
    name: string,
    userEmail: string,
    profileImagePath: string,
}

export interface Album {
    albumName: string,
    albumThumbnailAssetId: string,
    assetCount: number,
    id: string
}

export interface PeopleResponse {
    people: People[],
    hasNextPage: boolean
}

export interface People {
    id: string,
    name?: string,
    image?: string,
}

export async function do_get(url: string, type: 'arraybuffer' | 'json' = 'json'): Promise<any> {
    const accessToken = (await auth())?.accessToken
    if (!accessToken) {
        throw new Error("Immich access token is unavailable. Sign in again.")
    }
    const response = await axiosClient.get(url, {
        responseType: type,
        headers: {
            Authorization: ["Bearer", accessToken].join(" "),
            Accept: type === 'arraybuffer' ? 'application/octet-stream' : 'application/json',
        },
    })
    return response
}

export async function authenticate(username: string, password: string): Promise<AuthenticationResponse> {
    const response = await axiosClient.post('/auth/login', {email: username, password: password})
    return response.data
}

export async function listAlbums(): Promise<Album[]> {
    const albums = (await do_get('albums?shared=true')).data
    albums.sort((a: Album, b: Album) => a.albumName.localeCompare(b.albumName))
    return albums
}

export async function getAlbum(id: string): Promise<Album> {
    return (await do_get(`albums/${id}`)).data
}

export async function getAssetThumbnail(assetId: string): Promise<string> {
    try {
        const imageData = await do_get(`/assets/${assetId}/thumbnail`, "arraybuffer")
        const base64String = imageData.data.toString('base64')
        return `data:${imageData.headers['content-type']};base64,${base64String}`
    } catch {
        return NoCoverImg
    }

}

export async function listPeople(thumbs: boolean = false): Promise<People[]> {
    const response: PeopleResponse = (await do_get('people')).data
    if (!thumbs) return response.people
    const list = await Promise.all(response.people.map(async p => {
        p.image = await getPeopleThumbnail(p.id)
        return p
    }))
    return list
}

export async function getPeopleThumbnail(id: string): Promise<string> {
    try {
        const imageData = await do_get(`/people/${id}/thumbnail`, "arraybuffer")
        const base64String = imageData.data.toString('base64')
        return `data:${imageData.headers['content-type']};base64,${base64String}`
    } catch {
        return NoCoverImg
    }
}
