#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![])
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_store::PluginBuilder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
