'use strict';

process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT'];

var AWS = require('aws-sdk');
var async = require('async');
var https = require('https');
var sql = require('mssql')

const POP_CHECK_API_URL = 'api.popcheckapp.com';

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
        next('Bad message format');
      }
      else {
        next(null);
      }
    },

    function getPOPCheckToken(next) {

      let params = {
        email: process.env.POPCHECK_API_EMAIL,
        password: process.env.POPCHECK_API_PASSWORD
      };

      let options = {
        host: POP_CHECK_API_URL,
        port: '443',
        path: '/v1.0/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=UTF-8'
        }
      }
      var data = '';
      var req = https.request(options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
          data += chunk;
        });
        res.on('end', function () {
          data = JSON.parse(data);
          next(null, data.token);
        });
      });
      req.on('error', (e) => {
        next(e.message)
      });
      req.write(JSON.stringify(params));
      req.end();
    },

    function getVisit(token, next) {
      let body = JSON.parse(message.Body);
      let visitUUID = body.Message;

      let options = {
        host: POP_CHECK_API_URL,
        port: '443',
        path: '/v1.0/visits/client/' + visitUUID,
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token
        }
      }
      var data = '';
      var req = https.request(options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
          data += chunk;
        });
        res.on('end', function () {
          next(null, data);
        });
      });
      req.on('error', (e) => {
        next(e.message)
      });
      req.end();
    },

    function connectToDatabase(data, next) {
      let config = {
        user: process.env.DBS_USER,
        password: process.env.DBS_PASSWORD,
        server: process.env.DBS_SERVER, 
        database: process.env.DBS_DATABASE
      };
      var pool = new sql.ConnectionPool(config, 
        function(err) {
          next(err, data, pool);
        }
      );
    },

    function writeToDatabase(data, pool, next) {
      var request = new sql.Request(pool)
        .input('dataString', sql.VarChar(20000), data)
        .query('insert into ' + process.env.DBS_TABLE_NAME + ' (data) values (@dataString)', (err, result) => {
          next(err, result);
        });
    },

    function checkDatabaseResult(result, next) {
      //console.log(result);
      next(null);
    } 

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
  context.callbackWaitsForEmptyEventLoop = false

  if (event.hasOwnProperty('Messages') && event.Messages.length > 0) {
    //TESTING
    processMessage(event.Messages[0], callback);
  }
  else {
    handleSQSMessages(context, callback);
  }
};
