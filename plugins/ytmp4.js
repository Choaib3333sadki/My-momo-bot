import axios from 'axios'

const CONFIG = {
  video: { ext: ["mp4"], q: ["144p", "240p", "360p", "480p", "720p", "1080p"] }
}

const headers = {
  accept: "application/json",
  "content-type": "application/json",
  "user-agent": "Mozilla/5.0 (Android)",
  referer: "https://ytmp3.gg/"
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function poll(statusUrl) {
  const { data } = await axios.get(statusUrl, { headers })

  if (data.status === "completed") return data
  if (data.status === "failed") throw new Error(data.message || "Conversion failed")

  await sleep(2000)
  return poll(statusUrl)
}

async function convertYouTube(url, quality = "720p") {

  if (!CONFIG.video.q.includes(quality)) {
    throw new Error(`Invalid quality. Choose: ${CONFIG.video.q.join(", ")}`)
  }

  const { data: meta } = await axios.get("https://www.youtube.com/oembed", {
    params: { url, format: "json" }
  })

  const payload = {
    url,
    os: "android",
    output: {
      type: "video",
      format: "mp4",
      quality
    }
  }

  let downloadInit
  try {
    downloadInit = await axios.post("https://hub.ytconvert.org/api/download", payload, { headers })
  } catch {
    downloadInit = await axios.post("https://api.ytconvert.org/api/download", payload, { headers })
  }

  if (!downloadInit?.data?.statusUrl)
    throw new Error("Converter failed to respond")

  const result = await poll(downloadInit.data.statusUrl)

  return {
    title: meta.title,
    author: meta.author_name,
    downloadUrl: result.downloadUrl,
    filename: `${meta.title.replace(/[^\w\s-]/gi, '')}.mp4`
  }
}

/* =========================
   Handler - ytmp4 only
========================= */

let handler = async (m, { conn, args, usedPrefix }) => {

  if (!args[0]) {
    return m.reply(`
🎬 *YouTube MP4 Downloader*

Usage:
${usedPrefix}ytmp4 <youtube url> [quality]

Available quality:
144p, 240p, 360p, 480p, 720p, 1080p

Example:
${usedPrefix}ytmp4 https://youtu.be/xxxxx 720p
`)
  }

  try {
    const url = args[0]
    const quality = args[1] || "720p"

    m.reply("⏳ Processing video, please wait...")

    const result = await convertYouTube(url, quality)

    await conn.sendFile(
      m.chat,
      result.downloadUrl,
      result.filename,
      `🎬 *YouTube MP4 Download*

📌 Title: ${result.title}
📺 Channel: ${result.author}
🎞 Quality: ${quality}

Enjoy your video!`,
      m
    )

  } catch (err) {
    m.reply("❌ Error: " + err.message)
  }
}

handler.help = ['ytmp4']
handler.tags = ['downloader']
handler.command = ['ytmp4']
handler.limit = true

export default handler
