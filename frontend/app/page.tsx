"use client";

import { useRef, useState, useEffect } from "react";
import { Camera, Trash2, Download, RefreshCcw, Send } from "lucide-react";

export default function SolCam() {
	const videoRef = useRef<HTMLVideoElement>(null);
	const [photos, setPhotos] = useState<Blob[]>([]);
	const [resultUrl, setResultUrl] = useState<string | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);

	useEffect(() => {
		// Otomatis minta izin kamera pas komponen di-mount
		const startCamera = async () => {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					video: { width: 1280, height: 720 },
				});
				if (videoRef.current) videoRef.current.srcObject = stream;
			} catch (err) {
				console.error("Gagal akses kamera, cek izin browser lu, Cel:", err);
			}
		};
		startCamera();
	}, []);

	const capturePhoto = () => {
		if (photos.length >= 3) return;

		const canvas = document.createElement("canvas");
		canvas.width = 1280;
		canvas.height = 720;
		const ctx = canvas.getContext("2d");

		if (videoRef.current && ctx) {
			ctx.drawImage(videoRef.current, 0, 0);
			canvas.toBlob(
				(blob) => {
					if (blob) setPhotos((prev) => [...prev, blob]);
				},
				"image/jpeg",
				0.9,
			);
		}
	};

	const processStrip = async () => {
		if (photos.length !== 3) return;
		setIsProcessing(true);

		const formData = new FormData();
		photos.forEach((blob, i) => {
			formData.append("files", blob, `snap_${i}.jpg`);
		});

		try {
			const response = await fetch("http://localhost:8000/process-strip", {
				method: "POST",
				body: formData,
			});

			if (!response.ok) throw new Error("Backend lu lagi bermasalah, Cel.");

			const imageBlob = await response.blob();
			const url = URL.createObjectURL(imageBlob);
			setResultUrl(url);
		} catch (err) {
			alert(err);
		} finally {
			setIsProcessing(false);
		}
	};

	const reset = () => {
		if (resultUrl) URL.revokeObjectURL(resultUrl);
		setResultUrl(null);
		setPhotos([]);
	};

	return (
		<main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 font-sans">
			<div className="max-w-4xl w-full space-y-8 text-center">
				<h1 className="text-4xl font-black tracking-tighter italic text-pink-500">
					solCam.
				</h1>

				{!resultUrl ? (
					<div className="space-y-6">
						<div className="relative aspect-video bg-zinc-900 rounded-2xl overflow-hidden border-2 border-zinc-800 shadow-2xl">
							<video
								ref={videoRef}
								autoPlay
								playsInline
								className="w-full h-full object-cover scale-x-[-1]"
							/>
							<div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full text-sm font-mono">
								SHOTS: {photos.length} / 3
							</div>
						</div>

						<div className="flex gap-4 justify-center">
							<button
								onClick={capturePhoto}
								disabled={photos.length >= 3}
								className="flex items-center gap-2 bg-white text-black px-8 py-4 rounded-full font-bold hover:bg-pink-500 hover:text-white transition-all disabled:opacity-50"
							>
								<Camera size={20} /> SNAP
							</button>

							{photos.length === 3 && (
								<button
									onClick={processStrip}
									disabled={isProcessing}
									className="flex items-center gap-2 bg-pink-600 px-8 py-4 rounded-full font-bold hover:shadow-[0_0_20px_rgba(219,39,119,0.5)] transition-all animate-pulse"
								>
									<Send size={20} />{" "}
									{isProcessing ? "PROCESSING..." : "GET STRIP"}
								</button>
							)}

							{photos.length > 0 && (
								<button
									onClick={reset}
									className="p-4 bg-zinc-800 rounded-full hover:bg-red-900 transition-colors"
								>
									<Trash2 size={20} />
								</button>
							)}
						</div>
					</div>
				) : (
					<div className="flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-500">
						<div className="relative group">
							<img
								src={resultUrl}
								alt="SolCam Result"
								className="w-72 shadow-2xl rounded-sm border-[12px] border-white ring-1 ring-zinc-800"
							/>
						</div>
						<div className="flex gap-4">
							<a
								href={resultUrl}
								download="solcam_result.jpg"
								className="flex items-center gap-2 bg-green-600 px-8 py-4 rounded-full font-bold hover:bg-green-500 transition-all"
							>
								<Download size={20} /> SAVE PHOTO
							</a>
							<button
								onClick={reset}
								className="flex items-center gap-2 bg-zinc-800 px-8 py-4 rounded-full font-bold hover:bg-zinc-700 transition-all"
							>
								<RefreshCcw size={20} /> RETAKE
							</button>
						</div>
					</div>
				)}
			</div>
		</main>
	);
}
