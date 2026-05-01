from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import cv2
import numpy as np
from typing import List, Final, Optional

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- GLOBAL CONFIGURATION ---
PHOTO_W: Final = 960
PHOTO_H: Final = 720
MARGIN: Final = 100       # Lebih lega dari sebelumnya (60)
FOOTER_SPACE: Final = 300 # Space buat logo/branding yang lebih proper (150 -> 300)

# Kalkulasi Otomatis (Jangan di-hardcode biar gak error broadcast)
STRIP_W: Final = PHOTO_W + (2 * MARGIN)  # 960 + 200 = 1160
STRIP_H: Final = (PHOTO_H * 3) + (4 * MARGIN) + FOOTER_SPACE # 2160 + 400 + 300 = 2860

# Preload Assets biar hemat I/O
TEMPLATE_BASE: Optional[np.ndarray] = cv2.imread("assets/template.jpg")
OVERLAY_IMG: Optional[np.ndarray] = cv2.imread("assets/overlay.png", cv2.IMREAD_UNCHANGED)

# Sanity Check & Resize Assets di awal (Startup)
if TEMPLATE_BASE is not None:
    TEMPLATE_BASE = cv2.resize(TEMPLATE_BASE, (STRIP_W, STRIP_H))
else:
    print("Warning: template.jpg not found. Using pink fallback.")
    TEMPLATE_BASE = np.full((STRIP_H, STRIP_W, 3), (200, 160, 255), dtype=np.uint8)

if OVERLAY_IMG is not None:
    OVERLAY_IMG = cv2.resize(OVERLAY_IMG, (STRIP_W, STRIP_H), interpolation=cv2.INTER_LANCZOS4)

def apply_alpha_overlay(base: np.ndarray, overlay: np.ndarray) -> np.ndarray:
    """Rigorous Alpha Blending for 4-channel PNG overlay."""
    if overlay.shape[2] != 4:
        # Kalau overlay ga transparan, langsung timpa (addWeighted)
        return cv2.addWeighted(base, 0.5, overlay[:,:,:3], 0.5, 0)
    
    # Split channels
    b, g, r, a = cv2.split(overlay)
    overlay_color = cv2.merge((b, g, r))
    
    # Normalisasi alpha mask (0-1)
    mask = a.astype(float) / 255.0
    mask = cv2.merge([mask, mask, mask]) # 3-channel mask

    # Formula: Result = (Foreground * Alpha) + (Background * (1 - Alpha))
    foreground = overlay_color.astype(float) * mask
    background = base.astype(float) * (1.0 - mask)
    
    return cv2.add(foreground, background).astype(np.uint8)

@app.post("/process-strip")
async def process_strip(files: List[UploadFile] = File(...)):
    if len(files) != 3:
        raise HTTPException(status_code=400, detail="Requirement: 3 images.")

    images = []
    try:
        # 1. Processing Input Images (Crop & Resize)
        for file in files:
            content = await file.read()
            nparr = np.frombuffer(content, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None: continue

            h, w = img.shape[:2]
            target_w = int(h * (4/3))
            start_x = (w - target_w) // 2
            cropped = img[0:h, start_x:start_x + target_w]
            
            resized = cv2.resize(cropped, (PHOTO_W, PHOTO_H), interpolation=cv2.INTER_LANCZOS4)
            images.append(resized)

        # 2. Start with Template (Deep Copy biar ga ngerusak global template)
        canvas = TEMPLATE_BASE.copy()

        # 3. Layer 1: Paste Photos (Middle Layer)
        for i, photo in enumerate(images):
            y_start = MARGIN + i * (PHOTO_H + MARGIN)
            y_end = y_start + PHOTO_H
            x_start = MARGIN
            x_end = MARGIN + PHOTO_W
            
            # Timpa area template dengan foto
            canvas[y_start:y_end, x_start:x_end] = photo

        # 4. Layer 2: Apply Alpha Overlay (Foreground Layer)
        if OVERLAY_IMG is not None:
            canvas = apply_alpha_overlay(canvas, OVERLAY_IMG)

        # 5. Optional: Branding Text (Bisa lu hapus kalo template udah ada logo)
        cv2.putText(canvas, "solCam.", (MARGIN, STRIP_H - 60), 
                    cv2.FONT_HERSHEY_TRIPLEX, 2.0, (255, 255, 255), 3)

        # Encode & Send
        _, buffer = cv2.imencode('.jpg', canvas, [cv2.IMWRITE_JPEG_QUALITY, 95])
        return Response(content=buffer.tobytes(), media_type="image/jpeg")

    except Exception as e:
        print(f"Logic Error: {e}")
        raise HTTPException(status_code=500, detail="Server borked.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)