# FASE 3: Error Audit & Tracker

## 🔍 Step 1: Identify All Errors

Documenta cada error/bug encontrado durante el testing de FASE 2.

---

## 📋 Template para Reportar Errores

```
Bug #001
Title: [Breve descripción]
Module: [Database | Auth | API | UI | Performance]
Severity: [🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low]
Status: [New | In Progress | Fixed | Verified]
Environment: [Development | Staging | Production]

Description:
[Descripción detallada del error]

Steps to Reproduce:
1. ...
2. ...
3. ...

Expected Behavior:
[Qué debería pasar]

Actual Behavior:
[Qué realmente pasa]

Error Message:
```
[Si existe, copiar error exacto]
```

Root Cause:
[Análisis del por qué ocurre]

Fix:
[Cómo se va a solucionar]

Files to Modify:
- [ ] file1.ts
- [ ] file2.tsx

Testing Steps:
1. ...

Date Found: 
Date Fixed:
Date Verified:
```

---

## 🗂️ Error Categories

### 1. Database Errors

**Potential Issues:**
- [ ] Migration failures
- [ ] Constraint violations
- [ ] RLS policy issues
- [ ] Trigger errors
- [ ] Index performance
- [ ] N+1 query problems
- [ ] Connection timeouts

**How to Check:**
```sql
-- Check all tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' ORDER BY table_name;

-- Check triggers
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_schema = 'public';

-- Check indexes
SELECT * FROM pg_indexes 
WHERE schemaname = 'public' ORDER BY tablename;

-- Check slow queries
SELECT * FROM pg_stat_statements 
ORDER BY total_time DESC LIMIT 10;
```

---

### 2. Authentication Errors

**Potential Issues:**
- [ ] Login failures
- [ ] Registration failures
- [ ] Token expiration
- [ ] Session issues
- [ ] Password reset problems
- [ ] 2FA issues (if implemented)

**How to Test:**
```bash
# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'

# Test registration
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"new@test.com","password":"test123"}'
```

---

### 3. API / Server Action Errors

**Potential Issues:**
- [ ] Rate limiting not working
- [ ] Validation failing silently
- [ ] Error responses inconsistent
- [ ] Missing error handling
- [ ] Type mismatches
- [ ] Security checks failing

**How to Check:**
```typescript
// Check server action error handling
// Look for try-catch in all lib/actions/*.ts
grep -r "try {" lib/actions/
grep -r "catch" lib/actions/

// Check all server actions return proper error responses
grep -r "return {" lib/actions/
```

---

### 4. UI Component Errors

**Potential Issues:**
- [ ] Mobile responsiveness broken
- [ ] Form validation not showing
- [ ] Loading states missing
- [ ] Error messages unclear
- [ ] Accessibility issues
- [ ] CSS conflicts
- [ ] Build errors

**How to Test:**
```bash
# Build check
npm run build

# TypeScript check
npx tsc --noEmit

# Lint check
npm run lint

# Mobile: Open in DevTools, toggle device toolbar
```

---

### 5. Performance Issues

**Potential Issues:**
- [ ] Slow queries (> 1s)
- [ ] Large bundle size
- [ ] Memory leaks
- [ ] Image loading slow
- [ ] API responses slow
- [ ] Component re-renders excessive

**How to Measure:**
```bash
# Bundle analysis
npm run build
npm run analyze # if configured

# Next.js performance
npm run build # shows metrics at end

# Database performance
# Enable query logging in Supabase
```

---

## ✅ Known Issues to Check

Add any errors you've noticed:

```
[ ] Error 1:
    Description: 
    Severity: 
    Status: 

[ ] Error 2:
    Description: 
    Severity: 
    Status: 

[ ] Error 3:
    Description: 
    Severity: 
    Status: 
```

---

## 📊 Error Summary Table

| Bug # | Title | Module | Severity | Status | Priority |
|-------|-------|--------|----------|--------|----------|
|       |       |        |          |        |          |

---

## 🔧 Priority Matrix

### 🔴 CRITICAL (Fix Immediately)
- [ ] Application won't start
- [ ] Database migrations fail
- [ ] Authentication broken
- [ ] Data corruption risk
- [ ] Security vulnerability

### 🟠 HIGH (Fix This Week)
- [ ] Major feature broken
- [ ] Frequent user errors
- [ ] Performance degradation
- [ ] Data loss possible
- [ ] API returning errors

### 🟡 MEDIUM (Fix This Sprint)
- [ ] Feature partially broken
- [ ] Occasional errors
- [ ] Cosmetic issues
- [ ] Edge cases
- [ ] Documentation needed

### 🟢 LOW (Fix Later)
- [ ] Minor UI issues
- [ ] Nice-to-have improvements
- [ ] Future enhancements
- [ ] Code cleanup
- [ ] Refactoring opportunities

---

## 🚀 Testing Checklist

Run through each feature:

### FASE 2 Features to Test

**Industry Selection:**
- [ ] Can select industry during registration
- [ ] Custom labels display correctly
- [ ] Industry persists in database
- [ ] All 7 industries available

**Email Preferences:**
- [ ] Can enable/disable notifications
- [ ] Frequency dropdown works
- [ ] Changes save to database
- [ ] All 8 event types show
- [ ] Mobile responsive

**Webhooks (Admin):**
- [ ] Can create webhook
- [ ] Secret generates (crypto.randomUUID)
- [ ] Can copy secret
- [ ] Can delete webhook
- [ ] Admin-only access enforced
- [ ] Mobile responsive

**Analytics:**
- [ ] Dashboard loads
- [ ] KPI cards display
- [ ] Charts render (Recharts)
- [ ] Tabs switch correctly
- [ ] Mobile responsive

**CSV Export:**
- [ ] Can download CSV
- [ ] Opens correctly in Excel
- [ ] Special characters escaped
- [ ] UTF-8 encoding correct
- [ ] Large files work (100k+ rows)

**Advanced Filters:**
- [ ] Filters render per report type
- [ ] Can select filter values
- [ ] Filters apply to report
- [ ] Clear filters works
- [ ] Mobile responsive

**Bulk Operations:**
- [ ] Can select multiple records
- [ ] Select-all checkbox works
- [ ] Bulk update executes
- [ ] Audit log created
- [ ] Mobile accessible

**API Documentation:**
- [ ] Swagger UI loads
- [ ] Can expand endpoints
- [ ] Try-it-out works
- [ ] Spec downloads
- [ ] Mobile readable

---

## 📝 Bug Report Examples

### Example 1: Database Constraint

```
Bug #DB001
Title: industry_templates slug constraint failing on second run
Module: Database
Severity: 🔴 Critical
Status: Fixed

Description:
Migration 005 fails when run twice with "duplicate key" error on slug.

Root Cause:
Missing ON CONFLICT clause in INSERT statement.

Fix:
Added ON CONFLICT (slug) DO NOTHING to insert statement.

Files Modified:
- supabase/migrations/005_industry_templates.sql

Date Fixed: 2025-02-24
Date Verified: 2025-02-24
```

### Example 2: Missing Validation

```
Bug #API001
Title: updateEmailSubscription accepts invalid event types
Module: API
Severity: 🟠 High
Status: In Progress

Description:
Server action accepts any event_type string, should validate against enum.

Root Cause:
Zod schema missing enum validation on eventType field.

Fix:
Update updateEmailSubscriptionSchema to use z.enum([...EVENT_TYPES]).

Files to Modify:
- lib/notifications.ts
- lib/actions/notifications.ts

Date Found: 2025-02-24
```

---

## ✅ Sign-Off

When all critical issues fixed:
- [ ] Team review passed
- [ ] All tests passing
- [ ] Performance acceptable
- [ ] Ready for FASE 3 P1

---

**Next: Document all errors found and start fixing them one by one.**
