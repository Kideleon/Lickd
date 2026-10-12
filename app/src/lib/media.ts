import { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import { randomId } from './util';

export type Bucket = 'avatars' | 'media';
export interface Picked { uri: string; type: 'image' | 'video'; mime: string; }

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'jpg',
  'video/mp4': 'mp4', 'video/quicktime': 'mov',
};

/** Opens the photo library. Returns [] if cancelled or permission denied. */
export async function pickMedia(opts: { video?: boolean; multiple?: boolean; max?: number; square?: boolean } = {}): Promise<Picked[]> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: opts.video ? ['images', 'videos'] : ['images'],
    allowsMultipleSelection: !!opts.multiple,
    selectionLimit: opts.max ?? 10,
    allowsEditing: !opts.multiple && !!opts.square,
    aspect: opts.square ? [1, 1] : undefined,
    quality: 0.8,
    videoMaxDuration: 60,
  });
  if (res.canceled) return [];
  return res.assets.map(toPicked);
}

export async function captureMedia(video = false): Promise<Picked[]> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return [];
  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: video ? ['images', 'videos'] : ['images'], quality: 0.8, videoMaxDuration: 60,
  });
  if (res.canceled) return [];
  return res.assets.map(toPicked);
}

function toPicked(a: ImagePicker.ImagePickerAsset): Picked {
  const type = a.type === 'video' ? 'video' : 'image';
  const mime = a.mimeType && EXT[a.mimeType] ? a.mimeType : type === 'video' ? 'video/mp4' : 'image/jpeg';
  return { uri: a.uri, type, mime };
}

/** Uploads to <uid>/<random>.<ext> and returns the object path stored in the database. */
export async function uploadMedia(uid: string, item: Picked, bucket: Bucket = 'media'): Promise<string> {
  const path = `${uid}/${randomId()}.${EXT[item.mime] ?? 'jpg'}`;
  const body = await (await fetch(item.uri)).arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: item.mime, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export function avatarUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

// Signed URLs for the private bucket, cached until shortly before expiry.
const TTL = 3600;
const cache = new Map<string, { url: string; exp: number }>();
const inflight = new Map<string, Promise<string | undefined>>();

export async function signedUrl(path: string): Promise<string | undefined> {
  const hit = cache.get(path);
  if (hit && hit.exp > Date.now() + 60_000) return hit.url;
  const pending = inflight.get(path);
  if (pending) return pending;
  const p = (async () => {
    const { data } = await supabase.storage.from('media').createSignedUrl(path, TTL);
    if (data?.signedUrl) cache.set(path, { url: data.signedUrl, exp: Date.now() + TTL * 1000 });
    inflight.delete(path);
    return data?.signedUrl;
  })();
  inflight.set(path, p);
  return p;
}

export function clearMediaCache() { cache.clear(); }

/** Resolves a stored path to a displayable URL (public for avatars bucket, signed for media). */
export function useMediaUrl(path: string | null | undefined, bucket: Bucket = 'media'): string | undefined {
  const [url, setUrl] = useState<string | undefined>(() =>
    !path ? undefined : bucket === 'avatars' ? avatarUrl(path) : cache.get(path)?.url);
  useEffect(() => {
    let alive = true;
    if (!path) { setUrl(undefined); return; }
    if (bucket === 'avatars') { setUrl(avatarUrl(path)); return; }
    signedUrl(path).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [path, bucket]);
  return url;
}
