CREATE VIRTUAL TABLE logs_fts USING fts4(content='logs', msg);

INSERT INTO logs_fts(logs_fts) VALUES('rebuild');
