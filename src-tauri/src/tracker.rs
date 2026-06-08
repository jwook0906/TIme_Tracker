use std::collections::HashSet;
use windows::Win32::Foundation::{BOOL, CloseHandle, HWND, LPARAM, TRUE};
use windows::Win32::System::SystemInformation::GetTickCount;
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
    PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetForegroundWindow, GetWindowTextLengthW,
    GetWindowThreadProcessId, IsWindowVisible,
};

unsafe fn process_name_from_pid(pid: u32) -> Option<String> {
    let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
    let mut buf = vec![0u16; 512];
    let mut size = buf.len() as u32;
    let result = QueryFullProcessImageNameW(
        handle,
        PROCESS_NAME_WIN32,
        windows::core::PWSTR(buf.as_mut_ptr()),
        &mut size,
    );
    let _ = CloseHandle(handle);
    if result.is_ok() && size > 0 {
        let path = String::from_utf16_lossy(&buf[..size as usize]);
        std::path::Path::new(&path)
            .file_stem()
            .and_then(|s| s.to_str())
            .map(|s| s.to_lowercase())
    } else {
        None
    }
}

pub fn get_active_info() -> (Option<String>, u32) {
    unsafe {
        let hwnd = GetForegroundWindow();
        let process_name = if hwnd != HWND(std::ptr::null_mut()) {
            let mut pid = 0u32;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
            if pid > 0 {
                process_name_from_pid(pid)
            } else {
                None
            }
        } else {
            None
        };

        let mut lii = LASTINPUTINFO {
            cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
            dwTime: 0,
        };
        let _ = GetLastInputInfo(&mut lii);
        let idle_ms = GetTickCount().wrapping_sub(lii.dwTime);

        (process_name, idle_ms / 1000)
    }
}

pub fn get_running_processes() -> Vec<String> {
    let mut pids: Vec<u32> = Vec::new();

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        if IsWindowVisible(hwnd).as_bool() && GetWindowTextLengthW(hwnd) > 0 {
            let mut pid = 0u32;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
            if pid > 0 {
                let pids = &mut *(lparam.0 as *mut Vec<u32>);
                pids.push(pid);
            }
        }
        TRUE
    }

    unsafe {
        let _ = EnumWindows(
            Some(enum_proc),
            LPARAM(&mut pids as *mut Vec<u32> as isize),
        );
    }

    let mut seen: HashSet<u32> = HashSet::new();
    let mut names: Vec<String> = Vec::new();

    for pid in pids {
        if !seen.insert(pid) {
            continue;
        }
        unsafe {
            if let Some(name) = process_name_from_pid(pid) {
                if !names.contains(&name) {
                    names.push(name);
                }
            }
        }
    }

    names.sort();
    names
}
