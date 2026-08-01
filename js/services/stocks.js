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
