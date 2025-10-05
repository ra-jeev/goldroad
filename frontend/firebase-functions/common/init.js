const { getApp, getApps, initializeApp } = require('firebase-admin/app');
const { initializeFirestore } = require('firebase-admin/firestore');

const app = !getApps().length ? initializeApp() : getApp();
const fireStore = initializeFirestore(app, { preferRest: true });

module.exports = { fireStore };
