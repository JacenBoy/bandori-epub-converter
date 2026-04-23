const fetch = require("node-fetch");
const fs = require('node:fs/promises');

const jsonToCSV = (objArray) => {
  const stringToReplaceComas = '@@@@';
  
  // Extract headers from the first object
  const headers = Object.keys(objArray[0]).map(key => 
    String(key).replace(/"/g, '""').replace(/,/g, stringToReplaceComas)
  );
  
  // Convert array of objects to array of arrays
  const rows = objArray.map((obj) => {
    return Object.values(obj).map(value => 
      String(value).replace(/"/g, '""').replace(/,/g, stringToReplaceComas)
    )
  });

  // Combine headers with rows
  const allRows = [headers, ...rows];

  let csv = `"${allRows.join('"\n"').replace(/,/g, '","')}"`;
  csv = csv.replace(new RegExp(`${stringToReplaceComas}`, 'g'), ',');

  return csv;
};

(async () => {
  const eventList = [];

  const events = await fetch("https://bestdori.com/api/events/all.5.json").then(res => res.json());

  for (const [eventId, event] of Object.entries(events)) {
    eventList.push({"id": eventId, "name": event.eventName[1], "assetBundle": event.assetBundleName});
  }

  await fs.writeFile("eventList.json", JSON.stringify(eventList));
  await fs.writeFile("eventList.csv", jsonToCSV(eventList));
})();
