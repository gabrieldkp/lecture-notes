// IndexedDB 저장소: 강의 정보(lectures)와 큰 파일(files: PDF, 녹음)을 따로 보관

const DB_NAME = 'lecture-notes';
const DB_VER = 1;
let dbPromise;

function db() {
  dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('lectures')) d.createObjectStore('lectures', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('files')) d.createObjectStore('files');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const listLectures = () => tx('lectures', 'readonly', (s) => s.getAll());
export const getLecture = (id) => tx('lectures', 'readonly', (s) => s.get(id));
export const putLecture = (lec) => tx('lectures', 'readwrite', (s) => s.put({ ...lec, updatedAt: Date.now() }));

export const getFile = (key) => tx('files', 'readonly', (s) => s.get(key));
export const putFile = (key, blob) => tx('files', 'readwrite', (s) => s.put(blob, key));
export const delFile = (key) => tx('files', 'readwrite', (s) => s.delete(key));

export async function deleteLecture(id) {
  await tx('lectures', 'readwrite', (s) => s.delete(id));
  await delFile(`${id}:pdf`);
  await delFile(`${id}:audio`);
}

// 브라우저가 저장공간을 임의로 지우지 않도록 요청 (홈 화면에 추가하면 더 안전)
export async function requestPersist() {
  try { if (navigator.storage?.persist) await navigator.storage.persist(); } catch { /* 무시 */ }
}
