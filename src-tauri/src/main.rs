// 发布版本不弹出额外的控制台窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if std::env::args().any(|arg| arg == "--mcp-stdio") {
        let code = gpt_image_playground_lib::run_mcp_stdio();
        std::process::exit(match code {
            std::process::ExitCode::SUCCESS => 0,
            _ => 1,
        });
    }
    gpt_image_playground_lib::run()
}
