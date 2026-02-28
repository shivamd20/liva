import { DurableObject } from "cloudflare:workers";
import { getContainer } from "@cloudflare/containers";
import type { VideosDO } from "./VideosDO";

const MAX_RETRIES = 3;
const CONTAINER_BOOT_BACKOFF_MS = 2000;
const PROCESSING_POLL_INTERVAL_MS = 3000;
const IMMEDIATE_MS = 50;
const STALE_JOB_TIMEOUT_MS = 5 * 60 * 1000;

const FATAL_CONTAINER_PATTERNS = [
	"Connection refused",
	"container port not found",
	"Monitor failed",
	"container not found",
];

function isContainerFatal(err: unknown): boolean {
	const msg = err instanceof Error ? err.message : String(err);
	return FATAL_CONTAINER_PATTERNS.some((p) => msg.includes(p));
}

function futureAlarm(delayMs: number): number {
	return Date.now() + delayMs;
}

type JobStatus =
	| "queued"
	| "uploading_chunks"
	| "processing"
	| "downloading_results"
	| "transcribing"
	| "generating_tts"
	| "complete"
	| "failed";

interface JobRow {
	id: string;
	video_id: string;
	session_id: string;
	user_id: string;
	status: string;
	progress: number;
	error: string | null;
	processed_url: string | null;
	thumbnail_url: string | null;
	audio_url: string | null;
	transcript: string | null;
	total_chunks: number;
	chunks_uploaded: number;
	created_at: number;
	updated_at: number;
	max_retries: number;
}

interface ProcessingJobEnv extends Env {
	MEDIA_PROCESSOR?: DurableObjectNamespace;
}

export class ProcessingJobDO extends DurableObject<Env> {
	state: DurableObjectState;
	sql: SqlStorage;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.state = ctx;
		this.sql = ctx.storage.sql;
		this.initializeTables();
	}

	private initializeTables() {
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS jobs (
				id TEXT PRIMARY KEY,
				video_id TEXT NOT NULL,
				session_id TEXT NOT NULL,
				user_id TEXT NOT NULL,
				status TEXT NOT NULL,
				progress INTEGER DEFAULT 0,
				error TEXT,
				processed_url TEXT,
				thumbnail_url TEXT,
				audio_url TEXT,
				transcript TEXT,
				total_chunks INTEGER DEFAULT 0,
				chunks_uploaded INTEGER DEFAULT 0,
				created_at INTEGER,
				updated_at INTEGER,
				max_retries INTEGER DEFAULT 0,
				processing_started INTEGER DEFAULT 0
			);
		`);
		try {
			this.sql.exec("ALTER TABLE jobs ADD COLUMN processing_started INTEGER DEFAULT 0");
		} catch {
			// Column already exists
		}
	}

	private updateJob(
		jobId: string,
		updates: Partial<{
			status: JobStatus;
			progress: number;
			error: string;
			processed_url: string;
			thumbnail_url: string;
			audio_url: string;
			transcript: string;
			chunks_uploaded: number;
			max_retries: number;
		}>
	) {
		const now = Date.now();
		this.sql.exec(
			`UPDATE jobs SET
				status = COALESCE(?, status), progress = COALESCE(?, progress), error = COALESCE(?, error),
				processed_url = COALESCE(?, processed_url), thumbnail_url = COALESCE(?, thumbnail_url),
				audio_url = COALESCE(?, audio_url), transcript = COALESCE(?, transcript),
				chunks_uploaded = COALESCE(?, chunks_uploaded), max_retries = COALESCE(?, max_retries),
				updated_at = ? WHERE id = ?`,
			updates.status ?? null,
			updates.progress ?? null,
			updates.error ?? null,
			updates.processed_url ?? null,
			updates.thumbnail_url ?? null,
			updates.audio_url ?? null,
			updates.transcript ?? null,
			updates.chunks_uploaded ?? null,
			updates.max_retries ?? null,
			now,
			jobId
		);
	}

	private getJob(jobId: string): JobRow | null {
		const row = this.sql.exec("SELECT * FROM jobs WHERE id = ?", jobId).one();
		return row ? (row as unknown as JobRow) : null;
	}

	async startProcessing(params: {
		jobId: string;
		videoId: string;
		sessionId: string;
		userId: string;
		totalChunks: number;
	}): Promise<void> {
		const { jobId, videoId, sessionId, userId, totalChunks } = params;
		const now = Date.now();

		this.sql.exec(
			"UPDATE jobs SET status = 'failed', error = 'Superseded by new processing request', updated_at = ? WHERE video_id = ? AND status NOT IN ('complete', 'failed')",
			now, videoId
		);

		this.sql.exec(
			`INSERT INTO jobs (id, video_id, session_id, user_id, status, progress, total_chunks, chunks_uploaded, created_at, updated_at, max_retries)
			 VALUES (?, ?, ?, ?, 'queued', 0, ?, 0, ?, ?, 0)`,
			jobId,
			videoId,
			sessionId,
			userId,
			totalChunks,
			now,
			now
		);

		await this.state.storage.setAlarm(futureAlarm(IMMEDIATE_MS));
	}

	async getJobStatus(jobId: string): Promise<JobRow | null> {
		return this.getJob(jobId);
	}

	async getJobByVideoId(videoId: string): Promise<JobRow | null> {
		const row = this.sql.exec("SELECT * FROM jobs WHERE video_id = ? ORDER BY created_at DESC LIMIT 1", videoId).one();
		if (!row) return null;
		const job = row as unknown as JobRow;

		if (job.status !== "complete" && job.status !== "failed") {
			const now = Date.now();
			if (now - job.updated_at > STALE_JOB_TIMEOUT_MS) {
				this.updateJob(job.id, { status: "failed", error: "Timed out after 5 minutes of inactivity" });
				return { ...job, status: "failed", error: "Timed out after 5 minutes of inactivity" };
			}
		}

		return job;
	}

	async alarm(): Promise<void> {
		const now = Date.now();
		this.sql.exec(
			"UPDATE jobs SET status = 'failed', error = 'Timed out after 5 minutes of inactivity', updated_at = ? WHERE status NOT IN ('complete', 'failed') AND updated_at < ?",
			now, now - STALE_JOB_TIMEOUT_MS
		);

		const jobs = this.sql.exec("SELECT id FROM jobs WHERE status NOT IN ('complete', 'failed') ORDER BY created_at DESC LIMIT 1").toArray() as { id: string }[];
		if (jobs.length === 0) return;

		const jobId = jobs[0].id;
		const job = this.getJob(jobId);
		if (!job) return;

		try {
			await this.runStateMachine(job);
		} catch (e) {
			const errMsg = e instanceof Error ? e.message : String(e);
			const label = isContainerFatal(e) ? "Container unavailable in this environment" : "Processing error";
			console.error(`[ProcessingJobDO] ${label} for job`, jobId, errMsg);
			this.updateJob(jobId, { status: "failed", error: `${label}: ${errMsg}` });
		}
	}

	private async runStateMachine(job: JobRow): Promise<void> {
		const { id: jobId, status, session_id: sessionId, user_id: userId, video_id: videoId, total_chunks: totalChunks, chunks_uploaded: chunksUploaded, max_retries: maxRetries } = job;

		if (maxRetries >= MAX_RETRIES) {
			this.updateJob(jobId, { status: "failed", error: "Max retries exceeded" });
			return;
		}

		const env = this.env as ProcessingJobEnv;
		if (!env.MEDIA_PROCESSOR) {
			this.updateJob(jobId, { status: "failed", error: "MEDIA_PROCESSOR binding not configured. Containers may not be available in local dev." });
			return;
		}

		let containerStub: { fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response> };
		try {
			containerStub = getContainer(
				env.MEDIA_PROCESSOR as unknown as Parameters<typeof getContainer>[0],
				jobId
			);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			this.updateJob(jobId, { status: "failed", error: `Container unavailable (are Containers deployed?): ${msg}` });
			return;
		}

		switch (status) {
			case "queued": {
				this.updateJob(jobId, { status: "uploading_chunks" });
				await this.state.storage.setAlarm(futureAlarm(IMMEDIATE_MS));
				break;
			}

			case "uploading_chunks": {
				const nextChunkIndex = chunksUploaded;
				if (nextChunkIndex >= totalChunks) {
					this.updateJob(jobId, { status: "processing", progress: 30 });
					await this.state.storage.setAlarm(futureAlarm(IMMEDIATE_MS));
					return;
				}

				const padded = String(nextChunkIndex).padStart(6, "0");
				const r2Key = `monorail/${sessionId}/chunk-${padded}.webm`;

				let chunkBody: ArrayBuffer;
				try {
					const obj = await this.env.files.get(r2Key);
					if (!obj) {
						this.updateJob(jobId, { max_retries: maxRetries + 1 });
						await this.state.storage.setAlarm(futureAlarm(CONTAINER_BOOT_BACKOFF_MS));
						return;
					}
					chunkBody = await obj.arrayBuffer();
				} catch (e) {
					this.updateJob(jobId, { status: "failed", error: `Failed to fetch chunk ${nextChunkIndex} from R2: ${e}` });
					return;
				}

				try {
					const putRes = await containerStub.fetch(`http://container/chunk/${nextChunkIndex}`, {
						method: "PUT",
						body: chunkBody,
					});
					if (!putRes.ok) {
						this.updateJob(jobId, { max_retries: maxRetries + 1 });
						await this.state.storage.setAlarm(futureAlarm(CONTAINER_BOOT_BACKOFF_MS));
						return;
					}
				} catch (e) {
					if (isContainerFatal(e)) {
						this.updateJob(jobId, { status: "failed", error: `Container unavailable in this environment: ${e}` });
						return;
					}
					this.updateJob(jobId, { max_retries: maxRetries + 1 });
					await this.state.storage.setAlarm(futureAlarm(CONTAINER_BOOT_BACKOFF_MS));
					return;
				}

				const newChunksUploaded = chunksUploaded + 1;
				const progress = totalChunks > 0 ? Math.round((newChunksUploaded / totalChunks) * 30) : 30;
				this.updateJob(jobId, { chunks_uploaded: newChunksUploaded, progress, max_retries: 0 });

				if (newChunksUploaded >= totalChunks) {
					this.updateJob(jobId, { status: "processing", progress: 30 });
				}
				await this.state.storage.setAlarm(futureAlarm(IMMEDIATE_MS));
				break;
			}

			case "processing": {
				try {
					const processStarted = (this.sql.exec("SELECT processing_started FROM jobs WHERE id = ?", jobId).one() as { processing_started?: number })?.processing_started;
					if (!processStarted) {
						const processRes = await containerStub.fetch("http://container/process", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ totalChunks, sessionId }),
						});
						if (!processRes.ok) {
							this.updateJob(jobId, { max_retries: maxRetries + 1 });
							await this.state.storage.setAlarm(futureAlarm(CONTAINER_BOOT_BACKOFF_MS));
							return;
						}
						this.sql.exec("UPDATE jobs SET processing_started = 1, updated_at = ? WHERE id = ?", Date.now(), jobId);
					}

					const statusRes = await containerStub.fetch("http://container/status");
					if (!statusRes.ok) {
						this.updateJob(jobId, { max_retries: maxRetries + 1 });
						await this.state.storage.setAlarm(futureAlarm(CONTAINER_BOOT_BACKOFF_MS));
						return;
					}

					const statusJson = (await statusRes.json()) as { status?: string; progress?: number };
					if (statusJson.status === "complete" || statusJson.status === "done") {
						this.updateJob(jobId, { status: "downloading_results", progress: 60, max_retries: 0 });
						await this.state.storage.setAlarm(futureAlarm(IMMEDIATE_MS));
						return;
					}

					const progressVal = typeof statusJson.progress === "number" ? 30 + Math.round(statusJson.progress * 0.3) : 45;
					this.updateJob(jobId, { progress: Math.min(progressVal, 60) });
					await this.state.storage.setAlarm(futureAlarm(PROCESSING_POLL_INTERVAL_MS));
				} catch (e) {
					if (isContainerFatal(e)) {
						this.updateJob(jobId, { status: "failed", error: `Container unavailable in this environment: ${e}` });
						return;
					}
					this.updateJob(jobId, { max_retries: maxRetries + 1 });
					await this.state.storage.setAlarm(futureAlarm(CONTAINER_BOOT_BACKOFF_MS));
				}
				break;
			}

			case "downloading_results": {
				const baseUrl = "http://container/output";
				const outputs = [
					{ path: "video.mp4", r2Key: `processed/${sessionId}/video.mp4`, field: "processed_url" as const },
					{ path: "thumbnail.jpg", r2Key: `processed/${sessionId}/thumbnail.jpg`, field: "thumbnail_url" as const },
					{ path: "audio.wav", r2Key: `processed/${sessionId}/audio.wav`, field: "audio_url" as const },
				];

				const updates: Partial<JobRow> = {};
				for (const { path, r2Key, field } of outputs) {
					try {
						const res = await containerStub.fetch(`${baseUrl}/${path}`);
						if (!res.ok) throw new Error(`HTTP ${res.status}`);
						const body = await res.arrayBuffer();
						await this.env.files.put(r2Key, body);
						updates[field] = r2Key;
					} catch (e) {
						const errPrefix = isContainerFatal(e) ? "Container unavailable" : `Failed to download ${path}`;
						this.updateJob(jobId, { status: "failed", error: `${errPrefix}: ${e}` });
						return;
					}
				}

				this.updateJob(jobId, {
					processed_url: updates.processed_url ?? undefined,
					thumbnail_url: updates.thumbnail_url ?? undefined,
					audio_url: updates.audio_url ?? undefined,
					status: "transcribing",
					progress: 75,
					max_retries: 0,
				});
				await this.state.storage.setAlarm(futureAlarm(IMMEDIATE_MS));
				break;
			}

			case "transcribing": {
				const audioKey = `processed/${sessionId}/audio.wav`;
				const audioObj = await this.env.files.get(audioKey);
				if (!audioObj) {
					this.updateJob(jobId, { status: "failed", error: "Audio file not found in R2" });
					return;
				}

				const audioBytes = await audioObj.arrayBuffer();
				const audioBinary = new Uint8Array(audioBytes);
				// #region agent log
				fetch('http://127.0.0.1:7452/ingest/76d149d6-cce2-4bf2-a818-7dc29428d885',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'34e33e'},body:JSON.stringify({sessionId:'34e33e',location:'ProcessingJobDO.ts:transcribing',message:'audioBinary info',data:{byteLength:audioBytes.byteLength,constructor:audioBinary?.constructor?.name,length:audioBinary.length},timestamp:Date.now(),hypothesisId:'H1-fix'})}).catch(()=>{});
				// #endregion

				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				let transcriptResult: { text?: string; vtt?: string };
				try {
					transcriptResult = (await this.env.AI.run("@cf/openai/whisper-large-v3-turbo", {
						audio: audioBinary,
					} as any)) as { text?: string; vtt?: string };
					// #region agent log
					fetch('http://127.0.0.1:7452/ingest/76d149d6-cce2-4bf2-a818-7dc29428d885',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'34e33e'},body:JSON.stringify({sessionId:'34e33e',location:'ProcessingJobDO.ts:transcribing',message:'AI.run success',data:{hasText:!!transcriptResult?.text,textLen:transcriptResult?.text?.length},timestamp:Date.now(),hypothesisId:'H1-fix'})}).catch(()=>{});
					// #endregion
				} catch (aiErr) {
					// #region agent log
					fetch('http://127.0.0.1:7452/ingest/76d149d6-cce2-4bf2-a818-7dc29428d885',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'34e33e'},body:JSON.stringify({sessionId:'34e33e',location:'ProcessingJobDO.ts:transcribing',message:'AI.run failed',data:{error:String(aiErr),audioByteLen:audioBytes.byteLength},timestamp:Date.now(),hypothesisId:'H1-fix'})}).catch(()=>{});
					// #endregion
					throw aiErr;
				}

				const transcriptJson = JSON.stringify(transcriptResult);
				this.updateJob(jobId, {
					transcript: transcriptJson,
					status: "complete",
					progress: 100,
					max_retries: 0,
				});

				const jobAfter = this.getJob(jobId);
				if (jobAfter) {
					await this.notifyVideosDOComplete(jobAfter);
				}
				break;
			}

			case "complete":
				break;

			default:
				break;
		}
	}

	private async notifyVideosDOComplete(job: JobRow): Promise<void> {
		const { video_id: videoId, user_id: userId, processed_url, thumbnail_url, transcript } = job;
		if (!processed_url || !thumbnail_url) return;

		try {
			const doId = this.env.VIDEOS_DO.idFromName(userId);
			const stub = this.env.VIDEOS_DO.get(doId) as unknown as VideosDO;
			await stub.updateProcessingResult(videoId, {
				processedUrl: processed_url,
				thumbnailUrl: thumbnail_url,
				transcript: transcript ?? undefined,
				status: "READY",
			});
		} catch (e) {
			console.error("[ProcessingJobDO] Failed to update VideosDO", e);
			this.updateJob(job.id, { status: "failed", error: `VideosDO update failed: ${e}` });
		}
	}

	async fetch(request: Request): Promise<Response> {
		return new Response("ProcessingJobDO Active");
	}
}
