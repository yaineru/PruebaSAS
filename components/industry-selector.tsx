"use client";

import { useState } from "react";
import { getAllIndustries } from "@/lib/industries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  onSelect: (industryTemplateId: string) => void;
};

export function IndustrySelector({ onSelect }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const industries = getAllIndustries();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Selecciona tu industria</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Personalizaremos la plataforma con terminología específica para tu sector.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {industries.map((industry) => (
          <Card
            key={industry.slug}
            aria-disabled={!industry.isAvailable}
            className={`relative transition-all ${
              !industry.isAvailable
                ? "cursor-not-allowed opacity-60"
                : selected === industry.slug
                  ? "cursor-pointer border-primary ring-2 ring-primary"
                  : "cursor-pointer border-input hover:border-primary"
            }`}
            onClick={() => industry.isAvailable && setSelected(industry.slug)}
          >
            {!industry.isAvailable ? (
              <span className="absolute right-3 top-3 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Próximamente
              </span>
            ) : null}
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{industry.icon}</span>
                    <CardTitle className="text-base">{industry.name}</CardTitle>
                  </div>
                  <CardDescription className="mt-2 line-clamp-2">{industry.description}</CardDescription>
                </div>
                {industry.isAvailable ? (
                  <div
                    className="h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center"
                    style={{
                      borderColor: industry.suggestedColorPrimary,
                      backgroundColor: selected === industry.slug ? industry.suggestedColorPrimary : "transparent"
                    }}
                  >
                    {selected === industry.slug && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Equipos</p>
                  <p className="font-medium">{industry.assetLabel}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Mantenimiento</p>
                  <p className="font-medium">{industry.maintenanceLabel}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Los rubros marcados &ldquo;Próximamente&rdquo; todavía están en ajuste y no están disponibles para registrarse.
        Si tu negocio no encaja en ninguno, elige &ldquo;Otro tipo de negocio&rdquo;.
      </p>

      <Button
        className="w-full"
        size="lg"
        disabled={!selected}
        onClick={() => selected && onSelect(selected)}
      >
        Continuar con {selected ? industries.find((i) => i.slug === selected)?.name : "selección"}
      </Button>
    </div>
  );
}
