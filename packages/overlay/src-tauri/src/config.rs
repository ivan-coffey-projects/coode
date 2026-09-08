use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayRuntimeConfig {
    pub server_url: String,
    pub display_mode: String,
    pub overlay_enabled: bool,
    pub max_width: u32,
    pub offset_x: i32,
    pub offset_y: i32,
}

impl Default for OverlayRuntimeConfig {
    fn default() -> Self {
        Self {
            server_url: "http://127.0.0.1:17420".to_string(),
            display_mode: "both".to_string(),
            overlay_enabled: true,
            max_width: 420,
            offset_x: 16,
            offset_y: 16,
        }
    }
}

impl OverlayRuntimeConfig {
    pub fn load() -> Self {
        let path = config_path();
        let Ok(raw) = fs::read_to_string(path) else {
            return Self::default();
        };

        let Ok(parsed) = serde_yaml::from_str::<serde_yaml::Value>(&raw) else {
            return Self::default();
        };

        let mut config = Self::default();

        if let Some(server) = parsed.get("server") {
            let host = server
                .get("host")
                .and_then(|value| value.as_str())
                .unwrap_or("127.0.0.1");
            let port = server
                .get("port")
                .and_then(|value| value.as_u64())
                .unwrap_or(17420);
            config.server_url = format!("http://{host}:{port}");
        }

        if let Some(display) = parsed.get("display") {
            if let Some(mode) = display.get("default").and_then(|value| value.as_str()) {
                config.display_mode = mode.to_string();
            }

            if let Some(popup) = display.get("popup") {
                if let Some(max_width) = popup.get("maxWidth").and_then(|value| value.as_u64()) {
                    config.max_width = max_width as u32;
                }

                if let Some(offset) = popup.get("offset") {
                    if let Some(x) = offset.get("x").and_then(|value| value.as_i64()) {
                        config.offset_x = x as i32;
                    }
                    if let Some(y) = offset.get("y").and_then(|value| value.as_i64()) {
                        config.offset_y = y as i32;
                    }
                }
            }

            if let Some(overlay) = display.get("overlay") {
                if let Some(enabled) = overlay.get("enabled").and_then(|value| value.as_bool()) {
                    config.overlay_enabled = enabled;
                }
            }
        }

        config
    }
}

fn config_path() -> PathBuf {
    if let Ok(dir) = std::env::var("COODE_CONFIG_DIR") {
        return PathBuf::from(dir).join("config.yaml");
    }

    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".config")
        .join("coode")
        .join("config.yaml")
}

mod dirs {
    use std::path::PathBuf;

    pub fn home_dir() -> Option<PathBuf> {
        std::env::var_os("HOME").map(PathBuf::from)
    }
}
