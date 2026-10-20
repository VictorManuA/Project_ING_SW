const tauri = () => window.__TAURI__;
export const hayTauri = typeof window.__TAURI__?.core?.invoke === 'function';

async function llamar(comando, args = {}) {
  if (!hayTauri) {
    throw new Error('Esta función solo está disponible dentro de la app');
  }
  try {
    return await tauri().core.invoke(comando, args);
  } catch (error) {
    throw new Error(typeof error === 'string' ? error : (error?.message ?? String(error)));
  }
}

export const api = {
  cargarConfig: () => llamar('cargar_config'),
  guardarConfig: (config) => llamar('guardar_config', { config }),
  cargarCalendario: () => llamar('cargar_calendario'),
  guardarCalendario: (calendario) => llamar('guardar_calendario', { calendario }),
  escanearVault: (vault) => llamar('escanear_vault', { vault }),
  
  async elegirCarpeta(carpetaInicial) {
    const dialogo = tauri()?.dialog;
    if (!dialogo) {
      throw new Error('Selector de carpetas NO disponible.');
    }
    const resultado = await dialogo.open({
      directory: true,
      multiple: false,
      canCreateDirectories: true,
      title: 'Elige la carpeta de tus notas (vault)',
      defaultPath: carpetaInicial || undefined,
    });
    return typeof resultado === 'string' ? resultado : null;
  },
  crear: (vault, ruta, esCarpeta) => llamar('crear_entrada', { vault, ruta, esCarpeta }),
  mover: (vault, origen, destino) => llamar('mover_entrada', { vault, origen, destino }),
  eliminar: (vault, ruta) => llamar('eliminar_entrada', { vault, ruta }),
  leerNota: (vault, ruta) => llamar('leer_nota', { vault, ruta }),
  escribirNota: (vault, ruta, contenido) => llamar('escribir_nota', { vault, ruta, contenido }),
};
