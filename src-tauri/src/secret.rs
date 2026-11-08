//! Windows DPAPI 加密：API Key 等敏感字段以密文落盘，前端只在内存中使用明文。
use base64::{engine::general_purpose::STANDARD, Engine as _};

const DPAPI_PREFIX: &str = "dpapi:v1:";

fn wrap(bytes: &[u8]) -> String {
    format!("{DPAPI_PREFIX}{}", STANDARD.encode(bytes))
}

fn unwrap_value(value: &str) -> Result<Vec<u8>, String> {
    let encoded = value
        .strip_prefix(DPAPI_PREFIX)
        .ok_or_else(|| "不是 DPAPI 密文".to_string())?;
    STANDARD
        .decode(encoded)
        .map_err(|err| format!("DPAPI 密文格式无效：{err}"))
}

#[cfg(windows)]
fn protect(raw: &[u8]) -> Result<Vec<u8>, String> {
    use std::ptr::{null, null_mut};
    use windows_sys::Win32::Foundation::{GetLastError, LocalFree};
    use windows_sys::Win32::Security::Cryptography::{
        CryptProtectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    let mut input = CRYPT_INTEGER_BLOB {
        cbData: raw.len() as u32,
        pbData: raw.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: null_mut(),
    };
    let ok = unsafe {
        CryptProtectData(
            &mut input,
            null(),
            null(),
            null_mut(),
            null_mut(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if ok == 0 {
        return Err(format!("DPAPI 加密失败（{}）", unsafe { GetLastError() }));
    }
    let bytes = unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe {
        LocalFree(output.pbData as *mut core::ffi::c_void);
    }
    Ok(bytes)
}

#[cfg(not(windows))]
fn protect(_raw: &[u8]) -> Result<Vec<u8>, String> {
    Err("当前平台不支持 Windows DPAPI".to_string())
}

#[cfg(windows)]
fn unprotect(raw: &[u8]) -> Result<Vec<u8>, String> {
    use std::ptr::{null, null_mut};
    use windows_sys::Win32::Foundation::{GetLastError, LocalFree};
    use windows_sys::Win32::Security::Cryptography::{
        CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    let mut input = CRYPT_INTEGER_BLOB {
        cbData: raw.len() as u32,
        pbData: raw.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: null_mut(),
    };
    let ok = unsafe {
        CryptUnprotectData(
            &mut input,
            null_mut(),
            null(),
            null_mut(),
            null_mut(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if ok == 0 {
        return Err(format!("DPAPI 解密失败（{}）", unsafe { GetLastError() }));
    }
    let bytes = unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe {
        LocalFree(output.pbData as *mut core::ffi::c_void);
    }
    Ok(bytes)
}

#[cfg(not(windows))]
fn unprotect(_raw: &[u8]) -> Result<Vec<u8>, String> {
    Err("当前平台不支持 Windows DPAPI".to_string())
}

#[tauri::command]
pub fn secret_encrypt(value: String) -> Result<String, String> {
    if value.is_empty() || value.starts_with(DPAPI_PREFIX) {
        return Ok(value);
    }
    protect(value.as_bytes()).map(|bytes| wrap(&bytes))
}

#[tauri::command]
pub fn secret_decrypt(value: String) -> Result<String, String> {
    let raw = unwrap_value(&value)?;
    let bytes = unprotect(&raw)?;
    String::from_utf8(bytes).map_err(|err| format!("DPAPI 明文不是 UTF-8：{err}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_plaintext_values() {
        assert!(unwrap_value("plain").is_err());
    }

    #[cfg(windows)]
    #[test]
    fn round_trips_windows_dpapi() {
        let encrypted = secret_encrypt("sk-test-secret".to_string()).unwrap();
        assert!(encrypted.starts_with(DPAPI_PREFIX));
        assert_ne!(encrypted, "sk-test-secret");
        assert_eq!(secret_decrypt(encrypted).unwrap(), "sk-test-secret");
    }

    #[cfg(windows)]
    #[test]
    fn keeps_already_encrypted_value() {
        let encrypted = secret_encrypt("value".to_string()).unwrap();
        assert_eq!(secret_encrypt(encrypted.clone()).unwrap(), encrypted);
    }
}
