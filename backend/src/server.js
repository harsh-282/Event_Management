import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";

const app = express();
const port = process.env.PORT || 5000;
const mongoUrl = process.env.MONGODB_URL;

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "event-management-backend",
    health: "/api/health",
    events: "/api/events"
  });
});

app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req, res) => {
  res.status(204).end();
});

if (!mongoUrl) {
  console.error("MONGODB_URL is missing. Add it to backend/.env");
  process.exit(1);
}

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    venue: { type: String, required: true, trim: true },
    capacity: { type: Number, default: 0 },
    category: { type: String, default: "General", trim: true },
    description: { type: String, required: true, trim: true },
    status: { type: String, default: "published", enum: ["published", "archived"] }
  },
  { timestamps: true }
);

const registrationSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

registrationSchema.index({ eventId: 1, email: 1 }, { unique: true });

const Event = mongoose.model("Event", eventSchema);
const Registration = mongoose.model("Registration", registrationSchema);

function requireFields(body, fields) {
  const missing = fields.filter((field) => !String(body[field] ?? "").trim());
  return missing.length ? `${missing.join(", ")} required` : null;
}

function serializeEvent(event, registrationsCount = 0) {
  return {
    id: event._id.toString(),
    title: event.title,
    date: event.date,
    time: event.time,
    venue: event.venue,
    capacity: event.capacity,
    category: event.category,
    description: event.description,
    status: event.status,
    createdAt: event.createdAt,
    registrationsCount
  };
}

function serializeRegistration(registration) {
  const event = registration.eventId && typeof registration.eventId === "object"
    ? registration.eventId
    : null;

  return {
    id: registration._id.toString(),
    eventId: event ? event._id.toString() : registration.eventId.toString(),
    name: registration.name,
    email: registration.email,
    phone: registration.phone,
    registeredAt: registration.createdAt,
    event: event ? serializeEvent(event) : null
  };
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "event-management-backend",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

app.get("/api/events", async (_req, res, next) => {
  try {
    const events = await Event.find({ status: { $ne: "archived" } }).sort({ date: 1, time: 1 });
    const counts = await Registration.aggregate([
      { $group: { _id: "$eventId", count: { $sum: 1 } } }
    ]);
    const countMap = new Map(counts.map((item) => [item._id.toString(), item.count]));

    res.json(events.map((event) => serializeEvent(event, countMap.get(event._id.toString()) || 0)));
  } catch (error) {
    next(error);
  }
});

app.post("/api/events", async (req, res, next) => {
  try {
    const error = requireFields(req.body, ["title", "date", "time", "venue", "description"]);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const event = await Event.create({
      title: req.body.title,
      date: req.body.date,
      time: req.body.time,
      venue: req.body.venue,
      capacity: Number(req.body.capacity || 0),
      category: req.body.category?.trim() || "General",
      description: req.body.description
    });

    res.status(201).json(serializeEvent(event));
  } catch (error) {
    next(error);
  }
});

app.put("/api/events/:id", async (req, res, next) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      {
        ...(req.body.title && { title: req.body.title }),
        ...(req.body.date && { date: req.body.date }),
        ...(req.body.time && { time: req.body.time }),
        ...(req.body.venue && { venue: req.body.venue }),
        ...(req.body.capacity !== undefined && { capacity: Number(req.body.capacity) }),
        ...(req.body.category && { category: req.body.category }),
        ...(req.body.description && { description: req.body.description })
      },
      { new: true, runValidators: true }
    );

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const registrationsCount = await Registration.countDocuments({ eventId: event._id });
    res.json(serializeEvent(event, registrationsCount));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/events/:id", async (req, res, next) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, { status: "archived" }, { new: true });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.json({ message: "Event archived" });
  } catch (error) {
    next(error);
  }
});

app.post("/api/events/:id/register", async (req, res, next) => {
  try {
    const error = requireFields(req.body, ["name", "email", "phone"]);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const event = await Event.findOne({ _id: req.params.id, status: { $ne: "archived" } });
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const count = await Registration.countDocuments({ eventId: event._id });
    if (event.capacity > 0 && count >= event.capacity) {
      return res.status(409).json({ message: "Event capacity is full" });
    }

    const registration = await Registration.create({
      eventId: event._id,
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone
    });

    res.status(201).json(serializeRegistration(registration));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "This email is already registered for the event" });
    }
    next(error);
  }
});

app.get("/api/admin/registrations", async (_req, res, next) => {
  try {
    const registrations = await Registration.find()
      .populate("eventId")
      .sort({ createdAt: -1 });

    res.json(registrations.map(serializeRegistration));
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/events/:id/registrations", async (req, res, next) => {
  try {
    const registrations = await Registration.find({ eventId: req.params.id })
      .populate("eventId")
      .sort({ createdAt: -1 });

    res.json(registrations.map(serializeRegistration));
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (error.name === "CastError") {
    return res.status(404).json({ message: "Resource not found" });
  }

  console.error(error);
  res.status(500).json({ message: "Server error" });
});

mongoose
  .connect(mongoUrl, { serverSelectionTimeoutMS: 10000 })
  .then(() => {
    app.listen(port, () => {
      console.log(`Event Management API running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed", error.message);
    process.exit(1);
  });
