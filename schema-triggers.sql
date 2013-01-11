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
