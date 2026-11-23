mod commands;

use quark_core::{AppCore, CoreConfig};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, WindowEvent};

pub struct AppState {
    pub core: AppCore,
}

fn show_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn setup_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
    let transfers = MenuItem::with_id(app, "transfers", "传输中心", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出夸克网盘", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &show,
            &transfers,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;

    let mut builder = TrayIconBuilder::with_id("main-tray")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .tooltip("夸克网盘")
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_main(app),
            "transfers" => {
                show_main(app);
                let _ = app.emit("tray://transfers", ());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "quark_drive=info,quark_core=info,warn".into()),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            show_main(app);
        }))
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| dirs::data_dir().unwrap_or_default().join("quark-drive"));
            let config = CoreConfig {
                data_dir,
                ..CoreConfig::default()
            };
            let core = tauri::async_runtime::block_on(AppCore::new(config))
                .map_err(|err| Box::<dyn std::error::Error>::from(err.to_string()))?;
            let state = AppState { core: core.clone() };
            app.manage(state);

            let mut events = core.subscribe();
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                while let Ok(event) = events.recv().await {
                    let _ = handle.emit("core://event", event);
                }
            });

            // 托盘创建成功时，关闭窗口只隐藏，后台继续传输。
            let tray_ok = setup_tray(app.handle()).is_ok();
            if tray_ok {
                if let Some(window) = app.get_webview_window("main") {
                    let w = window.clone();
                    window.on_window_event(move |event| {
                        if let WindowEvent::CloseRequested { api, .. } = event {
                            api.prevent_close();
                            let _ = w.hide();
                        }
                    });
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_bootstrap,
            commands::start_qr_login,
            commands::poll_qr_login,
            commands::cancel_qr_login,
            commands::import_cookie,
            commands::logout,
            commands::refresh_account,
            commands::list_dir,
            commands::privacy_registered,
            commands::privacy_unlock,
            commands::privacy_list_dir,
            commands::privacy_lock,
            commands::privacy_move_files,
            commands::privacy_enqueue_upload,
            commands::privacy_enqueue_download,
            commands::cached_files,
            commands::mkdir,
            commands::rename,
            commands::move_files,
            commands::delete_files,
            commands::list_recycle,
            commands::restore_recycle,
            commands::delete_recycle,
            commands::clear_recycle,
            commands::enqueue_upload,
            commands::enqueue_download,
            commands::list_transfers,
            commands::pause_transfer,
            commands::resume_transfer,
            commands::cancel_transfer,
            commands::retry_transfer,
            commands::remove_transfer,
            commands::clear_finished_transfers,
            commands::get_settings,
            commands::update_settings,
            commands::pick_files,
            commands::pick_folder,
            commands::open_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
