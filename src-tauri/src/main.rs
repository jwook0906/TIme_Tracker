#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod state;
mod store;
mod tracker;

use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri::menu::{MenuBuilder, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            app.manage(Mutex::new(store::load()));

            // 시스템 트레이 메뉴
            let open_item = MenuItem::with_id(app, "open", "열기", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
            let menu = MenuBuilder::new(app)
                .items(&[&open_item, &quit_item])
                .build()?;

            TrayIconBuilder::new()
                .icon(tauri::include_image!("icons/icon.png"))
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
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
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut tick: u64 = 0;
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(1));
                    tick += 1;

                    let (process_name, idle_seconds) = tracker::get_active_info();
                    let state_mutex = handle.state::<Mutex<state::AppState>>();
                    let mut s = state_mutex.lock().unwrap();

                    // 날짜가 바뀌면 전날 기록을 히스토리로 이동 (개발자 모드의 가상 날짜가 설정된 경우 그 날짜를 기준으로 함)
                    let today = s.dev_date_override.clone().unwrap_or_else(state::today_date_string);
                    if s.date != today {
                        store::rollover(&mut s, today);
                    }

                    let prev = s.active_process.clone();
                    s.active_process = process_name.clone();

                    let is_idle = idle_seconds >= s.idle_threshold;
                    let mut is_tracked = false;
                    if !is_idle {
                        if let Some(ref name) = process_name {
                            if s.selected_programs.contains(name) {
                                *s.times.entry(name.clone()).or_insert(0) += 1;
                                is_tracked = true;
                            }
                        }
                    }
                    // 비작업 시간 = 사용자가 활동 중이지만 추적 대상이 아닌 프로그램을 사용 중인 시간 (딴짓/idle 시간 제외)
                    if !is_idle && !is_tracked {
                        s.away_seconds += 1;
                    }

                    let payload = serde_json::json!({
                        "times": s.times,
                        "awaySeconds": s.away_seconds,
                        "activeProcess": process_name,
                        "isIdle": is_idle,
                        "idleSeconds": idle_seconds,
                        "changed": process_name != prev,
                    });

                    if tick % 30 == 0 {
                        store::save(&s);
                    }

                    drop(s);
                    let _ = handle.emit("timer-update", payload);
                }
            });

            Ok(())
        })
        // X 버튼 클릭 시 종료 대신 트레이로 최소화
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_version,
            commands::get_state,
            commands::get_running_processes,
            commands::add_program,
            commands::remove_program,
            commands::reset_timer,
            commands::reset_all_timers,
            commands::set_idle_threshold,
            commands::set_mini_mode,
            commands::get_history,
            commands::clear_history,
            commands::dev_set_virtual_date,
            commands::dev_set_time,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
