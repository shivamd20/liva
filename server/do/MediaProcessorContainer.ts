import { Container } from "@cloudflare/containers";

/**
 * Cloudflare Container that runs ffmpeg for video post-processing.
 * The Docker image exposes an HTTP server on port 8000 with endpoints:
 *   PUT /chunk/:index - Upload a WebM chunk
 *   POST /process - Start processing pipeline
 *   GET /status - Poll processing status
 *   GET /output/:filename - Download processed output files
 */
export class MediaProcessorContainer extends Container {
	defaultPort = 8000;
	sleepAfter = "15m";
}
