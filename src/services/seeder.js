import { saveSong, getAllSongs } from './db';

// High-quality online streaming files from SoundHelix (stable public MP3s)
export const COMMUNITY_CATALOG = [
  {
    id: 'comm-1',
    title: 'Neon Horizon',
    artist: 'Retro Synthwave',
    album: 'Grid Runner',
    genre: 'Synthwave',
    duration: 372, // 6:12
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    coverGradient: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
    isUserUpload: false
  },
  {
    id: 'comm-2',
    title: 'Midnight Drive',
    artist: 'Digital Echo',
    album: 'Neon Lights',
    genre: 'Electronic',
    duration: 502, // 8:22
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    coverGradient: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
    isUserUpload: false
  },
  {
    id: 'comm-3',
    title: 'Solar Winds',
    artist: 'Stargaze',
    album: 'Deep Space',
    genre: 'Ambient',
    duration: 482, // 8:02
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    coverGradient: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
    isUserUpload: false
  },
  {
    id: 'comm-4',
    title: 'Cyberpunk Tokyo',
    artist: 'Vector Runner',
    album: 'Shibuya Beats',
    genre: 'Synthwave',
    duration: 544, // 9:04
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    coverGradient: 'linear-gradient(135deg, #f43f5e 0%, #a855f7 100%)',
    isUserUpload: false
  }
];

/**
 * Procedurally generates a beautiful 10-second synthesized audio loop using Web Audio API
 * and returns it as a WAV Blob.
 * 
 * Works 100% offline and acts as the perfect fallback & pre-seeded track.
 */
export async function generateProceduralTrack(title, baseFreq = 220, type = 'sine') {
  const sampleRate = 44100;
  const duration = 10; // seconds
  const numSamples = sampleRate * duration;
  
  // Create offline context (2 channels)
  const offlineCtx = new OfflineAudioContext(2, numSamples, sampleRate);
  
  // --- SYNTHESIZE AUDIO ---
  // Create a nice ambient pad / melody progression
  const osc1 = offlineCtx.createOscillator();
  const osc2 = offlineCtx.createOscillator();
  const osc3 = offlineCtx.createOscillator();
  
  const gainNode = offlineCtx.createGain();
  const filter = offlineCtx.createBiquadFilter();
  
  osc1.type = type;
  osc1.frequency.setValueAtTime(baseFreq, 0); // Root note
  // Simple chord progression (I - IV - V - I)
  osc1.frequency.setValueAtTime(baseFreq * 1.33, 2.5); // IV
  osc1.frequency.setValueAtTime(baseFreq * 1.5, 5.0);  // V
  osc1.frequency.setValueAtTime(baseFreq * 2.0, 7.5);  // Octave
  
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(baseFreq * 1.5, 0); // Perfect 5th
  osc2.frequency.setValueAtTime(baseFreq * 2.0, 2.5);
  osc2.frequency.setValueAtTime(baseFreq * 2.25, 5.0);
  osc2.frequency.setValueAtTime(baseFreq * 3.0, 7.5);

  osc3.type = 'sine';
  osc3.frequency.setValueAtTime(baseFreq * 1.2, 0); // Minor 3rd / Major 3rd feel
  osc3.frequency.setValueAtTime(baseFreq * 1.6, 2.5);
  osc3.frequency.setValueAtTime(baseFreq * 1.8, 5.0);
  osc3.frequency.setValueAtTime(baseFreq * 2.4, 7.5);
  
  // Set up LFO to sweep filter cutoff for beautiful movement
  const lfo = offlineCtx.createOscillator();
  const lfoGain = offlineCtx.createGain();
  lfo.frequency.value = 0.5; // 0.5 Hz
  lfoGain.gain.value = 400; // Sweep range
  
  filter.type = 'lowpass';
  filter.Q.value = 5;
  filter.frequency.value = 800;
  
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);
  
  // Connections
  osc1.connect(filter);
  osc2.connect(filter);
  osc3.connect(filter);
  
  filter.connect(gainNode);
  gainNode.connect(offlineCtx.destination);
  
  // Set envelopes
  gainNode.gain.setValueAtTime(0, 0);
  gainNode.gain.linearRampToValueAtTime(0.3, 0.5); // Attack
  gainNode.gain.setValueAtTime(0.3, 9.0);
  gainNode.gain.linearRampToValueAtTime(0, 10.0); // Release
  
  // Start oscillators
  osc1.start(0);
  osc2.start(0);
  osc3.start(0);
  lfo.start(0);
  
  osc1.stop(duration);
  osc2.stop(duration);
  osc3.stop(duration);
  lfo.stop(duration);
  
  // Render
  const renderedBuffer = await offlineCtx.startRendering();
  
  // Encode as WAV Blob
  return encodeWAV(renderedBuffer);
}

/**
 * Helper to encode an AudioBuffer to standard PCM WAV format.
 */
function encodeWAV(buffer) {
  const numOfChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // 1 = raw PCM 16-bit
  const bitDepth = 16;
  
  let result;
  if (numOfChan === 2) {
    result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
    result = buffer.getChannelData(0);
  }
  
  const bufferLength = result.length * 2;
  const arrayBuffer = new ArrayBuffer(44 + bufferLength);
  const view = new DataView(arrayBuffer);
  
  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + bufferLength, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numOfChan, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * numOfChan * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, numOfChan * 2, true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, bufferLength, true);
  
  // Write PCM audio samples
  floatTo16BitPCM(view, 44, result);
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function interleave(inputL, inputR) {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);
  let index = 0;
  let inputIndex = 0;
  
  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function floatTo16BitPCM(output, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Seeds initial tracks into the database on first load.
 */
export async function seedInitialSongsIfEmpty() {
  try {
    const existing = await getAllSongs();
    if (existing && existing.length > 0) {
      console.log('Database already has songs. Skipping seeder.');
      return;
    }
    
    console.log('Seeding initial offline songs in background...');
    
    // Track 1: Procedural Synth Loop 1 (Ambient Chords)
    const audioBlob1 = await generateProceduralTrack('Digital Dreams', 220, 'sine');
    await saveSong({
      id: 'seed-1',
      title: 'Digital Dreams',
      artist: 'Spoty Synth Engine',
      album: 'Procedural Waves',
      genre: 'Ambient',
      duration: 10,
      audioBlob: audioBlob1,
      isUserUpload: true
    });

    // Track 2: Procedural Synth Loop 2 (Rhythmic Arpeggio)
    const audioBlob2 = await generateProceduralTrack('Neon Pulsar', 146.83, 'triangle');
    await saveSong({
      id: 'seed-2',
      title: 'Neon Pulsar',
      artist: 'Spoty Synth Engine',
      album: 'Procedural Waves',
      genre: 'Techno',
      duration: 10,
      audioBlob: audioBlob2,
      isUserUpload: true
    });
    
    console.log('Successfully seeded database with procedural loops!');
  } catch (error) {
    console.error('Error seeding initial songs:', error);
  }
}
