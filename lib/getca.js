/**
 * description: 从代码仓库中统计代码改动量,目前只计算了增加代码的行数
 * 2018-03-07: 决定用location.search的格式传参,所有参数都为非必填
 * @param {string} startTime 开始时间 2018-01-01T18:03:03
 * @param {string} endTime 结束时间
 * @param {string} author 修订的作者
 * @param {string} rType 仓库类型 git || svn 默认为svn
 * @param {string} tdNumber 提交记录msg中备注的TD号
 * @param {string} path 指定需要统计的路径
 * node code-counter.js 'startTime=2018-01-01T18:03:03&endTime=2018-02-01T18:03:03&author=yxw&rType=git&tdNumber=84566&path=ext/js'
 */
var exec = require('child_process').exec;
var fs = require('fs');
var args = process.argv;


function resultFormat(cfg, totalLines) {
	var result = '';
	if (cfg.startTime) {
		result += '从' + cfg.startTime + '开始,';
	}
	if (cfg.endTime) {
		if (cfg.startTime) {
			result += '至' + cfg.endTime + '结束,';
		} else {
			result += '截至' + cfg.endTime + ',';
		}
	}
	if (cfg.path) {
		result += '在路径 ' + cfg.path + ' 中'; 
	}
	if (cfg.author) {
		result += '作者：' + cfg.author + '提交的代码中,';
	}
	if (cfg.tdNumber) {
		result += '与TD' + cfg.tdNumber + '相关的,'
	}
	result += '共添加代码' + totalLines + '行'
	return result;
}

function GetSvnChangedCodeLines(cfg) {
	var handler = this;
	handler.cfg = cfg;
	handler.init(cfg);
}

GetSvnChangedCodeLines.prototype = {
	constructor: GetSvnChangedCodeLines,

	// 获取SVN日志的命令
	getSvnLogCmdStr: 'svn log',

	// 分隔符对应的正则
	singleLogSeparatorReg: /\s+\|\s+/,

	init: function (cfg) {
		var handler = this,
			getSvnLogCmdStr = handler.cmdStrHandler(cfg);
		exec(getSvnLogCmdStr, function (err, stdout, stderr) {
			var validLogArr,
				proArr = [],
				p,
				totalLines = 0,
				proObj,
				errFn = function (err) {
					console.log(err);
					process.exit();
				};
			if (err) {
				console.log('get svn log err:' + stderr);
			} else {
				validLogArr = handler.logFormat(stdout, cfg);
				validLogArr.forEach(function (v, i) {
					var r = validLogArr[i].r,
						lastR = r - 1,
						cmdStr = 'svn diff -r'+ lastR + ':' + r + ' --diff-cmd diff -x -d',
						recordArr,
						changedLines = 0,
						fn = function (resolve, reject) {
							setTimeout(function () {
								exec(cmdStr, {
									maxBuffer: 50000 * 1024
								}, function (err, stdout, stderr) {
									if (err) {
										console.log(err);
										reject(stderr);
									} else {
										recordArr = stdout.split(/\r*\n/);
										recordArr.forEach(function (v, i, arr) {
											if (v[0] === '>' && /\S/.test(v.substr(1))) {
												changedLines++;
											}
										});
										resolve(changedLines);
									}
								});
							}, 10000);
						};
					if (i === 0) {
						proObj = new Promise(fn);
					} else {
						proObj = proObj.then(function (lines) {
							console.log('r' + validLogArr[i - 1].r + '共改动' + lines + '行');
							totalLines += lines;
							return new Promise(fn);
						}, errFn);
					}
				});
				proObj.then(function (lines) {
					totalLines += lines;
					console.log('r' + validLogArr[validLogArr.length - 1].r + '共改动' + lines + '行');
					console.log(resultFormat(handler.cfg, totalLines));
				}, errFn);
			}
		});
	},

	/**
	 * 格式化SVN日志文本
	 * @param {string} logData 需要格式化的日志文本
	 * @return {array} 数组每个元素为单个修订号对应的日志数据
	 */
	logFormat: function (logData, cfg) {
		var handler = this,
			logArr = [],
			singleLogArr = [],
			singleLogObj,
			validLogArr = [],
			isAuthorMatch,
			isTdNumberMatch,
			separatorReg = /^\-{5,}$/;
		logArr = logData.split(/\r\n/),
		firstCommitTime = 0;
		logArr.forEach(function (v, i, arr) {
			if (i > 0
				&& separatorReg.test(arr[i - 1])
				&& handler.checkLogLine(v)) {
				isAuthorMatch = true;
				isTdNumberMatch = true;
				singleLogObj = {};
				singleLogArr = v.split(handler.singleLogSeparatorReg);
				singleLogObj.author = singleLogArr[1];
				singleLogObj.time = singleLogArr[2];
				singleLogObj.r = parseInt(singleLogArr[0].replace('r', ''), 10);
				if (cfg && cfg.author && cfg.author !== singleLogObj.author) {
					isAuthorMatch = false;
				}
				if (cfg
					&& cfg.tdNumber
					&& logArr[i + 2].indexOf(cfg.tdNumber) === -1) {
					isTdNumberMatch = false;
				}
				if (isAuthorMatch && isTdNumberMatch) {
					validLogArr.push(singleLogObj);
				}
			}
		});
		if (validLogArr.length > 0) {
			firstCommitTime = new Date(validLogArr[0].time).getTime() + 60*60*8*1000;
		}
		if (handler.cfg && handler.cfg.startTime &&
			(new Date(handler.cfg.startTime).getTime() > firstCommitTime)) {
			validLogArr.splice(0, 1);
		}
		return validLogArr;
	},

	/**
	 * 检测是否为有效的日志行
	 * @param {string} logLine 需要检测的日志行
	 * @return {boolean} 
	 */
	checkLogLine: function (logLine) {
		var handler = this;
		if (typeof logLine !== 'string') {
			return false;
		}
		return logLine.split(handler.singleLogSeparatorReg).length === 4;
	},

	/**
	 * 获取对应修订号改动的代码行数
	 * @param {number} revision 修订号
	 * @return {object} Promise对象
	 */
	getLinesByRevision: function (revision) {
		var r = revision,
		lastR = --revision,
		cmdStr = 'svn diff -r'+ lastR + ':' + r + ' --diff-cmd diff -x -d',
		recordArr,
		changedLines = 0;
		console.log(cmdStr);
		return new Promise(function (resolve, reject) {
			exec(cmdStr, {
				maxBuffer: 5000 * 1024
			}, function (err, stdout, stderr) {
				if (err) {
					console.log(err);
					reject(stderr);
				} else {
					recordArr = stdout.split(/\r*\n/);
					recordArr.forEach(function (v, i, arr) {
						if (v[0] === '>') {
							changedLines++
						}
					});
					resolve(changedLines);
				}
			});
		});
	}
}

function GetGitChangedCodeLines(cfg) {
	var handler = this;
	handler.cfg = cfg;
	handler.init(cfg);
}

GetGitChangedCodeLines.prototype = {
	constructor: GetGitChangedCodeLines,

	// 获取git日志的命令
	getGitLogCmdStr: 'git log --numstat --pretty=format:',

	init: function (cfg) {
		var handler = this,
			getGitLogCmdStr = handler.cmdStrHandler(cfg);
		exec(getGitLogCmdStr, {
				maxBuffer: 50 * 1024 * 1024 // 最大为50M
			}, function (err, stdout, stderr) {
			var totalAddedLines;
			if (err) {
				console.log('get git log err:' + stderr);
			} else {
				var logArr = stdout.split(/\r*\n+/);
				totalAddedLines = handler.getChangedLines(logArr);
				console.log(resultFormat(handler.cfg, totalAddedLines));
			}
		});
	},

	getChangedLines: function (logArr) {
		var totalLines = 0,
			singleLogArr,
			singleAddedLines;
		logArr.forEach(function (v, i, arr) {
			singleLogArr = v.split(/\t/);
			singleAddedLines = parseInt(singleLogArr, 10);

			// 不为NaN
			if (singleAddedLines === singleAddedLines) {
				totalLines += singleAddedLines;
			}
		});
		return totalLines;
	},

	cmdStrHandler: function (cfg) {
		var handler = this;
		if (!cfg) {
			return handler.getGitLogCmdStr;
		}
		if (cfg.startTime) {
			handler.getGitLogCmdStr += ' --since=' + cfg.startTime;
		}
		if (cfg.endTime) {
			handler.getGitLogCmdStr += ' --until=' + cfg.endTime;
		}
		if (cfg.author) {
			handler.getGitLogCmdStr += ' --author=' + cfg.author;
		}
		if (cfg.tdNumber) {
			handler.getGitLogCmdStr += ' --grep=' + cfg.tdNumber;
		}
		if (cfg.path) {
			handler.getGitLogCmdStr += ' -- ' + cfg.path;
		}
		return handler.getGitLogCmdStr;
	}
}

function GetChangedCodeLines(cfgStr) {
	var self = this;
	self.init(cfgStr);
}
GetChangedCodeLines.prototype = {
	constructor: GetChangedCodeLines,

	init: function (cfgStr) {
		var self = this,
			cfg = self.cfgHandler(cfgStr),
			validData = self.validator(cfg);
		if (validData.valid === true) {
			if (cfg.rType === 'git') {
				self.Handler = new GetGitChangedCodeLines(cfg);
			} else {
				self.Handler = new GetSvnChangedCodeLines(cfg);
			}
		} else {
			console.log(validData.msg.join('\n'));
			process.exit();
		}
	},

	timeReg: /^\d{4}-[01]{0,1}\d{1}-[0123]{0,1}\d{1}$/,
	completeTimeReg: /^\d{4}-[01]{0,1}\d{1}-[0123]{0,1}\d{1}T[012]{0,1}\d{1}(:[0-5]{1}\d{1}){2}$/,

	timeFormat: function (time) {
		var result = '';
		result = time.replace(/\-\d{1,2}\-/, function (v) {
			if (v.length === 3) {
				console.log(v);
				return v.replace(/\d/, function (num) {
					return '0' + num;
				});
			}
			return v;
		});
		result = result.replace(/(\-\d{1}$)||(\-\d{1}T)/, function (v) {
			return v.replace(/\d/, function (num) {
				return '0' + num;
			});
		});
		return result;
	},

	validator: function (cfg) {
		var handler = this,
			valid = true,
			msg = [];
		if (cfg.startTime) {
			if (handler.timeReg.test(cfg.startTime)) {
				cfg.startTime += 'T00:00:00';
			} else if (!handler.completeTimeReg.test(cfg.startTime)) {
				valid = false;
				msg.push('起始时间格式错误，正确的时间格式为：2018-01-01 || 2018-01-01T01:01:01');
			}
			cfg.startTime = handler.timeFormat(cfg.startTime);
		}
		if (cfg.endTime) {
			if (handler.timeReg.test(cfg.endTime)) {
				cfg.endTime += 'T23:59:59';
			} else if (!handler.completeTimeReg.test(cfg.endTime)) {
				valid = false;
				msg.push('结束时间格式错误，正确的时间格式为：2018-01-01 || 2018-01-01T01:01:01');
			}
			cfg.endTime = handler.timeFormat(cfg.endTime);
		}
		if (cfg.rType && cfg.rType !== 'svn' && cfg.rType !== 'git') {
			valid = false;
			msg.push('仓库类型错误，正确的仓库类型为: git || svn');
		}
		handler.cfg = cfg;
		return {
			valid: valid,
			msg: msg
		}
	},

	/**
	 * 处理传入的参数 
	 * @param {string} startTime 开始时间
	 * @param {string} endTime 结束时间
	 * @param {string} author 修订的作者
	 * @param {string} rType 仓库类型 git || svn
	 * @param {string || number} tdNumber 提交记录msg中备注的TD号
	 * @return {object}
	 */
	cfgHandler: function (cfgStr) {
		var handler = this,
			cfg = {},
			cfgArr,
			singleArgArr;
		if (!cfgStr) {
			return cfg;
		}
		cfgArr = cfgStr.split('&');
		cfgArr.forEach(function (v, i) {
			singleArgArr = v.split('=');
			cfg[singleArgArr[0]] = singleArgArr[1];
		});
		handler.cfg = cfg;
		return cfg;
	}
}

export default GetChangedCodeLines

new GetChangedCodeLines(args[2]);
