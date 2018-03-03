'use strict';

//zip -r ../popcheck-lambda.zip *

process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT'];

var AWS = require('aws-sdk');
var async = require('async');
var https = require('https');
var sql = require('mssql');
const uuidv4 = require('uuid/v4');

var pool; //for database connection

const POP_CHECK_API_URL = 'api.popcheckapp.com';

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
      };
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
        next(e.message);
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
        path: '/v1.0/visits/client/' + visitUUID + '?forceRequireSurveyQuestionSurveySectionPhotoTag=1',
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token
        }
      };
      var data = '';
      var req = https.request(options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
          data += chunk;
        });
        res.on('end', function () {
          data = JSON.parse(data);
          if (data.hasOwnProperty('error')) {
            //console.log('error with visitUUID ' + visitUUID)
            next(data.error);
          }
          else {
            next(null, data);
          }
        });
      });
      req.on('error', (e) => {
        next(e.message);
      });
      req.end();
    },

    function writeToDatabaseVisit(data, next) {

      let visitFields = 'local_visit_id, visitUUID, reference, locationName, locationReference, locationUUID, campaignName, campaignReference, campaignUUID, clientName, clientReference, clientUUID, userName, userUUID, scheduleStartDate, scheduleEndDate, actualStartDate, actualEndDate, startLat, startLng, startAccuracy, endLat, endLng, endAccuracy';

      //generate unique local visit id (uuid in this case)
      const local_visit_id = uuidv4(); // ⇨ '416ac246-e7ac-49ff-93b4-f7e94d997e6b'

      var visit = [];
      visit.push(local_visit_id, data.uuid, data.reference, data.Location.name, data.Location.reference, data.Location.uuid, data.Campaign.name, data.Campaign.reference, data.Campaign.uuid, data.Campaign.Client.name, data.Campaign.Client.reference, data.Campaign.Client.uuid, data.User.name, data.User.uuid, data.scheduleStartDate, data.scheduleEndDate, data.actualStartDate, data.actualEndDate, data.startLat, data.startLng, data.startAccuracy, data.endLat, data.endLng, data.endAccuracy);
      visit = joinAndDelimit(visit);

      var query = 'insert into ' + process.env.DBS_TABLE_NAME_VISITS + ' (' + visitFields + ') values (' + visit + ');';
      var request = new sql.Request(pool).query(query, (err, result) => {
        if (err) {
          console.log(err);
        }
        next(null, local_visit_id, data);
      });
    },

    function writeToDatabaseResponses(local_visit_id, data, next) {
      let responseFields = 'local_visit_id, visitUUID, surveySectionReference, surveySectionName, surveySectionSortOrder, surveyQuestionReference, surveyQuestionType, surveyQuestionSortOrder, surveyQuestion, answer';

      var responses = [];
      for (var i = 0; i < data.SurveyResponses.length; i++) {
        var sr = data.SurveyResponses[i];
        var response = [];
        response.push(local_visit_id, data.uuid, sr.SurveyQuestion.SurveySection.reference, sr.SurveyQuestion.SurveySection.name, sr.SurveyQuestion.SurveySection.sortOrder, sr.SurveyQuestion.reference, sr.SurveyQuestion.type, sr.SurveyQuestion.sortOrder, sr.SurveyQuestion.question, sr.answer);
        response = joinAndDelimit(response);
        responses.push(response);
      }

      var query = 'insert into ' + process.env.DBS_TABLE_NAME_RESPONSES + ' (' + responseFields + ') values (' + responses.join('),(') + ');';
      
      if (responses.length) {
        var request = new sql.Request(pool).query(query, (err, result) => {
          if (err) {
            console.log(err);
            console.log(query);
          }
          next(err, local_visit_id, data);
        });
      }
      else {
          next(null, local_visit_id, data);        
      }
    },

    function writeToDatabasePhotos(local_visit_id, data, next) {
      let photoFields = 'local_visit_id, visitUUID, photoTagReference, photoTagName, photoTagPrefix, url, lat, lng, accuracy';

      let photos = [];
      for (var i = 0; i < data.Photos.length; i++) {
        let p = data.Photos[i];
        let photo = [];
        photo.push(local_visit_id, data.uuid, p.PhotoTag.reference, p.PhotoTag.name, p.PhotoTag.prefix, p.url, p.lat, p.lng, p.accuracy);
        photo = joinAndDelimit(photo);
        photos.push(photo);
      }

      var query = 'insert into ' + process.env.DBS_TABLE_NAME_PHOTOS + ' (' + photoFields + ') values (' + photos.join('),(') + ');';

      if (photos.length) {
        var request = new sql.Request(pool).query(query, (err, result) => {
          if (err) {
            console.log(err);
          }
          next(err, result);
        });
      }
      else {
        next(null);
      }
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
