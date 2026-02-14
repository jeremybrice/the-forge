use notify::{RecursiveMode, Watcher};
use notify_debouncer_mini::{new_debouncer, DebouncedEvent, DebounceEventResult};
use std::path::Path;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// Start watching a directory for changes
#[tauri::command]
pub fn watch_directory(
    path: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    log::info!("Starting file watcher for: {}", path);

    let path_clone = path.clone();

    // Create a debounced watcher with 500ms debounce
    let mut debouncer = new_debouncer(
        Duration::from_millis(500),
        move |res: DebounceEventResult| {
            match res {
                Ok(events) => {
                    for event in events {
                        // Only emit events for .md files
                        if let Some(path_str) = event.path.to_str() {
                            if path_str.ends_with(".md") {
                                log::info!("File changed: {}", path_str);

                                // Emit event to frontend
                                if let Err(e) = app_handle.emit("file-changed", serde_json::json!({
                                    "path": path_str
                                })) {
                                    log::error!("Failed to emit file-changed event: {}", e);
                                }
                            }
                        }
                    }
                }
                Err(error) => {
                    log::error!("File watcher error: {:?}", error);
                }
            }
        },
    ).map_err(|e| format!("Failed to create file watcher: {}", e))?;

    // Start watching the directory recursively
    debouncer
        .watcher()
        .watch(Path::new(&path), RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch directory: {}", e))?;

    log::info!("File watcher successfully started for: {}", path);

    // Keep the debouncer alive by storing it somewhere
    // In a real implementation, you'd want to store this in app state
    // For now, we'll let it live as long as the app does
    std::mem::forget(debouncer);

    Ok(())
}

/// Stop watching a directory (placeholder for cleanup)
#[tauri::command]
pub fn unwatch_directory(path: String) -> Result<(), String> {
    log::info!("Stopping file watcher for: {}", path);
    // In a production app, you'd track watchers and stop them here
    Ok(())
}
