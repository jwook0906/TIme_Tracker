use std::sync::Mutex;
use serde_json::{json, Value};
use tauri::{AppHandle, Manager, State};
use crate::state::{self, AppState, DailyRecord, MAX_PROGRAMS};
use crate::store;
use crate::tracker;

#[tauri::command]
pub fn get_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
pub fn get_state(state: State<'_, Mutex<AppState>>) -> Value {
    let s = state.lock().unwrap();
    json!({
        "selectedPrograms": s.selected_programs,
        "times": s.times,
        "awaySeconds": s.away_seconds,
        "activeProcess": s.active_process,
        "maxPrograms": MAX_PROGRAMS,
        "idleThreshold": s.idle_threshold,
        "date": s.date,
        "devDateOverride": s.dev_date_override,
    })
}

#[tauri::command]
pub fn get_running_processes() -> Vec<String> {
    tracker::get_running_processes()
}

#[tauri::command]
pub fn add_program(name: String, state: State<'_, Mutex<AppState>>) -> Value {
    let mut s = state.lock().unwrap();
    let name = name.trim().to_lowercase();

    if name.is_empty() {
        return json!({"ok": false, "error": "이름이 비어있습니다."});
    }
    if s.selected_programs.len() >= MAX_PROGRAMS {
        return json!({"ok": false, "error": format!("최대 {}개까지 추가할 수 있습니다.", MAX_PROGRAMS)});
    }
    if s.selected_programs.contains(&name) {
        return json!({"ok": false, "error": "이미 추가된 프로그램입니다."});
    }

    s.selected_programs.push(name.clone());
    s.times.entry(name).or_insert(0);
    store::save(&s);
    json!({"ok": true})
}

#[tauri::command]
pub fn remove_program(name: String, state: State<'_, Mutex<AppState>>) -> Value {
    let mut s = state.lock().unwrap();
    s.selected_programs.retain(|p| p != &name);
    store::save(&s);
    json!({"ok": true})
}

#[tauri::command]
pub fn reset_timer(name: String, state: State<'_, Mutex<AppState>>) -> Value {
    let mut s = state.lock().unwrap();
    s.times.insert(name, 0);
    store::save(&s);
    json!({"ok": true})
}

#[tauri::command]
pub fn reset_all_timers(state: State<'_, Mutex<AppState>>) -> Value {
    let mut s = state.lock().unwrap();
    let programs: Vec<String> = s.selected_programs.clone();
    for name in programs {
        s.times.insert(name, 0);
    }
    s.away_seconds = 0;
    store::save(&s);
    json!({"ok": true})
}

#[tauri::command]
pub fn set_idle_threshold(seconds: u32, state: State<'_, Mutex<AppState>>) -> Value {
    let mut s = state.lock().unwrap();
    s.idle_threshold = seconds;
    store::save(&s);
    json!({"ok": true})
}

#[tauri::command]
pub fn get_history() -> Vec<DailyRecord> {
    store::load_history()
}


#[tauri::command]
pub fn set_mini_mode(is_mini: bool, app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "창을 찾을 수 없습니다.".to_string())?;
    window.set_resizable(true).map_err(|e| e.to_string())?;
    if is_mini {
        window.set_always_on_top(true).map_err(|e| e.to_string())?;
        window
            .set_size(tauri::LogicalSize::new(320.0_f64, 110.0_f64))
            .map_err(|e| e.to_string())?;
    } else {
        window.set_always_on_top(false).map_err(|e| e.to_string())?;
        window
            .set_size(tauri::LogicalSize::new(700.0_f64, 640.0_f64))
            .map_err(|e| e.to_string())?;
    }
    window.set_resizable(false).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn dev_set_virtual_date(date: Option<String>, state: State<'_, Mutex<AppState>>) -> Value {
    let mut s = state.lock().unwrap();
    s.dev_date_override = date.clone();
    let effective_today = date.unwrap_or_else(state::today_date_string);
    if s.date != effective_today {
        store::rollover(&mut s, effective_today);
    }
    json!({"ok": true})
}

#[tauri::command]
pub fn dev_set_time(name: String, seconds: u64, state: State<'_, Mutex<AppState>>) -> Value {
    let mut s = state.lock().unwrap();
    if !s.times.contains_key(&name) {
        return json!({"ok": false, "error": "추적 중인 프로그램이 아닙니다."});
    }
    s.times.insert(name, seconds);
    store::save(&s);
    json!({"ok": true})
}
