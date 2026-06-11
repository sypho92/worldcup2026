const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js')
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice')

const BOT_TOKEN    = process.env.DISCORD_BOT_TOKEN
const GUILD_ID     = process.env.DISCORD_GUILD_ID
const CATEGORY_NAME = '🍿 Watch Parties'

let client      = null
let clientReady = false
let connectPromise = null

const inviteCache    = new Map() // matchId → invite info
const matchChannels  = new Map() // matchId → { voiceId, textId }
const voiceConns     = new Map() // matchId → VoiceConnection

function isConfigured() {
  return Boolean(BOT_TOKEN && GUILD_ID)
}

function connect() {
  if (!isConfigured()) {
    console.warn('[Discord] BOT_TOKEN/GUILD_ID manquants — watch party désactivé')
    return
  }
  if (connectPromise) return connectPromise

  connectPromise = new Promise((resolve, reject) => {
    client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
    })
    client.once('ready', () => {
      clientReady = true
      console.log(`[Discord] Bot connecté : ${client.user.tag}`)
      resolve()
    })
    client.on('error', (err) => console.error('[Discord] Erreur :', err))
    client.login(BOT_TOKEN).catch(reject)
  })

  return connectPromise
}

function getClient() {
  if (!clientReady || !client) throw new Error('Bot Discord non connecté')
  return client
}

function voiceName(match) {
  const h = (match.homeTeam?.tla || 'tbd').toLowerCase()
  const a = (match.awayTeam?.tla || 'tbd').toLowerCase()
  return `⚽┃${h}-vs-${a}`
}
function textName(match) {
  return voiceName(match).replace('⚽┃', '📢┃')
}

async function getOrCreateCategory(guild) {
  let cat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === CATEGORY_NAME)
  if (!cat) cat = await guild.channels.create({ name: CATEGORY_NAME, type: ChannelType.GuildCategory })
  return cat
}

async function getOrCreateMatchChannels(match) {
  if (matchChannels.has(match.id)) return matchChannels.get(match.id)

  const bot = getClient()
  const guild = await bot.guilds.fetch(GUILD_ID)
  await guild.channels.fetch()
  const category = await getOrCreateCategory(guild)

  const vName = voiceName(match)
  const tName = textName(match)

  let voice = guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.name === vName && c.parentId === category.id)
  if (!voice) {
    voice = await guild.channels.create({
      name: vName,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: [{
        id: guild.roles.everyone.id,
        allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream],
      }],
    })
  }

  let text = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === tName && c.parentId === category.id)
  if (!text) {
    text = await guild.channels.create({
      name: tName,
      type: ChannelType.GuildText,
      parent: category.id,
    })
  }

  const ids = { voiceId: voice.id, textId: text.id }
  matchChannels.set(match.id, ids)
  return ids
}

// Utilisé par le bouton 👁 Watch party dans l'app
async function createWatchParty(match) {
  const cached = inviteCache.get(match.id)
  if (cached && cached.expiresAt > Date.now()) return cached

  const bot = getClient()
  const { voiceId } = await getOrCreateMatchChannels(match)
  const guild = await bot.guilds.fetch(GUILD_ID)
  const channel = await bot.channels.fetch(voiceId)

  const invite = await channel.createInvite({ maxAge: 86400, maxUses: 0, unique: false })
  const result = {
    inviteUrl: invite.url,
    channelId: voiceId,
    channelName: voiceName(match),
    expiresAt: Date.now() + 86400 * 1000,
  }
  inviteCache.set(match.id, result)
  return result
}

// Poste un message dans le salon texte du match
async function postMatchUpdate(match, content) {
  if (!clientReady) return
  try {
    const { textId } = await getOrCreateMatchChannels(match)
    const channel = await getClient().channels.fetch(textId)
    await channel.send(content)
  } catch (err) {
    console.error('[Discord] postMatchUpdate error:', err.message)
  }
}

// Bot rejoint le salon vocal du match
async function joinMatchVoice(match) {
  if (!clientReady) return
  if (voiceConns.has(match.id)) return
  try {
    const { voiceId } = await getOrCreateMatchChannels(match)
    const bot = getClient()
    const guild = await bot.guilds.fetch(GUILD_ID)
    const channel = await bot.channels.fetch(voiceId)

    const conn = joinVoiceChannel({
      channelId: channel.id,
      guildId: GUILD_ID,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true,
    })

    await entersState(conn, VoiceConnectionStatus.Ready, 10_000)
    voiceConns.set(match.id, conn)
    console.log(`[Discord] Bot rejoint ${channel.name}`)
  } catch (err) {
    console.error('[Discord] joinMatchVoice error:', err.message)
  }
}

// Bot quitte le salon vocal du match
function leaveMatchVoice(matchId) {
  const conn = voiceConns.get(matchId)
  if (conn) {
    conn.destroy()
    voiceConns.delete(matchId)
    console.log(`[Discord] Bot quitté vocal match ${matchId}`)
  }
}

module.exports = { connect, createWatchParty, postMatchUpdate, joinMatchVoice, leaveMatchVoice, isConfigured }
