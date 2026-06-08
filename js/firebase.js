
import { initializeApp }                          from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
                                                   from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, deleteDoc, getDoc,
         onSnapshot, enableIndexedDbPersistence, query, orderBy }
                                                   from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js';


const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyB2eHS3VsuecZddli8AvbRqICN5l1BvJjc',
  authDomain:        'uniform-order-manager.firebaseapp.com',
  projectId:         'uniform-order-manager',
  storageBucket:     'uniform-order-manager.firebasestorage.app',
  messagingSenderId: '849753872869',
  appId:             '1:849753872869:web:1ddade23095dcb7853770c'
};

/* Allowlist — must also match Firestore Security Rules */
const ALLOWED_EMAILS = [
  'madhurdhama@gmail.com',
  'bd2232748@gmail.com'
];


const app  = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

/* Enable offline cache; silently degrades in multi-tab or unsupported browsers */
enableIndexedDbPersistence(db).catch(err => {
  if (err.code === 'failed-precondition') console.warn('Offline persistence disabled: multiple tabs open');
  else if (err.code === 'unimplemented')  console.warn('Offline persistence not supported in this browser');
});


const provider = new GoogleAuthProvider();

export function signIn()                { return signInWithPopup(auth, provider); }
export function signOutUser()           { return signOut(auth); }
export function onAuthReady(callback)   { onAuthStateChanged(auth, callback); }
export function isAllowed(user)         { return user && ALLOWED_EMAILS.includes(user.email); }


const ordersCol = collection(db, 'orders');

/* Upsert an order document using order.id as the document key */
export function saveOrderRemote(order) {
  return setDoc(doc(db, 'orders', String(order.id)), order);
}

export function deleteOrderRemote(orderId) {
  return deleteDoc(doc(db, 'orders', String(orderId)));
}

/* Real-time listener: calls onUpdate with all orders sorted newest-first */
export function subscribeOrders(onUpdate) {
  const q = query(ordersCol, orderBy('id', 'desc'));
  return onSnapshot(q, snapshot => {
    onUpdate(snapshot.docs.map(d => d.data()));
  });
}


/* Settings stored per-user under /users/{email} (UPI ID, UPI number, QR dataURL) */
export async function loadUserSettings(email) {
  const snap = await getDoc(doc(db, 'users', email));
  return snap.exists() ? snap.data() : null;
}

export async function saveUserSettings(email, settings) {
  return setDoc(doc(db, 'users', email), settings);
}
