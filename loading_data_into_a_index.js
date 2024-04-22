// Load environment variables from the .env file
require('dotenv').config();

// Import the Elasticsearch client and Axios for making HTTP requests
const { Client } = require('@elastic/elasticsearch');
const axios = require('axios');

// Retrieve Elasticsearch and NASA API keys from environment variables
const elasticEndpoint = process.env.ELASTIC_ENDPOINT;
const elasticApiKey = process.env.ELASTIC_API_KEY;
const nasaApiKey = process.env.NASA_API_KEY;

// Authenticate to Elasticsearch
const client = new Client({
  node: elasticEndpoint,
  auth: {
    apiKey: elasticApiKey
  }
})

// Asynchronously fetch data from NASA's NEO (Near Earth Object) Web Service
async function fetchNasaData() {
  // Define the base URL for the NASA API request
  const url = "https://api.nasa.gov/neo/rest/v1/feed";
  // Create Date objects for today and last week to define the query period
  const today = new Date();
  const lastWeek = new Date(today);
  lastWeek.setDate(today.getDate() - 7);

  // Format dates as YYYY-MM-DD for the API request
  const startDate = lastWeek.toISOString().split('T')[0];
  const endDate = today.toISOString().split('T')[0];

  // Setup the query parameters including the API key and date range
  const params = {
    api_key: nasaApiKey,
    start_date: startDate,
    end_date: endDate,
  };

  try {
    // Perform the GET request to the NASA API with query parameters
    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    // Log any errors encountered during the request
    console.error('Error fetching data from NASA:', error);
    return null;
  }
}

// Transform the raw data from NASA into a structured format for Elasticsearch
function createStructuredData(response) {
  const allObjects = [];
  const nearEarthObjects = response.near_earth_objects;

  // Iterate over each date's objects to extract and structure necessary information
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

// Asynchronously check for an index's existence in Elasticsearch and index data
async function indexDataIntoElasticsearch(data) {
  // Check if the 'nasa-node-js' index exists in the Elasticsearch database
  const indexExists = await client.indices.exists({ index: 'nasa-node-js' });
  if (!indexExists.body) {
    // If the index doesn't exist, create it with specified mappings
    await client.indices.create({
      index: 'nasa-node-js',
      body: {
        mappings: {
          properties: {
            id: { type: 'integer' },
            close_approach_date: { type: 'date' },
            name: { type: 'text' },
            miss_distance_km: { type: 'float' },
          },
        },
      },
    });
  }

  
  const body = data.flatMap(doc => [{ index: { _index: 'nasa-node-js', _id: doc.id } }, doc]);
  // Execute the bulk indexing operation
  await client.bulk({ refresh: true, body });
}

// Main function to run the process of fetching, structuring, and indexing data
async function run() {
  // Fetch data from NASA
  const rawData = await fetchNasaData();
  if (rawData) {
    // Structure the fetched data
    const structuredData = createStructuredData(rawData);
    // Print the number of records
    console.log(`Number of records being uploaded: ${structuredData.length}`);
    if (structuredData.length > 0) {
      // Index the structured data into Elasticsearch
      await indexDataIntoElasticsearch(structuredData);
      console.log('Data indexed successfully.');
    } else {
      console.log('No data to index.');
    }
  } else {
    console.log('Failed to fetch data from NASA.');
  }
}

// Run the main function and catch any errors
run().catch(console.error);
