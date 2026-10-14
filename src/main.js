const { invoke } = window.__TAURI__.core;

let greetInputEl;
let greetMsgEl;

async function greet() {
  greetMsgEl.textContent = await invoke("greet", { name: greetInputEl.value });
}

window.addEventListener("DOMContentLoaded", () => {
  const greetForm = document.querySelector("#greet-form");
  if (greetForm) {
    greetInputEl = document.querySelector("#greet-input");
    greetMsgEl = document.querySelector("#greet-msg");
    greetForm.addEventListener("submit", (e) => {
      e.preventDefault();
      greet();
    });
  }
  const tabs = document.querySelectorAll('.tab-btn');
  const vistas = document.querySelectorAll('.vista-app');

  // PARA poder abrir cada pestaña
  const funcionesPorVista = {
      "Inicio": () => {
          console.log("Cargando datos del inicio...");
      },
      "Notas": () => {
          console.log("Preparando el editor de notas...");
      },
      "Temporizador": () => {
          console.log("Reiniciando reloj...");
      },
      "Perfil": () => {
          console.log("Obteniendo estadísticas...");
      }
  };

  // Lógica para cambiar de pestaña
  tabs.forEach(tab => {
      tab.addEventListener('click', () => {
          // Cambiar clase visual
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');

          const tituloPestaña = tab.getAttribute('title');

          // Ocultar todas las vistas y mostrar la seleccionada
          vistas.forEach(vista => vista.classList.add('oculta'));
          
          const vistaActiva = document.getElementById(`vista-${tituloPestaña}`);
          if (vistaActiva) {
              vistaActiva.classList.remove('oculta');
          }

          // Ejecutar función si existe
          if (funcionesPorVista[tituloPestaña]) {
              funcionesPorVista[tituloPestaña]();
          }
      });
  });

  // Eventos para botones dentro de las vistas
  const btnGuardar = document.getElementById('btn-guardar-nota');
  if (btnGuardar) {
      btnGuardar.addEventListener('click', () => {
          alert("Nota guardada (simulación)");
      });
  }
});