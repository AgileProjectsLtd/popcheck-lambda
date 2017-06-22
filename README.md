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

For POPCheck you can create an account by visiting [POPCheck](https://www.popcheckapp.com) and clicking on **Free Trial**.

For Amazon Web Services you'll need to create an account at [Amazon Web Services](https://aws.amazon.com). We're assuming you know the basics of AWS. If not, see tutorials like [AWS Getting Started](http://docs.aws.amazon.com/lambda/latest/dg/getting-started.html).


## Installing

Download the Lambda functions. Click 'Clone or Download' in GitHub or execute this command in the console, assuming you want to use ~/Development as your development directory

```
cd ~/Development
git clone https://github.com/AgileProjectsLtd/popcheck-lambda.git
```

### POPCheck API Access

You'll need to set up a user with API access to POPCheck. Steps:

1. Login to your account at [POPCheck](https://www.popcheckapp.com)
1. Click on your name in the top right and select *Team*
1. Click *Add New* and enter a name, email and password for the API user. Select *API Access* as the Role. Note that the email does not need to be valid - you can enter 'api@yourorganisation.com' as an example.
1. Keep a note of the email address and password. We'll use this later as *POPCHECK_API_EMAIL* and *POPCHECK_API_PASSWORD*.

If you're using queues, you'll also need your *Business ID* to allow us to send messages to your queue. This is available on the *Settings* page and will be a UUID like  a12a123a-1234-1aa1-1a1a-a12a1a12abcd.

### AWS Simple Queue Service (optional)
If you want to trigger updates from POPCheck events then you'll want to set up an SQS queue. This queue will subscribe to events from POPCheck. We'll use the visitsCompleted event as an example. Steps:

1. Click on *Create New Queue* in AWS SQS. Name the new queue *visitsCompleted*.
1. Accept the default *Standard Queue*
1. We suggest you change the *Message Retention Period* to 14 days (the maximum period at time of writing). This will allow your messages to queue up in the event of a failure somewhere in the system.
1. Change the *Receive Message Wait Time* to 20 seconds (the maximum). This enables 'long polling' and means you won't churn the CPU waiting for new messages to arrive. Note: the right Receive Message Wait Time depends on how you plan to trigger the lambda function.
1. Make a note of the queue ARN (Amazon Resource Name). It's something like arn:aws:sqs:eu-west-1:123456789012:visitsCompleted. We'll use this when we create the IAM policy. You'll also need to send us the ARN to subscribe to the relevant topic - details below.
1. Also make a note of the queue URL. It's something like https://sqs.eu-west-1.amazonaws.com/123456789012/visitsCompleted. We'll use this later as *AWS_SQS_QUEUE_URL*

#### Queue Permissions
You need to add a permission to let POPCheck post messages to your new queue. Steps for visitCompleted notifications:

1. Click on your queue and select *Queue Actions* and choose *Add a permission*
1. In the Add a Permission dialog box, select *Allow* for Effect, select *Everybody* (*) for Principal, and then select *SendMessage* from the Actions drop-down.
1. Click *Add Conditions (optional)*, select *ArnEquals* for Condition, select *aws:SourceArn* for Key, and paste in the Topic ARN for Value. The Topic ARN is arn:aws:sns:eu-west-1:705936070782:visitCompleted_&lt;Your Business ID&gt;. As an example: arn:aws:sns:eu-west-1:705936070782:visitCompleted_a12a123a-1234-1aa1-1a1a-a12a1a12abcd. Your Business ID is available on the Settings page of your POPCheck account.
1. Click *Add Condition* then *Save Changes*

More details on SQS permissions [here](http://docs.aws.amazon.com/sns/latest/dg/SendMessageToSQS.html#SendMessageToSQS.sqs.permissions).

#### Queue Subscription
You need to subscribe your queue to the relevant POPCheck topic. To do this simply send us the ARN and we'll create the subscription for the notifications you are interested in. Email your SQS ARN to support@agileprojects.com. Once we've created the subscription you'll need to confirm the subscription. To do this:

1. Go to SQS and click on your queue name
1. Click *Queue Actions* and select *View/Delete Messages* then *Start Polling*
1. There should be a single message in the queue. Click *More Details* then from the Message Details. Find the SubscribeURL from the Message Body and copy the long string.
1. Paste this string into a browser to confirm the subscription. This completes the subscription and you can now delete the subscription message from your queue.

### AWS Identity and Access Management
You need to create an AWS role with credentials to access the services you need. This is done using AWS's Identity and Access Management service (IAM). Typically the credentials needed are:

* Run AWS Lambda functions, including logging
* Receive and delete messages from AWS Simple Queue Service

We've created an example IAM policy with the relevant credentials [here](IAMPolicy.txt).

For the credentials we will use an AWS Role. Steps:

1. Go to IAM -> Roles -> *Create new role*
1. Under AWS Service Role select *AWS Lambda*
1. Don't select any policies in the Attach Policy screen - just click Next Step
1. Name the role - for example *popcheck_role* and click *Create role*
1. Now click on the role you've just created and click on *Inline Policies* then click to create an inline policy
1. Choose *Custom Policy* and click select. Enter a Policy Name like *popcheck_policy* then paste the credentials from [IAMPolicy.txt](IAMPolicy.txt) into the Policy Document
1. Edit the *SQS Resource* in the Policy Document to the SQS ARN you noted above. It should be something like arn:aws:sqs:eu-west-1:123456789012:visitsCompleted
1. Click *Validate Policy* to check your edits and then *Apply Policy*


### Deployment to AWS Lambda

Once you have checked the code over and made any edits you need to zip up the files. In the console run:

```
cd ~/Development/popcheck-lambda
zip -r ../popcheck-lambda.zip *
```

To create a new Lambda function in AWS follow these steps:

1. Go to AWS Lambda and click *Get Started Now* if this is your first visit or click *Create a Lambda function* if you've been before
1. Select *Blank Function*. Leave the triggers blank for now and click Next
1. Add a function name like popcheckVisitsCompleted. Select *Node.js 4.3* as the Runtime
1. Choose *Upload a .ZIP file* and select the file you created on your local machine called popcheck-lambda.zip
1. Change the Handler to be the name of the js file you are using. For example if you are using 'visitsCompleted.js' this becomes 'visitsCompleted.handler'
1. Choose the existing role you created called 'popcheck_role'
1. Leave all the other settings as their defaults and click Next
1. Click *Create function*

### Configuring

We use Environment Variables to store your sensitive data so it doesn't appear in any scripts. To set your environment variables click on the *Code* tab. Beneath your code you will see the *Environment variables* area. Enter the relevant environment variables for the script you are using:

* *POPCHECK_API_EMAIL* to the POP Check API email address
* *POPCHECK_API_PASSWORD* to the POP Check API password

* *AWS_SQS_REGION* to the AWS region you are using, like 'eu-west-1'
* *AWS_SQS_QUEUE_URL* (if relevant) to the AWS Simple Queue Service url that is subscribed to POPCheck event notifications. Example format https://sqs.eu-west-1.amazonaws.com/123456789012/visitsCompleted

* *DBS_SERVER* (if relevant) to your database server name
* *DBS_DATABASE* (if relevant) to your database name
* *DBS_USER* (if relevant) to a user with read access to your database
* *DBS_PASSWORD* (if relevant) to the user's password
* *DBS_TABLE_NAME* (if relevant) to the database table name you are using. Note: we also use other tables like *DBS_TABLE_NAME_VISITS*, *DBS_TABLE_NAME_RESPONSES* and *DBS_TABLE_NAME_PHOTOS* in some scripts.


### Testing

Lambda supports test scripts. We've created a json template [here](lambdaTestVisitCompleted.json) that will allow you to simulate a visitCompleted event. Click on Test and paste in this script. You'll need to edit the Message content to make the Visit UUID valid for your account. Get a valid Visit UUID by logging in to POPCheck, click on *Edit Visits* and then click on any visit. The Visit UUID is shown at the bottom of the screen. Paste this in to the script then click *Save and Test*.


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
