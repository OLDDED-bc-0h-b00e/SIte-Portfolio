param([int]$Port = 3000)

# Маршруты:
#   /              -> site/
#   /canvas/       -> canvas/        (доска референсов)
#   /brief/assets/ -> brief/assets/  (картинки с доски)
#   /api/board     GET/PUT           (brief/board.json + brief/BOARD.md)
#   /api/upload    POST              (сохраняет картинку в brief/assets/)

$base      = $PSScriptRoot
$siteRoot  = Join-Path $base 'site'
$canvasDir = Join-Path $base 'canvas'
$briefDir  = Join-Path $base 'brief'
$assetsDir = Join-Path $briefDir 'assets'
New-Item -ItemType Directory -Force $assetsDir | Out-Null

$utf8 = New-Object System.Text.UTF8Encoding($false)
$mime = @{
  '.html'='text/html; charset=utf-8'; '.css'='text/css; charset=utf-8'
  '.js'='text/javascript; charset=utf-8'; '.json'='application/json; charset=utf-8'
  '.svg'='image/svg+xml'; '.png'='image/png'; '.jpg'='image/jpeg'
  '.jpeg'='image/jpeg'; '.webp'='image/webp'; '.gif'='image/gif'
  '.ico'='image/x-icon'; '.woff2'='font/woff2'; '.txt'='text/plain; charset=utf-8'
  '.md'='text/plain; charset=utf-8'
}
$uploadExt = @('png','jpg','jpeg','webp','gif','svg')

function Send($ctx, [byte[]]$bytes, [string]$type, [int]$status = 200) {
  $ctx.Response.StatusCode = $status
  $ctx.Response.ContentType = $type
  $ctx.Response.Headers.Add('Cache-Control', 'no-store')
  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
}

function SendFile($ctx, [string]$root, [string]$rel) {
  $path = [IO.Path]::GetFullPath((Join-Path $root $rel))
  if (Test-Path $path -PathType Container) { $path = Join-Path $path 'index.html' }
  if ($path.StartsWith($root) -and (Test-Path $path -PathType Leaf)) {
    $type = $mime[[IO.Path]::GetExtension($path).ToLower()]
    if (-not $type) { $type = 'application/octet-stream' }
    Send $ctx ([IO.File]::ReadAllBytes($path)) $type
  } else {
    Send $ctx ($utf8.GetBytes('Not found')) 'text/plain' 404
  }
}

function ReadBody($ctx) {
  $ms = New-Object IO.MemoryStream
  $ctx.Request.InputStream.CopyTo($ms)
  return $ms.ToArray()
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Site:   http://localhost:$Port/"
Write-Host "Canvas: http://localhost:$Port/canvas/"

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $urlPath = $ctx.Request.Url.AbsolutePath
    $rel = [Uri]::UnescapeDataString($urlPath.TrimStart('/'))
    $method = $ctx.Request.HttpMethod

    if ($urlPath -eq '/api/board') {
      $json = Join-Path $briefDir 'board.json'
      if ($method -eq 'GET') {
        if (Test-Path $json) { $out = [IO.File]::ReadAllBytes($json) }
        else { $out = $utf8.GetBytes('{"cards":[],"view":{"x":0,"y":0,"z":1}}') }
        Send $ctx $out 'application/json; charset=utf-8'
      } elseif ($method -eq 'PUT') {
        $payload = $utf8.GetString((ReadBody $ctx)) | ConvertFrom-Json
        [IO.File]::WriteAllText($json, [string]$payload.boardJson, $utf8)
        [IO.File]::WriteAllText((Join-Path $briefDir 'BOARD.md'), [string]$payload.md, $utf8)
        Send $ctx ($utf8.GetBytes('{"ok":true}')) 'application/json'
      } else { Send $ctx ([byte[]]@()) 'text/plain' 405 }
    }
    elseif ($urlPath -eq '/api/upload' -and $method -eq 'POST') {
      $ext = ([string]$ctx.Request.QueryString['ext']).ToLower()
      if ($uploadExt -notcontains $ext) { Send $ctx ($utf8.GetBytes('bad ext')) 'text/plain' 400 }
      else {
        $name = '{0}-{1}.{2}' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), (Get-Random -Maximum 9999), $ext
        [IO.File]::WriteAllBytes((Join-Path $assetsDir $name), (ReadBody $ctx))
        Send $ctx ($utf8.GetBytes((@{ path = "/brief/assets/$name" } | ConvertTo-Json))) 'application/json'
      }
    }
    elseif ($urlPath -eq '/canvas') {
      $ctx.Response.Redirect('/canvas/')
    }
    elseif ($rel.StartsWith('canvas/')) { SendFile $ctx $canvasDir $rel.Substring(7) }
    elseif ($rel.StartsWith('brief/assets/')) { SendFile $ctx $assetsDir $rel.Substring(13) }
    else {
      if ($rel -eq '') { $rel = 'index.html' }
      SendFile $ctx $siteRoot $rel
    }
  } catch {
    Write-Host "Error: $_"
    try { Send $ctx ($utf8.GetBytes("$_")) 'text/plain' 500 } catch {}
  }
  $ctx.Response.Close()
}
