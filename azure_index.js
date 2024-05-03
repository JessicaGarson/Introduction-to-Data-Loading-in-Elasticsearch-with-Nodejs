// Import necessary libraries: axios for HTTP requests, Elasticsearch client, and moment for date handling
const axios = require('axios');
const { Client } = require('@elastic/elasticsearch');
const moment = require('moment');

// The main function for the Azure Function that is triggered by a timer
module.exports = async function (context, myTimer) {
    // Log the current timestamp for when the function is triggered
    const timeStamp = new Date().toISOString();
    // Check if the timer is running late and log a warning if it is
    if (myTimer.isPastDue) {
        context.log('JavaScript is running late!');
    }
    context.log('JavaScript timer trigger function ran!', timeStamp);   

    // Connect to the Elasticsearch client using environment variables
    const elasticClient = connectToElastic();
    const indexName = 'nasa-node-js'; // Name of the Elasticsearch index

    try {
        // Fetch data from NASA's NEO (Near Earth Object) API
        const response = await connectToNasa();
        // Convert the fetched data into a format suitable for Elasticsearch
        const data = createDataArray(response);

        // Check if any data was fetched and proceed with updating Elasticsearch
        if (data.length > 0) {
            // Update Elasticsearch with the new data
            await updateElasticSearch(elasticClient, data, indexName);
            context.log('Data updated.');
        } else {
            // Log if no new data was found to update
            context.log('No new data to update.');
        }
    } catch (error) {
        // Log any errors that occur during the execution
        context.log('An error occurred:', error);
    }
};

// Connects to Elasticsearch using the provided endpoint and API key from environment variables
function connectToElastic() {
    const client = new Client({
        node: process.env.ELASTIC_ENDPOINT,
        auth: {
            apiKey: process.env.ELASTIC_API_KEY,
        },
    });
    return client;
}

// Fetch data from NASA's API using the specified start and end dates
async function connectToNasa() {
    const url = 'https://api.nasa.gov/neo/rest/v1/feed'; // Endpoint URL for the NASA NEO API
    const endDate = moment().format('YYYY-MM-DD'); // Today's date formatted as YYYY-MM-DD
    const startDate = moment().subtract(1, 'day').format('YYYY-MM-DD'); // Yesterday's date formatted as YYYY-MM-DD

    const params = {
        api_key: process.env.NASA_API_KEY, // NASA API key from environment variables
        start_date: startDate,
        end_date: endDate
    };
    // Perform the HTTP GET request to NASA's API
    const response = await axios.get(url, { params });
    return response.data;
}

// Convert the API response into an array of data objects suitable for indexing in Elasticsearch
function createDataArray(apiResponse) {
    // Flatten the nested JSON structure and extract necessary fields
    return Object.values(apiResponse.near_earth_objects).flat().map(obj => ({
        ...obj,
        close_approach_date: obj.close_approach_data[0].close_approach_date // Extract the close approach date
    }));
}

// Bulk update Elasticsearch with the prepared data
async function updateElasticSearch(client, data, indexName) {
    // Create bulk operations for each document to be indexed
    const operations = data.flatMap(doc => [{ index: { _index: indexName, _id: doc.id } }, doc]);
    // Execute the bulk update in Elasticsearch
    await client.bulk({ refresh: true, operations });
}
