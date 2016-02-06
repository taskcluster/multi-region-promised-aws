'use strict';

var aws = require('aws-sdk-promise');
var lodash = require('lodash');
var Promise = require('promise');
var debug = require('debug')('aws');

/**
 * MultiAWS Objects mirror the objects provided by the upstream AWS SDK.
 * Each function returns a promise instead of completing a callback.
 * Because each AWS region is completely separate from all others, we need
 * to create a collection of upstream API objects.
 *
 * The MultiAWS constructor takes three arguments:
 *   - nameOrConstructor: This is either a string which corresponds to the API
 *                        requested, or a reference to the AWS SDK constructor.
 *                        Example: `'EC2'`, `multi-region-promised-aws.aws.EC2`
 *   - config: This configuration object is passed directly to each region's
 *             api object.  In order to ensure that things work as expected,
 *             you must not specificy the `region` key in this object.
 *   - regions: This is an Array which lits the set of regions that to run
 *              commands in.  APIs can be run in a subset of regions with the
 *              .inRegion() and .inRegions() methods.
 *
 * The promise resolution for api methods called in all configured regions
 * or in a list of regions is structured like this:
 *
 *   {us-west-2: {<aws_data_for_us-west-2>}, us-west-1: {<aws_data_for_us-west-1>}}
 *
 * The raw response object is not included in the resolution value
 *
 * Example:
 *     var Aws = require('multi-region-promised-aws');
 *     var aws = new Aws('EC2', {}, ['us-west-1', 'us-west-2', 'us-east-1']);
 *
 *     // Run this command in all regions
 *     aws.describeSpotPriceHistory({<AwsRequest>}).then(function(x) {
 *       console.log(x);
 *     });
 *     // x === {us-west-1: {}, us-west-2: {}, us-east-1: {}};
 *
 *     // Run this in two regions
 *     aws.describeSpotPriceHistory.inRegions(['us-west-1', 'us-west-2'], {<AwsRequest})
 *       .then(function(x) {
 *       console.log(x);
 *     });
 *     // x === {us-west-1: {}, us-west-2: {}};
 *
 *     // Run in a single region. NOTE: return value is API return value
 *     // without region-keyed wrapping object
 *     aws.describeSpotPriceHistory.inRegion('us-west-1', {<AwsRequest>}).then(function(x) {
 *       console.log(x);
 *     }
 *     // x === {}
 */
function MultiAWS(nameOrConstructor, config, regions) {
  var that = this;
  this.apiObjs = {};

  var constructor;
  if (typeof nameOrConstructor === 'string') {
    // They all use upper case... right?
    if (Object.keys(aws).indexOf(nameOrConstructor) == -1) {
      throw new Error(nameOrConstructor + ' is not a valid Aws Product');
    }
    constructor = aws[nameOrConstructor];
    MultiAWS[nameOrConstructor] = aws[nameOrConstructor];
  } else if (typeof nameOrConstructor === 'function') {
    constructor = nameOrConstructor;
  } else {
    throw new Error('First argument must be a string or function');
  }

  if (config.region) {
    throw new Error('To avoid a footgun, your AWS config should not specify region');
  }

  if (!Array.isArray(regions)) {
    throw new Error('Regions list must be an Array');
  }

  this.regions = regions;

  regions.forEach(function(region) {
    if (typeof region !== 'string') {
      throw new Error(region + ' is not a string as it should be');
    }
    var regionCfg = lodash.defaults({region: region}, config);
    that.apiObjs[region] = new constructor(regionCfg);
  });

  if (this.apiObjs.length < 1) {
    throw new Error('No API Objects were created');
  }

  // Let's figure out which methods exist in this API so we know which ones to offer
  // Assume that all apis have the same selection of methods...
  var apiMethods = Object.keys(this.apiObjs[regions[0]].__proto__).filter(function(x) {
    // We only want to work on functions
    return typeof that.apiObjs[regions[0]].__proto__[x] === 'function';
  });

  function runApiMethod(name, regions, args) {
    // I'm not 100% sure that this .call thing is done right
    var startTime = new Date();
    if (process.env.AWS_SUPER_DUPER_DEBUG) {
      debug('running %s in %j with args:\n%j', name, regions, args);
    } else {
      debug('running %s in %j', name, regions);
    }
    var regionPromises = regions.map(function(region) {
      var apiObj = that.apiObjs[region];
      debug('running %s in %s', name, region);
      return apiObj[name].apply(apiObj, args).promise(); 
    });

    // Should I throw because of completion
    var maxCmdTime = 1000 * 60 * 2; // 2 minutes
    var timeout = setTimeout(function() {
      debug('Multi-region aws has frozen');
      process.exit(-1);
    }, maxCmdTime);

    // Make the request for each region
    var p = Promise.all(regionPromises)

    // Put everything into an region-keyed object
    p = p.then(function(res) {
      var result = {};
      regions.forEach(function(region, idx) {
        if (process.env.AWS_SUPER_DUPER_DEBUG) {
          debug('completed %s in %s with result:\n%j', name, region, res[idx].data);
        } else {
          debug('completed %s in %s', name, region);
        }
        result[region] = res[idx].data;
      });
      return result;
    });

    p = p.then(function(x) {
      var endTime = new Date();
      var diff = (endTime - startTime);
      debug('completed %s in %j in %ds', name, regions, diff / 1000);
      clearTimeout(timeout);
      return x;
    });

    p = p.catch(function(x) {
      clearTimeout(timeout);
      debug('promise rejected in multi-aws-thingy: ' + name + ', ' + regions + ', ' + args);
      return new Promise.reject(x);
    });

    return p;
  };

  apiMethods.forEach(function(name) {
    that[name] = function() {
      // Save the args to pass onto the API
      var args = Array.prototype.slice.call(arguments);
      return runApiMethod(name, regions, args); 
    };

    that[name].inRegion = function(region) {
      var args = Array.prototype.slice.call(arguments, 1);

      var p = runApiMethod(name, [region], args);

      p = p.then(function(result) {
        var thisRegions = result[region];
        return thisRegions;
      });

      return p;
    }

    that[name].inRegions = function(regions) {
      var args = Array.prototype.slice.call(arguments, 1);
      return runApiMethod(name, regions, args);
    }
  });
}

MultiAWS.aws = aws;

module.exports = MultiAWS;
