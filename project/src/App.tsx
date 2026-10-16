import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  LayoutDashboard,
  MapPin,
  Menu,
  LogOut,
  PartyPopper,
  LockKeyhole,
  Mail,
  QrCode,
  Search,
  Sun,
  Moon,
  Sparkles,
  Ticket,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Event = {
  id: string;
  title: string;
  description: string;
  category: string;
  event_date: string;
  duration: string;
  venue: string;
  capacity: number;
  organizer: string;
  color: string;
  registrations_count?: number;
};

type Registration = {
  id: string;
  event_id: string;
  attendee_name: string;
  attendee_email: string;
  department: string;
  ticket_code: string;
  status: 'registered' | 'checked_in' | 'cancelled';
  created_at: string;
};

type View = 'overview' | 'events' | 'tickets' | 'checkin';

const fallbackEvents: Event[] = [
  {
    id: 'design-ai',
    title: 'Designing with AI: A Campus Workshop',
    description: 'A practical, hands-on session exploring how students can use emerging AI tools to think, prototype, and present with more confidence.',
    category: 'Workshop',
    event_date: '2026-10-22T14:00:00+00:00',
    duration: '90 minutes',
    venue: 'Innovation Lab · North Hall',
    capacity: 120,
    organizer: 'Centre for Digital Learning',
    color: 'coral',
  },
  {
    id: 'founders',
    title: 'Founders Unplugged',
    description: 'Meet three student founders for an open conversation about starting small, finding your first customer, and building something that lasts.',
    category: 'Talk',
    event_date: '2026-10-29T17:30:00+00:00',
    duration: '75 minutes',
    venue: 'Auditorium B · Student Centre',
    capacity: 240,
    organizer: 'Entrepreneurship Cell',
    color: 'navy',
  },
  {
    id: 'futsal',
    title: 'Inter-College Futsal League',
    description: 'Bring your team, your energy, and your best five-a-side game for the opening round of the campus futsal league.',
    category: 'Sports',
    event_date: '2026-11-03T16:00:00+00:00',
    duration: '3 hours',
    venue: 'West Sports Complex',
    capacity: 180,
    organizer: 'Student Athletics Council',
    color: 'gold',
  },
  {
    id: 'open-mic',
    title: 'Open Mic: After Hours',
    description: 'An intimate evening of student music, poetry, comedy, and stories under the lights at the amphitheatre.',
    category: 'Culture',
    event_date: '2026-11-12T19:00:00+00:00',
    duration: '2 hours',
    venue: 'Open Air Amphitheatre',
    capacity: 300,
    organizer: 'Arts & Culture Society',
    color: 'teal',
  },
];

const formatDate = (date: string, includeTime = false) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}) }).format(new Date(date));

const eventDay = (date: string) => new Intl.DateTimeFormat('en-US', { day: '2-digit' }).format(new Date(date));
const eventMonth = (date: string) => new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(date)).toUpperCase();

function App() {
  const [view, setView] = useState<View>('overview');
  const [events, setEvents] = useState<Event[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All events');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setAuthReady(true); });
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: eventData, error: eventError }, { data: registrationData }] = await Promise.all([
      supabase.from('events').select('*').eq('is_published', true).order('event_date'),
      supabase.from('registrations').select('*').order('created_at', { ascending: false }),
    ]);

    const allRegistrations = registrationData ?? [];
    setEvents(eventError || !eventData?.length ? fallbackEvents.map((event) => ({ ...event, registrations_count: allRegistrations.filter((registration) => registration.event_id === event.id && registration.status !== 'cancelled').length })) : eventData.map((event) => ({ ...event, registrations_count: allRegistrations.filter((registration) => registration.event_id === event.id && registration.status !== 'cancelled').length })));
    setRegistrations(allRegistrations);
    setLoading(false);
  };

  useEffect(() => {
    if (!authReady || !session) return;
    void loadData();
    const liveChannel = supabase
      .channel('campuspulse-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => { void loadData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, () => { void loadData(); })
      .subscribe();
    return () => { void supabase.removeChannel(liveChannel); };
  }, [authReady, session]);

  const categories = useMemo(() => ['All events', ...new Set(events.map((event) => event.category))], [events]);
  const filteredEvents = useMemo(() => events.filter((event) => {
    const matchesCategory = category === 'All events' || event.category === category;
    const query = search.toLowerCase();
    return matchesCategory && (!query || `${event.title} ${event.venue} ${event.organizer}`.toLowerCase().includes(query));
  }), [category, events, search]);
  const myRegistrations = useMemo(() => registrations.filter((registration) => registration.attendee_email?.toLowerCase() === session?.user?.email?.toLowerCase()), [registrations, session]);
  const registeredIds = useMemo(() => new Set(myRegistrations.filter((registration) => registration.status !== 'cancelled').map((registration) => registration.event_id)), [myRegistrations]);
  const attendedCount = myRegistrations.filter((registration) => registration.status === 'checked_in').length;

  const showView = (nextView: View) => {
    setView(nextView);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 3500);
  };

  const handleRegister = async (event: Event, form: { name: string; email: string; department: string }) => {
    const alreadyRegistered = registrations.some((item) => item.event_id === event.id && item.attendee_email?.toLowerCase() === form.email.toLowerCase() && item.status !== 'cancelled');
    if (alreadyRegistered) { notify('You already have a ticket for this event.'); setIsRegistering(false); setSelectedEvent(null); return; }
    const confirmedCount = registrations.filter((item) => item.event_id === event.id && item.status !== 'cancelled').length;
    if (confirmedCount >= event.capacity) { notify('Sorry, this event is sold out.'); return; }
    const ticketCode = `SCEM-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    const { data, error } = await supabase.from('registrations').insert({
      event_id: event.id,
      attendee_name: form.name,
      attendee_email: form.email,
      department: form.department,
      ticket_code: ticketCode,
    }).select().maybeSingle();

    if (error) {
      notify('We could not complete that registration. Please try again.');
      return;
    }

    if (data) { setRegistrations((current) => [data as Registration, ...current]); setEvents((current) => current.map((item) => item.id === event.id ? { ...item, registrations_count: (item.registrations_count ?? 0) + 1 } : item)); }
    setIsRegistering(false);
    setSelectedEvent(null);
    showView('tickets');
    notify('You are registered. Your digital ticket is ready.');
  };

  const markCheckedIn = async (registration: Registration) => {
    const { error } = await supabase.from('registrations').update({ status: 'checked_in' }).eq('id', registration.id);
    if (error) {
      notify('This ticket could not be updated.');
      return;
    }
    setRegistrations((current) => current.map((item) => item.id === registration.id ? { ...item, status: 'checked_in' } : item));
    notify(`${registration.attendee_name} has been checked in.`);
  };

  if (!authReady) return <div className="auth-loading"><div className="party-loader"><PartyPopper size={30} /></div><p>Getting the party started…</p></div>;
  if (!session) return <AuthScreen onSuccess={(text) => notify(text)} />;

  return (
    <div className={`app-shell party-app ${darkMode ? "theme-dark" : ""}`}>
      <header className="topbar">
        <button className="brand" onClick={() => showView('overview')} aria-label="Go to overview">
          <span className="brand-mark"><CalendarDays size={20} strokeWidth={2.4} /></span>
          <span>campus<span>pulse</span></span>
        </button>
        <button className="mobile-menu" onClick={() => setMobileMenu((open) => !open)} aria-label="Toggle menu"><Menu size={21} /></button>
        <nav className={`main-nav ${mobileMenu ? 'is-open' : ''}`}>
          <NavButton icon={<LayoutDashboard size={16} />} label="Overview" active={view === 'overview'} onClick={() => showView('overview')} />
          <NavButton icon={<CalendarDays size={16} />} label="Browse events" active={view === 'events'} onClick={() => showView('events')} />
          <NavButton icon={<Ticket size={16} />} label={`My tickets${registrations.length ? ` (${registrations.length})` : ''}`} active={view === 'tickets'} onClick={() => showView('tickets')} />
          <NavButton icon={<QrCode size={16} />} label="Check-in desk" active={view === 'checkin'} onClick={() => showView('checkin')} />
        </nav>
        <div className="topbar-actions"><button className="theme-toggle" onClick={() => setDarkMode((current) => !current)} aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"} title={darkMode ? "Light mode" : "Dark mode"}>{darkMode ? <Sun size={17} /> : <Moon size={17} />}</button><div className="topbar-user"><span className="online-dot" /> {session.user.email?.split("@")[0] || "Campus guest"} <span className="avatar">{(session.user.email?.[0] || "C").toUpperCase()}</span><button className="logout-button" onClick={async () => { await supabase.auth.signOut(); notify("You have signed out."); }} aria-label="Sign out" title="Sign out"><LogOut size={15} /></button></div></div>
      </header>

      <main>
        {view === 'overview' && <Overview events={events} registeredIds={registeredIds} loading={loading} onBrowse={() => showView('events')} onSelect={setSelectedEvent} />}
        {view === 'events' && <EventsView events={filteredEvents} categories={categories} category={category} setCategory={setCategory} search={search} setSearch={setSearch} registeredIds={registeredIds} onSelect={setSelectedEvent} />}
        {view === 'tickets' && <TicketsView registrations={myRegistrations} events={events} onBrowse={() => showView('events')} />}
        {view === 'checkin' && <CheckInView registrations={registrations} events={events} onCheckIn={markCheckedIn} attendedCount={attendedCount} />}
      </main>

      <footer className="footer"><span><CalendarDays size={15} /> campuspulse</span><span>Making every campus moment count.</span><span>© 2026 Student Life Office</span></footer>

      {selectedEvent && !isRegistering && <EventDialog event={selectedEvent} registered={registeredIds.has(selectedEvent.id)} onClose={() => setSelectedEvent(null)} onRegister={() => setIsRegistering(true)} />}
      {selectedEvent && isRegistering && <RegistrationDialog event={selectedEvent} user={session.user} onClose={() => { setSelectedEvent(null); setIsRegistering(false); }} onSubmit={handleRegister} />}
      {message && <div className="toast"><CheckCircle2 size={18} /> {message}</div>}
    </div>
  );
}

function AuthScreen({ onSuccess }: { onSuccess: (text: string) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
        if (authError) throw authError;
        // Require an explicit login after registration, even when Supabase email confirmation is disabled.
        if (data.session) await supabase.auth.signOut();
        setMode('login');
        setPassword('');
        setError(data.session
          ? 'Account created successfully! Please log in with your new credentials to continue.'
          : 'Account created! Check your email to confirm your account, then log in.');
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        onSuccess('Welcome back! Your campus plans are waiting.');
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  };

  return <div className="auth-page"><div className="auth-confetti confetti-one">✦</div><div className="auth-confetti confetti-two">✹</div><div className="auth-confetti confetti-three">✦</div>
    <div className="auth-showcase"><div className="auth-brand"><span className="brand-mark"><CalendarDays size={20}/></span> campus<span>pulse</span></div><div className="party-pill"><PartyPopper size={15}/> YOUR CAMPUS. YOUR PEOPLE. YOUR MOMENT.</div><h1>Make some<br/><em>noise.</em></h1><p>From unforgettable fests to late-night open mics — your next favorite campus memory starts here.</p><div className="auth-perks"><span>✦ Discover events</span><span>✦ Grab your spot</span><span>✦ Scan in & celebrate</span></div><div className="auth-orbit orbit-a">🎉</div><div className="auth-orbit orbit-b">🎟️</div><div className="auth-orbit orbit-c">✨</div></div>
    <div className="auth-form-wrap"><div className="auth-form-card"><div className="auth-mini-icon"><PartyPopper size={22}/></div><p className="auth-kicker">YOUR FRONT-ROW PASS</p><h2>{mode === 'signup' ? 'Join the party' : 'Welcome back!'}</h2><p className="auth-subtitle">{mode === 'signup' ? 'Create your free account and find your people.' : 'Sign in to pick up where the fun left off.'}</p>
      <div className="auth-tabs"><button className={mode === 'signup' ? 'selected' : ''} onClick={() => {setMode('signup');setError('');}}>Create account</button><button className={mode === 'login' ? 'selected' : ''} onClick={() => {setMode('login');setError('');}}>Log in</button></div>
      <form onSubmit={submit}>{mode === 'signup' && <label>Your name<input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ramesh Kumar" autoComplete="name" required/></label>}<label>Email address<span className="auth-input"><Mail size={16}/><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@college.edu" autoComplete="email" required/></span></label><label>Password<span className="auth-input"><LockKeyhole size={16}/><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'} minLength={6} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required/></span></label>{error && <div className="auth-message" role="status">{error}</div>}<button className="button button-primary auth-submit" disabled={busy}>{busy ? 'One moment…' : mode === 'signup' ? 'Create my account' : 'Log in to CampusPulse'} <ArrowRight size={17}/></button></form>
      <p className="auth-terms">By continuing, you agree to keep campus events welcoming, safe, and fun for everyone.</p></div><div className="auth-footnote">MADE FOR THE MOMENTS YOU'LL REMEMBER <span>✦</span></div></div></div>;
}

function NavButton({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>{icon}{label}</button>;
}

function Overview({ events, registeredIds, loading, onBrowse, onSelect }: { events: Event[]; registeredIds: Set<string>; loading: boolean; onBrowse: () => void; onSelect: (event: Event) => void }) {
  return <>
    <section className="hero-section">
      <div className="hero-copy">
        <p className="eyebrow"><Sparkles size={14} /> YOUR CAMPUS, IN ONE PLACE</p>
        <h1>Smart College<br /><em>Events.</em></h1>
        <p className="hero-text">Discover events, meet your people, and make the most of campus life. Your next story starts here.</p>
        <div className="hero-actions"><button className="button button-primary" onClick={onBrowse}>Explore events <ArrowRight size={16} /></button><span className="hero-note"><span className="pulse-dot" /> Live campus energy · new moments every week</span></div>
      </div>
      <div className="hero-art">
        <div className="art-sun" />
        <div className="art-card art-card-back"><span>09</span><small>NOV</small></div>
        <div className="art-card art-card-main"><span className="art-label">DON'T MISS</span><strong>Make room<br />for wonder.</strong><div className="art-line" /><small>STUDENT LIFE / 2026</small></div>
        <div className="art-scribble">↗</div>
        <div className="art-caption">Curated for<br /><strong>curious minds.</strong></div>
      </div>
    </section>
    <section className="content-wrap">
      <div className="section-heading"><div><p className="eyebrow muted">THE SHORTLIST</p><h2>Happening soon</h2></div><button className="text-button" onClick={onBrowse}>View all events <ChevronRight size={16} /></button></div>
      <div className="event-grid featured-grid">{loading ? <LoadingCards /> : events.slice(0, 3).map((event, index) => <EventCard key={event.id} event={event} featured={index === 0} registered={registeredIds.has(event.id)} onSelect={onSelect} />)}</div>
      <div className="stats-strip"><div><strong>{events.length * 2 + 14}</strong><span>events this month</span></div><div><strong>08</strong><span>active societies</span></div><div><strong>94%</strong><span>student satisfaction</span></div><div className="stats-quote">“The best part of college<br />is what happens between classes.”</div></div>
      <section className="split-feature"><div className="split-visual"><div className="visual-circle"><Users size={34} /></div><span className="visual-number">01</span><p>Show up.<br /><strong>Stand out.</strong></p></div><div className="split-copy"><p className="eyebrow">WHY CAMPUSPULSE</p><h2>Less searching.<br /><em>More doing.</em></h2><p>One calm, considered space for every talk, tournament, workshop, and late-night idea worth showing up for.</p><button className="button button-dark" onClick={onBrowse}>Find your people <ArrowRight size={16} /></button></div></section>
    </section>
  </>;
}

function EventsView({ events, categories, category, setCategory, search, setSearch, registeredIds, onSelect }: { events: Event[]; categories: string[]; category: string; setCategory: (value: string) => void; search: string; setSearch: (value: string) => void; registeredIds: Set<string>; onSelect: (event: Event) => void }) {
  return <section className="content-wrap page-view"><div className="page-intro"><div><p className="eyebrow">THE FULL CALENDAR</p><h1>All the good stuff.</h1><p>From big ideas to small gatherings, find a reason to step out of your routine.</p></div><div className="page-badge"><CalendarDays size={18} /><strong>{events.length}</strong><span>events found</span></div></div><div className="filters"><div className="search-box"><Search size={17} /><input placeholder="Search events, venues, societies" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="category-pills">{categories.map((item) => <button key={item} className={category === item ? 'selected' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div></div><div className="event-grid all-events-grid">{events.length ? events.map((event) => <EventCard key={event.id} event={event} registered={registeredIds.has(event.id)} onSelect={onSelect} />) : <EmptyState />}</div></section>;
}

function TicketsView({ registrations, events, onBrowse }: { registrations: Registration[]; events: Event[]; onBrowse: () => void }) {
  return <section className="content-wrap page-view"><div className="page-intro"><div><p className="eyebrow">YOUR PASSPORT</p><h1>My tickets.</h1><p>Everything you are signed up for, ready when you are.</p></div><div className="ticket-count"><Ticket size={19} /><strong>{String(registrations.length).padStart(2, '0')}</strong><span>saved tickets</span></div></div>{registrations.length ? <div className="ticket-list">{registrations.map((registration) => { const event = events.find((item) => item.id === registration.event_id); return event ? <TicketCard key={registration.id} registration={registration} event={event} /> : null; })}</div> : <EmptyState title="Your next memory is waiting." text="Browse the calendar and reserve your spot at something you will talk about later." action="Explore events" onClick={onBrowse} />}</section>;
}

function CheckInView({ registrations, events, onCheckIn, attendedCount }: { registrations: Registration[]; events: Event[]; onCheckIn: (registration: Registration) => void; attendedCount: number }) {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<Registration | null>(null);
  const [searched, setSearched] = useState(false);
  const lookup = () => { setResult(registrations.find((item) => item.ticket_code.toLowerCase() === code.trim().toLowerCase()) ?? null); setSearched(true); };
  return <section className="content-wrap page-view"><div className="page-intro"><div><p className="eyebrow">ORGANIZER TOOLS</p><h1>Check-in desk.</h1><p>Verify a ticket and welcome people in, one good moment at a time.</p></div><div className="checkin-stat"><strong>{attendedCount}</strong><span>checked in today</span></div></div><div className="checkin-layout"><div className="scanner-panel"><div className="scanner-icon"><QrCode size={48} strokeWidth={1.4} /></div><p className="eyebrow">MANUAL VERIFICATION</p><h2>Scan a ticket</h2><p>Enter the short code from a student's digital ticket to verify their registration.</p><div className="code-entry"><input placeholder="e.g. SCEM-4K7P2A" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} onKeyDown={(event) => event.key === 'Enter' && lookup()} /><button className="button button-primary" onClick={lookup}>Verify</button></div>{searched && <div className={`verification ${result ? result.status === 'checked_in' ? 'already' : 'valid' : 'invalid'}`}>{result ? <>{result.status === 'checked_in' ? <CheckCircle2 size={20} /> : <Check size={20} />}<div><strong>{result.status === 'checked_in' ? 'Already checked in' : 'Valid ticket'}</strong><span>{result.attendee_name} · {events.find((event) => event.id === result.event_id)?.title ?? 'Campus event'}</span></div>{result.status === 'registered' && <button onClick={() => onCheckIn(result)}>Check in</button>}</> : <><X size={20} /><div><strong>Ticket not found</strong><span>Check the code and try again.</span></div></>}</div>}</div><div className="attendance-panel"><div className="panel-heading"><div><p className="eyebrow muted">LIVE LOG</p><h3>Recent arrivals</h3></div><span>{registrations.length} total</span></div>{registrations.slice(0, 5).map((registration) => <div className="arrival" key={registration.id}><span className={`arrival-status ${registration.status}`} /> <div><strong>{registration.attendee_name}</strong><span>{registration.ticket_code}</span></div><small>{registration.status === 'checked_in' ? 'Checked in' : 'Awaiting arrival'}</small></div>)}{!registrations.length && <p className="empty-mini">No registrations yet.</p>}</div></div></section>;
}

function eventImage(event: Event) {
  const category = `${event.category} ${event.title}`.toLowerCase();
  if (/sport|futsal|game|athlet/.test(category)) return 'https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=1000&q=85';
  if (/culture|music|open mic|fest|dance|party/.test(category)) return 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1000&q=85';
  if (/talk|founder|business|startup/.test(category)) return 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1000&q=85';
  return 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=85';
}

function EventCard({ event, featured = false, registered, onSelect }: { event: Event; featured?: boolean; registered: boolean; onSelect: (event: Event) => void }) {
  return <article className={`event-card ${featured ? 'featured' : ''} accent-${event.color}`} onClick={() => onSelect(event)}><div className={`event-cover cover-${event.color}`}><img src={eventImage(event)} alt="" loading="lazy" /><span className="cover-badge">{event.category}</span><span className="cover-sparkle"><Sparkles size={17} /></span></div><div className="event-date"><strong>{eventDay(event.event_date)}</strong><span>{eventMonth(event.event_date)}</span></div><div className="event-card-body"><div className="event-card-top"><span className="tag">{event.category}</span>{registered && <span className="registered-tag"><Check size={12} /> Going</span>}</div><h3>{event.title}</h3><p>{event.description}</p><div className="event-meta"><span><Clock3 size={14} /> {formatDate(event.event_date, true)}</span><span><MapPin size={14} /> {event.venue.split(' · ')[0]}</span></div><div className="seat-meter"><div><span>Seats filling fast</span><strong>{Math.max(0, event.capacity - Number(event.registrations_count ?? 0))} left</strong></div><span className="seat-track"><i style={{ width: `${Math.min(100, Math.max(8, Number(event.registrations_count ?? 0) / Math.max(1, event.capacity) * 100))}%` }} /></span></div></div><button className="card-arrow" aria-label={`View ${event.title}`}><ArrowRight size={18} /></button></article>;
}

function TicketCard({ registration, event }: { registration: Registration; event: Event }) {
  const copyCode = async () => { await navigator.clipboard?.writeText(registration.ticket_code); };
  return <article className={`ticket-card accent-${event.color}`}><div className="ticket-main"><div className="ticket-date"><span>{eventMonth(event.event_date)}</span><strong>{eventDay(event.event_date)}</strong></div><div><span className="tag">{event.category}</span><h2>{event.title}</h2><p><CalendarDays size={14} /> {formatDate(event.event_date, true)} &nbsp; · &nbsp; <MapPin size={14} /> {event.venue}</p></div></div><div className="ticket-divider" /><div className="ticket-code"><div><span>YOUR TICKET CODE</span><strong>{registration.ticket_code}</strong><button onClick={copyCode}><Copy size={13} /> Copy</button></div><div className="qr-ticket"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(registration.ticket_code)}`} alt={`QR ticket for ${event.title}`} loading="lazy" /><a href={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=12&data=${encodeURIComponent(registration.ticket_code)}`} target="_blank" rel="noreferrer" download={`campuspulse-${registration.ticket_code}.png`}><Download size={12} /> QR</a></div></div><div className="ticket-footer"><span><CheckCircle2 size={15} /> {registration.status === 'checked_in' ? 'Checked in' : 'Registration confirmed'} · {registration.attendee_name}</span><button onClick={() => window.print()}><Download size={14} /> Save ticket</button></div></article>;
}

function EventDialog({ event, registered, onClose, onRegister }: { event: Event; registered: boolean; onClose: () => void; onRegister: () => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className={`event-dialog accent-${event.color}`} onMouseDown={(eventClick) => eventClick.stopPropagation()}><div className="dialog-cover"><img src={eventImage(event)} alt="" /></div><button className="close-button" onClick={onClose}><X size={18} /></button><div className="dialog-date"><span>{eventMonth(event.event_date)}</span><strong>{eventDay(event.event_date)}</strong></div><span className="tag">{event.category}</span><h2>{event.title}</h2><p className="dialog-description">{event.description}</p><div className="dialog-details"><span><Clock3 size={16} /> {formatDate(event.event_date, true)} · {event.duration}</span><span><MapPin size={16} /> {event.venue}</span><span><Users size={16} /> Hosted by {event.organizer}</span></div><div className="dialog-action">{registered ? <div className="confirmed"><CheckCircle2 size={19} /> You are already going</div> : <button className="button button-primary" onClick={onRegister}>Reserve my spot <ArrowRight size={16} /></button>}<small>{event.capacity} spots available</small></div></div></div>;
}

function RegistrationDialog({ event, user, onClose, onSubmit }: { event: Event; user: { email?: string; user_metadata?: { full_name?: string } }; onClose: () => void; onSubmit: (event: Event, form: { name: string; email: string; department: string }) => Promise<void> }) {
  const [form, setForm] = useState({ name: user.user_metadata?.full_name ?? '', email: user.email ?? '', department: '' });
  const [saving, setSaving] = useState(false);
  const submit = async (formEvent: FormEvent) => { formEvent.preventDefault(); setSaving(true); await onSubmit(event, form); setSaving(false); };
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="register-dialog" onMouseDown={(eventClick) => eventClick.stopPropagation()}><button className="close-button" onClick={onClose}><X size={18} /></button><p className="eyebrow">RESERVE YOUR SPOT</p><h2>Going to<br /><em>{event.title}</em></h2><p className="register-subtitle">Your account details are prefilled. Add your department and confirm to generate a unique QR ticket.</p><div className="registration-summary"><span><CalendarDays size={15}/>{formatDate(event.event_date, true)}</span><span><MapPin size={15}/>{event.venue}</span></div><form onSubmit={submit}><label>Full name<input required placeholder="Your name" value={form.name} onChange={(eventChange) => setForm({ ...form, name: eventChange.target.value })} /></label><label>Account email<input required type="email" value={form.email} readOnly /></label><label>Department<input required placeholder="e.g. Computer Science" value={form.department} onChange={(eventChange) => setForm({ ...form, department: eventChange.target.value })} /></label><button className="button button-primary full-button" disabled={saving}>{saving ? 'Saving your spot...' : 'Confirm & generate QR ticket'} {!saving && <ArrowRight size={16} />}</button></form></div></div>;
}

function EmptyState({ title = 'Nothing here yet.', text = 'Try a different filter or check back soon.', action, onClick }: { title?: string; text?: string; action?: string; onClick?: () => void }) { return <div className="empty-state"><div className="empty-icon"><CalendarDays size={22} /></div><h3>{title}</h3><p>{text}</p>{action && onClick && <button className="button button-dark" onClick={onClick}>{action} <ArrowRight size={15} /></button>}</div>; }
function LoadingCards() { return <>{[1, 2, 3].map((item) => <div className="skeleton-card" key={item}><div /><div /><div /><span /></div>)}</>; }

export default App;
