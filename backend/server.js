require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const contactRoutes = require("./routes/contactRoutes");
const templateRoutes = require("./routes/templateRoutes");
const messageRoutes = require("./routes/messageRoutes");
const audienceRoutes = require("./routes/audienceRoutes");
const inboxRoutes = require("./routes/inboxRoutes");
const webhookRoutes = require("./routes/webhook");
const whatsappSetupRoutes = require("./routes/whatsappSetupRoutes");
const messageFlowRoutes = require("./routes/messageFlowRoutes");
const { processDueFlowExecutions } = require("./services/messageFlowService");
const app = express();
connectDB();
app.set("trust proxy", 1);

const configuredOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.CORS_ALLOWED_ORIGINS || "").split(","),
]
  .map((origin) => String(origin || "").trim())
  .filter(Boolean);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://whatsapp.navkaarrealestate.com",
  ...configuredOrigins,
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed for this origin"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get("/", (req, res) => {
  res.send("Backend running");
});

app.get("/test", (req, res) => {
  res.json({ message: "server working" });
});
app.use("/api/auth", authRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/template", templateRoutes);
app.use("/api", messageRoutes);
app.use("/api/audience", audienceRoutes);
app.use("/api/inbox", inboxRoutes);
app.use("/api/whatsapp-setup", whatsappSetupRoutes);
app.use("/api/message-flows", messageFlowRoutes);
app.use("/api/webhook", webhookRoutes);
app.use("/api/whatsapp/webhook", webhookRoutes);
app.use("/webhook", webhookRoutes);
app.use("/inbox", webhookRoutes);
app.get("/", (req, res) => {
  res.send("Backend running");
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

setInterval(() => {
  processDueFlowExecutions().catch((error) => {
    console.error("Message flow scheduler error:", error.message);
  });
}, 60 * 1000);
