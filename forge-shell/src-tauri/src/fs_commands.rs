use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub modified: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileMeta {
    pub modified: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirEntry {
    pub name: String,
    pub kind: String,
}

/// Read a file's contents
#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file {}: {}", path, e))
}

/// Write content to a file
#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    // Ensure parent directory exists
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directories: {}", e))?;
    }

    fs::write(&path, content)
        .map_err(|e| format!("Failed to write file {}: {}", path, e))
}

/// List entries in a directory
#[tauri::command]
pub fn read_dir(path: String) -> Result<Vec<DirEntry>, String> {
    let entries = fs::read_dir(&path)
        .map_err(|e| format!("Failed to read directory {}: {}", path, e))?;

    let mut result = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let metadata = entry.metadata()
            .map_err(|e| format!("Failed to get metadata: {}", e))?;

        let kind = if metadata.is_dir() { "directory" } else { "file" };

        if let Some(name) = entry.file_name().to_str() {
            result.push(DirEntry {
                name: name.to_string(),
                kind: kind.to_string(),
            });
        }
    }

    Ok(result)
}

/// Recursively list all .md files in a directory
#[tauri::command]
pub fn list_md_files(dir_path: String, subdir: String) -> Result<Vec<FileInfo>, String> {
    let full_path = if subdir.is_empty() {
        dir_path.clone()
    } else {
        format!("{}/{}", dir_path, subdir)
    };

    let path = Path::new(&full_path);
    if !path.exists() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    collect_md_files(path, "", &mut files)?;

    Ok(files)
}

/// Helper function to recursively collect .md files
fn collect_md_files(dir: &Path, relative_path: &str, accumulator: &mut Vec<FileInfo>) -> Result<(), String> {
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        let metadata = entry.metadata()
            .map_err(|e| format!("Failed to get metadata: {}", e))?;

        let file_name = entry.file_name();
        let name_str = file_name.to_str()
            .ok_or_else(|| "Invalid file name".to_string())?;

        let entry_path = if relative_path.is_empty() {
            name_str.to_string()
        } else {
            format!("{}/{}", relative_path, name_str)
        };

        if metadata.is_dir() {
            collect_md_files(&path, &entry_path, accumulator)?;
        } else if metadata.is_file() && name_str.ends_with(".md") {
            let modified = metadata.modified()
                .map_err(|e| format!("Failed to get modification time: {}", e))?
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|e| format!("Failed to calculate duration: {}", e))?
                .as_millis() as u64;

            accumulator.push(FileInfo {
                name: name_str.to_string(),
                path: entry_path,
                modified,
            });
        }
    }

    Ok(())
}

/// Get file metadata (mainly modification time)
#[tauri::command]
pub fn get_file_meta(path: String) -> Result<FileMeta, String> {
    let metadata = fs::metadata(&path)
        .map_err(|e| format!("Failed to get file metadata for {}: {}", path, e))?;

    let modified = metadata.modified()
        .map_err(|e| format!("Failed to get modification time: {}", e))?
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to calculate duration: {}", e))?
        .as_millis() as u64;

    Ok(FileMeta { modified })
}

/// Create a directory (and all parent directories if needed)
#[tauri::command]
pub fn create_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(&path)
        .map_err(|e| format!("Failed to create directory {}: {}", path, e))
}

/// Delete a file
#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    fs::remove_file(&path)
        .map_err(|e| format!("Failed to delete file {}: {}", path, e))
}
