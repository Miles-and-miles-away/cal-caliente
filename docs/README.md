# Salsa & Bachata Japan — Documentation

**Version:** 1.0.0
**Region:** Japan (expandable)
**Last Updated:** 2026-04-17

---

## Overview

Salsa & Bachata Japan is a mobile calendar application designed to aggregate and display Latin dance events across Japan. The app automatically discovers events from Facebook pages, Instagram accounts, dance school websites, and RSS/iCal feeds, then presents them in a unified calendar interface with powerful filtering and location-based search capabilities.

The application is built with **Expo SDK 54** and **React Native**, using a **Node.js/Express** backend with a **MySQL** database. It follows an adapter-based scraping architecture that runs on an hourly schedule, ensuring event data stays fresh without manual intervention.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Calendar View** | Monthly grid with color-coded event dots per dance style |
| **Discover** | Full-text search across events, venues, and organizers with multi-filter support |
| **Map View** | Location-based event listing grouped by city with Google Maps directions |
| **Preferences** | Persistent user settings for city, distance, dance style, and notifications |
| **Event Sources** | User-registerable websites and social media pages for automatic scraping |
| **Auto-Discovery** | Hourly background scraper checks all active sources for new events |
| **Event Detail** | Rich event page with venue info, directions, pricing, and source links |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native 0.81, Expo SDK 54, TypeScript 5.9, NativeWind 4 |
| Navigation | Expo Router 6 (file-based routing) |
| State | React Query (TanStack Query) for server state, AsyncStorage for local |
| Backend | Node.js, Express 4, tRPC for type-safe API |
| Database | MySQL (TiDB) via Drizzle ORM |
| Scraping | Adapter pattern with HTML, Facebook, Instagram, and RSS adapters |
| Styling | NativeWind (Tailwind CSS for React Native) |

---

## Quick Start

The app runs with two concurrent processes:

1. **Metro Bundler** (port 8081) — serves the React Native app
2. **API Server** (port 3000) — serves the tRPC backend, runs the scraper scheduler

On first startup, the server automatically seeds the database with 10 default event sources and 12 demo events across major Japanese cities.

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | System architecture, data flow, and component diagram |
| [Routing](./routing.md) | All screens, navigation structure, and deep links |
| [Screens](./screens.md) | Detailed page-by-page documentation |
| [API Reference](./api.md) | Backend API endpoints, input schemas, and responses |
| [Security](./security.md) | Security practices, input validation, and hardening |
| [Scraping Engine](./scraping.md) | Event scraping architecture, adapters, and scheduler |
| [Deployment](./deployment.md) | Deployment, configuration, and environment variables |
| [Audit Report](./audit.md) | Code audit findings and fixes applied |

---

## Maintenance Note

> Documentation must be updated after each phase or feature is completed. When adding new screens, API routes, or scraper adapters, update the corresponding documentation file to keep this reference accurate.
