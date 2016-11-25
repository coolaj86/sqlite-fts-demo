Daplie is Taking Back the Internet!
--------------

[![](https://daplie.github.com/igg/images/ad-developer-rpi-white-890x275.jpg?v2)](https://daplie.com/preorder/)

Stop serving the empire and join the rebel alliance!

* [Invest in Daplie on Wefunder](https://daplie.com/invest/)
* [Pre-order Cloud](https://daplie.com/preorder/), The World's First Home Server for Everyone

# SQLite FTS (Full-Text Search) Demo

Full-Text Search is a super fast way to search large datasets with unstructured (or structured) text.

You can use it to search documents (IRC logs, PDFs), media metadata (think YouTube, Spotify),
and even serialized objects (JSON, XML).

SQLite-FTS3 and SQLite-FTS4 come bundled with SQLite and make full-text search relatively easy to implement.

For the demo, you'll need to start downloading [data.sql][haskell-irc-logs] now.

[haskell-irc-logs]: http://dropsha.re/files/6eUas.8/data.sql.bz2

I chose to use the logs of **#haskell on freenode.net** because it was
the largest dataset I chanced across (1.2GiB).
My scripts for downloading the logs and turning them into SQL are explained in the appendix.

# Part Θ: Pre-Requisits

  * Install the latest version of SQLite3 (>= 3.7.14)
    * Don't use the one that comes with OS X, no matter the version
  * Close your old terminal and open a new terminal after installing SQLite3

# Part I: Introduction

  * The Question - What's are the secarios?
  * The Problem - Why isn't plain-old SQL Good Enough (TM)?
  * The Solution - How FTS shines.

According to [Godwin's Law](http://en.wikipedia.org/wiki/Godwin's_law),
"As an online discussion grows longer,
the probability of a comparison involving Nazis or Hitler approaches 1."

Does this hold true for IRC chats?

> MS Windows = bad, Hitler = bad, Windows = Hitler!

## The Question

Let's say we have a very simple database for archiving a chat service
in which we store a timestamp, a username, and the text of each message.

```bash
sqlite3 ':memory:'
```

```sql
-- .read ./schema.sql
CREATE TABLE logs (
    stamp VARCHAR
  , user VARCHAR
  , msg TEXT
);
```

And now, for fun, we'll stick in a few random messages from #haskell.

```sql
-- .read ./data.sql -- small excerpt
INSERT INTO logs (stamp, user, msg) VALUES ('05:00:36', 'shapr', 'hi hi!');
INSERT INTO logs (stamp, user, msg) VALUES ('05:53:23', 'shapr', 'hi!');
INSERT INTO logs (stamp, user, msg) VALUES ('05:53:27', 'delYsid', 'hi');
INSERT INTO logs (stamp, user, msg) VALUES ('05:54:30', 'shapr', 'what''s up? :)');
INSERT INTO logs (stamp, user, msg) VALUES (
    '05:55:47'
  , 'delYsid'
  , 'I am sitting at work, having nothing todo, and my stumach hurts like someone gave me H2SO4 for breakfest'
);
INSERT INTO logs (stamp, user, msg) VALUES ('05:55:59', 'delYsid', 's/stumach/stomach/');
INSERT INTO logs (stamp, user, msg) VALUES ('05:56:00', 'shapr', 'hydrogen sulfate?');
```

We can do an old-school full-text search pretty easily.

```sql
-- everything in the default ouput format
SELECT * FROM logs;

-- everything in the original IRC log format
SELECT stamp || ' ' || '<' || user || '> ' || msg FROM logs;

-- just the messages that contain 'hi'
SELECT stamp || ' ' || '<' || user || '> ' || msg FROM logs WHERE msg LIKE '%hi%';
```

Wasn't that easy and fun?

## The Problem

For small datasets (like our first example),
any storage and search mechanism will work well.

Now let's import [data.sql][haskell-irc-logs] (it'll take a while) into our database.

```bash
git clone git://github.com/coolaj86/sqlite-fts-demo.git
cd sqlite-fts-demo
mv ~/data.sql.bz2 ./
sqlite3 ./archive.sqlite3 < ./schema.sql
bunzip2 data.sql.bz2 -c | sqlite3 ./archive.sqlite3
# for me time reports '145.21s user 3.33s system 115% cpu 2:08.70 total'
# (2 minutes is a fairly long time)
```

or if you already `bunzip2`'d the data.

```sql
.read ./schema.sql
.read ./data.sql
```

However, as you approach somewhere between 10,000 and 100,000 records,
you might notice your queries starting to run slower
(whole seconds, even minutes).

Think `O(n)` where `n` is REALLY Large.

Also, we can't do fancy regular expression matching for word boundaries and such.
`'%hi%'` matches '**hi**', 'not**hi**ng', '**hi**ll', etc.

All of the text is being treated as raw binary blob data.

So let's run a similar query:
```bash
sqlite3 ./archive.sqlite3 "SELECT COUNT(*) FROM logs WHERE msg LIKE '%nazi%';"
> 291
```

Timed as `4.46s user 0.30s system 99% cpu 4.762 total`

If you have a MacBook Pro with 16GiB RAM and the 1.5GiB database is still in your disk cache
then that query will take around 4.5 seconds.
If you're on a VPS with 512MiB RAM, it will take substantially longer.

## The Solution

Add a full-text search table - this will also take a while
(and mysteriously shrink the size of the DB, despite the added cost of indexes).

```sql
-- .read ./schema-fts.sql
CREATE VIRTUAL TABLE logs_fts USING fts4(content='logs', msg);
INSERT INTO logs_fts(logs_fts) VALUES('rebuild');
```

The `content='logs'` tells the `logs_fts` table not to store duplicates of the raw data,
but to defer to a lookup in the 'logs' table.

Now try the same search again:

```bash
sqlite3 ./archive.sqlite3 "SELECT COUNT(*) FROM logs_fts WHERE msg MATCH 'nazi';"
> 204

sqlite3 ./archive.sqlite3 "SELECT COUNT(*) FROM logs_fts WHERE msg MATCH '*nazi*';"
> 274
```

Now let's say that you want to search `logs_fts.msg`, but sort on `logs.timestamp`

```sql
SELECT logs.* FROM logs JOIN (
  SELECT docid, msg
    FROM logs_fts
    WHERE msg
    MATCH 'nazi'
    LIMIT 100
    OFFSET 0
  ) AS ftstable WHERE logs.rowid = ftstable.docid;
```

Both of these queries register `0.00s user 0.00s system 70% cpu 0.008 total` each.

Not only is it insanely fast, it's also more accurate in getting what I want.

Every non-word character is used as a delimeter and all of the words
are sorted and indexed in a binary search tree (or better)
So in order to show the true power of Full-Text Search we need some text...
and a lot of it!

Think `O(log(n))`.

# Part II: Reality Check

  * DELETES and UPDATES
  * ranking FTS results

## DELETES and UPDATES

In our example, the database is append-only - we'll never go back to update past records.

In the real world you would want the index to be updated whenever a row is updated,
otherwise when you query on the FTS table you'll get results for records that have
changed or no longer exist.

For example, let's say we live under the rule of a repressive government that wants to repress
the use of words such as 'nazi'. The government might run a query such as this:

```sql
DELETE FROM logs WHERE msg LIKE '%nazi%';
```

But when searching through the index, you'd see rows of empty (deleted) results.

```sql
SELECT COUNT(*) FROM logs_fts WHERE msg MATCH 'nazi';
SELECT * FROM logs_fts WHERE msg MATCH 'nazi';
```

It would be nice if such update triggers were automatic,
but at least they're not difficult to add:

```sql
-- .read ./schema-triggers.sql
CREATE TRIGGER logs_bu BEFORE UPDATE ON logs BEGIN
  DELETE FROM logs_fts WHERE docid=old.rowid;
END;
CREATE TRIGGER logs_bd BEFORE DELETE ON logs BEGIN
  DELETE FROM logs_fts WHERE docid=old.rowid;
END;

CREATE TRIGGER logs_au AFTER UPDATE ON logs BEGIN
  INSERT INTO logs_fts(docid, b, c) VALUES(new.rowid, new.b, new.c);
END;
CREATE TRIGGER logs_ai AFTER INSERT ON logs BEGIN
  INSERT INTO logs_fts(docid, b, c) VALUES(new.rowid, new.b, new.c);
END;

INSERT INTO logs_fts(logs_fts) VALUES('rebuild');
```

**NOTE**: That last franken-SQL statement with `rebuild` takes a while
but fixes fixes any problems with deleted or updated records and their indices.

```sql
SELECT COUNT(*) FROM logs_fts WHERE msg MATCH 'nazi';
```

## Ranking FTS results

The next problem is that the built-in FTS functions have no way to rank results.
Every result that matches at all is considered equal.

Let's say we want to know what haskellers thing is really hot right now (or at least very cool)
- and we'll explicitly stub in `1 AS rank` for now to illustrate how we'll fix this later:

```sql
SELECT logs.* FROM logs JOIN (
  SELECT docid, msg, 1 AS rank
    FROM logs_fts
    WHERE msg
    MATCH '(really OR very) AND (hot OR cool)'
    ORDER BY rank DESC
    LIMIT 100
    OFFSET 0
  ) AS ranktable WHERE logs.rowid = ranktable.docid
ORDER BY ranktable.rank DESC;
```

There's a lot of random results in there (and some of them are just about the weather).

So how do we specify that message like the first two are more interesting than the third?

Ex 1:

> lambdabot is really very cool

Ex 2:

> New Zealand is very cool.  Err, hot.

Ex 3:

> cool, that's really close.

Also, even if you've read the section on
[Full-text Index Queries](http://www.sqlite.org/fts3.html#section_3),
you'll find that the FTS Query language doesn't behave as you expect.
Try the same query as above with either of these MATCH statements:

```sql
-- NEAR only operates on phrases, not expressions
MATCH '(really OR very) NEAR/3 (hot OR cool)'
-- OR can't operate on phrases
MATCH '"really hot" OR "very hot" OR "really cool" OR "very cool"'
```

## 

# Node SQLite3 Query
  
```javascript
(function () {
  "use strict";
}());
```

# Appendix

## logs of #haskell on irc.freenode.net

You can download all of the logs from 2001 to 2010 in a single zip file:

    wget http://tunes.org/\~nef/logs/old/haskell.zip
    unzip haskell.zip -d ./haskell-logs/

The logs for 2011+ are available individually,
but I've included a script to download them as well:

    node bin/download-new-logs ./haskell-logs/
    
There's also a script to translated all of the logs into SQL as a single transaction
(surrounded by `BEGIN TRANSACTION` and `END TRANSACTION`).

It's important that the data.sql begin with
otherwise it will take years to import the data.

    node bin/sqlitize-logs ./haskell-logs/ ./data.sql

Finally the logs can be imported into the database:

    sqlite3 haskell-irc-example.sqlite < ./schema.sql
    sqlite3 haskell-irc-example.sqlite < ./data.sql

