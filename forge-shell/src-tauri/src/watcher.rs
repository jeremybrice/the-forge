use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{new_debouncer, DebounceEventResult, Debouncer};
use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

struct ActiveWatcher {
    path: String,
    _debouncer: Debouncer<RecommendedWatcher>,
}

pub struct WatcherState {
    watcher: Mutex<Option<ActiveWatcher>>,
}

impl WatcherState {
    pub fn new() -> Self {
        Self {
            watcher: Mutex::new(None),
        }
    }
}

/// Start watching a directory for changes
#[tauri::command]
pub fn watch_directory(
    path: String,
    app_handle: AppHandle,
    state: State<WatcherState>,
) -> Result<(), String> {
    log::info!("Starting file watcher for: {}", path);

    let mut guard = state
        .watcher
        .lock()
        .map_err(|_| "Watcher state lock poisoned".to_string())?;

    // Idempotent for the same path.
    if let Some(active) = guard.as_ref() {
        if active.path == path {
            log::info!("Watcher already active for: {}", path);
            return Ok(());
        }
    }

    // Drop existing watcher by replacing it.
    if let Some(active) = guard.take() {
        log::info!("Replacing existing watcher for: {}", active.path);
    }

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

    *guard = Some(ActiveWatcher {
        path: path.clone(),
        _debouncer: debouncer,
    });

    Ok(())
}

/// Stop watching a directory
#[tauri::command]
pub fn unwatch_directory(path: String, state: State<WatcherState>) -> Result<(), String> {
    log::info!("Stopping file watcher for: {}", path);

    let mut guard = state
        .watcher
        .lock()
        .map_err(|_| "Watcher state lock poisoned".to_string())?;

    match guard.as_ref() {
        None => Ok(()),
        Some(active) if active.path == path => {
            guard.take();
            Ok(())
        }
        Some(_) => Ok(()),
    }
}
