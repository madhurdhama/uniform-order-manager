/* ── FIREBASE: AUTH + FIRESTORE ──────────────────────────── */

import { initializeApp }                          from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
                                                   from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, deleteDoc,
         onSnapshot, enableIndexedDbPersistence, query, orderBy }
                                                   from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js';

/* ── CONFIG ──────────────────────────────────────────────── */

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyB2eHS3VsuecZddli8AvbRqICN5l1BvJjc',
  authDomain:        'uniform-order-manager.firebaseapp.com',
  projectId:         'uniform-order-manager',
  storageBucket:     'uniform-order-manager.firebasestorage.app',
  messagingSenderId: '849753872869',
  appId:             '1:849753872869:web:1ddade23095dcb7853770c'
};

const ALLOWED_EMAILS = [
  'madhurdhama@gmail.com',
];

/* ── INIT ────────────────────────────────────────────────── */

const app  = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

/* enable offline persistence */
enableIndexedDbPersistence(db).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('Offline persistence disabled: multiple tabs open');
  } else if (err.code === 'unimplemented') {
    console.warn('Offline persistence not supported in this browser');
  }
});

/* ── AUTH ────────────────────────────────────────────────── */

const provider = new GoogleAuthProvider();

export function signIn() {
  return signInWithPopup(auth, provider);
}

export function signOutUser() {
  return signOut(auth);
}

export function onAuthReady(callback) {
  onAuthStateChanged(auth, callback);
}

export function isAllowed(user) {
  return user && ALLOWED_EMAILS.includes(user.email);
}

/* ── FIRESTORE: ORDERS ───────────────────────────────────── */

const ordersCol = collection(db, 'orders');

/* write / overwrite a single order document */
export function saveOrderRemote(order) {
  const ref = doc(db, 'orders', String(order.id));
  return setDoc(ref, order);
}

/* delete a single order document */
export function deleteOrderRemote(orderId) {
  return deleteDoc(doc(db, 'orders', String(orderId)));
}

/* real-time listener — calls onUpdate(orders[]) whenever Firestore changes */
export function subscribeOrders(onUpdate) {
  const q = query(ordersCol, orderBy('id', 'desc'));
  return onSnapshot(q, snapshot => {
    const orders = snapshot.docs.map(d => d.data());
    onUpdate(orders);
  });
}

/* one-time bulk upload for localStorage migration */
export async function uploadLocalOrders(orders) {
  const writes = orders.map(o => setDoc(doc(db, 'orders', String(o.id)), o));
  return Promise.all(writes);
}
