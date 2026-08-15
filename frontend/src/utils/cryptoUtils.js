/**
 * Zero-Knowledge Client-Side End-to-End Encryption (E2EE) Utility
 * - Generates ECDH (P-256) KeyPair
 * - Stores PrivateKey securely in IndexedDB
 * - Derives AES-GCM 256-bit symmetric encryption key between participants
 * - Encrypts / Decrypts plaintext locally with IV
 */

const DB_NAME = 'NexusE2EEDB';
const STORE_NAME = 'keys';

// Open IndexedDB for key storage
const openKeyDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const storeLocalKey = async (id, data) => {
  const db = await openKeyDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ id, data });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
};

export const getLocalKey = async (id) => {
  const db = await openKeyDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result?.data || null);
    req.onerror = () => reject(req.error);
  });
};

// Generate ECDH KeyPair (P-256)
export const generateECDHKeyPair = async (userId) => {
  const keyPair = await window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );

  // Export Public Key to JWK (to share with other users)
  const exportedPublicKey = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);

  // Store Private Key securely in IndexedDB
  const exportedPrivateKey = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);
  await storeLocalKey(`private_key_${userId}`, exportedPrivateKey);
  await storeLocalKey(`public_key_${userId}`, exportedPublicKey);

  return {
    publicKeyJWK: JSON.stringify(exportedPublicKey),
    privateKey: keyPair.privateKey,
  };
};

// Import Remote User's Public Key from JWK String
export const importRemotePublicKey = async (publicKeyJWKStr) => {
  try {
    const jwk = typeof publicKeyJWKStr === 'string' ? JSON.parse(publicKeyJWKStr) : publicKeyJWKStr;
    return await window.crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      []
    );
  } catch (err) {
    console.error('Failed to import remote public key:', err);
    return null;
  }
};

// Derive Shared AES-GCM 256-bit Key
export const deriveSharedAESKey = async (userId, remotePublicKeyJWKStr) => {
  try {
    const localPrivateKeyJWK = await getLocalKey(`private_key_${userId}`);
    if (!localPrivateKeyJWK) return null;

    const privateKey = await window.crypto.subtle.importKey(
      'jwk',
      localPrivateKeyJWK,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    );

    const remotePublicKey = await importRemotePublicKey(remotePublicKeyJWKStr);
    if (!remotePublicKey) return null;

    const sharedAESKey = await window.crypto.subtle.deriveKey(
      { name: 'ECDH', public: remotePublicKey },
      privateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    return sharedAESKey;
  } catch (err) {
    console.error('Failed to derive shared AES key:', err);
    return null;
  }
};

// Encrypt plaintext message with AES-GCM
export const encryptMessage = async (plaintext, aesKey) => {
  if (!aesKey || !plaintext) return plaintext;
  try {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(plaintext);

    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      encodedData
    );

    // Combine IV + Ciphertext as Base64 string
    const ivArray = Array.from(iv);
    const cipherArray = Array.from(new Uint8Array(ciphertextBuffer));
    const payload = {
      iv: btoa(String.fromCharCode.apply(null, ivArray)),
      cipher: btoa(String.fromCharCode.apply(null, cipherArray)),
      is_encrypted: true,
    };

    return `[E2EE]${JSON.stringify(payload)}`;
  } catch (err) {
    console.error('Encryption failed:', err);
    return plaintext;
  }
};

// Decrypt message with AES-GCM
export const decryptMessage = async (encryptedStr, aesKey) => {
  if (!encryptedStr || !encryptedStr.startsWith('[E2EE]') || !aesKey) {
    return encryptedStr;
  }

  try {
    const jsonStr = encryptedStr.replace('[E2EE]', '');
    const payload = JSON.parse(jsonStr);

    const ivStr = atob(payload.iv);
    const iv = new Uint8Array(ivStr.split('').map((c) => c.charCodeAt(0)));

    const cipherStr = atob(payload.cipher);
    const ciphertext = new Uint8Array(cipherStr.split('').map((c) => c.charCodeAt(0)));

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (err) {
    console.error('Decryption failed:', err);
    return '[🔒 Encrypted Message - Authenticate to Decrypt]';
  }
};
