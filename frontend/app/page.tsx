"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Image from "next/image"; // Pake ini buat gantiin <img>
import { Camera, Download, RefreshCcw, Send } from "lucide-react"; // Trash2 di-purge

export default function SolCam() {
	const videoRef = useRef<HTMLVideoElement>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const [photos, setPhotos] = useState<Blob[]>([]);
	const [resultUrl, setResultUrl] = useState<string | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);
	const [isFlashing, setIsFlashing] = useState(false);

	const startCamera = useCallback(async () => {
		try {
			if (streamRef.current) {
				if (videoRef.current) videoRef.current.srcObject = streamRef.current;
				return;
			}
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { width: 1280, height: 720 },
			});
			streamRef.current = stream;
			if (videoRef.current) videoRef.current.srcObject = stream;
		} catch (err) {
			console.error("Hardware access error:", err);
		}
	}, []);

	useEffect(() => {
		if (!resultUrl) startCamera();
	}, [resultUrl, startCamera]);

	const capturePhoto = () => {
		if (photos.length >= 3) return;
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
		photos.forEach((blob, i) =>
			formData.append("files", blob, `snap_${i}.jpg`),
		);

		try {
			const response = await fetch("http://localhost:8000/process-strip", {
				method: "POST",
				body: formData,
			});
			if (!response.ok) throw new Error("Backend failure.");
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
		setPhotos([]);
	};

	const getDownloadName = () => {
		const timestamp = new Date()
			.toISOString()
			.replace(/[:.]/g, "-")
			.slice(0, 19);
		return `solcam_${timestamp}.jpg`;
	};

	return (
		<main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6">
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
							{isFlashing && (
								<div className="absolute inset-0 bg-white animate-in fade-out duration-150 z-10" />
							)}
							<div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full text-sm font-mono z-20">
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
									className="flex items-center gap-2 bg-pink-600 px-8 py-4 rounded-full font-bold hover:shadow-[0_0_20px_rgba(219,39,119,0.5)] transition-all"
								>
									<Send size={20} />{" "}
									{isProcessing ? "PROCESSING..." : "GET STRIP"}
								</button>
							)}
						</div>
					</div>
				) : (
					<div className="flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-500">
						{/* Pake Next Image: width/height harus set atau pake fill */}
						<div className="relative w-72 h-[480px]">
							<Image
								src={resultUrl}
								alt="SolCam Photo Strip Result"
								fill
								unoptimized
								className="shadow-2xl rounded-sm border-[12px] border-white ring-1 ring-zinc-800 object-contain"
							/>
						</div>
						<div className="flex gap-4">
							<a
								href={resultUrl}
								download={getDownloadName()}
								className="flex items-center gap-2 bg-green-600 px-8 py-4 rounded-full font-bold hover:bg-green-500 transition-all"
							>
								<Download size={20} /> SAVE
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
