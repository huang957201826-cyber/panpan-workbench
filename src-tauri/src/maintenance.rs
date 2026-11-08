//! 磁盘空间预检与临时文件清理。
use std::path::Path;

use crate::storage;

#[cfg(windows)]
fn free_bytes(path: &Path) -> Result<u64, String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;

    let wide: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let mut available = 0u64;
    let ok = unsafe {
        GetDiskFreeSpaceExW(
            wide.as_ptr(),
            &mut available,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        )
    };
    if ok == 0 {
        return Err(format!("无法读取磁盘剩余空间：{}", path.display()));
    }
    Ok(available)
}

#[cfg(not(windows))]
fn free_bytes(_path: &Path) -> Result<u64, String> {
    Ok(u64::MAX)
}

/// 返回数据目录所在磁盘的可用字节数；非 Windows 平台返回 u64::MAX。
#[tauri::command]
pub async fn disk_free_space() -> Result<u64, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let dir = storage::data_dir().map_err(|err| format!("无法定位数据目录：{err}"))?;
        free_bytes(&dir)
    })
    .await
    .map_err(|err| format!("磁盘检查异常结束：{err}"))?
}

/// 清理数据目录 tmp/ 下较旧或孤儿临时文件，返回删除的字节数；正在写入的新文件保留。
#[tauri::command]
pub async fn disk_cleanup_temp() -> Result<u64, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let tmp = storage::data_dir()
            .map_err(|err| format!("无法定位数据目录：{err}"))?
            .join("tmp");
        cleanup_old_temp(&tmp, std::time::Duration::from_secs(10 * 60))
            .map_err(|err| format!("清理临时文件失败：{err}"))
    })
    .await
    .map_err(|err| format!("清理临时文件异常结束：{err}"))?
}

fn cleanup_old_temp(dir: &Path, max_age: std::time::Duration) -> std::io::Result<u64> {
    if !dir.is_dir() {
        return Ok(0);
    }
    let now = std::time::SystemTime::now();
    let mut freed = 0u64;
    for entry in std::fs::read_dir(dir)?.flatten() {
        let path = entry.path();
        if !path.is_file() || path.file_name().is_some_and(|name| name == ".write-test") {
            continue;
        }
        let Ok(meta) = entry.metadata() else { continue };
        let old = meta
            .modified()
            .ok()
            .and_then(|modified| now.duration_since(modified).ok())
            .is_some_and(|age| age >= max_age);
        if old && std::fs::remove_file(&path).is_ok() {
            freed += meta.len();
        }
    }
    Ok(freed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cleanup_keeps_active_temp_and_removes_old_files() {
        let dir = tempfile::tempdir().unwrap();
        let active = dir.path().join("active.tmp");
        let old = dir.path().join("old.tmp");
        std::fs::write(&active, b"active").unwrap();
        std::fs::write(&old, b"old").unwrap();
        let old_time = std::time::SystemTime::now() - std::time::Duration::from_secs(3600);
        let file = std::fs::File::options().write(true).open(&old).unwrap();
        file.set_modified(old_time).unwrap();

        let freed = cleanup_old_temp(dir.path(), std::time::Duration::from_secs(600)).unwrap();
        assert_eq!(freed, 3);
        assert!(active.is_file());
        assert!(!old.exists());
    }
}
