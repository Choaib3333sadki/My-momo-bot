import axios from 'axios'
import yts from 'yt-search'

const CONFIG = {
  audio: { ext: ["mp3", "m4a", "wav", "opus", "flac"], q: ["best", "320k", "128k"] },
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

async function convertYouTube(url, format = "mp3", quality = "128k") {
  const type = Object.keys(CONFIG).find(k => CONFIG[k].ext.includes(format))
  if (!type) throw new Error(`Unsupported format: ${format}`)

  if (!CONFIG[type].q.includes(quality)) {
    throw new Error(`Invalid quality. Choose: ${CONFIG[type].q.join(", ")}`)
  }

  const { data: meta } = await axios.get("https://www.youtube.com/oembed", {
    params: { url, format: "json" }
  })

  const payload = {
    url,
    os: "android",
    output: {
      type,
      format,
      ...(type === "video" && { quality })
    },
    ...(type === "audio" && { audio: { bitrate: quality } })
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
    thumbnail: meta.thumbnail_url,
    downloadUrl: result.downloadUrl,
    filename: `${meta.title.replace(/[^\w\s-]/gi, '')}.${format}`
  }
}

/* =========================
   Handler
========================= */

let handler = async (m, { conn, args, command, usedPrefix }) => {

  if (!args[0]) {
    return m.reply(`
📺 *YouTube Plugin Guide*

This feature allows you to:
• Search YouTube videos
• Download audio (MP3)
• Download video (MP4)

━━━━━━━━━━━━━━━━━━
🔎 *Search Video*
${usedPrefix}ytsearch <keywords>

Example:
${usedPrefix}ytsearch Alan Walker

━━━━━━━━━━━━━━━━━━
🎵 *Download MP3*
${usedPrefix}ytmp3 <youtube url>

Example:
${usedPrefix}ytmp3 https://youtu.be/xxxxx

━━━━━━━━━━━━━━━━━━
🎬 *Download MP4*
${usedPrefix}ytmp4 <youtube url> [quality]

Available quality:
144p, 240p, 360p, 480p, 720p, 1080p

Example:
${usedPrefix}ytmp4 https://youtu.be/xxxxx 720p

━━━━━━━━━━━━━━━━━━
⚠️ Notes:
• Make sure the link is valid.
• Wait until the conversion process is completed.
`)
  }

  try {

    // SEARCH
    if (command === 'ytsearch') {
      const text = args.join(" ")
      const search = await yts(text)

      if (!search.all.length)
        return m.reply("No results found.")

      let teks = `🔎 *YouTube Search Results*\n\n`
      search.all.slice(0, 5).forEach((v, i) => {
        teks += `
${i + 1}. ${v.title}
⏱ Duration: ${v.timestamp}
📺 Channel: ${v.author.name}
🔗 ${v.url}
`
      })

      return m.reply(teks)
    }

    // MP3
    if (command === 'ytmp3') {
      const url = args[0]
      m.reply("⏳ Processing audio, please wait...")

      const result = await convertYouTube(url, "mp3", "128k")

      await conn.sendFile(
        m.chat,
        result.downloadUrl,
        result.filename,
        `🎵 *YouTube MP3 Download*

📌 Title: ${result.title}
📺 Channel: ${result.author}
🔊 Quality: 128kbps

Enjoy your audio!`,
        m
      )
    }

    // MP4
    if (command === 'ytmp4') {
      const url = args[0]
      const quality = args[1] || "720p"

      m.reply("⏳ Processing video, please wait...")

      const result = await convertYouTube(url, "mp4", quality)

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
    }

  } catch (err) {
    m.reply("❌ Error: " + err.message)
  }
}

handler.help = ['ytsearch', 'ytmp3', 'ytmp4']
handler.tags = ['downloader']
handler.command = ['ytsearch', 'ytmp3', 'ytmp4']
handler.limit = true

export default handler
