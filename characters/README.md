# 攀巔 角色精靈圖 (Character Sprites)

- 角色：**小攀 / Xiao Pan**（女，`xiaopan_*`）、**阿岩 / A-Yan**（男，`ayan_*`）
- cell size：**128×128 px**，透明背景 PNG
- facing：全部**朝右**（朝左請水平翻轉 `ctx.scale(-1,1)`）
- anchor：腳底基準線 y=124（cell 底部中央對齊）。遊戲碰撞箱為 12×18，建議以 bottom-center 對齊 `(P.x+6, P.y+PH)` 繪製，顯示高度約 28–40 px（例：`drawImage(img,sx,0,128,128,cx-20,feet-40+1,40,40)`，約 0.31 倍）
- 攀牆動畫手腳朝右側牆面；`P.cling` 為 -1 時翻轉。

## 4 套共用主色 (Outfit main colors，男女共用，同房不重複)

| key | 名稱 | 主色 hex | 小攀名稱 | 阿岩名稱 |
|---|---|---|---|---|
| teal | 青綠 | `#1FA5AA` | 小攀・青綠 | 阿岩・青綠 |
| red | 赤紅 | `#D93A3A` | 小攀・赤紅 | 阿岩・赤紅 |
| yellow | 亮黃 | `#F2C230` | 小攀・亮黃 | 阿岩・亮黃 |
| blue | 寶藍 | `#3366DD` | 小攀・寶藍 | 阿岩・寶藍 |

固定不換色：安全帽 `#1FA5AA`、小攀髮色 `#F07A1E`、阿岩髮色 `#5A3A22`、繩索 `#F07A1E`、緊身褲 `#3D3550`（橘條紋）、吊帶 `#6A4C93`、膚色。換色區：背心、粉袋、手套。

## 動畫 (Animations)

| key | 中文 | frames | 單列檔尺寸 | 建議 fps | loop |
|---|---|---|---|---|---|
| idle | 待機 | 4 | 512×128 | 6 | 是 |
| walk | 走路 | 6 | 768×128 | 10 | 是 |
| jump | 跳躍 | 4 | 512×128 | 10 | 否 |
| climb | 攀牆 | 4 | 512×128 | 8 | 是 |
| fall | 摔落 | 4 | 512×128 | 8 | 否(停最後格) |

## 檔案 (Files)

每角色每色：5 個單列檔 `{char}_{color}_{anim}.png`（1 列 × N 欄）＋ 1 個合併表 `{char}_{color}_sheet.png`（768×640，6 欄 × 5 列，列序 idle, walk, jump, climb, fall，不足 6 格右側透明）。

| 檔案 | 尺寸 |
|---|---|
| ayan_blue_climb.png | 512×128 |
| ayan_blue_fall.png | 512×128 |
| ayan_blue_idle.png | 512×128 |
| ayan_blue_jump.png | 512×128 |
| ayan_blue_sheet.png | 768×640 |
| ayan_blue_walk.png | 768×128 |
| ayan_red_climb.png | 512×128 |
| ayan_red_fall.png | 512×128 |
| ayan_red_idle.png | 512×128 |
| ayan_red_jump.png | 512×128 |
| ayan_red_sheet.png | 768×640 |
| ayan_red_walk.png | 768×128 |
| ayan_teal_climb.png | 512×128 |
| ayan_teal_fall.png | 512×128 |
| ayan_teal_idle.png | 512×128 |
| ayan_teal_jump.png | 512×128 |
| ayan_teal_sheet.png | 768×640 |
| ayan_teal_walk.png | 768×128 |
| ayan_yellow_climb.png | 512×128 |
| ayan_yellow_fall.png | 512×128 |
| ayan_yellow_idle.png | 512×128 |
| ayan_yellow_jump.png | 512×128 |
| ayan_yellow_sheet.png | 768×640 |
| ayan_yellow_walk.png | 768×128 |
| xiaopan_blue_climb.png | 512×128 |
| xiaopan_blue_fall.png | 512×128 |
| xiaopan_blue_idle.png | 512×128 |
| xiaopan_blue_jump.png | 512×128 |
| xiaopan_blue_sheet.png | 768×640 |
| xiaopan_blue_walk.png | 768×128 |
| xiaopan_red_climb.png | 512×128 |
| xiaopan_red_fall.png | 512×128 |
| xiaopan_red_idle.png | 512×128 |
| xiaopan_red_jump.png | 512×128 |
| xiaopan_red_sheet.png | 768×640 |
| xiaopan_red_walk.png | 768×128 |
| xiaopan_teal_climb.png | 512×128 |
| xiaopan_teal_fall.png | 512×128 |
| xiaopan_teal_idle.png | 512×128 |
| xiaopan_teal_jump.png | 512×128 |
| xiaopan_teal_sheet.png | 768×640 |
| xiaopan_teal_walk.png | 768×128 |
| xiaopan_yellow_climb.png | 512×128 |
| xiaopan_yellow_fall.png | 512×128 |
| xiaopan_yellow_idle.png | 512×128 |
| xiaopan_yellow_jump.png | 512×128 |
| xiaopan_yellow_sheet.png | 768×640 |
| xiaopan_yellow_walk.png | 768×128 |

- `preview.png`：預覽（上排小攀、下排阿岩；左→右 teal, red, yellow, blue）
- `characters.json`：同上資料 manifest
- `src/`：原始生成圖；`../tools/build_sprites.py`：重建腳本

---

# v2 規格（遊戲正式使用，Owner spec）

| 檔案 | 尺寸 | 說明 |
|---|---|---|
| `male.png` / `female.png` | 432×635 | 基底表（阿岩 / 小攀），換色區為淺灰白（保留明暗），可直接乘色 |
| `male_mask.png` / `female_mask.png` | 432×635 | 白色(#FFFFFF)+alpha，只標示換色區：背心、粉袋、手套 |
| `male_{red,blue,green,yellow}.png`、`female_{…}.png` | 432×635 | 預先上色版（fallback）= base × color（僅 mask 區） |
| `manifest.json` | — | 引擎讀取用 |

- frame：**72×127 px**，6 欄 × 5 列（row0 idle 4、row1 walk 6、row2 jump 4、row3 climb 4、row4 fall 4；不足 6 格處透明）
- anchor：**[36, 123]**（frame 內腳底中心點）；facesLeft = false（朝右，朝左請翻轉）
- scale：**0.1593** = 18 / 113（站立 idle 角色像素高度中位數：阿岩 105 px、小攀 122 px（含馬尾）→ 繪出約 16.7 / 19.4 px，對應碰撞箱高 18 px）
- 玩家色（順序固定）：red `#e8483b`、blue `#2f8fe0`、green `#3fb85a`、yellow `#f2b630`
- fps：idle 6、walk 12、jump 8、climb 8、fall 8
- 合成公式：`out = base × (1 − m) + base × color × m`（m = mask alpha/255）；Canvas 可用 offscreen 畫 mask → `globalCompositeOperation='multiply'` 填色 → `destination-in` 以 base alpha 裁切。
- 安全帽固定青綠、不換色。上方 v1 的 `xiaopan_*`/`ayan_*` 舊檔保留僅供參考。
- 重建：`python3 tools/build_v2.py`
