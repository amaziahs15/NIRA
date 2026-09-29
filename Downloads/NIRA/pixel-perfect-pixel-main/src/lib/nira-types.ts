export type NiraRole = "victim" | "professional" | "admin";
export type WorkspaceView =
  | "home"
  | "case"
  | "checkin"
  | "support"
  | "messages"
  | "profile"
  | "review"
  | "aggregate"
  | "chat"
  // admin views
  | "admin_overview"
  | "admin_cases"
  | "admin_professionals"
  | "admin_alerts"
  | "admin_analytics"
  | "admin_reports"
  | "admin_audit"
  | "admin_settings"
  | "admin_profile";

