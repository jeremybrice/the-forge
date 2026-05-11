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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioInputDevice {
    pub uid: String,
    pub name: String,
    #[serde(rename = "isDefault")]
    pub is_default: bool,
    pub channels: u32,
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
    mic_device_uid: Option<String>,
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
        // Optional. When present and non-empty, the recorder will set this
        // device as the input on AVAudioEngine before starting. When null or
        // empty, the recorder uses the system default input.
        "micDeviceUID": mic_device_uid.as_deref().unwrap_or(""),
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
        match tokio::time::timeout(std::time::Duration::from_secs(1), rx.recv()).await {
            Ok(Some(CommandEvent::Stdout(bytes))) => {
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
            Ok(Some(CommandEvent::Stderr(bytes))) => {
                let line = String::from_utf8_lossy(&bytes).to_string();
                log::warn!("forge-recorder stderr: {}", line.trim());
            }
            Ok(Some(CommandEvent::Terminated(_))) => {
                start_err = Some("sidecar terminated before started event".to_string());
                break;
            }
            Ok(Some(_)) => {}
            Ok(None) => break,
            Err(_) => continue,
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
    state: State<'_, RecorderState>,
) -> Result<StoppedRecording, String> {
    // Take ownership of the handle so we don't hold the lock across await
    let mut handle = {
        let mut guard = state.inner.lock().map_err(|_| "state lock poisoned".to_string())?;
        guard.take().ok_or_else(|| "no recording in progress".to_string())?
    };

    // Send the stop command
    handle.stdin.send_line("{\"cmd\":\"stop\"}")?;

    // The forwarding task spawned in start_recording will see the `stopped`
    // event on stdout and emit it. We don't have direct access to that channel
    // here, so we wait briefly for the sidecar to write the WAVs and exit.
    // 5 s is generous for closing files; ScreenCaptureKit teardown can take ~2 s.
    tokio::time::sleep(std::time::Duration::from_secs(5)).await;

    // Compute duration from the recorded started_at
    let started_at: chrono::DateTime<chrono::Utc> = chrono::DateTime::parse_from_rfc3339(&handle.started_at)
        .map_err(|e| format!("parse started_at: {e}"))?
        .with_timezone(&chrono::Utc);
    let elapsed = chrono::Utc::now() - started_at;
    let duration_seconds = elapsed.num_seconds().max(0) as u64;

    // Clean up active.json
    delete_active_state(&handle.project_root);

    Ok(StoppedRecording {
        id: handle.id,
        duration_seconds,
        files: handle.files,
    })
}

#[tauri::command]
pub fn get_recording_status(state: State<'_, RecorderState>) -> RecordingStatus {
    let guard = state.inner.lock().unwrap();
    if let Some(handle) = guard.as_ref() {
        let elapsed = chrono::DateTime::parse_from_rfc3339(&handle.started_at)
            .ok()
            .map(|dt| {
                let elapsed = chrono::Utc::now() - dt.with_timezone(&chrono::Utc);
                elapsed.num_seconds().max(0) as u64
            });
        RecordingStatus {
            is_recording: true,
            id: Some(handle.id.clone()),
            elapsed_seconds: elapsed,
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
    state: State<'_, RecorderState>,
    project_root: String,
) -> Result<Option<ActiveRecording>, String> {
    let path = active_state_path(&project_root);
    if !path.exists() {
        return Ok(None);
    }
    // If we already have an in-flight recording in this process, the file isn't
    // an orphan — somebody just hasn't called stop yet.
    {
        let guard = state.inner.lock().map_err(|_| "state lock poisoned".to_string())?;
        if guard.is_some() {
            return Ok(None);
        }
    }

    let raw = std::fs::read_to_string(&path).map_err(|e| format!("read active.json: {e}"))?;
    let active: ActiveRecording = serde_json::from_str(&raw)
        .map_err(|e| format!("parse active.json: {e}"))?;

    // Optional: check whether the PID is still alive. If it is, it's not an
    // orphan; the previous Forge Shell is still running. Don't return it as
    // recoverable — that user can use that other window.
    if pid_is_alive(active.pid) {
        return Ok(None);
    }

    Ok(Some(active))
}

#[cfg(unix)]
fn pid_is_alive(pid: u32) -> bool {
    // kill(pid, 0) returns 0 if the process exists.
    unsafe {
        libc::kill(pid as libc::pid_t, 0) == 0
    }
}

#[cfg(not(unix))]
fn pid_is_alive(_pid: u32) -> bool {
    false
}

#[tauri::command]
pub async fn run_recording_create(
    app: AppHandle,
    project_root: String,
    id: String,
    title: String,
    duration_seconds: u32,
    sources: Vec<String>,
    files: AudioFiles,
) -> Result<String, String> {
    // Compose the JSON payload
    let now = chrono::Utc::now();
    let created = now.format("%Y-%m-%dT%H:%M:%S").to_string();

    let mut audio_files_json = serde_json::Map::new();
    if let Some(p) = files.system.as_ref() {
        // Convert absolute path to project-relative
        let rel = relativize_audio(&project_root, p);
        audio_files_json.insert("system".to_string(), serde_json::Value::String(rel));
    }
    if let Some(p) = files.mic.as_ref() {
        let rel = relativize_audio(&project_root, p);
        audio_files_json.insert("mic".to_string(), serde_json::Value::String(rel));
    }

    let payload = serde_json::json!({
        "id": id,
        "title": title,
        "created": created,
        "duration_seconds": duration_seconds,
        "sources": sources,
        "audio_files": audio_files_json,
    });

    let payload_arg = payload.to_string();

    let workdir = resolve_forge_lib_workdir(&app, &project_root)?;
    let shell = app.shell();
    let output = shell
        .command("python3")
        .args([
            "forge-lib/forge.py",
            "recording",
            "create",
            "--directory",
            &project_root,
            "--data",
            &payload_arg,
        ])
        .current_dir(workdir)
        .output()
        .await
        .map_err(|e| format!("forge recording create exec: {e}"))?;

    if !output.status.success() {
        return Err(format!(
            "forge recording create failed (exit {:?}): stdout={} stderr={}",
            output.status.code(),
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let envelope: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("parse forge envelope: {e}: {stdout}"))?;
    let file_path = envelope
        .get("data")
        .and_then(|d| d.get("file_path"))
        .and_then(|s| s.as_str())
        .ok_or_else(|| "envelope missing data.file_path".to_string())?
        .to_string();
    Ok(file_path)
}

#[tauri::command]
pub async fn run_recording_transcribe(
    app: AppHandle,
    project_root: String,
    id: String,
    model: Option<String>,
) -> Result<String, String> {
    let shell = app.shell();

    let mut args: Vec<String> = vec![
        "forge-lib/forge.py".into(),
        "recording".into(),
        "transcribe".into(),
        id.clone(),
        "--directory".into(),
        project_root.clone(),
    ];
    if let Some(m) = model {
        args.push("--model".into());
        args.push(m);
    }

    let workdir = resolve_forge_lib_workdir(&app, &project_root)?;
    let output = shell
        .command("python3")
        .args(args.iter().map(|s| s.as_str()))
        .current_dir(workdir)
        .output()
        .await
        .map_err(|e| format!("forge recording transcribe exec: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let envelope: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("parse transcribe envelope: {e}: {stdout}"))?;

    let success = envelope
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if !success {
        let err = envelope
            .get("error")
            .and_then(|s| s.as_str())
            .unwrap_or("transcribe failed");
        return Err(err.to_string());
    }

    let file_path = envelope
        .get("data")
        .and_then(|d| d.get("file_path"))
        .and_then(|s| s.as_str())
        .ok_or_else(|| "envelope missing data.file_path".to_string())?
        .to_string();
    Ok(file_path)
}

fn relativize_audio(project_root: &str, abs_path: &str) -> String {
    let pr = std::path::Path::new(project_root);
    let p = std::path::Path::new(abs_path);
    if let Ok(rel) = p.strip_prefix(pr) {
        rel.to_string_lossy().to_string()
    } else {
        abs_path.to_string()
    }
}

/// Returns the working directory python3 should run from so that
/// `forge-lib/forge.py …` is the correct relative invocation. Prefers the
/// user's project-local forge-lib WHEN IT SUPPORTS the recording subcommand
/// (so per-project schema customization keeps working for new-enough
/// forge-libs); otherwise falls back to the bundled forge-lib in the Tauri
/// resource directory.
///
/// We detect "supports recording" by probing for `core/recording_ops.py` —
/// that file only exists in Phase 1+ forge-libs. Older copies fail loudly
/// at runtime with `forge: error: argument command: invalid choice:
/// 'recording'`, so this guard avoids a confusing user-facing toast.
fn resolve_forge_lib_workdir(app: &AppHandle, project_root: &str) -> Result<PathBuf, String> {
    let project_forge_lib = Path::new(project_root).join("forge-lib");
    let project_forge_py = project_forge_lib.join("forge.py");
    let project_recording_ops = project_forge_lib.join("core").join("recording_ops.py");
    if project_forge_py.is_file() && project_recording_ops.is_file() {
        return Ok(PathBuf::from(project_root));
    }
    let resource_dir = app.path()
        .resource_dir()
        .map_err(|e| format!("resource_dir lookup failed: {e}"))?;
    let bundled_forge_py = resource_dir.join("forge-lib").join("forge.py");
    if bundled_forge_py.is_file() {
        return Ok(resource_dir);
    }
    Err(format!(
        "forge-lib with recording support not found in project ({}/forge-lib) or in app bundle ({:?})",
        project_root, resource_dir.join("forge-lib")
    ))
}

// ----------------- Helpers -----------------

fn audio_forge_root(project_root: &str) -> PathBuf {
    Path::new(project_root).join("audio-forge")
}

fn active_state_path(project_root: &str) -> PathBuf {
    audio_forge_root(project_root).join("active.json")
}

#[tauri::command]
pub async fn list_audio_devices(app: AppHandle) -> Result<Vec<AudioInputDevice>, String> {
    let shell = app.shell();
    let (mut rx, mut child) = shell
        .sidecar("forge-recorder")
        .map_err(|e| format!("sidecar lookup: {e}"))?
        .spawn()
        .map_err(|e| format!("sidecar spawn: {e}"))?;

    child
        .write(b"{\"cmd\":\"list_devices\"}\n")
        .map_err(|e| format!("sidecar stdin: {e}"))?;

    let timeout = std::time::Duration::from_secs(3);
    let start = std::time::Instant::now();

    while start.elapsed() < timeout {
        match tokio::time::timeout(std::time::Duration::from_millis(500), rx.recv()).await {
            Ok(Some(CommandEvent::Stdout(bytes))) => {
                let line = String::from_utf8_lossy(&bytes).to_string();
                for raw in line.lines() {
                    let trimmed = raw.trim();
                    if trimmed.is_empty() {
                        continue;
                    }
                    if let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) {
                        if value.get("event").and_then(|v| v.as_str()) == Some("devices") {
                            let _ = child.kill();
                            let arr = value
                                .get("devices")
                                .and_then(|v| v.as_array())
                                .cloned()
                                .unwrap_or_default();
                            let devices: Vec<AudioInputDevice> = arr
                                .into_iter()
                                .filter_map(|v| serde_json::from_value(v).ok())
                                .collect();
                            return Ok(devices);
                        }
                    }
                }
            }
            Ok(Some(CommandEvent::Stderr(_))) => {}
            Ok(Some(CommandEvent::Terminated(_))) => break,
            Ok(Some(_)) => {}
            Ok(None) => break,
            Err(_) => continue,
        }
    }
    let _ = child.kill();
    Err("timed out waiting for devices event".to_string())
}

/// Delete a recording (markdown + referenced WAVs + index entry) via forge-lib.
///
/// `relative_path` is the markdown file's path relative to the project root,
/// e.g., `audio-forge/recordings/2026-05-11-recording-2026-05-11-0214-2.md`.
/// The frontend already has this as `recording.path` from its scan, so it can
/// be passed straight through. forge-lib's CLI expects an absolute path; we
/// resolve here.
#[tauri::command]
pub async fn run_recording_delete(
    app: AppHandle,
    project_root: String,
    relative_path: String,
) -> Result<(), String> {
    let abs_path = Path::new(&project_root)
        .join(&relative_path)
        .to_string_lossy()
        .to_string();

    let workdir = resolve_forge_lib_workdir(&app, &project_root)?;
    let shell = app.shell();
    let output = shell
        .command("python3")
        .args([
            "forge-lib/forge.py",
            "recording",
            "delete",
            &abs_path,
            "--directory",
            &project_root,
        ])
        .current_dir(workdir)
        .output()
        .await
        .map_err(|e| format!("forge recording delete exec: {e}"))?;

    if !output.status.success() {
        return Err(format!(
            "forge recording delete failed (exit {:?}): stdout={} stderr={}",
            output.status.code(),
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let envelope: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("parse forge envelope: {e}: {stdout}"))?;
    let success = envelope
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if !success {
        let err = envelope
            .get("error")
            .and_then(|s| s.as_str())
            .unwrap_or("delete failed");
        return Err(err.to_string());
    }
    Ok(())
}
