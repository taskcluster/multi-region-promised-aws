[![Build Status](https://travis-ci.org/taskcluster/multi-region-promised-aws.svg?branch=master)](https://travis-ci.org/taskcluster/multi-region-promised-aws)
Make calls to multiple regions of AWS at the same time.  This library has logic
to configure a multi-region AWS api object which can run methods in all regions
it knows about or a specific subset of them.  Likewise, the results from the
API are joined.  The reason for both of these behaviours is that it’s
impossible to know which region to use or whether the results of a given api
call can be joined.  This library strives to make it easy to:

1. configure multiple AWS regions for a given AWS Product
2. make it easy to run calls in multiple AWS regions in parallel easy
3. return data in a region name keyed object

I’d sit here and write out how to use this library, but the much easier thing
to do is to load up the `test_works.js` file in the test directory and search
for multiAws.describeSpotPriceHistory.

You should already know this library enables you to spend money and kill
running instances.

USE AT YOUR OWN RISK.
