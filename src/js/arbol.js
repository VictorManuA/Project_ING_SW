import { api } from './api.js';
import { ES_MAC, confirmar, el, icono, menuContextual, mostrarAviso } from './ui.js';

const MOSTRAR_EXTENSION = false;

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export const nombreDe = (ruta) => ruta.slice(ruta.lastIndexOf('/') + 1);
export const padreDe = (ruta) => (ruta.includes('/') ? ruta.slice(0, ruta.lastIndexOf('/')) : '');
export const unir = (padre, nombre) => (padre ? `${padre}/${nombre}` : nombre);
export const sinExtension = (nombre) => nombre.replace(/\.md$/i, '');
const conExtension = (nombre) => (/\.md$/i.test(nombre) ? nombre : `${nombre}.md`);
const esDentroDe = (ruta, carpeta) => ruta === carpeta || ruta.startsWith(`${carpeta}/`);
const crearRemap = (origen, destino) => (ruta) =>
  ruta === origen ? destino : ruta.startsWith(`${origen}/`) ? destino + ruta.slice(origen.length) : ruta;

export function crearArbol({ contenedor, obtenerVault, ganchos }) {
  let entradas = [];
  let porRuta = new Map();
  let hijos = new Map();
  let expandidas = new Set();
  let seleccion = null; // ruta seleccionada (nota o carpeta); null = nada
  let activa = null; 
  let edicion = null;
  let arrastrando = null;
  let renderizando = false;

  function comparar(a, b) {
    if (a.tipo !== b.tipo) return a.tipo === 'carpeta' ? -1 : 1;
    return collator.compare(nombreDe(a.ruta), nombreDe(b.ruta));
  }
  function indexar() {
    porRuta = new Map(entradas.map((e) => [e.ruta, e]));
    hijos = new Map();
    for (const e of entradas) {
      const padre = padreDe(e.ruta);
      if (!hijos.has(padre)) hijos.set(padre, []);
      hijos.get(padre).push(e);
    }
    for (const lista of hijos.values()) lista.sort(comparar);
  }
  function podarEstado() {
    expandidas = new Set([...expandidas].filter((r) => porRuta.get(r)?.tipo === 'carpeta'));
    if (seleccion && !porRuta.has(seleccion)) seleccion = null;
  }
  function expandirHasta(carpeta) {
    let actual = carpeta;
    while (actual) {
      expandidas.add(actual);
      actual = padreDe(actual);
    }
  }
  function filasVisibles() {
    const filas = [];
    const recorrer = (padre, nivel) => {
      if (edicion?.modo === 'nueva' && edicion.padre === padre) {
        filas.push({ tipo: 'nueva', nivel });
      }
      for (const e of hijos.get(padre) ?? []) {
        filas.push({ ...e, nivel });
        if (e.tipo === 'carpeta' && expandidas.has(e.ruta)) recorrer(e.ruta, nivel + 1);
      }
    };
    recorrer('', 0);
    return filas;
  }

  const filasNavegables = () => filasVisibles().filter((f) => f.tipo !== 'nueva');

  function carpetaDestino() {
    if (seleccion === null) return '';
    return porRuta.get(seleccion)?.tipo === 'carpeta' ? seleccion : padreDe(seleccion);
  }
  function render() {
    const previo = contenedor.querySelector('.arbol-input');
    const valorPrevio = previo ? previo.value : null;

    const filas = filasVisibles();
    const fragmento = document.createDocumentFragment();
    for (const f of filas) fragmento.appendChild(crearFila(f));
    if (!filas.length) {
      fragmento.appendChild(el('li', 'arbol-vacio', 'Esta carpeta aún no tiene notas. Crea la primera con el botón de nueva nota.'));
    }
    renderizando = true;
    contenedor.replaceChildren(fragmento);
    renderizando = false;
    const input = contenedor.querySelector('.arbol-input');
    if (input && edicion) {
      if (valorPrevio !== null) input.value = valorPrevio;
      input.focus();
      if (!edicion.iniciada) {
        input.select();
        edicion.iniciada = true;
      }
    } else {
      contenedor.querySelector('.seleccionado')?.scrollIntoView({ block: 'nearest' });
    }
  }
  function crearFila(f) {
    const li = el('li', 'arbol-fila');
    li.setAttribute('role', 'treeitem');
    li.setAttribute('aria-level', String(f.nivel + 1));
    li.style.setProperty('--nivel', f.nivel);
    if (f.tipo === 'nueva') {
      li.append(el('span', 'arbol-caret-espacio'), icono(edicion.tipo === 'carpeta' ? 'ph-folder' : 'ph-file-text', 'arbol-icono'));
      agregarInput(li);
      return li;
    }
    const esCarpeta = f.tipo === 'carpeta';
    const abierta = esCarpeta && expandidas.has(f.ruta);
    li.dataset.ruta = f.ruta;
    li.dataset.tipo = f.tipo;
    if (esCarpeta) {
      li.classList.add('es-carpeta');
      li.setAttribute('aria-expanded', String(abierta));
      if (abierta) li.classList.add('expandida');
    }
    if (f.ruta === seleccion) {
      li.classList.add('seleccionado');
      li.setAttribute('aria-selected', 'true');
    }
    if (f.ruta === activa) li.classList.add('activa');

    li.append(
      esCarpeta ? icono('ph-caret-right', 'arbol-caret') : el('span', 'arbol-caret-espacio'),
      icono(esCarpeta ? (abierta ? 'ph-folder-open' : 'ph-folder') : 'ph-file-text', 'arbol-icono'),
    );
    if (edicion?.modo === 'renombrar' && edicion.ruta === f.ruta) {
      agregarInput(li);
    } else {
      const nombre = nombreDe(f.ruta);
      const texto = esCarpeta || MOSTRAR_EXTENSION ? nombre : sinExtension(nombre);
      li.append(el('span', 'arbol-nombre', texto));
      li.title = texto;
      li.draggable = !edicion;
    }
    return li;
  }
  function agregarInput(li) {
    const sesion = edicion;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'arbol-input';
    input.value = sesion.valor;
    input.placeholder = sesion.placeholder;
    input.spellcheck = false;
    input.autocomplete = 'off';
    input.setAttribute('aria-label', sesion.etiqueta);
    const error = el('div', 'arbol-error');
    error.setAttribute('role', 'alert');
    error.hidden = true;
    li.classList.add('en-edicion');
    li.append(input, error);
    let terminada = false;
    const cancelar = () => {
      if (terminada) return;
      terminada = true;
      edicion = null;
      render();
      contenedor.focus({ preventScroll: true });
    };
    const aceptar = async () => {
      if (terminada) return;
      const valor = input.value.trim();
      if (!valor || (sesion.modo === 'renombrar' && valor === sesion.original)) return cancelar();
      terminada = true;
      try {
        if (sesion.modo === 'nueva') await crearEntrada(sesion, valor);
        else await mover(sesion.ruta, unir(padreDe(sesion.ruta), sesion.tipo === 'nota' ? conExtension(valor) : valor));
        contenedor.focus({ preventScroll: true });
      } catch (e) {
        terminada = false; // el nombre no sirvio
        li.classList.add('con-error');
        error.textContent = e.message;
        error.hidden = false;
        input.focus();
      }
    };
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        aceptar();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelar();
      }
    });
    input.addEventListener('input', () => {
      li.classList.remove('con-error');
      error.hidden = true;
    });
    input.addEventListener('blur', () => {
      if (!input.isConnected || renderizando || terminada) return;
      if (li.classList.contains('con-error')) cancelar();
      else aceptar();
    });
  }
  function iniciarNuevo(tipo, padre = carpetaDestino()) {
    if (!obtenerVault()) return;
    expandirHasta(padre);
    edicion = {
      modo: 'nueva',
      tipo,
      padre,
      valor: '',
      placeholder: tipo === 'nota' ? 'Nombre de la nota' : 'Nombre de la carpeta',
      etiqueta: tipo === 'nota' ? 'Nombre de la nueva nota' : 'Nombre de la nueva carpeta',
    };
    render();
  }
  function iniciarRenombre(ruta) {
    const entrada = porRuta.get(ruta);
    if (!entrada) return;
    const tipo = entrada.tipo === 'carpeta' ? 'carpeta' : 'nota';
    const original = tipo === 'nota' ? sinExtension(nombreDe(ruta)) : nombreDe(ruta);
    seleccion = ruta;
    edicion = {
      modo: 'renombrar',
      tipo,
      ruta,
      original,
      valor: original,
      placeholder: '',
      etiqueta: `Nuevo nombre de ${original}`,
    };
    render();
  }
  async function crearEntrada(sesion, nombre) {
    const ruta = unir(sesion.padre, sesion.tipo === 'nota' ? conExtension(nombre) : nombre);
    await api.crear(obtenerVault(), ruta, sesion.tipo === 'carpeta');
    edicion = null;
    seleccion = ruta;
    if (sesion.tipo === 'carpeta') expandidas.add(ruta);
    await refrescar();
    ganchos.alCambiarExpandidas?.(expandidas);
    if (sesion.tipo === 'nota') ganchos.abrirNota(ruta);
  }
  async function mover(origen, destino) {
    if (origen === destino) return;
    await ganchos.antes?.(); 
    let remap = (r) => r;
    try {
      await api.mover(obtenerVault(), origen, destino);
      remap = crearRemap(origen, destino);
      edicion = null;
      expandidas = new Set([...expandidas].map(remap));
      expandirHasta(padreDe(destino));
      seleccion = destino;
      if (activa) activa = remap(activa);
    } finally {
      ganchos.despues?.({ remap });
    }
    await refrescar();
    ganchos.alCambiarExpandidas?.(expandidas);
  }
  async function eliminar(ruta) {
    const entrada = porRuta.get(ruta);
    if (!entrada) return;
    const esCarpeta = entrada.tipo === 'carpeta';
    const nombre = esCarpeta ? nombreDe(ruta) : sinExtension(nombreDe(ruta));
    const confirmado = await confirmar({
      titulo: esCarpeta ? 'Eliminar carpeta' : 'Eliminar nota',
      mensaje: `«${nombre}» se moverá a la papelera${esCarpeta ? ' junto con todo su contenido' : ''}. Podrás recuperarla desde ahí.`,
      textoAceptar: 'Eliminar',
      peligro: true,
    });
    if (!confirmado) return;
    await ganchos.antes?.();
    let eliminada = null;
    try {
      await api.eliminar(obtenerVault(), ruta);
      eliminada = ruta;
      if (seleccion && esDentroDe(seleccion, ruta)) seleccion = padreDe(ruta) || null;
      if (activa && esDentroDe(activa, ruta)) activa = null;
      expandidas = new Set([...expandidas].filter((r) => !esDentroDe(r, ruta)));
    } catch (e) {
      mostrarAviso(e.message, 'error');
    }
    ganchos.despues?.({ eliminada });
    await refrescar();
    ganchos.alCambiarExpandidas?.(expandidas);
  }
  async function refrescar() {
    const vault = obtenerVault();
    if (!vault) return false;
    try {
      entradas = await api.escanearVault(vault);
    } catch (e) {
      ganchos.errorEscaneo?.(e);
      return false;
    }
    indexar();
    podarEstado();
    render();
    return true;
  }
  function alternarCarpeta(ruta) {
    if (expandidas.has(ruta)) expandidas.delete(ruta);
    else expandidas.add(ruta);
    render();
    ganchos.alCambiarExpandidas?.(expandidas);
  }
  function activar(fila) {
    if (fila.tipo === 'carpeta') alternarCarpeta(fila.ruta);
    else ganchos.abrirNota(fila.ruta);
  }
  function seleccionarRuta(ruta) {
    seleccion = ruta ?? null;
    render();
  }
  contenedor.addEventListener('click', (e) => {
    if (e.target.closest('.arbol-input')) return;
    const fila = e.target.closest('.arbol-fila[data-ruta]');
    if (!fila) {
      seleccionarRuta(null);
      return;
    }
    const ruta = fila.dataset.ruta;
    seleccion = ruta;
    if (fila.dataset.tipo === 'carpeta') {
      alternarCarpeta(ruta);
    } else {
      render();
      ganchos.abrirNota(ruta);
    }
  });
  contenedor.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!obtenerVault() || e.target.closest('.arbol-input')) return;
    const fila = e.target.closest('.arbol-fila[data-ruta]');
    const opciones = [];
    if (fila) {
      const ruta = fila.dataset.ruta;
      seleccionarRuta(ruta);
      if (fila.dataset.tipo === 'carpeta') {
        opciones.push(
          { texto: 'Nueva nota', accion: () => iniciarNuevo('nota', ruta) },
          { texto: 'Nueva carpeta', accion: () => iniciarNuevo('carpeta', ruta) },
          'separador',
        );
      }
      opciones.push(
        { texto: 'Renombrar', atajo: ES_MAC ? '↵' : 'F2', accion: () => iniciarRenombre(ruta) },
        { texto: 'Eliminar', atajo: ES_MAC ? '⌘⌫' : 'Supr', peligro: true, accion: () => eliminar(ruta) },
      );
    } else {
      seleccionarRuta(null);
      opciones.push(
        { texto: 'Nueva nota', accion: () => iniciarNuevo('nota', '') },
        { texto: 'Nueva carpeta', accion: () => iniciarNuevo('carpeta', '') },
      );
    }
    menuContextual(e.clientX, e.clientY, opciones);
  });
  contenedor.addEventListener('keydown', (e) => {
    if (e.target !== contenedor || edicion) return;
    const filas = filasNavegables();
    const i = filas.findIndex((f) => f.ruta === seleccion);
    const actual = i >= 0 ? filas[i] : null;
    let manejada = true;

    switch (e.key) {
      case 'ArrowDown':
        if (ES_MAC && e.metaKey) {
          if (actual) activar(actual);
        } else {
          seleccionarRuta(filas[Math.min(i + 1, filas.length - 1)]?.ruta);
        }
        break;
      case 'ArrowUp':
        seleccionarRuta(filas[Math.max(i - 1, 0)]?.ruta);
        break;
      case 'ArrowRight':
        if (actual?.tipo === 'carpeta') {
          if (!expandidas.has(actual.ruta)) alternarCarpeta(actual.ruta);
          else if (hijos.get(actual.ruta)?.length) seleccionarRuta(hijos.get(actual.ruta)[0].ruta);
        }
        break;
      case 'ArrowLeft':
        if (actual?.tipo === 'carpeta' && expandidas.has(actual.ruta)) alternarCarpeta(actual.ruta);
        else if (actual && padreDe(actual.ruta)) seleccionarRuta(padreDe(actual.ruta));
        break;
      case 'Enter':
        if (!actual) break;
        if (ES_MAC) iniciarRenombre(actual.ruta);
        else activar(actual);
        break;
      case ' ':
        if (actual) activar(actual);
        break;
      case 'F2':
        if (actual) iniciarRenombre(actual.ruta);
        break;
      case 'Delete':
        if (actual) eliminar(actual.ruta);
        break;
      case 'Backspace':
        if (ES_MAC && e.metaKey && actual) eliminar(actual.ruta);
        else manejada = false;
        break;
      default:
        manejada = false;
    }
    if (manejada) e.preventDefault();
  });
  function carpetaDeSoltar(objetivo) {
    const fila = objetivo.closest?.('.arbol-fila[data-ruta]');
    if (!fila) return '';
    return fila.dataset.tipo === 'carpeta' ? fila.dataset.ruta : padreDe(fila.dataset.ruta);
  }
  function puedeSoltar(origen, carpeta) {
    return carpeta !== padreDe(origen) && !esDentroDe(carpeta, origen);
  }
  function limpiarMarcasDrop() {
    contenedor.classList.remove('destino-drop-raiz');
    contenedor.querySelectorAll('.destino-drop').forEach((n) => n.classList.remove('destino-drop'));
  }

  contenedor.addEventListener('dragstart', (e) => {
    const fila = e.target.closest?.('.arbol-fila[data-ruta]');
    if (!fila || edicion) {
      e.preventDefault();
      return;
    }
    arrastrando = fila.dataset.ruta;
    e.dataTransfer.setData('text/plain', arrastrando);
    e.dataTransfer.effectAllowed = 'move';
    fila.classList.add('arrastrando');
  });
  contenedor.addEventListener('dragover', (e) => {
    if (!arrastrando) return;
    const carpeta = carpetaDeSoltar(e.target);
    limpiarMarcasDrop();
    if (!puedeSoltar(arrastrando, carpeta)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (carpeta === '') {
      contenedor.classList.add('destino-drop-raiz');
    } else {
      [...contenedor.children].find((n) => n.dataset?.ruta === carpeta)?.classList.add('destino-drop');
    }
  });
  contenedor.addEventListener('dragleave', (e) => {
    if (!contenedor.contains(e.relatedTarget)) limpiarMarcasDrop();
  });
  contenedor.addEventListener('drop', async (e) => {
    if (!arrastrando) return;
    e.preventDefault();
    const origen = arrastrando;
    const carpeta = carpetaDeSoltar(e.target);
    arrastrando = null;
    limpiarMarcasDrop();
    if (!puedeSoltar(origen, carpeta)) return;
    try {
      await mover(origen, unir(carpeta, nombreDe(origen)));
    } catch (error) {
      mostrarAviso(error.message, 'error');
    }
  });

  contenedor.addEventListener('dragend', () => {
    arrastrando = null;
    limpiarMarcasDrop();
    contenedor.querySelectorAll('.arrastrando').forEach((n) => n.classList.remove('arrastrando'));
  });
  return {
    cargar(nuevas, expandidasIniciales = []) {
      entradas = nuevas;
      expandidas = new Set(expandidasIniciales);
      seleccion = null;
      activa = null;
      edicion = null;
      indexar();
      podarEstado();
      render();
    },
    limpiar() {
      entradas = [];
      expandidas = new Set();
      seleccion = null;
      activa = null;
      edicion = null;
      indexar();
      contenedor.replaceChildren();
    },
    refrescar,
    iniciarNuevo,
    marcarActiva(ruta) {
      activa = ruta;
      if (ruta) {
        seleccion = ruta;
        expandirHasta(padreDe(ruta));
        ganchos.alCambiarExpandidas?.(expandidas);
      }
      render();
    },
    /** Renombra una nota*/
    async renombrarDesdeTitulo(ruta, nombre) {
      try {
        await mover(ruta, unir(padreDe(ruta), conExtension(nombre)));
        return true;
      } catch (e) {
        mostrarAviso(e.message, 'error');
        return false;
      }
    },
    contiene: (ruta) => porRuta.has(ruta),
    estaEditando: () => edicion !== null,
    enfocar: () => contenedor.focus(),
  };
}