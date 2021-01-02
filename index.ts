import { Client, Guild, MessageAttachment, Presence } from "discord.js";
import { createReadStream } from "fs";
import * as csv from "csv-parser";
import {
  generateHTML,
  generateWebpageImage,
} from "./src/ImageGenerationService";
import { createObjectCsvWriter } from "csv-writer";

const client = new Client({
  // fetchAllMembers: true,
});

const readCurrentScore = () =>
  new Promise<{ GAME: string; SCORE: string }[]>((resolve, reject) => {
    const currentScores: { GAME: string; SCORE: string }[] = [];
    createReadStream("data.csv")
      .pipe(csv())
      .on("data", (data) => currentScores.push(data))
      .on("error", (error) => reject(error))
      .on("end", () => resolve(currentScores));
  });

const calculateGameScoreForGuild = async (guild: Guild) => {
  const members = await guild.members.fetch();

  const games = members
    .array()
    .filter(({ presence }) => presence.activities.length)
    .map(({ presence }) => presence.activities[0])
    .filter(({ name }) => name !== "Spotify" && name !== "Custom Status")
    .map(({ name }) => name)
    .reduce((currentScore, name) => {
      if (name in currentScore) currentScore[name]++;
      else currentScore[name] = 1;
      return currentScore;
    }, {} as { [key: string]: number });

  const currentScores = await readCurrentScore();

  let parsedScores = currentScores.reduce((a, { GAME, SCORE }) => {
    a[GAME] = parseInt(SCORE);
    return a;
  }, {} as { [key: string]: number });

  const finalScores = Object.entries(games).reduce((combined, [game, add]) => {
    if (game in combined) combined[game] += add * 5;
    else combined[game] = add * 5;
    return combined;
  }, parsedScores);

  const records = Object.entries(finalScores).map(([game, score]) => ({
    game,
    score,
  }));

  const writer = createObjectCsvWriter({
    path: "data.csv",
    header: [
      { id: "game", title: "GAME" },
      { id: "score", title: "SCORE" },
    ],
  });

  await writer.writeRecords(records);
};

client.on("ready", async () => {
  console.log("Bot online");

  const guild = await client.guilds.fetch("367755029408514058");

  setInterval(() => calculateGameScoreForGuild(guild), 1000 * 300);
});

client.on("message", async (message) => {
  if (message.guild === null) return;

  const [command, ...content] = message.content.split(" ");

  if (command === "|print") {
    const currentScore = await readCurrentScore();

    const filteredScore = currentScore
      .sort((a, b) => parseInt(b.SCORE) - parseInt(a.SCORE))
      .filter((_, i) => i < 5);

    const image = await generateWebpageImage(generateHTML(filteredScore));

    const attachment = new MessageAttachment(image);

    await message.channel.send(attachment);
  }
});

client.login("");
