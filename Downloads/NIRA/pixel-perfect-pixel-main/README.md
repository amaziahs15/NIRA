# Pixel Perfect Pixel

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4679081e-d4a2-4e0d-abae-0d95f7007bb1).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Creating the first admin

Admin role cannot be selected at public sign-up for security. To promote a user to the Admin role, run the following SQL in your Supabase SQL editor:

```sql
delete from public.user_roles where user_id = (select id from auth.users where email = 'EMAIL');
insert into public.user_roles (user_id, role) select id, 'admin' from auth.users where email = 'EMAIL';
```

## Scheduling Missed Check-in Detection

### Method A: pg_cron (Recommended within Supabase)
1. In the Supabase Dashboard, go to **Database** → **Extensions**.
2. Search for `pg_cron` and toggle it **ON**.
3. In the SQL Editor, schedule the job to run every day at 02:00 AM UTC:
```sql
select cron.schedule(
  'nira-daily-missed-checkins',
  '0 2 * * *',
  'select public.flag_missed_checkins(3);'
);
```

### Method B: Scheduled Edge Function
Invoke the `flag-missed-checkins` edge function via HTTP POST (e.g. from GitHub Actions, Cloudflare Cron, or cron-job.org):
```sh
curl -X POST "https://riyclxotjxaklmmilzpy.supabase.co/functions/v1/flag-missed-checkins" \
  -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"threshold_days": 3}'
```

---

## Role-Based Test Checklist

### 1. Victim Role Test Checklist
- [ ] **Sign-up & Onboarding**: Register at `/sign-up` with "I need support". Confirm redirection to `/victim`.
- [ ] **Daily Check-in**:
  - [ ] Submit a check-in with mood label, supportive text, and audio recording.
  - [ ] Confirm file path is stored in `checkins.voice_url` in the private bucket.
- [ ] **Empathetic AI Companion**:
  - [ ] Submit a check-in and verify instant empathetic acknowledgment.
  - [ ] Open AI Companion chat tab and test multilingual conversation (English, Tamil, Hindi).
  - [ ] Verify crisis keyword triggers gentle helpline recommendation.
- [ ] **Professional Messaging**:
  - [ ] Navigate to the "Messages" tab.
  - [ ] See placeholder if no caseworker assigned, or live message thread once assigned.
  - [ ] Send message to caseworker; verify delivery and timestamps.
- [ ] **Appointments**:
  - [ ] Receive proposed appointment card; click "Accept" or "Ask to reschedule".
- [ ] **Privacy & Consent**:
  - [ ] Go to Profile → Privacy & Consent.
  - [ ] Toggle off "Share voice recordings" and save.
  - [ ] Verify caseworker view displays "Voice hidden by consent".
- [ ] **Emergency SOS**:
  - [ ] Trigger the emergency SOS button.
  - [ ] Confirm alert banner appears for assigned caseworker and admin.

### 2. Professional / Caseworker Role Test Checklist
- [ ] **Sign-up**: Register at `/sign-up` with "I provide support". Confirm landing on `/professional`.
- [ ] **Review Queue**:
  - [ ] Under "Unassigned" tab, locate new victim cases.
  - [ ] Click "Claim case" — confirm case moves to "My cases" and writes a `case_event`.
  - [ ] Confirm queue sorting: priority alerts first, then attention, then check-in recency.
- [ ] **Emergency SOS Banner**:
  - [ ] View red pinned banner with request code and elapsed time.
  - [ ] Click "Acknowledge" and "Mark handled" buttons.
- [ ] **Case Review**:
  - [ ] Open claimed case review.
  - [ ] Listen to voice check-in via 60-min signed URL audio player.
  - [ ] Verify score trajectory chart and signal decomposition breakdown.
  - [ ] Acknowledge and resolve alerts.
- [ ] **Caseworker Inbox**:
  - [ ] Open "Inbox" tab; review active conversations with unread counter badges.
  - [ ] Reply using custom text or quick response templates.
- [ ] **Case Updates & Stage**:
  - [ ] Post structured case update (Status update, Appointment scheduled, Referral made, Follow-up, Resolved).
  - [ ] Set next case stage and toggle "Visible to participant".
  - [ ] Set follow-up date.
- [ ] **Overdue Follow-ups**:
  - [ ] Verify overdue follow-ups alert appears on dashboard for cases needing scheduled check.
- [ ] **Referral Directory**:
  - [ ] Open "Referral directory" panel.
  - [ ] Filter by district (Chennai, Coimbatore, Madurai) and category.
  - [ ] Click "Send to participant" to transmit resource details directly via chat.

### 3. Administrator Role Test Checklist
- [ ] **Promotion**: Promote user via SQL in Supabase SQL editor.
- [ ] **Dashboard Metrics**:
  - [ ] Verify counts for Active cases, Unassigned, Priority alerts, Open alerts, Improving, Missed check-ins, Open SOS, and 7-day check-ins.
  - [ ] Verify metrics match database exactly (no static mock fallbacks).
- [ ] **Case Management**:
  - [ ] Filter cases by stage and district.
  - [ ] Reassign individual case to another caseworker.
  - [ ] Select multiple cases with checkboxes and execute **Bulk Assign**.
  - [ ] Click **Auto-assign all unassigned** to balance cases across caseworkers.
- [ ] **Caseworker Roster & Invitation**:
  - [ ] Review caseworker active caseload table.
  - [ ] Click "Invite Professional", input email/name, and dispatch invite.
- [ ] **Governance Reports**:
  - [ ] Filter timeframe (7d / 30d / 90d / all).
  - [ ] Download aggregate statistics as CSV.
  - [ ] Click "Print / Save PDF" to produce print-ready document.
- [ ] **Platform Settings**:
  - [ ] Modify escalation timeout, missed-check-in days, and crisis keywords.
  - [ ] Enable Announcement Banner and test visibility for all users.
  - [ ] Save settings and verify changes persisted in `system_settings`.
- [ ] **Audit Trail**:
  - [ ] Filter audit log by actor role, action, and timestamp.
