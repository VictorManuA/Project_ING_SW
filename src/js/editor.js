import { ES_MAC } from './ui.js';

const MS_AUTOGUARDADO = 700;
const MS_VISTA_PREVIA = 120;
const ANCHO_PARA_APILAR = 680;

const nombreSinExtension = (ruta) => ruta.slice(ruta.lastIndexOf('/') + 1).replace(/\.md$/i, '');

const TEXTOS_ESTADO = {
  guardado: 'Guardado',
  guardando: 'Guardando…',
  sinGuardar: 'Sin guardar',
  error: 'Error al guardar',
};
export function crearEditor({ guardar, renombrarTitulo, etiquetaRuta }) {
  const $ = (id) => document.getElementById(id);
  const txt = $('nota-contenido');
  const previa = $('nota-preview');
  const titulo = $('nota-titulo');
  const area = $('area-trabajo-nota');
  const rutaEl = $('ruta-archivo');
  const palabrasEl = $('contador-palabras');
  const estadoEl = $('estado-guardado');
  const vacio = $('editor-vacio');
  const contenido = $('editor-contenido');
  let ruta = null;
  let sucio = false; 
  let congelado = false; 
  let tGuardar = null;
  let tPrevia = null;
  let guardando = Promise.resolve(true);
  function mostrarEstado(estado, detalle = '') {
    estadoEl.dataset.estado = estado;
    estadoEl.textContent = TEXTOS_ESTADO[estado];
    estadoEl.title = detalle;
  }
  function actualizarConteo() {
    const texto = txt.value.trim();
    const n = texto === '' ? 0 : texto.split(/\s+/).length;
    palabrasEl.textContent = `${n} ${n === 1 ? 'palabra' : 'palabras'}`;
  }
  function actualizarRuta() {
    rutaEl.textContent = ruta ? etiquetaRuta(ruta) : '';
    rutaEl.title = rutaEl.textContent;
  }
  function renderPrevia() {
    const origen = txt.value;
    const posicion = previa.scrollTop;
    if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
      previa.textContent = origen;
      return;
    }
    try {
      const html = marked.parse(origen, { gfm: true, breaks: true });
      previa.innerHTML = DOMPurify.sanitize(html, {
        FORBID_TAGS: ['style', 'form', 'textarea', 'select', 'button', 'iframe', 'object', 'embed'],
        FORBID_ATTR: ['style'],
      });
    } catch (error) {
      console.error('No se pudo renderizar la vista previa:', error);
      previa.textContent = origen;
    }
    previa.scrollTop = posicion;
  }
  function programarPrevia() {
    clearTimeout(tPrevia);
    tPrevia = setTimeout(renderPrevia, MS_VISTA_PREVIA);
  }
  previa.addEventListener('click', (e) => {
    const enlace = e.target.closest('a[href]');
    if (!enlace) return;
    e.preventDefault();
    const url = enlace.getAttribute('href');
    if (/^https?:\/\//i.test(url)) {
      const abierto = window.__TAURI__?.opener?.openUrl?.(url);
      abierto?.catch?.(() => {});
    }
  });
  function programarGuardado() {
    clearTimeout(tGuardar);
    tGuardar = setTimeout(guardarAhora, MS_AUTOGUARDADO);
  }
  async function guardarAhora() {
    clearTimeout(tGuardar);
    tGuardar = null;
    await guardando;
    if (!ruta || !sucio) return true;
    const rutaGuardada = ruta;
    const textoGuardado = txt.value;
    mostrarEstado('guardando');
    const tarea = (async () => {
      try {
        await guardar(rutaGuardada, textoGuardado);
        if (ruta === rutaGuardada) {
          if (txt.value === textoGuardado) {
            sucio = false;
            mostrarEstado('guardado');
          } else {
            mostrarEstado('sinGuardar'); // se  escribiendo mientras guardaba
            if (!congelado) programarGuardado();
          }
        }
        return true;
      } catch (error) {
        if (ruta === rutaGuardada) mostrarEstado('error', error.message);
        return false;
      }
    })();
    guardando = tarea;
    return tarea;
  }
  async function congelar() {
    congelado = true;
    return guardarAhora();
  }
  function descongelar(nuevaRuta) {
    congelado = false;
    if (nuevaRuta) {
      ruta = nuevaRuta;
      titulo.value = nombreSinExtension(nuevaRuta);
      actualizarRuta();
    }
    if (sucio && ruta) programarGuardado();
  }
  function abrir(nuevaRuta, texto) {
    clearTimeout(tGuardar);
    ruta = nuevaRuta;
    sucio = false;
    congelado = false;
    txt.value = texto;
    titulo.value = nombreSinExtension(nuevaRuta);
    contenido.classList.remove('oculta');
    vacio.classList.add('oculta');
    actualizarRuta();
    actualizarConteo();
    renderPrevia();
    mostrarEstado('guardado');
    txt.scrollTop = 0;
    previa.scrollTop = 0;
  }
  function cerrar() {
    clearTimeout(tGuardar);
    clearTimeout(tPrevia);
    ruta = null;
    sucio = false;
    congelado = false;
    txt.value = '';
    previa.replaceChildren();
    contenido.classList.add('oculta');
    vacio.classList.remove('oculta');
  }

  function enfocar() {
    txt.focus();
  }
  txt.addEventListener('input', () => {
    if (!ruta) return;
    sucio = true;
    mostrarEstado('sinGuardar');
    actualizarConteo();
    programarPrevia();
    if (!congelado) programarGuardado();
  });
  function insertar(texto) {
    txt.focus();
    if (!document.execCommand?.('insertText', false, texto)) {
      txt.setRangeText(texto, txt.selectionStart, txt.selectionEnd, 'end');
      txt.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  function envolverSeleccion(marca) {
    const { selectionStart: a, selectionEnd: b, value } = txt;
    insertar(marca + value.slice(a, b) + marca);
    if (a === b) txt.setSelectionRange(a + marca.length, a + marca.length);
  }
  let liberarTab = false; 
  txt.addEventListener('keydown', (e) => {
    const mod = ES_MAC ? e.metaKey : e.ctrlKey;
    if (e.key === 'Escape') {
      liberarTab = true;
      return;
    }
    if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (liberarTab) return;
      e.preventDefault();
      insertar('  ');
    } else if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      envolverSeleccion('**');
    } else if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      envolverSeleccion('*');
    }
    liberarTab = false;
  });
  txt.addEventListener('blur', () => {
    liberarTab = false;
    guardarAhora();
  });

  titulo.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      titulo.blur();
    } else if (e.key === 'Escape') {
      titulo.value = ruta ? nombreSinExtension(ruta) : '';
      titulo.blur();
    }
  });
  titulo.addEventListener('blur', async () => {
    if (!ruta) return;
    const nuevo = titulo.value.trim();
    if (nuevo === '' || nuevo === nombreSinExtension(ruta)) {
      titulo.value = nombreSinExtension(ruta);
      return;
    }
    const ok = await renombrarTitulo(nuevo);
    if (!ok && ruta) titulo.value = nombreSinExtension(ruta);
  });
  let origenScroll = null;
  let tScroll = null;
  function sincronizar(desde, hacia, quien) {
    if (origenScroll && origenScroll !== quien) return;
    origenScroll = quien;
    const maxDesde = desde.scrollHeight - desde.clientHeight;
    const maxHacia = hacia.scrollHeight - hacia.clientHeight;
    hacia.scrollTop = maxDesde > 0 ? (desde.scrollTop / maxDesde) * maxHacia : 0;
    clearTimeout(tScroll);
    tScroll = setTimeout(() => (origenScroll = null), 80);
  }
  txt.addEventListener('scroll', () => sincronizar(txt, previa, 'editor'));
  previa.addEventListener('scroll', () => sincronizar(previa, txt, 'previa'));

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(([entrada]) => {
      area.classList.toggle('apilado', entrada.contentRect.width < ANCHO_PARA_APILAR);
    }).observe(area);
  }
  return {
    abrir,
    cerrar,
    enfocar,
    guardarAhora,
    congelar,
    descongelar,
    obtenerRuta: () => ruta,
  };
}
