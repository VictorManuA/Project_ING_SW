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
