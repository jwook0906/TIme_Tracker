use std::path::PathBuf;
use crate::state::{AppState, DailyRecord};

fn data_path() -> PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join("time-tracker-data.json")
}

fn history_path() -> PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join("time-tracker-history.json")
}

pub fn load() -> AppState {
    let path = data_path();
    if let Ok(content) = std::fs::read_to_string(&path) {
        if let Ok(mut state) = serde_json::from_str::<AppState>(&content) {
            state.active_process = None;
            return state;
        }
    }
    AppState::default()
}

pub fn save(state: &AppState) {
    if let Ok(json) = serde_json::to_string_pretty(state) {
        let _ = std::fs::write(data_path(), json);
    }
}

pub fn load_history() -> Vec<DailyRecord> {
    let path = history_path();
    if let Ok(content) = std::fs::read_to_string(&path) {
        if let Ok(records) = serde_json::from_str::<Vec<DailyRecord>>(&content) {
            return records;
        }
    }
    Vec::new()
}

pub fn save_history(records: &[DailyRecord]) {
    if let Ok(json) = serde_json::to_string_pretty(records) {
        let _ = std::fs::write(history_path(), json);
    }
}

pub fn rollover(state: &mut AppState, new_date: String) {
    let record = DailyRecord {
        date: state.date.clone(),
        times: state.times.clone(),
    };
    let mut history = load_history();
    history.retain(|r| r.date != record.date);
    history.push(record);
    history.sort_by(|a, b| b.date.cmp(&a.date));
    history.truncate(30);
    save_history(&history);
    for v in state.times.values_mut() {
        *v = 0;
    }
    state.away_seconds = 0;
    state.date = new_date;
    save(state);
}
