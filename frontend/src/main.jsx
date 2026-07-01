import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { CalendarDays, Clock, MapPin, Ticket } from "lucide-react";
import "./styles.css";

function getApiUrl() {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "https://event-management-kcl1.vercel.app";
  const cleanUrl = backendUrl.replace(/\/$/, "");
  return cleanUrl.endsWith("/api") ? cleanUrl : `${cleanUrl}/api`;
}

const API_URL = getApiUrl();

function App() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadEvents() {
    setLoading(true);
    const response = await fetch(`${API_URL}/events`);
    const data = await response.json();
    setEvents(data);
    setSelectedEvent((current) => current || data[0] || null);
    setLoading(false);
  }

  useEffect(() => {
    loadEvents().catch(() => {
      setMessage("Unable to load events. Please start the backend server.");
      setLoading(false);
    });
  }, []);

  async function register(event) {
    event.preventDefault();
    setMessage("");

    const response = await fetch(`${API_URL}/events/${selectedEvent.id}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message || "Registration failed");
      return;
    }

    setForm({ name: "", email: "", phone: "" });
    setMessage("Registration successful. We saved your seat.");
    await loadEvents();
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Event Hub</p>
          <h1>Discover and register for upcoming events</h1>
          <p className="intro">
            Browse published events and reserve a place with a simple registration form.
          </p>
        </div>
      </section>

      <section className="content-grid">
        <div className="event-list">
          <div className="section-title">
            <h2>Upcoming Events</h2>
            <span>{events.length} live</span>
          </div>

          {loading ? <p className="muted">Loading events...</p> : null}
          {!loading && events.length === 0 ? <p className="muted">No events published yet.</p> : null}

          {events.map((event) => (
            <button
              className={`event-card ${selectedEvent?.id === event.id ? "active" : ""}`}
              key={event.id}
              onClick={() => {
                setSelectedEvent(event);
                setMessage("");
              }}
            >
              <span className="category">{event.category}</span>
              <strong>{event.title}</strong>
              <span className="meta"><CalendarDays size={16} />{event.date}</span>
              <span className="meta"><MapPin size={16} />{event.venue}</span>
            </button>
          ))}
        </div>

        <div className="registration-panel">
          {selectedEvent ? (
            <>
              <div className="event-details">
                <span className="category">{selectedEvent.category}</span>
                <h2>{selectedEvent.title}</h2>
                <p>{selectedEvent.description}</p>
                <div className="detail-row"><CalendarDays size={18} />{selectedEvent.date}</div>
                <div className="detail-row"><Clock size={18} />{selectedEvent.time}</div>
                <div className="detail-row"><MapPin size={18} />{selectedEvent.venue}</div>
                <div className="detail-row">
                  <Ticket size={18} />
                  {selectedEvent.capacity > 0
                    ? `${selectedEvent.registrationsCount}/${selectedEvent.capacity} registered`
                    : `${selectedEvent.registrationsCount} registered`}
                </div>
              </div>

              <form onSubmit={register} className="form-card">
                <h3>Register</h3>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" required />
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email address" required />
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" required />
                <button type="submit">Reserve Seat</button>
                {message ? <p className="notice">{message}</p> : null}
              </form>
            </>
          ) : (
            <p className="muted">Choose an event to register.</p>
          )}
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
