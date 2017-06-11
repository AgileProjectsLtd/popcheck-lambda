'use strict';

process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT'];

var AWS = require('aws-sdk');
var async = require('async');

var sqs = new AWS.SQS({region: process.env.AWS_SQS_REGION});

function receiveMessages(callback) {
  var params = {
    QueueUrl: process.env.AWS_SQS_QUEUE_URL,
    MaxNumberOfMessages: 1  //limit to 1 to get max execution time
  };
  sqs.receiveMessage(params, function(err, data) {
    if (err) {
      console.error(err, err.stack);
      callback(err);
    } else {
      callback(null, data.Messages);
    }
  });
}

function processMessage(message, callback) {

  async.waterfall([
  
    function checkMessage(next) {
      let body = JSON.parse(message.Body);
      if (!('Message' in body)) {
        //badly formed - error (triggers delete)
        next('Bad message format');
      }
      else {
        next(null);
      }
    },

    function getVisit(next) {
      let body = JSON.parse(message.Body);
      let visitUUID = body.Message; //payload is the visit uuid
      console.log(visitUUID);
      next(null)
    }

    //HERE: get visit from POPCheck with all attributes
    //Write to dbs

  ], function(err) {
      //try to delete
      sqs.deleteMessage({
        QueueUrl: process.env.AWS_SQS_QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle
      },
      function(e) {
        if (e) {
          console.log(e);
          callback(null, "error");
        }
        if (err) {
          console.log(err);
          callback(null, "error");
        }
        else {
          callback(null, "success");
        }

      });
    }
  );
}

function handleSQSMessages(context, callback) {

  receiveMessages(function(err, messages) {
    if (messages && messages.length > 0) {
      
      var promises = [];
      messages.forEach(function(message) {
        promises.push(function(callback) {
          processMessage(message, callback)
        });
      });

      async.parallel(promises, function(err) {
        if (err) {
          console.error(err, err.stack);
          callback(err);
        }
        else {
          if (context.getRemainingTimeInMillis() > 60000) { //check at least 60s left
            handleSQSMessages(context, callback); 
          }
          else {
            callback(null, "pause");
          }         
        }
      });
    }
    else {
      callback(null, "success");
    }
  });
}

exports.handler = function(event, context, callback) {
  if (event.hasOwnProperty('Messages') && event.Messages.length > 0) {
    //TESTING
    processMessage(event.Messages[0], callback);
  }
  else {
    handleSQSMessages(context, callback);
  }
};
