use crate::config::OverlayRuntimeConfig;
use mouse_position::mouse_position::Mouse;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize};

pub fn start_cursor_follow(app: AppHandle, config: OverlayRuntimeConfig) {
    tauri::async_runtime::spawn(async move {
        loop {
            if let Some(window) = app.get_webview_window("main") {
                if window.is_visible().unwrap_or(false) {
                    if let Mouse::Cursor { x, y } = Mouse::get_mouse_position() {
                        position_window(&window, x, y, &config);
                    }
                }
            }

            tokio::time::sleep(std::time::Duration::from_millis(16)).await;
        }
    });
}

fn position_window(
    window: &tauri::WebviewWindow,
    cursor_x: i32,
    cursor_y: i32,
    config: &OverlayRuntimeConfig,
) {
    let target_x = cursor_x + config.offset_x;
    let target_y = cursor_y + config.offset_y;

    let (clamped_x, clamped_y) = match window.current_monitor() {
        Ok(Some(monitor)) => {
            let monitor_pos = monitor.position();
            let monitor_size = monitor.size();
            let window_size = window
                .outer_size()
                .unwrap_or(PhysicalSize::new(config.max_width, 300));

            let min_x = monitor_pos.x;
            let min_y = monitor_pos.y;
            let max_x = monitor_pos.x + monitor_size.width as i32 - window_size.width as i32;
            let max_y = monitor_pos.y + monitor_size.height as i32 - window_size.height as i32;

            (
                target_x.clamp(min_x, max_x.max(min_x)),
                target_y.clamp(min_y, max_y.max(min_y)),
            )
        }
        _ => (target_x, target_y),
    };

    let _ = window.set_position(PhysicalPosition::new(clamped_x, clamped_y));
}
