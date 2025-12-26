use serde::{Deserialize, Serialize};
use std::fs;
use std::os::unix::fs::MetadataExt;
use std::path::Path;

const EXTENSIONS: [&str; 3] = ["jpg", "jpeg", "png"];

#[derive(Eq, PartialEq, Ord, PartialOrd, Serialize, Deserialize)]
struct File {
    path: String,
    size: u64,
}

#[tauri::command]
fn get_images(path: String) -> Result<Vec<File>, String> {
    let path = Path::new(&path);
    if !path.exists() || !path.is_dir() {
        return Err("Invalid directory".to_string());
    }

    let Ok(entries) = fs::read_dir(path) else {
        return Err(format!("Failed to read directory {}", path.display()));
    };

    let mut images = Vec::new();
    for entry in entries.flatten() {
        let entry = entry.path();
        if !entry.is_file() {
            continue;
        }
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        let Some(extension) = entry.extension() else {
            continue;
        };

        if EXTENSIONS.contains(&extension.to_str().unwrap().to_lowercase().as_str()) {
            images.push(File {
                path: entry.to_string_lossy().to_string(),
                size: metadata.size(),
            })
        }
    }

    images.sort();
    Ok(images)
}

#[tauri::command]
fn trash_image(path: &str) -> Result<(), String> {
    match trash::delete(path) {
        Err(err) => Err(format!("{path}: {err}")),
        Ok(_) => Ok(()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_images, trash_image])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
