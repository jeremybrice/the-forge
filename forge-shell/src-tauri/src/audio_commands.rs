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
    _app: AppHandle,
    _state: State<'_, RecorderState>,
    _project_root: String,
    _sources: Vec<String>,
) -> Result<StartedRecording, String> {
    Err("start_recording not implemented yet (Task 11)".to_string())
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
