# Serverless

This serverless function is designed to automatically download GitHub releases, store them in Google Cloud Storage, and notify the user via email. It leverages various services including AWS Lambda, Amazon SNS, Amazon DynamoDB, Google Cloud Storage, and Mailgun.

## Overview

The Lambda function triggers on an SNS event containing information about a GitHub release. It downloads the release, stores it in Google Cloud Storage, logs the event in DynamoDB, and sends an email notification to the user about the download completion.

## Prerequisites

Before deploying this function, ensure you have:

- An AWS account with access to Lambda, SNS, and DynamoDB.
- A Google Cloud account with a configured storage bucket.
- A Mailgun account for sending email notifications.
- Node.js and npm installed for managing dependencies.

## Environment Variables

Set the following environment variables in your Lambda function:

- `MAILGUN_DOMAIN`: Your Mailgun domain.
- `MAILGUN_API_KEY`: Your Mailgun API key.
- `GCP_SERVICE_ACCOUNT_KEY`: Base64 encoded Google Cloud service account key.
- `GOOGLE_CLOUD_BUCKET`: Your Google Cloud Storage bucket name.
- `DYNAMODB_TABLE_NAME`: The name of your DynamoDB table.

## Deployment

Install dependencies:

```bash
npm install aws-sdk axios @google-cloud/storage mailgun-js
```

## Usage

To use this function:

1. Publish a message to the configured SNS topic with the following structure:

```json
{
  "submissionUrl": "<GitHub release URL>",
  "userEmail": "<User's email address>"
}
```

The Lambda function will process this event, download the release, store it in Google Cloud Storage, record the event in DynamoDB, and send an email notification to the user.

Error Handling
The function includes error handling and logging to capture and report any issues during the execution process.