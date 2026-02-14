use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    #[serde(rename = "currentProject")]
    pub current_project: Option<String>,
    #[serde(rename = "recentProjects")]
    pub recent_projects: Vec<String>,
    pub theme: Option<String>,
    #[serde(rename = "lastOpened")]
    pub last_opened: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            current_project: None,
            recent_projects: Vec::new(),
            theme: Some("light".to_string()),
            last_opened: None,
        }
    }
}

/// Get the config file path (~/.config/forge-shell/config.json)
fn get_config_path() -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| "Could not determine config directory".to_string())?;

    let app_config_dir = config_dir.join("forge-shell");

    // Create directory if it doesn't exist
    if !app_config_dir.exists() {
        fs::create_dir_all(&app_config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    Ok(app_config_dir.join("config.json"))
}

/// Load configuration from disk
fn load_config() -> Result<AppConfig, String> {
    let config_path = get_config_path()?;

    if !config_path.exists() {
        return Ok(AppConfig::default());
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config file: {}", e))?;

    let config: AppConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse config file: {}", e))?;

    Ok(config)
}

/// Save configuration to disk
fn save_config(config: &AppConfig) -> Result<(), String> {
    let config_path = get_config_path()?;

    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write config file: {}", e))?;

    Ok(())
}

/// Get the current project path
#[tauri::command]
pub fn get_project_path() -> Result<Option<String>, String> {
    let config = load_config()?;
    Ok(config.current_project)
}

/// Set the current project path
#[tauri::command]
pub fn set_project_path(path: String) -> Result<(), String> {
    let mut config = load_config().unwrap_or_default();

    config.current_project = Some(path.clone());
    config.last_opened = Some(chrono::Utc::now().to_rfc3339());

    // Add to recent projects if not already there
    if !config.recent_projects.contains(&path) {
        config.recent_projects.insert(0, path.clone());

        // Keep only the last 10 recent projects
        if config.recent_projects.len() > 10 {
            config.recent_projects.truncate(10);
        }
    } else {
        // Move to front
        config.recent_projects.retain(|p| p != &path);
        config.recent_projects.insert(0, path);
    }

    save_config(&config)?;
    Ok(())
}

/// Get the list of recent projects
#[tauri::command]
pub fn get_recent_projects() -> Result<Vec<String>, String> {
    let config = load_config()?;
    Ok(config.recent_projects)
}

/// Get the current theme
#[tauri::command]
pub fn get_theme() -> Result<String, String> {
    let config = load_config()?;
    Ok(config.theme.unwrap_or_else(|| "light".to_string()))
}

/// Set the current theme
#[tauri::command]
pub fn set_theme(theme: String) -> Result<(), String> {
    let mut config = load_config().unwrap_or_default();
    config.theme = Some(theme);
    save_config(&config)?;
    Ok(())
}
