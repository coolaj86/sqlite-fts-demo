/*jshint strict:true node:true es5:true onevar:true laxcomma:true laxbreak:true eqeqeq:true immed:true latedef:true*/
(function () {
  "use strict";

  var request = require('ahr2')
    , fs = require('fs')
    , path = require('path')
    , forEachAsync = require('forEachAsync')
    //, allText = []
    , dirname = process.argv[2] || './haskell-logs'
    , logs = [
          "haskell"
        //, "esoteric"
        //, "lisp"
      ]
    ;

  forEachAsync(logs, function (next, logname, n) {
    var logfile = logname + '-logs.txt'
      ;

    console.log('[%d] Get %s logs...', n, logname);
    request.get('http://tunes.org/~nef/logs/' + logname + '/').when(function (err, ahr2, data) {
      var dates = []
        ;

      data = data.toString('utf8');
      data.split('\n').forEach(function (line) {
        var m = /href="(\d\d\.\d\d\.\d\d)/.exec(line)
          ;
        if (m) {
          dates.push(m[1]);
        }
      });

      console.log('[%d] Got index of size %d for %s', n, dates.length, logname);

      // TODO different log folders
      if (!fs.existsSync(dirname)) {
        fs.mkdirSync(dirname);
      }
      forEachAsync(dates, function (next, date, i) {
        var logdateurl = 'http://tunes.org/~nef/logs/' + logname + '/' + date
          , filename = path.join(dirname, date)
          ;

        console.log(filename);
        if (fs.existsSync(filename)) {
          next();
          return;
        }

        request.get(logdateurl).when(function (err, ahr2, data) {
          data = data.toString('utf8');
          console.log('Got [' + i + ']', data.length, 'bytes', logdateurl);
          //allText.push(data);
          fs.writeFileSync(filename, data, 'utf8');
          console.log('Wrote %s', filename);
          next();
        });
      }).then(function () {
        console.log('Wrote all logs');
      });
    });
  });

}());
