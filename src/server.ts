import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import cron from "node-cron";
import axios from "axios";

dotenv.config();

const app = express();
const server = http.createServer(app);

// Configurar CORS para permitir el acceso desde tu frontend
app.use(
  cors({
    origin: "*", // URL de tu frontend
    methods: ["GET", "POST"],
    credentials: true,
  })
);

// Configuración de Socket.IO con CORS
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(express.json());

const cronJobs: { [key: string]: cron.ScheduledTask } = {};

// Función para convertir una fecha a expresión cron
function dateToCron(date: Date): string {
  const minutes = date.getUTCMinutes();
  const hours = date.getUTCHours();
  const day = date.getUTCDate();
  const month = date.getUTCMonth() + 1;
  return `${minutes} ${hours} ${day} ${month} *`;
}

// Ruta principal para mostrar "Hello World"
app.get("/", (req, res) => {
  res.send("Hello World");
});

// Ruta para recibir el evento desde la API de Next.js y programar una notificación
app.post("/api/schedule-notification", (req, res) => {
  const { presupuestoId, name, notificationDate } = req.body;

  if (!presupuestoId || !notificationDate) {
    return res
      .status(400)
      .send("Presupuesto ID y fecha de notificación son requeridos");
  }

  const date = new Date(notificationDate);

  if (isNaN(date.getTime())) {
    return res.status(400).send("La fecha de notificación no es válida");
  }

  const cronExpression = dateToCron(date);

  if (cronJobs[presupuestoId]) {
    cronJobs[presupuestoId].stop();
    delete cronJobs[presupuestoId];
  }

  const job = cron.schedule(cronExpression, async () => {
    console.log(
      `Notificación para el presupuesto ${name} - Presupuesto ID: ${presupuestoId}`
    );

    try {
      // Enviar solicitud a la API de Next.js para crear la notificación en la base de datos
      const notificationData = {
        title: `Faltan 15 días para la licitación del presupuesto ${name}`,
        description: `La licitación del presupuesto ${name} es en 15 días.`,
      };

      // Crear la notificación en la base de datos de Next.js
      await axios.post(
        `${process.env.FRONTEND_URL}/api/notificaciones`,
        notificationData
      );

      // Emitir el evento de socket después de crear la notificación en la base de datos
      io.emit("licitacion-notification", notificationData);

      console.log("Notificación creada y socket emitido correctamente");
    } catch (error) {
      console.error("Error al crear la notificación en Next.js:", error);
    }

    job.stop();
    delete cronJobs[presupuestoId];
  });

  if (job) {
    cronJobs[presupuestoId] = job;

    console.log(`Notificación programada para el presupuesto ${name}`);
    console.log(`Fecha de notificación: ${date}`);
    console.log(`Expresión cron: ${cronExpression}`);

    return res.status(200).json({
      message: "Notificación programada correctamente",
      presupuestoId,
      notificationDate: date,
      cronExpression,
    });
  } else {
    console.log(
      `Error al programar la notificación para el presupuesto ${name}`
    );
    return res.status(500).send("Error al programar la notificación");
  }
});

// Ruta para emitir eventos de socket
app.post("/api/socket", (req, res) => {
  const { event, data } = req.body;

  if (!event || !data) {
    return res.status(400).send("Faltan datos del evento");
  }

  io.emit(event, data);
  return res.status(200).send("Evento emitido correctamente");
});

// Ruta para cancelar un cron job programado
app.post("/api/cancel-notification", (req, res) => {
  const { presupuestoId } = req.body;

  if (!presupuestoId) {
    return res.status(400).send("Presupuesto ID es requerido");
  }

  // Verificar si existe un cron job para el presupuesto
  if (cronJobs[presupuestoId]) {
    cronJobs[presupuestoId].stop(); // Detener el cron job
    delete cronJobs[presupuestoId]; // Eliminarlo del diccionario
    console.log(
      `Cron job para el presupuesto ${presupuestoId} ha sido cancelado`
    );
    return res.status(200).send("Notificación cancelada correctamente");
  } else {
    console.log(`No se encontró cron job para el presupuesto ${presupuestoId}`);
    return res.status(404).send("No se encontró un cron job para cancelar");
  }
});

// Escuchar conexiones de Socket.IO
io.on("connection", (socket) => {
  console.log(`Cliente conectado ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`Cliente desconectado ${socket.id}`);
  });
});

const port = Number(process.env.PORT) || 4000;
server.listen(port, "0.0.0.0", () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
