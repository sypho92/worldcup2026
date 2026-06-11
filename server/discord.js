const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js')

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
const GUILD_ID = process.env.DISCORD_GUILD_ID
const CATEGORY_NAME = '🍿 Watch Parties'

let client = null
let ready = false

// inviteUrl cache per matchId — avoids creating a new invite on every click
const inviteCache = new Map()

function isConfigured() {
  return Boolean(BOT_TOKEN && GUILD_ID)
}

async function getClient() {
  if (!isConfigured()) throw new Error('DISCORD_BOT_TOKEN / DISCORD_GUILD_ID manquants dans .env')
  if (client && ready) return client

  client = new Client({ intents: [GatewayIntentBits.Guilds] })
  await client.login(BOT_TOKEN)
  await new Promise((resolve, reject) => {
    if (client.isReady()) return resolve()
    client.once('clientReady', resolve)
    client.once('error', reject)
    setTimeout(() => reject(new Error('Discord login timeout')), 15000)
  })
  ready = true
  console.log(`Discord bot connecté : ${client.user.tag}`)
  return client
}

function channelNameFor(match) {
  const home = (match.homeTeam?.tla || 'tbd').toLowerCase()
  const away = (match.awayTeam?.tla || 'tbd').toLowerCase()
  return `⚽┃${home}-vs-${away}`
}

async function getOrCreateCategory(guild) {
  const existing = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === CATEGORY_NAME
  )
  if (existing) return existing
  return guild.channels.create({ name: CATEGORY_NAME, type: ChannelType.GuildCategory })
}

/**
 * Creates (or reuses) a voice channel for the match and returns an invite URL.
 */
async function createWatchParty(match) {
  const cached = inviteCache.get(match.id)
  if (cached && cached.expiresAt > Date.now()) return cached

  const bot = await getClient()
  const guild = await bot.guilds.fetch(GUILD_ID)
  await guild.channels.fetch() // populate cache

  const category = await getOrCreateCategory(guild)
  const name = channelNameFor(match)

  let channel = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildVoice && c.name === name && c.parentId === category.id
  )
  if (!channel) {
    channel = await guild.channels.create({
      name,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream],
        },
      ],
    })
  }

  const invite = await channel.createInvite({ maxAge: 86400, maxUses: 0, unique: false })
  const result = {
    inviteUrl: invite.url,
    channelId: channel.id,
    channelName: name,
    expiresAt: Date.now() + 86400 * 1000,
  }
  inviteCache.set(match.id, result)
  return result
}

module.exports = { createWatchParty, isConfigured }
