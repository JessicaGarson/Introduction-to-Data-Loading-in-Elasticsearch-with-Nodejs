require('dotenv').config(); 
const { Client } = require('@elastic/elasticsearch');
const axios = require('axios');

const elasticCloudId = process.env.ELASTIC_CLOUD_ID;
const elasticApiKey = process.env.ELASTIC_API_KEY;
const nasaApiKey = process.env.NASA_API_KEY;

const client = new Client({
  cloud: { id: elasticCloudId },
  auth: { apiKey: elasticApiKey },
});

async function fetchNasaData() {
  const url = "https://api.nasa.gov/neo/rest/v1/feed";
  const today = new Date();
  const lastWeek = new Date(today);
  lastWeek.setDate(today.getDate() - 7);

  const startDate = lastWeek.toISOString().split('T')[0];
  const endDate = today.toISOString().split('T')[0];

  const params = {
    api_key: nasaApiKey,
    start_date: startDate,
    end_date: endDate,
  };

  try {
    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching data from NASA:', error);
    return null;
  }
}

function createStructuredData(response) {
  const allObjects = [];
  const nearEarthObjects = response.near_earth_objects;

  Object.keys(nearEarthObjects).forEach(date => {
    nearEarthObjects[date].forEach(obj => {
      const simplifiedObject = {
        close_approach_date: date,
        name: obj.name,
        id: obj.id,
        miss_distance_km: obj.close_approach_data.length > 0 ? obj.close_approach_data[0].miss_distance.kilometers : null,
      };

      allObjects.push(simplifiedObject);
    });
  });

  return allObjects;
}

async function run() {
  const rawData = await fetchNasaData();
  if (rawData) {
    const structuredData = createStructuredData(rawData);
    if (structuredData.length > 0) {
      await indexDataIntoElasticsearch(structuredData);
      console.log('Data indexed successfully.');
    } else {
      console.log('No data to index.');
    }
  } else {
    console.log('Failed to fetch data from NASA.');
  }
}

async function indexDataIntoElasticsearch(data) {
  const indexExists = await client.indices.exists({ index: 'node-js-video-nasa' });
  if (!indexExists.body) {
    await client.indices.create({
      index: 'node-js-video-nasa',
      body: {
        mappings: {
          properties: {
            close_approach_date: { type: 'date' },
            name: { type: 'text' },
            id: { type: 'keyword' },
            miss_distance_km: { type: 'float' },
          },
        },
      },
    });
  }

  const body = data.flatMap(doc => [{ index: { _index: 'node-js-video-nasa' } }, doc]);
  await client.bulk({ refresh: true, body });
}

run().catch(console.error);