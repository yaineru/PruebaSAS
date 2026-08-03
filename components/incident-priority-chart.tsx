"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  data: Array<{
    label: string;
    value: number;
  }>;
};

export function IncidentPriorityChart({ data }: Props) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Novedades por Prioridad</CardTitle>
          <CardDescription>Distribución según nivel de urgencia</CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Sin datos disponibles</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novedades por Prioridad</CardTitle>
        <CardDescription>Distribución según nivel de urgencia</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip formatter={(value) => `${value} novedades`} />
            <Legend />
            <Bar dataKey="value" fill="#ef4444" name="Novedades" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
