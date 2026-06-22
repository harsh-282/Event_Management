import express from "express";
import cors from "cors";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataFile = path.join(__dirname, "..", "data", "db.json");
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

async function readDb() {
  const content = await fs.readFile(dataFile, "utf8");
  return JSON.parse(content);
}

async function writeDb(data) {
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2));
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function requireFields(body, fields) {
  const missing = fields.filter((field) => !String(body[field] ?? "").trim());
  return missing.length ? `${missing.join(", ")} required` : null;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "event-management-backend" });
});

app.get("/api/events", async (_req, res) => {
  const db = await readDb();
  const events = db.events
    .filter((event) => event.status !== "archived")
    .map((event) => ({
      ...event,
      registrationsCount: db.registrations.filter((item) => item.eventId === event.id).length
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  res.json(events);
});

app.post("/api/events", async (req, res) => {
  const error = requireFields(req.body, ["title", "date", "time", "venue", "description"]);
  if (error) {
    return res.status(400).json({ message: error });
  }

  const db = await readDb();
  const event = {
    id: makeId("evt"),
    title: req.body.title.trim(),
    date: req.body.date,
    time: req.body.time,
    venue: req.body.venue.trim(),
    capacity: Number(req.body.capacity || 0),
    category: req.body.category?.trim() || "General",
    description: req.body.description.trim(),
    status: "published",
    createdAt: new Date().toISOString()
  };

  db.events.push(event);
  await writeDb(db);
  res.status(201).json(event);
});

app.put("/api/events/:id", async (req, res) => {
  const db = await readDb();
  const index = db.events.findIndex((event) => event.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ message: "Event not found" });
  }

  db.events[index] = {
    ...db.events[index],
    title: req.body.title?.trim() || db.events[index].title,
    date: req.body.date || db.events[index].date,
    time: req.body.time || db.events[index].time,
    venue: req.body.venue?.trim() || db.events[index].venue,
    capacity: Number(req.body.capacity ?? db.events[index].capacity),
    category: req.body.category?.trim() || db.events[index].category,
    description: req.body.description?.trim() || db.events[index].description
  };

  await writeDb(db);
  res.json(db.events[index]);
});

app.delete("/api/events/:id", async (req, res) => {
  const db = await readDb();
  const event = db.events.find((item) => item.id === req.params.id);

  if (!event) {
    return res.status(404).json({ message: "Event not found" });
  }

  event.status = "archived";
  await writeDb(db);
  res.json({ message: "Event archived" });
});

app.post("/api/events/:id/register", async (req, res) => {
  const error = requireFields(req.body, ["name", "email", "phone"]);
  if (error) {
    return res.status(400).json({ message: error });
  }

  const db = await readDb();
  const event = db.events.find((item) => item.id === req.params.id && item.status !== "archived");

  if (!event) {
    return res.status(404).json({ message: "Event not found" });
  }

  const existing = db.registrations.find(
    (item) => item.eventId === event.id && item.email.toLowerCase() === req.body.email.toLowerCase()
  );

  if (existing) {
    return res.status(409).json({ message: "This email is already registered for the event" });
  }

  const count = db.registrations.filter((item) => item.eventId === event.id).length;
  if (event.capacity > 0 && count >= event.capacity) {
    return res.status(409).json({ message: "Event capacity is full" });
  }

  const registration = {
    id: makeId("reg"),
    eventId: event.id,
    name: req.body.name.trim(),
    email: req.body.email.trim(),
    phone: req.body.phone.trim(),
    registeredAt: new Date().toISOString()
  };

  db.registrations.push(registration);
  await writeDb(db);
  res.status(201).json(registration);
});

app.get("/api/admin/registrations", async (_req, res) => {
  const db = await readDb();
  const registrations = db.registrations
    .map((registration) => ({
      ...registration,
      event: db.events.find((event) => event.id === registration.eventId) || null
    }))
    .sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt));

  res.json(registrations);
});

app.get("/api/admin/events/:id/registrations", async (req, res) => {
  const db = await readDb();
  const registrations = db.registrations
    .filter((registration) => registration.eventId === req.params.id)
    .sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt));

  res.json(registrations);
});

app.listen(port, () => {
  console.log(`Event Management API running on http://localhost:${port}`);
});
