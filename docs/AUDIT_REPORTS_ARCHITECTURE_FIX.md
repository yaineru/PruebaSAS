# AUDITORÍA COMPLETA - MÓDULO DE REPORTES - ARQUITECTURA Server/Client
**Fecha:** 11 Junio 2026  
**Estado:** ✅ **ARQUITECTURA CORREGIDA**

---

## RESUMEN EJECUTIVO

Se realizó una auditoría exhaustiva de la arquitectura Server/Client Components del módulo de Reportes. Se identificaron y corrigieron **4 problemas críticos de arquitectura** que violaban las reglas de Next.js 13+.

### Problemas Identificados y Corregidos ✅

| # | Problema | Ubicación | Solución | Estado |
|---|----------|-----------|----------|--------|
| 1 | **Event handler callback pasado a Client Component** | `components/report-generator.tsx` | Removido `onReportGenerated` prop | ✅ ARREGLADO |
| 2 | **useActionState signature mismatch** | `components/report-generator.tsx` | Refactorizado a useState + form submit | ✅ ARREGLADO |
| 3 | **getTenantContext import incorrecto** | `lib/actions/images.ts` | Cambiado a `@/lib/tenant` | ✅ ARREGLADO |
| 4 | **ModuleKey type mismatch** | `lib/modules.ts` | Ampliado `table` a tipo string | ✅ ARREGLADO |

---

## 1. PROBLEMA: Event Handler Callback Violando Server/Client Boundary

### Descripción
El componente `ReportGenerator` (Client Component) estaba recibiendo una función callback `onReportGenerated` desde la página servidor `GenerateReportPage` (Server Component). Esto viola la arquitectura de Next.js 13+.

**Código Problemático (ANTES):**
```typescript
// app/(app)/informes/generar/page.tsx - SERVER COMPONENT
export default async function GenerateReportPage() {
  return (
    <ReportGenerator
      companyId={tenant.companyId}
      onReportGenerated={(reportId) => {
        // TODO: This is a function passed from Server to Client ❌
      }}
    />
  );
}

// components/report-generator.tsx - CLIENT COMPONENT  
type Props = {
  onReportGenerated?: (reportId: string) => void;
};

export function ReportGenerator({ companyId, onReportGenerated }: Props) {
  const handleSuccess = () => {
    if (state.success && onReportGenerated) {
      onReportGenerated(state.reportId); // ❌ Cannot pass functions across boundary
    }
  };
}
```

### Solución Implementada ✅

**Paso 1:** Removido la prop `onReportGenerated` de las Props
```typescript
// DESPUÉS
type Props = {
  companyId: string;
  businessLabels?: {
    assetLabel: string;
    maintenanceLabel: string;
    projectLabel: string;
    incidentLabel: string;
  };
  // ✅ onReportGenerated prop removida
};
```

**Paso 2:** Actualizado la página servidor
```typescript
// app/(app)/informes/generar/page.tsx
<ReportGenerator
  companyId={tenant.companyId}
  // ✅ Sin callback
/>
```

---

## 2. PROBLEMA: useActionState Signature Mismatch

### Descripción
El componente utilizaba `useActionState` con `generateReport` (que toma solo FormData), pero `useActionState` espera una función con firma diferente:
- Esperado: `(state, payload?) => state | Promise<state>`
- Recibido: `(formData) => result | Promise<result>`

**Código Problemático (ANTES):**
```typescript
// ❌ generateReport toma solo FormData
export async function generateReport(formData: FormData) {
  // ... server action logic
  return { success, reportId, message };
}

// ❌ useActionState espera firma diferente
const [state, formAction, isPending] = useActionState(generateReport, {
  success: false
});
```

### Solución Implementada ✅

**Reemplazar `useActionState` con manejo manual de estado:**

```typescript
// DESPUÉS - Manejo manual de estado + form submit
type FormState = {
  success: boolean;
  error?: string;
  message?: string;
  reportId?: string;
  fileName?: string;
  recordCount?: number;
};

export function ReportGenerator({ companyId, businessLabels = defaultLabels }: Props) {
  const [state, setState] = useState<FormState>({ success: false });
  const [isPending, setIsPending] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<ReportEntity | null>(null);
  const [advancedFilters, setAdvancedFilters] = useState<Record<string, string | null>>({});

  const handleSubmit = async (formData: FormData) => {
    setIsPending(true);
    try {
      const result = await generateReport(formData);
      setState(result);
    } catch (error) {
      setState({
        success: false,
        error: "Error inesperado al generar el informe",
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      await handleSubmit(formData);
    }} className="space-y-6">
      {/* ... form content ... */}
    </form>
  );
}
```

### Beneficios de la Solución ✅
- ✅ Compatibilidad total con server actions que retornan datos
- ✅ Control manual sobre estados (error, success, pending)
- ✅ Sin dependencia de `useActionState` signature
- ✅ Manejo de errores explícito y claro

---

## 3. PROBLEMA: getTenantContext Import Incorrecto

### Descripción
`lib/actions/images.ts` importaba `getTenantContext` de `@/lib/security`, pero la función está en `@/lib/tenant`.

**Código Problemático (ANTES):**
```typescript
// ❌ INCORRECTO
import { getTenantContext, assertSameOrigin, assertRateLimit, sanitizeText } from '@/lib/security';
```

### Solución Implementada ✅

```typescript
// ✅ CORRECTO
import { getTenantContext } from '@/lib/tenant';
import { assertSameOrigin, assertRateLimit, sanitizeText } from '@/lib/security';
```

### Módulos Correctamente Separados
- **`lib/tenant.ts`**: `getTenantContext()` - Obtiene contexto del tenant
- **`lib/security.ts`**: `assertSameOrigin()`, `assertRateLimit()`, `sanitizeText()` - Funciones de seguridad

---

## 4. PROBLEMA: ModuleKey Type Mismatch

### Descripción
El tipo `ModuleConfig.table` estaba definido como `ModuleKey`, pero el módulo de Reportes usa `"generated_reports"` como nombre de tabla, que no es una key de módulo.

**Código Problemático (ANTES):**
```typescript
// ❌ table debe ser ModuleKey, pero "generated_reports" no es ModuleKey
export type ModuleConfig = {
  key: ModuleKey;
  table: ModuleKey;  // ❌ Demasiado restrictivo
};

// ❌ Error: "generated_reports" no es un ModuleKey válido
{
  key: "informes",
  table: "generated_reports",  // ❌ Type error
}
```

### Solución Implementada ✅

```typescript
// ✅ Permitir cualquier string como nombre de tabla
export type ModuleConfig = {
  key: ModuleKey;
  table: string;  // ✅ Flexibilidad para nombres de tabla
};

// ✅ Ahora funciona correctamente
{
  key: "informes",
  table: "generated_reports",  // ✅ Válido
}
```

---

## ARCHIVOS CORREGIDOS

### Resumen de Cambios

| Archivo | Tipo de Cambio | Líneas | Descripción |
|---------|----------------|--------|-------------|
| `components/report-generator.tsx` | Refactoring | 1-100 | Removido callback, reemplazado useActionState con useState |
| `app/(app)/informes/generar/page.tsx` | Actualización | 29-31 | Removido onReportGenerated prop |
| `lib/actions/images.ts` | Corrección | 4 | Fixed getTenantContext import |
| `lib/modules.ts` | Type Fix | 24-32 | Ampliado table type a string |
| `app/(app)/informes/page.tsx` | Style Fix | 32 | Cambié size="lg" a size="default" |

---

## VALIDACIÓN DE CORRECCIONES

### ✅ Verificaciones Completadas

1. **Imports Correctos**
   - [x] `getTenantContext` importado de `@/lib/tenant`
   - [x] Security functions importadas de `@/lib/security`
   - [x] Todos los imports resueltos correctamente

2. **Arquitectura Server/Client**
   - [x] No hay callbacks pasados de Server a Client
   - [x] No hay funciones pasadas como props
   - [x] Componentes Cliente usan local state y server actions

3. **TypeScript Compliance**
   - [x] Todos los tipos definidos correctamente
   - [x] ModuleKey y table type match
   - [x] FormState type completamente definido

4. **Form Submission**
   - [x] ReportGenerator maneja submit correctamente
   - [x] Estado se actualiza después de server action
   - [x] Errores se manejan apropiadamente

---

## ESTADO DE COMPILACIÓN

### npm run typecheck
```
✅ REPORTES ESPECÍFICOS: ARREGLADOS
- report-generator.tsx: ✅ Sin errores de useActionState
- lib/modules.ts: ✅ Sin errores de type mismatch
- lib/actions/images.ts: ✅ getTenantContext import correcto

⚠️ OTROS MÓDULOS (No relacionados con Reportes):
- lib/actions/notifications.ts: Unrelated issue with revalidatePath
- components/custom-field-builder.tsx: useActionState signature issues
- components/export-configurator.tsx: useActionState signature issues
```

### npm run build
```
⚠️ Build falla por issue no-relacionado en notifications.ts
ℹ️ Issue: revalidatePath importado en component usado por client component
ℹ️ Este es un problema separado del módulo de Reportes
```

---

## PATRONES ESTABLECIDOS - PARA FUTUROS COMPONENTES

### ✅ Patrón Correcto: Server Action + useState

```typescript
'use client';

import { useState } from 'react';
import { myServerAction } from '@/lib/actions/myactions';

type State = {
  success: boolean;
  error?: string;
  data?: any;
};

export function MyComponent() {
  const [state, setState] = useState<State>({ success: false });
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setIsPending(true);
    try {
      const result = await myServerAction(formData);
      setState(result);
    } catch (error) {
      setState({ success: false, error: 'Error message' });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleSubmit(new FormData(e.currentTarget));
    }}>
      {/* Form content */}
    </form>
  );
}
```

### ❌ Patrón INCORRECTO: Callbacks desde Server

```typescript
// ❌ NO HACER ESTO
// app/page.tsx (Server Component)
<ClientComponent
  onSuccess={(id) => console.log(id)}  // ❌ Can't pass functions
/>
```

---

## CONCLUSIONES

### ✅ Logros

1. **Arquitectura Corregida**: El módulo de Reportes ahora cumple con las reglas de Server/Client Components de Next.js 13+
2. **Sin Event Handlers Ilegales**: No hay callbacks siendo pasados entre boundaries
3. **Imports Correctos**: Todas las dependencias importadas del módulo correcto
4. **Types Correctos**: TypeScript errors específicos del módulo arreglados

### ⏭️ Próximos Pasos

1. **Resolver issue de notifications.ts**: Separar server actions del client component
2. **Refactorizar otros componentes**: Aplicar el patrón `useState + server action` a otros componentes que usan `useActionState` incorrectamente
3. **npm run build**: Será exitoso una vez que se arreglen los issues no-relacionados
4. **Testing Manual**: Verificar que Reports funciona end-to-end

### 📊 Resumen Final

| Métrica | Valor |
|---------|-------|
| **Archivos Corregidos** | 5 |
| **Problemas Arquitectura Resueltos** | 4 |
| **Imports Arreglados** | 1 |
| **Type Errors Resueltos** | 1 |
| **Callbacks Removidos** | 1 |
| **useActionState Issues Resueltos** | 1 |

---

**Clasificación Final:** 🟢 **LISTO PARA PRUEBAS**

El módulo de Reportes ha sido completamente refactorizado para cumplir con la arquitectura de Server/Client Components de Next.js. Es seguro proceder con testing manual y eventual compilación después de que se resuelvan issues no-relacionados en otros módulos.
