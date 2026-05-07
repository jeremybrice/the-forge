//! Audio recording commands for the audio-forge plugin.
//!
//! Spawns the `forge-recorder` Swift sidecar and pumps its line-delimited JSON
//! events to the frontend via Tauri events. Persists the active recording's
//! state in <project>/audio-forge/active.json so a Forge Shell crash can be
//! recovered on the next launch.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveRecording {
    pub id: String,
    pub project_root: String,
    pub started_at: String,
    pub sources: Vec<String>,
    pub files: AudioFiles,
    pub pid: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AudioFiles {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mic: Option<String>,
}

pub struct RecorderState {
    inner: Mutex<Option<RecorderHandle>>,
}

impl RecorderState {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }
}

struct RecorderHandle {
    id: String,
    project_root: String,
    sources: Vec<String>,
    started_at: String,
    files: AudioFiles,
    pid: u32,
    stdin: Box<dyn StdinSink + Send>,
}

trait StdinSink {
    fn send_line(&mut self, line: &str) -> Result<(), String>;
}

impl StdinSink for tauri_plugin_shell::process::CommandChild {
    fn send_line(&mut self, line: &str) -> Result<(), String> {
        let mut buf = line.as_bytes().to_vec();
        if !line.ends_with('\n') {
            buf.push(b'\n');
        }
        self.write(&buf).map_err(|e| format!("sidecar stdin write: {e}"))
    }
}

#[derive(Debug, Serialize)]
pub struct StartedRecording {
    pub id: String,
    pub files: AudioFiles,
}

#[derive(Debug, Serialize)]
pub struct StoppedRecording {
    pub id: String,
    pub duration_seconds: u64,
    pub files: AudioFiles,
}

#[derive(Debug, Serialize)]
pub struct RecordingStatus {
    pub is_recording: bool,
    pub id: Option<String>,
    pub elapsed_seconds: Option<u64>,
}

// ----------------- Commands (stubs filled in by Tasks 11-13) -----------------

#[tauri::command]
pub async fn start_recording(
    app: AppHandle,
    state: State<'_, RecorderState>,
    project_root: String,
    sources: Vec<String>,
) -> Result<StartedRecording, String> {
    // Reject if a recording is already in progress
    {
        let guard = state.inner.lock().map_err(|_| "state lock poisoned".to_string())?;
        if guard.is_some() {
            return Err("a recording is already in progress".to_string());
        }
    }

    // Generate id (YYYY-MM-DDTHHMMSS)
    let now = chrono::Utc::now();
    let id = now.format("%Y-%m-%dT%H%M%S").to_string();

    // Ensure audio-forge/audio/ exists
    let out_dir = audio_forge_root(&project_root).join("audio");
    std::fs::create_dir_all(&out_dir)
        .map_err(|e| format!("create audio dir: {e}"))?;

    // Spawn the sidecar
    let shell = app.shell();
    let (mut rx, mut child) = shell
        .sidecar("forge-recorder")
        .map_err(|e| format!("sidecar lookup: {e}"))?
        .spawn()
        .map_err(|e| format!("sidecar spawn: {e}"))?;

    let pid = child.pid();

    // Send the start command
    let start_cmd = serde_json::json!({
        "cmd": "start",
        "outDir": out_dir.to_string_lossy(),
        "id": id,
        "sources": sources,
    });
    let line = format!("{}\n", start_cmd);
    child.write(line.as_bytes()).map_err(|e| format!("sidecar stdin: {e}"))?;

    // Wait for `started` or `error` (timeout 30 s)
    let mut started_files = AudioFiles::default();
    let mut got_started = false;
    let mut start_err: Option<String> = None;

    let started_event_type: &str = "started";
    let error_event_type: &str = "error";

    let timeout = std::time::Duration::from_secs(30);
    let start_instant = std::time::Instant::now();

    while start_instant.elapsed() < timeout {
        // Check timeout before awaiting next event
        if start_instant.elapsed() >= timeout { break; }
        match rx.recv().await {
            Some(CommandEvent::Stdout(bytes)) => {
                let line = String::from_utf8_lossy(&bytes).to_string();
                for raw in line.lines() {
                    let trimmed = raw.trim();
                    if trimmed.is_empty() { continue; }
                    if let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) {
                        let evt = value.get("event").and_then(|v| v.as_str()).unwrap_or("");
                        if evt == started_event_type {
                            got_started = true;
                            if let Some(files) = value.get("files") {
                                started_files.system = files.get("system").and_then(|v| v.as_str()).map(String::from);
                                started_files.mic = files.get("mic").and_then(|v| v.as_str()).map(String::from);
                            }
                        } else if evt == error_event_type {
                            start_err = Some(value.get("message").and_then(|v| v.as_str()).unwrap_or("sidecar error").to_string());
                        }
                    }
                }
                if got_started { break; }
                if start_err.is_some() { break; }
            }
            Some(CommandEvent::Stderr(bytes)) => {
                let line = String::from_utf8_lossy(&bytes).to_string();
                log::warn!("forge-recorder stderr: {}", line.trim());
            }
            Some(CommandEvent::Terminated(_)) => {
                start_err = Some("sidecar terminated before started event".to_string());
                break;
            }
            Some(_) => {}
            None => break,
        }
    }

    if let Some(msg) = start_err {
        let _ = child.kill();
        return Err(msg);
    }
    if !got_started {
        let _ = child.kill();
        return Err("timed out waiting for started event".to_string());
    }

    // Persist active.json
    let started_at = now.to_rfc3339();
    let active = ActiveRecording {
        id: id.clone(),
        project_root: project_root.clone(),
        started_at: started_at.clone(),
        sources: sources.clone(),
        files: started_files.clone(),
        pid,
    };
    write_active_state(&project_root, &active)?;

    // Insert handle into state
    let stdin: Box<dyn StdinSink + Send> = Box::new(child);
    {
        let mut guard = state.inner.lock().map_err(|_| "state lock poisoned".to_string())?;
        *guard = Some(RecorderHandle {
            id: id.clone(),
            project_root: project_root.clone(),
            sources,
            started_at,
            files: started_files.clone(),
            pid,
            stdin,
        });
    }

    // Forward subsequent events to the frontend
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    let line = String::from_utf8_lossy(&bytes).to_string();
                    for raw in line.lines() {
                        let trimmed = raw.trim();
                        if trimmed.is_empty() { continue; }
                        if let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) {
                            let evt = value.get("event").and_then(|v| v.as_str()).unwrap_or("");
                            // Forward all events under a single channel namespace
                            let _ = app_handle.emit(&format!("audio-forge://{}", evt), value);
                        }
                    }
                }
                CommandEvent::Stderr(bytes) => {
                    let line = String::from_utf8_lossy(&bytes).to_string();
                    log::warn!("forge-recorder stderr: {}", line.trim());
                }
                CommandEvent::Terminated(_) => {
                    let _ = app_handle.emit("audio-forge://terminated", serde_json::json!({}));
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(StartedRecording {
        id,
        files: started_files,
    })
}

fn write_active_state(project_root: &str, active: &ActiveRecording) -> Result<(), String> {
    let path = active_state_path(project_root);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("create active.json parent: {e}"))?;
    }
    let json = serde_json::to_string_pretty(active).map_err(|e| format!("serialize active.json: {e}"))?;
    std::fs::write(&path, json).map_err(|e| format!("write active.json: {e}"))?;
    Ok(())
}

fn delete_active_state(project_root: &str) {
    let _ = std::fs::remove_file(active_state_path(project_root));
}

#[tauri::command]
pub async fn stop_recording(
    _app: AppHandle,
    _state: State<'_, RecorderState>,
) -> Result<StoppedRecording, String> {
    Err("stop_recording not implemented yet (Task 12)".to_string())
}

#[tauri::command]
pub fn get_recording_status(state: State<'_, RecorderState>) -> RecordingStatus {
    let guard = state.inner.lock().unwrap();
    if let Some(handle) = guard.as_ref() {
        RecordingStatus {
            is_recording: true,
            id: Some(handle.id.clone()),
            elapsed_seconds: None,
        }
    } else {
        RecordingStatus {
            is_recording: false,
            id: None,
            elapsed_seconds: None,
        }
    }
}

#[tauri::command]
pub async fn recover_orphaned_recording(
    _app: AppHandle,
    _state: State<'_, RecorderState>,
    _project_root: String,
) -> Result<Option<ActiveRecording>, String> {
    Err("recover_orphaned_recording not implemented yet (Task 13)".to_string())
}

#[tauri::command]
pub async fn run_recording_create(
    _app: AppHandle,
    _project_root: String,
    _id: String,
    _title: String,
    _duration_seconds: u32,
    _sources: Vec<String>,
    _files: AudioFiles,
) -> Result<String, String> {
    Err("run_recording_create not implemented yet (Task 14)".to_string())
}

#[tauri::command]
pub async fn run_recording_transcribe(
    _app: AppHandle,
    _project_root: String,
    _id: String,
    _model: Option<String>,
) -> Result<String, String> {
    Err("run_recording_transcribe not implemented yet (Task 14)".to_string())
}

// ----------------- Helpers -----------------

fn audio_forge_root(project_root: &str) -> PathBuf {
    Path::new(project_root).join("audio-forge")
}

fn active_state_path(project_root: &str) -> PathBuf {
    audio_forge_root(project_root).join("active.json")
}
