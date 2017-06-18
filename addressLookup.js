'use strict';

process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT'];

var AWS = require('aws-sdk');
var https = require('https');

function lookupAddress(address, callback) {

  let options = {
    host: 'maps.googleapis.com',
    path: '/maps/api/geocode/json?key=' + process.env.GOOGLE_API_KEY +'&address=' + address.split(' ').join('+'),
    method: 'GET'
  }
  var data = '';
  var req = https.request(options, function(res) {
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
      data += chunk;
    });
    res.on('end', function () {
      data = JSON.parse(data);
      if (data.status === 'OK') {
        callback(null, { success: true, lat: data.results[0].geometry.location.lat, lng: data.results[0].geometry.location.lng });
      }
      else if (data.status === 'ZERO_RESULTS') {
        callback(null, { success: false, error: 'not found' });        
      }
      else if (data.status === 'OVER_QUERY_LIMIT') {
        callback(null, { success: false, error: 'too many requests' });        
      }
      else {
        callback(data.status);
      }
    });
  });
  req.on('error', (e) => {
    callback(e.message)
  });
  req.end();
}

exports.handler = function(event, context, callback) {
  if (event.hasOwnProperty('address') && event.address.length > 0) {
    lookupAddress(event.address, callback);
  }
  else {
    callback("Address not set or blank");
  }
};
