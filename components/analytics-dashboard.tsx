"use client";

import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AnalyticsDashboardData } from "@/lib/notifications";

type Props = {
  data: AnalyticsDashboardData;
};

export function AnalyticsDashboard({ data }: Props) {
  const totalReports = data.reportsGenerated.reduce((sum, m) => sum + m.metricValue, 0);
  const totalIncidents = data.incidentsCreated.reduce((sum, m) => sum + m.metricValue, 0);
  const activeUsersToday = data.activeUsers[0]?.metricValue || 0;
  const maintenanceCompleted = data.maintenanceCompleted.reduce((sum, m) => sum + m.metricValue, 0);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Informes Generados</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalReports}</p>
            <p className="text-xs text-muted-foreground mt-1">Todos los tiempos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Novedades Registradas</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalIncidents}</p>
            <p className="text-xs text-muted-foreground mt-1">Todas las novedades</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Usuarios Activos</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activeUsersToday}</p>
            <p className="text-xs text-muted-foreground mt-1">Cuentas activas actualmente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Mantenimientos Completados</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{maintenanceCompleted}</p>
            <p className="text-xs text-muted-foreground mt-1">Todos los tiempos</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="timeline">Cronología</TabsTrigger>
          <TabsTrigger value="features">Funcionalidades</TabsTrigger>
          <TabsTrigger value="engagement">Actividad</TabsTrigger>
        </TabsList>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informes Generados (Últimos 30 días)</CardTitle>
            </CardHeader>
            <CardContent>
              {data.reportsGenerated.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.reportsGenerated}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="metricDate" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="metricValue" stroke="#10b981" name="Informes" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sin datos disponibles</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Novedades & Mantenimientos</CardTitle>
            </CardHeader>
            <CardContent>
              {data.incidentsCreated.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.incidentsCreated}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="metricDate" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="metricValue" fill="#ef4444" name="Novedades" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sin datos disponibles</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Funcionalidades más usadas</CardTitle>
              <CardDescription>Basado en los últimos 30 días</CardDescription>
            </CardHeader>
            <CardContent>
              {data.topFeatures.length > 0 ? (
                <div className="space-y-4">
                  {data.topFeatures.map((feature) => (
                    <div key={feature.feature} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{feature.feature}</span>
                        <Badge>{feature.count}</Badge>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{
                            width: `${(feature.count / Math.max(...data.topFeatures.map((f) => f.count))) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sin datos disponibles</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Engagement Tab */}
        <TabsContent value="engagement" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Usuarios Únicos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{data.userEngagement.uniqueUsers}</p>
                <p className="text-xs text-muted-foreground mt-1">Últimos 30 días</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Total de Eventos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{data.userEngagement.totalEvents}</p>
                <p className="text-xs text-muted-foreground mt-1">Últimos 30 días</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Engagement Promedio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Eventos por usuario</span>
                  <span className="font-semibold">
                    {data.userEngagement.uniqueUsers > 0
                      ? (data.userEngagement.totalEvents / data.userEngagement.uniqueUsers).toFixed(1)
                      : 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Duración promedio de sesión</span>
                  <span className="font-semibold">
                    {data.userEngagement.averageSessionDuration.toFixed(0)}s
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
