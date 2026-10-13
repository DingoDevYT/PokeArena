Add-Type -AssemblyName System.Drawing
$root = 'C:\Users\lando\Desktop\PokeArena'
$pack = "$root\tools\.cache\kenney\input-prompts-pixel"
$out = "$root\assets\ui\icons"
New-Item -ItemType Directory -Force $out | Out-Null
# name -> tile indices (left to right) in Tilemap/tilemap_packed.png (34 cols, 16px). Dark style throughout.
$map = [ordered]@{
  xbox_a = 47; xbox_b = 48; xbox_x = 49; xbox_y = 50
  xbox_lb = 587; xbox_rb = 588; xbox_lt = 585; xbox_rt = 586
  xbox_ls = 450; xbox_rs = 518; xbox_dpad = 68; xbox_start = 651; xbox_back = 650
  key_w = 358; key_a = 392; key_s = 393; key_d = 394; key_q = 357; key_e = 359; key_f = 395
  key_space = 425; key_shift = @(527, 528); key_esc = 289; key_enter = @(406, 407)
  key_delete = @(463, 464); key_f2 = 291; key_tab = @(461, 462)
  key_1 = 323; key_2 = 324; key_3 = 325; key_4 = 326; key_5 = 327; key_6 = 328
  mouse = 110; mouse_left = 111; mouse_right = 112; mouse_scroll = 116
}
$sheet = [Drawing.Bitmap]::FromFile("$pack\Tilemap\tilemap_packed.png")
$js = @()
foreach ($k in $map.Keys) {
  $t = @($map[$k])
  $bmp = New-Object Drawing.Bitmap (16 * $t.Count), 16, ([Drawing.Imaging.PixelFormat]::Format32bppArgb)
  for ($j = 0; $j -lt $t.Count; $j++) { for ($y = 0; $y -lt 16; $y++) { for ($x = 0; $x -lt 16; $x++) {
    $bmp.SetPixel($j * 16 + $x, $y, $sheet.GetPixel(($t[$j] % 34) * 16 + $x, [Math]::Floor($t[$j] / 34) * 16 + $y))
  } } }
  $bmp.Save("$out\$k.png", [Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
  $js += "  ${k}: 'assets/ui/icons/$k.png',"
}
$sheet.Dispose()
Copy-Item "$pack\License.txt" "$out\LICENSE-kenney.txt" -Force
$hdr = "// Kenney 'Input Prompts Pixel' (CC0, kenney.nl). Dark style. Most are 16x16; key_shift/enter/delete/tab are 32x16."
Set-Content -Encoding utf8NoBOM "$root\data\ui-icons.js" ($hdr, 'window.UI_ICONS = {', ($js -join "`n"), '};', 'window.UI_ICONS_SIZE = 16;' -join "`n")

# contact sheet, 6x nearest-neighbour
$s = 6; $cw = 32 * $s + 12; $ch = 16 * $s + 20; $per = 6; $names = @($map.Keys)
$rows = [Math]::Ceiling($names.Count / $per)
$cs = New-Object Drawing.Bitmap ($per * $cw), ($rows * $ch)
$g = [Drawing.Graphics]::FromImage($cs); $g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'
$g.Clear([Drawing.Color]::FromArgb(255, 200, 210, 200)); $f = New-Object Drawing.Font 'Consolas', 10
for ($i = 0; $i -lt $names.Count; $i++) {
  $x = ($i % $per) * $cw; $y = [Math]::Floor($i / $per) * $ch
  $im = [Drawing.Bitmap]::FromFile("$out\$($names[$i]).png")
  $g.DrawString($names[$i], $f, [Drawing.Brushes]::Black, $x, $y)
  $g.DrawImage($im, (New-Object Drawing.Rectangle $x, ($y + 18), ($im.Width * $s), ($im.Height * $s)), (New-Object Drawing.Rectangle 0, 0, $im.Width, $im.Height), 'Pixel')
  $im.Dispose()
}
$cs.Save("$out\_preview.png"); $g.Dispose(); $cs.Dispose()
