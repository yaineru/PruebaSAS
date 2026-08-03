"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { registerAccount, type AuthActionState } from "@/lib/actions/auth";
import { IndustrySelector } from "@/components/industry-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {
  success: false
};

export function RegisterForm() {
  const router = useRouter();
  const [step, setStep] = useState<"industry" | "details">("industry");
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(registerAccount, initialState);

  // Campos controlados: React 19 reinicia los <form> con action= al terminar el
  // envío (incluso si falló), así que sin esto el usuario perdía todo lo escrito
  // cada vez que el registro fallaba (ej. correo rechazado, contraseña corta).
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!state.success) return;
    const message = encodeURIComponent(state.message ?? "Cuenta creada. Revisa tu correo.");
    router.push(`/login?message=${message}`);
  }, [router, state.message, state.success]);

  if (step === "industry") {
    return (
      <IndustrySelector
        onSelect={(industryId) => {
          setSelectedIndustry(industryId);
          setStep("details");
        }}
      />
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
      {state.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}

      <input type="hidden" name="industry_template_id" value={selectedIndustry ?? ""} />

      <div className="rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground">
        <p>
          Tu empresa será configurada para tu industria seleccionada. Podrás cambiar esto después.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="full_name">Nombre completo</Label>
        <Input
          id="full_name"
          name="full_name"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="company_name">Empresa</Label>
        <Input
          id="company_name"
          name="company_name"
          autoComplete="organization"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="signup_email">Correo</Label>
        <Input
          id="signup_email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="signup_password">Contraseña</Label>
        <Input
          id="signup_password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={() => setStep("industry")}>
          Atrás
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? "Creando cuenta..." : "Crear cuenta"}
        </Button>
      </div>
    </form>
  );
}
