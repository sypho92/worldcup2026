import 'dotenv/config'
import { Client, GatewayIntentBits, ChannelType } from 'discord.js'

const c = new Client({ intents: [GatewayIntentBits.Guilds] })
c.once('ready', async () => {
  const g = await c.guilds.fetch(process.env.DISCORD_GUILD_ID)
  await g.channels.fetch()
  const ch = g.channels.cache.find(x => x.type === ChannelType.GuildText) ||
             g.channels.cache.find(x => x.type === ChannelType.GuildVoice)
  const inv = await ch.createInvite({ maxAge: 0, maxUses: 0, unique: true })
  console.log('INVITE', inv.url)
  process.exit(0)
})
c.login(process.env.DISCORD_BOT_TOKEN).catch(e => { console.error('FAIL', e.message); process.exit(1) })
