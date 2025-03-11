document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("partidos-container");
    const btnAgregar = document.getElementById("btn-agregar");
    const formContainer = document.getElementById("form-container");
    const form = document.getElementById("partido-form");
    const btnCancelar = document.getElementById("cancelar");

    btnAgregar.addEventListener("click", () => formContainer.classList.remove("hidden"));
    btnCancelar.addEventListener("click", () => formContainer.classList.add("hidden"));

    // 🔄 Cargar partidos desde la base de datos
    async function cargarPartidos() {
        try {
            console.log("📡 Solicitando partidos...");
            const response = await fetch("/partidos");
            if (!response.ok) throw new Error("Error en la respuesta del servidor");

            const partidos = await response.json();
            console.log("📄 Partidos obtenidos:", partidos);

            container.innerHTML = partidos.length
                ? "" // Si hay partidos, limpiar el contenedor antes de agregar nuevos
                : "<p>No hay partidos disponibles.</p>";

            partidos.forEach(partido => {
                console.log("🖼️ Datos del partido:", partido);

                const partidoDiv = document.createElement("div");
                partidoDiv.classList.add("partido");

                partidoDiv.innerHTML = `
                    <p class="equipos">
                        <img src="${partido.teams.home.logo}" 
                             alt="${partido.teams.home.name}" 
                             width="30" onerror="this.onerror=null;this.src='default.png';">
                        ${partido.teams.home.name} vs ${partido.teams.away.name}
                        <img src="${partido.teams.away.logo}" 
                             alt="${partido.teams.away.name}" 
                             width="30" onerror="this.onerror=null;this.src='default.png';">
                    </p>
                    <p class="estado">${partido.fixture?.status?.long ?? "Pendiente"} - ${partido.fixture?.elapsed ?? 0}'</p>
                    <p class="resultado">${partido.goals?.home ?? 0} - ${partido.goals?.away ?? 0}</p>
                    <button class="btn-editar" data-id="${partido._id}">✏️ Editar</button>
                    <button class="btn-eliminar" data-id="${partido._id}">❌ Eliminar</button>
                `;

                container.appendChild(partidoDiv);
            });

            // Agregar eventos a los botones
            document.querySelectorAll(".btn-editar").forEach(button => {
                button.addEventListener("click", () => editarPartido(button.dataset.id));
            });

            document.querySelectorAll(".btn-eliminar").forEach(button => {
                button.addEventListener("click", () => eliminarPartido(button.dataset.id));
            });

        } catch (error) {
            console.error("❌ Error al obtener partidos:", error);
            container.innerHTML = "<p>Error al cargar los partidos.</p>";
        }
    }

    // ❌ Eliminar partido
    async function eliminarPartido(id) {
        try {
            if (!confirm("¿Seguro que quieres eliminar este partido?")) return;

            const response = await fetch(`/partidos/${id}`, { method: "DELETE" });
            if (!response.ok) throw new Error("Error al eliminar el partido.");

            alert("✅ Partido eliminado correctamente.");
            cargarPartidos();
        } catch (error) {
            console.error("❌ Error al eliminar:", error);
            alert("Hubo un problema al eliminar el partido.");
        }
    }

    // ✏️ Editar partido
    async function editarPartido(id) {
        try {
            const nuevoNombreLocal = prompt("Nuevo nombre del equipo local:");
            const nuevoLogoLocal = prompt("Nueva URL del logo del equipo local:");
            const nuevoNombreVisitante = prompt("Nuevo nombre del equipo visitante:");
            const nuevoLogoVisitante = prompt("Nueva URL del logo del equipo visitante:");
            const nuevosGolesLocal = prompt("Cantidad de goles del equipo local:");
            const nuevosGolesVisitante = prompt("Cantidad de goles del equipo visitante:");

            if (!nuevoNombreLocal || !nuevoLogoLocal || !nuevoNombreVisitante || !nuevoLogoVisitante) {
                alert("⚠️ Los campos de nombres y logos no pueden estar vacíos.");
                return;
            }

            if (isNaN(nuevosGolesLocal) || isNaN(nuevosGolesVisitante)) {
                alert("⚠️ Los goles deben ser valores numéricos.");
                return;
            }

            const response = await fetch(`/partidos/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    teams: {
                        home: { name: nuevoNombreLocal, logo: nuevoLogoLocal },
                        away: { name: nuevoNombreVisitante, logo: nuevoLogoVisitante }
                    },
                    goals: {
                        home: parseInt(nuevosGolesLocal, 10),
                        away: parseInt(nuevosGolesVisitante, 10)
                    }
                })
            });

            if (!response.ok) throw new Error("Error al actualizar el partido.");

            alert("✅ Partido actualizado correctamente");
            cargarPartidos();
        } catch (error) {
            console.error("❌ Error al actualizar:", error);
            alert("Hubo un problema al actualizar el partido.");
        }
    }

    // 📌 Método para agregar un partido con validaciones
    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        // Obtener valores de los inputs
        const homeName = document.getElementById("home-name").value.trim();
        const homeLogo = document.getElementById("home-logo").value.trim();
        const awayName = document.getElementById("away-name").value.trim();
        const awayLogo = document.getElementById("away-logo").value.trim();
        const date = document.getElementById("date").value.trim();
        const statusLong = document.getElementById("status-long").value.trim();
        const statusShort = document.getElementById("status-short").value.trim();
        const homeGoals = document.getElementById("home-goals").value.trim();
        const awayGoals = document.getElementById("away-goals").value.trim();

        // ✅ Validar que los campos no estén vacíos
        if (!homeName || !homeLogo || !awayName || !awayLogo || !date || !statusLong || !statusShort) {
            alert("⚠️ Todos los campos deben estar completos.");
            return;
        }

        // ✅ Convertir goles a enteros solo si tienen valores
        const goalsHome = homeGoals ? parseInt(homeGoals, 10) : 0;
        const goalsAway = awayGoals ? parseInt(awayGoals, 10) : 0;

        // ✅ Validar que los goles sean números válidos
        if (isNaN(goalsHome) || isNaN(goalsAway)) {
            alert("⚠️ Los goles deben ser valores numéricos.");
            return;
        }

        const partido = {
            teams: {
                home: { name: homeName, logo: homeLogo },
                away: { name: awayName, logo: awayLogo }
            },
            fixture: {
                date: date,
                status: { long: statusLong, short: statusShort }
            },
            goals: {
                home: goalsHome,
                away: goalsAway
            }
        };

        try {
            const response = await fetch("/partidos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(partido)
            });

            if (!response.ok) throw new Error("Error al agregar el partido.");

            alert("✅ Partido agregado con éxito.");
            form.reset();
            formContainer.classList.add("hidden");
            cargarPartidos();
        } catch (error) {
            console.error("❌ Error al agregar partido:", error);
            alert("Hubo un problema al agregar el partido.");
        }
    });

    // 🚀 Cargar partidos al iniciar
    cargarPartidos();
});
