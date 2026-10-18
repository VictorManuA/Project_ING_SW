// =============================================================================
// Study.Time — backend de Tauri (v2)
//
// Todo el acceso al disco para las notas pasa por estos comandos. Así:
//   * no dependemos de los "scopes" del plugin fs (que se pierden al reiniciar
//     si el usuario eligió una carpeta cualquiera como vault);
//   * validamos cada ruta para que nada pueda salirse de la carpeta del vault;
//   * funciona igual en macOS y Windows (las rutas internas siempre usan "/").
//
// Si ya tenías un lib.rs (con `greet`, `tauri_plugin_opener`, etc.), conserva
// tus `.plugin(...)` existentes y solo agrega lo marcado con  // <-- NUEVO
// =============================================================================
use serde::Serialize;
use std::{
    fs,
    io::{self, Write},
    path::{Path, PathBuf},
};
use tauri::Manager;

const MAX_ENTRADAS: usize = 20_000;
const MAX_PROFUNDIDAD: usize = 32;
const MAX_BYTES_NOTA: u64 = 10 * 1024 * 1024;

#[derive(Serialize)]
struct Entrada {
    /// Ruta relativa al vault, siempre con "/" como separador.
    ruta: String,
    /// "carpeta" o "nota"
    tipo: &'static str,
}

// -----------------------------------------------------------------------------
// Utilidades de rutas y nombres
// -----------------------------------------------------------------------------

/// Un segmento de ruta ya existente es seguro si no permite escapar del vault.
fn segmento_seguro(s: &str) -> bool {
    !s.is_empty() && s != "." && s != ".." && !s.contains(['/', '\\', ':', '\0'])
}

/// Reglas para nombres NUEVOS (crear / renombrar). Son las más estrictas de
/// macOS + Windows, para que el vault se pueda mover entre ambos sistemas.
fn validar_nombre(nombre: &str) -> Result<(), String> {
    if nombre.is_empty() {
        return Err("El nombre no puede estar vacío".into());
    }
    if nombre != nombre.trim() {
        return Err("El nombre no puede empezar ni terminar con espacios".into());
    }
    if nombre.starts_with('.') {
        return Err("El nombre no puede empezar con un punto".into());
    }
    if nombre.ends_with('.') {
        return Err("El nombre no puede terminar con un punto".into());
    }
    if nombre
        .chars()
        .any(|c| c.is_control() || "<>:\"/\\|?*".contains(c))
    {
        return Err("El nombre no puede contener  < > : \" / \\ | ? *".into());
    }
    if nombre.len() > 200 {
        return Err("El nombre es demasiado largo".into());
    }
    const RESERVADOS: &[&str] = &[
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7",
        "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];
    let base = nombre.split('.').next().unwrap_or("").to_uppercase();
    if RESERVADOS.contains(&base.as_str()) {
        return Err(format!("«{base}» es un nombre reservado del sistema"));
    }
    Ok(())
}

fn es_md(ruta: &str) -> bool {
    ruta.to_lowercase().ends_with(".md")
}

/// Carpeta raíz del vault (debe existir y ser una carpeta).
fn raiz(vault: &str) -> Result<PathBuf, String> {
    fs::canonicalize(vault)
        .ok()
        .filter(|p| p.is_dir())
        .ok_or_else(|| {
            "No se encontró la carpeta del vault. ¿La moviste o la renombraste?".to_string()
        })
}

/// Convierte una ruta relativa ("Carpeta/Nota.md") en una ruta absoluta dentro
/// del vault. Rechaza cualquier intento de salirse de él.
fn resolver(vault: &str, ruta: &str) -> Result<PathBuf, String> {
    let mut p = raiz(vault)?;
    for seg in ruta.split('/').filter(|s| !s.is_empty()) {
        if !segmento_seguro(seg) {
            return Err("Ruta no válida".into());
        }
        p.push(seg);
    }
    Ok(p)
}

/// Escritura atómica: escribe en un temporal y luego renombra, para no dejar
/// una nota a medias si la app o el equipo se cierran justo al guardar.
fn escribir_atomico(destino: &Path, contenido: &[u8]) -> io::Result<()> {
    let nombre = destino
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    let tmp = destino.with_file_name(format!(".{nombre}.stmp"));
    {
        let mut f = fs::File::create(&tmp)?;
        f.write_all(contenido)?;
        f.sync_all()?;
    }
    fs::rename(&tmp, destino).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        e
    })
}

// -----------------------------------------------------------------------------
// Configuración del usuario (config.json en la carpeta de configuración de la app)
//   macOS:   ~/Library/Application Support/<identifier>/config.json
//   Windows: %APPDATA%\<identifier>\config.json
// -----------------------------------------------------------------------------

fn ruta_config(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("No se pudo crear la carpeta de configuración: {e}"))?;
    Ok(dir.join("config.json"))
}

#[tauri::command] // <-- NUEVO
async fn cargar_config(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let ruta = ruta_config(&app)?;
    let texto = match fs::read_to_string(&ruta) {
        Ok(t) => t,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(serde_json::json!({})),
        Err(e) => return Err(format!("No se pudo leer la configuración: {e}")),
    };
    match serde_json::from_str::<serde_json::Value>(&texto) {
        Ok(v) if v.is_object() => Ok(v),
        _ => {
            // Archivo dañado: lo apartamos en vez de perderlo y empezamos limpio.
            let _ = fs::rename(&ruta, ruta.with_file_name("config.corrupta.json"));
            Ok(serde_json::json!({}))
        }
    }
}

#[tauri::command] // <-- NUEVO
async fn guardar_config(app: tauri::AppHandle, config: serde_json::Value) -> Result<(), String> {
    let ruta = ruta_config(&app)?;
    let texto = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    escribir_atomico(&ruta, texto.as_bytes())
        .map_err(|e| format!("No se pudo guardar la configuración: {e}"))
}

// -----------------------------------------------------------------------------
// Árbol del vault
// -----------------------------------------------------------------------------

fn escanear_dir(
    dir: &Path,
    prefijo: &str,
    nivel: usize,
    salida: &mut Vec<Entrada>,
) -> io::Result<()> {
    if nivel > MAX_PROFUNDIDAD {
        return Ok(());
    }
    for item in fs::read_dir(dir)? {
        if salida.len() >= MAX_ENTRADAS {
            break;
        }
        let Ok(item) = item else { continue };
        let nombre = item.file_name().to_string_lossy().into_owned();
        if nombre.starts_with('.') || !segmento_seguro(&nombre) {
            continue; // ocultos (.git, .DS_Store, temporales) y nombres raros
        }
        let Ok(tipo) = item.file_type() else { continue };
        if tipo.is_symlink() {
            continue; // no seguimos enlaces simbólicos (evita ciclos y fugas)
        }
        let ruta = if prefijo.is_empty() {
            nombre.clone()
        } else {
            format!("{prefijo}/{nombre}")
        };
        if tipo.is_dir() {
            if nombre == "node_modules" {
                continue;
            }
            salida.push(Entrada {
                ruta: ruta.clone(),
                tipo: "carpeta",
            });
            // Si una subcarpeta no se puede leer (permisos), la mostramos vacía.
            let _ = escanear_dir(&item.path(), &ruta, nivel + 1, salida);
        } else if tipo.is_file() && es_md(&nombre) {
            salida.push(Entrada { ruta, tipo: "nota" });
        }
    }
    Ok(())
}

#[tauri::command] // <-- NUEVO
async fn escanear_vault(vault: String) -> Result<Vec<Entrada>, String> {
    let raiz = raiz(&vault)?;
    let mut salida = Vec::new();
    escanear_dir(&raiz, "", 0, &mut salida)
        .map_err(|e| format!("No se pudo leer la carpeta del vault: {e}"))?;
    Ok(salida)
}

#[tauri::command] // <-- NUEVO
async fn crear_entrada(vault: String, ruta: String, es_carpeta: bool) -> Result<(), String> {
    let nombre = ruta.rsplit('/').next().unwrap_or("");
    validar_nombre(nombre)?;
    if !es_carpeta && !es_md(nombre) {
        return Err("Las notas deben terminar en .md".into());
    }
    let destino = resolver(&vault, &ruta)?;
    if destino.exists() {
        return Err("Ya existe un elemento con ese nombre".into());
    }
    let resultado = if es_carpeta {
        fs::create_dir(&destino)
    } else {
        fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&destino)
            .map(|_| ())
    };
    resultado.map_err(|e| format!("No se pudo crear: {e}"))
}

/// Renombrar y mover son lo mismo: cambiar la ruta relativa de un elemento.
#[tauri::command] // <-- NUEVO
async fn mover_entrada(vault: String, origen: String, destino: String) -> Result<(), String> {
    if origen.trim_matches('/').is_empty() {
        return Err("Ruta no válida".into());
    }
    let nombre_destino = destino.rsplit('/').next().unwrap_or("");
    validar_nombre(nombre_destino)?;
    let o = resolver(&vault, &origen)?;
    let d = resolver(&vault, &destino)?;
    if d == o {
        return Ok(());
    }
    let meta = fs::symlink_metadata(&o)
        .map_err(|_| "El elemento ya no existe. Actualiza el árbol.".to_string())?;
    if meta.is_file() && !es_md(nombre_destino) {
        return Err("Las notas deben terminar en .md".into());
    }
    if meta.is_dir() && d.starts_with(&o) {
        return Err("No puedes mover una carpeta dentro de sí misma".into());
    }
    if !d.parent().is_some_and(|p| p.is_dir()) {
        return Err("La carpeta de destino no existe".into());
    }

    let fallo = |e: io::Error| format!("No se pudo mover o renombrar: {e}");
    if d.exists() {
        if origen.to_lowercase() != destino.to_lowercase() {
            return Err("Ya existe un elemento con ese nombre".into());
        }
        // Cambio solo de mayúsculas/minúsculas ("notas" -> "Notas"): en macOS y
        // Windows el destino "ya existe" porque es el mismo archivo, así que
        // pasamos por un nombre temporal.
        let tmp = o.with_file_name(format!(".st-{}.ren", std::process::id()));
        fs::rename(&o, &tmp).map_err(fallo)?;
        if d.exists() {
            // Era otro archivo distinto (sistema que distingue mayúsculas): revertimos.
            let _ = fs::rename(&tmp, &o);
            return Err("Ya existe un elemento con ese nombre".into());
        }
        fs::rename(&tmp, &d).map_err(fallo)
    } else {
        fs::rename(&o, &d).map_err(fallo)
    }
}

/// Envía a la papelera del sistema (se puede recuperar), nunca borra directo.
#[tauri::command] // <-- NUEVO
async fn eliminar_entrada(vault: String, ruta: String) -> Result<(), String> {
    if ruta.trim_matches('/').is_empty() {
        return Err("Ruta no válida".into());
    }
    let p = resolver(&vault, &ruta)?;
    trash::delete(&p).map_err(|e| format!("No se pudo mover a la papelera: {e}"))
}

// -----------------------------------------------------------------------------
// Notas
// -----------------------------------------------------------------------------

#[tauri::command] // <-- NUEVO
async fn leer_nota(vault: String, ruta: String) -> Result<String, String> {
    if !es_md(&ruta) {
        return Err("Solo se pueden abrir notas .md".into());
    }
    let p = resolver(&vault, &ruta)?;
    let meta = fs::metadata(&p)
        .map_err(|_| "La nota ya no existe. Actualiza el árbol.".to_string())?;
    if meta.len() > MAX_BYTES_NOTA {
        return Err("La nota supera los 10 MB y no se puede abrir".into());
    }
    let bytes = fs::read(&p).map_err(|e| format!("No se pudo leer la nota: {e}"))?;
    let texto = String::from_utf8(bytes)
        .map_err(|_| "La nota no está codificada en UTF-8".to_string())?;
    // Quita el BOM que agregan algunos editores de Windows.
    Ok(if texto.starts_with('\u{feff}') {
        texto.trim_start_matches('\u{feff}').to_owned()
    } else {
        texto
    })
}

#[tauri::command] // <-- NUEVO
async fn escribir_nota(vault: String, ruta: String, contenido: String) -> Result<(), String> {
    if !es_md(&ruta) {
        return Err("Solo se pueden guardar notas .md".into());
    }
    let p = resolver(&vault, &ruta)?;
    if !p.parent().is_some_and(|d| d.is_dir()) {
        return Err("La carpeta de la nota ya no existe".into());
    }
    escribir_atomico(&p, contenido.as_bytes())
        .map_err(|e| format!("No se pudo guardar la nota: {e}"))
}

// -----------------------------------------------------------------------------
// Arranque
// -----------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            cargar_config,
            guardar_config,
            escanear_vault,
            crear_entrada,
            mover_entrada,
            eliminar_entrada,
            leer_nota,
            escribir_nota,
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar Study.Time");
}
