import { z } from "zod";

// ============ EMAIL SUBSCRIPTIONS ============

export type EmailFrequency = "IMMEDIATE" | "DAILY_DIGEST" | "WEEKLY_DIGEST";

export type EmailEventType =
  | "REPORT_GENERATED"
  | "MAINTENANCE_DUE"
  | "INCIDENT_CREATED"
  | "DOCUMENT_EXPIRING"
  | "MAINTENANCE_COMPLETED"
  | "INCIDENT_RESOLVED"
  | "PROJECT_MILESTONE"
  | "USER_INVITED";

export type EmailSubscription = {
  id: string;
  companyId: string;
  userId: string;
  eventType: EmailEventType;
  enabled: boolean;
  frequency: EmailFrequency;
  lastSentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmailLog = {
  id: string;
  companyId: string;
  userId: string;
  eventType: EmailEventType;
  subject: string;
  recipientEmail: string;
  status: "PENDING" | "SENT" | "FAILED" | "BOUNCED";
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
};

export const updateEmailSubscriptionSchema = z.object({
  eventType: z.enum([
    "REPORT_GENERATED",
    "MAINTENANCE_DUE",
    "INCIDENT_CREATED",
    "DOCUMENT_EXPIRING",
    "MAINTENANCE_COMPLETED",
    "INCIDENT_RESOLVED",
    "PROJECT_MILESTONE",
    "USER_INVITED"
  ]),
  enabled: z.boolean(),
  frequency: z.enum(["IMMEDIATE", "DAILY_DIGEST", "WEEKLY_DIGEST"])
});

// ============ WEBHOOKS ============

export type WebhookEventType = EmailEventType;

export type Webhook = {
  id: string;
  companyId: string;
  createdBy: string;
  name: string;
  description: string | null;
  url: string;
  secret: string;
  events: WebhookEventType[];
  active: boolean;
  retryCount: number;
  timeoutSeconds: number;
  createdAt: string;
  updatedAt: string;
};

export type WebhookDelivery = {
  id: string;
  webhookId: string;
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
  status: "PENDING" | "SUCCESS" | "FAILED";
  responseStatusCode: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  attemptCount: number;
  nextRetryAt: string | null;
  lastAttemptedAt: string | null;
  createdAt: string;
};

export const createWebhookSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  url: z.string().url(),
  events: z.array(z.string()).min(1).max(20),
  retryCount: z.number().int().min(0).max(10).default(3),
  timeoutSeconds: z.number().int().min(5).max(60).default(30)
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

// ============ ANALYTICS ============

export type AnalyticsEventName =
  | "PAGE_VIEW"
  | "BUTTON_CLICK"
  | "FORM_SUBMIT"
  | "REPORT_GENERATED"
  | "REPORT_EXPORTED"
  | "INCIDENT_CREATED"
  | "MAINTENANCE_COMPLETED"
  | "USER_LOGIN"
  | "USER_LOGOUT"
  | "SETTINGS_CHANGED";

export type AnalyticsEvent = {
  id: string;
  companyId: string;
  userId: string | null;
  eventName: AnalyticsEventName;
  eventCategory: string | null;
  properties: Record<string, unknown> | null;
  pageUrl: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
};

export type AnalyticsMetric = {
  id: string;
  companyId: string;
  metricName: string;
  metricDate: string;
  metricValue: number;
  createdAt: string;
};

export type AnalyticsDashboardData = {
  reportsGenerated: AnalyticsMetric[];
  incidentsCreated: AnalyticsMetric[];
  activeUsers: AnalyticsMetric[];
  maintenanceCompleted: AnalyticsMetric[];
  topFeatures: Array<{ feature: string; count: number }>;
  userEngagement: {
    totalEvents: number;
    uniqueUsers: number;
    averageSessionDuration: number;
  };
};

export const trackEventSchema = z.object({
  eventName: z.string(),
  eventCategory: z.string().optional(),
  properties: z.record(z.unknown()).optional(),
  pageUrl: z.string().url().optional()
});

export type TrackEventInput = z.infer<typeof trackEventSchema>;
