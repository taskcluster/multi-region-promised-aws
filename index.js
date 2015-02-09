'use strict';

var aws = require('aws-sdk-promise');
var lodash = require('lodash');
var debug = require('debug')('multi-region-promised-aws');
var Promise = require('promise');

// TODO: allow for each region to have its own defaults and settings
function MultiAWS(nameOrConstructor, config, regions) {
  var that = this;
  this.apiObjs = {};

  var constructor;
  if (typeof nameOrConstructor === 'string') {
    // They all use upper case... right?
    if (Object.keys(aws).indexOf(nameOrConstructor) == -1) {
      throw new Error(nameOrConstructor + ' is not a valid Aws Product');
    constructor = aws[nameOrConstructor];
  } else if (typeof nameOrConstructor === 'function') {
    constructor = nameOrConstructor;
  } else {
    throw new Error('First argument must be a string or function');
  }
  
  if (config.region) {
    throw new Error('To avoid a footgun, your AWS config should not specify region');
  }

  regions.forEach(function(region) {
    if (typeof region !== 'string') {
      throw new Error(region + ' is not a string as it should be');
    }
    var regionCfg = lodash.defaults({region: region}, config);
    debug('Creating API object for region %s with config %s', region, regionCfg);
    that.apiObjs[region] = constructor(regionCfg);
  });

  if (apiObjs.length < 1) {
    throw new Error('No API Objects were created');
  }

  // Let's figure out which methods exist in this API so we know which ones to offer
  // Assume that all apis have the same selection of methods...
  var apiMethods = Object.keys(this.apiObjs[0].__proto__);

  apiMethods.forEach(function(name) {
    this[name] = function() {
      // Save the args to pass onto the API
      var args = Array.prototype.slice.call(arguments);

      // I'm not 100% sure that this .call thing is done right
      var regionPromises = regions.map(function(region) {
        return apiObjs[region][name].call(apiObj, args).promise(); 
      });

      // Make the request for each region
      var p = Promise.all(regionPromises)

      // Put everything into an region-keyed object
      p = p.then(function(res) {
        var result = {};
        regions.forEach(function(region, idx) {
          result[region] = res[idx];
        });
        return Promise.resolve(result);
      });

      return p;
    };
  });
}

module.exports = MultiAWS;
