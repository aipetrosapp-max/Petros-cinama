import subprocess
import time
import os

FFMPEG_PATH = r"C:\Users\ELI\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe"
STREAM_KEY = "live_1610247809_EDljKoeh5wvAYWvIH9Su43CJfGWFGC"
TWITCH_RTMP_URL = f"rtmp://live.twitch.tv/app/{STREAM_KEY}"

# Movie source list for 24/7 continuous broadcast
VIDEO_SOURCES = [
    "https://ia600608.us.archive.org/1/items/youtube-qVId_hDAvHw/qVId_hDAvHw.mp4",
    "https://videos.company3.com/2016/06/X-Men-Apocalypse-Final-Trailer-HD-20th-Century-FOX.mp4",
    "https://archive.org/download/the-batman-2022-main-trailer-4k-prores/VGC921_trl_2_online_sb_txt_uhd_scp_bt1886_stereo_2398fps_20211011.mp4",
    "https://archive.org/download/interstellar-trailer-3/Interstellar_OfficialTrailer3_4K_51_prores.mp4"
]

def stream_video(video_url):
    print(f"[{time.strftime('%H:%M:%S')}] Starting stream broadcast for: {video_url[:60]}...")
    
    # Overlay banner: official slogan and domain
    # Font is Arial, white text with dark box for readability
    banner_text = "AI Petros Cinema | aipetros.xyz | 100% Free 4K"
    
    cmd = [
        FFMPEG_PATH,
        "-re",
        "-i", video_url,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-b:v", "3000k",
        "-maxrate", "3000k",
        "-bufsize", "6000k",
        "-pix_fmt", "yuv420p",
        "-g", "60",
        "-c:a", "aac",
        "-b:a", "160k",
        "-ar", "44100",
        "-f", "flv",
        TWITCH_RTMP_URL
    ]

    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        for line in proc.stdout:
            if "frame=" in line or "fps=" in line:
                # Active streaming progress
                pass
            elif "error" in line.lower():
                print(f"[FFmpeg Warning]: {line.strip()[:100]}")
        proc.wait()
    except Exception as e:
        print(f"[Stream Exception]: {e}")

def run_247_stream():
    print("🚀 AI Petros Cinema Twitch 24/7 Live Broadcaster Initialized!")
    idx = 0
    while True:
        url = VIDEO_SOURCES[idx % len(VIDEO_SOURCES)]
        idx += 1
        stream_video(url)
        time.sleep(2)

if __name__ == '__main__':
    run_247_stream()
