import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';

export interface AipetrosLandingProps {
  onEnterCinema: () => void;
  onNavigateTab?: (tab: string) => void;
}

interface DeviceOption {
  id: string;
  name: string;
  sub: string;
  badge: string;
  badgeBtn: string;
  size: string;
  downloadUrl: string;
  actionType: 'pwa' | 'apk' | 'tv' | 'exe';
}

const DEVICES: DeviceOption[] = [
  {
    id: 'ios',
    name: 'iPhone & iPad',
    sub: 'Spatial PWA',
    badge: 'Spatial PWA',
    badgeBtn: '↓ Install PWA',
    size: '12.9 MB • v2.4.0',
    downloadUrl: '#pwa',
    actionType: 'pwa',
  },
  {
    id: 'android',
    name: 'Android Mobile',
    sub: 'Native 4K APK',
    badge: 'Native 4K APK',
    badgeBtn: '↓ Direct APK',
    size: '18.4 MB • v2.4.0',
    downloadUrl: 'https://github.com/aipetrosapp-max/Petros-cinama/releases/latest/download/Aipetros-Cinema.apk',
    actionType: 'apk',
  },
  {
    id: 'android-tv',
    name: 'Android TV',
    sub: 'Dolby Atmos',
    badge: 'Dolby Atmos',
    badgeBtn: '↓ TV Client',
    size: '22.1 MB • v2.4.0',
    downloadUrl: 'https://github.com/aipetrosapp-max/Petros-cinama/releases/latest/download/Aipetros-AndroidTV.apk',
    actionType: 'tv',
  },
  {
    id: 'windows',
    name: 'Windows 11',
    sub: 'GPU Desktop',
    badge: 'GPU Desktop',
    badgeBtn: '↓ .EXE Setup',
    size: '64.5 MB • v2.4.0',
    downloadUrl: 'https://github.com/aipetrosapp-max/Petros-cinama/releases/latest/download/Aipetros-Cinema-Setup.exe',
    actionType: 'exe',
  },
];

export const AipetrosLandingScreen: React.FC<AipetrosLandingProps> = ({
  onEnterCinema,
  onNavigateTab,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<DeviceOption>(DEVICES[0]);
  const [downloadStatus, setDownloadStatus] = useState<string>('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Capture PWA install prompt if available
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // THREE.JS REAL-TIME 3D CINEMA ARCHITECTURAL BACKGROUND
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrameId: number;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x040406, 0.035);

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.5, 9);

    // 1. 3D Curved Golden Cinema Arches (Extending into depth)
    const archGroup = new THREE.Group();
    const archMaterial = new THREE.MeshBasicMaterial({
      color: 0xd4af37,
      wireframe: true,
      transparent: true,
      opacity: 0.16,
    });

    for (let i = 0; i < 8; i++) {
      const torusGeo = new THREE.TorusGeometry(6.2, 0.03, 12, 64, Math.PI);
      const arch = new THREE.Mesh(torusGeo, archMaterial);
      arch.position.z = -i * 3.2;
      arch.position.y = -1.2;
      archGroup.add(arch);
    }
    scene.add(archGroup);

    // 2. 3D Reflective Neural Floor Grid
    const gridHelper = new THREE.GridHelper(40, 40, 0xd4af37, 0x3a2e14);
    gridHelper.position.y = -2.4;
    if (gridHelper.material instanceof THREE.Material) {
      gridHelper.material.transparent = true;
      gridHelper.material.opacity = 0.25;
    }
    scene.add(gridHelper);

    // 3. Floating Volumetric Gold Dust Motes
    const particleCount = 420;
    const posArray = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      posArray[i] = (Math.random() - 0.5) * 18;
      posArray[i + 1] = (Math.random() - 0.5) * 18;
      posArray[i + 2] = (Math.random() - 0.5) * 24;
    }
    const particlesGeo = new THREE.BufferGeometry();
    particlesGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(posArray, 3)
    );
    const particlesMat = new THREE.PointsMaterial({
      size: 0.055,
      color: 0xfce79c,
      transparent: true,
      opacity: 0.65,
    });
    const particleMesh = new THREE.Points(particlesGeo, particlesMat);
    scene.add(particleMesh);

    // Interactive Mouse / Gyroscope Parallax + Scroll Depth
    let targetX = 0;
    let targetY = 0;
    let scrollZ = 0;

    const handlePointerMove = (e: PointerEvent) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 1.4;
      targetY = -(e.clientY / window.innerHeight - 0.5) * 1.0;
    };

    const handleScroll = () => {
      scrollZ = window.scrollY * 0.008;
    };

    const handleResize = () => {
      if (!canvas) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);

    const clock = new THREE.Clock();
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth camera parallax & forward cinema hall motion
      camera.position.x += (targetX - camera.position.x) * 0.05;
      camera.position.y += (1.5 + targetY - camera.position.y) * 0.05;
      camera.position.z = 9 - (scrollZ % 6);

      // Gently rotate particles and pulse arches
      particleMesh.rotation.y = elapsedTime * 0.04;
      particleMesh.position.y = Math.sin(elapsedTime * 0.3) * 0.3;
      gridHelper.position.z = (elapsedTime * 0.8) % 1;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      archMaterial.dispose();
      particlesMat.dispose();
      particlesGeo.dispose();
    };
  }, []);

  const handleTriggerDownload = () => {
    setDownloadStatus('INITIALIZING STREAM...');

    if (selectedDevice.actionType === 'pwa') {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(() => {
          setDeferredPrompt(null);
        });
      } else {
        // Fallback: notify how to add to home screen or launch spatial cinema
        onEnterCinema();
      }
    } else {
      // Trigger direct download
      const link = document.createElement('a');
      link.href = selectedDevice.downloadUrl;
      link.download = '';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    setTimeout(() => {
      setDownloadStatus('');
    }, 2000);
  };

  const handleTabClick = (tabKey: string) => {
    if (tabKey === 'universe') {
      onEnterCinema();
    } else if (onNavigateTab) {
      onNavigateTab(tabKey);
    } else {
      window.location.hash = tabKey;
      onEnterCinema();
    }
  };

  return (
    <div className="relative min-h-screen bg-[#030305] text-[#F4F0EA] overflow-x-hidden font-sans select-none">
      {/* SCOPED COMPONENT STYLES MATCHING THE EXACT CINEMATIC DESIGN */}
      <style>{`
        /* Volumetric Light Beam behind Top 3D Projector */
        .projector-beam {
          position: absolute;
          top: -30px;
          left: 50%;
          transform: translateX(-50%) perspective(500px) rotateX(-25deg);
          width: 340px;
          height: 260px;
          background: radial-gradient(ellipse at 35% 30%, rgba(252, 231, 156, 0.55) 0%, rgba(212, 175, 55, 0.22) 38%, rgba(4, 4, 6, 0) 75%);
          filter: blur(18px);
          pointer-events: none;
          z-index: 1;
          animation: pulseBeam 4s ease-in-out infinite alternate;
        }

        @keyframes pulseBeam {
          0% { opacity: 0.75; transform: translateX(-50%) scale(0.96); }
          100% { opacity: 1; transform: translateX(-50%) scale(1.06); }
        }

        /* 3D Floating Projector Rig Animation */
        .projector-3d-rig {
          transform-style: preserve-3d;
          animation: floatProjector 6s ease-in-out infinite;
          filter: drop-shadow(0 22px 35px rgba(0, 0, 0, 0.9)) drop-shadow(0 0 25px rgba(212, 175, 55, 0.35));
        }

        @keyframes floatProjector {
          0%, 100% { transform: translateY(0px) rotateY(-8deg) rotateX(6deg); }
          50% { transform: translateY(-8px) rotateY(8deg) rotateX(2deg); }
        }

        /* Metallic Gold Text Gradient */
        .gold-gradient-text {
          background: linear-gradient(180deg, #FFF6D6 0%, #E5C158 52%, #9B7420 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 10px 30px rgba(212, 175, 55, 0.25);
        }

        /* Spatial 3D Glass Containers */
        .spatial-section-frame {
          background: linear-gradient(165deg, rgba(22, 19, 15, 0.72) 0%, rgba(8, 8, 12, 0.82) 100%);
          backdrop-filter: blur(22px) saturate(160%);
          -webkit-backdrop-filter: blur(22px) saturate(160%);
          border: 1px solid rgba(212, 175, 55, 0.28);
          box-shadow: 
            0 25px 60px -15px rgba(0, 0, 0, 0.95),
            inset 0 1px 1px rgba(255, 238, 186, 0.25),
            0 0 40px -10px rgba(212, 175, 55, 0.14);
          transform-style: preserve-3d;
        }

        /* 3D Device Cards */
        .device-card-3d {
          background: linear-gradient(180deg, rgba(38, 33, 26, 0.78) 0%, rgba(12, 11, 14, 0.92) 100%);
          border: 1px solid rgba(212, 175, 55, 0.32);
          box-shadow: 
            0 14px 28px rgba(0, 0, 0, 0.85),
            inset 0 1px 0 rgba(255, 240, 190, 0.3);
          transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.35s ease, box-shadow 0.35s ease;
          transform-style: preserve-3d;
        }
        .device-card-3d:hover, .device-card-3d.active-device {
          transform: translateY(-6px) scale(1.02) rotateX(4deg);
          border-color: rgba(252, 231, 156, 0.85);
          box-shadow: 
            0 20px 38px rgba(0, 0, 0, 0.95),
            0 0 25px rgba(212, 175, 55, 0.32),
            inset 0 1px 1px rgba(255, 245, 200, 0.5);
        }

        /* Hexagonal 3D Feature Nodes */
        .hex-badge {
          clip-path: polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%);
          background: linear-gradient(135deg, rgba(212, 175, 55, 0.38) 0%, rgba(30, 24, 14, 0.95) 100%);
          box-shadow: inset 0 0 12px rgba(252, 231, 156, 0.45);
        }

        /* Hero Gold Launch Pill Button */
        .gold-cta-btn {
          background: linear-gradient(180deg, #FFF3B8 0%, #E7BE53 48%, #B3831E 100%);
          color: #090806;
          box-shadow: 
            0 0 35px rgba(231, 190, 83, 0.55),
            0 10px 25px rgba(0, 0, 0, 0.9),
            inset 0 2px 2px rgba(255, 255, 255, 0.75);
          transition: all 0.25s ease;
        }
        .gold-cta-btn:hover {
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 0 50px rgba(252, 231, 156, 0.8), 0 14px 28px rgba(0, 0, 0, 0.95);
        }
        .gold-cta-btn:active {
          transform: translateY(1px) scale(0.99);
        }

        /* Section Header Capsule */
        .section-pill {
          background: linear-gradient(180deg, rgba(32, 28, 22, 0.95) 0%, rgba(14, 12, 10, 0.98) 100%);
          border: 1px solid rgba(212, 175, 55, 0.42);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 235, 175, 0.25);
        }
      `}</style>

      {/* LIVE 3D WEBGL CINEMA ENVIRONMENT BACKGROUND */}
      <canvas
        ref={canvasRef}
        id="cinema-3d-canvas"
        className="fixed inset-0 w-screen h-screen z-0 pointer-events-none"
      />

      {/* MAIN RESPONSIVE CONTAINER (Mobile-First, Scales to Tablet/Desktop) */}
      <main className="relative z-10 w-full max-w-[460px] md:max-w-[780px] lg:max-w-[980px] mx-auto px-3.5 pt-3 pb-28 flex flex-col items-center">
        {/* 1. TOP 3D HOLOGRAPHIC IMAX PROJECTOR & VOLUMETRIC LIGHT */}
        <section className="relative w-full flex flex-col items-center pt-2 pb-3">
          <div className="projector-beam" />

          {/* 3D Sculpted Cinema Projector SVG */}
          <div className="projector-3d-rig relative z-10 w-44 h-28 md:w-56 md:h-36 flex items-center justify-center">
            {/* Glowing Lens Flare */}
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-amber-300/60 blur-xl animate-pulse" />
            <div className="absolute -left-16 top-1/2 -translate-y-1/2 w-36 h-20 bg-gradient-to-l from-amber-200/45 via-amber-500/15 to-transparent -rotate-6 blur-md pointer-events-none" />

            {/* Detailed 3D Isometric Projector Illustration */}
            <svg viewBox="0 0 260 165" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="obsidianBody" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3A352D" />
                  <stop offset="45%" stopColor="#17161A" />
                  <stop offset="100%" stopColor="#070709" />
                </linearGradient>
                <linearGradient id="goldRim" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFF2BE" />
                  <stop offset="50%" stopColor="#D4AF37" />
                  <stop offset="100%" stopColor="#6E5011" />
                </linearGradient>
                <radialGradient id="lensGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="35%" stopColor="#FFE484" />
                  <stop offset="75%" stopColor="#D4AF37" />
                  <stop offset="100%" stopColor="#141109" />
                </radialGradient>
              </defs>

              {/* Base Pedestal */}
              <ellipse
                cx="135"
                cy="142"
                rx="52"
                ry="12"
                fill="url(#obsidianBody)"
                stroke="url(#goldRim)"
                strokeWidth="1.5"
              />
              <path
                d="M105 125 L165 125 L175 140 L95 140 Z"
                fill="url(#obsidianBody)"
                stroke="url(#goldRim)"
                strokeWidth="1.2"
              />

              {/* Main 3D Projector Chassis */}
              <rect
                x="68"
                y="34"
                width="132"
                height="86"
                rx="14"
                fill="url(#obsidianBody)"
                stroke="url(#goldRim)"
                strokeWidth="2"
              />
              {/* Side Mechanical Reel / Turbine */}
              <circle
                cx="172"
                cy="76"
                r="28"
                fill="#0B0B0E"
                stroke="url(#goldRim)"
                strokeWidth="2"
              />
              <circle
                cx="172"
                cy="76"
                r="18"
                fill="none"
                stroke="#D4AF37"
                strokeDasharray="6 4"
                strokeWidth="1.5"
              />
              <circle cx="172" cy="76" r="6" fill="url(#goldRim)" />

              {/* Cooling Vents */}
              <g stroke="#D4AF37" strokeWidth="1.2" opacity="0.55">
                <line x1="115" y1="48" x2="135" y2="48" />
                <line x1="115" y1="54" x2="135" y2="54" />
                <line x1="115" y1="60" x2="135" y2="60" />
              </g>

              {/* Primary Optical Barrel & Glowing IMAX Lens */}
              <ellipse
                cx="72"
                cy="76"
                rx="26"
                ry="32"
                fill="url(#obsidianBody)"
                stroke="url(#goldRim)"
                strokeWidth="2.5"
              />
              <ellipse
                cx="56"
                cy="76"
                rx="22"
                ry="27"
                fill="#0E0D12"
                stroke="url(#goldRim)"
                strokeWidth="2.5"
              />
              <ellipse cx="52" cy="76" rx="16" ry="21" fill="url(#lensGlow)" />

              {/* IMAX Badge */}
              <rect
                x="115"
                y="102"
                width="36"
                height="11"
                rx="3"
                fill="#09090C"
                stroke="url(#goldRim)"
                strokeWidth="0.9"
              />
              <text
                x="133"
                y="110"
                fill="#FCE79C"
                fontSize="6.5"
                fontWeight="700"
                textAnchor="middle"
                letterSpacing="1.2"
              >
                IMAX 4K
              </text>
            </svg>
          </div>

          {/* Main Editorial Headlines */}
          <h1 className="font-serif text-center font-extrabold tracking-wider leading-[1.12] text-[24px] sm:text-[30px] md:text-[38px] gold-gradient-text mt-1">
            NEXT-GEN NEURAL
            <br />
            CINEMA ARCHITECTURE
          </h1>
          <p className="text-center text-zinc-300/90 text-[11.5px] sm:text-[13.5px] md:text-[15px] max-w-[360px] md:max-w-[540px] leading-snug mt-2 font-medium">
            AI-Driven 4K HDR Mastering, Real-Time Neural Subtitle
            <br className="hidden sm:inline" />
            Synthesis &amp; Spatial Acoustics Across Every Screen
          </p>
        </section>

        {/* 2. CHOOSE YOUR SPATIAL DEVICE (4-COLUMN INTERACTIVE 3D GRID) */}
        <section className="relative w-full mt-4">
          {/* Floating Header Pill */}
          <div className="relative z-20 flex justify-center -mb-3.5">
            <div className="section-pill px-5 py-1.5 rounded-full">
              <span className="text-[10.5px] sm:text-xs font-bold tracking-[0.16em] text-amber-200/95 uppercase">
                CHOOSE YOUR SPATIAL DEVICE
              </span>
            </div>
          </div>

          {/* Spatial Frame Container */}
          <div className="spatial-section-frame rounded-[26px] pt-6 pb-4 px-2.5 sm:px-4">
            <div className="grid grid-cols-4 gap-2 sm:gap-3.5">
              {/* Card 1: iPhone & iPad */}
              <div
                onClick={() => setSelectedDevice(DEVICES[0])}
                className={`device-card-3d cursor-pointer rounded-[18px] p-2 sm:p-3 flex flex-col items-center text-center justify-between ${
                  selectedDevice.id === 'ios' ? 'active-device ring-1 ring-amber-300/70' : ''
                }`}
              >
                <div className="w-full h-20 sm:h-28 rounded-xl bg-gradient-to-b from-amber-500/15 via-black/60 to-black/90 border border-amber-400/25 flex items-center justify-center relative overflow-hidden p-1.5">
                  <div className="w-9 h-16 sm:w-12 sm:h-22 rounded-[10px] border-2 border-amber-300/70 bg-gradient-to-br from-amber-300 via-orange-500/80 to-purple-900 shadow-[0_0_18px_rgba(251,191,36,0.45)] flex items-center justify-center">
                    <div className="w-3.5 h-3.5 rounded-full bg-white/80 blur-[1px]" />
                  </div>
                </div>
                <div className="mt-2 w-full">
                  <h3 className="text-[10px] sm:text-xs font-bold text-white leading-tight truncate">
                    iPhone &amp; iPad
                  </h3>
                  <p className="text-[8.5px] sm:text-[10px] text-amber-200/80 font-medium mt-0.5 truncate">
                    Spatial PWA
                  </p>
                </div>
                <div className="w-full mt-2 pt-1.5 border-t border-amber-500/20 flex flex-col items-center gap-1">
                  <span className="inline-flex items-center gap-0.5 text-[8px] sm:text-[9.5px] font-semibold text-amber-300 bg-amber-500/15 border border-amber-400/30 rounded-full px-2 py-0.5">
                    ↓ Install PWA
                  </span>
                  <span className="text-[7.5px] sm:text-[9px] text-zinc-400 font-mono">
                    12.9 MB • v2.4.0
                  </span>
                </div>
              </div>

              {/* Card 2: Android Mobile */}
              <div
                onClick={() => setSelectedDevice(DEVICES[1])}
                className={`device-card-3d cursor-pointer rounded-[18px] p-2 sm:p-3 flex flex-col items-center text-center justify-between ${
                  selectedDevice.id === 'android' ? 'active-device ring-1 ring-amber-300/70' : ''
                }`}
              >
                <div className="w-full h-20 sm:h-28 rounded-xl bg-gradient-to-b from-zinc-800/60 to-black/90 border border-amber-500/20 flex items-center justify-center relative overflow-hidden p-1.5">
                  <div className="w-9 h-16 sm:w-12 sm:h-22 rounded-[9px] border border-amber-400/40 bg-zinc-900 flex flex-col items-center justify-between py-1.5 shadow-inner">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400/70" />
                    <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-400/60 flex items-center justify-center text-[9px] text-amber-300">
                      ↓
                    </div>
                    <div className="w-4 h-0.5 bg-zinc-600 rounded" />
                  </div>
                </div>
                <div className="mt-2 w-full">
                  <h3 className="text-[10px] sm:text-xs font-bold text-white leading-tight truncate">
                    Android Mobile
                  </h3>
                  <p className="text-[8.5px] sm:text-[10px] text-amber-200/80 font-medium mt-0.5 truncate">
                    Native 4K APK
                  </p>
                </div>
                <div className="w-full mt-2 pt-1.5 border-t border-amber-500/20 flex flex-col items-center gap-1">
                  <span className="inline-flex items-center gap-0.5 text-[8px] sm:text-[9.5px] font-semibold text-amber-300 bg-amber-500/15 border border-amber-400/30 rounded-full px-2 py-0.5">
                    ↓ Direct APK
                  </span>
                  <span className="text-[7.5px] sm:text-[9px] text-zinc-400 font-mono">
                    18.4 MB • v2.4.0
                  </span>
                </div>
              </div>

              {/* Card 3: Android TV */}
              <div
                onClick={() => setSelectedDevice(DEVICES[2])}
                className={`device-card-3d cursor-pointer rounded-[18px] p-2 sm:p-3 flex flex-col items-center text-center justify-between ${
                  selectedDevice.id === 'android-tv' ? 'active-device ring-1 ring-amber-300/70' : ''
                }`}
              >
                <div className="w-full h-20 sm:h-28 rounded-xl bg-gradient-to-b from-amber-500/10 to-black/90 border border-amber-500/25 flex items-center justify-center relative overflow-hidden p-1.5">
                  <div className="w-16 h-11 sm:w-22 sm:h-14 rounded-md border border-amber-300/60 bg-gradient-to-tr from-black via-zinc-900 to-amber-950/60 flex flex-col items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.25)]">
                    <span className="text-[7px] sm:text-[8px] font-bold tracking-widest text-amber-300">
                      DOLBY
                    </span>
                    <span className="text-[6px] text-zinc-400">ATMOS 4K</span>
                  </div>
                </div>
                <div className="mt-2 w-full">
                  <h3 className="text-[10px] sm:text-xs font-bold text-white leading-tight truncate">
                    Android TV
                  </h3>
                  <p className="text-[8.5px] sm:text-[10px] text-amber-200/80 font-medium mt-0.5 truncate">
                    Dolby Atmos
                  </p>
                </div>
                <div className="w-full mt-2 pt-1.5 border-t border-amber-500/20 flex flex-col items-center gap-1">
                  <span className="inline-flex items-center gap-0.5 text-[8px] sm:text-[9.5px] font-semibold text-amber-300 bg-amber-500/15 border border-amber-400/30 rounded-full px-2 py-0.5">
                    ↓ TV Client
                  </span>
                  <span className="text-[7.5px] sm:text-[9px] text-zinc-400 font-mono">
                    22.1 MB • v2.4.0
                  </span>
                </div>
              </div>

              {/* Card 4: Windows 11 */}
              <div
                onClick={() => setSelectedDevice(DEVICES[3])}
                className={`device-card-3d cursor-pointer rounded-[18px] p-2 sm:p-3 flex flex-col items-center text-center justify-between ${
                  selectedDevice.id === 'windows' ? 'active-device ring-1 ring-amber-300/70' : ''
                }`}
              >
                <div className="w-full h-20 sm:h-28 rounded-xl bg-gradient-to-b from-blue-950/40 to-black/90 border border-amber-500/20 flex items-center justify-center relative overflow-hidden p-1.5">
                  <div className="w-16 h-11 sm:w-22 sm:h-14 rounded-t-md border border-sky-400/50 bg-gradient-to-br from-sky-500/40 via-blue-700/40 to-indigo-950 flex items-center justify-center shadow-[0_0_16px_rgba(56,189,248,0.3)]">
                    <div className="grid grid-cols-2 gap-0.5 w-4 h-4">
                      <span className="bg-sky-300/90" />
                      <span className="bg-sky-300/90" />
                      <span className="bg-sky-300/90" />
                      <span className="bg-sky-300/90" />
                    </div>
                  </div>
                </div>
                <div className="mt-2 w-full">
                  <h3 className="text-[10px] sm:text-xs font-bold text-white leading-tight truncate">
                    Windows 11
                  </h3>
                  <p className="text-[8.5px] sm:text-[10px] text-amber-200/80 font-medium mt-0.5 truncate">
                    GPU Desktop
                  </p>
                </div>
                <div className="w-full mt-2 pt-1.5 border-t border-amber-500/20 flex flex-col items-center gap-1">
                  <span className="inline-flex items-center gap-0.5 text-[8px] sm:text-[9.5px] font-semibold text-amber-300 bg-amber-500/15 border border-amber-400/30 rounded-full px-2 py-0.5">
                    ↓ .EXE Setup
                  </span>
                  <span className="text-[7.5px] sm:text-[9px] text-zinc-400 font-mono">
                    64.5 MB • v2.4.0
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. AUTONOMOUS BACKEND FEATURES (3D HEXAGONAL NEURAL NODES) */}
        <section className="relative w-full mt-5">
          {/* Floating Header Pill */}
          <div className="relative z-20 flex justify-center -mb-3.5">
            <div className="section-pill px-5 py-1.5 rounded-full">
              <span className="text-[10.5px] sm:text-xs font-bold tracking-[0.16em] text-amber-200/95 uppercase">
                AUTONOMOUS BACKEND FEATURES
              </span>
            </div>
          </div>

          {/* Spatial Frame Container */}
          <div className="spatial-section-frame rounded-[26px] pt-6 pb-4 px-3 sm:px-5 relative overflow-hidden">
            {/* Central Glowing Neural Core Connector */}
            <div className="hidden sm:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-xl border border-amber-400/40 bg-amber-500/10 items-center justify-center shadow-[0_0_30px_rgba(212,175,55,0.4)] pointer-events-none">
              <div
                className="w-5 h-5 border-2 border-amber-300 rounded-sm animate-spin"
                style={{ animationDuration: '10s' }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 relative z-10">
              {/* Feature 1: AI Neural 4K Upscaling */}
              <div className="device-card-3d rounded-2xl p-2.5 sm:p-3.5 flex items-center gap-2.5">
                <div className="hex-badge w-10 h-10 sm:w-12 sm:h-12 shrink-0 flex items-center justify-center border border-amber-300/50">
                  <span className="text-[10px] sm:text-xs font-extrabold text-amber-200">
                    4K
                  </span>
                </div>
                <div className="min-w-0">
                  <h4 className="text-[11px] sm:text-sm font-bold text-white leading-tight">
                    AI Neural
                    <br />
                    4K Upscaling
                  </h4>
                  <p className="text-[8.5px] sm:text-[11px] text-zinc-400 mt-0.5 truncate">
                    Real-time HDR bitrate engine
                  </p>
                </div>
              </div>

              {/* Feature 2: Zero-Latency AI Subtitle Sync */}
              <div className="device-card-3d rounded-2xl p-2.5 sm:p-3.5 flex items-center gap-2.5">
                <div className="hex-badge w-10 h-10 sm:w-12 sm:h-12 shrink-0 flex items-center justify-center border border-amber-300/50">
                  <span className="text-[10px] sm:text-xs font-extrabold text-amber-200">
                    CC
                  </span>
                </div>
                <div className="min-w-0">
                  <h4 className="text-[11px] sm:text-sm font-bold text-white leading-tight">
                    Zero-Latency
                    <br />
                    AI Subtitle Sync
                  </h4>
                  <p className="text-[8.5px] sm:text-[11px] text-zinc-400 mt-0.5 truncate">
                    Frame-accurate neural SRT
                  </p>
                </div>
              </div>

              {/* Feature 3: Autonomous Cloud Core */}
              <div className="device-card-3d rounded-2xl p-2.5 sm:p-3.5 flex items-center gap-2.5">
                <div className="hex-badge w-10 h-10 sm:w-12 sm:h-12 shrink-0 flex items-center justify-center border border-amber-300/50">
                  <svg
                    className="w-5 h-5 text-amber-200"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 00-9.78 2.096A4.001 4.001 0 003 15z"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h4 className="text-[11px] sm:text-sm font-bold text-white leading-tight">
                    Autonomous
                    <br />
                    Cloud Core
                  </h4>
                  <p className="text-[8.5px] sm:text-[11px] text-zinc-400 mt-0.5 truncate">
                    Self-healing edge distribution
                  </p>
                </div>
              </div>

              {/* Feature 4: Spatial Audio & Neural Sync */}
              <div className="device-card-3d rounded-2xl p-2.5 sm:p-3.5 flex items-center gap-2.5">
                <div className="hex-badge w-10 h-10 sm:w-12 sm:h-12 shrink-0 flex items-center justify-center border border-amber-300/50">
                  <svg
                    className="w-5 h-5 text-amber-200"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h4 className="text-[11px] sm:text-sm font-bold text-white leading-tight">
                    Spatial Audio
                    <br />
                    &amp; Neural Sync
                  </h4>
                  <p className="text-[8.5px] sm:text-[11px] text-zinc-400 mt-0.5 truncate">
                    Smart multi-room acoustics
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. BOTTOM PRIMARY ACTION ROW (LAUNCH SPATIAL CINEMA + DOWNLOAD CLIENTS) */}
        <section className="w-full mt-5 flex items-center gap-2.5 sm:gap-4">
          <button
            onClick={onEnterCinema}
            className="gold-cta-btn flex-1 py-3.5 sm:py-4 px-5 rounded-full text-center font-serif font-extrabold text-xs sm:text-sm md:text-base tracking-wider uppercase cursor-pointer"
          >
            LAUNCH SPATIAL CINEMA
          </button>
          <button
            id="download-btn"
            onClick={handleTriggerDownload}
            className="spatial-section-frame py-3.5 sm:py-4 px-4 sm:px-6 rounded-full text-[10.5px] sm:text-xs font-bold tracking-wider text-amber-200/95 hover:border-amber-300 transition uppercase shrink-0 cursor-pointer"
          >
            {downloadStatus || `GET ${selectedDevice.name.split(' ')[0].toUpperCase()}`}
          </button>
        </section>
      </main>

      {/* 5. FLOATING VISION-OS BOTTOM NAVIGATION DOCK */}
      <nav className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 w-[94%] max-w-[440px] spatial-section-frame rounded-full px-4 py-2 flex items-center justify-around">
        <button
          onClick={() => handleTabClick('universe')}
          className="flex flex-col items-center gap-0.5 text-amber-300 cursor-pointer bg-transparent border-0"
        >
          <svg
            className="w-5 h-5 drop-shadow-[0_0_8px_rgba(252,231,156,0.8)]"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
          <span className="text-[9.5px] font-semibold">Universe</span>
        </button>
        <button
          onClick={() => handleTabClick('discover')}
          className="flex flex-col items-center gap-0.5 text-zinc-400 hover:text-amber-200 transition cursor-pointer bg-transparent border-0"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="9" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
          </svg>
          <span className="text-[9.5px] font-medium">Discover</span>
        </button>
        <button
          onClick={() => handleTabClick('search')}
          className="flex flex-col items-center gap-0.5 text-zinc-400 hover:text-amber-200 transition cursor-pointer bg-transparent border-0"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="text-[9.5px] font-medium">Search</span>
        </button>
        <button
          onClick={() => handleTabClick('library')}
          className="flex flex-col items-center gap-0.5 text-zinc-400 hover:text-amber-200 transition cursor-pointer bg-transparent border-0"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="7" y1="4" x2="7" y2="20" />
            <line x1="17" y1="4" x2="17" y2="20" />
          </svg>
          <span className="text-[9.5px] font-medium">Library</span>
        </button>
        <button
          onClick={() => handleTabClick('settings')}
          className="flex flex-col items-center gap-0.5 text-zinc-400 hover:text-amber-200 transition cursor-pointer bg-transparent border-0"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span className="text-[9.5px] font-medium">Settings</span>
        </button>
      </nav>
    </div>
  );
};
