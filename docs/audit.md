# Code Audit Report

**Date:** 2026-04-17
**Auditor:** Manus
**Scope:** Full codebase — backend, frontend, shared modules

---

## Summary

The codebase is generally well-structured with clear separation of concerns. The following improvements have been identified and applied.

## Findings & Fixes Applied

### 1. Security Hardening

| Finding | Severity | Fix Applied |
|---------|----------|-------------|
| SQL search parameter allows LIKE injection via `%` chars | Medium | Added `escapeLikePattern()` to sanitize search input |
| No rate limiting on source add mutation | Low | Documented for future implementation |
| CORS reflects any origin | Medium | Acceptable for dev; documented for production lockdown |
| JSON body limit set to 50mb | Low | Reduced to 1mb (sufficient for API payloads) |
| Error stack traces exposed in tRPC responses | Medium | Production should strip stacks (framework default) |

### 2. Naming Consistency

| Finding | Fix Applied |
|---------|-------------|
| Mixed use of `any` type across frontend | Added proper type annotations where possible |
| `formatTime` local function in map.tsx duplicates shared helpers | Replaced with shared `formatEventDate` + `formatEventTime` |
| Inconsistent import paths (some `@/shared/types`, some `@/shared/constants`) | Standardized to `@/shared/types` as the single entry point |

### 3. Constants Usage

| Finding | Fix Applied |
|---------|-------------|
| Magic number `60` for days lookahead in map.tsx | Replaced with `API_EVENT_LOOKAHEAD_DAYS` constant |
| Magic number `200` for calendar event limit | Replaced with named constant reference |
| Hardcoded `"#FFFFFF"` for white text | Acceptable (standard white), documented as intentional |

### 4. Best Practices

| Finding | Fix Applied |
|---------|-------------|
| `new Date()` called in render body (not memoized) | Memoized with `useMemo` in map.tsx |
| Missing `useCallback` for filter handlers | Acceptable for simple state setters |
| No error boundaries in frontend | Documented for future implementation |
| Scraper error messages truncated to 500 chars | Appropriate for DB storage |

---

## Security Checklist

- [x] All user input validated via Zod schemas before processing
- [x] URL validation enforces https/http protocol only
- [x] URL length capped at 2048 characters
- [x] Source name length capped at 255 characters
- [x] SQL queries use parameterized templates (Drizzle ORM)
- [x] LIKE search patterns sanitized against injection
- [x] Fetch requests have strict timeouts (15s)
- [x] HTML content truncated before processing (30k chars)
- [x] User-agent clearly identifies the scraper
- [x] Delete operations restricted to user-added sources only
- [x] API pagination enforced with max page size (500)
- [ ] Rate limiting (recommended for production)
- [ ] CORS origin whitelist (recommended for production)
- [ ] CSP headers (recommended for production)
