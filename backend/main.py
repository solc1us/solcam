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
        raise HTTPException(status_code=400, detail="Lu harus kirim tepat 3 foto, Cel.")

    images = []
    try:
        for file in files:
            # Baca binary data dari stream
            content = await file.read()
            nparr = np.frombuffer(content, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                raise ValueError("Salah satu file bukan gambar valid.")
            images.append(img)

        # Setup dimensi canvas (Photoism style)
        PHOTO_W, PHOTO_H = 600, 450
        MARGIN = 40
        STRIP_W = PHOTO_W + (2 * MARGIN)
        STRIP_H = (PHOTO_H * 3) + (4 * MARGIN) + 80
        
        # Canvas Pink (B, G, R)
        canvas = np.full((STRIP_H, STRIP_W, 3), (200, 160, 255), dtype=np.uint8)
        
        # Proses Stitching
        for i, img in enumerate(images):
            # Resize tiap foto biar seragam sebelum ditempel
            img_resized = cv2.resize(img, (PHOTO_W, PHOTO_H))
            y_offset = MARGIN + i * (PHOTO_H + MARGIN)
            canvas[y_offset:y_offset+PHOTO_H, MARGIN:MARGIN+PHOTO_W] = img_resized

        # Encode balik matriks jadi file JPEG di memory (RAM)
        _, buffer = cv2.imencode('.jpg', canvas)
        return Response(content=buffer.tobytes(), media_type="image/jpeg")

    except Exception as e:
        print(f"Error logic: {e}")
        raise HTTPException(status_code=500, detail="Ada yang bocor di logic processing-nya.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)