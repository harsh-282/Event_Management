import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { CalendarPlus, ClipboardList, Trash2 } from "lucide-react";
import "./styles.css";

function getApiUrl() {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const cleanUrl = backendUrl.replace(/\/$/, "");
  return cleanUrl.endsWith("/api") ? cleanUrl : `${cleanUrl}/api`;
}

const API_URL = getApiUrl();
const blankEvent = {
  title: "",
  category: "",
  date: "",
  time: "",
  venue: "",
  capacity: "",
  description: ""
};

function App() {
  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [form, setForm] = useState(blankEvent);
  const [selectedEventId, setSelectedEventId] = useState("all");
  const [message, setMessage] = useState("");

  async function loadData() {
    const [eventResponse, registrationResponse] = await Promise.all([
      fetch(`${API_URL}/events`),
      fetch(`${API_URL}/admin/registrations`)
    ]);

    setEvents(await eventResponse.json());
    setRegistrations(await registrationResponse.json());
  }

  useEffect(() => {
    loadData().catch(() => setMessage("Unable to connect to backend server."));
  }, []);

  const filteredRegistrations = useMemo(() => {
    if (selectedEventId === "all") return registrations;
    return registrations.filter((registration) => registration.eventId === selectedEventId);
  }, [registrations, selectedEventId]);

  async function createEvent(event) {
    event.preventDefault();
    setMessage("");

    const response = await fetch(`${API_URL}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message || "Event creation failed");
      return;
    }

    setForm(blankEvent);
    setMessage("Event published successfully.");
    await loadData();
  }

  async function archiveEvent(id) {
    await fetch(`${API_URL}/events/${id}`, { method: "DELETE" });
    if (selectedEventId === id) setSelectedEventId("all");
    await loadData();
  }

  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <h1>Event Admin</h1>
        <button className="nav-button active"><CalendarPlus size={18} />Create Event</button>
        <button className="nav-button"><ClipboardList size={18} />Registrations</button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Control Panel</p>
            <h2>Create events and track registrations</h2>
          </div>
          <div className="stats">
            <span>{events.length} Events</span>
            <span>{registrations.length} Registrations</span>
          </div>
        </header>

        <div className="grid">
          <form className="panel form-panel" onSubmit={createEvent}>
            <h3>New Event</h3>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Event title" required />
            <div className="two-col">
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category" />
              <input type="number" min="0" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="Capacity" />
            </div>
            <div className="two-col">
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required />
            </div>
            <input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="Venue" required />
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Event description" required />
            <button type="submit"><CalendarPlus size={18} />Publish Event</button>
            {message ? <p className="notice">{message}</p> : null}
          </form>

          <section className="panel">
            <div className="panel-heading">
              <h3>Published Events</h3>
            </div>
            <div className="event-table">
              {events.length === 0 ? <p className="muted">No events created yet.</p> : null}
              {events.map((event) => (
                <article key={event.id} className="event-row">
                  <div>
                    <strong>{event.title}</strong>
                    <span>{event.date} at {event.time} • {event.venue}</span>
                  </div>
                  <span>{event.registrationsCount}/{event.capacity || "Open"}</span>
                  <button title="Archive event" onClick={() => archiveEvent(event.id)}><Trash2 size={17} /></button>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="panel registrations">
          <div className="panel-heading">
            <h3>Registrations</h3>
            <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
              <option value="all">All events</option>
              {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
            </select>
          </div>

          <div className="registration-table">
            <div className="table-head">
              <span>Name</span>
              <span>Email</span>
              <span>Phone</span>
              <span>Event</span>
            </div>
            {filteredRegistrations.length === 0 ? <p className="muted">No registrations yet.</p> : null}
            {filteredRegistrations.map((registration) => (
              <div className="table-row" key={registration.id}>
                <span>{registration.name}</span>
                <span>{registration.email}</span>
                <span>{registration.phone}</span>
                <span>{registration.event?.title || "Archived event"}</span>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
