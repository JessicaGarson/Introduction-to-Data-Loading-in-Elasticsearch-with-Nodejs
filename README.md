# Introduction to data loading in Elasticsearch with Node.js

This project is designed to upload Near Earth Object (NEO) data from NASA's API and index it into an Elasticsearch database. This process allows for easy searching and analysis of NEO data using the powerful features of Elasticsearch.

## Prerequisites

Before you can run this project, you'll need to have the following installed:

- [Node.js](https://nodejs.org/en)
- [npm](https://www.npmjs.com)
- [Elasticsearch](https://www.elastic.co/guide/en/elasticsearch/reference/current/getting-started.html)

Additionally, you'll need to have access to the NASA API, which requires an API key that can be obtained from [NASA APIs](https://api.nasa.gov).

## Setup

### Environment Setup

1. Clone the repository to your local machine.
2. Navigate to the project directory.
3. Run `npm install` to install the necessary packages:

    ```
    npm install @elastic/elasticsearch axios dotenv
    ```

### Configuration

Create a `.env` file in the root of the project directory. Check out the [example .env file](.env_example) to learn more.

## Running the Project

To run the project, execute the following command in the terminal:

```
node loading_data_into_a_index.js
```

## Getting help

Let us know if you need if this blog post inspires you to build anything or if you have any questions on our [Discuss forums](https://discuss.elastic.co/) and [the community Slack channel](https://communityinviter.com/apps/elasticstack/elastic-community).
