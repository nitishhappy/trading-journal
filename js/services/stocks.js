import { state } from '../state.js';
import { db } from '../firebase-init.js';
import { showToast } from '../utils/toast.js';

export let stocksUnsubscribe = null;

// Attach a real-time Firestore snapshot listener for Stocks
export function loadStocks() {
  if (!state.currentUser) return;
  
  const ref = db.collection("users")
                .doc(state.currentUser.uid)
                .collection("stocks");
                
  stocksUnsubscribe = ref.orderBy("dateOfRun", "desc").onSnapshot((snap) => {
    const list = [];
    snap.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() });
    });
    state.stocks = list;
    window.dispatchEvent(new CustomEvent('stocks-updated'));
  }, (err) => {
    console.error("Stocks load error:", err);
  });
}

// Batch write new scanned stocks to Firestore
export function addStocksBatch(stocksArray) {
  if (!state.currentUser || !stocksArray || stocksArray.length === 0) return Promise.resolve();

  const batch = db.batch();
  const userDocRef = db.collection("users").doc(state.currentUser.uid);
  const stocksCollection = userDocRef.collection("stocks");

  stocksArray.forEach((stock) => {
    const ticker = (stock.ticker || "").toUpperCase().trim();
    const dateOfRun = (stock.dateOfRun || "").trim();
    if (!ticker || !dateOfRun) return;

    // Compound doc ID: TICKER_dateOfRun
    const docId = `${ticker}_${dateOfRun}`;
    const docRef = stocksCollection.doc(docId);

    // Save fields. Merge to prevent overwriting existing data (like My Notes or Traded status if already manually edited)
    const payload = {
      name: stock.name || "",
      ticker: ticker,
      tvLink: stock.tvLink || "",
      summary: stock.summary || "",
      dateOfRun: dateOfRun,
      source: stock.source || "Afzal",
      timeframe: stock.timeframe || "Daily",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (stock.sector) payload.sector = stock.sector;
    if (stock.myNotes !== undefined) payload.myNotes = stock.myNotes;
    if (stock.traded !== undefined) payload.traded = stock.traded;

    batch.set(docRef, payload, { merge: true });
  });

  return batch.commit().then(() => {
    showToast(`Successfully synced ${stocksArray.length} stock(s) to Firestore`);
  }).catch((err) => {
    console.error("Batch write stocks error:", err);
    showToast("Failed to sync scanned stocks");
    throw err;
  });
}

// Update single stock fields (inline edits)
export function updateStock(stockId, fields) {
  if (!state.currentUser) return Promise.resolve();

  const docRef = db.collection("users")
                   .doc(state.currentUser.uid)
                   .collection("stocks")
                   .doc(stockId);

  return docRef.update({
    ...fields,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).catch((err) => {
    console.error("Update stock error:", err);
    showToast("Failed to update stock");
  });
}

// Batch update stock fields (from auto-sync)
export function updateStocksBatch(updatesArray) {
  if (!state.currentUser || !updatesArray || updatesArray.length === 0) return Promise.resolve();

  const batch = db.batch();
  const stocksCollection = db.collection("users")
                             .doc(state.currentUser.uid)
                             .collection("stocks");

  updatesArray.forEach((upd) => {
    const docRef = stocksCollection.doc(upd.id);
    batch.update(docRef, {
      ...upd.data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  });

  return batch.commit().then(() => {
    showToast(`Successfully synced ${updatesArray.length} stock updates to Firestore`);
  }).catch((err) => {
    console.error("Batch update stocks error:", err);
    showToast("Failed to sync scanned stock updates");
    throw err;
  });
}

// Delete single stock entry
export function deleteStock(stockId) {
  if (!state.currentUser) return Promise.resolve();

  const docRef = db.collection("users")
                   .doc(state.currentUser.uid)
                   .collection("stocks")
                   .doc(stockId);

  return docRef.delete().then(() => {
    showToast("Stock deleted successfully");
  }).catch((err) => {
    console.error("Delete stock error:", err);
    showToast("Failed to delete stock");
  });
}

// Delete multiple stocks
export function deleteStocksBatch(stockIds) {
  if (!state.currentUser || !stockIds || stockIds.length === 0) return Promise.resolve();

  const batch = db.batch();
  const stocksCollection = db.collection("users")
                             .doc(state.currentUser.uid)
                             .collection("stocks");

  stockIds.forEach((id) => {
    batch.delete(stocksCollection.doc(id));
  });

  return batch.commit().then(() => {
    showToast(`Successfully deleted ${stockIds.length} stock(s)`);
  }).catch((err) => {
    console.error("Batch delete stocks error:", err);
    showToast("Failed to delete selected stocks");
    throw err;
  });
}

// Stocks observations service methods
export let stocksObsUnsubscribe = null;

export function loadStocksObservations() {
  if (!state.currentUser) return;

  const ref = db.collection("users")
                .doc(state.currentUser.uid)
                .collection("settings")
                .doc("stocks_observations");

  stocksObsUnsubscribe = ref.onSnapshot((doc) => {
    if (doc.exists) {
      state.stocksObservations = doc.data().bullets || [];
    } else {
      state.stocksObservations = [];
    }
    window.dispatchEvent(new CustomEvent('stocks-observations-updated'));
  }, (err) => {
    console.error("Stocks observations load error:", err);
  });
}

export function saveStocksObservations(bullets) {
  if (!state.currentUser) return Promise.resolve();

  const ref = db.collection("users")
                .doc(state.currentUser.uid)
                .collection("settings")
                .doc("stocks_observations");

  return ref.set({
    bullets: bullets,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).catch((err) => {
    console.error("Save stocks observations error:", err);
    showToast("Failed to save observations");
  });
}

// One-time cleanup for duplicates and normalizing sources
export function cleanDuplicatesAndSources() {
  if (!state.currentUser || !state.stocks || state.stocks.length === 0) return Promise.resolve();

  const stocks = state.stocks;
  const toDeleteIds = [];
  const toUpdate = [];
  
  // Track seen combinations of ticker + dateOfRun
  // Key: TICKER_DATEOFRUN
  const seen = new Map();

  stocks.forEach(stock => {
    const ticker = (stock.ticker || "").toUpperCase().trim();
    const dateOfRun = (stock.dateOfRun || "").trim();
    if (!ticker || !dateOfRun) return;
    
    const key = `${ticker}_${dateOfRun}`;
    
    // Normalize source name if it matches pattern
    let newSource = stock.source || "";
    const sourceUpper = newSource.toUpperCase();
    if (
      sourceUpper === "AFZAL_REPORT" ||
      sourceUpper.startsWith("CANVA") ||
      sourceUpper.startsWith("SECTRO") ||
      sourceUpper.startsWith("SECTOR")
    ) {
      newSource = "Afzal";
    }

    if (!seen.has(key)) {
      seen.set(key, { stock, newSource });
    } else {
      const existing = seen.get(key);
      const existingStock = existing.stock;
      
      // Determine which one is better to keep (notes/traded/analyzed are preferred)
      const existingScore = (existingStock.myNotes ? 2 : 0) + (existingStock.traded === 'Y' ? 1 : 0) + (existingStock.analyzed ? 1 : 0);
      const currentScore = (stock.myNotes ? 2 : 0) + (stock.traded === 'Y' ? 1 : 0) + (stock.analyzed ? 1 : 0);
      
      const isCompoundId = stock.id === key;
      const existingIsCompoundId = existingStock.id === key;
      
      let keepCurrent = false;
      if (currentScore > existingScore) {
        keepCurrent = true;
      } else if (currentScore === existingScore) {
        if (isCompoundId && !existingIsCompoundId) {
          keepCurrent = true;
        }
      }
      
      if (keepCurrent) {
        toDeleteIds.push(existingStock.id);
        seen.set(key, { stock, newSource });
      } else {
        toDeleteIds.push(stock.id);
      }
    }
  });

  seen.forEach((value) => {
    const { stock, newSource } = value;
    if (stock.source !== newSource) {
      toUpdate.push({
        id: stock.id,
        source: newSource
      });
    }
  });

  if (toDeleteIds.length === 0 && toUpdate.length === 0) {
    return Promise.resolve();
  }

  console.log(`[Clean-up] Deleting ${toDeleteIds.length} duplicate(s) and updating ${toUpdate.length} source(s)...`);

  const executeBatch = async () => {
    const BATCH_LIMIT = 400;
    
    // Batch deletes
    for (let i = 0; i < toDeleteIds.length; i += BATCH_LIMIT) {
      const chunk = toDeleteIds.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();
      const stocksCollection = db.collection("users").doc(state.currentUser.uid).collection("stocks");
      chunk.forEach(id => {
        batch.delete(stocksCollection.doc(id));
      });
      await batch.commit();
    }
    
    // Batch updates
    for (let i = 0; i < toUpdate.length; i += BATCH_LIMIT) {
      const chunk = toUpdate.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();
      const stocksCollection = db.collection("users").doc(state.currentUser.uid).collection("stocks");
      chunk.forEach(upd => {
        batch.update(stocksCollection.doc(upd.id), {
          source: upd.source,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
      await batch.commit();
    }
    
    showToast(`Deduplicated ${toDeleteIds.length} stock(s) and normalized ${toUpdate.length} source name(s).`, "success");
  };

  return executeBatch();
}


