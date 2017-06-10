# POPCheck Lambda functions

Examples to demonstrate how to use AWS Lambda functions to integrate with the POPCheck API.

## Getting Started

These instructions will help you to:

* Download a copy of the Lambda functions to your local machine
* Edit the settings for your environment
* Upload to AWS Lambda
* (optional) Connect to a Simple Notification Service (SNS) notification  to trigger the Lambda function after specific POPCheck events such as a completed visit

### Prerequisites

You'll need an account with [POPCheck](https://www.popcheckapp.com) as well as an [Amazon Web Services](https://aws.amazon.com) account to make use of this code.

For POPCheck you'll need to set up a user with API access. Steps:

1. Login to your account at [POPCheck](https://www.popcheckapp.com)
1. Click on your name in the top right and select **Team**
1. Click **Add New** and enter a name, email and password for the API user. Select *API Access* as the Role. Note that the email does not need to be valid - you can enter 'api@yourorganisation.com' as an example
1. Keep a note of the email address and password. We'll use this later

For Amazon Web Services you'll need to create an account at [Amazon Web Services](https://aws.amazon.com). This isn't designed to be an AWS course. We're assuming you know about creating Lambda functions in AWS. If not, see tutorials like [AWS Getting Started](http://docs.aws.amazon.com/lambda/latest/dg/getting-started.html).


## Installing

Download the Lambda functions. Click 'Clone or Download' in GitHub or execute this command in the console

```
git clone https://github.com/AgileProjectsLtd/popcheck-lambda.git
```

### Configuring

Open the relevant Lambda function in a text editor make these edits:

* *API_EMAIL* to the POP Check API email address
* *API_PASSWORD* to the POP Check API password
* *SQS_QUEUE_URL* (if relevant) to the AWS Simple Queue Service url that is subscribed to POPCheck event notifications. Example format https://sqs.eu-west-1.amazonaws.com/123456789012/visitsCompleted

* *DBS_SERVER* (if relevant) to your database server name
* *DBS_DATABASE* (if relevant) to your database name
* *DBS_USER* (if relevant) to a user with read access to your database
* *DBS_PASSWORD* (if relevant) to the user's password

### Testing

//todo

### Deployment

//todo

## License

MIT License

Copyright (c) 2017 Agile Projects Ltd.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
