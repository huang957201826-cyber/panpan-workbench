use serde::Serialize;
use std::io::Write;
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Manager, State};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// Windows 下不弹控制台窗口
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const PORT: u16 = 8188;

#[derive(Default)]
pub struct EngineProcess(pub Mutex<Option<Child>>);

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EngineStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub url: String,
    pub detail: String,
}

fn engine_root() -> PathBuf {
    match std::env::var("PANPAN_COMFY_ROOT") {
        Ok(value) if !value.trim().is_empty() => PathBuf::from(value),
        _ => PathBuf::from(r"D:\AI\ComfyUI"),
    }
}

fn python_path(root: &PathBuf) -> PathBuf {
    root.join("venv").join("Scripts").join("python.exe")
}

fn comfy_dir(root: &PathBuf) -> PathBuf {
    root.join("ComfyUI")
}

fn port_open() -> bool {
    TcpStream::connect_timeout(
        &format!("127.0.0.1:{PORT}")
            .parse()
            .expect("固定地址必然可解析"),
        Duration::from_millis(300),
    )
    .is_ok()
}

/// 端口开着不等于 ComfyUI 在跑：可能是别的服务占用 8188。
/// 用一次最小 HTTP 请求确认对面确实是 ComfyUI。
fn comfy_alive() -> bool {
    use std::io::{Read, Write};
    let Ok(mut stream) = TcpStream::connect_timeout(
        &format!("127.0.0.1:{PORT}")
            .parse()
            .expect("固定地址必然可解析"),
        Duration::from_millis(400),
    ) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(600)));
    let request = "GET /system_stats HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n";
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    let mut buffer = [0u8; 32];
    match stream.read(&mut buffer) {
        Ok(size) if size >= 12 => &buffer[9..12] == b"200",
        _ => false,
    }
}

fn url() -> String {
    format!("http://127.0.0.1:{PORT}")
}

fn status_of(state: &EngineProcess) -> EngineStatus {
    let mut guard = match state.0.lock() {
        Ok(guard) => guard,
        Err(_) => {
            return EngineStatus {
                running: port_open(),
                pid: None,
                url: url(),
                detail: "引擎状态锁不可用，按端口探测结果判断".into(),
            }
        }
    };

    let pid = match guard.as_mut() {
        Some(child) => match child.try_wait() {
            Ok(Some(_)) => {
                *guard = None;
                None
            }
            Ok(None) => Some(child.id()),
            Err(_) => None,
        },
        None => None,
    };

    let open = port_open();
    EngineStatus {
        running: open,
        pid: pid.or_else(|| if open { Some(0) } else { None }),
        url: url(),
        detail: if open {
            "端口已就绪".into()
        } else if pid.is_some() {
            "进程已启动，正在加载模型".into()
        } else {
            "未运行".into()
        },
    }
}

#[tauri::command]
pub fn comfy_engine_status(state: State<EngineProcess>) -> EngineStatus {
    status_of(&state)
}

#[tauri::command]
pub fn comfy_engine_start(state: State<EngineProcess>) -> Result<EngineStatus, String> {
    if comfy_alive() {
        return Ok(status_of(&state));
    }

    let root = engine_root();
    let python = python_path(&root);
    let workdir = comfy_dir(&root);
    if !python.exists() {
        return Err(format!(
            "没有找到本地引擎：{}。请先运行 scripts\\fetch-local-engine.ps1 安装",
            python.display()
        ));
    }
    if !workdir.join("main.py").exists() {
        return Err(format!(
            "引擎目录不完整：{} 缺少 main.py",
            workdir.display()
        ));
    }

    let log_path = root.join("comfy-app.log");
    let log = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|err| format!("无法写入引擎日志 {}：{err}", log_path.display()))?;
    let log_err = log
        .try_clone()
        .map_err(|err| format!("无法复制日志句柄：{err}"))?;

    let mut command = Command::new(&python);
    command
        .arg("main.py")
        .arg("--listen")
        .arg("127.0.0.1")
        .arg("--port")
        .arg(PORT.to_string())
        .current_dir(&workdir)
        .stdin(Stdio::null())
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(log_err));
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    let child = command
        .spawn()
        .map_err(|err| format!("启动引擎失败：{err}"))?;
    let mut guard = state.0.lock().map_err(|_| "引擎状态锁不可用".to_string())?;
    if let Some(mut old) = guard.take() {
        let _ = old.kill();
    }
    *guard = Some(child);
    drop(guard);

    Ok(status_of(&state))
}

#[tauri::command]
pub fn comfy_engine_stop(state: State<EngineProcess>) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|_| "引擎状态锁不可用".to_string())?;
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    let _ = std::io::stdout().flush();
    Ok(())
}

/// 退出应用前回收引擎子进程，避免 python 残留占显存
pub fn shutdown(app: &tauri::AppHandle) {
    let state = app.state::<EngineProcess>();
    let taken = state.0.lock().ok().and_then(|mut guard| guard.take());
    if let Some(mut child) = taken {
        let _ = child.kill();
        let _ = child.wait();
    }
}
