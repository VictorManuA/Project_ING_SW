import { iniciarConfig } from "./js/config.js";
import { alMostrarNotas, iniciarNotas } from "./js/notas.js";
import { alMostrarCalendario, iniciarCalendario } from "./js/calendario.js";

function actualizarRelojInicio() {
  const elementoHora = document.getElementById("reloj-inicio");
  const elementoFecha = document.getElementById("fecha-inicio");

  if (!elementoHora || !elementoFecha) return;

  const ahora = new Date();

  const horas = String(ahora.getHours()).padStart(2, "0");
  const minutos = String(ahora.getMinutes()).padStart(2, "0");
  elementoHora.textContent = `${horas}:${minutos}`;

  const opcionesFecha = { weekday: "long", day: "numeric", month: "long" };
  elementoFecha.textContent = ahora.toLocaleDateString("es-ES", opcionesFecha);
}

function actualizarProximoEventoInicio() {
  const tituloEl = document.getElementById("inicio-evento-titulo");
  const horaEl = document.getElementById("inicio-evento-hora");

  if (!tituloEl || !horaEl) return;

  // Obtiene las actividades guardadas (ajusta el nombre del item en localStorage)
  const actividades = JSON.parse(localStorage.getItem("actividades") || "[]");
  const ahora = new Date();

  // Filtra actividades futuras no completadas y las ordena de más cercana a más lejana
  const futuras = actividades
    .filter((act) => !act.completada && new Date(act.inicio) > ahora)
    .sort((a, b) => new Date(a.inicio) - new Date(b.inicio));

  if (futuras.length > 0) {
    const proximo = futuras[0];
    const fechaInicio = new Date(proximo.inicio);

    const horas = String(fechaInicio.getHours()).padStart(2, "0");
    const minutos = String(fechaInicio.getMinutes()).padStart(2, "0");

    tituloEl.textContent = proximo.titulo;
    horaEl.textContent = `${horas}:${minutos} hs`;
  } else {
    tituloEl.textContent = "Sin eventos próximos";
    horaEl.textContent = "--:--";
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  const tabs = document.querySelectorAll(".tab-btn");
  const vistas = document.querySelectorAll(".vista-app");

  const alEntrarEnVista = {
    Inicio: () => {
        actualizarRelojInicio();
        actualizarProximoEventoInicio();
    },
    Calendario: () => alMostrarCalendario(),
    Notas: () => alMostrarNotas(),
    Temporizador: () => {},
    Perfil: () => {},
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const nombreVista = tab.getAttribute("title");
      vistas.forEach((vista) => vista.classList.add("oculta"));
      document
        .getElementById(`vista-${nombreVista}`)
        ?.classList.remove("oculta");
      alEntrarEnVista[nombreVista]?.();
    });
  });

  actualizarRelojInicio();
  setInterval(actualizarRelojInicio, 1000);

  actualizarProximoEventoInicio();

  await iniciarConfig();
  await iniciarCalendario();
  await iniciarNotas();
});

document.addEventListener("DOMContentLoaded", () => {
  const timeDisplay = document.getElementById("time-display");
  const btnStart = document.getElementById("btn-start");
  const btnPause = document.getElementById("btn-pause");

  let timeLeft = 1500; // 25 minutos en segundos (25 * 60)
  let timerInterval;
  let isRunning = false;

  function updateDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    timeDisplay.textContent = formattedTime;
  }

  function startTimer() {
    if (!isRunning && timeLeft > 0) {
      isRunning = true;
      timerInterval = setInterval(() => {
        timeLeft--;
        updateDisplay();

        if (timeLeft === 0) {
          clearInterval(timerInterval);
          isRunning = false;
          alert("¡Tiempo Pomodoro terminado! Tómate un descanso.");
        }
      }, 1000);
    }
  }

  function pauseTimer() {
    if (isRunning) {
      clearInterval(timerInterval);
      isRunning = false;
    }
  }

  btnStart.addEventListener("click", startTimer);
  btnPause.addEventListener("click", pauseTimer);

  // Inicializar la pantalla con el tiempo por defecto
  updateDisplay();
});
