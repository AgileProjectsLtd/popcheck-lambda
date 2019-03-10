'use strict';

//zip -r ../popcheck-lambda.zip *

process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT'];

var AWS = require('aws-sdk');
var async = require('async');
var sql = require('mssql');

var pool; //for database connection

const POP_CHECK_API_URL = 'a.popcheckapp.com';

var sqs = new AWS.SQS({region: process.env.AWS_SQS_REGION});

function receiveMessages(callback) {
  var params = {
    QueueUrl: process.env.AWS_SQS_QUEUE_URL,
    MaxNumberOfMessages: 1,  //limit to 1 to get max execution time
    WaitTimeSeconds: 0
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

function joinAndDelimit(obj) {
  return obj.map(function(item) {
    if (item === null) {
      return 'NULL';
    }
    if (typeof item === 'string') {
      return ("'" + item.replace(/'/g, "") + "'");
    }
    else {
      return item;
    }
  }).join(',');
}

function processMessage(message, callback) {

  async.waterfall([
  
    function checkMessage(next) {
      let body = JSON.parse(message.Body);
      if (!('Message' in body)) {
        next('Bad message format');
      }
      else {
        next(null, body.Message);
      }
    },

    function writeToDatabaseVisit(visitUUID, next) {

      let visitFields = 'visitUUID';

      var visit = [];
      visit.push(visitUUID);
      visit = joinAndDelimit(visit);

      var query = 'insert into ' + process.env.DBS_TABLE_NAME_DELETED_VISITS + ' (' + visitFields + ') values (' + visit + ');';
      var request = new sql.Request(pool).query(query, (err, result) => {
        if (err) {
          console.log('Visit insert error');
          console.log(err);
          console.log(query);
        }
        next(null);
      });
    }

  ], function(err) {
      if (err) {
        console.log(err);
      }

      //try to delete whether error or not
      if (message.hasOwnProperty('ReceiptHandle')) {
        sqs.deleteMessage({
          QueueUrl: process.env.AWS_SQS_QUEUE_URL,
          ReceiptHandle: message.ReceiptHandle
        },
        function(e) {
          if (e) {
            console.log(e);
          }
          if (e || err) {
            callback(null, "error");
          }
          else {
            callback(null, "success");
          }
        });        
      }
      else {
        if (err) {
          callback(null, "error");
        }
        else {
          callback(null, "success");
        }        
      }
    }
  );
}

function handleSQSMessages(context, callback) {

  receiveMessages(function(err, messages) {
    if (messages && messages.length > 0) {
      
      var promises = [];
      messages.forEach(function(message) {
        promises.push(function(cb) {
          processMessage(message, cb);
        });
      });

      async.parallel(promises, function(err) {
        if (err) {
          console.error(err, err.stack);
          callback(err);
        }
        else {
          if (context.getRemainingTimeInMillis() > 10000) { //check at least 10s left
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
  //By default, the callback will wait until the Node.js runtime event loop is empty before freezing the process and returning the results to the caller
  context.callbackWaitsForEmptyEventLoop = false

  let config = {
    user: process.env.DBS_USER,
    password: process.env.DBS_PASSWORD,
    server: process.env.DBS_SERVER, 
    database: process.env.DBS_DATABASE
  };
  pool = new sql.ConnectionPool(config, 
    function(err) {
      if (err) {
        console.log(err);
        callback(err);
        return;
      }

      if (event.hasOwnProperty('Messages') && event.Messages.length > 0) {
        //TESTING
        processMessage(event.Messages[0], callback);
      }
      else {
        handleSQSMessages(context, callback);
      }
    }
  );
};
