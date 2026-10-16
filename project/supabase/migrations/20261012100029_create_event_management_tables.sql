/*
# Create smart college event management tables

1. New Tables
- `events` stores public college event listings, schedules, categories, venues, capacity, and publishing state.
- `registrations` stores attendee details and links each attendee to one event.
2. New Columns
- `events.id` unique event identifier.
- `events.title` event name shown to students.
- `events.description` event summary.
- `events.category` browsing category.
- `events.event_date` scheduled start date and time.
- `events.duration` human-readable duration.
- `events.venue` event location.
- `events.capacity` maximum registration count.
- `events.organizer` responsible department or group.
- `events.color` visual accent used by the dashboard.
- `events.is_published` controls public visibility.
- `events.created_at` creation timestamp.
- `registrations.id` unique registration identifier.
- `registrations.event_id` linked event.
- `registrations.attendee_name` attendee name.
- `registrations.attendee_email` attendee email.
- `registrations.department` attendee department.
- `registrations.ticket_code` unique QR-ready ticket code.
- `registrations.status` registration or attendance status.
- `registrations.created_at` registration timestamp.
3. Security
- Enable row level security on both tables.
- Allow anonymous and authenticated visitors to read published events.
- Allow anonymous and authenticated visitors to create registrations and view registration records for this single-tenant demo.
- Allow anonymous and authenticated visitors to update registration status for the organizer check-in workflow.
4. Important Notes
- This is intentionally a single-tenant public campus experience without sign-in.
- The unique event and ticket constraints prevent duplicate event identifiers and ticket codes.
*/

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  event_date timestamptz NOT NULL,
  duration text NOT NULL,
  venue text NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  organizer text NOT NULL,
  color text NOT NULL DEFAULT 'navy',
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  attendee_name text NOT NULL,
  attendee_email text NOT NULL,
  department text NOT NULL,
  ticket_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'checked_in', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read published events" ON public.events;
CREATE POLICY "Public can read published events" ON public.events FOR SELECT TO anon, authenticated USING (is_published = true);

DROP POLICY IF EXISTS "Public can create registrations" ON public.registrations;
CREATE POLICY "Public can create registrations" ON public.registrations FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read registrations" ON public.registrations;
CREATE POLICY "Public can read registrations" ON public.registrations FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can update registration status" ON public.registrations;
CREATE POLICY "Public can update registration status" ON public.registrations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (status IN ('registered', 'checked_in', 'cancelled'));

CREATE INDEX IF NOT EXISTS events_event_date_idx ON public.events(event_date);
CREATE INDEX IF NOT EXISTS events_category_idx ON public.events(category);
CREATE INDEX IF NOT EXISTS registrations_event_id_idx ON public.registrations(event_id);

INSERT INTO public.events (title, description, category, event_date, duration, venue, capacity, organizer, color)
SELECT * FROM (VALUES
  ('Designing with AI: A Campus Workshop', 'A practical, hands-on session exploring how students can use emerging AI tools to think, prototype, and present with more confidence.', 'Workshop', '2026-10-22 14:00:00+00'::timestamptz, '90 minutes', 'Innovation Lab · North Hall', 120, 'Centre for Digital Learning', 'coral'),
  ('Founders Unplugged', 'Meet three student founders for an open conversation about starting small, finding your first customer, and building something that lasts.', 'Talk', '2026-10-29 17:30:00+00'::timestamptz, '75 minutes', 'Auditorium B · Student Centre', 240, 'Entrepreneurship Cell', 'navy'),
  ('Inter-College Futsal League', 'Bring your team, your energy, and your best five-a-side game for the opening round of the campus futsal league.', 'Sports', '2026-11-03 16:00:00+00'::timestamptz, '3 hours', 'West Sports Complex', 180, 'Student Athletics Council', 'gold'),
  ('Open Mic: After Hours', 'An intimate evening of student music, poetry, comedy, and stories under the lights at the amphitheatre.', 'Culture', '2026-11-12 19:00:00+00'::timestamptz, '2 hours', 'Open Air Amphitheatre', 300, 'Arts & Culture Society', 'teal')
) AS seed(title, description, category, event_date, duration, venue, capacity, organizer, color)
WHERE NOT EXISTS (SELECT 1 FROM public.events);
