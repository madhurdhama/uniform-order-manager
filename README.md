# Uniform Order Manager

[![Vercel](https://img.shields.io/badge/Vercel-Deployed-0070f3?style=for-the-badge&logo=vercel&logoColor=white)](https://uniform-order-manager.vercel.app/)
[![Firebase](https://img.shields.io/badge/firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=4A1B0C)](https://firebase.google.com/)

A mobile-first web app for managing school uniform orders.

**Live:** https://uniform-order-manager.vercel.app/

---

## Features

- Create and manage uniform orders with items, sizes, and combo sets
- Payment tracking with multiple entries and discount support
- Per-item delivery status tracking
- WhatsApp bill generation with UPI payment details
- Analytics dashboard by branch and time
- JSON backup / restore and CSV export
- Per-user UPI settings and QR image synced to account

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Vanilla HTML, CSS, JavaScript |
| Auth | Google Sign-In (allowlist-based) |
| Database | Firebase Firestore (real-time, offline-capable) |
| Hosting | Vercel |

---

## Access Control

Only authorised Google accounts can access data.  
Controlled via `ALLOWED_EMAILS` in `firebase.js` and Firestore Security Rules.
