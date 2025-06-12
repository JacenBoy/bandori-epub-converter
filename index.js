const fs = require('node:fs/promises');
const fetch = require("node-fetch");
const nodePandoc = require("node-pandoc");

// Important constants
const now = new Date();
const region = 1; // EN

// Bestdori URLs
const urls = {
  "events": "https://bestdori.com/api/events/all.5.json",
  "eventStories": "https://bestdori.com/api/events/all.stories.json",
  "eventAssets": "https://bestdori.com/assets/en/scenario/eventstory"
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

(async () => {
  // Create initial file structure
  await mkdir("assets");
  await mkdir("Stories");

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
        const pandocArgs = ["-f", "markdown", "-t", "epub", "-o", `Stories/Event Stories/${String(eventId).padStart(3, "0")} - ${event.eventName[region].replace(badChars.windows, "_").replace(/\.$/, "")}.epub`];
        nodePandoc(eventStoryData, pandocArgs, (err, result) => {
          if (err) return console.error(err);
        });
      } catch (ex) {
        console.error(ex);
      }
    }
  }
})();
