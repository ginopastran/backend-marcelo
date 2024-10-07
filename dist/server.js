"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
// Cargar las variables de entorno desde el archivo .env
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
// Configurar CORS para permitir el acceso desde tu frontend
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || "*", // URL de tu frontend, o "*" para permitir todos
    methods: ["GET", "POST"],
    credentials: true, // Permite enviar cookies y credenciales
}));
// Configuración de Socket.IO con CORS
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "*", // Asegúrate de tener la URL correcta de tu frontend
        methods: ["GET", "POST"],
        credentials: true, // Habilitar credenciales con WebSockets
    },
});
// Middleware para permitir JSON en el cuerpo de las peticiones
app.use(express_1.default.json());
// Ruta principal para mostrar "Hello World"
app.get("/", (req, res) => {
    res.send("Hello World");
});
// Ruta para recibir el evento desde la API de Next.js
app.post("/api/socket", (req, res) => {
    const { event, data } = req.body;
    if (!event || !data) {
        return res.status(400).send("Faltan datos del evento");
    }
    // Emitimos el evento a todos los clientes conectados
    io.emit(event, data);
    console.log(`Evento emitido: ${event}`, data);
    return res.status(200).send("Evento emitido correctamente");
});
// Escuchar conexiones de Socket.IO
io.on("connection", (socket) => {
    console.log(`Cliente conectado ${socket.id}`);
    socket.on("disconnect", () => {
        console.log(`Cliente desconectado ${socket.id}`);
    });
});
// Inicializamos el servidor en el puerto definido en .env o 4000 por defecto
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
