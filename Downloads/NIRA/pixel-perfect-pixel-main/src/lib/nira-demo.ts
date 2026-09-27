export type DemoStage = {
  title: string;
  eyebrow: string;
  description: string;
  score?: number;
  trend?: string;
  note?: string;
  quality?: string;
};

export const demoStages: DemoStage[] = [
  { title: "A steady beginning", eyebrow: "Day 01 · First check-in", description: "A quiet first signal — enough to begin holding the thread.", score: 34, trend: "Stable", quality: "Good" },
  { title: "A change worth noticing", eyebrow: "Day 08 · Check-in", description: "The pattern is moving, so the support team takes a closer look.", score: 51, trend: "Increasing", quality: "Good" },
  { title: "A fuller picture", eyebrow: "Day 15 · Check-in", description: "A message adds context to the signals already present.", score: 73, trend: "Rapidly increasing", note: "I am scared because they threatened me again.", quality: "Voice excluded · SNR 11dB" },
  { title: "Human review begins", eyebrow: "Day 16 · Priority review", description: "The story is brought to a person, never treated as an automatic conclusion.", score: 82, trend: "Priority review", quality: "Human review" },
  { title: "Support makes space", eyebrow: "Day 23 · After support", description: "A support response is recorded alongside the next check-ins.", score: 68, trend: "Improving", quality: "Good" },
  { title: "A gentler direction", eyebrow: "Day 31 · Current", description: "The latest pattern is moving toward more steadiness.", score: 49, trend: "Improving", quality: "Good" },
];

export const demoTrend = [34, 51, 73, 82, 68, 57, 49];
export const demoTimeline = [
  { type: "case", title: "Case registered", detail: "A support space was created with consent.", date: "01 Sep" },
  { type: "wellbeing", title: "First check-in", detail: "Feeling steady enough to begin.", date: "01 Sep" },
  { type: "wellbeing", title: "A message shared", detail: "Context was added to the latest check-in.", date: "15 Sep" },
  { type: "case", title: "Human review", detail: "A professional reviewed the full picture.", date: "16 Sep" },
  { type: "support", title: "Counselling review", detail: "Support was offered and accepted.", date: "18 Sep" },
];

export const reviewQueue = [
  { caseNumber: "NIRA-1024", initials: "AM", detail: "Message shared today", trend: "Priority review", severity: "priority", summary: "Context added after a difficult check-in." },
  { caseNumber: "NIRA-1018", initials: "MK", detail: "Two missed check-ins", trend: "Needs attention", severity: "attention", summary: "The support worker is checking in gently." },
  { caseNumber: "NIRA-1031", initials: "RS", detail: "New signal this week", trend: "Improving", severity: "improving", summary: "A calmer pattern is appearing after support." },
  { caseNumber: "NIRA-1007", initials: "SJ", detail: "New space", trend: "Uncertain", severity: "uncertain", summary: "Not enough history to describe a direction yet." },
];

export const contributionBars = [
  { label: "Sentiment", value: 72, tone: "bg-brand" },
  { label: "Emotion", value: 58, tone: "bg-attention" },
  { label: "Behaviour", value: 42, tone: "bg-sage" },
  { label: "Case context", value: 78, tone: "bg-improving" },
];

export const aggregateData = {
  activeCases: 48,
  priorityAlerts: 2,
  openAlerts: 5,
  improving: 19,
  stages: [
    { label: "Registered", value: 11 },
    { label: "Investigation", value: 14 },
    { label: "Review", value: 8 },
    { label: "Support", value: 10 },
    { label: "Follow-up", value: 5 },
  ],
  severity: [
    { label: "Routine", value: 30, tone: "bg-stable" },
    { label: "Attention", value: 13, tone: "bg-attention" },
    { label: "Priority", value: 5, tone: "bg-priority" },
  ],
  districts: [
    { label: "Chennai", value: 16 },
    { label: "Coimbatore", value: 12 },
    { label: "Madurai", value: 9 },
    { label: "Salem", value: 7 },
    { label: "Tiruchirappalli", value: 4 },
  ],
};
