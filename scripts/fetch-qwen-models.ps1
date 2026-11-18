# 千问 2.1 模型下载（hf-mirror，24 MB 切片 + 并发 + 分片重试）
# hf-mirror 每条连接约 40 MB 会被断开，因此切片必须小于该值

$ErrorActionPreference = 'Continue'
$root = 'D:\AI\ComfyUI\ComfyUI\models'
$mirror = 'https://hf-mirror.com/Comfy-Org/Qwen-Image-2.1/resolve/main/'
$files = @(
  @{ Path = 'vae/qwen_image_2.1_vae_bf16.safetensors'; GB = 0.63 },
  @{ Path = 'diffusion_models/qwen_image_2.1_int8_convrot.safetensors'; GB = 6.76 },
  @{ Path = 'text_encoders/qwen3vl_8b_int8_convrot.safetensors'; GB = 8.71 },
  @{ Path = 'model_patches/qwen_image_2.1_fun_controlnet_union_int8_convrot.safetensors'; GB = 3.52 }
)
$sliceBytes = 24MB
$concurrency = 32

function Get-RemoteSize([string]$u) {
  $h = & curl.exe -sIL $u
  $line = $h | Select-String -Pattern '^content-length:\s*(\d+)' | Select-Object -Last 1
  if ($line) { return [int64]$line.Matches[0].Groups[1].Value }
  return 0
}

foreach ($f in $files) {
  $dest = Join-Path $root ($f.Path -replace '/', '\')
  New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
  if ((Test-Path $dest) -and ((Get-Item $dest).Length -gt ($f.GB * 1GB * 0.95))) {
    Write-Output "[$(Get-Date -Format HH:mm:ss)] skip $($f.Path)"
    continue
  }
  $url = $mirror + $f.Path
  $size = Get-RemoteSize $url
  if ($size -le 0) { Write-Output "[$(Get-Date -Format HH:mm:ss)] size unknown: $($f.Path)"; continue }
  $parts = [math]::Ceiling($size / $sliceBytes)
  $tmp = "$dest.parts"
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  Write-Output "[$(Get-Date -Format HH:mm:ss)] start $($f.Path) size=$([math]::Round($size/1GB,2))GB parts=$parts"

  $pending = @()
  for ($i = 0; $i -lt $parts; $i++) {
    $start = [int64]$i * $sliceBytes
    $end = [math]::Min($start + $sliceBytes - 1, $size - 1)
    $want = $end - $start + 1
    $out = Join-Path $tmp ('part' + $i.ToString('0000'))
    if ((Test-Path $out) -and ((Get-Item $out).Length -eq $want)) { continue }
    $pending += [pscustomobject]@{ Index = $i; Start = $start; End = $end; Want = $want; Out = $out }
  }
  Write-Output "[$(Get-Date -Format HH:mm:ss)] pending $($pending.Count)"

  for ($attempt = 0; $attempt -lt 6 -and $pending.Count -gt 0; $attempt++) {
    $jobs = @()
    foreach ($chunk in ($pending | Select-Object -First $concurrency)) {
      $jobs += Start-Job -ScriptBlock {
        param($u, $s, $e, $o)
        & curl.exe -L -s --max-time 180 -r "$s-$e" -o $o $u
      } -ArgumentList $url, $chunk.Start, $chunk.End, $chunk.Out
    }
    $jobs | Wait-Job -Timeout 240 | Out-Null
    $jobs | Remove-Job -Force -ErrorAction SilentlyContinue
    $pending = @($pending | Where-Object { -not ((Test-Path $_.Out) -and ((Get-Item $_.Out).Length -eq $_.Want)) })
    Write-Output "[$(Get-Date -Format HH:mm:ss)] wave $($attempt+1) left=$($pending.Count)"
  }

  $partsFiles = Get-ChildItem $tmp -File | Sort-Object Name
  $list = ($partsFiles | ForEach-Object { '"' + $_.FullName + '"' }) -join '+'
  cmd /c ("copy /b " + $list + ' "' + $dest + '"') | Out-Null
  if ((Test-Path $dest) -and (Get-Item $dest).Length -gt 100MB) {
    Remove-Item $tmp -Recurse -Force
    Write-Output "[$(Get-Date -Format HH:mm:ss)] done $($f.Path) $([math]::Round((Get-Item $dest).Length/1GB,2))GB"
  } else {
    Write-Output "[$(Get-Date -Format HH:mm:ss)] FAIL $($f.Path)（重跑会续传）"
  }
}
Write-Output 'ALL DONE'
