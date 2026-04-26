from __future__ import annotations

from pathlib import Path
from textwrap import wrap
import math

from gtts import gTTS
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from moviepy import AudioFileClip, ImageClip, concatenate_videoclips

BASE_DIR = Path("/home/ubuntu/inspection-booking-platform/video-output")
BASE_DIR.mkdir(parents=True, exist_ok=True)

SCREENSHOT_ADMIN = Path("/home/ubuntu/screenshots/inspect_eaglebuiltpa_2026-04-26_05-20-31_1648.webp")
SCREENSHOT_PUBLIC = Path("/home/ubuntu/screenshots/inspect_eaglebuiltpa_2026-04-26_05-20-55_1828.webp")
FONT_REGULAR = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
FONT_BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
SIZE = (1280, 720)
FPS = 24

SCENES = [
    {
        "slug": "01_opening",
        "title": "驗屋預約管理系統\n操作教學影片",
        "body": "這支影片會帶你快速看懂兩條主流程：住戶如何完成預約，以及操作員如何在後台查詢與處理改期。",
        "caption": "客戶端預約 + 後台改期管理，一次看懂",
        "narration": "本影片將示範驗屋預約管理系統的基本操作流程，包含客戶預約流程，以及操作員後台管理流程。",
        "kind": "title",
    },
    {
        "slug": "02_public_entry",
        "title": "客戶端入口",
        "body": "住戶必須從公司提供的正式分享連結進入，系統才會載入對應建案的品牌資訊、驗證入口與預約流程。",
        "caption": "請使用公司提供的正式分享連結",
        "narration": "首先，客戶必須使用公司提供的正式分享連結進入系統，請不要自行修改網址內容。",
        "kind": "screenshot",
        "screenshot": str(SCREENSHOT_PUBLIC),
        "image_side": "left",
    },
    {
        "slug": "03_public_verify",
        "title": "住戶驗證與預約",
        "body": "先輸入住戶戶號與已登記手機完成驗證。驗證成功後，依序選擇日期、時段，填寫 Gmail 或聯絡資料，再送出預約。",
        "caption": "先驗證，再選日期與時段",
        "narration": "進入頁面後，系統會先要求輸入住戶戶號與已登記的手機號碼。只有驗證成功後，才會顯示既有預約資料與可預約時段。接著，請先選擇想預約的日期，再選擇仍有名額的時段，最後填寫 Gmail 或聯絡資料並送出。",
        "kind": "screenshot",
        "screenshot": str(SCREENSHOT_PUBLIC),
        "image_side": "right",
    },
    {
        "slug": "04_public_notes",
        "title": "客戶端注意事項",
        "body": "一、戶號與手機必須與公司登記資料一致。\n二、若沒有可預約時段或驗證失敗，不要反覆亂試，請直接聯繫客服。\n三、送出後請再確認畫面是否顯示預約成功。",
        "caption": "驗證失敗、連結失效或無時段時，請聯繫客服",
        "narration": "客戶端的重點不是功能多，而是避免操作失敗。戶號與手機必須與公司資料一致；若沒有可預約時段、連結失效或驗證失敗，請直接聯繫客服。送出預約後，也要確認畫面是否明確顯示成功。",
        "kind": "bullet",
    },
    {
        "slug": "05_admin_entry",
        "title": "後台登入入口",
        "body": "操作員從主網域根網址進入，就會直接看到管理員登入入口，不需要再手動輸入額外路徑。",
        "caption": "根網址已改為管理員登入入口",
        "narration": "接下來示範操作員後台流程。操作員請從系統首頁進入管理員登入頁，輸入帳號與密碼後登入後台。",
        "kind": "screenshot",
        "screenshot": str(SCREENSHOT_ADMIN),
        "image_side": "left",
    },
    {
        "slug": "06_admin_search",
        "title": "查詢預約與鎖定目標資料",
        "body": "登入後，先進入預約與改期頁籤，再依建案、戶號、類型、狀態與預約日期搜尋。開始改期前，要先核對公司、建案、戶號、時段與目前狀態，避免改錯人。",
        "caption": "先篩選，再核對原預約資料",
        "narration": "登入成功後，可以先看到後台總覽。若要查詢與處理預約，請切換到預約與改期頁籤。在這裡，可以依建案、戶號、類型、狀態與預約日期搜尋，快速找到指定住戶的預約資料。找到目標預約後，請先確認原預約資料是否正確，再開始處理改期。",
        "kind": "bullet",
    },
    {
        "slug": "07_admin_reschedule",
        "title": "改期操作重點",
        "body": "點選編輯改期後，先選新日期。系統會同步可用時段；展開新時段下拉時，也會再次同步最新餘額。額滿時段會顯示餘額 0，但不可選。送出前請填寫備註，系統後端也會再次驗證名額。",
        "caption": "新時段會顯示餘額；額滿不可選",
        "narration": "若客戶需要改期，請點擊編輯改期。系統會展開改期表單，先讓你選擇新的日期。日期切換後，系統會重新同步該日期的可用時段。當你展開新時段下拉選單時，系統也會再次同步最新餘額。請選擇仍有餘額的新時段，填寫改期原因，再按確認改期。系統送出時，後端會再次檢查新時段名額。",
        "kind": "bullet",
    },
    {
        "slug": "08_admin_notes",
        "title": "操作員注意事項",
        "body": "一、改期前一定先核對客戶身份與原預約內容。\n二、額滿時段不能強行安排。\n三、改期完成後要再次確認列表資料是否更新。\n四、不要任意刪除正式預約資料。",
        "caption": "改期前核對資料；改期後確認結果",
        "narration": "操作員端最大的風險不是按錯按鈕，而是在沒有先核對資料時就直接改期或刪資料。新時段若已額滿，不應強行安排；改期完成後，也要再次檢查資料是否更新。若畫面異常，應先停止操作並回報管理者。",
        "kind": "bullet",
    },
    {
        "slug": "09_closing",
        "title": "結語",
        "body": "客戶端請依正式分享連結進入，操作員則從根網址登入後台。兩端都應依正式資料操作，避免誤用測試資訊或錯誤連結。",
        "caption": "請依正式連結與正式資料操作",
        "narration": "以上就是驗屋預約管理系統的基本操作流程。實際使用時，請依公司提供的正式連結與正式資料進行操作。",
        "kind": "title",
    },
]


def load_font(size: int, bold: bool = False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size)


def draw_wrapped_text(draw: ImageDraw.ImageDraw, text: str, font, fill, box, line_spacing=10):
    x, y, width, _ = box
    chars_per_line = max(10, int(width / max(font.size * 0.95, 1)))
    lines = []
    for paragraph in text.split("\n"):
        if not paragraph.strip():
            lines.append("")
            continue
        lines.extend(wrap(paragraph, width=chars_per_line, break_long_words=False, replace_whitespace=False) or [paragraph])
    current_y = y
    for line in lines:
        draw.text((x, current_y), line, font=font, fill=fill)
        bbox = draw.textbbox((x, current_y), line or "　", font=font)
        current_y += (bbox[3] - bbox[1]) + line_spacing
    return current_y


def make_background():
    img = Image.new("RGB", SIZE, (15, 37, 52))
    draw = ImageDraw.Draw(img)
    for i in range(SIZE[1]):
        ratio = i / SIZE[1]
        r = int(17 + 60 * ratio)
        g = int(45 + 18 * ratio)
        b = int(62 + 8 * ratio)
        draw.line([(0, i), (SIZE[0], i)], fill=(r, g, b))
    glow = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse((820, 420, 1260, 860), fill=(235, 162, 116, 56))
    gdraw.ellipse((-120, -40, 380, 420), fill=(63, 125, 160, 50))
    glow = glow.filter(ImageFilter.GaussianBlur(70))
    img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
    return img


def fit_image(path: Path, target_size):
    img = Image.open(path).convert("RGB")
    img.thumbnail(target_size, Image.LANCZOS)
    canvas = Image.new("RGB", target_size, (29, 45, 58))
    x = (target_size[0] - img.size[0]) // 2
    y = (target_size[1] - img.size[1]) // 2
    canvas.paste(img, (x, y))
    return canvas


def render_scene(scene):
    img = make_background()
    draw = ImageDraw.Draw(img)

    title_font = load_font(48, bold=True)
    body_font = load_font(25)
    small_font = load_font(22)
    chip_font = load_font(20, bold=True)

    draw.rounded_rectangle((56, 54, 170, 92), radius=18, fill=(34, 62, 78))
    draw.text((77, 64), "操作教學", font=chip_font, fill=(240, 246, 248))

    if scene["kind"] == "title":
        draw_wrapped_text(draw, scene["title"], title_font, (247, 249, 250), (72, 150, 760, 200), 8)
        draw_wrapped_text(draw, scene["body"], body_font, (220, 232, 238), (72, 330, 670, 240), 12)
        draw.rounded_rectangle((72, 596, 720, 650), radius=20, fill=(22, 73, 109))
        draw.text((98, 610), scene["caption"], font=small_font, fill=(250, 252, 255))
        if SCREENSHOT_PUBLIC.exists():
            public_img = fit_image(SCREENSHOT_PUBLIC, (410, 255))
            admin_img = fit_image(SCREENSHOT_ADMIN, (410, 255)) if SCREENSHOT_ADMIN.exists() else public_img
            img.paste(public_img, (808, 120))
            img.paste(admin_img, (808, 400))
    else:
        screenshot = Path(scene.get("screenshot", "")) if scene.get("screenshot") else None
        image_side = scene.get("image_side", "left")
        if screenshot and screenshot.exists():
            fitted = fit_image(screenshot, (620, 530))
            if image_side == "left":
                img.paste(fitted, (52, 116))
                text_box = (718, 150, 510, 440)
            else:
                img.paste(fitted, (608, 116))
                text_box = (72, 150, 470, 440)
        else:
            text_box = (72, 150, 1130, 440)

        draw_wrapped_text(draw, scene["title"], title_font, (247, 249, 250), (text_box[0], text_box[1], text_box[2], 120), 10)
        body_y = draw_wrapped_text(draw, scene["body"], body_font, (226, 235, 239), (text_box[0], text_box[1] + 110, text_box[2], text_box[3]), 12)
        if scene["kind"] == "bullet":
            draw.rounded_rectangle((70, 565, 1160, 642), radius=24, fill=(24, 74, 112))
            draw_wrapped_text(draw, scene["caption"], small_font, (250, 252, 255), (100, 585, 1020, 60), 8)
        else:
            draw.rounded_rectangle((70, 592, 1160, 652), radius=24, fill=(24, 74, 112))
            draw_wrapped_text(draw, scene["caption"], small_font, (250, 252, 255), (98, 607, 1020, 42), 8)

    output_path = BASE_DIR / f"{scene['slug']}.png"
    img.save(output_path, quality=95)
    return output_path


def synthesize_audio(scene):
    audio_path = BASE_DIR / f"{scene['slug']}.mp3"
    tts = gTTS(scene["narration"], lang="zh-TW")
    tts.save(str(audio_path))
    return audio_path


def build_video():
    clips = []
    for scene in SCENES:
        image_path = render_scene(scene)
        audio_path = synthesize_audio(scene)
        audio_clip = AudioFileClip(str(audio_path))
        duration = audio_clip.duration + 1.0
        clip = ImageClip(str(image_path)).with_duration(duration).with_audio(audio_clip)
        clips.append(clip)
    final = concatenate_videoclips(clips, method="compose")
    output_path = BASE_DIR / "inspection-booking-instruction-video.mp4"
    final.write_videofile(str(output_path), fps=FPS, codec="libx264", audio_codec="aac")
    for clip in clips:
        clip.close()
    final.close()
    return output_path


if __name__ == "__main__":
    build_video()
