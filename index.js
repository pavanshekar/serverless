const AWS = require('aws-sdk');
const axios = require('axios');
const { Storage } = require('@google-cloud/storage');
const mailgun = require('mailgun-js');

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const DOMAIN = process.env.MAILGUN_DOMAIN;
const mg = mailgun({ apiKey: process.env.MAILGUN_API_KEY, domain: DOMAIN });

exports.handler = async (event) => {
    let userEmail, fileName = "Error-PreProcessing";

    try {
        const message = JSON.parse(event.Records[0].Sns.Message);
        userEmail = message.userEmail;
        const submissionUrl = message.submissionUrl;

        const response = await axios({
            method: 'GET',
            url: submissionUrl,
            responseType: 'arraybuffer'
        });

        const decodedKey = Buffer.from(process.env.GCP_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8');
        const parsedKey = JSON.parse(decodedKey);

        const storage = new Storage({ credentials: parsedKey });
        const bucketName = process.env.GOOGLE_CLOUD_BUCKET;
        fileName = `github-release-${Date.now()}`;
        const bucket = storage.bucket(bucketName);
        const file = bucket.file(fileName);
        await file.save(response.data);

        await sendSuccessEmail(userEmail, fileName);
        await logToDynamoDB(userEmail, fileName, 'Email Sent');
        return { statusCode: 200, body: 'Process completed successfully.' };
    } catch (error) {
        console.error('Error processing event: ', error);
        await sendFailureEmail(userEmail, error.message);
        await logToDynamoDB(userEmail, fileName, 'Failed', error.message);
        return { statusCode: 500, body: 'Error processing request' };
    }
};

async function sendSuccessEmail(userEmail, fileName) {
    const emailData = {
        from: 'Download Status <downloads@demo.pavancloud.me>',
        to: userEmail,
        subject: 'GitHub Release Downloaded',
        text: `Your requested GitHub release has been downloaded and stored in Google Cloud Storage. File Name: ${fileName}`
    };
    await mg.messages().send(emailData);
}

async function sendFailureEmail(userEmail, errorMessage) {
    const emailData = {
        from: 'Download Status <downloads@demo.pavancloud.me>',
        to: userEmail,
        subject: 'GitHub Release Download Failure',
        text: `There was an error downloading your requested GitHub release: ${errorMessage}`
    };
    await mg.messages().send(emailData);
}

async function logToDynamoDB(userEmail, fileName, status, errorMessage = null) {
    const item = {
        email: userEmail,
        fileName: fileName,
        status: status
    };

    if (errorMessage) {
        item.errorMessage = errorMessage;
    }

    await dynamoDB.put({
        TableName: process.env.DYNAMODB_TABLE_NAME,
        Item: item
    }).promise();
}
