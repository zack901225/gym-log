let db;
const DB_NAME = 'one-more-set';
export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('state');
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('請關閉其他舊版頁面後重試。'));
    request.onsuccess = () => { db = request.result; db.onversionchange = () => db.close(); resolve(); };
  });
}
export function readData() {
  return new Promise((resolve, reject) => {
    const request = db.transaction('state').objectStore('state').get('main');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export function writeData(data, expectedRevision) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readwrite');
    const store = tx.objectStore('state');
    let conflict = false;
    const request = store.get('main');
    request.onsuccess = () => {
      if ((request.result?.revision ?? 0) !== expectedRevision) { conflict = true; tx.abort(); return; }
      store.put(data, 'main');
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(new Error(conflict ? '另一個頁面已更新紀錄；已重新載入，請再操作一次。' : '儲存失敗，請確認裝置有足夠空間。'));
    tx.onerror = () => {};
  });
}
