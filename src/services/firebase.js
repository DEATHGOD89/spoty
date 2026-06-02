import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  increment, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';

/**
 * Retrieves the user's custom Firebase configuration from localStorage.
 */
export function getFirebaseConfig() {
  const apiKey = localStorage.getItem('spoty_firebase_api_key');
  const authDomain = localStorage.getItem('spoty_firebase_auth_domain');
  const projectId = localStorage.getItem('spoty_firebase_project_id');
  const storageBucket = localStorage.getItem('spoty_firebase_storage_bucket');
  const messagingSenderId = localStorage.getItem('spoty_firebase_messaging_sender_id');
  const appId = localStorage.getItem('spoty_firebase_app_id');

  // We require at least ApiKey and ProjectId to attempt initialization
  if (apiKey && projectId) {
    return { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId };
  }
  return null;
}

/**
 * Helper to determine if the cloud connection is active.
 */
export function isFirebaseConfigured() {
  return getFirebaseConfig() !== null;
}

let app = null;
let db = null;
let storage = null;

/**
 * Initializes and caches the Firebase instance dynamically.
 */
export function initFirebase() {
  const config = getFirebaseConfig();
  if (!config) return null;

  try {
    if (getApps().length === 0) {
      app = initializeApp(config);
    } else {
      app = getApp();
    }
    db = getFirestore(app);
    storage = getStorage(app);
    return { app, db, storage };
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    return null;
  }
}

/**
 * Fetches all globally shared songs from Firestore.
 */
export async function getCloudSongs() {
  const fb = initFirebase();
  if (!fb) return [];

  try {
    const q = query(collection(fb.db, "cloud_songs"), orderBy("addedAt", "desc"));
    const querySnapshot = await getDocs(q);
    const songsList = [];
    querySnapshot.forEach((doc) => {
      songsList.push({ id: doc.id, ...doc.data() });
    });
    return songsList;
  } catch (e) {
    console.error("Error fetching cloud songs:", e);
    return [];
  }
}

/**
 * Uploads a music track and its cover to Firebase Storage & indexes metadata in Firestore.
 */
export async function uploadSongToCloud(title, artist, album, genre, audioBlob, coverBlob, uploaderName) {
  const fb = initFirebase();
  if (!fb) throw new Error("Firebase is not configured!");

  try {
    const songId = 'cloud-' + Math.random().toString(36).substring(2, 11);
    
    // 1. Upload audio file to Storage
    const audioRef = ref(fb.storage, `songs/${songId}_audio.mp3`);
    const audioSnapshot = await uploadBytes(audioRef, audioBlob);
    const audioUrl = await getDownloadURL(audioSnapshot.ref);

    // 2. Upload cover artwork if present
    let coverUrl = '';
    if (coverBlob) {
      const coverRef = ref(fb.storage, `covers/${songId}_cover.jpg`);
      const coverSnapshot = await uploadBytes(coverRef, coverBlob);
      coverUrl = await getDownloadURL(coverSnapshot.ref);
    }

    // 3. Save details to Firestore
    const songMeta = {
      title: title || 'Untitled Cloud Track',
      artist: artist || 'Unknown Artist',
      album: album || 'Cloud Single',
      genre: genre || 'Pop',
      url: audioUrl,
      coverUrl: coverUrl,
      likes: 0,
      addedAt: Date.now(),
      uploader: uploaderName || 'Anonymous',
      isCloud: true
    };

    const docRef = await addDoc(collection(fb.db, "cloud_songs"), songMeta);
    return { id: docRef.id, ...songMeta };
  } catch (e) {
    console.error("Error uploading track to cloud:", e);
    throw e;
  }
}

/**
 * Increments the global like counter for a shared cloud song.
 */
export async function likeCloudSong(docId) {
  const fb = initFirebase();
  if (!fb) return;

  try {
    const songRef = doc(fb.db, "cloud_songs", docId);
    await updateDoc(songRef, {
      likes: increment(1)
    });
  } catch (e) {
    console.error("Error incrementing cloud likes:", e);
  }
}
