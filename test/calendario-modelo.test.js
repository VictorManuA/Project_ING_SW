import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claveFecha,
  lunesDeSemana,
  ocurrenciasEntre,
  ocurrenciasPorDia,
  rangoVisibleMes,
  validarActividad,
} from '../src/js/calendario-modelo.js';

const actividadBase = {
  id: 'a-1',
  titulo: 'Ingeniería de software',
  tipo: 'clase',
  materia: 'IS',
  prioridad: 'media',
  todoElDia: false,
  inicio: '2026-10-05T09:00',
  fin: '2026-10-05T10:30',
  repetirSemanal: true,
  repetirHasta: '2026-10-26',
  completada: false,
  notas: '',
};

test('la semana comienza en lunes', () => {
  assert.equal(claveFecha(lunesDeSemana(new Date(2026, 9, 18))), '2026-10-12');
  assert.equal(claveFecha(lunesDeSemana(new Date(2026, 9, 19))), '2026-10-19');
});

test('la vista mensual siempre cubre seis semanas', () => {
  const rango = rangoVisibleMes(new Date(2026, 9, 19));
  assert.equal(claveFecha(rango.inicio), '2026-09-28');
  assert.equal((rango.fin - rango.inicio) / 86_400_000, 42);
});

test('genera repeticiones semanales hasta la fecha indicada', () => {
  const ocurrencias = ocurrenciasEntre(
    actividadBase,
    new Date('2026-10-01T00:00:00'),
    new Date('2026-11-01T00:00:00'),
  );
  assert.deepEqual(
    ocurrencias.map((o) => claveFecha(o.inicioOcurrencia)),
    ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'],
  );
});

test('agrupa una actividad en su día correspondiente', () => {
  const mapa = ocurrenciasPorDia(
    [{ ...actividadBase, repetirSemanal: false }],
    new Date('2026-10-05T00:00:00'),
    new Date('2026-10-06T00:00:00'),
  );
  assert.equal(mapa.get('2026-10-05').length, 1);
});

test('rechaza fechas invertidas y repetición en tareas', () => {
  assert.match(validarActividad({ ...actividadBase, fin: '2026-10-05T08:00' }), /anterior/);
  assert.match(validarActividad({ ...actividadBase, tipo: 'tarea' }), /Solo las clases/);
});

test('no agrega al día siguiente un evento que termina exactamente a medianoche', () => {
  const mapa = ocurrenciasPorDia(
    [{
      ...actividadBase,
      repetirSemanal: false,
      inicio: '2026-10-19T23:00',
      fin: '2026-10-20T00:00',
    }],
    new Date('2026-10-19T00:00:00'),
    new Date('2026-10-21T00:00:00'),
  );
  assert.deepEqual([...mapa.keys()], ['2026-10-19']);
});

test('mantiene inclusiva la fecha final de actividades de todo el día', () => {
  const mapa = ocurrenciasPorDia(
    [{
      ...actividadBase,
      todoElDia: true,
      repetirSemanal: false,
      inicio: '2026-10-19',
      fin: '2026-10-20',
    }],
    new Date('2026-10-19T00:00:00'),
    new Date('2026-10-21T00:00:00'),
  );
  assert.deepEqual([...mapa.keys()], ['2026-10-19', '2026-10-20']);
});

test('rechaza fechas y horas inexistentes', () => {
  assert.match(
    validarActividad({ ...actividadBase, inicio: '2026-02-30T09:00', fin: '2026-02-30T10:00' }),
    /fechas válidas/,
  );
  assert.match(
    validarActividad({ ...actividadBase, inicio: '2026-10-05T25:00' }),
    /fechas válidas/,
  );
});
