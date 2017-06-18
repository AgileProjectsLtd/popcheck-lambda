'use strict';

//zip -r ../popcheck-lambda.zip *

process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT'];

var AWS = require('aws-sdk');
var async = require('async');
var parse = require('csv-parse/lib/sync');

var WORKER_LAMBDA_FUNCTION_NAME = 'addressLookup';
var REGION = 'eu-west-1';

var lambda = new AWS.Lambda({ region: REGION });
var s3 = new AWS.S3();

var rows = [];

function invokeWorkerLambda(task, callback) {
  var params = {
    FunctionName: WORKER_LAMBDA_FUNCTION_NAME,
    InvocationType: 'RequestResponse',
    Payload: JSON.stringify(task)
  };
  lambda.invoke(params, function(err, data) {
    if (err) {
      console.error(err, err.stack);
      callback(err);
    } else {
      callback(null, data.Payload);
    }
  });
}

function jsonToCSVCol(col) {
  if (typeof col !== 'string') { return col; }
  return (col.indexOf(',') !== -1) ? ('"' + col + '"') : col;
}
function jsonToCSVRow(row) {
  return row.map(jsonToCSVCol).join(',');
}
function jsonToCSV(arr) {
  return arr.map(jsonToCSVRow).join("\r");
}

function saveAddressesToS3(callback) {
  //callback(null);return;
  s3.putObject({
    ACL: 'bucket-owner-full-control',
    Bucket: process.env.S3_BUCKET_NAME,
    Key: process.env.S3_FILE_NAME,
    Body: jsonToCSV(rows),
    ContentType: 'text/csv'
  }, function(err, ret) {
    if (err) {
      callback(err);
    }
    else {
      callback(null);
    }
  });
}

function appendRow(num, response) {
  rows[num].push(response.success);
  if (response.success) {
    rows[num].push(response.lat);
    rows[num].push(response.lng);
    rows[num].push('');
  }
  else {
    rows[num].push('');
    rows[num].push('');
    rows[num].push(response.error);
  }
}

function lookupAddress(num, next) {
  if (num < rows.length) {
    if (isLookedUp(rows[num])) {
      lookupAddress(num + 1, next);
    }
    else {
      var address = createAddress(rows[num]);
      if (address === null) {
        appendRow(num, { success: false, error: "no valid address data" } );
        saveAddressesToS3(function() {
          lookupAddress(num + 1, next);
        });
      }
      else {
        invokeWorkerLambda({ address: createAddress(rows[num]) }, function(err, response) {
          if (err === null) {
            response = JSON.parse(response);
            appendRow(num, response);
          }
          else {
            appendRow(num, { success: false, error: "other error " + err });
          }
          saveAddressesToS3(function() {
            lookupAddress(num + 1, next);
          });
        });        
      }
    }
  }
  else {
    //done
    next(null);
  }
}

function createAddress(row) {
  if (row[4].length > 0) {
    return row[4];
  }
  else {
    var address = [];
    if (row[1].length > 0) { address.push(row[1]); }
    if (row[2].length > 0) { address.push(row[2]); }
    if (row[3].length > 0) { address.push(row[3]); }
    if (address.length === 0) {
      return null;
    }
    return address.join(', ');
  }
}

function isLookedUp(row) {
  return (row.length > 5) ? true : false;
}

exports.handler = function(event, context, callback) {
  async.waterfall([

    function getS3FileContents(next) {
      s3.getObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: process.env.S3_FILE_NAME
      }, function(err, ret) {
        if (err) {
          next(err);
        }
        else {
          let s3Data = ret.Body.toString('utf-8');
          next(null, s3Data);
        }
      });         
    },

    function lookupAddresses(csvData, next) {
      rows = parse(csvData, { trim: true, relax_column_count: true });
      console.log('Found ' + rows.length + ' rows');
      var lookedUp = 0;
      for (var i = 0; i < rows.length; i++) {
        lookedUp += (isLookedUp(rows[i]) ? 1 : 0);
      }
      console.log('Found ' + lookedUp + ' already looked up');
      lookupAddress(0, next);
    }

    ], function (err) {
      if (err) {
        console.log(JSON.stringify(err, null, 2));
        console.log("Error looking up : " + err.message);
      } else {
        //console.log("Success");
      }
      callback(null, "success");
    }
  );
};
