import { createClient } from '@supabase/supabase-js';

/**
 * Retrieves the user's custom Supabase configuration from localStorage.
 */
export function getSupabaseConfig() {
  const url = localStorage.getItem('spoty_supabase_url');
  const anonKey = localStorage.getItem('spoty_supabase_anon_key');

  if (url && anonKey) {
    return { url, anonKey };
  }

  // If the user has explicitly disconnected, don't fallback to the default keys
  if (localStorage.getItem('spoty_supabase_disconnected') === 'true') {
    return null;
  }

  // Default shared cloud fallback so any user who installs this setup connects to the same cloud out-of-the-box!
  return {
    url: 'https://ywbcvnmtkaynxhnbtaum.supabase.co',
    anonKey: 'sb_publishable_C5uyyq2OFHcd7hqZ2t9IHw_1lULN8fZ'
  };
}

/**
 * Helper to determine if the Supabase cloud connection is configured.
 */
export function isSupabaseConfigured() {
  return getSupabaseConfig() !== null;
}

let supabase = null;

/**
 * Initializes and caches the Supabase client dynamically.
 */
export function initSupabase() {
  const config = getSupabaseConfig();
  if (!config) return null;

  try {
    if (!supabase) {
      supabase = createClient(config.url, config.anonKey);
    }
    return supabase;
  } catch (error) {
    console.error("Supabase initialization failed:", error);
    return null;
  }
}

/**
 * Fetches all globally shared songs from Supabase table 'cloud_songs'.
 */
export async function getCloudSongs() {
  const sb = initSupabase();
  if (!sb) return [];

  try {
    const { data, error } = await sb
      .from('cloud_songs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data.map(item => ({
      id: item.id,
      title: item.title,
      artist: item.artist,
      album: item.album,
      genre: item.genre,
      url: item.url,
      coverUrl: item.cover_url,
      likes: item.likes || 0,
      uploader: item.uploader || 'Anonymous',
      addedAt: new Date(item.created_at).getTime(),
      isCloud: true
    }));
  } catch (e) {
    console.error("Error fetching Supabase cloud songs:", e);
    return [];
  }
}

/**
 * Uploads a track and artwork to Supabase Storage & inserts record in table 'cloud_songs'.
 */
export async function uploadSongToCloud(title, artist, album, genre, audioFile, coverFile, uploaderName) {
  const sb = initSupabase();
  if (!sb) throw new Error("Supabase is not configured!");

  try {
    // Check total cloud songs count to prevent exceeding free tier storage limits
    const { count, error: countError } = await sb
      .from('cloud_songs')
      .select('*', { count: 'exact', head: true });

    if (!countError && count !== null && count >= 50) {
      throw new Error("Cloud Storage Limit Reached (Max 50 songs). Please delete an existing track to free up space!");
    }

    const songId = 'cloud-' + Math.random().toString(36).substring(2, 11);
    
    // 1. Upload audio file to 'spoty-media' storage bucket
    const audioPath = `songs/${songId}_audio.mp3`;
    const { data: audioUpload, error: audioError } = await sb.storage
      .from('spoty-media')
      .upload(audioPath, audioFile, { contentType: 'audio/mpeg' });

    if (audioError) throw audioError;

    // Get public URL for audio
    const { data: audioUrlData } = sb.storage
      .from('spoty-media')
      .getPublicUrl(audioPath);

    const audioUrl = audioUrlData.publicUrl;

    // 2. Upload cover artwork if present
    let coverUrl = '';
    if (coverFile) {
      const coverPath = `covers/${songId}_cover.jpg`;
      const { data: coverUpload, error: coverError } = await sb.storage
        .from('spoty-media')
        .upload(coverPath, coverFile, { contentType: 'image/jpeg' });

      if (coverError) throw coverError;

      // Get public URL for cover
      const { data: coverUrlData } = sb.storage
        .from('spoty-media')
        .getPublicUrl(coverPath);

      coverUrl = coverUrlData.publicUrl;
    }

    // 3. Save details to 'cloud_songs' table
    const songMeta = {
      id: songId,
      title: title || 'Untitled Cloud Track',
      artist: artist || 'Unknown Artist',
      album: album || 'Cloud Single',
      genre: genre || 'Pop',
      url: audioUrl,
      cover_url: coverUrl,
      likes: 0,
      uploader: uploaderName || 'Anonymous'
    };

    const { data, error } = await sb
      .from('cloud_songs')
      .insert([songMeta])
      .select();

    if (error) throw error;

    return {
      id: songId,
      title: songMeta.title,
      artist: songMeta.artist,
      album: songMeta.album,
      genre: songMeta.genre,
      url: songMeta.url,
      coverUrl: songMeta.cover_url,
      likes: 0,
      uploader: songMeta.uploader,
      isCloud: true,
      addedAt: Date.now()
    };
  } catch (e) {
    console.error("Error uploading track to Supabase cloud:", e);
    throw e;
  }
}

/**
 * Increments the global like counter for a shared Supabase song.
 */
export async function likeCloudSong(songId) {
  const sb = initSupabase();
  if (!sb) return;

  try {
    // 1. Fetch current likes
    const { data, error } = await sb
      .from('cloud_songs')
      .select('likes')
      .eq('id', songId)
      .single();

    if (error) throw error;

    const currentLikes = data.likes || 0;

    // 2. Increment and update
    const { error: updateError } = await sb
      .from('cloud_songs')
      .update({ likes: currentLikes + 1 })
      .eq('id', songId);

    if (updateError) throw updateError;
  } catch (e) {
    console.error("Error incrementing Supabase likes:", e);
  }
}

/**
 * Deletes a song from the database and its assets from storage bucket.
 */
export async function deleteCloudSong(songId) {
  const sb = initSupabase();
  if (!sb) return;

  try {
    // 1. Delete from database
    const { error: dbError } = await sb
      .from('cloud_songs')
      .delete()
      .eq('id', songId);

    if (dbError) throw dbError;

    // 2. Delete files from storage bucket
    const audioPath = `songs/${songId}_audio.mp3`;
    const coverPath = `covers/${songId}_cover.jpg`;
    
    await sb.storage.from('spoty-media').remove([audioPath, coverPath]);
  } catch (e) {
    console.error("Error deleting Supabase cloud song:", e);
    throw e;
  }
}
