import { iniciarConfig } from './js/config.js';
import { alMostrarNotas, iniciarNotas } from './js/notas.js';
import { alMostrarCalendario, iniciarCalendario } from './js/calendario.js';

window.addEventListener('DOMContentLoaded', async () => {
  const tabs = document.querySelectorAll('.tab-btn');
  const vistas = document.querySelectorAll('.vista-app');

  const alEntrarEnVista = {
    Inicio: () => {},
    Calendario: () => alMostrarCalendario(),
    Notas: () => alMostrarNotas(),
    Temporizador: () => {},
    Perfil: () => {},
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      const nombreVista = tab.getAttribute('title');
      vistas.forEach((vista) => vista.classList.add('oculta'));
      document.getElementById(`vista-${nombreVista}`)?.classList.remove('oculta');
      alEntrarEnVista[nombreVista]?.();
    });
  });
  await iniciarConfig();
  await iniciarCalendario();
  await iniciarNotas();
});

document.addEventListener('DOMContentLoaded', () => {
    const timeDisplay = document.getElementById('time-display');
    const btnStart = document.getElementById('btn-start');
    const btnPause = document.getElementById('btn-pause');

    let timeLeft = 1500; // 25 minutos en segundos (25 * 60)
    let timerInterval;
    let isRunning = false;

    function updateDisplay() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
                    alert('¡Tiempo Pomodoro terminado! Tómate un descanso.');
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

    btnStart.addEventListener('click', startTimer);
    btnPause.addEventListener('click', pauseTimer);

    // Inicializar la pantalla con el tiempo por defecto
    updateDisplay();
});
