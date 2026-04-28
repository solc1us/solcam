from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import cv2
import numpy as np
from typing import List

app = FastAPI()

# Biar frontend (Next.js) bisa akses backend ini
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/process-strip")
async def process_strip(files: List[UploadFile] = File(...)):
    # Validasi input: Minimal harus ada 3 foto
    if len(files) != 3:
        raise HTTPException(status_code=400, detail="Minimal 3 foto.")

    images = []
    try:
        # 1. Native 4:3 Crop Resolution dari 720p sensor
        PHOTO_W, PHOTO_H = 960, 720
        # Margin di-scale up biar proporsional
        MARGIN = 60 
        FOOTER_SPACE = 150
        
        # 2. Dynamic Canvas Calculation
        STRIP_W = PHOTO_W + (2 * MARGIN)
        STRIP_H = (PHOTO_H * 3) + (4 * MARGIN) + FOOTER_SPACE

        for file in files:
            content = await file.read()
            nparr = np.frombuffer(content, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None: continue

            # --- CENTER CROP LOGIC ---
            h, w = img.shape[:2]
            target_w = int(h * (4/3)) # 960
            start_x = (w - target_w) // 2
            cropped = img[0:h, start_x:start_x + target_w]

            # NO DOWNSCALING: Langsung pake hasil crop 960x720
            # (Tapi tetep pake cv2.resize jaga-jaga kalo input kamera beda)
            resized = cv2.resize(cropped, (PHOTO_W, PHOTO_H), interpolation=cv2.INTER_LANCZOS4)
            images.append(resized)

        # 3. Create Canvas (Pinkish Background)
        canvas = np.full((STRIP_H, STRIP_W, 3), (200, 160, 255), dtype=np.uint8)

        # 4. Stitching
        for i, photo in enumerate(images):
            y_start = MARGIN + i * (PHOTO_H + MARGIN)
            y_end = y_start + PHOTO_H
            canvas[y_start:y_end, MARGIN:MARGIN + PHOTO_W] = photo

        # Branding Footer (Optional)
        cv2.putText(canvas, "solCam.", (MARGIN, STRIP_H - 60), 
                    cv2.FONT_HERSHEY_TRIPLEX, 2.0, (255, 255, 255), 3)

        _, buffer = cv2.imencode('.jpg', canvas, [cv2.IMWRITE_JPEG_QUALITY, 95])
        return Response(content=buffer.tobytes(), media_type="image/jpeg")

    except Exception as e:
        print(f"Error logic: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)