mod close_watch;
mod data_dir;
mod diagnostics;
mod files;
mod http;
mod maintenance;
mod cli;
mod migrate;
mod mcp;
mod proxy;
mod secret;
mod storage;
mod update;

use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager};

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
    }
}

/// 关闭窗口：无条件先隐藏，再通知前端写盘；5 秒兜底再次隐藏，绝不退出
fn request_tray_hide(app: &tauri::AppHandle) {
    hide_main_window(app);
    let _ = app.emit("tray-hide-requested", ());
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(5));
        if let Some(win) = handle.get_webview_window("main") {
            let _ = win.hide();
        }
    });
}

fn hide_main_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }
}

#[tauri::command]
fn hide_main_window_command(app: tauri::AppHandle) {
    hide_main_window(&app);
}

/// 关闭请求的唯一动作：隐藏。用于测试断言，避免关闭分支退化为退出
#[derive(Debug, PartialEq, Eq)]
enum CloseAction {
    Hide,
}

fn close_request_action() -> CloseAction {
    CloseAction::Hide
}

/// 只有托盘“退出”菜单会走退出；显示菜单不能用这个 ID
fn is_exit_menu_id(id: &str) -> bool {
    id == "quit"
}

/// 托盘退出：通知前端写盘，15 秒兜底后结束进程
fn request_tray_exit(app: &tauri::AppHandle) {
    let _ = app.emit("tray-exit-requested", ());
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(15));
        handle.exit(0);
    });
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

/// 命令行程序的入口（`src/bin/cli.rs`），见 `cli::command`
pub fn run_cli() -> std::process::ExitCode {
    cli::command::run()
}

/// `--mcp-stdio` 入口：不开 GUI，只提供 MCP stdio
pub fn run_mcp_stdio() -> std::process::ExitCode {
    mcp::run_stdio()
}

pub fn run() {
    // 日志、存储和 WebView2 都使用数据目录，需最先确定；有待迁移的更改时在此完成迁移
    data_dir::prepare();
    // API 请求和更新插件的 reqwest 都不带加密实现，使用进程默认的 ring（更新插件检查时也会按需安装同一个）
    let _ = rustls::crypto::ring::default_provider().install_default();
    let app = tauri::Builder::default()
        // single-instance 需最先注册，第二个实例启动时把已有主窗口带到前台后退出。
        // 开启 deep-link feature 后，第二个实例收到的 deep link 会先转交 deep-link 插件，由前端监听导入
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let Some(win) = app.get_webview_window("main") else {
                return;
            };
            let _ = win.unminimize();
            let _ = win.show();
            let _ = win.set_focus();
        }))
        // 紧随 single-instance 注册：第二个实例在此之前已退出，不会与已有实例同时写日志文件
        .plugin(diagnostics::plugin())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        // 边框由 tauri.conf.json 决定（不用系统边框，见 src/components/TitleBar.tsx），不跟随保存的旧值
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::all()
                        .difference(tauri_plugin_window_state::StateFlags::POSITION)
                        .difference(tauri_plugin_window_state::StateFlags::SIZE)
                        .difference(tauri_plugin_window_state::StateFlags::DECORATIONS),
                )
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        // 插件的初始化脚本会替换 window.Notification，前端沿用 Web Notification 的调用即可发出系统通知
        .plugin(tauri_plugin_notification::init())
        // 只供 Rust 侧的更新命令使用，不向前端开放插件命令
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            storage::commands::tasks_get_all,
            storage::commands::task_put,
            storage::commands::task_delete,
            storage::commands::tasks_clear,
            storage::commands::tasks_commit_deletion,
            storage::commands::conversations_get_all,
            storage::commands::conversation_put,
            storage::commands::conversations_clear,
            storage::commands::conversations_replace,
            storage::commands::image_get,
            storage::commands::image_put,
            storage::commands::image_delete,
            storage::commands::images_clear,
            storage::commands::image_ids,
            storage::commands::image_paths,
            storage::commands::image_stats,
            storage::commands::thumbnail_get,
            storage::commands::thumbnail_put,
            storage::commands::kv_get_all,
            storage::commands::kv_set,
            storage::commands::kv_remove,
            storage::commands::storage_info,
            storage::commands::storage_secure_cleanup,
            storage::commands::storage_open_dir,
            data_dir::data_dir_notice,
            data_dir::data_dir_pick,
            data_dir::data_dir_change,
            diagnostics::log_set_enabled,
            diagnostics::log_open_dir,
            files::save_file,
            files::save_dir_pick,
            files::save_dir_begin,
            files::save_write,
            files::save_commit,
            files::save_abort,
            files::download_dir_get,
            files::download_dir_pick,
            files::download_dir_use,
            files::download_dir_open,
            files::download_dir_migrate,
            files::backups_dir_use,
            files::backup_list,
            files::backup_read,
            files::backup_delete,
            maintenance::disk_free_space,
            maintenance::disk_cleanup_temp,
            secret::secret_encrypt,
            secret::secret_decrypt,
            http::http_send,
            http::http_read,
            http::http_cancel,
            proxy::proxy_get,
            proxy::proxy_set,
            update::update_check,
            update::update_ready,
            update::update_download,
            update::update_install,
            close_watch::close_ack,
            hide_main_window_command,
            exit_app,
            mcp::mcp_status,
            mcp::mcp_configure,
            mcp::mcp_rotate_token,
            mcp::mcp_recent_calls,
            mcp::mcp_write_response,
            cli::cli_ready,
            cli::cli_progress,
            cli::cli_respond,
            cli::skill::skill_info,
            cli::skill::skill_install,
            cli::skill::skill_remove,
            cli::skill::skill_open_dir,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // 关闭窗口一律只隐藏；Alt+F4、任务运行中、前端写盘慢都不能退出进程
                api.prevent_close();
                match close_request_action() {
                    CloseAction::Hide => request_tray_hide(window.app_handle()),
                }
            }
        })
        .manage(files::SaveDirs::default())
        .manage(files::Writes::default())
        .manage(files::MigrateSource::default())
        .manage(data_dir::PickedDir::default())
        .manage(http::Requests::default())
        .manage(cli::Cli::default())
        // 页面重载（含开发时的热重载）后旧页面的请求已无人读取，立即断开；未提交的保存也无人继续，删除临时文件；
        // 等待旧页面回复的命令行命令也中断
        .on_page_load(|webview, payload| {
            if payload.event() == tauri::webview::PageLoadEvent::Started {
                webview.state::<http::Requests>().clear();
                webview.state::<files::Writes>().clear();
                webview.state::<cli::Cli>().reset();
            }
        })
        .setup(|app| {
            data_dir::log_notice();
            // 托盘只保留“显示主窗口/退出”；关闭窗口不退出，托盘退出才真正结束进程
            let show_item = MenuItemBuilder::with_id("show", "显示主窗口").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "退出").build(app)?;
            let tray_menu = MenuBuilder::new(app).items(&[&show_item, &quit_item]).build()?;
            let mut tray = TrayIconBuilder::with_id("main-tray")
                .tooltip("盼盼工作台")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    if is_exit_menu_id(event.id.as_ref()) {
                        request_tray_exit(app);
                    } else {
                        show_main_window(app);
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
            // 安装版由 NSIS 注册协议。开发版只在设置了 GPT_IMAGE_PLAYGROUND_REGISTER_DEEP_LINK 时才注册，
            // 注册会把 HKCU 下的协议改为指向当前开发版程序，覆盖安装版的注册；
            // 之后需重装正式版，或删除 HKCU\Software\Classes\gpt-image-playground，才能恢复
            #[cfg(all(debug_assertions, windows))]
            if std::env::var_os("GPT_IMAGE_PLAYGROUND_REGISTER_DEEP_LINK").is_some() {
                use tauri_plugin_deep_link::DeepLinkExt;
                if let Err(err) = app.deep_link().register_all() {
                    log::error!("注册 deep link 协议失败：{err}");
                }
            }
            // 存储需在主窗口创建前就绪，前端加载后立即会读取任务和图片
            let state = storage::init();
            // MCP 默认关闭；保存的配置开启时在创建窗口前启动本机服务
            let mcp_state = mcp::init(app.handle().clone(), mcp::storage_state_storage(&state));
            app.manage(mcp_state);
            {
                let mcp_state = app.state::<mcp::McpRuntimeState>();
                mcp::start_saved(app.handle().clone(), &mcp_state);
            }
            // WebView2 数据放在数据目录的 webview/ 下，随数据目录走；数据目录不可用时用默认位置，不影响窗口创建
            let webview_dir = state
                .0
                .as_ref()
                .ok()
                .map(|s| s.root().join("webview"))
                .filter(|dir| match std::fs::create_dir_all(dir) {
                    Ok(()) => true,
                    Err(err) => {
                        log::warn!("无法创建 WebView 数据目录，改用默认位置：{err}");
                        false
                    }
                });
            // 代理设置需在主窗口创建前生效，前端加载后立即可能发出请求
            app.manage(proxy::Proxy::load(&state));
            app.manage(state);
            cli::start(app.handle());
            let info = app.package_info().clone();
            tauri::async_runtime::spawn_blocking(move || {
                update::cleanup(&info.name, &info.version)
            });
            // WebView2 在页面加载出来之前是白色背景，深色模式下启动会白闪。页面只跟随系统主题，
            // 创建窗口时就按系统主题设为 body 的背景色（bg-gray-50 / dark:bg-gray-950）；窗口建好后再设置为时已晚。
            // 读取失败时按浅色处理
            #[cfg(windows)]
            let dark = windows_registry::CURRENT_USER
                .open(r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize")
                .and_then(|key| key.get_u32("AppsUseLightTheme"))
                .is_ok_and(|light| light == 0);
            #[cfg(not(windows))]
            let dark = false;
            let bg = if dark {
                tauri::window::Color(3, 7, 18, 255)
            } else {
                tauri::window::Color(249, 250, 251, 255)
            };
            // 主窗口在 tauri.conf.json 中设为 create: false，改由代码创建以便拦截新窗口。
            // 默认大小为工作区约 80%，限制在 960×640 到 1440×920 之间；每次启动居中，不恢复越界位置。
            let (default_width, default_height) = app
                .primary_monitor()
                .ok()
                .flatten()
                .map(|monitor| {
                    let scale = monitor.scale_factor();
                    let work_width = monitor.work_area().size.width as f64 / scale;
                    let work_height = monitor.work_area().size.height as f64 / scale;
                    (
                        (work_width * 0.8).clamp(960.0, 1440.0).min(work_width),
                        (work_height * 0.8).clamp(640.0, 920.0).min(work_height),
                    )
                })
                .unwrap_or((1280.0, 820.0));
            // 外部链接由前端转给系统浏览器，其余 target="_blank" 和 window.open 一律拒绝，避免出现不受管理的 WebView2 弹窗
            let builder = tauri::WebviewWindowBuilder::from_config(
                app.handle(),
                &app.config().app.windows[0],
            )?
            .inner_size(default_width, default_height)
            .center()
            .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
            .background_color(bg);
            match webview_dir {
                Some(dir) => builder.data_directory(dir).build()?,
                None => builder.build()?,
            };
            Ok(())
        })
        .build(tauri::generate_context!());
    let app = match app {
        Ok(app) => app,
        Err(err) => {
            log::error!("启动应用失败：{err}");
            show_startup_error(&format!("盼盼工作台启动失败：\n{err}\n\n错误已写入日志。请重启后再试；若持续失败，请附上日志反馈。"));
            return;
        }
    };
    // 退出时不会析构托管状态，保存中途关闭窗口需在此删除临时文件
    app.run(|app, event| {
        if let tauri::RunEvent::Exit = event {
            app.state::<files::Writes>().clear();
        }
    });
}

#[cfg(windows)]
fn show_startup_error(message: &str) {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK};

    let title: Vec<u16> = std::ffi::OsStr::new("盼盼工作台")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let body: Vec<u16> = std::ffi::OsStr::new(message)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    unsafe {
        MessageBoxW(std::ptr::null_mut(), body.as_ptr(), title.as_ptr(), MB_OK | MB_ICONERROR);
    }
}

#[cfg(not(windows))]
fn show_startup_error(message: &str) {
    eprintln!("{message}");
}

#[cfg(test)]
mod tray_behavior_tests {
    use super::*;

    #[test]
    fn close_request_hides_only() {
        assert_eq!(close_request_action(), CloseAction::Hide);
    }

    #[test]
    fn only_quit_menu_exits() {
        assert!(is_exit_menu_id("quit"));
        assert!(!is_exit_menu_id("show"));
        assert!(!is_exit_menu_id(""));
    }
}
