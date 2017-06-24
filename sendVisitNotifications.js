'use strict';

process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT'];

var AWS = require('aws-sdk');
var async = require('async');

var sns = new AWS.SNS();

function sendNotification(uuid, callback) {
  //AWS_SNS_TOPIC_ARN like 'arn:aws:sns:eu-west-1:705936070782:visitCompleted_1a123456-46c3-43f0-8ee4-495c0ebc1889'
  var params = {
    TopicArn: process.env.AWS_SNS_TOPIC_ARN,
    Message: uuid
  }
  sns.publish(params, function (err, data) {
    if (err) {
      callback(err);
    }
    else {
      //data like { ResponseMetadata: { RequestId: 'ade4b075-e0d3-56f5-9478-fd2da2e3bd9b' }, MessageId: '407f2746-2658-5178-9e44-6a1e64683a16' }
      callback(null, data);
    }
  });
}

exports.handler = function(event, context, callback) {
  if (!Array.isArray(event) || event.length === 0) {
    callback('no visit uuids found');
    return;
  }

  var promises = [];
  event.forEach(function(uuid) {
    promises.push(function(callback) {
      sendNotification(uuid, callback);
    });
  });

  async.parallel(promises, function(err) {
    if (err) {
      console.error(err, err.stack);
      callback(err);
    }
    else {
      callback(null, 'successfully sent ' + event.length + ' notifications');
    }
  });
};
