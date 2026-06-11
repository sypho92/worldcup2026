const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js')

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
const GUILD_ID = process.env.DISCORD_GUILD_ID
const CATEGORY_NAME = '🍿 Watch Parties'

const inviteCache = new Map()

let client = null
let clientReady = false
let connectPromise = null

function isConfigured() {
  return Boolean(BOT_TOKEN && GUILD_ID)
}

// Appelé une seule fois au démarrage du serveur
function connect() {
  if (!isConfigured()) {
    console.warn('[Discord] DISCORD_BOT_TOKEN / DISCORD_GUILD_ID manquants — watch party désactivé')
    return
  }
  if (connectPromise) return connectPromise

  connectPromise = new Promise((resolve, reject) => {
    client = new Client({ intents: [GatewayIntentBits.Guilds] })
    client.once('ready', () => {
      clientReady = true
      console.log(`[Discord] Bot connecté : ${client.user.tag}`)
      resolve()
    })
    client.on('error', (err) => console.error('[Discord] Erreur bot :', err))
    client.login(BOT_TOKEN).catch(reject)
  })

  return connectPromise
}

function getClient() {
  if (!clientReady || !client) throw new Error('Bot Discord non connecté')
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

async function createWatchParty(match) {
  const cached = inviteCache.get(match.id)
  if (cached && cached.expiresAt > Date.now()) return cached

  const bot = getClient()
  const guild = await bot.guilds.fetch(GUILD_ID)
  await guild.channels.fetch()

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

module.exports = { connect, createWatchParty, isConfigured }
