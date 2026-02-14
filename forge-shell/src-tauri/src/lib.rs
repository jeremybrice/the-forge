// Module declarations
mod fs_commands;
mod config;
mod watcher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      // File system commands
      fs_commands::read_file,
      fs_commands::write_file,
      fs_commands::read_dir,
      fs_commands::list_md_files,
      fs_commands::get_file_meta,
      fs_commands::create_directory,
      fs_commands::delete_file,
      // Config commands
      config::get_project_path,
      config::set_project_path,
      config::get_recent_projects,
      config::get_theme,
      config::set_theme,
      // Watcher commands
      watcher::watch_directory,
      watcher::unwatch_directory,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
