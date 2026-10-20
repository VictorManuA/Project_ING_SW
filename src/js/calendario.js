import { api, hayTauri } from './api.js';
import { confirmar, el, icono, mostrarAviso } from './ui.js';
import {
  claveFecha,
  crearIdActividad,
  fechaLocal,
  inicioDelDia,
  lunesDeSemana,
  ocurrenciasPorDia,
  rangoVisibleMes,
  sumarDias,
  validarActividad,
  valorFechaHora,
} from './calendario-modelo.js';

const $ = (id) => document.getElementById(id);
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const NOMBRES_TIPO = { clase: 'Clase', tarea: 'Tarea', examen: 'Examen', descanso: 'Descanso' };

let calendario = { version: 1, actividades: [] };
let vista = 'dia';
let fechaFoco = new Date();
let iniciado = false;
let guardado = Promise.resolve();

function formatearHora(fecha) {
  return new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' }).format(fecha);
}

function tituloPeriodo() {
  if (vista === 'dia') {
    const texto = new Intl.DateTimeFormat('es-MX', {
      weekday: 'long', day: 'numeric', month: 'long',
    }).format(fechaFoco);
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }
  if (vista === 'mes') {
    const texto = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(fechaFoco);
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }
  const inicio = lunesDeSemana(fechaFoco);
  const fin = sumarDias(inicio, 6);
  const a = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(inicio);
  const b = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(fin);
  return `${a} – ${b}`;
}

function ocurrenciasUnicas(mapa) {
  const unicas = new Map();
  for (const actividades of mapa.values()) {
    for (const actividad of actividades) {
      const clave = `${actividad.id}:${actividad.inicioOcurrencia.getTime()}`;
      if (!unicas.has(clave)) unicas.set(clave, actividad);
    }
  }
  return [...unicas.values()].sort((a, b) => a.inicioOcurrencia - b.inicioOcurrencia);
}

function referenciaDelPeriodo(inicio, fin) {
  const ahora = new Date();
  return ahora >= inicio && ahora < fin ? ahora : inicio;
}

function renderProximaActividad(actividades = [], referencia = new Date()) {
  const boton = $('cal-proxima');
  const siguiente = actividades.find((actividad) => {
    if (actividad.completada) return false;
    if (actividad.todoElDia) {
      return inicioDelDia(actividad.finOcurrencia) >= inicioDelDia(referencia);
    }
    if (actividad.inicioOcurrencia.getTime() === actividad.finOcurrencia.getTime()) {
      return actividad.inicioOcurrencia >= referencia;
    }
    return actividad.finOcurrencia > referencia;
  });
  $('cal-proxima-titulo').textContent = siguiente?.titulo ?? 'Sin actividades próximas';
  $('cal-proxima-hora').textContent = siguiente
    ? (siguiente.todoElDia ? 'Todo el día' : formatearHora(siguiente.inicioOcurrencia))
    : 'Pulsa + para agregar una';
  boton.classList.toggle('vacia', !siguiente);
  boton.dataset.id = siguiente?.id ?? '';
}

function renderDia() {
  const contenido = $('calendario-contenido');
  const inicio = inicioDelDia(fechaFoco);
  const fin = sumarDias(inicio, 1);
  const actividades = ocurrenciasPorDia(calendario.actividades, inicio, fin).get(claveFecha(inicio)) ?? [];
  const agenda = el('div', 'cal-agenda');

  if (!actividades.length) {
    const vacio = el('button', 'cal-agenda-vacia');
    vacio.type = 'button';
    vacio.append(
      icono('ph-pencil-line'),
      el('strong', '', 'Tu horario está libre'),
      el('span', '', 'Agrega una clase, tarea o descanso para comenzar.'),
    );
    vacio.addEventListener('click', () => abrirFormulario(null, inicio));
    agenda.appendChild(vacio);
  } else {
    actividades.forEach((actividad) => {
      const fila = el('button', `cal-agenda-fila cal-tipo-${actividad.tipo} prioridad-${actividad.prioridad}`);
      fila.type = 'button';
      fila.dataset.id = actividad.id;
      const hora = el('span', 'cal-agenda-hora', actividad.todoElDia ? 'Día' : formatearHora(actividad.inicioOcurrencia));
      const detalle = el('span', 'cal-agenda-detalle');
      detalle.append(
        el('strong', 'cal-agenda-titulo', actividad.titulo),
        el('span', 'cal-agenda-meta', [actividad.materia, NOMBRES_TIPO[actividad.tipo]].filter(Boolean).join(' · ')),
      );
      if (actividad.completada) fila.classList.add('completada');
      fila.append(hora, detalle, icono('ph-caret-right', 'cal-agenda-flecha'));
      fila.addEventListener('click', () => abrirFormulario(actividad.id));
      agenda.appendChild(fila);
    });
  }
  const agregar = el('button', 'cal-agenda-agregar');
  agregar.type = 'button';
  agregar.append(icono('ph-plus'), el('span', '', 'Agregar a este día'));
  agregar.addEventListener('click', () => abrirFormulario(null, inicio));
  agenda.appendChild(agregar);
  contenido.replaceChildren(agenda);
  renderProximaActividad(actividades, referenciaDelPeriodo(inicio, fin));
}

function crearChip(ocurrencia, compacto = true) {
  const boton = el('button', `cal-evento cal-tipo-${ocurrencia.tipo} prioridad-${ocurrencia.prioridad}`);
  boton.type = 'button';
  boton.dataset.id = ocurrencia.id;
  boton.title = `${NOMBRES_TIPO[ocurrencia.tipo]}: ${ocurrencia.titulo}`;
  if (ocurrencia.completada) boton.classList.add('completada');

  if (compacto) {
    if (!ocurrencia.todoElDia) boton.appendChild(el('span', 'cal-evento-hora', formatearHora(ocurrencia.inicioOcurrencia)));
    boton.appendChild(el('span', 'cal-evento-titulo', ocurrencia.titulo));
  } else {
    const cabecera = el('span', 'cal-evento-cabecera');
    cabecera.append(
      el('span', 'cal-evento-tipo', NOMBRES_TIPO[ocurrencia.tipo]),
      el('span', 'cal-evento-prioridad', ocurrencia.prioridad),
    );
    const horario = ocurrencia.todoElDia
      ? 'Todo el día'
      : `${formatearHora(ocurrencia.inicioOcurrencia)} – ${formatearHora(ocurrencia.finOcurrencia)}`;
    boton.append(cabecera, el('strong', 'cal-evento-titulo', ocurrencia.titulo));
    if (ocurrencia.materia) boton.appendChild(el('span', 'cal-evento-materia', ocurrencia.materia));
    boton.appendChild(el('span', 'cal-evento-horario', horario));
    if (ocurrencia.repetirSemanal) boton.appendChild(icono('ph-arrows-clockwise', 'cal-evento-repite'));
  }
  boton.addEventListener('click', (e) => {
    e.stopPropagation();
    abrirFormulario(ocurrencia.id);
  });
  return boton;
}

function renderMes() {
  const contenido = $('calendario-contenido');
  const { inicio, fin } = rangoVisibleMes(fechaFoco);
  const eventos = ocurrenciasPorDia(calendario.actividades, inicio, fin);
  const rejilla = el('div', 'cal-mes');

  for (const nombre of DIAS) rejilla.appendChild(el('div', 'cal-dia-semana', nombre));
  const hoy = claveFecha(new Date());
  for (let i = 0; i < 42; i += 1) {
    const fecha = sumarDias(inicio, i);
    const clave = claveFecha(fecha);
    const celda = el('div', 'cal-dia');
    if (fecha.getMonth() !== fechaFoco.getMonth()) celda.classList.add('fuera-mes');
    if (clave === hoy) celda.classList.add('hoy');
    celda.dataset.fecha = clave;

    const numero = el('button', 'cal-dia-numero', String(fecha.getDate()));
    numero.type = 'button';
    numero.setAttribute('aria-label', `Crear actividad el ${fecha.toLocaleDateString('es-MX')}`);
    numero.addEventListener('click', () => abrirFormulario(null, fecha));
    celda.appendChild(numero);

    const lista = eventos.get(clave) ?? [];
    lista.slice(0, 3).forEach((evento) => celda.appendChild(crearChip(evento)));
    if (lista.length > 3) celda.appendChild(el('span', 'cal-mas-eventos', `+${lista.length - 3} más`));
    celda.addEventListener('dblclick', (e) => {
      if (!e.target.closest('.cal-evento')) abrirFormulario(null, fecha);
    });
    rejilla.appendChild(celda);
  }
  contenido.replaceChildren(rejilla);
  renderProximaActividad(ocurrenciasUnicas(eventos), referenciaDelPeriodo(inicio, fin));
}

function renderSemana() {
  const contenido = $('calendario-contenido');
  const inicio = lunesDeSemana(fechaFoco);
  const fin = sumarDias(inicio, 7);
  const eventos = ocurrenciasPorDia(calendario.actividades, inicio, fin);
  const rejilla = el('div', 'cal-semana');
  const hoy = claveFecha(new Date());

  for (let i = 0; i < 7; i += 1) {
    const fecha = sumarDias(inicio, i);
    const clave = claveFecha(fecha);
    const columna = el('section', 'cal-semana-dia');
    if (clave === hoy) columna.classList.add('hoy');
    const cabecera = el('button', 'cal-semana-cabecera');
    cabecera.type = 'button';
    cabecera.append(el('span', '', DIAS[i]), el('strong', '', String(fecha.getDate())));
    cabecera.addEventListener('click', () => abrirFormulario(null, fecha));
    columna.appendChild(cabecera);

    const lista = el('div', 'cal-semana-eventos');
    const actividades = eventos.get(clave) ?? [];
    actividades.forEach((evento) => lista.appendChild(crearChip(evento, false)));
    if (!actividades.length) lista.appendChild(el('p', 'cal-dia-vacio', 'Sin actividades'));
    columna.appendChild(lista);
    rejilla.appendChild(columna);
  }
  contenido.replaceChildren(rejilla);
  renderProximaActividad(ocurrenciasUnicas(eventos), referenciaDelPeriodo(inicio, fin));
}

function render() {
  $('calendario-titulo').textContent = tituloPeriodo();
  $('cal-vista-dia').classList.toggle('activo', vista === 'dia');
  $('cal-vista-mes').classList.toggle('activo', vista === 'mes');
  $('cal-vista-semana').classList.toggle('activo', vista === 'semana');
  if (vista === 'dia') renderDia();
  else if (vista === 'mes') renderMes();
  else renderSemana();
}

function mostrarEstado(texto = '', error = false) {
  const nodo = $('calendario-estado');
  nodo.textContent = texto;
  nodo.classList.toggle('oculta', !texto);
  nodo.classList.toggle('error', error);
}

function cambiarTipoFecha(todoElDia) {
  const inicio = $('cal-inicio');
  const fin = $('cal-fin');
  if (todoElDia) {
    inicio.value = inicio.value.slice(0, 10);
    fin.value = fin.value.slice(0, 10);
    inicio.type = fin.type = 'date';
  } else {
    const fechaInicio = inicio.value.slice(0, 10) || claveFecha(new Date());
    const fechaFin = fin.value.slice(0, 10) || fechaInicio;
    inicio.type = fin.type = 'datetime-local';
    inicio.value = `${fechaInicio}T09:00`;
    fin.value = `${fechaFin}T10:00`;
  }
}

function actualizarCamposCondicionales() {
  const esClase = $('cal-tipo').value === 'clase';
  const esTarea = $('cal-tipo').value === 'tarea';
  $('cal-repetir-campo').classList.toggle('oculta', !esClase);
  if (!esClase) $('cal-repetir').checked = false;
  $('cal-repetir-hasta-campo').classList.toggle('oculta', !esClase || !$('cal-repetir').checked);
  $('cal-completada-campo').classList.toggle('oculta', !esTarea);
  if (!esTarea) $('cal-completada').checked = false;
}

function fechaInicialSugerida(fecha) {
  const base = fecha ? new Date(fecha) : new Date();
  if (fecha) base.setHours(9, 0, 0, 0);
  else {
    base.setMinutes(base.getMinutes() < 30 ? 30 : 0, 0, 0);
    if (base.getMinutes() === 0) base.setHours(base.getHours() + 1);
  }
  return base;
}

function abrirFormulario(id = null, fecha = null) {
  const actividad = id ? calendario.actividades.find((a) => a.id === id) : null;
  $('cal-formulario').reset();
  $('cal-id').value = actividad?.id ?? '';
  $('cal-form-titulo').textContent = actividad ? 'Editar actividad' : 'Nueva actividad';
  $('cal-eliminar').classList.toggle('oculta', !actividad);
  $('cal-form-error').textContent = '';

  if (actividad) {
    $('cal-titulo').value = actividad.titulo;
    $('cal-tipo').value = actividad.tipo;
    $('cal-materia').value = actividad.materia ?? '';
    $('cal-prioridad').value = actividad.prioridad;
    $('cal-todo-dia').checked = Boolean(actividad.todoElDia);
    $('cal-inicio').type = $('cal-fin').type = actividad.todoElDia ? 'date' : 'datetime-local';
    $('cal-inicio').value = actividad.inicio;
    $('cal-fin').value = actividad.fin;
    $('cal-repetir').checked = Boolean(actividad.repetirSemanal);
    $('cal-repetir-hasta').value = actividad.repetirHasta ?? '';
    $('cal-completada').checked = Boolean(actividad.completada);
    $('cal-notas').value = actividad.notas ?? '';
  } else {
    const inicio = fechaInicialSugerida(fecha);
    const fin = new Date(inicio.getTime() + 60 * 60 * 1000);
    $('cal-tipo').value = 'tarea';
    $('cal-prioridad').value = 'media';
    $('cal-inicio').type = $('cal-fin').type = 'datetime-local';
    $('cal-inicio').value = valorFechaHora(inicio);
    $('cal-fin').value = valorFechaHora(fin);
  }
  actualizarCamposCondicionales();
  $('cal-modal').classList.remove('oculta');
  document.body.classList.add('cal-modal-abierto');
  requestAnimationFrame(() => $('cal-titulo').focus());
}

function cerrarFormulario() {
  $('cal-modal').classList.add('oculta');
  document.body.classList.remove('cal-modal-abierto');
  $('cal-form-error').textContent = '';
}

function actividadDelFormulario() {
  const previa = calendario.actividades.find((a) => a.id === $('cal-id').value);
  const ahora = new Date().toISOString();
  return {
    id: previa?.id ?? crearIdActividad(),
    titulo: $('cal-titulo').value.trim(),
    tipo: $('cal-tipo').value,
    materia: $('cal-materia').value.trim(),
    prioridad: $('cal-prioridad').value,
    todoElDia: $('cal-todo-dia').checked,
    inicio: $('cal-inicio').value,
    fin: $('cal-fin').value,
    repetirSemanal: $('cal-tipo').value === 'clase' && $('cal-repetir').checked,
    repetirHasta: $('cal-repetir').checked ? ($('cal-repetir-hasta').value || null) : null,
    completada: $('cal-tipo').value === 'tarea' && $('cal-completada').checked,
    notas: $('cal-notas').value.trim(),
    creadoEn: previa?.creadoEn ?? ahora,
    actualizadoEn: ahora,
  };
}

async function persistir(copiaAnterior) {
  if (!hayTauri) return true;
  guardado = guardado.then(() => api.guardarCalendario(calendario));
  try {
    await guardado;
    return true;
  } catch (error) {
    calendario = copiaAnterior;
    guardado = Promise.resolve();
    render();
    mostrarAviso(error.message, 'error');
    return false;
  }
}

async function guardarActividad(e) {
  e.preventDefault();
  const actividad = actividadDelFormulario();
  const error = validarActividad(actividad);
  if (error) {
    $('cal-form-error').textContent = error;
    return;
  }
  const anterior = structuredClone(calendario);
  const indice = calendario.actividades.findIndex((a) => a.id === actividad.id);
  if (indice >= 0) calendario.actividades[indice] = actividad;
  else calendario.actividades.push(actividad);
  render();
  cerrarFormulario();
  if (await persistir(anterior)) mostrarAviso(indice >= 0 ? 'Actividad actualizada' : 'Actividad creada', 'exito');
}

async function eliminarActividad() {
  const id = $('cal-id').value;
  const actividad = calendario.actividades.find((a) => a.id === id);
  if (!actividad) return;
  const aceptado = await confirmar({
    titulo: 'Eliminar actividad',
    mensaje: `«${actividad.titulo}» se eliminará del calendario.`,
    textoAceptar: 'Eliminar',
    peligro: true,
  });
  if (!aceptado) return;
  const anterior = structuredClone(calendario);
  calendario.actividades = calendario.actividades.filter((a) => a.id !== id);
  render();
  cerrarFormulario();
  if (await persistir(anterior)) mostrarAviso('Actividad eliminada');
}

function cambiarVista(nuevaVista) {
  vista = nuevaVista;
  render();
}

function navegar(direccion) {
  if (vista === 'mes') fechaFoco = new Date(fechaFoco.getFullYear(), fechaFoco.getMonth() + direccion, 1);
  else if (vista === 'semana') fechaFoco = sumarDias(fechaFoco, direccion * 7);
  else fechaFoco = sumarDias(fechaFoco, direccion);
  render();
}

function conectarEventos() {
  $('cal-vista-dia').addEventListener('click', () => cambiarVista('dia'));
  $('cal-vista-mes').addEventListener('click', () => cambiarVista('mes'));
  $('cal-vista-semana').addEventListener('click', () => cambiarVista('semana'));
  $('cal-anterior').addEventListener('click', () => navegar(-1));
  $('cal-siguiente').addEventListener('click', () => navegar(1));
  $('cal-hoy').addEventListener('click', () => { fechaFoco = new Date(); render(); });
  $('cal-nueva-actividad').addEventListener('click', () => abrirFormulario());
  $('cal-proxima').addEventListener('click', () => {
    const id = $('cal-proxima').dataset.id;
    if (id) abrirFormulario(id);
    else abrirFormulario(null, inicioDelDia(fechaFoco));
  });
  $('cal-cerrar-modal').addEventListener('click', cerrarFormulario);
  $('cal-cancelar').addEventListener('click', cerrarFormulario);
  $('cal-eliminar').addEventListener('click', eliminarActividad);
  $('cal-formulario').addEventListener('submit', guardarActividad);
  $('cal-tipo').addEventListener('change', actualizarCamposCondicionales);
  $('cal-repetir').addEventListener('change', actualizarCamposCondicionales);
  $('cal-todo-dia').addEventListener('change', (e) => cambiarTipoFecha(e.target.checked));
  $('cal-modal').addEventListener('pointerdown', (e) => {
    if (e.target === $('cal-modal')) cerrarFormulario();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('cal-modal').classList.contains('oculta')) cerrarFormulario();
  });
}

export async function iniciarCalendario() {
  if (iniciado) return;
  iniciado = true;
  conectarEventos();
  render();
  if (!hayTauri) {
    mostrarEstado('Abre Study.Time como aplicación de escritorio para guardar actividades.');
    return;
  }
  mostrarEstado('Cargando calendario…');
  try {
    const datos = await api.cargarCalendario();
    calendario = {
      version: Number(datos?.version) || 1,
      actividades: Array.isArray(datos?.actividades)
        ? datos.actividades.filter((a) => !validarActividad(a))
        : [],
    };
    mostrarEstado();
    render();
  } catch (error) {
    mostrarEstado(error.message, true);
  }
}

export function alMostrarCalendario() {
  if (iniciado) render();
}
