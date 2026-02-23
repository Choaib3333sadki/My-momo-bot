/**
 * Image-to-Image AI Editor (nanana.app)
 * Feature: Edit an image using AI with a custom prompt
 * plugin by Noureddine ouafy
 * scrape by CodeLabs
*/

import cheerio from "cheerio"
import crypto from "crypto"
import fs from "fs"
import FormData from "form-data"
import path from "path"
import axios from "axios"

let handler = async (m, { conn, text }) => {
  const q = m.quoted || m
  const mime = (q.msg || q).mimetype || ""

  // GUIDE MESSAGE
  if (!mime.startsWith("image/")) {
    return m.reply(
`✨ *AI Image Editor Guide*

This feature allows you to edit an image using AI.

📌 How to use:
1. Send or reply to an image
2. Use command:
   .editimg <your prompt>

Example:
.editimg turn this into anime style

⚠️ You must reply to an image and provide a prompt.`
    )
  }

  if (!text) return m.reply("❌ Please provide a prompt.")

  await m.react("⏳")

  const buffer = await q.download()
  if (!buffer) return m.reply("❌ Failed to download image.")

  const tmpDir = path.join(process.cwd(), "tmp")
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir)

  const filePath = path.join(tmpDir, `${Date.now()}.jpg`)
  fs.writeFileSync(filePath, buffer)

  try {
    const result = await nanana(filePath, text)

    await conn.sendMessage(
      m.chat,
      {
        image: { url: result.image },
        caption: "✨ Editing completed successfully!"
      },
      { quoted: m }
    )
  } catch (err) {
    console.log(err)
    m.reply("❌ Failed to edit image.")
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  }
}

handler.help = ["editimg"]
handler.command = ["editimg"]
handler.tags = ["editor"]
handler.limit = true

export default handler

/* ========================= FUNCTIONS ========================= */

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

function genxfpid() {
  const p1 = crypto.randomBytes(16).toString("hex")
  const p2 = crypto.randomBytes(32).toString("hex")
  return Buffer.from(`${p1}.${p2}`).toString("base64")
}

const akunlama = {
  inbox: async (recipient) => {
    const url = `https://akunlama.com/api/v1/mail/list?recipient=${recipient}`
    const response = await axios.get(url)
    return Array.isArray(response.data) ? response.data : []
  },

  getInbox: async (region, key) => {
    const url = `https://akunlama.com/api/v1/mail/getHtml?region=${region}&key=${key}`
    const response = await axios.get(url)

    const $ = cheerio.load(response.data || "")
    $("script, style").remove()
    return $("body").text().replace(/\s+/g, " ").trim()
  }
}

const baseHeaders = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 10)",
  "Accept-Language": "en-US,en;q=0.9",
  origin: "https://nanana.app",
  referer: "https://nanana.app/en"
}

async function getAuth() {
  const username = crypto.randomBytes(6).toString("hex")
  const email = `${username}@akunlama.com`

  await axios.post(
    "https://nanana.app/api/auth/email-otp/send-verification-otp",
    { email, type: "sign-in" },
    { headers: { ...baseHeaders, "Content-Type": "application/json" } }
  )

  let mailKey, mailRegion
  let attempt = 0

  while (!mailKey) {
    const mails = await akunlama.inbox(username)

    if (mails.length > 0) {
      mailKey = mails[0].storage.key
      mailRegion = mails[0].storage.region
      break
    }

    await delay(3000)
    attempt++
    if (attempt > 20) throw new Error("OTP timeout")
  }

  const mailContent = await akunlama.getInbox(mailRegion, mailKey)
  const otpMatch = mailContent.match(/\b\d{6}\b/)
  if (!otpMatch) throw new Error("OTP not found")

  const signin = await axios.post(
    "https://nanana.app/api/auth/sign-in/email-otp",
    { email, otp: otpMatch[0] },
    { headers: { ...baseHeaders, "Content-Type": "application/json" } }
  )

  const cookies = signin.headers["set-cookie"]
  const cookieString = cookies
    ? cookies.map(c => c.split(";")[0]).join("; ")
    : ""

  return {
    ...baseHeaders,
    Cookie: cookieString,
    "x-fp-id": genxfpid()
  }
}

async function uploadImage(imgPath, headers) {
  const form = new FormData()
  form.append("image", fs.createReadStream(imgPath))

  const res = await axios.post(
    "https://nanana.app/api/upload-img",
    form,
    { headers: { ...headers, ...form.getHeaders() } }
  )

  return res.data.url
}

async function createJob(imgUrl, prompt, headers) {
  const res = await axios.post(
    "https://nanana.app/api/image-to-image",
    { prompt, image_urls: [imgUrl] },
    { headers: { ...headers, "Content-Type": "application/json" } }
  )

  return res.data.request_id
}

async function checkJob(jobId, headers) {
  const res = await axios.post(
    "https://nanana.app/api/get-result",
    { requestId: jobId, type: "image-to-image" },
    { headers: { ...headers, "Content-Type": "application/json" } }
  )

  return res.data
}

async function nanana(imgPath, prompt) {
  const headers = await getAuth()
  const uploadUrl = await uploadImage(imgPath, headers)
  const jobId = await createJob(uploadUrl, prompt, headers)

  let result
  let attempt = 0

  do {
    await delay(5000)
    result = await checkJob(jobId, headers)
    attempt++
    if (attempt > 30) throw new Error("Job timeout")
  } while (!result.completed)

  if (!result.data?.images?.length)
    throw new Error("No image result found")

  return {
    job_id: jobId,
    image: result.data.images[0].url
  }
}
