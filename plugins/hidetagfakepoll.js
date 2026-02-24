/*
feature : hidetag fakepoll
author  : HanzXD (edited)
*/

let handler = async (m, { conn, participants }) => {
  let users = participants.map(u => u.id)

  // Default poll question
  let pesan = "Do you want us to look for another hosting platform? | هل تريدون المزيد من  المنصات"

  const content = {
    pollResultSnapshotMessage: {
      pollVotes: [
        {
          optionName: "Yes we need | نعم نعم",
          optionVoteCount: 9123456
        },
        {
          optionName: "No that's enough | لا هذا يكفي",
          optionVoteCount: 9345678
        },
        {
          optionName: "😑 Where can we find these platforms?",
          optionVoteCount: 9876543
        }
      ],
      name: pesan,
      contextInfo: {
        mentionedJid: users,
        forwardingScore: 127,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: "120363285847738492@newsletter",
          serverMessageId: 0,
          newsletterName: "silana ai | البوت رقم #1 😐"
        },
        forwardOrigin: 0
      },
      pollType: 0
    }
  }

  await conn.relayMessage(m.chat, content, { mentions: users })
}

handler.help = ['hidetagfakepoll']
handler.tags = ['owner']
handler.command = /^(hidetagfakepoll)$/i
handler.group = true
handler.admin = true

export default handler
