const {
  Client,
  IntentsBitField,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const dotenv = require("dotenv");
dotenv.config();

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.GuildVoiceStates,
    IntentsBitField.Flags.MessageContent,
  ],
});

const prefix = "!"; // Command prefix
const tempChannels = new Map(); // Stores temp channel data

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
  console.log("Voice Channel Manager is ready!");
});

// Create full interface
async function createFullInterface(message) {
  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("limit")
        .setLabel("LIMIT")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("lock")
        .setLabel("LOCK")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("unlock")
        .setLabel("UNLOCK")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("claim")
        .setLabel("CLAIM")
        .setStyle(ButtonStyle.Primary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("permit")
        .setLabel("PERMIT")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("reject")
        .setLabel("REJECT")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("hide")
        .setLabel("HIDE")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("show")
        .setLabel("SHOW")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("transfer")
        .setLabel("TRANSFER")
        .setStyle(ButtonStyle.Primary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("owner")
        .setLabel("OWNER")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("blacklist")
        .setLabel("BLACKLIST")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("cpermit")
        .setLabel("CPERMIT")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("creject")
        .setLabel("CREJECT")
        .setStyle(ButtonStyle.Danger)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("permitted")
        .setLabel("PERMITTED")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("rejected")
        .setLabel("REJECTED")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("info")
        .setLabel("INFO")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("reset")
        .setLabel("RESET")
        .setStyle(ButtonStyle.Danger)
    ),
  ];

  const embed = new EmbedBuilder()
    .setTitle("Voice Channel Control Panel")
    .setDescription("Click buttons to manage your temporary voice channel")
    .setColor(0x5865f2)
    .setFooter({ text: "Good Night Tempt Interface" });

  await message.channel.send({
    embeds: [embed],
    components: rows,
  });
}

// Create temp voice channel
async function createTempVoice(guild, member, channelName) {
  const category = guild.channels.cache.find(
    (c) => c.name === "TEMPORARY VOICE" && c.type === 4
  );

  const channel = await guild.channels.create({
    name: channelName || `${member.user.username}'s room`,
    type: 2, // Voice channel
    parent: category || null,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionsBitField.Flags.Connect],
      },
      {
        id: member.id,
        allow: [
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.ManageChannels,
        ],
      },
    ],
  });

  tempChannels.set(channel.id, {
    owner: member.id,
    created: Date.now(),
  });

  return channel;
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Setup command
  if (message.content === `${prefix}setup`) {
    if (
      !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
      return message.reply("You need admin permissions to setup!");
    }

    // Create category
    const category = await message.guild.channels.create({
      name: "TEMPORARY VOICE",
      type: 4, // Category
    });

    // Create join-to-create channel
    await message.guild.channels.create({
      name: "Join to Create",
      type: 2, // Voice channel
      parent: category,
      permissionOverwrites: [
        {
          id: message.guild.id,
          allow: [PermissionsBitField.Flags.Connect],
        },
      ],
    });

    await createFullInterface(message);
    return message.reply("Temporary voice system setup complete!");
  }

  // Interface command
  if (message.content === `${prefix}interface`) {
    await createFullInterface(message);
    return;
  }

  // Help command
  if (message.content === `${prefix}help`) {
    const helpEmbed = new EmbedBuilder()
      .setTitle("Voice Channel Manager Help")
      .setDescription(
        "**Commands:**\n" +
          "`!setup` - Setup the system (admin only)\n" +
          "`!interface` - Show control panel\n" +
          "`!limit [number]` - Set user limit\n" +
          "`!lock`/`!unlock` - Lock/unlock channel\n" +
          "`!claim` - Claim ownership\n" +
          "`!permit @user` - Allow user to join\n" +
          "`!reject @user` - Block user from joining\n" +
          "`!hide`/`!show` - Hide/show channel\n" +
          "`!transfer @user` - Transfer ownership\n" +
          "`!info` - Channel information\n" +
          "`!reset` - Reset channel permissions"
      )
      .setColor(0x5865f2);

    return message.reply({ embeds: [helpEmbed] });
  }

  // Check if message is a command
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Voice channel where the user is currently in
  const voiceChannel = message.member?.voice.channel;

  // Helper function to check if user is in a voice channel
  async function checkVoiceChannel() {
    if (!voiceChannel) {
      await message.reply(
        "You need to be in a voice channel to use this command!"
      );
      return false;
    }
    return true;
  }

  // Helper function to check if user is channel owner
  async function isOwner() {
    if (!voiceChannel) return false;
    const channelData = tempChannels.get(voiceChannel.id);
    if (!channelData) {
      await message.reply(
        "This channel has no owner! Use `!claim` to become owner."
      );
      return false;
    }
    return channelData.owner === message.author.id;
  }

  // Command handlers
  switch (command) {
    case "limit":
      if (!(await checkVoiceChannel())) return;
      if (!(await isOwner())) return;
      const limit = parseInt(args[0]);
      if (isNaN(limit) || limit < 0 || limit > 99) {
        return message.reply("Please provide a valid number between 0-99!");
      }
      await voiceChannel.setUserLimit(limit);
      return message.reply(
        `Set user limit to ${limit === 0 ? "unlimited" : limit}`
      );
      break;

    case "lock":
      if (!(await checkVoiceChannel())) return;
      if (!(await isOwner())) return;
      await voiceChannel.permissionOverwrites.edit(message.guild.id, {
        Connect: false,
      });
      return message.reply("🔒 Channel locked!");
      break;

    case "unlock":
      if (!(await checkVoiceChannel())) return;
      if (!(await isOwner())) return;
      await voiceChannel.permissionOverwrites.edit(message.guild.id, {
        Connect: null,
      });
      return message.reply("🔓 Channel unlocked!");
      break;

    case "claim":
      if (!(await checkVoiceChannel())) return;
      if (tempChannels.has(voiceChannel.id)) {
        return message.reply("Channel already has an owner!");
      }
      tempChannels.set(voiceChannel.id, {
        owner: message.author.id,
        created: Date.now(),
      });
      return message.reply(`✅ You now own ${voiceChannel.name}`);
      break;

    case "permit":
      if (!(await checkVoiceChannel())) return;
      if (!(await isOwner())) return;
      const permitUser = message.mentions.users.first();
      if (!permitUser) return message.reply("Mention a user!");

      await voiceChannel.permissionOverwrites.edit(permitUser.id, {
        Connect: true,
      });
      return message.reply(`✅ ${permitUser} can now join`);
      break;

    case "reject":
      if (!(await checkVoiceChannel())) return;
      if (!(await isOwner())) return;
      const rejectUser = message.mentions.users.first();
      if (!rejectUser) return message.reply("Mention a user!");

      await voiceChannel.permissionOverwrites.edit(rejectUser.id, {
        Connect: false,
      });
      return message.reply(`❌ ${rejectUser} was rejected`);
      break;

    case "hide":
      if (!(await checkVoiceChannel())) return;
      if (!(await isOwner())) return;
      await voiceChannel.permissionOverwrites.edit(message.guild.id, {
        ViewChannel: false,
      });
      return message.reply("👻 Channel hidden");
      break;

    case "show":
      if (!(await checkVoiceChannel())) return;
      if (!(await isOwner())) return;
      await voiceChannel.permissionOverwrites.edit(message.guild.id, {
        ViewChannel: null,
      });
      return message.reply("👀 Channel visible");
      break;

    case "transfer":
      if (!(await checkVoiceChannel())) return;
      if (!(await isOwner())) return;
      const newOwner = message.mentions.users.first();
      if (!newOwner) return message.reply("Mention new owner!");

      tempChannels.set(voiceChannel.id, {
        owner: newOwner.id,
        created: tempChannels.get(voiceChannel.id).created,
      });
      return message.reply(`👑 Ownership transferred to ${newOwner}`);
      break;

    case "owner":
      if (!(await checkVoiceChannel())) return;
      if (!tempChannels.has(voiceChannel.id)) {
        return message.reply("This channel has no owner!");
      }
      const owner = await client.users.fetch(
        tempChannels.get(voiceChannel.id).owner
      );
      return message.reply(`👑 Owner: ${owner.tag}`);
      break;

    case "blacklist":
      if (!(await checkVoiceChannel())) return;
      if (!(await isOwner())) return;
      const blacklistedUser = message.mentions.users.first();
      if (!blacklistedUser) return message.reply("Mention a user!");

      // In a real implementation, you would add to database
      return message.reply(
        `⚠️ ${blacklistedUser} blacklisted (database required for persistence)`
      );
      break;

    case "cpermit":
      if (!(await checkVoiceChannel())) return;
      if (!(await isOwner())) return;

      for (const [memberId, member] of voiceChannel.members) {
        await voiceChannel.permissionOverwrites.edit(memberId, {
          Connect: true,
        });
      }
      return message.reply(
        `✅ Permitted all ${voiceChannel.members.size} members`
      );
      break;

    case "creject":
      if (!(await checkVoiceChannel())) return;
      if (!(await isOwner())) return;

      for (const [memberId, member] of voiceChannel.members) {
        await voiceChannel.permissionOverwrites.edit(memberId, {
          Connect: false,
        });
      }
      return message.reply(
        `❌ Rejected all ${voiceChannel.members.size} members`
      );
      break;

    case "permitted":
      if (!(await checkVoiceChannel())) return;
      const permitted = voiceChannel.permissionOverwrites.cache.filter(
        (overwrite) => overwrite.allow.has("Connect") && overwrite.type === 1
      );

      if (permitted.size === 0) {
        return message.reply("No specially permitted users");
      }

      const permittedList = await Promise.all(
        permitted.map(async (overwrite) => {
          const user = await client.users.fetch(overwrite.id);
          return user.tag;
        })
      );

      return message.reply(`✅ Permitted users:\n${permittedList.join("\n")}`);
      break;

    case "rejected":
      if (!(await checkVoiceChannel())) return;
      const rejected = voiceChannel.permissionOverwrites.cache.filter(
        (overwrite) => overwrite.deny.has("Connect") && overwrite.type === 1
      );

      if (rejected.size === 0) {
        return message.reply("No specially rejected users");
      }

      const rejectedList = await Promise.all(
        rejected.map(async (overwrite) => {
          const user = await client.users.fetch(overwrite.id);
          return user.tag;
        })
      );

      return message.reply(`❌ Rejected users:\n${rejectedList.join("\n")}`);
      break;

    case "info":
      if (!(await checkVoiceChannel())) return;
      const infoEmbed = new EmbedBuilder()
        .setTitle(`Channel Info: ${voiceChannel.name}`)
        .addFields(
          {
            name: "Owner",
            value: tempChannels.has(voiceChannel.id)
              ? `<@${tempChannels.get(voiceChannel.id).owner}>`
              : "None",
            inline: true,
          },
          {
            name: "Members",
            value: voiceChannel.members.size.toString(),
            inline: true,
          },
          {
            name: "User Limit",
            value: voiceChannel.userLimit
              ? voiceChannel.userLimit.toString()
              : "None",
            inline: true,
          },
          {
            name: "Created",
            value: tempChannels.has(voiceChannel.id)
              ? new Date(
                  tempChannels.get(voiceChannel.id).created
                ).toLocaleString()
              : "Unknown",
            inline: true,
          },
          {
            name: "Locked",
            value: voiceChannel.permissionsLocked ? "Yes" : "No",
            inline: true,
          },
          {
            name: "Hidden",
            value: voiceChannel
              .permissionsFor(message.guild.id)
              ?.has("ViewChannel")
              ? "No"
              : "Yes",
            inline: true,
          }
        )
        .setColor("#0099ff");

      return message.reply({ embeds: [infoEmbed] });
      break;

    case "reset":
      if (!(await checkVoiceChannel())) return;
      if (!(await isOwner())) return;

      await voiceChannel.permissionOverwrites.cache.forEach(
        async (overwrite) => {
          if (overwrite.id !== message.guild.id) {
            await voiceChannel.permissionOverwrites.delete(overwrite.id);
          }
        }
      );

      await voiceChannel.setUserLimit(0);
      await voiceChannel.permissionOverwrites.edit(message.guild.id, {
        Connect: null,
        ViewChannel: null,
      });

      return message.reply("♻️ Channel reset to default!");
      break;

    default:
      return message.reply("Unknown command! Use `!help` for commands list.");
  }
});

// Voice channel join/leave events
client.on("voiceStateUpdate", async (oldState, newState) => {
  // User joined a voice channel
  if (!oldState.channelId && newState.channelId) {
    const channel = newState.guild.channels.cache.get(newState.channelId);

    // If joined "Join to Create" channel
    if (channel.name === "Join to Create") {
      const tempChannel = await createTempVoice(
        newState.guild,
        newState.member
      );
      await newState.member.voice.setChannel(tempChannel);
    }
  }

  // User left a voice channel
  if (oldState.channelId && !newState.channelId) {
    const channel = oldState.guild.channels.cache.get(oldState.channelId);

    // Check if empty temp channel
    if (tempChannels.has(channel.id) && channel.members.size === 0) {
      await channel.delete();
      tempChannels.delete(channel.id);
    }
  }
});

// Button interactions
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const voiceChannel = interaction.member.voice.channel;

  // Helper function to check if user is in a voice channel
  async function checkVoiceChannel() {
    if (!voiceChannel) {
      await interaction.reply({
        content: "You need to be in a voice channel to use this button!",
        ephemeral: true,
      });
      return false;
    }
    return true;
  }

  // Helper function to check if user is channel owner
  async function isOwner() {
    if (!voiceChannel) return false;
    const channelData = tempChannels.get(voiceChannel.id);
    if (!channelData) {
      await interaction.reply({
        content: "This channel has no owner! Use `!claim` to become owner.",
        ephemeral: true,
      });
      return false;
    }
    return channelData.owner === interaction.user.id;
  }

  switch (interaction.customId) {
    case "limit":
      if (!(await checkVoiceChannel())) return;
      if (!(await isOwner())) return;
      await interaction.reply({
        content:
          "Please use the command `!limit [number]` to set the user limit (0-99).",
        ephemeral: true,
      });
      break;

    case "lock":
      if (!(await checkVoiceChannel())) return;
      if (!(await isOwner())) return;
      await voiceChannel.permissionOverwrites.edit(interaction.guild.id, {
        Connect: false,
      });
      await interaction.reply({
        content: "🔒 Channel locked!",
        ephemeral: true,
      });
      break;

    case "unlock":
      if (!(await checkVoiceChannel())) return;
      if (!(await isOwner())) return;
      await voiceChannel.permissionOverwrites.edit(interaction.guild.id, {
        Connect: null,
      });
      await interaction.reply({
        content: "🔓 Channel unlocked!",
        ephemeral: true,
      });
      break;

    case "claim":
      if (!(await checkVoiceChannel())) return;
      if (tempChannels.has(voiceChannel.id)) {
        await interaction.reply({
          content: "Channel already has an owner!",
          ephemeral: true,
        });
        return;
      }
      tempChannels.set(voiceChannel.id, {
        owner: interaction.user.id,
        created: Date.now(),
      });
      await interaction.reply({
        content: `✅ You now own ${voiceChannel.name}`,
        ephemeral: true,
      });
      break;

    // Add other button cases following the same pattern...

    default:
      await interaction.reply({
        content:
          "This button is not yet implemented! Try using the text command instead.",
        ephemeral: true,
      });
  }
});

client.login(process.env.DISCORD_TOKEN);
