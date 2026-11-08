//! 关闭窗口的回执：前端在写完设置后调用 close_ack。
//! 关闭请求由 lib.rs 统一改为隐藏到托盘，这里只保留命令以兼容已有前端调用。
use std::sync::atomic::{AtomicU64, Ordering};

/// 最近一次回执编号；保留以便前端调用幂等
static PENDING: AtomicU64 = AtomicU64::new(0);

/// 前端开始处理关闭请求时调用
#[tauri::command]
pub fn close_ack() {
    PENDING.store(0, Ordering::Release);
}
