'use strict';

const log = require('intel').getLogger('browsertime.video');
const get = require('lodash.get');
const util = require('util');
const fs = require('fs');
const ffmpegRecorder = require('./ffmpegRecorder');
const convert = require('./convert');
const defaults = require('../../defaults');
const getViewPort = require('../../../support/getViewPort');
const screenOffsets = {
  linux: {
    firefox: { origin: '0,71', offset: { x: 0, y: 168 } },
    chrome: { origin: '0,66', offset: { x: 0, y: 66 } }
  },
  win32: {
    firefox: { origin: '0,71', offset: { x: 0, y: 168 } },
    chrome: { origin: '0,66', offset: { x: 0, y: 66 } },
    edge: { origin: '0,66', offset: { x: 0, y: 84 } }
  },
  darwin: {
    firefox: { origin: '0,71', offset: { x: 0, y: 80 } },
    chrome: { origin: '0,66', offset: { x: 0, y: 80 } },
    edge: { origin: '0,66', offset: { x: 0, y: 84 } },
    safari: { origin: '0,66', offset: { x: 0, y: 66 } }
  }
};
const unlink = util.promisify(fs.unlink);
const rename = util.promisify(fs.rename);

module.exports = class DesktopRecorder {
  constructor(options) {
    this.display = get(options, 'xvfbParams.display', defaults.xvfbDisplay);
    this.framerate = get(options, 'videoParams.framerate', defaults.framerate);
    this.nice = get(options, 'videoParams.nice', 0);
    this.crf = get(options, 'videoParams.crf', defaults.crf);
    this.convert = get(options, 'videoParams.convert', defaults.convert);
    this.viewPort = getViewPort(options);
    this.origin = screenOffsets[process.platform][options.browser].origin;
    this.offset = screenOffsets[process.platform][options.browser].offset;
    this.options = options;
  }

  async start(file) {
    this.filePath = file;

    this.recording = ffmpegRecorder.start({
      display: this.display,
      size: this.viewPort,
      filePath: this.filePath,
      origin: this.origin,
      offset: this.offset,
      framerate: this.framerate,
      crf: this.crf,
      nice: this.nice
    });

    return this.recording;
  }

  async stop(destination) {
    log.debug('Stop screen recording');
    await ffmpegRecorder.stop(this.recording);
    // FIXME update to rename/move file
    // The destination file could exixt of we use --resultDir
    // so make sure we remove it first
    if (this.options.resultDir) {
      try {
        await unlink(destination);
      } catch (e) {
        // Nothing to see here
      }
    }
    try {
      if (this.convert) {
        await convert(this.filePath, destination, this.crf);
        await unlink(this.filePath);
      } else {
        await rename(this.filePath, destination);
      }
    } catch (e) {
      log.error(
        'Converting the video failed. Converting from ' +
          this.filePath +
          ' to ' +
          destination
      );
      throw e;
    }

    log.debug(`Writing to ${destination}`);
  }
};
