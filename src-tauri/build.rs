fn main() {
    tauri_build::build();
    // 测试二进制没有 Tauri 主程序的清单；给所有目标追加 Common-Controls v6 依赖。
    // 该开关只向已有/新建清单添加依赖，不会像 /MANIFESTINPUT 那样产生重复资源。
    #[cfg(windows)]
    {
        println!("cargo:rustc-link-arg=/MANIFESTDEPENDENCY:type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'");
    }
}
