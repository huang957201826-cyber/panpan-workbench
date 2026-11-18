# 本地引擎安装（全国内源）

- 目标目录：`D:\AI\ComfyUI`
- 全程不访问 GitHub
- 可断点续传：中断后重跑接着下

```powershell
cd C:\Users\95720\生图软件二开\gpt_image_playground-main
powershell -ExecutionPolicy Bypass -File scripts\fetch-local-engine.ps1
```

## 用到的源（均实测可用）

| 组件 | 源 | 实测 |
|---|---|---|
| ComfyUI 源码 | `gitee.com/mirrors/ComfyUI` | 20 秒 49 MB |
| Python 3.12.7 | 华为云镜像 | 25.7 MB |
| torch cu126 | `mirror.sjtu.edu.cn/pytorch-wheels` | 存在 cp312 win_amd64 轮子 |
| pip 依赖 | 清华 PyPI | 可用 |
| 千问模型 | `hf-mirror.com` | 已列全部文件 |

对比：GitHub 直连 3 MB/分钟，gh-proxy / ghproxy.net / ghfast.top 实测 0–3 MB/分钟，均已弃用。

## 安装内容

```
D:\AI\ComfyUI\
  Python312\            自带 pip 的独立 Python
  ComfyUI\              Gitee 镜像源码
  venv\                 虚拟环境（torch cu126）
  ComfyUI\models\diffusion_models\qwen_image_2.1_int8_convrot.safetensors          6.76 GB
  ComfyUI\models\text_encoders\qwen3vl_8b_int8_convrot.safetensors                 8.71 GB
  ComfyUI\models\vae\qwen_image_2.1_vae_bf16.safetensors                           0.63 GB
  ComfyUI\models\model_patches\qwen_image_2.1_fun_controlnet_union_int8_convrot.safetensors  3.52 GB
  start-comfyui.bat     启动脚本
```

合计约 19.6 GB 模型 + 约 3 GB 运行环境。

## 启动

```
D:\AI\ComfyUI\start-comfyui.bat
```

地址 `http://127.0.0.1:8188`，在软件「工作流」页点「连接并保存」。

## 注意

- 不写系统目录、不改 PATH 以外的系统设置；删 `D:\AI\ComfyUI` 即卸载。
- 千问 2.1 为自定义许可，自用无碍，对外分发前需单独核实。
- 多角度、局部重绘、轻量控图这三条工作流的模型路径尚未实测，界面标了「模型路径待验证」。
