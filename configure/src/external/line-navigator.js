/* https://github.com/anpur/line-navigator Anton Purin MIT 2016 */
var createFileWrapper = function () {
  function FileWrapper(file, encoding) {
    var self = this;

    self.readChunk = function (offset, length, callback) {
      //lastPosition = offset + length;
      var reader = new FileReader();

      reader.onloadend = function (progress) {
        var buffer;
        if (reader.result) {
          buffer = new Int8Array(reader.result, 0);
          buffer.slice = buffer.subarray;
        }
        callback(progress.err, buffer, progress.loaded);
      };

      reader.readAsArrayBuffer(file.slice(offset, offset + length));
    };

    self.decode = function (buffer, callback) {
      var reader = new FileReader();
      reader.onloadend = function (progress) {
        callback(progress.currentTarget.result);
      };
      if (typeof encoding !== "undefined") {
        reader.readAsText(new Blob([buffer]), encoding);
      } else {
        reader.readAsText(new Blob([buffer]));
      }
    };

    self.getSize = function () {
      return file.size;
    };
  }

  FileWrapper.prototype.isNode = function (file) {
    return (
      typeof module !== "undefined" &&
      module.exports &&
      typeof file === "string"
    );
  };

  FileWrapper.prototype.isHtml5File = function (file) {
    return typeof File !== "undefined" && file instanceof File;
  };

  return FileWrapper;
};

const FileWrapper = createFileWrapper();

/* https://github.com/anpur/line-navigator Anton Purin MIT 2016 */
var getLineNavigatorClass = function () {
  function LineNavigator(file, options) {
    var self = this;

    // options init
    options = options ? options : {};
    var encoding = options.encoding ? options.encoding : "utf8";
    var chunkSize = options.chunkSize ? options.chunkSize : 1024 * 4;
    var throwOnLongLines =
      options.throwOnLongLines !== undefined ? options.throwOnLongLines : false;
    var milestones = [];

    var wrapper = new FileWrapper(file, encoding);
    var oldFileSize = wrapper.getSize();

    var getFileSize = function (position) {
      return (oldFileSize =
        oldFileSize > position ? oldFileSize : wrapper.getSize(file));
    };

    var getProgressSimple = function (position) {
      var size = getFileSize(position);
      return Math.round((100 * position) / size);
    };

    self.readSomeLines = function (index, callback) {
      var place = self.getPlaceToStart(index, milestones);

      wrapper.readChunk(
        place.offset,
        chunkSize,
        function readChunkCallback(err, buffer, bytesRead) {
          if (err) return callback(err, index);

          var isEof = bytesRead < chunkSize;

          var chunkContent = self.examineChunk(buffer, bytesRead, isEof);
          if (chunkContent === undefined) {
            // Line is longer than a chunkSize
            if (bytesRead > 0) {
              if (throwOnLongLines) {
                return callback(
                  "Line " +
                    index +
                    " is longer than chunk size (" +
                    chunkSize +
                    ")",
                  index
                );
              } else {
                chunkContent = {
                  lines: 1,
                  length: bytesRead - 1,
                  noLineEnding: true,
                };
              }
            } else {
              return callback(
                "Line " +
                  index +
                  " is out of index, last available: " +
                  (milestones.length > 0
                    ? milestones[milestones.length - 1].lastLine
                    : "none"),
                index
              );
            }
          }

          var inChunk = {
            firstLine: place.firstLine,
            lastLine: place.firstLine + chunkContent.lines - 1,
            offset: place.offset,
            length: chunkContent.length + 1,
          };

          if (place.isNew) milestones.push(inChunk);

          var targetInChunk =
            inChunk.firstLine <= index && index <= inChunk.lastLine;

          if (targetInChunk) {
            var bomOffset =
              place.offset !== 0 ? 0 : self.getBomOffset(buffer, encoding);

            wrapper.decode(
              buffer.slice(bomOffset, inChunk.length),
              function (text) {
                var expectedLinesCount =
                  inChunk.lastLine - inChunk.firstLine + (isEof ? 2 : 1);

                var lines = text.split(self.splitLinesPattern);
                if (!isEof && !chunkContent.noLineEnding)
                  lines = lines.slice(0, lines.length - 1);
                if (index != inChunk.firstLine)
                  lines = lines.splice(index - inChunk.firstLine);

                callback(
                  undefined,
                  index,
                  lines,
                  isEof,
                  getProgressSimple(inChunk.offset + inChunk.length),
                  inChunk
                );
              }
            );
          } else {
            if (!isEof) {
              place = self.getPlaceToStart(index, milestones);
              wrapper.readChunk(place.offset, chunkSize, readChunkCallback);
            } else {
              return callback(
                "Line " +
                  index +
                  " is out of index, last available: " +
                  inChunk.lastLine,
                index
              );
            }
          }
        }
      );
    };

    self.readLines = function (index, count, callback) {
      if (count === 0) return callback(undefined, index, [], false, 0);

      var result = [];
      self.readSomeLines(
        index,
        function readLinesCallback(
          err,
          partIndex,
          lines,
          isEof,
          progress,
          inChunk
        ) {
          if (err) return callback(err, index);

          var resultEof = !isEof
            ? false
            : partIndex + lines.length <= index + count;

          result = result.concat(lines);

          if (result.length >= count || isEof) {
            result = result.splice(0, count);
            var progress = self.getProgress(
              inChunk,
              index + result.length - 1,
              getFileSize(inChunk.offset + inChunk.length)
            );
            return callback(undefined, index, result, resultEof, progress);
          }

          self.readSomeLines(partIndex + lines.length, readLinesCallback);
        }
      );
    };

    self.find = function (regex, index, callback) {
      self.readSomeLines(
        index,
        function readSomeLinesHandler(err, firstLine, lines, isEof, progress) {
          if (err) return callback(err);

          for (var i = 0; i < lines.length; i++) {
            var match = self.searchInLine(regex, lines[i]);
            if (match) return callback(undefined, firstLine + i, match);
          }

          if (isEof) return callback();

          self.readSomeLines(
            firstLine + lines.length + 1,
            readSomeLinesHandler
          );
        }
      );
    };

    self.findAll = function (regex, index, limit, callback) {
      var results = [];

      self.readSomeLines(
        index,
        function readSomeLinesHandler(err, firstLine, lines, isEof) {
          if (err) return callback(err, index);

          for (var i = 0; i < lines.length; i++) {
            var match = self.searchInLine(regex, lines[i]);
            if (match) {
              match.index = firstLine + i;
              results.push(match);
              if (results.length >= limit)
                return callback(undefined, index, true, results);
            }
          }
          if (isEof) return callback(undefined, index, false, results);

          self.readSomeLines(firstLine + lines.length, readSomeLinesHandler);
        }
      );
    };
  }

  LineNavigator.prototype.splitLinesPattern = /\r\n|\n|\r/;

  LineNavigator.prototype.getProgress = function (milestone, index, fileSize) {
    var linesInMilestone = milestone.lastLine - milestone.firstLine + 1;
    var indexNumberInMilestone = index - milestone.firstLine;
    var indexLineAssumablePosition =
      index !== milestone.lastLine
        ? milestone.offset +
          (milestone.length / linesInMilestone) * indexNumberInMilestone
        : milestone.offset + milestone.length;

    return Math.floor(100 * (indexLineAssumablePosition / fileSize));
  };

  LineNavigator.prototype.searchInLine = function (regex, line) {
    var match = regex.exec(line);
    return !match
      ? null
      : {
          offset: line.indexOf(match[0]),
          length: match[0].length,
          line: line,
        };
  };

  LineNavigator.prototype.getPlaceToStart = function (index, milestones) {
    for (var i = milestones.length - 1; i >= 0; i--) {
      if (milestones[i].lastLine < index)
        return {
          firstLine: milestones[i].lastLine + 1,
          offset: milestones[i].offset + milestones[i].length,
          isNew: i === milestones.length - 1,
        };
    }
    return { firstLine: 0, offset: 0, isNew: milestones.length === 0 };
  };

  // searches for line end, which can be \r\n (Windows) or \n (Unix)
  // returns line end postion including all line ending
  LineNavigator.prototype.getLineEnd = function (buffer, start, end, isEof) {
    var newLineCode = "\n".charCodeAt(0);
    var caretReturnCode = "\r".charCodeAt(0);

    for (var i = start; i < end; i++) {
      if (buffer[i] === newLineCode) {
        if (i !== end && buffer[i + 1] === 0) {
          return i + 1; // it is UTF16LE and trailing zero belongs to \n
        } else {
          return i;
        }
      }
    }
  };

  LineNavigator.prototype.examineChunk = function (buffer, bytesRead, isEof) {
    var lines = 0;
    var length = 0;

    do {
      var position = LineNavigator.prototype.getLineEnd(
        buffer,
        length,
        bytesRead,
        isEof
      );
      if (position !== undefined) {
        lines++;
        length = position + 1;
      }
    } while (position !== undefined);

    if (isEof) {
      lines++;
      length = bytesRead;
    }

    return length > 0 ? { lines: lines, length: length - 1 } : undefined;
  };

  var bomUtf8 = [239, 187, 191];
  var bomUtf16le = [255, 254];

  var arrayStartsWith = function (array, startsWith) {
    for (var i = 0; i < array.length && i < startsWith.length; i++) {
      if (array[i] !== startsWith[i]) return false;
      if (i == startsWith.length - 1) return true;
    }
    return false;
  };

  LineNavigator.prototype.getBomOffset = function (buffer, encoding) {
    switch (encoding.toLowerCase()) {
      case "utf8":
        return arrayStartsWith(buffer, bomUtf8) ? bomUtf8.length : 0;
      case "utf16le":
        return arrayStartsWith(buffer, bomUtf16le) ? bomUtf16le.length : 0;
      default:
        return 0;
    }
  };

  return LineNavigator;
};

export const LineNavigator = getLineNavigatorClass();
