# 本地引擎一键安装（全国内源版）
# 用法：powershell -ExecutionPolicy Bypass -File scripts\fetch-local-engine.ps1
# 全程不访问 GitHub：ComfyUI 走 Gitee，Python 走华为云，torch 走上海交大，模型走 hf-mirror
# 断点续传：重复执行不会重下已完成的部分

$ErrorActionPreference = 'Stop'
$root = 'D:\AI\ComfyUI'
$pyDir = Join-Path $root 'Python312'
$comfyDir = Join-Path $root 'ComfyUI'
$venvDir = Join-Path $root 'venv'
$downloads = Join-Path $root 'download'

New-Item -ItemType Directory -Force -Path $root, $downloads | Out-Null

function Write-Step([string]$text) { Write-Host "`n== $text ==" -ForegroundColor Cyan }

# ---------- 1. Python 3.12（华为云镜像） ----------
Write-Step 'Python 3.12'
$pyExe = Join-Path $pyDir 'python.exe'
if (-not (Test-Path $pyExe)) {
  $installer = Join-Path $downloads 'python-3.12.7-amd64.exe'
  if (-not (Test-Path $installer)) {
    Write-Host '下载 Python（华为云，约 25 MB）'
    & curl.exe -L --retry 5 -C - --progress-bar -o $installer 'https://mirrors.huaweicloud.com/python/3.12.7/python-3.12.7-amd64.exe'
    if ($LASTEXITCODE -ne 0) { throw 'Python 下载失败' }
  }
  Write-Host '静默安装到 D:\AI\ComfyUI\Python312'
  Start-Process -FilePath $installer -ArgumentList @('/quiet','InstallAllUsers=0','PrependPath=0','Include_pip=1',"TargetDir=$pyDir") -Wait
}
if (-not (Test-Path $pyExe)) { throw "Python 未安装成功：$pyExe" }
& $pyExe --version

# ---------- 2. ComfyUI（Gitee 镜像） ----------
Write-Step 'ComfyUI 源码'
if (-not (Test-Path (Join-Path $comfyDir 'main.py'))) {
  if (Test-Path $comfyDir) { Remove-Item $comfyDir -Recurse -Force }
  & git clone --depth 1 https://gitee.com/mirrors/ComfyUI.git $comfyDir
  if ($LASTEXITCODE -ne 0) { throw 'ComfyUI 克隆失败（检查 Gitee 是否可访问）' }
}

# ---------- 3. 虚拟环境 + CUDA 版 torch ----------
Write-Step 'Python 虚拟环境'
$venvPy = Join-Path $venvDir 'Scripts\python.exe'
if (-not (Test-Path $venvPy)) { & $pyExe -m venv $venvDir }
& $venvPy -m pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple

Write-Step '安装 torch（CUDA 12.6，上海交大镜像）'
& $venvPy -m pip install torch torchvision torchaudio --index-url https://mirror.sjtu.edu.cn/pytorch-wheels/cu126
if ($LASTEXITCODE -ne 0) { throw 'torch 安装失败' }

Write-Step '安装 ComfyUI 依赖（清华源）'
& $venvPy -m pip install -r (Join-Path $comfyDir 'requirements.txt') -i https://pypi.tuna.tsinghua.edu.cn/simple
if ($LASTEXITCODE -ne 0) { throw 'ComfyUI 依赖安装失败' }

# ---------- 4. 千问 2.1 模型（hf-mirror） ----------
Write-Step '千问 2.1 模型（约 19.6 GB）'
$modelsRoot = Join-Path $comfyDir 'models'
$mirror = 'https://hf-mirror.com/Comfy-Org/Qwen-Image-2.1/resolve/main/'
$models = @(
  @{ Path = 'diffusion_models/qwen_image_2.1_int8_convrot.safetensors';                  Size = '6.76 GB' },
  @{ Path = 'text_encoders/qwen3vl_8b_int8_convrot.safetensors';                          Size = '8.71 GB' },
  @{ Path = 'vae/qwen_image_2.1_vae_bf16.safetensors';                                    Size = '0.63 GB' },
  @{ Path = 'model_patches/qwen_image_2.1_fun_controlnet_union_int8_convrot.safetensors'; Size = '3.52 GB' }
)
foreach ($model in $models) {
  $dest = Join-Path $modelsRoot ($model.Path -replace '/', '\')
  New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
  if ((Test-Path $dest) -and ((Get-Item $dest).Length -gt 1GB)) {
    Write-Host "[跳过] $($model.Path)（已存在）" -ForegroundColor DarkGray
    continue
  }
  Write-Host "[下载] $($model.Path)  $($model.Size)"
  & curl.exe -L --retry 5 --retry-delay 3 -C - --progress-bar -o $dest ($mirror + $model.Path)
  if ($LASTEXITCODE -ne 0) { Write-Host "  下载中断，重跑本脚本会续传：$($model.Path)" -ForegroundColor Yellow }
}

# ---------- 5. 启动脚本 ----------
$bat = Join-Path $root 'start-comfyui.bat'
@"
@echo off
cd /d "$comfyDir"
"$venvPy" main.py --listen 127.0.0.1 --port 8188
pause
"@ | Set-Content -Path $bat -Encoding ASCII

Write-Host ''
Write-Host '完成。启动方式：' -ForegroundColor Green
Write-Host "  $bat"
Write-Host '启动后地址：http://127.0.0.1:8188'
Write-Host '然后在软件「工作流」页点「连接并保存」。'
