import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import {
  Camera,
  RefreshCw,
  Zap,
  Layout as LayoutIcon,
  Timer,
  Image as ImageIcon,
  Upload,
  Download,
  Menu,
  X,
  Settings,
  Type,
  History,
  ChevronDown,
  Power,
  PowerOff,
  Loader2,
  Sparkles,
  Maximize2,
  ChevronLeft,
  SwitchCamera,
  Share2,
  Check
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';
import { removeBackground, mergeWithBackground, overlayForeground, generateTraditionalStrip } from './services/geminiService';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LAYOUTS = [
  { id: '1x4', name: '1×4 Strips', icon: <LayoutIcon className="w-4 h-4" />, aspect: 'aspect-video' },
  { id: '2x2', name: '2×2 Grid', icon: <LayoutIcon className="w-4 h-4" />, aspect: 'aspect-square' },
  { id: 'single', name: 'Single Shot', icon: <ImageIcon className="w-4 h-4" />, aspect: 'aspect-video' },
  { id: 'editorial', name: 'Editorial (Vertical)', icon: <Type className="w-4 h-4" />, aspect: 'aspect-[2/3]' },
];

const TIMERS = [
  { id: 0, name: '0s' },
  { id: 3, name: '3s' },
  { id: 5, name: '5s' },
  { id: 10, name: '10s' },
];

const FILTERS = [
  { id: 'normal', name: 'Original', class: '' },
  { id: 'mono', name: 'Retro Mono', class: 'grayscale contrast-125' },
  { id: 'sepia', name: 'Aged Sepia', class: 'sepia contrast-110 brightness-90' },
  { id: 'high-contrast', name: 'Press Print', class: 'contrast-200 grayscale' },
  { id: 'soft', name: 'Soft Focus', class: 'blur-[0.5px] brightness-110' },
  { id: 'grain', name: 'Film Grain', class: 'contrast-125 brightness-105' },
];

const EFFECTS = [
  { id: 'timestamp', name: 'Timestamp', icon: <History className="w-4 h-4" /> },
  { id: 'vignette', name: 'Vignette', icon: <ImageIcon className="w-4 h-4" /> },
  { id: 'noise', name: 'Noise', icon: <Type className="w-4 h-4" /> },
];

const TEMPLATES = [
  { id: 'editorial-red', name: 'Editorial Red', category: 'Editorial', url: '/frames/template_01.png', isPremium: true },
  { id: 'minimal-bw', name: 'Minimal Mono', category: 'Minimal', url: '/frames/template_02.png', isPremium: false },
  { id: 'cute-pink', name: 'Kawaii Pink', category: 'Cute', url: '/frames/template_03.png', isPremium: true },
  { id: 'vintage-sepia', name: 'Old Press', category: 'Vintage', url: '/frames/template_04.png', isPremium: false },
  { id: 'editorial-blue', name: 'Vogue Blue', category: 'Editorial', url: '/frames/template_05.png', isPremium: true },
  { id: 'minimal-dot', name: 'Dotted Grid', category: 'Minimal', url: '/frames/template_06.png', isPremium: false },
  { id: 'cute-star', name: 'Starry Night', category: 'Cute', url: '/frames/template_07.png', isPremium: false },
  { id: 'vintage-newspaper', name: 'Daily News', category: 'Vintage', url: '/frames/template_08.png', isPremium: true },
];

const CATEGORIES = ['All', 'Editorial', 'Minimal', 'Cute', 'Vintage'];

const FRAMES = [
  {
    id: 'queva',
    name: 'QUEVA',
    category: 'traditional',
    bg: '/frame 01/Queva layer 1.png',
    fg: '/frame 01/Queva layer 3.png',
    thumbnail: '/frame 01/Queva layer 1.png'
  },
  {
    id: 'numero',
    name: 'NUMERO',
    category: 'magazine',
    bg: '/frame 02/Numero layer 1.png',
    fg: null,
    thumbnail: '/frame 02/Numero layer 1.png'
  },
  {
    id: 'vogue',
    name: 'VOGUE',
    category: 'magazine',
    bg: '/frame 03/VOGUE layer 1.png',
    fg: null,
    thumbnail: '/frame 03/VOGUE layer 1.png'
  },
  {
    id: 'vogue2',
    name: 'VOGUE II',
    category: 'magazine',
    bg: '/frame 04/VOGUE2 layer 1.png',
    fg: '/frame 04/VOGUE2 layer 3.png',
    thumbnail: '/frame 04/VOGUE2 layer 1.png'
  },
  {
    id: 'vogue3',
    name: 'VOGUE III',
    category: 'magazine',
    bg: '/frame 05/VOGUE3 layer 1.png',
    fg: '/frame 05/VOGUE3 layer 3.png',
    thumbnail: '/frame 05/VOGUE3 layer 1.png'
  }
];

export default function App() {
  const [capturedPhotos, setCapturedPhotos] = useState<(string | null)[]>(Array(10).fill(null));
  const [currentLayout, setCurrentLayout] = useState('1x4');
  const [currentTimer, setCurrentTimer] = useState(0);
  const [currentFilter, setCurrentFilter] = useState('normal');
  const [isAuto, setIsAuto] = useState(false);
  const [isFlash, setIsFlash] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [isFullScreenCamera, setIsFullScreenCamera] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const autoRunningRef = useRef(false);
  const autoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // New states for Preview Page
  const [view, setView] = useState<'landing' | 'frame_type_selection' | 'layout_selection' | 'quantity' | 'payment' | 'capture' | 'selection' | 'preview' | 'final_review'>('landing');
  const [selectedLayout, setSelectedLayout] = useState<'1x4' | '2x2'>('1x4');
  const [frameCategory, setFrameCategory] = useState<'traditional' | 'magazine' | null>(null);
  const [printQuantity, setPrintQuantity] = useState(3);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [previewStep, setPreviewStep] = useState(0);
  const [stepFrames, setStepFrames] = useState<string[]>(Array(5).fill('queva'));
  const [stepResults, setStepResults] = useState<(string | null)[]>(Array(5).fill(null));
  const [selectedFrameId, setSelectedFrameId] = useState('queva');
  const [defaultFrameId, setDefaultFrameId] = useState('queva');
  const [transparentPersons, setTransparentPersons] = useState<string[]>([]);
  const [finalResult, setFinalResult] = useState<string | null>(null);

  // Gallery States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTemplateId, setSelectedTemplateId] = useState('editorial-red');

  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current);
      if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
    };
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const filledCount = capturedPhotos.filter(p => p !== null).length;
      if (filledCount >= 10) {
        alert("Gallery is full! You can only take up to 10 photos.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setCapturedPhotos(prev => {
          const filled = prev.filter(p => p !== null);
          const next = [result, ...filled];
          while (next.length < 10) next.push(null);
          return next.slice(0, 10);
        });
      };
      reader.readAsDataURL(file);
    }
    // Reset input value to allow uploading the same file again
    if (event.target) event.target.value = '';
  };

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setCapturedPhotos(prev => {
        const filled = prev.filter(p => p !== null);
        const next = [imageSrc, ...filled];
        while (next.length < 10) next.push(null);
        return next.slice(0, 10);
      });
    }
  }, [webcamRef]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleCaptureClick = () => {
    if (isAutoRunning) return;

    const filledCount = capturedPhotos.filter(p => p !== null).length;
    if (filledCount >= 10) {
      alert("Gallery is full! You can only take up to 10 photos.");
      return;
    }

    // Trigger visual feedback
    setIsCapturing(true);
    setTimeout(() => setIsCapturing(false), 200);

    if (currentTimer === 0) {
      capture();
      return;
    }
    let count = currentTimer;
    setCountdown(count);
    const interval = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(interval);
        setCountdown(null);
        capture();
      } else {
        setCountdown(count);
      }
    }, 1000);
  };

  const handleAutoClick = () => {
    if (autoRunningRef.current) {
      autoRunningRef.current = false;
      setIsAutoRunning(false);
      setIsAuto(false);
      setCountdown(null);
      if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current);
      if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
      return;
    }

    autoRunningRef.current = true;
    setIsAutoRunning(true);
    setIsAuto(true);

    const takePhotoSequence = () => {
      if (!autoRunningRef.current) return;

      if (currentTimer === 0) {
        setCountdown(null);
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
          setCapturedPhotos(prev => {
            const filled = prev.filter(p => p !== null);
            if (filled.length >= 10) {
              autoRunningRef.current = false;
              setIsAutoRunning(false);
              setIsAuto(false);
              alert("Gallery is full!");
              return prev;
            }
            const next = [imageSrc, ...filled];
            while (next.length < 10) next.push(null);

            const newFilledCount = next.filter(p => p !== null).length;
            if (newFilledCount < 10 && autoRunningRef.current) {
              autoTimeoutRef.current = setTimeout(takePhotoSequence, 800);
            } else {
              autoRunningRef.current = false;
              setIsAutoRunning(false);
              setIsAuto(false);
              if (newFilledCount >= 10) alert("Gallery is full!");
            }
            return next.slice(0, 10);
          });
        }
        return;
      }

      let count = currentTimer;
      setCountdown(count);

      autoIntervalRef.current = setInterval(() => {
        if (!autoRunningRef.current) {
          if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
          return;
        }

        count -= 1;
        if (count <= 0) {
          if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
          setCountdown(null);

          const imageSrc = webcamRef.current?.getScreenshot();
          if (imageSrc) {
            setCapturedPhotos(prev => {
              const filled = prev.filter(p => p !== null);
              if (filled.length >= 10) {
                autoRunningRef.current = false;
                setIsAutoRunning(false);
                setIsAuto(false);
                alert("Gallery is full!");
                return prev;
              }
              const next = [imageSrc, ...filled];
              while (next.length < 10) next.push(null);

              const newFilledCount = next.filter(p => p !== null).length;
              if (newFilledCount < 10 && autoRunningRef.current) {
                autoTimeoutRef.current = setTimeout(takePhotoSequence, 800);
              } else {
                autoRunningRef.current = false;
                setIsAutoRunning(false);
                setIsAuto(false);
                if (newFilledCount >= 10) alert("Gallery is full!");
              }
              return next.slice(0, 10);
            });
          } else {
            autoRunningRef.current = false;
            setIsAutoRunning(false);
            setIsAuto(false);
          }
        } else {
          setCountdown(count);
        }
      }, 1000);
    };

    const filledCount = capturedPhotos.filter(p => p !== null).length;
    if (filledCount >= 10) {
      alert("Gallery is full! You can only take up to 10 photos.");
      return;
    }

    takePhotoSequence();
  };

  const resetPhotos = () => {
    setCapturedPhotos(Array(10).fill(null));
  };

  const togglePhotoSelection = (index: number) => {
    if (capturedPhotos[index] === null) return;
    const limit = frameCategory === 'traditional' ? 4 : printQuantity;
    setSelectedIndices(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      }
      if (prev.length >= limit) return prev;
      return [...prev, index];
    });
  };

  const startProcessing = async () => {
    if (selectedIndices.length !== printQuantity) return;

    setIsProcessing(true);
    setView('preview');
    setPreviewStep(0);
    setStepResults(Array(printQuantity).fill(null));
    setStepFrames(Array(printQuantity).fill(frameCategory === 'traditional' ? 'queva' : 'numero'));

    try {
      // Step 1: Remove backgrounds for all selected photos
      const tPersons = await Promise.all(
        selectedIndices.map(idx => removeBackground(capturedPhotos[idx]!))
      );
      setTransparentPersons(tPersons);

      // Step 2: Initialize first step preview
      const frameId = frameCategory === 'traditional' ? 'queva' : 'numero';
      const frame = FRAMES.find(f => f.id === frameId)!;

      let merged = await mergeWithBackground(tPersons[0], frame.bg, frame.id);
      if (frame.fg) {
        merged = await overlayForeground(merged, frame.fg);
      }

      setStepResults(prev => {
        const next = [...prev];
        next[0] = merged;
        return next;
      });
      setSelectedFrameId(frameId);
    } catch (error) {
      console.error("Processing failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const startProcessingTraditional = async () => {
    if (selectedIndices.length !== 4) return;

    setIsProcessing(true);
    try {
      const selectedPhotos = selectedIndices.map(idx => capturedPhotos[idx]!);
      const stripResult = await generateTraditionalStrip(selectedPhotos, selectedLayout);

      setFinalResult(stripResult);
      setStepResults(Array(printQuantity).fill(stripResult));
      setStepFrames(Array(printQuantity).fill('traditional_strip'));
      setView('preview');
    } catch (error) {
      console.error("Traditional processing failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const switchFrame = async (frameId: string) => {
    if (transparentPersons.length === 0) return;

    setIsProcessing(true);
    setSelectedFrameId(frameId);
    try {
      const frame = FRAMES.find(f => f.id === frameId)!;
      let merged = await mergeWithBackground(transparentPersons[previewStep], frame.bg, frame.id);
      if (frame.fg) {
        merged = await overlayForeground(merged, frame.fg);
      }

      setStepResults(prev => {
        const next = [...prev];
        next[previewStep] = merged;
        return next;
      });
      setStepFrames(prev => {
        const next = [...prev];
        next[previewStep] = frameId;
        return next;
      });
    } catch (error) {
      console.error("Frame switch failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const nextStep = async () => {
    if (previewStep < printQuantity - 1) {
      const nextIdx = previewStep + 1;
      setPreviewStep(nextIdx);

      // If next step result doesn't exist, generate it with default frame
      if (!stepResults[nextIdx]) {
        setIsProcessing(true);
        try {
          const frameId = frameCategory === 'traditional' ? 'queva' : 'numero';
          const frame = FRAMES.find(f => f.id === frameId)!;

          let merged = await mergeWithBackground(transparentPersons[nextIdx], frame.bg, frame.id);
          if (frame.fg) {
            merged = await overlayForeground(merged, frame.fg);
          }

          setStepResults(prev => {
            const next = [...prev];
            next[nextIdx] = merged;
            return next;
          });
          setSelectedFrameId(frameId);
        } catch (error) {
          console.error("Next step processing failed:", error);
        } finally {
          setIsProcessing(false);
        }
      } else {
        setSelectedFrameId(stepFrames[nextIdx]);
      }
    }
  };

  const downloadResult = () => {
    stepResults.forEach((result, index) => {
      if (result) {
        const link = document.createElement('a');
        link.href = result;
        link.download = `daily-snap-page-${index + 1}-${Date.now()}.png`;
        link.click();
      }
    });
  };

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center relative overflow-hidden">
        <img
          src="/landingpage/lading page.gif"
          alt="Landing Page"
          className="absolute inset-0 w-full h-full object-contain"
          referrerPolicy="no-referrer"
        />

        {/* Header Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="absolute top-8 md:top-12 left-0 right-0 z-20 text-center px-4"
        >
          <h1 className="font-display text-3xl md:text-6xl text-ink tracking-tighter uppercase drop-shadow-xl">
            The Daily Snap
          </h1>
          <div className="flex justify-center gap-3 md:gap-4 mt-1 md:mt-2">
            <span className="font-serif italic text-[10px] md:text-xs text-ink/60 uppercase tracking-widest">Edition No. 01</span>
            <span className="font-serif italic text-[10px] md:text-xs text-ink/60 uppercase tracking-widest">Est. 1924</span>
          </div>
        </motion.div>

        <div className="relative z-10 flex flex-col items-center mt-32 md:mt-48">
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setView('frame_type_selection')}
            className="px-8 md:px-12 py-3 md:py-4 bg-ink text-paper font-display text-2xl md:text-3xl uppercase tracking-tighter hover:bg-press-red hover:text-white transition-all shadow-[6px_6px_0px_rgba(0,0,0,0.3)] md:shadow-[8px_8px_0px_rgba(0,0,0,0.3)]"
          >
            Start
          </motion.button>
        </div>

        {/* Decorative elements for landing */}
        <div className="absolute bottom-8 left-8 font-mono text-[10px] text-ink/40 uppercase tracking-[0.3em]">
          Est. 1924
        </div>
        <div className="absolute bottom-8 right-8 font-mono text-[10px] text-ink/40 uppercase tracking-[0.3em]">
          Vol. LXIV
        </div>
      </div>
    );
  }

  if (view === 'frame_type_selection') {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-4 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl w-full text-center space-y-8 md:space-y-12"
        >
          <div className="space-y-2">
            <h2 className="font-display text-4xl md:text-6xl uppercase tracking-tighter">Choose Your Style</h2>
            <p className="font-serif italic text-ink/60 text-sm md:text-lg">"How shall we document your journey today?"</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12">
            {/* Traditional Option */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setFrameCategory('traditional');
                setView('layout_selection');
              }}
              className="group relative bg-white border-4 border-ink p-4 md:p-6 shadow-[12px_12px_0px_rgba(0,0,0,0.1)] hover:shadow-[16px_16px_0px_rgba(196,30,58,0.2)] transition-all flex flex-col items-center"
            >
              <div className="aspect-[4/5] w-full overflow-hidden border-2 border-ink/10 mb-6 bg-paper halftone">
                <img
                  src="/previews/traditional.png"
                  alt="Traditional Style"
                  className="w-full h-full object-cover grayscale brightness-110 contrast-125 group-hover:scale-110 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
              </div>
              <h3 className="font-display text-2xl md:text-3xl uppercase tracking-tighter mb-2 group-hover:text-press-red transition-colors">Photobooth Strip</h3>
              <p className="font-mono text-[10px] md:text-xs uppercase tracking-widest opacity-60">Classic 1x4 • Vintage Feel • Timeless</p>
            </motion.button>

            {/* Magazine Option */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setFrameCategory('magazine');
                setCurrentLayout('editorial');
                setView('quantity');
              }}
              className="group relative bg-white border-4 border-ink p-4 md:p-6 shadow-[12px_12px_0px_rgba(0,0,0,0.1)] hover:shadow-[16px_16px_0px_rgba(196,30,58,0.2)] transition-all flex flex-col items-center"
            >
              <div className="aspect-[4/5] w-full overflow-hidden border-2 border-ink/10 mb-6 bg-paper halftone">
                <img
                  src="/previews/magazine.png"
                  alt="Magazine Style"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
              </div>
              <h3 className="font-display text-2xl md:text-3xl uppercase tracking-tighter mb-2 group-hover:text-press-red transition-colors">Magazine Cover</h3>
              <p className="font-mono text-[10px] md:text-xs uppercase tracking-widest opacity-60">Editorial • High Fashion • Modern</p>
            </motion.button>
          </div>

          <button
            onClick={() => setView('landing')}
            className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-40 hover:opacity-100 hover:text-press-red transition-all"
          >
            ← Back to Masthead
          </button>
        </motion.div>
      </div>
    );
  }

  if (view === 'layout_selection') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8" style={{ backgroundColor: '#F5F5F5', color: '#000' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl w-full text-center"
        >
          {/* Header */}
          <div className="mb-10 md:mb-14">
            <h2 className="font-display text-4xl md:text-6xl uppercase tracking-tighter" style={{ color: '#000' }}>
              Choose Your Layout
            </h2>
            <div className="w-16 h-[2px] mx-auto mt-4 mb-3" style={{ backgroundColor: '#000' }} />
            <p className="font-serif italic text-sm md:text-lg" style={{ color: 'rgba(0,0,0,0.5)' }}>
              "Select the arrangement for your photobooth strip"
            </p>
          </div>

          {/* Layout Cards */}
          <div className="flex flex-col md:flex-row items-stretch justify-center gap-8 md:gap-14 max-w-3xl mx-auto mb-12 md:mb-16">

            {/* Classic 1x4 Strip */}
            <motion.button
              whileHover={{ y: -6, boxShadow: '0 12px 40px rgba(0,0,0,0.1)' }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setSelectedLayout('1x4');
                setCurrentLayout('1x4');
                setView('quantity');
              }}
              className="group flex-1 flex flex-col items-center transition-all duration-300 overflow-hidden"
              style={{
                backgroundColor: '#FFFFFF',
                borderBottom: '2px solid #000',
                boxShadow: '0 2px 20px rgba(0,0,0,0.04)',
              }}
            >
              {/* Fixed-height Image Area */}
              <div className="w-full flex items-end justify-center" style={{ height: '320px', padding: '24px' }}>
                <motion.img
                  src="/previews/layout_1x4.png"
                  alt="Classic 1×4 Strip Layout"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="max-h-full w-auto object-contain group-hover:scale-105 transition-transform duration-500"
                  style={{ maxWidth: '80%' }}
                  referrerPolicy="no-referrer"
                />
              </div>
              {/* Title Area */}
              <div className="w-full py-5 md:py-6 px-4" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                <h3 className="font-display text-xl md:text-2xl uppercase tracking-tight mb-1" style={{ color: '#000' }}>
                  Classic 1×4 Strip
                </h3>
                <p className="font-serif italic text-xs md:text-sm" style={{ color: 'rgba(0,0,0,0.4)' }}>
                  Timeless vertical arrangement
                </p>
              </div>
            </motion.button>

            {/* Modern 2x2 Grid */}
            <motion.button
              whileHover={{ y: -6, boxShadow: '0 12px 40px rgba(0,0,0,0.1)' }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setSelectedLayout('2x2');
                setCurrentLayout('2x2');
                setView('quantity');
              }}
              className="group flex-1 flex flex-col items-center transition-all duration-300 overflow-hidden"
              style={{
                backgroundColor: '#FFFFFF',
                borderBottom: '2px solid #000',
                boxShadow: '0 2px 20px rgba(0,0,0,0.04)',
              }}
            >
              {/* Fixed-height Image Area */}
              <div className="w-full flex items-end justify-center" style={{ height: '320px', padding: '24px' }}>
                <motion.img
                  src="/previews/layout_2x2.png"
                  alt="Modern 2×2 Grid Layout"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="max-h-full w-auto object-contain group-hover:scale-105 transition-transform duration-500"
                  style={{ maxWidth: '80%' }}
                  referrerPolicy="no-referrer"
                />
              </div>
              {/* Title Area */}
              <div className="w-full py-5 md:py-6 px-4" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                <h3 className="font-display text-xl md:text-2xl uppercase tracking-tight mb-1" style={{ color: '#000' }}>
                  Modern 2×2 Grid
                </h3>
                <p className="font-serif italic text-xs md:text-sm" style={{ color: 'rgba(0,0,0,0.4)' }}>
                  Contemporary square format
                </p>
              </div>
            </motion.button>

          </div>

          {/* Back Button */}
          <button
            onClick={() => setView('frame_type_selection')}
            className="font-mono text-[10px] md:text-xs uppercase tracking-[0.3em] transition-all duration-300"
            style={{ color: 'rgba(0,0,0,0.35)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#000'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(0,0,0,0.35)'; }}
          >
            ← Back
          </button>
        </motion.div>
      </div>
    );
  }

  if (view === 'quantity') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8" style={{ backgroundColor: '#F5F5F5', color: '#000' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl w-full text-center"
        >
          {/* Header */}
          <div className="mb-10 md:mb-14">
            <h2 className="font-display text-4xl md:text-6xl uppercase tracking-tighter" style={{ color: '#000' }}>
              Select Quantity
            </h2>
            <div className="w-16 h-[2px] mx-auto mt-4 mb-3" style={{ backgroundColor: '#000' }} />
            <p className="font-serif italic text-sm md:text-lg" style={{ color: 'rgba(0,0,0,0.5)' }}>
              "How many copies shall we print today?"
            </p>
          </div>

          {/* Quantity Options */}
          <div className="grid grid-cols-5 gap-3 md:gap-5 mb-10 md:mb-14 max-w-lg mx-auto">
            {[1, 2, 3, 4, 5].map(q => (
              <motion.button
                key={q}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setPrintQuantity(q)}
                className="flex flex-col items-center justify-center aspect-square transition-all duration-300"
                style={{
                  backgroundColor: printQuantity === q ? '#000' : '#FFFFFF',
                  color: printQuantity === q ? '#F5F5F5' : '#000',
                  borderBottom: printQuantity === q ? '2px solid #000' : '2px solid rgba(0,0,0,0.12)',
                  boxShadow: printQuantity === q ? '0 8px 25px rgba(0,0,0,0.15)' : '0 2px 10px rgba(0,0,0,0.04)',
                  transform: printQuantity === q ? 'scale(1.08)' : 'scale(1)',
                }}
              >
                <span className="font-display text-2xl md:text-4xl">{q}</span>
                <span className="font-mono text-[6px] md:text-[8px] uppercase tracking-widest mt-1" style={{ opacity: 0.6 }}>
                  {q === 1 ? 'Copy' : 'Copies'}
                </span>
              </motion.button>
            ))}
          </div>

          {/* Summary */}
          <div className="max-w-md mx-auto mb-8 md:mb-10 py-6 px-6" style={{ borderTop: '1px solid rgba(0,0,0,0.1)', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
            <div className="flex justify-between items-baseline mb-3">
              <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest" style={{ color: 'rgba(0,0,0,0.5)' }}>Price per copy</span>
              <span className="font-serif text-sm md:text-base" style={{ color: 'rgba(0,0,0,0.7)' }}>100,000 VND</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="font-display text-lg md:text-2xl uppercase tracking-tight">Total</span>
              <span className="font-display text-xl md:text-3xl uppercase tracking-tight" style={{ color: '#000' }}>{(printQuantity * 100000).toLocaleString()} VND</span>
            </div>
          </div>

          {/* Confirm Button */}
          <motion.button
            whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setView('payment')}
            className="w-full max-w-md mx-auto block py-4 md:py-5 font-display text-xl md:text-2xl uppercase tracking-tight transition-all duration-300"
            style={{
              backgroundColor: '#000',
              color: '#F5F5F5',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            }}
          >
            Confirm Order
          </motion.button>

          {/* Back Button */}
          <button
            onClick={() => setView(frameCategory === 'traditional' ? 'layout_selection' : 'frame_type_selection')}
            className="mt-8 font-mono text-[10px] md:text-xs uppercase tracking-[0.3em] transition-all duration-300"
            style={{ color: 'rgba(0,0,0,0.35)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#000'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(0,0,0,0.35)'; }}
          >
            ← Back
          </button>
        </motion.div>
      </div>
    );
  }

  if (view === 'payment') {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-4 md:p-8">
        <div className="max-w-md w-full border-4 border-ink p-6 md:p-12 bg-white shadow-[12px_12px_0px_rgba(0,0,0,0.1)] md:shadow-[16px_16px_0px_rgba(0,0,0,0.1)] flex flex-col items-center">
          <h2 className="font-display text-3xl md:text-4xl uppercase tracking-tighter text-center mb-1 md:mb-2">Secure Payment</h2>
          <p className="font-mono text-[8px] md:text-[10px] uppercase tracking-widest text-ink/40 mb-6 md:mb-8 text-center">Order ID: #{Math.floor(Math.random() * 1000000)}</p>

          <div className="w-48 h-48 md:w-64 md:h-64 border-2 border-ink p-3 md:p-4 bg-white mb-6 md:mb-8 relative group">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=PAYMENT_FOR_${printQuantity}_PRINTS`}
              alt="Payment QR"
              className="w-full h-full grayscale"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-ink/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="font-mono text-[8px] md:text-[10px] uppercase tracking-widest bg-white px-2 md:px-3 py-1 border border-ink">Scan to Pay</span>
            </div>
          </div>

          <div className="text-center space-y-1 md:space-y-2 mb-8 md:mb-12">
            <p className="font-display text-xl md:text-2xl uppercase tracking-tighter">{(printQuantity * 100000).toLocaleString()} VND</p>
            <p className="font-serif italic text-[10px] md:text-xs opacity-60">Please scan the QR code to complete your purchase.</p>
          </div>

          <button
            onClick={() => setView('capture')}
            className="w-full py-3 md:py-4 bg-press-red text-white font-display text-xl md:text-2xl uppercase tracking-tighter hover:bg-ink transition-all shadow-[6px_6px_0px_rgba(0,0,0,0.2)] md:shadow-[8px_8px_0px_rgba(0,0,0,0.2)] flex items-center justify-center gap-2 md:gap-3"
          >
            <Check className="w-5 h-5 md:w-6 md:h-6" />
            Payment Successful
          </button>

          <button
            onClick={() => setView('quantity')}
            className="mt-4 md:mt-6 font-mono text-[8px] md:text-[10px] uppercase tracking-widest underline opacity-40 hover:opacity-100"
          >
            Cancel Order
          </button>
        </div>
      </div>
    );
  }

  if (view === 'selection') {
    const isTraditional = frameCategory === 'traditional';
    const selectionLimit = isTraditional ? 4 : printQuantity;
    const selectionTitle = isTraditional ? 'Select 4 of your best captures' : `Select ${printQuantity} of your best captures`;
    const confirmButtonText = isTraditional ? 'CONFIRM PHOTO STRIP' : 'Choose Magazine Cover';
    const onConfirmSelection = isTraditional ? startProcessingTraditional : startProcessing;

    return (
      <div className="min-h-screen bg-paper text-ink flex flex-col font-sans selection:bg-press-red selection:text-white">
        <header className="p-4 md:p-6 flex flex-col md:flex-row justify-between items-center gap-4 border-b-4 border-ink bg-paper sticky top-0 z-50">
          <button
            onClick={() => setView('capture')}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 border border-ink hover:bg-ink hover:text-paper transition-all font-mono text-[10px] md:text-xs uppercase tracking-widest"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Darkroom
          </button>

          <div className="flex flex-col items-center">
            <h2 className="font-display text-2xl md:text-4xl tracking-tighter uppercase">Photo Selection</h2>
            <div className="flex items-center gap-4 border-y border-ink/20 py-0.5 px-4 mt-1">
              <span className="font-serif italic text-[8px] md:text-[10px] opacity-60">"{selectionTitle}"</span>
              <span className="font-mono text-[8px] md:text-[10px] uppercase tracking-widest opacity-60">{selectedIndices.length} / {selectionLimit} Selected</span>
            </div>
          </div>
          <div className="hidden md:block w-32" /> {/* Spacer */}
        </header>

        <main className="flex-grow p-4 md:p-8 max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-6">
            {capturedPhotos.map((photo, i) => (
              <button
                key={i}
                onClick={() => togglePhotoSelection(i)}
                disabled={photo === null}
                className={cn(
                  "relative aspect-[2/3] border-2 transition-all duration-300 overflow-hidden group",
                  selectedIndices.includes(i)
                    ? "border-press-red shadow-[8px_8px_0px_rgba(196,30,58,0.2)]"
                    : "border-ink/10 hover:border-ink/40"
                )}
              >
                {photo ? (
                  <img src={photo} alt={`Capture ${i + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-ink/5 flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 opacity-10" />
                  </div>
                )}

                {selectedIndices.includes(i) && (
                  <div className="absolute top-2 right-2 bg-press-red text-white w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-bold shadow-lg">
                    {selectedIndices.indexOf(i) + 1}
                  </div>
                )}

                <div className={cn(
                  "absolute inset-0 bg-press-red/10 transition-opacity duration-300",
                  selectedIndices.includes(i) ? "opacity-100" : "opacity-0 group-hover:opacity-30"
                )} />
              </button>
            ))}
          </div>

          <AnimatePresence>
            {selectedIndices.length === selectionLimit && (
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="mt-12 p-8 border-t-4 border-ink bg-paper/50 backdrop-blur-sm flex justify-center"
              >
                <button
                  onClick={onConfirmSelection}
                  disabled={isProcessing}
                  className="px-12 py-6 bg-ink text-paper font-display text-4xl uppercase tracking-tighter hover:bg-press-red hover:text-white transition-all shadow-[12px_12px_0px_rgba(0,0,0,0.3)] flex items-center gap-4 group"
                >
                  {isProcessing ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : (
                    <LayoutIcon className="w-8 h-8 group-hover:rotate-90 transition-transform duration-500" />
                  )}
                  {confirmButtonText}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    );
  }

  if (view === 'final_review') {
    return (
      <div className="min-h-screen bg-paper text-ink flex flex-col font-sans selection:bg-press-red selection:text-white">
        <header className="p-4 md:p-6 flex flex-col md:flex-row justify-between items-center gap-4 border-b-4 border-ink bg-paper sticky top-0 z-50">
          <button
            onClick={() => setView('preview')}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 border border-ink hover:bg-ink hover:text-paper transition-all font-mono text-[10px] md:text-xs uppercase tracking-widest"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Framing
          </button>

          <div className="flex flex-col items-center">
            <h2 className="font-display text-2xl md:text-4xl tracking-tighter uppercase text-center">Final Review</h2>
            <div className="flex items-center gap-4 border-y border-ink/20 py-0.5 px-4 mt-1">
              <span className="font-serif italic text-[8px] md:text-[10px] opacity-60">"Verify all editions before final press"</span>
            </div>
          </div>

          <button
            onClick={downloadResult}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-6 md:px-8 py-2 md:py-3 bg-press-red text-white hover:bg-ink transition-all font-display text-sm md:text-lg uppercase tracking-tight shadow-[4px_4px_0px_rgba(0,0,0,0.2)] md:shadow-[8px_8px_0px_rgba(0,0,0,0.2)]"
          >
            <Download className="w-4 h-4 md:w-5 md:h-5" />
            Export All
          </button>
        </header>

        <main className="flex-grow p-4 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto h-[calc(100vh-120px)] scrollbar-hide">
          <div className={cn(
            "grid gap-6 md:gap-8 lg:gap-12",
            printQuantity === 1 ? "grid-cols-1 max-w-xs md:max-w-md mx-auto" :
              printQuantity === 2 ? "grid-cols-1 md:grid-cols-2 max-w-2xl md:max-w-4xl mx-auto" :
                "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
          )}>
            {stepResults.slice(0, printQuantity).map((result, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex flex-col gap-4 h-full"
              >
                <div className="relative aspect-[2/3] shadow-[15px_15px_0px_rgba(26,26,26,0.05)] border-2 border-ink/10 overflow-hidden bg-white flex-shrink-0">
                  {result ? (
                    <img src={result} alt={`Edition ${i + 1}`} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-ink/5">
                      <Loader2 className="w-8 h-8 animate-spin opacity-20" />
                    </div>
                  )}
                  <div className="absolute top-4 left-4 bg-ink text-paper px-3 py-1 font-display text-sm uppercase tracking-tighter">
                    Edition {i + 1}
                  </div>
                </div>
                <div className="flex justify-between items-center px-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest opacity-60">
                    {frameCategory === 'traditional'
                      ? `Layout: ${selectedLayout === '1x4' ? '1×4 Strip' : '2×2 Grid'}`
                      : `Frame: ${FRAMES.find(f => f.id === stepFrames[i])?.name}`
                    }
                  </span>
                  {frameCategory !== 'traditional' && (
                    <button
                      onClick={() => {
                        setPreviewStep(i);
                        setSelectedFrameId(stepFrames[i]);
                        setView('preview');
                      }}
                      className="text-[10px] font-mono uppercase underline hover:text-press-red"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-20 border-t-2 border-ink pt-8 flex flex-col items-center gap-4">
            <p className="font-serif italic text-sm opacity-60 max-w-2xl text-center">
              "The press is the best instrument for enlightening the mind of man, and improving him as a rational, moral and social being."
            </p>
            <div className="flex gap-8 mt-4">
              <div className="flex flex-col items-center">
                <span className="font-display text-2xl">{printQuantity}</span>
                <span className="font-mono text-[8px] uppercase tracking-widest opacity-40">Unique Prints</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-display text-2xl">300</span>
                <span className="font-mono text-[8px] uppercase tracking-widest opacity-40">DPI Quality</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-display text-2xl">1924</span>
                <span className="font-mono text-[8px] uppercase tracking-widest opacity-40">Archive Ready</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (view === 'preview') {
    if (frameCategory === 'traditional') {
      const filteredTemplates = TEMPLATES.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory;
        return matchesSearch && matchesCategory;
      });

      return (
        <div className="min-h-screen bg-paper text-ink flex flex-col font-sans selection:bg-press-red selection:text-white">
          <header className="p-4 md:p-6 border-b-4 border-ink bg-paper sticky top-0 z-50 flex justify-between items-center">
            <button
              onClick={() => setView('selection')}
              className="flex items-center gap-2 px-4 py-2 border border-ink hover:bg-ink hover:text-paper transition-all font-mono text-[10px] md:text-xs uppercase tracking-widest"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Selection
            </button>
            <h2 className="font-display text-2xl md:text-4xl tracking-tighter uppercase">Gallery Store</h2>
            <div className="w-32 hidden md:block" />
          </header>

          <main className="flex-grow flex flex-col lg:grid lg:grid-cols-12 overflow-hidden h-[calc(100vh-80px)]">
            {/* Left Sidebar (30%) - Live Preview */}
            <aside className="lg:col-span-4 border-r-4 border-ink bg-zinc-50 p-6 md:p-8 flex flex-col items-center justify-between h-full">
              <div className="w-full text-center space-y-2 mb-6">
                <span className="font-mono text-[10px] uppercase tracking-widest opacity-40 italic">Live Preview</span>
                <h3 className="font-display text-xl uppercase tracking-tighter">Your Archival Strip</h3>
              </div>

              <div className="relative flex-grow flex items-center justify-center w-full">
                <div className={cn(
                  "relative bg-white shadow-[20px_20px_60px_rgba(0,0,0,0.1)] border border-ink/5 overflow-hidden transition-all duration-500",
                  selectedLayout === '1x4' ? "h-[550px] md:h-[600px] aspect-[1/3.5]" : "h-[400px] md:h-[500px] aspect-square"
                )}>
                  {/* The photos strip */}
                  {finalResult && (
                    <img src={finalResult} className="w-full h-full object-contain" alt="Current Strip" />
                  )}
                  {/* The template overlay (placeholder) */}
                  <div className="absolute inset-0 pointer-events-none border-[12px] border-ink/5 flex flex-col justify-between p-4">
                    <div className="w-full h-2 bg-press-red/20 rounded-full" />
                    <div className="flex justify-between items-end">
                      <span className="font-display text-[10px] uppercase italic text-ink/20">The Daily Snap</span>
                      <div className="w-4 h-4 rounded-full border border-ink/20" />
                    </div>
                  </div>
                  {/* Overlay text mock for active template */}
                  <div className="absolute top-4 left-0 right-0 text-center">
                    <span className="font-display text-[8px] uppercase tracking-widest opacity-30" style={{ color: selectedTemplateId.includes('red') ? '#C41E3A' : '#1a1a1a' }}>
                      {TEMPLATES.find(t => t.id === selectedTemplateId)?.name}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setView('final_review')}
                className="mt-8 w-full py-4 bg-ink text-paper font-display text-2xl uppercase tracking-tighter hover:bg-press-red hover:text-white transition-all shadow-[8px_8px_0px_rgba(0,0,0,0.2)]"
              >
                PROCEED TO PRINT
              </button>
            </aside>

            {/* Right Main Content (70%) - Template Gallery */}
            <section className="lg:col-span-8 flex flex-col bg-paper h-full overflow-hidden">
              {/* Filter Bar */}
              <div className="p-6 md:p-8 border-b border-ink/10 flex flex-col md:flex-row gap-4 flex-shrink-0">
                <div className="relative flex-grow">
                  <input
                    type="text"
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border-2 border-ink bg-transparent font-serif italic focus:outline-none focus:border-press-red transition-colors"
                  />
                  <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40" />
                </div>
                <div className="relative min-w-[200px]">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-ink bg-transparent font-mono text-xs uppercase appearance-none focus:outline-none focus:border-press-red"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat} COLLECTION</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 pointer-events-none" />
                </div>
              </div>

              {/* Gallery Grid */}
              <div className="flex-grow overflow-y-auto p-6 md:p-8 subtle-scrollbar">
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredTemplates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplateId(template.id)}
                      className={cn(
                        "group flex flex-col text-left transition-all duration-300",
                        selectedTemplateId === template.id ? "scale-105" : "hover:scale-102"
                      )}
                    >
                      <div className={cn(
                        "aspect-[3/4] border-2 transition-all duration-500 overflow-hidden relative bg-zinc-50 p-2",
                        selectedTemplateId === template.id
                          ? "border-press-red shadow-[10px_10px_0px_rgba(196,30,58,0.1)]"
                          : "border-ink/10 hover:border-ink/40"
                      )}>
                        <div className="w-full h-full border border-ink/5 halftone flex items-center justify-center p-4">
                          {/* Placeholder for template thumbnail */}
                          <div className="w-full h-full bg-ink/5 flex flex-col justify-between p-2 border border-ink/10">
                            <div className="h-1 bg-ink/20 w-1/2" />
                            <div className="flex gap-1">
                              {[1, 2, 3].map(i => <div key={i} className="flex-grow aspect-video bg-ink/10" />)}
                            </div>
                            <div className="h-0.5 bg-ink/20 w-full" />
                          </div>
                        </div>
                        {template.isPremium && (
                          <div className="absolute top-4 left-4 bg-ink text-paper text-[8px] font-mono px-2 py-0.5 uppercase tracking-widest z-10">
                            Premium
                          </div>
                        )}
                        {selectedTemplateId === template.id && (
                          <div className="absolute inset-0 bg-press-red/5 flex items-center justify-center pointer-events-none">
                            <Check className="w-8 h-8 text-press-red" />
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex flex-col">
                        <span className="font-display text-sm uppercase tracking-tight">{template.name}</span>
                        <span className="font-mono text-[8px] uppercase tracking-widest opacity-40 mt-0.5">{template.category}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </main>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-paper text-ink flex flex-col font-sans selection:bg-press-red selection:text-white">
        {/* Header */}
        <header className="p-4 md:p-6 flex flex-col md:flex-row justify-between items-center gap-4 border-b-4 border-ink bg-paper sticky top-0 z-50">
          <button
            onClick={() => setView('selection')}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 border border-ink hover:bg-ink hover:text-paper transition-all font-mono text-[10px] md:text-xs uppercase tracking-widest"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Selection
          </button>

          <div className="flex flex-col items-center">
            <h2 className="font-display text-2xl md:text-4xl tracking-tighter uppercase text-center">Edition Preview</h2>
            <div className="flex items-center gap-4 border-y border-ink/20 py-0.5 px-4 mt-1">
              <span className="font-serif italic text-[8px] md:text-[10px] opacity-60">"Step {previewStep + 1} of {printQuantity}: Framing Photo"</span>
              <span className="font-mono text-[8px] uppercase tracking-[0.2em] opacity-40">Vol. LXIV</span>
            </div>
          </div>

          <div className="flex gap-2 md:gap-3 w-full md:w-auto">
            {previewStep > 0 && (
              <button
                onClick={() => {
                  const prevIdx = previewStep - 1;
                  setPreviewStep(prevIdx);
                  setSelectedFrameId(stepFrames[prevIdx]);
                }}
                disabled={isProcessing}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-2 border border-ink hover:bg-ink hover:text-paper transition-all font-mono text-[10px] md:text-xs uppercase tracking-widest disabled:opacity-50"
              >
                <ChevronLeft className="w-3 h-3 md:w-4 md:h-4" />
                Prev
              </button>
            )}
            {previewStep < printQuantity - 1 ? (
              <button
                onClick={nextStep}
                disabled={isProcessing || !stepResults[previewStep]}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 md:px-8 py-2 bg-ink text-paper hover:bg-press-red transition-all font-display text-xs md:text-sm uppercase tracking-tight disabled:opacity-50"
              >
                Next Photo
                <ChevronLeft className="w-3 h-3 md:w-4 md:h-4 rotate-180" />
              </button>
            ) : (
              <button
                onClick={() => setView('final_review')}
                disabled={isProcessing || !stepResults[printQuantity - 1]}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-2 bg-ink text-paper hover:bg-press-red transition-all font-display text-xs md:text-sm uppercase tracking-tight disabled:opacity-50"
              >
                <LayoutIcon className="w-3 h-3 md:w-4 md:h-4" />
                Final Review
              </button>
            )}
          </div>
        </header>

        <main className="flex-grow flex flex-col lg:grid lg:grid-cols-12 overflow-hidden lg:h-[calc(100vh-120px)]">
          {/* Left: Frame Selector */}
          <aside className="lg:col-span-2 border-b-2 lg:border-b-0 lg:border-r-2 border-ink p-4 md:p-6 flex flex-col gap-4 md:gap-6 bg-paper overflow-x-auto lg:overflow-y-auto scrollbar-hide">
            <div className="space-y-1 border-b border-ink/20 pb-4 hidden lg:block">
              <h3 className="font-display text-lg uppercase italic">Select Frame</h3>
              <p className="font-serif text-[10px] opacity-60 leading-tight">
                Choose the editorial layout for your story. Each frame is a testament to the power of the press.
              </p>
            </div>

            <div className="flex lg:flex-col gap-3 md:gap-4 min-w-max lg:min-w-0">
              {FRAMES.filter(f => !frameCategory || f.category === frameCategory).map(frame => (
                <button
                  key={frame.id}
                  onClick={() => switchFrame(frame.id)}
                  disabled={isProcessing}
                  className={cn(
                    "group relative flex flex-col border-2 transition-all duration-300 overflow-hidden w-32 lg:w-full flex-shrink-0",
                    selectedFrameId === frame.id
                      ? "border-ink shadow-[2px_2px_0px_rgba(26,26,26,1)] lg:shadow-[4px_4px_0px_rgba(26,26,26,1)]"
                      : "border-ink/10 hover:border-ink/40 opacity-60 hover:opacity-100"
                  )}
                >
                  <div className="aspect-[4/3] bg-ink/5 overflow-hidden halftone">
                    <img
                      src={frame.thumbnail}
                      alt={frame.name}
                      className={cn(
                        "w-full h-full object-cover transition-transform duration-700",
                        selectedFrameId === frame.id ? "scale-110" : "group-hover:scale-105"
                      )}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="p-2 md:p-3 flex justify-between items-center bg-paper border-t border-ink/10">
                    <span className="font-display text-[10px] md:text-base uppercase tracking-tight">{frame.name}</span>
                    {selectedFrameId === frame.id && <Check className="w-3 h-3 md:w-4 md:h-4 text-ink" />}
                  </div>
                  {isProcessing && selectedFrameId === frame.id && (
                    <div className="absolute inset-0 bg-paper/60 flex items-center justify-center backdrop-blur-[1px]">
                      <Loader2 className="w-4 h-4 md:w-6 md:h-6 animate-spin text-ink" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-auto pt-4 md:pt-8 border-t-2 border-ink space-y-2 md:space-y-4 hidden lg:block">
              <div className="flex justify-between items-center font-mono text-[10px] uppercase tracking-widest opacity-40">
                <span>Print Quality</span>
                <span>300 DPI</span>
              </div>
              <div className="flex justify-between items-center font-mono text-[10px] uppercase tracking-widest opacity-40">
                <span>Paper Stock</span>
                <span>Matte Newsprint</span>
              </div>
            </div>
          </aside>

          {/* Center: Main Preview */}
          <section className="lg:col-span-10 p-4 md:p-12 bg-paper relative flex items-center justify-center overflow-hidden flex-grow min-h-[400px]">
            <div className="absolute inset-0 opacity-5 pointer-events-none news-grid"></div>

            <AnimatePresence mode="wait">
              <motion.div
                key={previewStep + (stepResults[previewStep] || 'loading')}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.05, y: -20 }}
                transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                className="relative w-full max-w-[min(90vw,400px)] lg:h-full aspect-[2/3] shadow-[10px_10px_0px_rgba(26,26,26,0.1)] md:shadow-[20px_20px_0px_rgba(26,26,26,0.1)] border-2 md:border-4 border-ink/5 overflow-hidden bg-white"
              >
                {stepResults[previewStep] ? (
                  <img
                    src={stepResults[previewStep]!}
                    alt={`Step ${previewStep + 1}`}
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-ink/5 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="w-8 h-8 md:w-12 md:h-12 animate-spin opacity-20" />
                    <span className="font-mono text-[8px] md:text-[10px] uppercase tracking-[0.3em] opacity-20">Processing Photo {previewStep + 1}...</span>
                  </div>
                )}

                {/* Decorative Elements */}
                <div className="absolute -top-6 -left-6 font-mono text-[10px] uppercase tracking-widest opacity-20 rotate-90 origin-bottom-left">
                  Proof No. {Math.floor(Math.random() * 10000)}
                </div>
                <div className="absolute -bottom-6 -right-6 font-mono text-[10px] uppercase tracking-widest opacity-20">
                  Daily Snap Archives © 1924
                </div>
              </motion.div>
            </AnimatePresence>

            {isProcessing && (
              <div className="absolute inset-0 bg-paper/20 backdrop-blur-[1px] z-10 pointer-events-none" />
            )}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col selection:bg-press-red selection:text-white">
      <div className="flex-grow flex flex-col p-4 md:p-8 max-w-7xl mx-auto w-full">
        {/* Masthead */}
        <header className="border-b-4 border-ink pb-4 mb-6 md:mb-8 text-center relative">
          <div className="flex justify-between items-center absolute top-0 left-0 right-0 px-2 pt-1">
            <span className="font-mono text-[8px] md:text-[10px] uppercase tracking-widest opacity-60">Vol. LXIV ... No. 24,026</span>
            <span className="font-mono text-[8px] md:text-[10px] uppercase tracking-widest opacity-60 hidden sm:inline">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>

          <h1 className="font-display text-4xl md:text-8xl tracking-tighter uppercase mt-6 md:mt-4">
            The Daily Snap
          </h1>
          <div className="mt-2 flex justify-center gap-4 md:gap-8">
            <span className="font-serif italic text-[10px] md:text-sm opacity-80">"All the news that's fit to print"</span>
            <span className="font-serif italic text-[10px] md:text-sm opacity-80">Est. 1924</span>
          </div>

          <button
            onClick={() => setView('landing')}
            className="absolute left-0 bottom-2 md:bottom-6 p-1.5 md:p-2 border border-ink hover:bg-ink hover:text-paper transition-colors flex items-center gap-2"
            title="Back to Landing"
          >
            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
            <span className="font-mono text-[10px] uppercase tracking-widest hidden md:inline">Back</span>
          </button>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 flex-grow">
          {/* Left Column: Controls & Viewfinder */}
          <div className="lg:col-span-8 flex flex-col gap-6">

            {/* Editorial Controls */}
            <section className="grid grid-cols-2 gap-3 md:gap-4 border-b border-ink pb-6">
              <div className="space-y-1 md:space-y-2">
                <label className="font-mono text-[8px] md:text-[10px] uppercase tracking-widest opacity-60">Layout</label>
                <div className="relative">
                  <select
                    value={currentLayout}
                    onChange={(e) => setCurrentLayout(e.target.value)}
                    className="w-full py-1.5 md:py-2 pl-2 md:pl-3 pr-8 md:pr-10 border border-ink text-[10px] md:text-xs font-mono uppercase bg-paper focus:outline-none focus:ring-1 focus:ring-ink appearance-none cursor-pointer hover:bg-ink/5 transition-colors"
                  >
                    {LAYOUTS.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 w-3 h-3 md:w-4 md:h-4 pointer-events-none opacity-60" />
                </div>
              </div>

              <div className="space-y-1 md:space-y-2">
                <label className="font-mono text-[8px] md:text-[10px] uppercase tracking-widest opacity-60">Delay</label>
                <div className="relative">
                  <select
                    value={currentTimer}
                    onChange={(e) => setCurrentTimer(Number(e.target.value))}
                    className="w-full py-1.5 md:py-2 pl-2 md:pl-3 pr-8 md:pr-10 border border-ink text-[10px] md:text-xs font-mono uppercase bg-paper focus:outline-none focus:ring-1 focus:ring-ink appearance-none cursor-pointer hover:bg-ink/5 transition-colors"
                  >
                    {TIMERS.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 w-3 h-3 md:w-4 md:h-4 pointer-events-none opacity-60" />
                </div>
              </div>
            </section>

            {/* Viewfinder Area - Stable Container */}
            <section className="relative w-full aspect-[9/16] md:aspect-video bg-zinc-950 border-2 md:border-4 border-ink shadow-[4px_4px_0px_rgba(26,26,26,0.1)] md:shadow-[8px_8px_0px_rgba(26,26,26,0.1)] overflow-hidden group mx-auto">
              {/* Darkroom Backdrop */}
              <div className="absolute inset-0 opacity-20 pointer-events-none news-grid"></div>

              {/* Dynamic Camera Frame */}
              <div className="absolute inset-0 flex items-center justify-center p-2 md:p-4">
                {!isFullScreenCamera && isCameraOn && (
                  <div className={cn(
                    "relative transition-all duration-700 ease-in-out shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden border-2 border-paper/20",
                    "w-full h-full",
                    "md:max-w-full",
                    "md:" + (LAYOUTS.find(l => l.id === currentLayout)?.aspect || 'aspect-video')
                  )}>
                    <Webcam
                      audio={false}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      className="w-full h-full object-cover md:object-contain"
                      videoConstraints={{ facingMode }}
                      disablePictureInPicture={false}
                      forceScreenshotSourceSize={false}
                      imageSmoothing={true}
                      mirrored={facingMode === 'user'}
                      onUserMedia={() => { }}
                      onUserMediaError={() => { }}
                      onScreenshot={() => { }}
                      screenshotQuality={0.92}
                    />

                    {/* Zoom Button for Mobile */}
                    <button
                      onClick={() => setIsFullScreenCamera(true)}
                      className="md:hidden absolute bottom-4 right-4 p-3 bg-black/40 border border-white/20 text-paper backdrop-blur-md rounded-full pointer-events-auto"
                    >
                      <Maximize2 className="w-5 h-5" />
                    </button>

                    {/* Frame Corner Marks */}
                    <div className="absolute top-2 left-2 w-3 h-3 md:w-4 md:h-4 border-t-2 border-l-2 border-white/40"></div>
                    <div className="absolute top-2 right-2 w-3 h-3 md:w-4 md:h-4 border-t-2 border-r-2 border-white/40"></div>
                    <div className="absolute bottom-2 left-2 w-3 h-3 md:w-4 md:h-4 border-b-2 border-l-2 border-white/40"></div>
                    <div className="absolute bottom-2 right-2 w-3 h-3 md:w-4 md:h-4 border-b-2 border-r-2 border-white/40"></div>
                  </div>
                )}

                {!isCameraOn && (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-paper/20 bg-zinc-900">
                    <PowerOff className="w-8 h-8 md:w-12 md:h-12" />
                    <span className="font-mono text-[8px] md:text-[10px] uppercase tracking-[0.2em]">No Signal</span>
                  </div>
                )}
              </div>

              {/* Viewfinder Overlays - Pinned to the stable container edges */}
              <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 md:p-6 font-mono">
                <div className="flex justify-between items-start">
                  <div className={cn(
                    "flex items-center gap-2 md:gap-3 px-2 md:px-3 py-1 md:py-1.5 text-[8px] md:text-[10px] font-bold uppercase tracking-widest transition-all duration-300",
                    isCameraOn ? "bg-ink text-paper" : "bg-press-red text-white"
                  )}>
                    <div className={cn("w-1.5 h-1.5 md:w-2 md:h-2 rounded-full", isCameraOn ? "bg-press-red animate-pulse" : "bg-white")} />
                    {isCameraOn ? "Live" : "Standby"}
                  </div>
                </div>

                {countdown !== null && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={countdown}
                        initial={{ scale: 2, opacity: 0, rotate: -10 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        exit={{ scale: 0.5, opacity: 0, rotate: 10 }}
                        className="text-7xl md:text-9xl font-display text-white drop-shadow-[0_0_30px_rgba(0,0,0,0.8)] italic"
                      >
                        {countdown}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                )}

                <div className="flex justify-between items-end">
                  <div className="flex gap-2 md:gap-3 pointer-events-auto">
                    <button
                      onClick={() => setIsCameraOn(!isCameraOn)}
                      className={cn(
                        "p-1.5 md:p-2.5 border transition-all duration-300 backdrop-blur-md",
                        !isCameraOn
                          ? "bg-press-red border-press-red text-white shadow-[0_0_15px_rgba(196,30,58,0.5)]"
                          : "bg-black/40 border-white/20 text-paper hover:bg-white/10"
                      )}
                      title={isCameraOn ? "Power Down" : "Power Up"}
                    >
                      {isCameraOn ? <Power className="w-4 h-4 md:w-5 md:h-5" /> : <PowerOff className="w-4 h-4 md:w-5 md:h-5" />}
                    </button>
                    <button
                      onClick={toggleCamera}
                      className="md:hidden p-1.5 bg-black/40 border border-white/20 text-paper hover:bg-white/10 backdrop-blur-md transition-all"
                      title="Flip Camera"
                    >
                      <SwitchCamera className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Action Buttons */}
            <section className="flex flex-wrap items-center justify-center gap-4 md:gap-6 py-4 border-y border-ink">
              <div className="flex flex-col items-center gap-1 md:gap-2">
                <button
                  onClick={handleCaptureClick}
                  className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-ink flex items-center justify-center hover:bg-ink hover:text-paper transition-all group"
                >
                  <Camera className="w-8 h-8 md:w-10 md:h-10 group-active:scale-90 transition-transform" />
                </button>
                <span className="font-mono text-[8px] md:text-[10px] uppercase tracking-widest">Manual</span>
              </div>

              <div className="flex flex-col items-center gap-1 md:gap-2">
                <button
                  onClick={handleAutoClick}
                  className={cn(
                    "w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-ink flex flex-col items-center justify-center transition-all group",
                    isAuto ? "bg-press-red text-white border-press-red animate-pulse" : "hover:bg-ink hover:text-paper"
                  )}
                >
                  <span className="font-display text-lg md:text-xl leading-none">{isAutoRunning ? 'STOP' : 'AUTO'}</span>
                  <span className="font-mono text-[6px] md:text-[8px] uppercase tracking-tighter">Sequence</span>
                </button>
                <span className="font-mono text-[8px] md:text-[10px] uppercase tracking-widest">Automatic</span>
              </div>

              <div className="flex flex-col items-center gap-1 md:gap-2">
                <button
                  onClick={resetPhotos}
                  className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-ink flex items-center justify-center hover:bg-ink hover:text-paper transition-all group"
                >
                  <RefreshCw className="w-8 h-8 md:w-10 md:h-10 group-active:rotate-180 transition-transform duration-500" />
                </button>
                <span className="font-mono text-[8px] md:text-[10px] uppercase tracking-widest">Retake</span>
              </div>

              <div className="flex flex-col items-center gap-1 md:gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-ink flex items-center justify-center hover:bg-ink hover:text-paper transition-all group"
                >
                  <Upload className="w-8 h-8 md:w-10 md:h-10 group-active:scale-90 transition-transform" />
                </button>
                <span className="font-mono text-[8px] md:text-[10px] uppercase tracking-widest">Upload</span>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileUpload}
                />
              </div>
            </section>

            {/* Filters */}
            <section className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <h3 className="font-display text-xl uppercase italic">Darkroom Filters</h3>
                  <div className="flex-grow h-px bg-ink/20" />
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {FILTERS.map(f => (
                    <button
                      key={f.id}
                      onClick={() => setCurrentFilter(f.id)}
                      className={cn(
                        "py-2 px-1 border border-ink text-[10px] font-mono uppercase transition-all",
                        currentFilter === f.id ? "bg-ink text-paper shadow-[4px_4px_0px_rgba(26,26,26,0.2)]" : "hover:bg-ink/5"
                      )}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Latest Captures (Classifieds) - Moved here with horizontal scroll */}
              <div className="space-y-3 pt-4 border-t border-ink/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h3 className="font-display text-xl uppercase italic">Latest Captures</h3>
                    <div className="flex-grow h-px bg-ink/20 w-32" />
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-widest opacity-60">
                    {capturedPhotos.filter(p => p !== null).length} / 10 Collected
                  </div>
                </div>

                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
                  {capturedPhotos.map((photo, i) => (
                    <div key={i} className="flex-shrink-0 w-40 snap-start space-y-2">
                      <div className="group relative aspect-[2/3] bg-ink/5 border border-ink overflow-hidden halftone transition-all duration-500">
                        <div className={cn(
                          "w-full h-full flex items-center justify-center transition-all duration-500",
                          photo ? "" : "opacity-30 group-hover:opacity-50"
                        )}>
                          {photo ? (
                            <div className={cn(
                              "h-full transition-all duration-500",
                              LAYOUTS.find(l => l.id === currentLayout)?.aspect || 'aspect-[2/3]'
                            )}>
                              <img src={photo} alt={`Capture ${i + 1}`} className={cn("w-full h-full object-contain", FILTERS.find(f => f.id === currentFilter)?.class)} referrerPolicy="no-referrer" />
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-2">
                              <ImageIcon className="w-8 h-8" />
                              <span className="font-mono text-[10px] uppercase tracking-widest">Slot {i + 1}</span>
                            </div>
                          )}
                        </div>

                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-ink text-paper font-mono text-[8px] uppercase flex justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                          <span>Photo No. {String(i + 1).padStart(2, '0')}</span>
                          <button className="hover:text-press-red transition-colors">
                            <Upload className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Edition Controls */}
          <div className="lg:col-span-4 lg:border-l-2 border-ink lg:pl-8 flex flex-col">
            <div className="border-b-2 border-ink pb-2 mb-6 hidden lg:block">
              <h2 className="font-display text-3xl uppercase text-center">Classifieds</h2>
              <p className="font-mono text-[10px] uppercase tracking-widest text-center opacity-60">Edition Settings</p>
            </div>

            <div className="flex-grow flex flex-col gap-6">
              <div className="space-y-4">
                <div className="border-t-2 lg:border-t-0 border-ink pt-4 lg:pt-0">
                  <div className="flex justify-between items-end mb-2">
                    <span className="font-mono text-[8px] md:text-[10px] uppercase tracking-widest">Edition Progress</span>
                    <span className="font-display text-xl md:text-2xl">{capturedPhotos.filter(p => p !== null).length} / 10</span>
                  </div>
                  <div className="flex gap-0.5 h-2 md:h-3">
                    {Array.from({ length: 10 }).map((_, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "flex-1 border border-ink transition-colors duration-300",
                          capturedPhotos[idx] ? "bg-ink" : "bg-transparent"
                        )}
                      />
                    ))}
                  </div>
                  <p className="font-mono text-[8px] uppercase tracking-tighter mt-2 opacity-60">
                    {capturedPhotos.filter(p => p !== null).length < printQuantity ? `Capture at least ${printQuantity} photos to begin` : "Ready for final print"}
                  </p>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <button
                    onClick={() => setView('selection')}
                    disabled={capturedPhotos.filter(p => p !== null).length < printQuantity}
                    className="w-full py-3 md:py-4 bg-ink text-paper font-display text-xl md:text-2xl uppercase tracking-tighter hover:bg-press-red disabled:opacity-50 disabled:hover:bg-ink transition-colors flex items-center justify-center gap-3 relative overflow-hidden shadow-[4px_4px_0px_rgba(0,0,0,0.2)] md:shadow-[8px_8px_0px_rgba(0,0,0,0.2)]"
                  >
                    <ImageIcon className="w-5 h-5 md:w-6 md:h-6" />
                    Select Photos
                  </button>
                </div>

                <p className="font-serif italic text-[10px] text-center opacity-60">
                  * High-quality newsprint finish applied upon export.
                </p>
              </div>
            </div>
          </div>
        </main>

        <footer className="mt-12 pt-8 border-t-4 border-ink grid grid-cols-1 md:grid-cols-3 gap-8 pb-8">
          <div className="space-y-2">
            <h4 className="font-display text-lg uppercase">The Editor's Note</h4>
            <p className="font-serif text-xs leading-relaxed opacity-80">
              Our mission is to capture the fleeting moments of today for the archives of tomorrow. Each snap is a story, each frame a headline.
            </p>
          </div>
          <div className="flex flex-col items-center justify-center border-x border-ink/20 px-4">
            <div className="w-16 h-16 border-2 border-ink rounded-full flex items-center justify-center mb-2">
              <span className="font-display text-2xl">10¢</span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest">Price per copy</span>
          </div>
          <div className="flex flex-col items-end justify-center">
            <span className="font-mono text-[10px] uppercase tracking-widest opacity-60">© 1924-2024 The Daily Snap Publishing Co.</span>
          </div>
        </footer>

        {/* Full Screen Camera Overlay for Mobile */}
        <AnimatePresence>
          {isFullScreenCamera && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-[100] bg-black flex flex-col"
            >
              <div className="flex-grow relative overflow-hidden">
                <div className={cn(
                  "w-full h-full transition-all duration-500",
                  FILTERS.find(f => f.id === currentFilter)?.class
                )}>
                  {isCameraOn && isFullScreenCamera && (
                    <Webcam
                      audio={false}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      className="w-full h-full object-cover"
                      videoConstraints={{ facingMode }}
                      disablePictureInPicture={false}
                      forceScreenshotSourceSize={false}
                      imageSmoothing={true}
                      mirrored={facingMode === 'user'}
                      onUserMedia={() => { }}
                      onUserMediaError={() => { }}
                      onScreenshot={() => { }}
                      screenshotQuality={0.92}
                    />
                  )}
                  {!isCameraOn && (
                    <div className="w-full h-full flex items-center justify-center text-white/20">
                      <PowerOff className="w-16 h-16" />
                    </div>
                  )}
                </div>

                {countdown !== null && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-9xl font-display text-white italic drop-shadow-2xl">{countdown}</span>
                  </div>
                )}
              </div>

              <div className="h-32 bg-black flex items-center justify-around px-8">
                <button
                  onClick={() => setIsFullScreenCamera(false)}
                  className="flex flex-col items-center gap-1 text-white/60 hover:text-white"
                >
                  <ChevronLeft className="w-8 h-8" />
                  <span className="font-mono text-[10px] uppercase tracking-widest">Back</span>
                </button>

                <button
                  onClick={handleCaptureClick}
                  disabled={isAutoRunning}
                  className={cn(
                    "w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-all active:scale-95",
                    isCapturing ? "bg-white scale-90" : "bg-white/10 hover:bg-white/20"
                  )}
                >
                  <div className={cn(
                    "w-16 h-16 rounded-full transition-all",
                    isCapturing ? "bg-ink scale-75" : "bg-white"
                  )} />
                </button>

                <button
                  onClick={toggleCamera}
                  className="flex flex-col items-center gap-1 text-white/60 hover:text-white"
                >
                  <SwitchCamera className="w-8 h-8" />
                  <span className="font-mono text-[10px] uppercase tracking-widest">Flip</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
