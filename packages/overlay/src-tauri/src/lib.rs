mod config;
mod cursor;

use config::OverlayRuntimeConfig;
use cursor::start_cursor_follow;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let runtime_config = OverlayRuntimeConfig::load();
            let app_handle = app.handle().clone();

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_ignore_cursor_events(true);
            }

            start_cursor_follow(app_handle, runtime_config);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![set_overlay_visible, get_runtime_config])
        .run(tauri::generate_context!())
        .expect("error while running coode overlay");
}

#[tauri::command]
fn get_runtime_config() -> OverlayRuntimeConfig {
    OverlayRuntimeConfig::load()
}

#[tauri::command]
fn set_overlay_visible(app: tauri::AppHandle, visible: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "overlay window not found".to_string())?;

    if visible {
        window.show().map_err(|error| error.to_string())?;
    } else {
        window.hide().map_err(|error| error.to_string())?;
    }

    Ok(())
}
