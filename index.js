const AWS = require('aws-sdk');
const axios = require('axios');
const { Storage } = require('@google-cloud/storage');
const mailgun = require('mailgun-js');

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const DOMAIN = process.env.MAILGUN_DOMAIN;
const mg = mailgun({ apiKey: process.env.MAILGUN_API_KEY, domain: DOMAIN });

const storage = new Storage({
    credentials: JSON.parse(
        Buffer.from(process.env.GCP_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8')
    )
});

exports.handler = async (event) => {
    let userName, userEmail, fileName = "Error-PreProcessing";

    try {
        const message = JSON.parse(event.Records[0].Sns.Message);
        userName = message.userName;
        userEmail = message.userEmail;
        const submissionUrl = message.submissionUrl;

        const response = await axios({
            method: 'GET',
            url: submissionUrl,
            responseType: 'arraybuffer'
        });

        const bucketName = process.env.GOOGLE_CLOUD_BUCKET;
        fileName = `github-release-${Date.now()}`;
        const bucket = storage.bucket(bucketName);
        const file = bucket.file(fileName);
        await file.save(response.data);

        const downloadUrl = await generateSignedUrl(bucketName, fileName);

        await sendSuccessEmail(userEmail, userName, fileName, downloadUrl);

        await logToDynamoDB(userName, userEmail, fileName, 'Email Sent');

        return { statusCode: 200, body: 'Process completed successfully.' };

    } catch (error) {
        console.error('Error processing event: ', error);

        await sendFailureEmail(userEmail, userName, error.message);

        await logToDynamoDB(userName, userEmail, fileName, 'Failed', error.message);

        return { statusCode: 500, body: 'Error processing request' };
    }
};

async function generateSignedUrl(bucketName, fileName) {
    const options = {
        version: 'v4',
        action: 'read',
        expires: Date.now() + 1000 * 60 * 60,
    };

    try {
        const [url] = await storage.bucket(bucketName).file(fileName).getSignedUrl(options);
        return url;
    } catch (error) {
        console.error('Error generating signed URL: ', error);
        throw error;
    }
}

async function sendSuccessEmail(userEmail, userName, fileName, downloadUrl) {
    const emailData = {
        from: 'Download Status <downloads@pavancloud.me>',
        to: userEmail,
        subject: 'GitHub Release Downloaded',
        text: `Dear ${userName},\n\nYour requested GitHub release has been downloaded and stored in Google Cloud Storage. File Name: ${fileName}\nDownload Link: ${downloadUrl}\n\nRegards,\nAssignment Notifications Team`
    };
    await mg.messages().send(emailData);
}

async function sendFailureEmail(userEmail, userName, errorMessage) {
    const emailData = {
        from: 'Download Status <downloads@pavancloud.me>',
        to: userEmail,
        subject: 'GitHub Release Download Failure',
        text: `Dear ${userName},\n\nThere was an error downloading your requested GitHub release: ${errorMessage}\n\nRegards,\nAssignment Notifications Team`
    };
    await mg.messages().send(emailData);
}

async function logToDynamoDB(userName, userEmail, fileName, status, errorMessage = null) {
    const item = {
        name: userName,
        email: userEmail,
        fileName: fileName,
        status: status,
    };

    if (errorMessage) {
        item.errorMessage = errorMessage;
    }

    await dynamoDB.put({
        TableName: process.env.DYNAMODB_TABLE_NAME,
        Item: item
    }).promise();
}
