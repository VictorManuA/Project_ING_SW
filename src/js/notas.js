import { api, hayTauri } from './api.js';
import { guardarConfig, guardarConfigYa, seccion } from './config.js';
import { crearArbol } from './arbol.js';
import { crearEditor } from './editor.js';
import { confirmar, el, icono, mostrarAviso, ES_MAC } from './ui.js';

const $ = (id) => document.getElementById(id);
const MAX_RECIENTES = 8;
const ANCHO_PANEL_MIN = 18;
const ANCHO_PANEL_MAX = 45;

let vault = null; 
let notaActiva = null; 
let turnoApertura = 0; 
let arbol;
let editor;

const nombreVault = (ruta) => ruta.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || ruta;
const vistaNotasActiva = () => !$('vista-Notas').classList.contains('oculta');

// Persistencia
function guardarEstadoVault(parcial) {
  if (!vault) return;
  const c = seccion('notas');
  c.porVault ??= {};
  c.porVault[vault] = { ...(c.porVault[vault] ?? {}), ...parcial };
  guardarConfig();
}
function mostrarEstadoVault(modo, ruta) {
  const panel = $('panel-archivos');
  panel.dataset.estado = modo;

  const normal = modo === 'normal';
  ['btn-nueva-nota', 'btn-nueva-carpeta', 'btn-refrescar'].forEach((id) => ($(id).disabled = !normal));
  $('vault-estado').classList.toggle('oculta', normal);
  $('lista-archivos').classList.toggle('oculta', !normal);

  $('vault-nombre').textContent = vault ? nombreVault(vault) : 'Elegir carpeta';
  $('btn-crear-vault').title = vault ?? 'Elegir la carpeta de tus notas';

  const titulo = $('vault-estado-titulo');
  const texto = $('vault-estado-texto');
  const acciones = $('vault-estado-acciones');
  acciones.replaceChildren();

  const boton = (etiqueta, clase, accion) => {
    const b = el('button', clase, etiqueta);
    b.type = 'button';
    b.addEventListener('click', accion);
    acciones.appendChild(b);
  };

  if (modo === 'sin-vault') {
    titulo.textContent = 'Elige la carpeta de tus notas';
    texto.textContent = 'Study.Time guarda cada nota como un archivo Markdown dentro de la carpeta que elijas. Puedes cambiarla cuando quieras.';
    boton('Abrir carpeta', 'btn-primario', elegirCarpetaVault);
  } else if (modo === 'no-disponible') {
    titulo.textContent = 'No encontramos tu carpeta';
    texto.textContent = `«${nombreVault(ruta)}» ya no está en ${ruta}. ¿La moviste, la renombraste o está en una unidad desconectada?`;
    boton('Reintentar', 'btn-primario', () => abrirVault(ruta, { inicio: true }));
    boton('Elegir otra carpeta', 'btn-secundario', elegirCarpetaVault);
  } else if (modo === 'sin-tauri') {
    titulo.textContent = 'Solo disponible en la app';
    texto.textContent = 'Las notas necesitan acceso a tus archivos. Abre Study.Time desde la app de escritorio (tauri dev), no desde un navegador.';
  }
  actualizarVacio();
}
//ERROR
function actualizarVacio() {
  const modo = $('panel-archivos').dataset.estado;
  const texto = $('editor-vacio-texto');
  const boton = $('btn-vacio-accion');
  boton.classList.add('oculta');
  boton.onclick = null;

  if (modo === 'normal') {
    texto.textContent = 'Selecciona una nota del árbol o crea una nueva.';
    boton.textContent = 'Nueva nota';
    boton.onclick = () => arbol.iniciarNuevo('nota');
    boton.classList.remove('oculta');
  } else if (modo === 'sin-vault') {
    texto.textContent = 'Elige una carpeta para empezar a escribir.';
    boton.textContent = 'Abrir carpeta';
    boton.onclick = elegirCarpetaVault;
    boton.classList.remove('oculta');
  } else if (modo === 'no-disponible') {
    texto.textContent = 'Tu carpeta de notas no está disponible.';
  } else {
    texto.textContent = 'Abre la app de escritorio para usar tus notas.';
  }
}

function actualizarPerfil() {
  const ruta = $('perfil-ruta');
  if (ruta) ruta.textContent = vault ?? 'Sin carpeta seleccionada';
}
async function elegirCarpetaVault() {
  try {
    const ruta = await api.elegirCarpeta(vault);
    if (ruta) await abrirVault(ruta);
  } catch (error) {
    mostrarAviso(error.message, 'error');
  }
}
async function abrirVault(ruta, { inicio = false } = {}) {
  if (!inicio && !(await guardarNotaActual())) return false;

  let entradas;
  try {
    entradas = await api.escanearVault(ruta);
  } catch (error) {
    if (inicio) mostrarEstadoVault('no-disponible', ruta);
    else mostrarAviso(error.message, 'error');
    return false;
  }

  editor.cerrar();
  notaActiva = null;
  vault = ruta;

  const c = seccion('notas');
  c.vaultPath = ruta;
  c.recientes = [ruta, ...(c.recientes ?? []).filter((r) => r !== ruta)].slice(0, MAX_RECIENTES);
  c.porVault ??= {};
  const recordado = c.porVault[ruta] ?? {};

  mostrarEstadoVault('normal');
  arbol.cargar(entradas, recordado.expandidas ?? []);
  actualizarPerfil();
  guardarConfig();

  if (recordado.ultimaNota && arbol.contiene(recordado.ultimaNota)) {
    await abrirNota(recordado.ultimaNota);
  }
  return true;
}
function vaultPerdido() {
  const ruta = vault;
  editor.cerrar();
  notaActiva = null;
  vault = null;
  arbol.limpiar();
  mostrarEstadoVault('no-disponible', ruta);
  actualizarPerfil();
}

function quitarReciente(ruta) {
  const c = seccion('notas');
  c.recientes = (c.recientes ?? []).filter((r) => r !== ruta);
  if (c.porVault) delete c.porVault[ruta];
  guardarConfig();
}
function construirMenuVault() {
  const menu = $('menu-vault');
  menu.replaceChildren();
  menu.appendChild(el('div', 'menu-titulo', 'Carpetas recientes'));

  const recientes = seccion('notas').recientes ?? [];
  if (!recientes.length) menu.appendChild(el('div', 'menu-vacio', 'Aún no has abierto ninguna carpeta'));

  for (const ruta of recientes) {
    const fila = el('div', `menu-reciente${ruta === vault ? ' actual' : ''}`);
    const abrir = el('button', 'menu-item menu-reciente-abrir');
    abrir.type = 'button';
    abrir.title = ruta;
    abrir.append(el('span', 'menu-reciente-nombre', nombreVault(ruta)), el('span', 'menu-reciente-ruta', ruta));
    abrir.addEventListener('click', () => {
      cerrarMenuVault();
      if (ruta !== vault) abrirVault(ruta);
    });

    const quitar = el('button', 'menu-reciente-quitar');
    quitar.type = 'button';
    quitar.title = 'Quitar de la lista';
    quitar.setAttribute('aria-label', `Quitar ${nombreVault(ruta)} de la lista`);
    quitar.appendChild(icono('ph-x'));
    quitar.addEventListener('click', (e) => {
      e.stopPropagation();
      quitarReciente(ruta);
      construirMenuVault();
    });

    fila.append(abrir, quitar);
    menu.appendChild(fila);
  }

  menu.appendChild(el('div', 'menu-separador'));
  const otra = el('button', 'menu-item');
  otra.type = 'button';
  otra.append(icono('ph-folder-open'), el('span', 'menu-item-texto', 'Abrir otra carpeta…'));
  otra.addEventListener('click', () => {
    cerrarMenuVault();
    elegirCarpetaVault();
  });
  menu.appendChild(otra);
}
function fueraDelMenu(e) {
  if (!$('menu-vault').contains(e.target) && !$('btn-crear-vault').contains(e.target)) cerrarMenuVault();
}
function teclasMenu(e) {
  if (e.key === 'Escape') {
    cerrarMenuVault();
    $('btn-crear-vault').focus();
  }
}
function abrirMenuVault() {
  construirMenuVault();
  $('menu-vault').classList.remove('oculta');
  $('btn-crear-vault').setAttribute('aria-expanded', 'true');
  document.addEventListener('pointerdown', fueraDelMenu, true);
  document.addEventListener('keydown', teclasMenu, true);
}
function cerrarMenuVault() {
  $('menu-vault').classList.add('oculta');
  $('btn-crear-vault').setAttribute('aria-expanded', 'false');
  document.removeEventListener('pointerdown', fueraDelMenu, true);
  document.removeEventListener('keydown', teclasMenu, true);
}
// Notas
async function guardarNotaActual() {
  if (await editor.guardarAhora()) return true;
  return confirmar({
    titulo: 'No se pudo guardar la nota',
    mensaje: 'Si continúas, se perderán los últimos cambios de la nota abierta.',
    textoAceptar: 'Descartar cambios',
    peligro: true,
  });
}
async function abrirNota(ruta) {
  if (!vault || ruta === notaActiva) {
    arbol.marcarActiva(ruta);
    return;
  }
  const turno = ++turnoApertura;
  if (!(await guardarNotaActual())) return;

  let texto;
  try {
    texto = await api.leerNota(vault, ruta);
  } catch (error) {
    mostrarAviso(error.message, 'error');
    arbol.refrescar();
    return;
  }
  if (turno !== turnoApertura) return; // el usuario ya abrió otra nota

  notaActiva = ruta;
  editor.abrir(ruta, texto);
  arbol.marcarActiva(ruta);
  guardarEstadoVault({ ultimaNota: ruta });
}
function aplicarAnchoPanel(porcentaje) {
  const n = Number(porcentaje);
  if (!Number.isFinite(n)) return;
  $('panel-archivos').style.width = `${Math.min(ANCHO_PANEL_MAX, Math.max(ANCHO_PANEL_MIN, n))}%`;
}

function iniciarDivisor() {
  const divisor = $('divisor-notas');
  const contenedor = document.querySelector('#vista-Notas .contenedor-notas-split');
  let porcentaje = null;

  const fijar = (valor) => {
    porcentaje = Math.min(ANCHO_PANEL_MAX, Math.max(ANCHO_PANEL_MIN, valor));
    aplicarAnchoPanel(porcentaje);
  };
  const terminar = (e) => {
    if (!divisor.hasPointerCapture?.(e.pointerId)) return;
    divisor.releasePointerCapture(e.pointerId);
    divisor.classList.remove('arrastrando');
    document.body.style.removeProperty('user-select');
    document.body.style.removeProperty('cursor');
    if (porcentaje !== null) {
      seccion('notas').anchoPanel = Math.round(porcentaje * 10) / 10;
      guardarConfig();
    }
  };
  divisor.addEventListener('pointerdown', (e) => {
    divisor.setPointerCapture(e.pointerId);
    divisor.classList.add('arrastrando');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  });
  divisor.addEventListener('pointermove', (e) => {
    if (!divisor.hasPointerCapture?.(e.pointerId)) return;
    const caja = contenedor.getBoundingClientRect();
    fijar(((e.clientX - caja.left) / caja.width) * 100);
  });
  divisor.addEventListener('pointerup', terminar);
  divisor.addEventListener('pointercancel', terminar);
  divisor.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const actual = parseFloat($('panel-archivos').style.width) || 30;
    fijar(actual + (e.key === 'ArrowRight' ? 2 : -2));
    seccion('notas').anchoPanel = porcentaje;
    guardarConfig();
  });
}
export async function iniciarNotas() {
  editor = crearEditor({
    guardar: async (ruta, texto) => {
      await api.escribirNota(vault, ruta, texto);
      if (!arbol.contiene(ruta)) arbol.refrescar(); 
    },
    renombrarTitulo: (nombre) => arbol.renombrarDesdeTitulo(notaActiva, nombre),
    etiquetaRuta: (ruta) => `${nombreVault(vault ?? '')}/${ruta}`,
  });

  arbol = crearArbol({
    contenedor: $('lista-archivos'),
    obtenerVault: () => vault,
    ganchos: {
      abrirNota,
      antes: () => editor.congelar(),
      despues: ({ remap, eliminada } = {}) => {
        if (notaActiva && eliminada && (notaActiva === eliminada || notaActiva.startsWith(`${eliminada}/`))) {
          notaActiva = null;
          editor.cerrar();
          guardarEstadoVault({ ultimaNota: null });
          return;
        }
        if (notaActiva && remap) {
          notaActiva = remap(notaActiva);
          guardarEstadoVault({ ultimaNota: notaActiva });
        }
        editor.descongelar(notaActiva);
      },
      alCambiarExpandidas: (conjunto) => guardarEstadoVault({ expandidas: [...conjunto] }),
      errorEscaneo: (error) => {
        if (error.message.includes('No se encontró la carpeta del vault')) vaultPerdido();
        else mostrarAviso(error.message, 'error');
      },
    },
  });
  //botones
  $('btn-nueva-nota').addEventListener('click', () => arbol.iniciarNuevo('nota'));
  $('btn-nueva-carpeta').addEventListener('click', () => arbol.iniciarNuevo('carpeta'));
  $('btn-refrescar').addEventListener('click', () => arbol.refrescar());
  $('btn-crear-vault').addEventListener('click', () => {
    if ($('menu-vault').classList.contains('oculta')) abrirMenuVault();
    else cerrarMenuVault();
  });
  $('btn-perfil-ruta')?.addEventListener('click', elegirCarpetaVault);
  iniciarDivisor();
  document.addEventListener('keydown', (e) => {
    if (!vistaNotasActiva()) return;
    if ((ES_MAC ? e.metaKey : e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      editor.guardarAhora();
    }
  });
  window.addEventListener('blur', () => editor.guardarAhora());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) editor.guardarAhora();
  });
  window.addEventListener('beforeunload', () => {
    editor.guardarAhora();
    guardarConfigYa();
  });
  window.addEventListener('focus', () => {
    if (vault && vistaNotasActiva() && !arbol.estaEditando()) arbol.refrescar();
  });
  if (!hayTauri) {
    mostrarEstadoVault('sin-tauri');
    return;
  }
  const c = seccion('notas');
  if (c.anchoPanel !== undefined) aplicarAnchoPanel(c.anchoPanel);
  if (c.vaultPath) await abrirVault(c.vaultPath, { inicio: true });
  else mostrarEstadoVault('sin-vault');
  actualizarPerfil();
}
export function alMostrarNotas() {
  if (vault && !arbol.estaEditando()) arbol.refrescar();
}