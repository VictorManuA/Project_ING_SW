const invoke = window.__TAURI__ ? window.__TAURI__.core.invoke : null;

let greetInputEl;
let greetMsgEl;

async function greet() {
  if (invoke && greetInputEl && greetMsgEl) {
      greetMsgEl.textContent = await invoke("greet", { name: greetInputEl.value });
  }
}

window.addEventListener("DOMContentLoaded", () => {
  // 1. LÓGICA DE TAURI 
  const greetForm = document.querySelector("#greet-form");
  if (greetForm) {
    greetInputEl = document.querySelector("#greet-input");
    greetMsgEl = document.querySelector("#greet-msg");
    greetForm.addEventListener("submit", (e) => {
      e.preventDefault();
      greet();
    });
  }

  //LÓGICA DE LAS PESTAÑAS
  const tabs = document.querySelectorAll('.tab-btn');
  const vistas = document.querySelectorAll('.vista-app');

  const funcionesPorVista = {
      "Inicio": () => console.log("Cargando inicio..."),
      "Notas": () => console.log("Preparando notas..."),
      "Temporizador": () => console.log("Temporizador..."),
      "Perfil": () => console.log("Perfil...")
  };

  tabs.forEach(tab => {
      tab.addEventListener('click', () => {
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');

          const tituloPestaña = tab.getAttribute('title');

          vistas.forEach(vista => vista.classList.add('oculta'));
          
          const vistaActiva = document.getElementById(`vista-${tituloPestaña}`);
          if (vistaActiva) {
              vistaActiva.classList.remove('oculta');
          }

          if (funcionesPorVista[tituloPestaña]) {
              funcionesPorVista[tituloPestaña]();
          }
      });
  });

  //PANELES DE NOTAS
  const divisor = document.getElementById('divisor-notas');
  const panelIzquierdo = document.getElementById('panel-archivos');
  const contenedorSplit = document.querySelector('.contenedor-notas-split');
  let isResizing = false;

  if (divisor && panelIzquierdo && contenedorSplit) {
      divisor.addEventListener('mousedown', () => {
          isResizing = true;
          divisor.classList.add('arrastrando');
          document.body.style.userSelect = 'none'; 
          document.body.style.cursor = 'col-resize';
      });

      document.addEventListener('mousemove', (e) => {
          if (!isResizing) return;
          const rectContenedor = contenedorSplit.getBoundingClientRect();
          let nuevoAnchoPorcentaje = ((e.clientX - rectContenedor.left) / rectContenedor.width) * 100;

          if (nuevoAnchoPorcentaje > 15 && nuevoAnchoPorcentaje < 60) {
              panelIzquierdo.style.width = `${nuevoAnchoPorcentaje}%`;
          }
      });

      document.addEventListener('mouseup', () => {
          if (isResizing) {
              isResizing = false;
              divisor.classList.remove('arrastrando');
              document.body.style.removeProperty('user-select');
              document.body.style.removeProperty('cursor');
          }
      });
  }

  //EDITOR MARKDOWN
  const btnToggleVista = document.getElementById('btn-toggle-vista');
  const txtContenido = document.getElementById('nota-contenido');
  const divPreview = document.getElementById('nota-preview');
  const contadorPalabras = document.getElementById('contador-palabras');
  let modoEdicion = true;

  if (btnToggleVista && txtContenido && divPreview) {
      btnToggleVista.addEventListener('click', () => {
          modoEdicion = !modoEdicion;
          if (modoEdicion) {
              txtContenido.classList.remove('oculta');
              divPreview.classList.add('oculta');
              btnToggleVista.innerHTML = '<i class="ph ph-eye"></i> Vista Previa';
              btnToggleVista.style.backgroundColor = 'transparent';
              btnToggleVista.style.color = '#3f3f46';
          } else {
              txtContenido.classList.add('oculta');
              divPreview.classList.remove('oculta');
              btnToggleVista.innerHTML = '<i class="ph ph-pencil-simple"></i> Editar';
              btnToggleVista.style.backgroundColor = '#3b4d3e';
              btnToggleVista.style.color = 'azure';
              if (typeof marked !== 'undefined') {
                  divPreview.innerHTML = marked.parse(txtContenido.value);
              }
          }
      });

      txtContenido.addEventListener('input', () => {
          const texto = txtContenido.value.trim();
          const palabras = texto === '' ? 0 : texto.split(/\s+/).length;
          if (contadorPalabras) contadorPalabras.textContent = `${palabras} palabras`;
      });
  }

  //ÁRBOL
  const listaArchivos = document.getElementById('lista-archivos');
  const inputTitulo = document.getElementById('nota-titulo');
  const btnNuevaNota = document.getElementById('btn-nueva-nota');
  const btnNuevaCarpeta = document.getElementById('btn-nueva-carpeta');
  const btnGuardarNota = document.getElementById('btn-guardar-nota');
  const btnCrearVault = document.getElementById('btn-crear-vault');
  const rutaArchivo = document.getElementById('ruta-archivo');

  let fileSystem = [
      { id: 1, tipo: 'carpeta', titulo: 'Universidad', abierta: true, parentId: null },
      { id: 2, tipo: 'nota', titulo: 'Modelo OSI', contenido: '# Modelo OSI\n\nInterconexion de sistemas abiertos...', ruta: 'Universidad/Modelo_OSI.md', parentId: 1 }
  ];

  let notaActivaId = 2; 
  let carpetaSeleccionadaId = null; 
    let rutaVaultFisico = null;

  function renderizarArbol() {
      if (!listaArchivos) return;
      listaArchivos.innerHTML = '';
      
      function construirNivel(parentId, contenedor) {
          const elementos = fileSystem.filter(e => e.parentId === parentId);
          elementos.forEach(item => {
              const li = document.createElement('li');
              if (item.tipo === 'carpeta') {
                  li.className = `archivo-item carpeta-item ${item.id === carpetaSeleccionadaId ? 'activo' : ''}`;
                  li.innerHTML = `<i class="ph ${item.abierta ? 'ph-folder-open' : 'ph-folder'}"></i> ${item.titulo}`;
                  const ulHijo = document.createElement('ul');
                  ulHijo.className = `contenido-carpeta ${item.abierta ? 'abierta' : ''}`;
                  
                  li.addEventListener('click', (e) => {
                      e.stopPropagation();
                      item.abierta = !item.abierta;
                      carpetaSeleccionadaId = item.id;
                      renderizarArbol();
                  });
                  
                  contenedor.appendChild(li);
                  contenedor.appendChild(ulHijo);
                  construirNivel(item.id, ulHijo); 
              } else {
                  li.className = `archivo-item ${item.id === notaActivaId ? 'activo' : ''}`;
                  li.innerHTML = `<i class="ph ph-file-text"></i> ${item.titulo}.md`;
                  
                  li.addEventListener('click', (e) => {
                      e.stopPropagation();
                      notaActivaId = item.id;
                      carpetaSeleccionadaId = item.parentId; 
                      cargarNotaActual();
                      renderizarArbol();
                  });
                  contenedor.appendChild(li);
              }
          });
      }
      construirNivel(null, listaArchivos);
  }

  function cargarNotaActual() {
      const nota = fileSystem.find(n => n.id === notaActivaId);
      if (nota && nota.tipo === 'nota' && inputTitulo && txtContenido) {
          inputTitulo.value = nota.titulo;
          txtContenido.value = nota.contenido;
          if (rutaArchivo) rutaArchivo.innerHTML = `<i class="ph ph-folder-open"></i> /Vault_Principal/${nota.ruta}`;
          if (!modoEdicion && btnToggleVista) btnToggleVista.click(); 
          txtContenido.dispatchEvent(new Event('input'));
      }
  }

  if (btnNuevaCarpeta) {
      btnNuevaCarpeta.addEventListener('click', () => {
          const nuevoId = Date.now();
          fileSystem.push({ id: nuevoId, tipo: 'carpeta', titulo: 'Nueva_Carpeta', abierta: true, parentId: carpetaSeleccionadaId });
          carpetaSeleccionadaId = nuevoId;
          renderizarArbol();
      });
  }

  if (btnNuevaNota) {
      btnNuevaNota.addEventListener('click', () => {
          const nuevoId = Date.now();
          const carpetaPadre = fileSystem.find(f => f.id === carpetaSeleccionadaId);
          if (carpetaPadre) carpetaPadre.abierta = true;
          fileSystem.push({ id: nuevoId, tipo: 'nota', titulo: 'Sin_titulo', contenido: "", ruta: 'Sin_titulo.md', parentId: carpetaSeleccionadaId });
          notaActivaId = nuevoId;
          renderizarArbol();
          cargarNotaActual();
      });
  }

  if (btnGuardarNota) {
      btnGuardarNota.addEventListener('click', () => {
          const notaIndex = fileSystem.findIndex(n => n.id === notaActivaId);
          if (notaIndex !== -1 && inputTitulo && txtContenido) {
              fileSystem[notaIndex].titulo = inputTitulo.value;
              fileSystem[notaIndex].contenido = txtContenido.value;
              renderizarArbol();
              
              const iconoOriginal = btnGuardarNota.innerHTML;
              btnGuardarNota.innerHTML = '<i class="ph ph-check"></i> Guardado';
              btnGuardarNota.style.backgroundColor = '#2e3c30';
              setTimeout(() => {
                  btnGuardarNota.innerHTML = iconoOriginal;
                  btnGuardarNota.style.backgroundColor = '';
              }, 1500);
          }
      });
  }
// Botón Vault
    // 1. BOTÓN VAULT: Ahora guarda la ruta para usarla al guardar
  if (btnCrearVault) {
      btnCrearVault.addEventListener('click', async () => {
          try {
              if (window.__TAURI__ && window.__TAURI__.dialog) {
                  const rutaSeleccionada = await window.__TAURI__.dialog.open({
                      directory: true, 
                      multiple: false, 
                      title: 'Selecciona la carpeta para tu Vault de StudyTime'
                  });

                  if (rutaSeleccionada) {
                      rutaVaultFisico = rutaSeleccionada; // Guardamos la ruta en la memoria
                      
                      if (rutaArchivo) {
                          rutaArchivo.innerHTML = `<i class="ph ph-folder-open"></i> ${rutaSeleccionada}`;
                      }
                      
                      btnCrearVault.innerHTML = `<i class="ph ph-vault"></i> <span>Vault Conectado</span>`;
                      btnCrearVault.style.backgroundColor = '#3b4d3e';
                  }
              }
          } catch (error) {
              console.error("Error al abrir el Finder de Mac:", error);
          }
      });
  }

  // 2. BOTÓN GUARDAR: Ahora crea el archivo .md en tu Mac
  if (btnGuardarNota) {
      btnGuardarNota.addEventListener('click', async () => {
          const notaIndex = fileSystem.findIndex(n => n.id === notaActivaId);
          if (notaIndex !== -1 && inputTitulo && txtContenido) {
              
              // A) Actualizamos el árbol visual
              fileSystem[notaIndex].titulo = inputTitulo.value;
              fileSystem[notaIndex].contenido = txtContenido.value;
              renderizarArbol();
              
              // B) GUARDAMOS FÍSICAMENTE EN LA MAC (Si el Vault está conectado)
              if (rutaVaultFisico && window.__TAURI__ && window.__TAURI__.fs) {
                  try {
                      // Formatea el nombre (ej. "Mi Nota" -> "Mi_Nota.md")
                      const nombreArchivo = inputTitulo.value.replace(/\s+/g, '_') + ".md";
                      const rutaCompleta = `${rutaVaultFisico}/${nombreArchivo}`;

                      // Esta es la instrucción mágica que escribe en tu disco duro
                      await window.__TAURI__.fs.writeTextFile(rutaCompleta, txtContenido.value);
                      console.log("¡Archivo guardado con éxito en tu Mac!", rutaCompleta);

                  } catch (error) {
                      console.error("Error al guardar en el disco:", error);
                  }
              } else if (!rutaVaultFisico) {
                  console.warn("Vault no conectado. Haz clic en 'Abrir Vault' abajo a la izquierda primero.");
              }
              
              // Efecto visual del botón
              const iconoOriginal = btnGuardarNota.innerHTML;
              btnGuardarNota.innerHTML = '<i class="ph ph-check"></i> Guardado';
              btnGuardarNota.style.backgroundColor = '#2e3c30';
              setTimeout(() => {
                  btnGuardarNota.innerHTML = iconoOriginal;
                  btnGuardarNota.style.backgroundColor = '';
              }, 1500);
          }
      });
  }

  renderizarArbol();
  cargarNotaActual();
});
