# FASE 3: Estabilidad, Reportes & Custom Fields

## 🎯 Objetivo Principal
Convertir CafeLindo en una plataforma **estable, robusta y verdaderamente multi-industria** mediante custom fields.

---

## 📋 Prioridades FASE 3

### **P1: Estabilización (Week 1)**
- [ ] Auditoría completa de errores conocidos
- [ ] Identificar y corregir bugs críticos
- [ ] Validar todas las migraciones
- [ ] Pruebas exhaustivas de FASE 2

### **P2: Reportes PDF & Excel (Week 2-3)**
- [ ] Módulo PDF con diseño profesional
- [ ] Módulo Excel con formateo
- [ ] Reportes con filtros aplicados
- [ ] Reportes programados (email)

### **P3: Imágenes Before/After (Week 3-4)**
- [ ] Sistema de storage para imágenes
- [ ] Gallery UI component
- [ ] Comparator tool (before/after)
- [ ] Thumbnail generation

### **P4: Exportación Filtrada (Week 4)**
- [ ] Exportar con filtros aplicados
- [ ] Múltiples formatos (CSV, PDF, Excel)
- [ ] Batch export
- [ ] Schedule exports

### **P5: Custom Fields (Week 5-6)**
- [ ] UI builder para campos
- [ ] Field types (text, number, select, date, etc)
- [ ] Field validation
- [ ] Field permissions
- [ ] Data migration tools

### **P6: Testing & Polish (Week 6-7)**
- [ ] Tests unitarios
- [ ] Integration tests
- [ ] Load testing
- [ ] Performance optimization

---

## 🔍 Step 1: Audit de Errores

### Known Issues to Fix

**Database:**
- [ ] Verificar todas las constraints
- [ ] Validar índices en performance
- [ ] Revisar RLS policies
- [ ] Check trigger functions

**Authentication:**
- [ ] Errores en login (si existen)
- [ ] Errores en registration (si existen)
- [ ] Token refresh issues
- [ ] Session management

**API/Server Actions:**
- [ ] Error handling en todas acciones
- [ ] Rate limiting edge cases
- [ ] Input validation completeness
- [ ] Error messages clarity

**UI Components:**
- [ ] Mobile responsiveness issues
- [ ] Form validation edge cases
- [ ] Loading states
- [ ] Error displays

**Performance:**
- [ ] Slow queries (log slowest)
- [ ] Large dataset pagination
- [ ] Image loading optimization
- [ ] Bundle size analysis

---

## 📄 Step 2: Reportes PDF & Excel

### Architecture

```
lib/reports/
├── pdf-generator.ts       ← Generate PDFs (pdfkit o html2pdf)
├── excel-generator.ts     ← Generate Excel (ExcelJS)
├── report-templates.ts    ← Pre-designed templates
├── report-schema.ts       ← Type definitions
└── report-utils.ts        ← Helpers (formatting, filtering)

components/
├── report-preview.tsx     ← Preview before download
├── report-options.tsx     ← Format & template selection
└── report-schedule.tsx    ← Schedule for email

app/api/reports/
├── generate/route.ts      ← Generate report
├── schedule/route.ts      ← Schedule for email
└── templates/route.ts     ← List templates
```

### Features

**PDF Reports:**
- Professional header/footer
- Company logo
- Report metadata (generated date, filters applied)
- Page numbers
- Table of contents (if large)
- Charts inline
- Styled tables

**Excel Reports:**
- Multiple sheets (summary, data, charts)
- Formatted headers (bold, colors)
- Autofit columns
- Frozen headers
- Formulas (sum, average)
- Charts

**Report Templates:**
- Blank (default)
- Summary (overview + key metrics)
- Detailed (all data with full details)
- Executive (1-page summary)
- Comparison (before/after)

**Email Scheduling:**
- Daily/Weekly/Monthly schedules
- Recipient list
- Custom message
- Archive in system

---

## 🖼️ Step 3: Imágenes Before/After

### Architecture

```
lib/storage/
├── image-handler.ts       ← Upload/delete
├── image-compressor.ts    ← Compress & optimize
├── image-validator.ts     ← Validate format/size
└── thumbnail-generator.ts ← Generate thumbnails

components/
├── image-uploader.tsx     ← Drag-drop upload
├── image-gallery.tsx      ← Grid display
├── image-comparator.tsx   ← Before/After slider
└── image-viewer.tsx       ← Lightbox

database/
├── asset_images table     ← Store metadata
└── storage bucket         ← Store files
```

### Features

**Image Management:**
- Drag-drop upload
- Multiple file upload
- Format validation (JPG, PNG, WebP)
- Size limits (max 10MB)
- Auto-compression
- Thumbnail generation

**Image Gallery:**
- Grid layout
- Infinite scroll
- Filter by date
- Search by description
- Delete with confirm
- Download original

**Before/After Comparator:**
- Side-by-side slider
- Overlay comparison
- Zoom functionality
- Timestamp display

**Database Schema:**
```sql
create table asset_images (
  id uuid primary key,
  asset_id uuid references assets(id),
  company_id uuid references companies(id),
  image_url text not null,
  thumbnail_url text,
  image_type text, -- 'before' | 'after' | 'general'
  description text,
  taken_at timestamp,
  uploaded_by uuid references auth.users(id),
  storage_path text,
  file_size integer,
  mime_type text,
  created_at timestamp default now()
);
```

---

## 📥 Step 4: Exportación Filtrada

### Features

**Filtered Export:**
- Apply current filters
- Show preview of rows to export
- Select format (CSV, PDF, Excel)
- Select columns to include
- Custom column order
- Filename customization

**Batch Export:**
- Export multiple reports
- Combine into single file
- Bulk operations

**Scheduled Exports:**
- Daily/Weekly/Monthly
- Send to email
- Archive in storage
- Auto-cleanup old files

### Implementation

```typescript
// Example usage
export async function exportFiltered({
  reportType: 'ASSETS',
  filters: {
    status: 'ACTIVE',
    dateStart: '2025-01-01'
  },
  format: 'excel', // csv | pdf | excel
  columns: ['id', 'name', 'status', 'lastMaintenance'],
  schedule: null // or 'daily' | 'weekly'
}) {
  // Apply filters
  // Get data
  // Format based on type
  // Return download or schedule email
}
```

---

## 🔧 Step 5: Custom Fields

### The Game-Changer

Esto convierte CafeLindo en **verdaderamente multi-industria** sin cambiar código base.

### Architecture

```
lib/custom-fields/
├── field-types.ts         ← Define all field types
├── field-validator.ts     ← Validate field values
├── field-schema.ts        ← Zod schemas
└── field-utils.ts         ← Helper functions

components/
├── field-builder.tsx      ← UI to create/edit fields
├── field-renderer.tsx     ← Render any field type
├── field-input.tsx        ← Input for any field
└── field-config.tsx       ← Field settings UI

database/
├── custom_fields table    ← Field definitions
├── custom_field_values    ← Actual data
└── field_templates        ← Pre-made templates
```

### Field Types Supported

```
1. text              → Short text
2. textarea          → Long text
3. number            → Integer / Decimal
4. email             → Email validation
5. phone             → Phone number
6. url               → URL validation
7. date              → Date picker
8. time              → Time picker
9. datetime          → Date + Time
10. select           → Dropdown options
11. multi-select     → Multiple checkboxes
12. checkbox         → Boolean
13. radio            → Radio buttons
14. file             → File upload
15. currency         → Money with symbol
16. percentage       → % with symbol
17. color            → Color picker
18. location         → Lat/Long or address
19. rating           → Star rating
20. formula          → Calculated field
```

### Database Schema

```sql
create table custom_fields (
  id uuid primary key,
  company_id uuid references companies(id),
  industry_template_id uuid references industry_templates(id),
  module text not null, -- 'assets', 'maintenance', 'projects', etc
  field_name text not null,
  field_slug text not null,
  field_type text not null, -- from list above
  description text,
  is_required boolean default false,
  is_visible_in_list boolean default true,
  is_filterable boolean default true,
  display_order integer,
  validation_rules jsonb, -- min, max, pattern, etc
  field_options jsonb, -- for select/radio (options array)
  default_value text,
  help_text text,
  created_by uuid references auth.users(id),
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(company_id, module, field_slug)
);

create table custom_field_values (
  id uuid primary key,
  custom_field_id uuid references custom_fields(id),
  record_id uuid, -- points to asset/maintenance/project/etc
  company_id uuid references companies(id),
  field_value text, -- stored as text, parse based on field_type
  created_at timestamp default now(),
  updated_at timestamp default now()
);
```

### Example: Manufacturing Company

**Adds Custom Fields:**
- Serial Number (text, required, unique)
- Warranty Expiry (date)
- Supplier Contact (email)
- Cost (currency)
- Condition Rating (rating 1-5)
- Maintenance Hours (number)
- Certification Status (select: Active, Expired, Pending)

**Each field configured in UI:**
1. Go to Settings → Custom Fields
2. Click "Add Field"
3. Name: "Serial Number"
4. Type: "text"
5. Required: YES
6. Filterable: YES
7. Save

---

## 🧪 Step 6: Testing & Validation

### Unit Tests
- [ ] Custom field validators
- [ ] Report generators
- [ ] Image handlers
- [ ] Export utilities

### Integration Tests
- [ ] Create asset with custom fields
- [ ] Generate report with custom fields
- [ ] Upload images
- [ ] Export with filters

### E2E Tests
- [ ] Full workflow: Create → Edit → Export → View Images
- [ ] Custom field creation → View in asset
- [ ] Report generation → Download
- [ ] Schedule export → Receive email

### Load Tests
- [ ] 1000+ custom fields per company
- [ ] Export 100k rows
- [ ] Image gallery with 1000+ images
- [ ] Concurrent report generation

---

## 📊 Timeline Estimate

| Phase | Tasks | Timeline | Blockers |
|-------|-------|----------|----------|
| **P1: Stabilization** | Audit errors, fix bugs | 1 week | None |
| **P2: PDF/Excel Reports** | Design templates, generate reports | 2 weeks | Library selection |
| **P3: Images** | Upload, gallery, comparator | 1.5 weeks | Storage optimization |
| **P4: Filtered Export** | Apply filters, format data | 1 week | P2 (reports) |
| **P5: Custom Fields** | Builder UI, validation, schema | 2 weeks | Database design |
| **P6: Testing** | Unit, integration, E2E tests | 1.5 weeks | All above |
| **TOTAL** | | **~9 weeks** | Sequential |

---

## 🚀 Implementation Order

### Week 1: Stabilization
1. List all known errors
2. Create bug tracking spreadsheet
3. Fix critical bugs first
4. Test all FASE 2 features
5. Verify migrations work

### Weeks 2-3: PDF/Excel Reports
1. Choose library (pdfkit or puppeteer for PDF, ExcelJS for Excel)
2. Design report templates
3. Implement generators
4. Add preview UI
5. Test downloads

### Week 3-4: Images
1. Set up Supabase storage bucket
2. Create upload component
3. Build image gallery
4. Implement before/after comparator
5. Test image optimization

### Week 4: Filtered Export
1. Build on top of reports
2. Add filter preview
3. Implement batch export
4. Schedule feature

### Weeks 5-6: Custom Fields
1. Design UI builder
2. Implement field renderer
3. Create database schema
4. Build validation system
5. Add permissions layer

### Week 6-7: Testing
1. Write unit tests
2. Integration tests
3. Load testing
4. Performance tuning
5. Documentation

---

## 🎯 Success Metrics

| Metric | Target |
|--------|--------|
| System Uptime | 99.9% |
| Error Rate | < 0.5% |
| Page Load Time | < 2s |
| Report Gen Time | < 10s (for 10k rows) |
| Custom Fields Count | Support 50+ per module |
| Image Upload Speed | < 5s for 10MB |
| Export Time | < 30s for 100k rows |

---

## 📝 Dependencies & Prerequisites

**Before starting FASE 3:**
- [ ] All FASE 2 migrations applied successfully
- [ ] All FASE 2 features tested
- [ ] Known errors documented
- [ ] Performance baseline established
- [ ] Team aligned on custom fields design

---

## 🛠️ Technology Stack (Tentative)

**PDF Generation:**
- Option A: `pdfkit` (Node.js, lightweight)
- Option B: `puppeteer` (Chrome headless, complex designs)
- Option C: `html2pdf` (HTML to PDF)

**Excel Generation:**
- `ExcelJS` (most features, good for styling)
- Alternative: `xlsx` (simpler, lighter)

**Image Storage:**
- Supabase Storage (already configured)
- ImageKit (optional, for CDN)

**Image Optimization:**
- `sharp` (Node.js image processing)
- ImageMagick (system dependency)

**Custom Fields UI:**
- React Hook Form (validation)
- React Beautiful DND (drag-drop reordering)
- Headless UI (components)

---

## 💼 Go-Live Checklist

Before deploying each phase:

**Stabilization:**
- [ ] All critical bugs fixed
- [ ] All tests passing
- [ ] Zero error rate in production
- [ ] Performance baseline meets targets

**Reports:**
- [ ] PDF/Excel downloads working
- [ ] Templates complete
- [ ] Email scheduling works
- [ ] Large exports tested

**Images:**
- [ ] Upload/delete working
- [ ] Comparator functional
- [ ] Storage optimized
- [ ] Mobile upload works

**Filtered Export:**
- [ ] Filters apply correctly
- [ ] All formats supported
- [ ] Scheduling works
- [ ] Email delivery reliable

**Custom Fields:**
- [ ] Builder UI intuitive
- [ ] Validation working
- [ ] Reports include custom fields
- [ ] Filters work with custom fields

**Testing:**
- [ ] 90%+ code coverage
- [ ] Load tests passed
- [ ] E2E workflows verified
- [ ] Documentation complete

---

## ❓ Questions to Answer Before Starting

1. **Libraries:** Which PDF library prefer? (pdfkit vs puppeteer)
2. **Image Storage:** Keep in Supabase or use CDN?
3. **Custom Fields:** How many fields per module max?
4. **Reports:** Any specific templates needed?
5. **Timeline:** Can do 9 weeks or need faster?

---

**Next Step:** Run the audit to identify all errors before starting Phase 1.
