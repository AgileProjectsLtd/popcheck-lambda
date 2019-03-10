'use strict';

//zip -r ../popcheck-lambda.zip *

process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT'];

var AWS = require('aws-sdk');
var https = require('https');
var sql = require('mssql');
const uuidv4 = require('uuid/v4');
var validator = require('validator');

var pool; //for database connection

const POP_CHECK_API_URL = 'a.popcheckapp.com';

var sqs = new AWS.SQS({region: process.env.AWS_SQS_REGION});

function JoinAndDelimit(obj) {
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

var GetPOPCheckToken = function() {

  return new Promise((resolve, reject) => {
    let params = {
      email: process.env.POPCHECK_API_EMAIL,
      password: process.env.POPCHECK_API_PASSWORD
    };

    let options = {
      host: POP_CHECK_API_URL,
      port: '443',
      path: '/v2/login',
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
        resolve(data.token);
      });
    });
    req.on('error', (e) => {
      reject(e.message);
    });
    req.write(JSON.stringify(params));
    req.end();
  });
}

var GetVisit = function(token, visitUUID) {

  return new Promise((resolve, reject) => {
    let options = {
      host: POP_CHECK_API_URL,
      port: '443',
      path: '/v2/visits/client/' + visitUUID + '?forceRequireSurveyQuestionSurveySectionPhotoTag=1',
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
          reject(data.error);
        }
        else {
          resolve(data);
        }
      });
    });
    req.on('error', (e) => {
      reject(e.message);
    });
    req.end();
  });
}

var WriteToDatabaseVisit = function(token, data) {

  return new Promise((resolve, reject) => {

    let visitFields = 'local_visit_id, visitUUID, reference, locationName, locationReference, locationUUID, campaignName, campaignReference, campaignUUID, clientName, clientReference, clientUUID, userName, userUUID, scheduleStartDate, scheduleEndDate, actualStartDate, actualEndDate, startLat, startLng, startAccuracy, endLat, endLng, endAccuracy';

    //generate unique local visit id (uuid in this case)
    const local_visit_id = uuidv4(); // ⇨ '416ac246-e7ac-49ff-93b4-f7e94d997e6b'

    var visit = [];
    visit.push(local_visit_id, data.uuid, data.reference, data.Location.name, data.Location.reference, data.Location.uuid, data.Campaign.name, data.Campaign.reference, data.Campaign.uuid, data.Campaign.Client.name, data.Campaign.Client.reference, data.Campaign.Client.uuid, data.User.name, data.User.uuid, data.scheduleStartDate, data.scheduleEndDate, data.actualStartDate, data.actualEndDate, data.startLat, data.startLng, data.startAccuracy, data.endLat, data.endLng, data.endAccuracy);
    visit = JoinAndDelimit(visit);

    var query = 'insert into ' + process.env.DBS_TABLE_NAME_VISITS + ' (' + visitFields + ') values (' + visit + ');';
    var request = new sql.Request(pool).query(query, (err, result) => {
      if (err) {
        console.log('Visit insert error');
        console.log(err);
        console.log(query);
      }
      resolve(local_visit_id);
    });
  });
}

var WriteToDatabaseResponses = function(token, data, local_visit_id) {

  return new Promise((resolve, reject) => {

    let responseFields = 'local_visit_id, visitUUID, surveySectionReference, surveySectionName, surveySectionSortOrder, surveyQuestionReference, surveyQuestionType, surveyQuestionSortOrder, surveyQuestion, answer';

    var responses1 = [];
    var responses2 = [];
    for (var i = 0; i < data.SurveyResponses.length; i++) {
      var sr = data.SurveyResponses[i];
      var response = [];
      response.push(local_visit_id, data.uuid, sr.SurveyQuestion.SurveySection.reference, sr.SurveyQuestion.SurveySection.name, sr.SurveyQuestion.SurveySection.sortOrder, sr.SurveyQuestion.reference, sr.SurveyQuestion.type, sr.SurveyQuestion.sortOrder, sr.SurveyQuestion.question, sr.answer);
      response = JoinAndDelimit(response);
      if (responses1.length < 1000) {
        responses1.push(response);
      }
      else {
        responses2.push(response);
      }
    }

    var query1 = 'insert into ' + process.env.DBS_TABLE_NAME_RESPONSES + ' (' + responseFields + ') values (' + responses1.join('),(') + ');';
    var query2 = 'insert into ' + process.env.DBS_TABLE_NAME_RESPONSES + ' (' + responseFields + ') values (' + responses2.join('),(') + ');';
    
    if (responses1.length == 0) {
      return resolve();
    }
    var request1 = new sql.Request(pool).query(query1, (err, result) => {
      if (err) {
        console.log('Responses1 insert error');
        console.log(err);
        console.log(query1);
      }

      if (responses2.length == 0) {
        return resolve();
      }
      var request2 = new sql.Request(pool).query(query2, (err, result) => {
        if (err) {
          console.log('Responses2 insert error');
          console.log(err);
          console.log(query2);
        }
        resolve();
      });
    });
  });
}

var WriteToDatabasePhotos = function(token, data, local_visit_id) {

  return new Promise((resolve, reject) => {

    let photoFields = 'local_visit_id, visitUUID, photoTagReference, photoTagName, photoTagPrefix, url, lat, lng, accuracy';

    let photos = [];
    for (var i = 0; i < data.Photos.length; i++) {
      let p = data.Photos[i];
      let photo = [];
      photo.push(local_visit_id, data.uuid, p.PhotoTag.reference, p.PhotoTag.name, p.PhotoTag.prefix, p.url, p.lat, p.lng, p.accuracy);
      photo = JoinAndDelimit(photo);
      photos.push(photo);
    }

    var query = 'insert into ' + process.env.DBS_TABLE_NAME_PHOTOS + ' (' + photoFields + ') values (' + photos.join('),(') + ');';

    if (photos.length == 0) {
      return resolve();
    }
    var request = new sql.Request(pool).query(query, (err, result) => {
      if (err) {
        console.log('Photos insert error');
        console.log(err);
        console.log(query);
      }
      resolve();
    });
  });
}

function ProcessMessage(visitUUID) {
  var token, data, localVisitId;

  return new Promise((resolve, reject) => {
    GetPOPCheckToken()
    .then(function(thisToken) {
      token = thisToken;
      return GetVisit(token, visitUUID);
    })
    .then(function(thisData) {
      data = thisData;
      return WriteToDatabaseVisit(token, data);
    })
    .then(function(thisLocalVisitId) {
      localVisitId = thisLocalVisitId;
      return WriteToDatabaseResponses(token, data, localVisitId);
    })
    .then(function() {
      return WriteToDatabasePhotos(token, data, localVisitId);
    })
    .then(function() {
      resolve();
    }, function(err) {
      reject(err);
    });
  });
}

exports.handler = function(event, context, callback) {

  context.callbackWaitsForEmptyEventLoop = false;

  var promises = [];
  //console.log(JSON.stringify(event, null, 2));
  if (!('Records' in event)) {
    return callback(null, 'successful empty SQS process ' + JSON.stringify(event, null, 2));
  }

  event.Records.forEach(function(record) {
    const body = JSON.parse(record.body);
    //console.log(body);
    if ('Message' in body && validator.isUUID(body.Message)) {
      promises.push(ProcessMessage(body.Message));
    }
  });

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
        return callback(null, 'failed SQS process ' + JSON.stringify(event, null, 2));
      }
      Promise.all(promises)
      .then(function() {
        return callback(null, 'successful SQS process ' + JSON.stringify(event, null, 2));
      }, function(err) {
        console.log(err);
        return callback(null, 'failed SQS process ' + JSON.stringify(event, null, 2));
      });
    }
  );

};
