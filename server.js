require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const API_KEY = process.env.API_KEY;
const API_URL = "https://v3.football.api-sports.io/status";

// ⚠️ Validar variables de entorno antes de continuar
if (!MONGODB_URI || !API_KEY) {
    console.error("❌ ERROR: Faltan variables de entorno en el archivo .env");
    process.exit(1);
}

// Conectar a MongoDB
mongoose
    .connect(MONGODB_URI)
    .then(() => console.log("✅ Conectado a MongoDB"))
    .catch((err) => {
        console.error("❌ Error al conectar a MongoDB:", err);
        process.exit(1);
    });

// Middleware para manejar JSON
app.use(express.json());

// Servir archivos estáticos desde la carpeta 'Diseño'
app.use(express.static(path.join(__dirname, "Diseño")));

// 📌 Definir esquema y modelo de Status
const StatusSchema = new mongoose.Schema({
    account: {
        firstname: String,
        lastname: String,
        email: String,
    },
    subscription: {
        plan: String,
        end: String,
        active: Boolean,

    },
    requests: {
        current: Number,
        limit_day: Number,
    },
});
const Status = mongoose.model("Status", StatusSchema);

// 📌 Definir esquema y modelo de Partidos
const PartidosSchema = new mongoose.Schema({
    league: {
        id: Number,
        name: String,
        country: String,
        logo: String,
    },
    teams: {
        home: { id: Number, name: String, logo: String },
        away: { id: Number, name: String, logo: String },
    },
    fixture: {
        date: String,
        status: {
            long: String,
            short: String,
            elapsed: Number,
            extra: Number,
        },
        venue: { name: String, city: String },
    },
    goals: {
        home: Number,
        away: Number,
    },
});

// Usar modelo existente o crear uno nuevo si no está definido
const Partidos = mongoose.models.Partidos || mongoose.model("Partidos", PartidosSchema);

// 📌 Obtener datos de la API de Status y guardarlos en MongoDB
const obtenerYGuardarDatos = async () => {
    try {
        const response = await axios.get(API_URL, {
            headers: { "x-apisports-key": API_KEY },
        });

        const apiData = response.data.response;

        if (!apiData) {
            console.error("❌ No se recibieron datos válidos desde la API.");
            return;
        }

        const datos = {
            account: apiData.account || { firstname: "", lastname: "", email: "" },
            subscription: apiData.subscription || { plan: "", end: "", active: false },
            requests: apiData.requests || { current: 0, limit_day: 0 },
        };

        await Status.create(datos);
        console.log("✅ Datos de Status guardados en MongoDB:", datos);
    } catch (error) {
        console.error("❌ Error al obtener datos de la API:", error.message);
    }
};

// 📌 Obtener los partidos y guardarlos en MongoDB
const obtenerPartidos = async () => {
    try {
        const response = await axios.get("https://v3.football.api-sports.io/fixtures", {
            headers: { "x-apisports-key": API_KEY },
            params: { date: new Date().toISOString().split("T")[0] },
        });

        let partidos = response.data.response;
        if (!partidos || partidos.length === 0) {
            console.log("❌ No se encontraron partidos para hoy.");
            return;
        }
        partidos = partidos.slice(0, 20);

        await Partidos.insertMany(partidos.map(partido => ({
            league: partido.league,
            teams: partido.teams,
            fixture: partido.fixture,
            goals: partido.goals,
        })), { ordered: false });

        console.log(`✅ ${partidos.length} partidos guardados en MongoDB.`);
    } catch (error) {
        console.error("❌ Error al obtener los partidos:", error.message);
    }
};

        // **Limitar a 20 partidos**
        partidos = partidos.slice(0, 20);

        await Partidos.insertMany(partidos.map(partido => ({
            league: partido.league,
            teams: partido.teams,
            fixture: partido.fixture,
            goals: partido.goals,
        })));

        console.log(`✅ ${partidos.length} partidos guardados en MongoDB.`);
    } catch (error) {
        console.error("❌ Error al obtener los partidos:", error.message);
    }
};

// 📌 Rutas
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "Diseño", "index.html"));
});

app.get("/status", async (req, res) => {
    try {
        const datos = await Status.find();
        res.json(datos);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener los datos" });
    }
});

app.get("/partidos", async (req, res) => {
    try {
        const partidos = await Partidos.find();
        res.json(partidos);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener los partidos" });
    }
});

/*------------------------------ METODOS -------------------------------------*/

// 📌 Crear un nuevo partido
app.post("/partidos", async (req, res) => {
    try {
        const nuevoPartido = new Partidos(req.body);
        await nuevoPartido.save();
        res.status(201).json({ mensaje: "Partido agregado con éxito", partido: nuevoPartido });
    } catch (error) {
        console.error("❌ Error al guardar el partido:", error);
        res.status(500).json({ error: "Error al guardar el partido" });
    }
});

// 📌 Editar un partido
app.put("/partidos/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { teams, goals } = req.body;

        if (!teams || !teams.home || !teams.away || !goals) {
            return res.status(400).json({ error: "Datos incompletos para actualizar el partido." });
        }

        const partido = await Partidos.findById(id);
        if (!partido) {
            return res.status(404).json({ error: "Partido no encontrado." });
        }

        // Actualizar los datos
        partido.teams.home.name = teams.home.name || partido.teams.home.name;
        partido.teams.home.logo = teams.home.logo || partido.teams.home.logo;
        partido.teams.away.name = teams.away.name || partido.teams.away.name;
        partido.teams.away.logo = teams.away.logo || partido.teams.away.logo;
        partido.goals.home = goals.home !== undefined ? goals.home : partido.goals.home;
        partido.goals.away = goals.away !== undefined ? goals.away : partido.goals.away;

        await partido.save();
        res.json({ message: "Partido actualizado correctamente.", partido });
    } catch (error) {
        console.error("Error al actualizar el partido:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});


app.delete("/partidos/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar si el partido existe
        const partido = await Partidos.findById(id);
        if (!partido) {
            return res.status(404).json({ error: "Partido no encontrado." });
        }

        // Eliminar de la base de datos
        await Partidos.findByIdAndDelete(id);
        res.json({ message: "Partido eliminado correctamente." });
    } catch (error) {
        console.error("Error al eliminar el partido:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});



// 📌 Eliminar un partido
app.delete("/partidos/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const partidoEliminado = await Partidos.findByIdAndDelete(id);

        if (!partidoEliminado) {
            return res.status(404).json({ error: "Partido no encontrado." });
        }

        res.json({ mensaje: "Partido eliminado correctamente." });
    } catch (error) {
        console.error("❌ Error al eliminar el partido:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

// 📌 Iniciar servidor y cargar datos de la API
app.listen(PORT, async () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    await obtenerYGuardarDatos();
    await obtenerPartidos();
});
