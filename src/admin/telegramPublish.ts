/**
 * PETROS CINEMA — Telegram channel publishing (shared)
 *
 * Used by both the admin API routes and the Persian admin chat agent.
 * Reads bot token + destination channel from env or config.json, then posts
 * either the real video file (bot API server-side fetch, direct media URLs)
 * or a captioned link message (t.me / HLS).
 */

import fs from 'fs';
import path from 'path';

export function readTelegramBotConfig(): { token: string; channel: string } {
  let token = (process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || '').trim();
  let channel = (process.env.TELEGRAM_DEST_CHANNEL || '').trim();
  if (!token || !channel) {
    try {
      const raw = fs.readFileSync(path.join(process.cwd(), 'config.json'), 'utf8');
      const cfg = JSON.parse(raw) as {
        bot_token?: string;
        destination_channel?: number | string;
        channel_id?: number | string;
      };
      token = token || String(cfg.bot_token || '').trim();
      channel = channel || String(cfg.destination_channel ?? cfg.channel_id ?? '').trim();
    } catch {
      // no local config — env only
    }
  }
  return { token, channel };
}

export async function publishToTelegramChannel(
  mediaUrl: string,
  title: string,
  siteUrl: string
): Promise<{ ok: boolean; method?: string; messageFa: string }> {
  const { token, channel } = readTelegramBotConfig();
  if (!token) {
    return { ok: false, messageFa: 'توکن بات تلگرام تنظیم نشده (env یا config.json)؛ فقط به سایت اضافه شد.' };
  }
  if (!channel) {
    return { ok: false, messageFa: 'شناسه کانال مقصد تنظیم نشده؛ فقط به سایت اضافه شد.' };
  }
  const caption = `🎬 ${title}\n✅ آماده پخش در سایت: ${siteUrl}`;
  const isDirectMedia = /\.(mp4|mkv|webm|m4v|mov|avi)(\?|$)/i.test(mediaUrl) && !mediaUrl.includes('t.me/');
  const post = async (method: 'sendVideo' | 'sendMessage', payload: Record<string, unknown>) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const botResponse = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: channel, ...payload }),
        signal: controller.signal
      });
      const body = (await botResponse.json()) as { ok?: boolean; description?: string };
      return body.ok
        ? { ok: true as const, method, messageFa: 'در کانال تلگرام منتشر شد.' }
        : { ok: false as const, method, messageFa: `انتشار تلگرام ناموفق: ${String(body.description || botResponse.status).slice(0, 140)}` };
    } catch (error) {
      return { ok: false as const, method, messageFa: `انتشار تلگرام ناموفق: ${String(error).slice(0, 140)}` };
    } finally {
      clearTimeout(timer);
    }
  };

  if (isDirectMedia) {
    // Telegram downloads the file server-side and posts the real video.
    const videoPost = await post('sendVideo', { video: mediaUrl, caption });
    if (videoPost.ok) return videoPost;
    // Bot video fetch can fail (dead URL, >20MB bot limit). Never lose the
    // announcement: fall back to a captioned link message.
    const fallback = await post('sendMessage', {
      text: `${caption}\n🔗 ${mediaUrl}`,
      disable_web_page_preview: false
    });
    return fallback.ok
      ? { ...fallback, messageFa: `ویدیو مستقیم منتشر نشد (${videoPost.messageFa})؛ به‌جای آن لینک در کانال قرار گرفت.` }
      : { ...fallback, messageFa: `${videoPost.messageFa} — لینک جایگزین هم منتشر نشد.` };
  }

  // t.me posts / HLS / page links: share a captioned link message.
  return post('sendMessage', { text: `${caption}\n🔗 ${mediaUrl}`, disable_web_page_preview: false });
}
