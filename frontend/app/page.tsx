"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Camera, Download, RefreshCcw, Send, X } from "lucide-react";

export default function SolCam() {
	const videoRef = useRef<HTMLVideoElement>(null);
	const streamRef = useRef<MediaStream | null>(null);
	// Slot-based state: [photo1, photo2, photo3]
	const [photos, setPhotos] = useState<(Blob | null)[]>([null, null, null]);
	const [resultUrl, setResultUrl] = useState<string | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);
	const [isFlashing, setIsFlashing] = useState(false);

	const startCamera = useCallback(async () => {
		try {
			if (streamRef.current && videoRef.current) {
				videoRef.current.srcObject = streamRef.current;
				return;
			}
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { width: 1280, height: 720 },
			});
			streamRef.current = stream;
			if (videoRef.current) videoRef.current.srcObject = stream;
		} catch (err) {
			console.error("Camera access failed:", err);
		}
	}, []);

	useEffect(() => {
		if (!resultUrl) startCamera();
	}, [resultUrl, startCamera]);

	const capturePhoto = () => {
		// Cari slot pertama yang masih null
		const emptyIndex = photos.findIndex((p) => p === null);
		if (emptyIndex === -1) return;

		setIsFlashing(true);
		setTimeout(() => setIsFlashing(false), 150);

		const canvas = document.createElement("canvas");
		canvas.width = 1280;
		canvas.height = 720;
		const ctx = canvas.getContext("2d");

		if (videoRef.current && ctx) {
			ctx.translate(canvas.width, 0);
			ctx.scale(-1, 1);
			ctx.drawImage(videoRef.current, 0, 0);
			canvas.toBlob(
				(blob) => {
					if (blob) {
						const newPhotos = [...photos];
						newPhotos[emptyIndex] = blob;
						setPhotos(newPhotos);
					}
				},
				"image/jpeg",
				0.9,
			);
		}
	};

	const removePhoto = (index: number) => {
		const newPhotos = [...photos];
		newPhotos[index] = null;
		setPhotos(newPhotos);
	};

	const processStrip = async () => {
		if (photos.some((p) => p === null)) return;
		setIsProcessing(true);
		const formData = new FormData();
		// Kirim foto sesuai urutan slot
		photos.forEach((blob, i) => {
			if (blob) formData.append("files", blob, `snap_${i}.jpg`);
		});

		try {
			const response = await fetch("http://localhost:8000/process-strip", {
				method: "POST",
				body: formData,
			});
			if (!response.ok) throw new Error("Backend failed.");
			const imageBlob = await response.blob();
			setResultUrl(URL.createObjectURL(imageBlob));
		} catch (err) {
			alert(err);
		} finally {
			setIsProcessing(false);
		}
	};

	const reset = () => {
		if (resultUrl) URL.revokeObjectURL(resultUrl);
		setResultUrl(null);
		setPhotos([null, null, null]);
	};

	const getDownloadName = () => {
		const timestamp = new Date()
			.toISOString()
			.replace(/[:.]/g, "-")
			.slice(0, 19);
		return `solcam_${timestamp}.jpg`;
	};

	return (
		<main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
			<div className="w-full max-w-6xl flex flex-col gap-6">
				<h1 className="text-3xl font-black italic text-pink-500 text-center">
					solCam.
				</h1>

				{!resultUrl ? (
					<div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-start">
						{/* 1. Preview Strip (Left Sidebar) */}
						<div className="flex flex-col gap-3 bg-zinc-900/50 p-3 rounded-2xl border border-zinc-800">
							{photos.map((blob, i) => (
								<div
									key={i}
									className="relative aspect-[4/3] bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700"
								>
									{blob ? (
										<>
											<Image
												src={URL.createObjectURL(blob)}
												alt={`Shot ${i + 1}`}
												fill
												unoptimized
												className="object-cover"
											/>
											<button
												onClick={() => removePhoto(i)}
												className="absolute top-1 right-1 p-1 bg-red-600 rounded-full hover:bg-red-500 transition-colors z-10"
											>
												<X size={14} />
											</button>
										</>
									) : (
										<div className="flex items-center justify-center h-full text-zinc-600 text-xs font-mono">
											SLOT {i + 1}
										</div>
									)}
								</div>
							))}
							<button
								onClick={processStrip}
								disabled={photos.some((p) => p === null) || isProcessing}
								className="w-full py-3 bg-pink-600 rounded-xl font-bold text-sm disabled:opacity-30 hover:bg-pink-500 transition-all flex items-center justify-center gap-2"
							>
								<Send size={16} /> {isProcessing ? "Wait..." : "PROCESS"}
							</button>
						</div>

						{/* 2. Live Cam (Main Area) */}
						<div className="space-y-4">
							<div className="relative aspect-video bg-zinc-900 rounded-3xl overflow-hidden border-2 border-zinc-800">
								<video
									ref={videoRef}
									autoPlay
									playsInline
									className="w-full h-full object-cover scale-x-[-1]"
								/>

								{/* Visual Crop Guides (The 160px Clue) */}
								<div className="absolute inset-y-0 left-0 w-[12.5%] bg-black/60 backdrop-blur-[2px] z-20 flex items-center justify-center">
									<span className="[writing-mode:vertical-lr] rotate-180 text-[10px] text-zinc-500 font-bold tracking-widest uppercase">
										Cropped
									</span>
								</div>
								<div className="absolute inset-y-0 right-0 w-[12.5%] bg-black/60 backdrop-blur-[2px] z-20 flex items-center justify-center">
									<span className="[writing-mode:vertical-lr] text-[10px] text-zinc-500 font-bold tracking-widest uppercase">
										Cropped
									</span>
								</div>

								{isFlashing && (
									<div className="absolute inset-0 bg-white animate-in fade-out duration-150 z-30" />
								)}

								<div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40">
									<button
										onClick={capturePhoto}
										disabled={!photos.some((p) => p === null)}
										className="p-6 bg-white text-black rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all disabled:opacity-0 disabled:pointer-events-none"
									>
										<Camera size={32} />
									</button>
								</div>
							</div>
						</div>
					</div>
				) : (
					/* 3. Result View (Optimized for no-scroll) */
					<div className="flex flex-col items-center justify-center gap-6 animate-in fade-in zoom-in duration-500">
						{/* Wrapper Putih (Card) */}
						<div className="bg-white p-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-sm flex items-center justify-center">
							{/* Container Utama dengan Tinggi Konkrit */}
							<div className="relative h-[60vh] aspect-[1160/2860]">
								<Image
									src={resultUrl}
									alt="SolCam High-Res Result"
									fill
									unoptimized
									className="object-contain"
									priority
								/>
							</div>
						</div>
						{/* Action Buttons */}
						<div className="flex gap-4 w-full max-w-[320px]">
							<a
								href={resultUrl}
								download={getDownloadName()}
								className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white py-4 rounded-2xl font-bold transition-all active:scale-95 shadow-lg"
							>
								<Download size={20} /> SAVE
							</a>
							<button
								onClick={reset}
								className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white py-4 rounded-2xl font-bold transition-all active:scale-95 border border-zinc-700 shadow-lg"
							>
								<RefreshCcw size={20} /> NEW
							</button>
						</div>
					</div>
				)}
			</div>
		</main>
	);
}
