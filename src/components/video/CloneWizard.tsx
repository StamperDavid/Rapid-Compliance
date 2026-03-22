'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Camera,
  Upload,
  Mic,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  User,
  Volume2,
  Square,
  Play,
  Sparkles,
  X,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WizardStep = 'welcome' | 'face' | 'voice' | 'processing' | 'done';

interface CloneWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (avatarId: string, avatarName: string) => void;
}

interface CreatedAvatar {
  id: string;
  name: string;
  photoUrl: string;
}

interface VoiceCloneResult {
  voiceId: string;
  voiceName: string;
  provider: 'elevenlabs';
}

type FaceCaptureMode = 'upload' | 'webcam';
type VoiceCaptureMode = 'upload' | 'record';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
  'audio/webm',
  'audio/ogg',
];
const MAX_AUDIO_SIZE = 10 * 1024 * 1024; // 10MB
const MIN_RECORDING_SECONDS = 10;
const MAX_RECORDING_SECONDS = 120;

const VOICE_SAMPLE_SCRIPT = `Hi, my name is [your name] and I'm recording this sample to create my AI voice clone. I want my voice to sound natural and professional, just like I'm speaking to a client or a colleague. Today I'd like to tell you about how our platform helps businesses grow faster with AI-powered tools. The key is consistency — showing up every day with great content.`;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepIndicator({ currentStep }: { currentStep: WizardStep }) {
  const steps: Array<{ key: WizardStep; label: string }> = [
    { key: 'welcome', label: 'Start' },
    { key: 'face', label: 'Face' },
    { key: 'voice', label: 'Voice' },
    { key: 'processing', label: 'Creating' },
    { key: 'done', label: 'Done' },
  ];

  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center gap-1.5 justify-center mb-6">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center gap-1.5">
          <div
            className={cn(
              'w-2 h-2 rounded-full transition-colors',
              i < currentIndex
                ? 'bg-green-500'
                : i === currentIndex
                  ? 'bg-amber-500'
                  : 'bg-zinc-600',
            )}
          />
          {i < steps.length - 1 && (
            <div
              className={cn(
                'w-6 h-px transition-colors',
                i < currentIndex ? 'bg-green-500' : 'bg-zinc-700',
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Webcam capture hook
// ---------------------------------------------------------------------------

function useWebcam() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsActive(true);
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera access denied. Please allow camera access and try again.'
          : 'Could not access camera. Try uploading a photo instead.';
      setError(message);
    }
  }, []);

  const stop = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  const capture = useCallback((): Blob | null => {
    const video = videoRef.current;
    if (!video || !isActive) { return null; }

    const canvas = document.createElement('canvas');
    // Square crop from center
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) { return null; }

    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    // Mirror the image horizontally so it matches what the user sees
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

    let blob: Blob | null = null;
    canvas.toBlob((b) => { blob = b; }, 'image/jpeg', 0.92);
    // toBlob is async but we need sync — use toDataURL fallback
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const binary = atob(dataUrl.split(',')[1]);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    blob = new Blob([array], { type: 'image/jpeg' });
    return blob;
  }, [isActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
      }
    };
  }, []);

  return { videoRef, isActive, error, start, stop, capture };
}

// ---------------------------------------------------------------------------
// Audio recorder hook
// ---------------------------------------------------------------------------

function useAudioRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setAudioBlob(null);
      setAudioUrl(null);
      setSeconds(0);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
      });
      streamRef.current = stream;

      // Prefer webm/opus, fall back to whatever the browser supports
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        // Stop all tracks
        if (streamRef.current) {
          for (const track of streamRef.current.getTracks()) {
            track.stop();
          }
          streamRef.current = null;
        }
      };

      recorder.start(250); // Collect data every 250ms
      setIsRecording(true);

      // Timer
      timerRef.current = setInterval(() => {
        setSeconds((prev) => {
          const next = prev + 1;
          if (next >= MAX_RECORDING_SECONDS) {
            recorder.stop();
            setIsRecording(false);
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow microphone access and try again.'
          : 'Could not access microphone. Try uploading an audio file instead.';
      setError(message);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setSeconds(0);
    setError(null);
  }, [audioUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
      }
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return { isRecording, seconds, audioBlob, audioUrl, error, startRecording, stopRecording, reset };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CloneWizard({ isOpen, onClose, onComplete }: CloneWizardProps) {
  const authFetch = useAuthFetch();

  // Wizard state
  const [step, setStep] = useState<WizardStep>('welcome');
  const [cloneName, setCloneName] = useState('');

  // Face capture state
  const [faceCaptureMode, setFaceCaptureMode] = useState<FaceCaptureMode>('upload');
  const [facePhotoBlob, setFacePhotoBlob] = useState<Blob | null>(null);
  const [facePreviewUrl, setFacePreviewUrl] = useState<string | null>(null);
  const faceFileInputRef = useRef<HTMLInputElement>(null);
  const webcam = useWebcam();

  // Voice capture state
  const [voiceCaptureMode, setVoiceCaptureMode] = useState<VoiceCaptureMode>('record');
  const [voiceFiles, setVoiceFiles] = useState<File[]>([]);
  const voiceFileInputRef = useRef<HTMLInputElement>(null);
  const audioRecorder = useAudioRecorder();
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Processing state
  const [processingPhase, setProcessingPhase] = useState<
    'uploading-photo' | 'creating-profile' | 'cloning-voice' | 'linking' | 'complete' | 'error'
  >('uploading-photo');
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [createdAvatar, setCreatedAvatar] = useState<CreatedAvatar | null>(null);
  const [voiceCloneResult, setVoiceCloneResult] = useState<VoiceCloneResult | null>(null);

  // Reset everything when dialog closes
  const handleClose = useCallback(() => {
    webcam.stop();
    audioRecorder.reset();
    if (facePreviewUrl) {
      URL.revokeObjectURL(facePreviewUrl);
    }
    setStep('welcome');
    setCloneName('');
    setFaceCaptureMode('upload');
    setFacePhotoBlob(null);
    setFacePreviewUrl(null);
    setVoiceCaptureMode('record');
    setVoiceFiles([]);
    setProcessingPhase('uploading-photo');
    setProcessingError(null);
    setCreatedAvatar(null);
    setVoiceCloneResult(null);
    setIsPlayingPreview(false);
    onClose();
  }, [onClose, webcam, audioRecorder, facePreviewUrl]);

  // -----------------------------------------------------------------------
  // Face capture handlers
  // -----------------------------------------------------------------------

  const handleFaceFileSelect = useCallback((file: File) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      return; // Silently ignore wrong type — the input already filters
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return; // File input accept should prevent this
    }
    const blob = file as Blob;
    setFacePhotoBlob(blob);
    setFacePreviewUrl(URL.createObjectURL(blob));
  }, []);

  const handleWebcamCapture = useCallback(() => {
    const blob = webcam.capture();
    if (blob) {
      setFacePhotoBlob(blob);
      setFacePreviewUrl(URL.createObjectURL(blob));
      webcam.stop();
    }
  }, [webcam]);

  const clearFacePhoto = useCallback(() => {
    if (facePreviewUrl) {
      URL.revokeObjectURL(facePreviewUrl);
    }
    setFacePhotoBlob(null);
    setFacePreviewUrl(null);
  }, [facePreviewUrl]);

  // -----------------------------------------------------------------------
  // Voice capture handlers
  // -----------------------------------------------------------------------

  const handleVoiceFileSelect = useCallback((files: FileList) => {
    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.size <= MAX_AUDIO_SIZE) {
        validFiles.push(f);
      }
    }
    setVoiceFiles(validFiles);
  }, []);

  const toggleAudioPreview = useCallback(() => {
    if (!audioPreviewRef.current) { return; }
    if (isPlayingPreview) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current.currentTime = 0;
      setIsPlayingPreview(false);
    } else {
      void audioPreviewRef.current.play();
      setIsPlayingPreview(true);
    }
  }, [isPlayingPreview]);

  // -----------------------------------------------------------------------
  // Processing — runs the full clone flow
  // -----------------------------------------------------------------------

  const runCloneProcess = useCallback(async () => {
    if (!facePhotoBlob) { return; }

    const name = cloneName.trim() || 'My AI Clone';

    try {
      // Step 1: Upload photo
      setProcessingPhase('uploading-photo');
      const photoFormData = new FormData();
      photoFormData.append('file', facePhotoBlob, 'avatar-photo.jpg');

      const uploadRes = await authFetch('/api/video/avatar/upload-photo', {
        method: 'POST',
        body: photoFormData,
      });
      const uploadData = (await uploadRes.json()) as {
        success: boolean;
        url?: string;
        error?: string;
      };

      if (!uploadRes.ok || !uploadData.success || !uploadData.url) {
        throw new Error(uploadData.error ?? 'Photo upload failed');
      }

      // Step 2: Create avatar profile
      setProcessingPhase('creating-profile');
      const createRes = await authFetch('/api/video/avatar-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          frontalImageUrl: uploadData.url,
          source: 'custom',
          role: 'presenter',
          styleTag: 'real',
          isDefault: true,
        }),
      });
      const createData = (await createRes.json()) as {
        success: boolean;
        profile?: { id: string };
        error?: string;
      };

      if (!createRes.ok || !createData.success || !createData.profile) {
        throw new Error(createData.error ?? 'Avatar creation failed');
      }

      const avatarId = createData.profile.id;
      setCreatedAvatar({ id: avatarId, name, photoUrl: uploadData.url });

      // Step 3: Clone voice (if audio was provided)
      const hasVoiceRecording = audioRecorder.audioBlob && audioRecorder.seconds >= MIN_RECORDING_SECONDS;
      const hasVoiceFiles = voiceFiles.length > 0;

      if (hasVoiceRecording || hasVoiceFiles) {
        setProcessingPhase('cloning-voice');
        const voiceFormData = new FormData();
        voiceFormData.append('name', `${name}'s Voice`);
        voiceFormData.append('description', `AI voice clone for ${name}`);

        if (hasVoiceRecording && audioRecorder.audioBlob) {
          voiceFormData.append('samples', audioRecorder.audioBlob, 'voice-recording.webm');
        } else if (hasVoiceFiles) {
          for (const file of voiceFiles) {
            voiceFormData.append('samples', file);
          }
        }

        const cloneRes = await authFetch('/api/video/voice-clone', {
          method: 'POST',
          body: voiceFormData,
        });
        const cloneData = (await cloneRes.json()) as {
          success: boolean;
          voiceId?: string;
          voiceName?: string;
          provider?: 'elevenlabs';
          error?: string;
        };

        if (!cloneRes.ok || !cloneData.success || !cloneData.voiceId) {
          throw new Error(cloneData.error ?? 'Voice cloning failed');
        }

        setVoiceCloneResult({
          voiceId: cloneData.voiceId,
          voiceName: cloneData.voiceName ?? `${name}'s Voice`,
          provider: cloneData.provider ?? 'elevenlabs',
        });

        // Step 4: Link voice to avatar profile
        setProcessingPhase('linking');
        const linkRes = await authFetch(
          `/api/video/avatar-profiles/${encodeURIComponent(avatarId)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              voiceId: cloneData.voiceId,
              voiceName: cloneData.voiceName ?? `${name}'s Voice`,
              voiceProvider: 'elevenlabs',
            }),
          },
        );

        if (!linkRes.ok) {
          const linkData = (await linkRes.json()) as { error?: string };
          throw new Error(linkData.error ?? 'Failed to link voice to avatar');
        }
      }

      setProcessingPhase('complete');
      setStep('done');
    } catch (err) {
      setProcessingPhase('error');
      setProcessingError(err instanceof Error ? err.message : 'Clone process failed');
    }
  }, [authFetch, facePhotoBlob, cloneName, audioRecorder.audioBlob, audioRecorder.seconds, voiceFiles]);

  // Start processing when we enter the processing step
  useEffect(() => {
    if (step === 'processing') {
      void runCloneProcess();
    }
  }, [step, runCloneProcess]);

  // -----------------------------------------------------------------------
  // Navigation helpers
  // -----------------------------------------------------------------------

  const canProceedFromFace = facePhotoBlob !== null;
  const hasVoiceRecording = audioRecorder.audioBlob && audioRecorder.seconds >= MIN_RECORDING_SECONDS;
  const hasVoiceFiles = voiceFiles.length > 0;
  // Voice is optional — user can skip and add voice later
  const canProceedFromVoice = true;

  const goToFace = useCallback(() => {
    setStep('face');
  }, []);

  const goToVoice = useCallback(() => {
    webcam.stop(); // Stop webcam if active
    setStep('voice');
  }, [webcam]);

  const goToProcessing = useCallback(() => {
    setStep('processing');
  }, []);

  const handleFinish = useCallback(() => {
    if (createdAvatar) {
      onComplete(createdAvatar.id, createdAvatar.name);
    }
    handleClose();
  }, [createdAvatar, onComplete, handleClose]);

  // -----------------------------------------------------------------------
  // Render steps
  // -----------------------------------------------------------------------

  function renderWelcome() {
    return (
      <div className="flex flex-col items-center gap-6 py-4">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-amber-400" />
        </div>

        <div className="text-center space-y-2">
          <h3 className="text-xl font-semibold text-white">Create Your AI Clone</h3>
          <p className="text-sm text-zinc-400 max-w-sm">
            In about 2 minutes, you&apos;ll have a digital version of yourself that can star in
            all your videos. Just a headshot photo and a short voice recording.
          </p>
        </div>

        <div className="w-full space-y-3">
          <label className="block text-xs text-zinc-400 font-medium">What should we call your clone?</label>
          <input
            type="text"
            value={cloneName}
            onChange={(e) => setCloneName(e.target.value)}
            placeholder="e.g., David, My Avatar, Sales Dave..."
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm"
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-2 w-full text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <Camera className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span>Step 1: Capture your face (webcam or upload)</span>
          </div>
          <div className="flex items-center gap-2">
            <Mic className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span>Step 2: Record your voice (or upload a sample)</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span>Step 3: Your AI clone is ready to use</span>
          </div>
        </div>

        <button
          onClick={goToFace}
          className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg transition-colors w-full justify-center"
        >
          Get Started
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  function renderFaceCapture() {
    return (
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <h3 className="text-lg font-semibold text-white">Capture Your Face</h3>
          <p className="text-xs text-zinc-400">
            A clear, front-facing headshot works best. Good lighting, neutral background.
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => {
              setFaceCaptureMode('upload');
              webcam.stop();
            }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              faceCaptureMode === 'upload'
                ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
                : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-300',
            )}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Photo
          </button>
          <button
            onClick={() => {
              setFaceCaptureMode('webcam');
              clearFacePhoto();
              void webcam.start();
            }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              faceCaptureMode === 'webcam'
                ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
                : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-300',
            )}
          >
            <Camera className="w-3.5 h-3.5" />
            Use Webcam
          </button>
        </div>

        {/* Photo preview OR capture area */}
        {facePreviewUrl ? (
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-48 h-48 rounded-full overflow-hidden ring-4 ring-green-500/40">
              <Image
                src={facePreviewUrl}
                alt="Your photo"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <button
              onClick={clearFacePhoto}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-red-400 transition-colors"
            >
              <X className="w-3 h-3" />
              Retake / Choose Different Photo
            </button>
          </div>
        ) : faceCaptureMode === 'webcam' ? (
          <div className="flex flex-col items-center gap-3">
            {webcam.error ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <AlertCircle className="w-8 h-8 text-red-400" />
                <p className="text-xs text-red-400 text-center max-w-xs">{webcam.error}</p>
                <button
                  onClick={() => {
                    setFaceCaptureMode('upload');
                    webcam.stop();
                  }}
                  className="text-xs text-amber-400 hover:underline"
                >
                  Switch to file upload
                </button>
              </div>
            ) : (
              <>
                <div className="relative w-56 h-56 rounded-full overflow-hidden bg-zinc-900 ring-2 ring-zinc-600">
                  <video
                    ref={webcam.videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  {!webcam.isActive && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                    </div>
                  )}
                </div>
                {webcam.isActive && (
                  <button
                    onClick={handleWebcamCapture}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-full hover:bg-zinc-200 transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                    Take Photo
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <div
            onClick={() => faceFileInputRef.current?.click()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) { handleFaceFileSelect(file); }
            }}
            onDragOver={(e) => e.preventDefault()}
            className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-zinc-700 rounded-xl cursor-pointer hover:border-amber-500/30 hover:bg-amber-500/5 transition-colors"
          >
            <User className="w-12 h-12 text-zinc-600 mb-3" />
            <p className="text-sm text-zinc-400">Drop your headshot here or click to browse</p>
            <p className="text-xs text-zinc-600 mt-1">JPG, PNG, or WebP — max 2MB</p>
          </div>
        )}

        <input
          ref={faceFileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) { handleFaceFileSelect(file); }
          }}
        />

        {/* Navigation */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => {
              webcam.stop();
              setStep('welcome');
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <button
            onClick={goToVoice}
            disabled={!canProceedFromFace}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors',
              canProceedFromFace
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed',
            )}
          >
            Next: Voice
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  function renderVoiceCapture() {
    const recordingDuration = audioRecorder.seconds;
    const isLongEnough = recordingDuration >= MIN_RECORDING_SECONDS;

    return (
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <h3 className="text-lg font-semibold text-white">Record Your Voice</h3>
          <p className="text-xs text-zinc-400">
            Read the script below for at least {MIN_RECORDING_SECONDS} seconds. This creates your AI voice clone.
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => {
              setVoiceCaptureMode('record');
              setVoiceFiles([]);
            }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              voiceCaptureMode === 'record'
                ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
                : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-300',
            )}
          >
            <Mic className="w-3.5 h-3.5" />
            Record
          </button>
          <button
            onClick={() => {
              setVoiceCaptureMode('upload');
              audioRecorder.reset();
            }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              voiceCaptureMode === 'upload'
                ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
                : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-300',
            )}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Audio
          </button>
        </div>

        {voiceCaptureMode === 'record' ? (
          <div className="space-y-3">
            {/* Sample script */}
            <div className="p-3 bg-zinc-800/50 border border-zinc-700/50 rounded-lg">
              <p className="text-[10px] text-amber-400 font-medium mb-1.5 uppercase tracking-wider">
                Read this aloud:
              </p>
              <p className="text-xs text-zinc-300 leading-relaxed">{VOICE_SAMPLE_SCRIPT}</p>
            </div>

            {/* Recording controls */}
            {audioRecorder.error ? (
              <div className="flex flex-col items-center gap-2 py-4">
                <AlertCircle className="w-6 h-6 text-red-400" />
                <p className="text-xs text-red-400 text-center">{audioRecorder.error}</p>
                <button
                  onClick={() => {
                    setVoiceCaptureMode('upload');
                    audioRecorder.reset();
                  }}
                  className="text-xs text-amber-400 hover:underline"
                >
                  Switch to file upload
                </button>
              </div>
            ) : audioRecorder.audioUrl ? (
              <div className="flex flex-col items-center gap-3 py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleAudioPreview}
                    className="w-10 h-10 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 hover:bg-green-500/30 transition-colors"
                  >
                    {isPlayingPreview ? (
                      <Square className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                  </button>
                  <div>
                    <p className="text-sm text-green-400 font-medium">Recording complete</p>
                    <p className="text-xs text-zinc-500">{recordingDuration}s recorded</p>
                  </div>
                </div>
                <audio
                  ref={audioPreviewRef}
                  src={audioRecorder.audioUrl}
                  onEnded={() => setIsPlayingPreview(false)}
                />
                <button
                  onClick={() => {
                    audioRecorder.reset();
                    setIsPlayingPreview(false);
                  }}
                  className="text-xs text-zinc-400 hover:text-red-400 transition-colors"
                >
                  Re-record
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-3">
                {audioRecorder.isRecording ? (
                  <>
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center animate-pulse">
                        <Mic className="w-6 h-6 text-red-400" />
                      </div>
                    </div>
                    <p className="text-sm text-red-400 font-medium tabular-nums">
                      Recording: {recordingDuration}s / {MAX_RECORDING_SECONDS}s
                    </p>
                    {!isLongEnough && (
                      <p className="text-xs text-zinc-500">
                        Keep going — need at least {MIN_RECORDING_SECONDS - recordingDuration}s more
                      </p>
                    )}
                    <button
                      onClick={audioRecorder.stopRecording}
                      disabled={!isLongEnough}
                      className={cn(
                        'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                        isLongEnough
                          ? 'bg-red-600 hover:bg-red-500 text-white'
                          : 'bg-zinc-800 text-zinc-600 cursor-not-allowed',
                      )}
                    >
                      <Square className="w-3.5 h-3.5" />
                      {isLongEnough ? 'Stop Recording' : `${MIN_RECORDING_SECONDS - recordingDuration}s remaining`}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => void audioRecorder.startRecording()}
                    className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-medium rounded-full transition-colors"
                  >
                    <Mic className="w-4 h-4" />
                    Start Recording
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">
              Upload 1 or more audio files of you speaking clearly. MP3, WAV, M4A, WebM, or OGG. Max 10MB each.
              Best results with 30+ seconds of clear speech.
            </p>

            {voiceFiles.length > 0 ? (
              <div className="space-y-2">
                {voiceFiles.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="flex items-center gap-2 p-2 bg-zinc-800/50 rounded-lg">
                    <Volume2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    <span className="text-xs text-zinc-300 truncate flex-1">{f.name}</span>
                    <span className="text-[10px] text-zinc-500">
                      {(f.size / 1024 / 1024).toFixed(1)}MB
                    </span>
                  </div>
                ))}
                <button
                  onClick={() => setVoiceFiles([])}
                  className="text-xs text-zinc-400 hover:text-red-400 transition-colors"
                >
                  Remove all
                </button>
              </div>
            ) : (
              <div
                onClick={() => voiceFileInputRef.current?.click()}
                className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-zinc-700 rounded-xl cursor-pointer hover:border-amber-500/30 hover:bg-amber-500/5 transition-colors"
              >
                <Volume2 className="w-8 h-8 text-zinc-600 mb-2" />
                <p className="text-sm text-zinc-400">Drop audio files here or click to browse</p>
              </div>
            )}

            <input
              ref={voiceFileInputRef}
              type="file"
              accept={ACCEPTED_AUDIO_TYPES.join(',')}
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) { handleVoiceFileSelect(e.target.files); }
              }}
            />
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => setStep('face')}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <button
            onClick={goToProcessing}
            disabled={!canProceedFromVoice || audioRecorder.isRecording}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors',
              canProceedFromVoice && !audioRecorder.isRecording
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed',
            )}
          >
            {hasVoiceRecording || hasVoiceFiles ? 'Create My Clone' : 'Skip Voice (Add Later)'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  function renderProcessing() {
    const phases: Array<{
      key: typeof processingPhase;
      label: string;
    }> = [
      { key: 'uploading-photo', label: 'Uploading your photo...' },
      { key: 'creating-profile', label: 'Creating avatar profile...' },
      { key: 'cloning-voice', label: 'Cloning your voice (this may take a moment)...' },
      { key: 'linking', label: 'Linking voice to avatar...' },
    ];

    const currentIndex = phases.findIndex((p) => p.key === processingPhase);

    if (processingPhase === 'error') {
      return (
        <div className="flex flex-col items-center gap-4 py-8">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <div className="text-center space-y-1">
            <h3 className="text-lg font-semibold text-red-400">Something went wrong</h3>
            <p className="text-sm text-zinc-400 max-w-xs">{processingError}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep('face')}
              className="px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors"
            >
              Go Back
            </button>
            <button
              onClick={() => {
                setProcessingPhase('uploading-photo');
                setProcessingError(null);
                void runCloneProcess();
              }}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <Loader2 className="w-12 h-12 animate-spin text-amber-400" />
        <div className="text-center space-y-1">
          <h3 className="text-lg font-semibold text-white">Creating Your Clone</h3>
          <p className="text-sm text-zinc-400">Please don&apos;t close this window.</p>
        </div>

        <div className="w-full space-y-2">
          {phases.map((phase, i) => (
            <div
              key={phase.key}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all',
                i < currentIndex
                  ? 'bg-green-500/10 text-green-400'
                  : i === currentIndex
                    ? 'bg-amber-500/10 text-amber-300'
                    : 'bg-zinc-800/30 text-zinc-600',
              )}
            >
              {i < currentIndex ? (
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              ) : i === currentIndex ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border border-zinc-600 flex-shrink-0" />
              )}
              {phase.label}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderDone() {
    return (
      <div className="flex flex-col items-center gap-6 py-4">
        <div className="relative">
          {createdAvatar?.photoUrl ? (
            <div className="relative w-32 h-32 rounded-full overflow-hidden ring-4 ring-green-500/60">
              <Image
                src={createdAvatar.photoUrl}
                alt={createdAvatar.name}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="w-32 h-32 rounded-full bg-zinc-700 flex items-center justify-center ring-4 ring-green-500/60">
              <User className="w-12 h-12 text-zinc-400" />
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="text-center space-y-1">
          <h3 className="text-xl font-semibold text-white">
            Meet {createdAvatar?.name ?? 'Your Clone'}!
          </h3>
          <p className="text-sm text-zinc-400">
            Your AI clone is ready. It&apos;s been set as your default avatar for all future videos.
          </p>
        </div>

        {/* Clone details */}
        <div className="w-full space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 rounded-lg text-xs text-green-400">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            Avatar profile created &amp; set as default
          </div>
          {voiceCloneResult ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 rounded-lg text-xs text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              Voice &ldquo;{voiceCloneResult.voiceName}&rdquo; cloned via {voiceCloneResult.provider}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 rounded-lg text-xs text-zinc-500">
              <Mic className="w-3.5 h-3.5 flex-shrink-0" />
              No voice cloned — you can add one later from the Voice tab
            </div>
          )}
        </div>

        <button
          onClick={handleFinish}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors w-full justify-center"
        >
          <Sparkles className="w-4 h-4" />
          Start Creating Videos
        </button>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { handleClose(); } }}>
      <DialogContent className="max-w-md bg-zinc-900 border-zinc-700">
        <DialogHeader>
          <DialogTitle className="sr-only">Clone Wizard</DialogTitle>
          <DialogDescription className="sr-only">
            Create your AI clone with face and voice capture
          </DialogDescription>
        </DialogHeader>

        <StepIndicator currentStep={step} />

        {step === 'welcome' && renderWelcome()}
        {step === 'face' && renderFaceCapture()}
        {step === 'voice' && renderVoiceCapture()}
        {step === 'processing' && renderProcessing()}
        {step === 'done' && renderDone()}
      </DialogContent>
    </Dialog>
  );
}
