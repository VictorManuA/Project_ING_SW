import { api, hayTauri } from './api.js';
export const config = {};

let temporizador = null;
let cola = Promise.resolve();

export async function iniciarConfig() {
  if (!hayTauri) return config;
  try {
    Object.assign(config, await api.cargarConfig());
  } catch (error) {
    console.error('No se pudo cargar la configuración:', error);
  }
  return config;
}
export function seccion(nombre) {
  if (typeof config[nombre] !== 'object' || config[nombre] === null) config[nombre] = {};
  return config[nombre];
}
export function guardarConfig() {
  clearTimeout(temporizador);
  temporizador = setTimeout(guardarConfigYa, 250);}
export function guardarConfigYa() {
  clearTimeout(temporizador);
  temporizador = null;
  const copia = JSON.parse(JSON.stringify(config));
  cola = cola
    .then(() => api.guardarConfig(copia))
    .catch((error) => console.error('No se pudo guardar la configuración:', error));
  return cola;
}