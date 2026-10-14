import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseUrl(): string | null {
  const direct =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (direct && direct.trim()) {
    let raw = direct.trim().replace(/^["']|["']$/g, '');
    try {
      const parsed = new URL(raw);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return raw.replace(/\/+$/, '');
    }
  }

  // Fallback: derive project host from DATABASE_URL or DIRECT_URL if using Supabase pooler
  const dbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL || '';
  const match = dbUrl.match(/postgres\.([a-zA-Z0-9_-]+):/);
  if (match && match[1]) {
    return `https://${match[1]}.supabase.co`;
  }

  return null;
}

export function getSupabaseKey(): string | null {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (key && key.trim()) {
    return key.trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseKey());
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseClient) {
    const supabaseUrl = getSupabaseUrl()!;
    const supabaseKey = getSupabaseKey()!;

    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        fetch: (url, options = {}) => {
          return fetch(url, {
            ...options,
            cache: 'no-store',
          });
        },
      },
    });
  }

  return supabaseClient;
}

/**
 * Uploads a profile avatar photo to Supabase Storage bucket 'avatars'.
 * Returns the public URL of the uploaded image.
 */
export async function uploadProfilePhotoToSupabase(
  userId: string,
  buffer: Buffer,
  contentType: string
): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const bucketName = 'avatars';
    const ext = contentType.includes('png')
      ? 'png'
      : contentType.includes('webp')
      ? 'webp'
      : 'jpg';
    const filePath = `user-${userId}-${Date.now()}.${ext}`;

    // Upload to bucket with upsert
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.warn('Supabase storage upload error:', error.message);
      return null;
    }

    // For private buckets, generate a long-lived signed URL; otherwise fallback to publicUrl
    const { data: signedData } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1-year valid signed URL

    if (signedData?.signedUrl) {
      return signedData.signedUrl;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucketName).getPublicUrl(filePath);

    return publicUrl || null;
  } catch (err: any) {
    console.warn('Supabase upload exception:', err.message);
    return null;
  }
}

/**
 * Deletes an avatar photo from Supabase Storage bucket 'avatars'.
 */
export async function deleteProfilePhotoFromSupabase(avatarUrl: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase || !avatarUrl) return false;

  try {
    const bucketName = 'avatars';
    const marker = `/${bucketName}/`;
    const idx = avatarUrl.indexOf(marker);
    if (idx === -1) return false;

    const filePath = avatarUrl.substring(idx + marker.length).split('?')[0];
    if (!filePath) return false;

    const { error } = await supabase.storage.from(bucketName).remove([filePath]);
    return !error;
  } catch {
    return false;
  }
}
