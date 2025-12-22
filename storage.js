const Storage = (() => {

  const isChromeStorage =
    typeof chrome !== "undefined" &&
    chrome.storage &&
    chrome.storage.local;

  function set(key, value) {
    if (isChromeStorage) {
      chrome.storage.local.set({ [key]: value });
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  function get(key, callback) {
    if (isChromeStorage) {
      chrome.storage.local.get(key, data => {
        callback(data[key] ?? null);
      });
    } else {
      const value = localStorage.getItem(key);
      callback(value ? JSON.parse(value) : null);
    }
  }

  function remove(key) {
    if (isChromeStorage) {
      chrome.storage.local.remove(key);
    } else {
      localStorage.removeItem(key);
    }
  }

  function clear() {
    if (isChromeStorage) {
      chrome.storage.local.clear();
    } else {
      localStorage.clear();
    }
  }

  return {
    set,
    get,
    remove,
    clear
  };

})();
