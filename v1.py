import cv2
import numpy as np
from typing import Final, List

# Konfigurasi Dimensi (Rigid Constants)
CAM_WIDTH: Final = 1280
CAM_HEIGHT: Final = 720
# Kita crop tengah jadi 600x450 biar pas di strip vertikal
PHOTO_W: Final = 600
PHOTO_H: Final = 450
MARGIN: Final = 40
STRIP_WIDTH: Final = PHOTO_W + (2 * MARGIN)
STRIP_HEIGHT: Final = (PHOTO_H * 3) + (4 * MARGIN) + 100 # +100 buat space logo/footer

def main() -> None:
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, CAM_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CAM_HEIGHT)

    captured_photos: List[np.ndarray] = []
    print("solCam Active. Tekan 's' buat snap, 'q' buat exit.")

    while len(captured_photos) < 3:
        ret, frame = cap.read()
        if not ret:
            break

        # Mirroring biar kayak cermin pas pose
        frame = cv2.flip(frame, 1)
        
        # Guide Box: Kasih liat area yang bakal di-crop di preview
        start_x = (CAM_WIDTH - PHOTO_W) // 2
        start_y = (CAM_HEIGHT - PHOTO_H) // 2
        preview = frame.copy()
        cv2.rectangle(preview, (start_x, start_y), (start_x + PHOTO_W, start_y + PHOTO_H), (255, 255, 255), 2)
        
        cv2.imshow('solCam Preview - Press S to Snap', preview)

        key = cv2.waitKey(1) & 0xFF
        if key == ord('s'):
            # Center Cropping logic
            crop_frame = frame[start_y:start_y+PHOTO_H, start_x:start_x+PHOTO_W]
            captured_photos.append(crop_frame)
            print(f"Captured {len(captured_photos)}/3")
        elif key == ord('q'):
            cap.release()
            cv2.destroyAllWindows()
            return

    # --- Bagian Penggabungan (Stitching Logic) ---
    
    # Bikin Background Pink (BGR: 220, 180, 255)
    canvas = np.full((STRIP_HEIGHT, STRIP_WIDTH, 3), (200, 160, 255), dtype=np.uint8)

    # Susun foto ke canvas
    current_y = MARGIN
    for photo in captured_photos:
        canvas[current_y:current_y+PHOTO_H, MARGIN:MARGIN+PHOTO_W] = photo
        current_y += PHOTO_H + MARGIN

    # Tambahin Text/Branding "solCam" ala Photoism
    cv2.putText(canvas, "solCam", (MARGIN, STRIP_HEIGHT - 40), 
                cv2.FONT_HERSHEY_TRIPLEX, 1.2, (255, 255, 255), 2)
    
    cv2.putText(canvas, "ONCE AGAIN", (STRIP_WIDTH - 180, 35), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)

    # Output Final
    cv2.imshow('solCam Final Strip', canvas)
    cv2.imwrite('solcam_result.jpg', canvas)
    print("Hasil di-save sebagai solcam_result.jpg")
    
    cv2.waitKey(0)
    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()