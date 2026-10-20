const MS_DIA = 24 * 60 * 60 * 1000;

export const TIPOS_ACTIVIDAD = ['clase', 'tarea', 'examen', 'descanso'];
export const PRIORIDADES = ['baja', 'media', 'alta'];

export function fechaLocal(valor, todoElDia = false) {
  if (typeof valor !== 'string' || !valor) return null;
  const local = valor.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/,
  );
  if (local) {
    const [, y, m, d, h = '0', min = '0', s = '0', ms = '0'] = local;
    const partes = [y, m, d, h, min, s].map(Number);
    const fecha = new Date(
      partes[0], partes[1] - 1, partes[2], partes[3], partes[4], partes[5],
      Number(ms.padEnd(3, '0')),
    );
    const coincide = fecha.getFullYear() === partes[0]
      && fecha.getMonth() === partes[1] - 1
      && fecha.getDate() === partes[2]
      && fecha.getHours() === partes[3]
      && fecha.getMinutes() === partes[4]
      && fecha.getSeconds() === partes[5];
    return coincide ? fecha : null;
  }
  const texto = todoElDia ? `${valor}T00:00:00` : valor;
  const fecha = new Date(texto);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}
export function inicioDelDia(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

export function sumarDias(fecha, cantidad) {
  const resultado = new Date(fecha);
  resultado.setDate(resultado.getDate() + cantidad);
  return resultado;
}

export function lunesDeSemana(fecha) {
  const resultado = inicioDelDia(fecha);
  const desplazamiento = (resultado.getDay() + 6) % 7;
  resultado.setDate(resultado.getDate() - desplazamiento);
  return resultado;
}

export function rangoVisibleMes(fecha) {
  const primero = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
  const inicio = lunesDeSemana(primero);
  return { inicio, fin: sumarDias(inicio, 42) };
}

export function claveFecha(fecha) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function valorFechaHora(fecha) {
  const horas = String(fecha.getHours()).padStart(2, '0');
  const minutos = String(fecha.getMinutes()).padStart(2, '0');
  return `${claveFecha(fecha)}T${horas}:${minutos}`;
}

export function crearIdActividad() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `act-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function validarActividad(actividad) {
  if (!actividad || typeof actividad !== 'object') return 'La actividad no es válida.';
  if (!actividad.titulo?.trim()) return 'Escribe un título.';
  if (!TIPOS_ACTIVIDAD.includes(actividad.tipo)) return 'Selecciona un tipo válido.';
  if (!PRIORIDADES.includes(actividad.prioridad)) return 'Selecciona una prioridad válida.';
  const inicio = fechaLocal(actividad.inicio, actividad.todoElDia);
  const fin = fechaLocal(actividad.fin, actividad.todoElDia);
  if (!inicio || !fin) return 'Indica fechas válidas de inicio y fin.';
  if (fin < inicio) return 'La fecha de fin no puede ser anterior al inicio.';
  if (actividad.repetirSemanal && actividad.tipo !== 'clase') {
    return 'Solo las clases pueden repetirse semanalmente.';
  }
  if (actividad.repetirSemanal && actividad.repetirHasta) {
    const hasta = fechaLocal(actividad.repetirHasta, true);
    if (!hasta || hasta < inicioDelDia(inicio)) {
      return 'La repetición debe terminar después de la primera clase.';
    }
  }
  return '';
}

export function ocurrenciasEntre(actividad, inicioRango, finRango) {
  const inicio = fechaLocal(actividad.inicio, actividad.todoElDia);
  const fin = fechaLocal(actividad.fin, actividad.todoElDia);
  if (!inicio || !fin || fin < inicio) return [];

  const crear = (inicioOcurrencia, finOcurrencia) => ({
    ...actividad,
    inicioOcurrencia,
    finOcurrencia,
  });
  const cruza = (a, b) => {
    if (actividad.todoElDia) return b >= inicioRango && a < finRango;
    if (a.getTime() === b.getTime()) return a >= inicioRango && a < finRango;
    return b > inicioRango && a < finRango;
  };

  if (!actividad.repetirSemanal) {
    return cruza(inicio, fin) ? [crear(inicio, fin)] : [];
  }

  const duracion = fin.getTime() - inicio.getTime();
  const limite = actividad.repetirHasta
    ? sumarDias(fechaLocal(actividad.repetirHasta, true), 1)
    : finRango;
  let cursor = new Date(inicio);

  if (cursor < inicioRango) {
    const dias = Math.max(0, Math.floor((inicioDelDia(inicioRango) - inicioDelDia(cursor)) / MS_DIA));
    const semanas = Math.max(0, Math.floor(dias / 7) - 1);
    cursor = sumarDias(cursor, semanas * 7);
  }

  const salida = [];
  let seguridad = 0;
  while (cursor < finRango && cursor < limite && seguridad < 1000) {
    const final = new Date(cursor.getTime() + duracion);
    if (cruza(cursor, final)) salida.push(crear(new Date(cursor), final));
    cursor = sumarDias(cursor, 7);
    seguridad += 1;
  }
  return salida;
}

export function ocurrenciasPorDia(actividades, inicioRango, finRango) {
  const mapa = new Map();
  for (const actividad of actividades) {
    for (const ocurrencia of ocurrenciasEntre(actividad, inicioRango, finRango)) {
      let dia = inicioDelDia(ocurrencia.inicioOcurrencia);
      const duracionPositiva = ocurrencia.finOcurrencia > ocurrencia.inicioOcurrencia;
      const finInclusivo = !ocurrencia.todoElDia && duracionPositiva
        ? new Date(ocurrencia.finOcurrencia.getTime() - 1)
        : ocurrencia.finOcurrencia;
      const ultimo = inicioDelDia(finInclusivo);
      while (dia <= ultimo && dia < finRango) {
        if (sumarDias(dia, 1) > inicioRango) {
          const clave = claveFecha(dia);
          if (!mapa.has(clave)) mapa.set(clave, []);
          mapa.get(clave).push(ocurrencia);
        }
        dia = sumarDias(dia, 1);
      }
    }
  }
  for (const lista of mapa.values()) {
    lista.sort((a, b) => a.inicioOcurrencia - b.inicioOcurrencia || a.titulo.localeCompare(b.titulo));
  }
  return mapa;
}
