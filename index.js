const fs = require('node:fs/promises');
const fetch = require("node-fetch");
const nodePandoc = require("node-pandoc");

const now = new Date();
const region = 1; // EN

const urls = {
  "mainStories": "https://bestdori.com/api/misc/mainstories.5.json",
  "mainAssets": "https://bestdori.com/assets/en/scenario/main_rip/Scenariomain001.asset",
  "bandStories": "https://bestdori.com/api/misc/bandstories.5.json",
  "bandAssets": "https://bestdori.com/assets/en/scenario/band/001_rip/Scenarioremakestory-01.asset",
  "events": "https://bestdori.com/api/events/all.5.json",
  "eventStories": "https://bestdori.com/api/events/all.stories.json",
  "eventAssets": "https://bestdori.com/assets/en/scenario/eventstory"
};

const bands = {
  "1": "Poppin'Party",
  "2": "Afterglow",
  "3": "Hello, Happy World!",
  "4": "Pastel*Palettes",
  "5": "Roselia",
  "21": "Morfonica",
  "18": "RAISE A SUILEN",
  "45": "MyGO!!!!!"
};

const badChars = {
  "windows": /[\<\>\:\"\/\\\|\?\*]/g,
  "markdown": /([\\\*\_\<\>\(\)\#])/g
};

// fileExists()
// Check if file exists
const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch (ex) {
    return false;
  }
};

// mkdir()
// Create directory if it doesn't exist
const mkdir = async (dir) => {
  if (! await fileExists(dir)) {
    await fs.mkdir(dir);
  }
};

// cacheAsset()
// Download asset file if it doesn't exist and return the file contents
const cacheAsset = async (url, filePath) => {
  if (! await fileExists(filePath)) {
    const asset = await fetch(url).then(res => res.json());
    await fs.writeFile(filePath, JSON.stringify(asset));
  }
  return require(`./${filePath}`);
};

// processStory()
// Process a story
const processStory = (story) => {
  let storyData = "";
  for (snippet of story.snippets) {
    let data;
    switch (snippet.actionType) {
      case 1: // Dialogue
        data = story.talkData[snippet.referenceIndex];
        storyData += `**${data.windowDisplayName}:** ${data.body.replace(/[\n\r]/g, " ").replace(badChars.markdown, "\\$1")}\n\n`;
      break;
      case 6:
        data = story.specialEffectData[snippet.referenceIndex];
        switch (data.effectType) {
          case 8: // Titles
            if ((!storyData.endsWith("---\n\n") || !storyData.endsWith("--**\n\n")) && storyData != "") {
              storyData += "---\n\n";
            }
            storyData += `**-- ${data.stringVal.replace(badChars.markdown, "\\$1")} --**\n\n`;
            break;
        }
        break;
    }
  }
  return storyData;
};

const makeEpub = (path, title, data) => {
  const pandocArgs = ["-f", "markdown", "-t", "epub", "-o", `${path}/${title.replace(badChars.windows, "_").replace(/\.$/, "")}.epub`];
  nodePandoc(data, pandocArgs, (err, result) => {
    if (err) return console.error(err);
  });
};

(async () => {
  // Create initial file structure
  await mkdir("assets");
  await mkdir("Stories");

  // -- Main Stories --
  // ------------------
  console.log("Processing Main Stories");

  // -- Band Stories --
  // ------------------
  console.log("Processing Band Stories");

  // -- Event Stories --
  // -------------------
  console.log("Processing Event Stories");

  // Fetch event metadata
  const events = await fetch(urls.events).then(res => res.json());
  const eventStories = await fetch(urls.eventStories).then(res => res.json());

  // Create file structure for events
  await mkdir("Stories/Event Stories");

  // Loop through the list of events
  for (const [eventId, event] of Object.entries(events)) {
    let eventStoryData = "";

    // Some Band Story events 404 when trying to access them like normal
    // events for some reason
    // Bestdori doesn't distinguish normal events and Band Stories, so we
    // have to exclude them manually like some kind of pleb
    if ([41, 43, 46, 54, 57, 117, 125, 129, 135, 141, 147, 156, 165, 172, 235].includes(Number(eventId))) {
      continue;
    }

    // Only process events that have started
    if (event.startAt[region] != null && now >= new Date(Number(event.startAt[1]))) {
      try {
        console.log(`${eventId} - ${event.eventName[region]}`);
        // Create a folder for the event
        const assetBundle = `assets/${event.assetBundleName}`
        await mkdir(assetBundle);

        // Create story data
        eventStoryData += `% ${event.eventName[region].replace(badChars.markdown, "\\$1")}\n\n`;
        
        // Loop through the story chapters
        for (const story of eventStories[eventId].stories) {
          // Cache and load the data for each chapter
          const episode = await cacheAsset(`${urls.eventAssets}/event${eventId}_rip/Scenario${story.scenarioId}.asset`, `${assetBundle}/${story.scenarioId}.json`);

          // Add chapter title
          eventStoryData += `# ${story.caption[region]} - ${story.title[region].replace(badChars.markdown, "\\$1")}\n\n---\n\n`;

          // Process the story data
          eventStoryData += processStory(episode.Base);
        }

        // Create the epub file
        makeEpub("Stories/Event Stories", `${String(eventId).padStart(3, "0")} - ${event.eventName[region]}`, eventStoryData);
      } catch (ex) {
        console.error(ex);
      }
    }
  }
})();
