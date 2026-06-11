// Watch Party streamer — selfbot qui diffuse l'écran virtuel (Chrome/beIN) dans le vocal Discord via "Go Live".
// Capture : ffmpeg x11grab (display :99) + audio PulseAudio (watchparty.monitor) → flux unique → discord-video-stream.
//
// Variables d'env requises :
//   DISCORD_USER_TOKEN   token du compte Discord jetable (selfbot)
//   WP_GUILD_ID          id du serveur Discord
//   WP_CHANNEL_ID        id du salon vocal cible (peut aussi être passé en argv[2])
// Optionnelles :
//   WP_DISPLAY (:99)  WP_AUDIO (watchparty.monitor)  WP_SIZE (1280x720)
//   WP_FPS (30)  WP_BITRATE (4000)  WP_BITRATE_MAX (6000)
//
// Usage : node watchparty-streamer.mjs [channelId]

import { spawn } from 'node:child_process'
import { openSync, appendFileSync } from 'node:fs'
import { Client } from 'discord.js-selfbot-v13'
import { Streamer, prepareStream, playStream, Utils, Encoders } from '@dank074/discord-video-stream'

const LOG = '/tmp/streamer.log'
const t0 = Date.now()
function log(...a) {
  const line = `[+${((Date.now() - t0) / 1000).toFixed(1)}s] ${a.join(' ')}\n`
  try { appendFileSync(LOG, line) } catch {}
  process.stdout.write(line)
}

const TOKEN       = process.env.DISCORD_USER_TOKEN
const GUILD_ID    = process.env.WP_GUILD_ID
const CHANNEL_ID  = process.argv[2] || process.env.WP_CHANNEL_ID
const DISPLAY     = process.env.WP_DISPLAY || ':99'
const AUDIO_SRC   = process.env.WP_AUDIO || 'watchparty.monitor'
const SIZE        = process.env.WP_SIZE || '1280x720'
const FPS         = parseInt(process.env.WP_FPS || '30', 10)
const BITRATE     = parseInt(process.env.WP_BITRATE || '4000', 10)
const BITRATE_MAX = parseInt(process.env.WP_BITRATE_MAX || '6000', 10)
const HEIGHT      = parseInt(SIZE.split('x')[1] || '720', 10)

if (!TOKEN || !GUILD_ID || !CHANNEL_ID) {
  log('[streamer] DISCORD_USER_TOKEN, WP_GUILD_ID et WP_CHANNEL_ID (ou argv) requis')
  process.exit(1)
}

// Capture transport léger : H264 propre (keyframes 1s, pas de B-frames) + AAC en MPEG-TS.
function startCapture() {
  const errFd = openSync('/tmp/capture.log', 'a')
  const args = [
    '-loglevel', 'warning',
    '-f', 'x11grab', '-framerate', String(FPS), '-video_size', SIZE, '-i', `${DISPLAY}.0`,
    '-f', 'pulse', '-i', AUDIO_SRC,
    '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency',
    '-pix_fmt', 'yuv420p', '-profile:v', 'baseline', '-g', String(FPS), '-bf', '0',
    '-b:v', `${BITRATE}k`, '-maxrate', `${BITRATE_MAX}k`, '-bufsize', `${BITRATE_MAX}k`,
    '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-ar', '48000',
    '-f', 'mpegts', 'pipe:1',
  ]
  const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', errFd] })
  proc.on('exit', (code, sig) => log(`[capture] ffmpeg EXIT code=${code} sig=${sig}`))
  return proc
}

let captureProc = null

async function main() {
  const streamer = new Streamer(new Client())
  log('[streamer] login...')
  await streamer.client.login(TOKEN)
  log(`[streamer] connecté : ${streamer.client.user?.tag}`)

  log(`[streamer] join vocal guild=${GUILD_ID} channel=${CHANNEL_ID}`)
  await streamer.joinVoice(GUILD_ID, CHANNEL_ID)
  log('[streamer] joinVoice OK')

  captureProc = startCapture()

  const { command, output } = prepareStream(captureProc.stdout, {
    height: HEIGHT,
    frameRate: FPS,
    bitrateVideo: BITRATE,
    bitrateVideoMax: BITRATE_MAX,
    videoCodec: Utils.normalizeVideoCodec('H264'),
    encoder: Encoders.software({ x264: { preset: 'superfast' } }),
    includeAudio: true,
    minimizeLatency: true,
  })

  command.on('error', (err) => log('[ffmpeg-encode] error:', err?.message || String(err)))
  command.on('end', () => log('[ffmpeg-encode] end'))

  // Heartbeat persistant : état de la connexion vocale
  setInterval(() => {
    const v = streamer.voiceConnection
    log(`[hb] voiceConn=${v ? 'present' : 'null'} ready=${v?.ready ?? '?'}`)
  }, 5000)

  log('[streamer] go live...')
  const playStart = Date.now()
  await playStream(output, streamer, { type: 'go-live', height: HEIGHT, frameRate: FPS })
  log(`[streamer] playStream RÉSOLU après ${((Date.now() - playStart) / 1000).toFixed(1)}s — stream terminé`)
  // NE PAS exit tout de suite : on reste vivant pour observer / relancer
  log('[streamer] (process maintenu vivant 60s pour diagnostic)')
  setTimeout(() => cleanup(0), 60000)
}

function cleanup(code) {
  try { captureProc?.kill('SIGKILL') } catch {}
  process.exit(code)
}

process.on('SIGINT', () => cleanup(0))
process.on('SIGTERM', () => cleanup(0))
process.on('unhandledRejection', (e) => log('[streamer] unhandledRejection:', e?.message || String(e)))
process.on('uncaughtException', (e) => log('[streamer] uncaughtException:', e?.message || String(e)))
process.on('exit', (code) => log(`[streamer] process exit code=${code}`))

main().catch((err) => {
  log('[streamer] fatal:', err?.stack || err?.message || String(err))
  cleanup(1)
})
