/*jshint strict:true node:true es5:true onevar:true laxcomma:true laxbreak:true eqeqeq:true immed:true latedef:true*/
(function () {
  "use strict";

  var fs = require('fs')
    , path = require('path')
    , util = require('util')
    ;

  function sqlEscape(thing) {
    return thing.replace(/'/g, "''");
  }

  function addTexts(sqls, texts) {
    texts.forEach(function (line) {
      var m = /(\d\d:\d\d:\d\d) <(.+?)> (.*)/.exec(line)
        ;

      if (!m) {
        return;
      }

      sqls.push(
          "INSERT INTO logs (stamp, user, msg) VALUES ('"
        + sqlEscape(m[1])
        + "', '"
        + sqlEscape(m[2])
        + "', '"
        + sqlEscape(m[3])
        + "');"
      );
    });
  }

  function main(dirname, outfile) {
    var texts = []
      , sqls = []
      , logfiles
      , stream = fs.createWriteStream('data.sql')
      ;

    sqls.push('BEGIN TRANSACTION;');

    console.log('Reading...');
    logfiles = fs.readdirSync(dirname);
    logfiles.forEach(function (filename) {
      console.log(filename);
      texts = fs.readFileSync(path.join(dirname, filename), 'utf8').split(/\n/g);
      addTexts(sqls, texts);
      stream.write(sqls.join('\n'), 'utf8');
      sqls.length = 0;
    });

    sqls.push('END TRANSACTION;');

    console.log('ending write stream and sync-ing... (give it a minute or two)');
    stream.write(sqls.join('\n'), 'utf8');
    stream.end();
    stream.on('end', function () {
      console.log('done!');
    });
  }

  main(process.argv[2] || './haskell-logs', process.argv[3] || './data.sql');
}());
