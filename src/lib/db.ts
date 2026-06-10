// IndexedDB wrapper to store document data (HTML content, stats, enhancements)
// client-side without size limits (unlike sessionStorage).

export function saveDocToDB(id: string, data: any): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }
    const request = indexedDB.open('StudyGuideDB', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('documents');
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('documents', 'readwrite');
      tx.objectStore('documents').put(data, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}

export function getDocFromDB(id: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }
    const request = indexedDB.open('StudyGuideDB', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('documents');
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('documents', 'readonly');
      const req = tx.objectStore('documents').get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    };
    request.onerror = () => reject(request.error);
  });
}
