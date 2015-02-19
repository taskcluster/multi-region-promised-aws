'use strict';
var subject = require('../index');

describe('constructor', function() {
  describe('should fail', function() {
    it('if first arg is not string or function', function() {
      (function() {new subject(1234, {}, ['us-west-2']) }).should.throw()
    });

    it('if config contains region key', function() {
      (function() {new subject('EC2', {region: 'failme'}, ['us-west-2']) }).should.throw()
    });

    it('if regions is not an array', function() {
      (function() {new subject('EC2', {}, 'moo') }).should.throw()
    });

    it('if no regions are specified', function() {
      (function() {new subject('EC2', {}, []) }).should.throw()
    });

    it('if first arg is falsy', function() {
      (function() {new subject(undefined, {}, []) }).should.throw()
    });

    it('if config is falsy', function() {
      (function() {new subject('EC2', undefined, []) }).should.throw()
    });

    it('if regions arg is falsy', function() {
      (function() {new subject('EC2', {}, undefined) }).should.throw()
    });
  
    it('if regions are not all strings', function() {
      (function() {new subject('EC2', {}, [1234]) }).should.throw()
    });
  });

  describe('when given valid arguments', function() {
    it('should create a single region object with string name', function() {
      var x = new subject('EC2', {maxRetries: 5}, ['us-west-2']); 
    });

    it('should create a single region object with a constructor', function() {
      var x = new subject(subject.EC2, {maxRetries: 5}, ['us-west-2']); 
    });

    it('should create a single region object with a constructor from aws', function() {
      var x = new subject(subject.aws.EC2, {maxRetries: 5}, ['us-west-2']); 
    });

    it('should create a multi region object', function() {
      var regions = ['us-west', 'us-west-2'];
      var x = new subject(subject.aws.EC2, {maxRetries: 5}, regions); 
      Object.keys(x.apiObjs).length.should.equal(regions.length);
    });
  });
});


describe('functionality', function() {
  var multiAws;
  var result;

  before(function() {
    multiAws = new subject(subject.EC2, {maxRetries: 5}, ['us-west-2', 'us-west-1']);
    // Rememer that promises need to maintain the same value
    result = multiAws.describeSpotPriceHistory({
      InstanceTypes: ['t1-micro'],
    });
  });

  it('should be able to make || calls with multiple regions', function () {
    return result.then(function(r) {
      result.should.be.an.Object;
      return r;
    });
  });

  ['us-west-1', 'us-west-2'].forEach(function(region) {
    it(region + ' should have a list of SpotPriceHistory', function() {
      return result.then(function(r) {
        r[region].should.have.a.property('SpotPriceHistory');
      });
    });
  });

  describe('using inRegions', function () {
    it('should allow using less than all configured regions', function() {
      var req = { InstanceTypes: ['t1-micro'] };
      var p = multiAws.describeSpotPriceHistory.inRegions(['us-west-2'], req);
      p = p.then(function(res) {
        res.should.be.an.Object;
        res.should.have.a.property('us-west-2');
        res.should.not.have.a.property('us-west-1');
      });
      return p;
    });

    it('should allow using a single region as a string', function() {
      var req = { InstanceTypes: ['t1-micro'] };
      var p = multiAws.describeSpotPriceHistory.inRegion('us-west-2', req);
      p = p.then(function(res) {
        res.should.be.an.Object;
        res.should.have.a.property('SpotPriceHistory');
        res.should.not.have.a.property('us-west-1');
        res.should.not.have.a.property('us-west-2');
      });
      return p;
    });
  });

});

