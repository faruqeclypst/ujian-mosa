"""
Generate high-fidelity Android launcher icons adhering strictly to Google Material Design & Adaptive Icon specifications.
Generates:
  - ic_launcher_background.webp (108dp adaptive background)
  - ic_launcher_foreground.webp (108dp adaptive foreground with centered logo in safe zone)
  - ic_launcher.webp (48dp legacy squircle icon)
  - ic_launcher_round.webp (48dp legacy circular masked icon)
  - splash.png (512x512 splash screen)
"""

import os
import sys

# Ensure UTF-8 output on Windows PowerShell
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
from PIL import Image, ImageDraw, ImageFilter

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_LOGOS = os.path.join(BASE_DIR, 'assets-raw', 'logos')
CONFIGS_ICONS = os.path.join(BASE_DIR, 'configs', 'app-icons')
ANDROID_RES = os.path.join(BASE_DIR, 'android', 'app', 'src', 'main', 'res')

DENSITIES = [
    {'dir': 'mipmap-mdpi',    'adaptive': 108, 'legacy': 48},
    {'dir': 'mipmap-hdpi',    'adaptive': 162, 'legacy': 72},
    {'dir': 'mipmap-xhdpi',   'adaptive': 216, 'legacy': 96},
    {'dir': 'mipmap-xxhdpi',  'adaptive': 324, 'legacy': 144},
    {'dir': 'mipmap-xxxhdpi', 'adaptive': 432, 'legacy': 192},
]

PROFILES = [
    {
        'key': 'examaa',
        'raw_icon': os.path.join(RAW_LOGOS, 'Ikon A Panah Biru Mengilap.png'),
        'dark_tint': (0, 15, 60, 255),
        'bg_color_hex': '#0047BA',
        'scale_ratio': 345 / 432.0,  # ~80% of canvas fits safe zone seamlessly
    },
    {
        'key': 'browser',
        'raw_icon': os.path.join(RAW_LOGOS, 'Ikon A Globe Hijau Neon.png'),
        'dark_tint': (0, 25, 5, 255),
        'bg_color_hex': '#058A18',
        'scale_ratio': 345 / 432.0,
    }
]

def make_circle_mask(size, margin=0):
    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((margin, margin, size - margin, size - margin), fill=255)
    return mask

def process_profile(prof):
    key = prof['key']
    print(f"\n=======================================================")
    print(f"  Generating Icons for Profile: {key}")
    print(f"=======================================================")
    
    raw_img = Image.open(prof['raw_icon']).convert('RGBA')
    bbox = raw_img.getbbox()
    badge = raw_img.crop(bbox)
    bw, bh = badge.size
    
    preset_dir = os.path.join(CONFIGS_ICONS, key)
    
    # 1. Generate Mipmap Densities
    for d in DENSITIES:
        d_name = d['dir']
        a_size = d['adaptive'] # 108dp canvas
        l_size = d['legacy']   # 48dp canvas
        
        target_preset = os.path.join(preset_dir, d_name)
        os.makedirs(target_preset, exist_ok=True)
        
        # --- A. Adaptive Background (ic_launcher_background.webp) ---
        # Generate blurred background from badge matching colors and depth
        bg_blur = badge.resize((a_size, a_size), Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(radius=max(2, int(a_size * 0.07))))
        dark_overlay = Image.new('RGBA', (a_size, a_size), prof['dark_tint'])
        bg_composite = Image.blend(bg_blur.convert('RGB'), dark_overlay.convert('RGB'), 0.20).convert('RGBA')
        
        bg_path = os.path.join(target_preset, 'ic_launcher_background.webp')
        bg_composite.save(bg_path, 'WEBP', quality=95)
        
        # --- B. Adaptive Foreground (ic_launcher_foreground.webp) ---
        # Logo centered with safe-zone margin (never clipped by circular or squircle masks)
        target_fg_badge_size = int(a_size * prof['scale_ratio'])
        scale = target_fg_badge_size / max(bw, bh)
        b_w, b_h = int(bw * scale), int(bh * scale)
        b_resized = badge.resize((b_w, b_h), Image.Resampling.LANCZOS)
        
        fg_canvas = Image.new('RGBA', (a_size, a_size), (0, 0, 0, 0))
        fg_canvas.paste(b_resized, ((a_size - b_w) // 2, (a_size - b_h) // 2), b_resized)
        
        fg_path = os.path.join(target_preset, 'ic_launcher_foreground.webp')
        fg_canvas.save(fg_path, 'WEBP', quality=95)
        
        # --- C. Legacy Squircle Icon (ic_launcher.webp - 48dp) ---
        legacy_icon = badge.resize((l_size, l_size), Image.Resampling.LANCZOS)
        leg_path = os.path.join(target_preset, 'ic_launcher.webp')
        legacy_icon.save(leg_path, 'WEBP', quality=95)
        
        # --- D. Legacy Round Icon (ic_launcher_round.webp - 48dp) ---
        # Full composite scaled to legacy, then masked with smooth circle
        full_comp_a = Image.alpha_composite(bg_composite, fg_canvas)
        full_comp_l = full_comp_a.resize((l_size, l_size), Image.Resampling.LANCZOS)
        
        # Circle mask with 1-2px margin
        circle_mask = make_circle_mask(l_size, margin=max(1, int(l_size * 0.03)))
        round_icon = Image.new('RGBA', (l_size, l_size), (0, 0, 0, 0))
        round_icon.paste(full_comp_l, (0, 0), circle_mask)
        
        round_path = os.path.join(target_preset, 'ic_launcher_round.webp')
        round_icon.save(round_path, 'WEBP', quality=95)
        
        print(f"  [OK] {d_name}: adaptive ({a_size}x{a_size}), legacy ({l_size}x{l_size})")

    # 2. Adaptive XML for anydpi-v26
    anydpi_dir = os.path.join(preset_dir, 'mipmap-anydpi-v26')
    os.makedirs(anydpi_dir, exist_ok=True)
    xml_content = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
"""
    with open(os.path.join(anydpi_dir, 'ic_launcher.xml'), 'w', encoding='utf-8') as f:
        f.write(xml_content)
    with open(os.path.join(anydpi_dir, 'ic_launcher_round.xml'), 'w', encoding='utf-8') as f:
        f.write(xml_content)
    print("  [OK] mipmap-anydpi-v26 xml generated.")

    # 3. Values ic_launcher_background.xml
    values_dir = os.path.join(preset_dir, 'values')
    os.makedirs(values_dir, exist_ok=True)
    val_xml = f"""<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">{prof['bg_color_hex']}</color>
</resources>
"""
    with open(os.path.join(values_dir, 'ic_launcher_background.xml'), 'w', encoding='utf-8') as f:
        f.write(val_xml)
    print("  [OK] values/ic_launcher_background.xml generated.")

    # 4. Splash Screen (512x512)
    splash_icon = badge.resize((380, 380), Image.Resampling.LANCZOS)
    splash_canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    splash_canvas.paste(splash_icon, ((512 - 380) // 2, (512 - 380) // 2), splash_icon)
    preset_drawable = os.path.join(preset_dir, 'drawable')
    os.makedirs(preset_drawable, exist_ok=True)
    splash_path = os.path.join(preset_drawable, 'splash.png')
    splash_canvas.save(splash_path, 'PNG')
    print("  [OK] drawable/splash.png generated.")

def copy_to_android_res(active_key='examaa'):
    import shutil
    src_dir = os.path.join(CONFIGS_ICONS, active_key)
    print(f"\n🔄 Copying {active_key} icons directly to android/app/src/main/res...")
    for item in os.listdir(src_dir):
        s = os.path.join(src_dir, item)
        d = os.path.join(ANDROID_RES, item)
        if os.path.isdir(s):
            shutil.copytree(s, d, dirs_exist_ok=True)
        else:
            if item == 'splash.png':
                drawable_dir = os.path.join(ANDROID_RES, 'drawable')
                os.makedirs(drawable_dir, exist_ok=True)
                shutil.copy2(s, os.path.join(drawable_dir, 'splash.png'))
            else:
                shutil.copy2(s, d)
    print("✅ Icons applied to Android project!")

if __name__ == '__main__':
    for p in PROFILES:
        process_profile(p)
    copy_to_android_res('examaa')
    print("\n🎉 ALL ICONS SUCCESSFULLY GENERATED AND APPLIED!")
