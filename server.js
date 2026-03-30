const express = require("express")
const Database = require("better-sqlite3")
require("dotenv").config()

const app = express()
app.use(express.json())

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

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Shared-Secret")
  if (req.method === "OPTIONS") return res.sendStatus(204)
  next()
})

function checkAuth(req) {
  const secret =
    req.headers["x-shared-secret"] ||
    req.headers["authorization"]?.replace("Bearer ", "")

  return (
    secret === process.env.ADMIN_SECRET ||
    secret === process.env.SUPER_SECRET
  )
}

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

app.use((req, res, next) => {
  const err = new Error("Not Found")
  err.status = 404
  next(err)
})

app.use((err, req, res, next) => {
  console.error(err)

  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    status: err.status || 500,
    path: req.originalUrl,
    method: req.method,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined
  })
})

app.listen(3000, () => {
  console.log("Server Started [PORT NUMBER: 3000] --> http://localhost:3000")
})
