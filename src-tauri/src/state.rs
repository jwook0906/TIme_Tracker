use std::collections::HashMap;
use serde::{Deserialize, Serialize};

pub const MAX_PROGRAMS: usize = 10;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppState {
    pub selected_programs: Vec<String>,
    pub times: HashMap<String, u64>,
    #[serde(default)]
    pub away_seconds: u64,
    pub idle_threshold: u32,
    pub date: String,
    #[serde(skip)]
    pub active_process: Option<String>,
    #[serde(skip)]
    pub dev_date_override: Option<String>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            selected_programs: Vec::new(),
            times: HashMap::new(),
            away_seconds: 0,
            idle_threshold: 30,
            date: today_date_string(),
            active_process: None,
            dev_date_override: None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DailyRecord {
    pub date: String,
    pub times: HashMap<String, u64>,
}

pub fn today_date_string() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}
