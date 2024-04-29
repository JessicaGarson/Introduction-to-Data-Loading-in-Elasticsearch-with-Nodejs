// Import required libraries
const { Client } = require('@elastic/elasticsearch');
const axios = require('axios');

// Azure Function triggered by a timer
module.exports = async function (context, myTimer) {
    const timeStamp = new Date().toISOString();
    context.log('JavaScript timer trigger function ran at', timeStamp);

    // Elasticsearch client setup
    const client = new Client({
        node: process.env.ELASTIC_ENDPOINT,
        auth: {
            apiKey: process.env.ELASTIC_API_KEY
        }
    });

    // Function to fetch data from NASA's API
    async function fetchNasaData() {
        const url = "https://api.nasa.gov/neo/rest/v1/feed";
        const today = new Date();
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);
        const startDate = lastWeek.toISOString().split('T')[0];
        const endDate = today.toISOString().split('T')[0];

        const params = {
            api_key: process.env.NASA_API_KEY,
            start_date: startDate,
            end_date: endDate,
        };

        try {
            const response = await axios.get(url, { params });
            return response.data;
        } catch (error) {
            context.log('Error fetching data from NASA:', error);
            return null;
        }
    }

    // Function to transform raw data for Elasticsearch
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

    // Function to index data into Elasticsearch
    async function indexDataIntoElasticsearch(data) {
        const body = data.flatMap(doc => [{ index: { _index: 'nasa-node-js', _id: doc.id } }, doc]);
        await client.bulk({ refresh: true, body });
    }

    // Main logic to run the process
    const rawData = await fetchNasaData();
    if (rawData) {
        const structuredData = createStructuredData(rawData);
        context.log(`Number of records being uploaded: ${structuredData.length}`);
        if (structuredData.length > 0) {
            await indexDataIntoElasticsearch(structuredData);
            context.log('Data indexed successfully.');
        } else {
            context.log('No data to index.');
        }
    } else {
        context.log('Failed to fetch data from NASA.');
    }
};