const express = require("express")
const Database = require("better-sqlite3")
require("dotenv").config()

const app = express()
app.use(express.json())

// DB 초기화
const db = new Database("bans.db")

db.prepare(`
CREATE TABLE IF NOT EXISTS bans (
  userId TEXT PRIMARY KEY,
  reason TEXT,
  by TEXT,
  ts INTEGER,
  expires INTEGER
)
`).run()

// 공통 CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Shared-Secret")
  if (req.method === "OPTIONS") return res.sendStatus(204)
  next()
})

// 🔑 인증
function checkAuth(req) {
  const secret =
    req.headers["x-shared-secret"] ||
    req.headers["authorization"]?.replace("Bearer ", "")

  return (
    secret === process.env.ADMIN_SECRET ||
    secret === process.env.SUPER_SECRET
  )
}

// Roblox Messaging
async function pushToRoblox(payload) {
  try {
    await fetch(
      `https://apis.roblox.com/messaging-service/v1/universes/${process.env.ROBLOX_UNIVERSE_ID}/topics/${process.env.ROBLOX_TOPIC}`,
      {
        method: "POST",
        headers: {
          "x-api-key": process.env.ROBLOX_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: JSON.stringify(payload) }),
      }
    )
  } catch (err) {
    console.error("Roblox push error:", err)
  }
}

// 🚫 밴
app.post("/ban/:id", async (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: "Unauthorized" })

  const robloxId = req.params.id
  const data = req.body || {}

  let expires = null
  if (data.days && Number(data.days) > 0) {
    expires = Date.now() + Number(data.days) * 86400000
  }

  const record = {
    by: data.by || "unknown",
    reason: data.reason || "No reason",
    ts: Date.now(),
    expires
  }

  db.prepare(`
    INSERT OR REPLACE INTO bans (userId, reason, by, ts, expires)
    VALUES (?, ?, ?, ?, ?)
  `).run(robloxId, record.reason, record.by, record.ts, record.expires)

  await pushToRoblox({
    action: "ban_update",
    userId: Number(robloxId),
    banned: true,
    ...record
  })

  res.json({ robloxId, banned: true, action: "ban", ...record })
})

// ❌ 언밴
app.delete("/ban/:id", async (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: "Unauthorized" })

  const robloxId = req.params.id

  db.prepare(`DELETE FROM bans WHERE userId = ?`).run(robloxId)

  await pushToRoblox({
    action: "ban_update",
    userId: Number(robloxId),
    banned: false
  })

  res.json({ robloxId, banned: false, action: "unban" })
})

// 🔍 조회
app.get("/banned/:id", (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: "Unauthorized" })

  const robloxId = req.params.id

  const row = db.prepare(`SELECT * FROM bans WHERE userId = ?`).get(robloxId)

  if (!row) {
    return res.json({ robloxId, banned: false, action: "checkban" })
  }

  if (row.expires && Date.now() > row.expires) {
    db.prepare(`DELETE FROM bans WHERE userId = ?`).run(robloxId)
    return res.json({ robloxId, banned: false, action: "checkban" })
  }

  res.json({
    robloxId,
    banned: true,
    action: "checkban",
    ...row
  })
})

// 📦 bulk
app.post("/banned/bulk", (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: "Unauthorized" })

  const rows = db.prepare(`SELECT * FROM bans`).all()

  const bans = rows.map(r => ({
    userId: Number(r.userId),
    reason: r.reason,
    by: r.by,
    ts: r.ts,
    expires: r.expires
  }))

  res.json({ bans })
})

// 🚨 shutdown
app.post("/shutdown/:id", async (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: "Unauthorized" })

  try {
    await fetch(
      `https://apis.roblox.com/messaging-service/v1/universes/${req.params.id}/topics/Shutdown`,
      {
        method: "POST",
        headers: {
          "x-api-key": process.env.ROBLOX_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: "shutdown" }),
      }
    )

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

app.listen(3000, () => {
  console.log("🚀 http://localhost:3000")
})