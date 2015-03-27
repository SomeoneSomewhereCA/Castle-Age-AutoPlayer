/*jslint white: true, browser: true, devel: true, undef: true,
nomen: true, bitwise: true, plusplus: true,
regexp: true, eqeq: true, newcap: true, forin: false */
/*global window,escape,jQuery,$j,rison,utility,
$u,chrome,CAAP_SCOPE_RUN,self,
schedule,gifting,state,army, general,session,monster,guild_monster */
/*jslint maxlen: 256 */

/////////////////////////////////////////////////////////////////////
//                         Worker
/////////////////////////////////////////////////////////////////////

(function () {
    "use strict";

	window.worker = {};
	
	worker.list = [];
	worker.add = function(n) {
		var o = $u.isObject(n) ? n : {};
		
		o.name = $u.setContent(o.name, n);
		window[o.name] = $u.setContent(window[o.name], {});
		window[o.name].name = o.name;
		worker.list.addToList(o.name);
		if (o.recordIndex) {
			worker.addRecordFunctions(o);
		}
	};
	
	worker.recordsList = [];
	worker.addRecordFunctions = function(o) {
		try {
			o =  $u.isObject(o) ? o : {name: o};
			var wO = window[o.name]; // worker object
			worker.recordsList.addToList(o.name);
			wO.hBest = o.recordsAreObj ? 0 : 3;
			wO.recordIndex = $u.setContent(wO.recordIndex, o.recordIndex);
			
			wO.load = function() {
				var newR = new wO.record().data,
					arr = [];
				
				wO.records = gm.getItem(wO.name, 'default');
				if (!$j.isArray(wO.records)) {
					// Should be ok to remove old record lookup after completing conversion to new system - Artifice
					wO.records = gm.getItem(wO.name + '.records', 'default');
					if (!$j.isArray(wO.records)) { 
						con.warn(wO.name + ': No records found, and no old records either. Setting as blank.');
						wO.records = gm.setItem(wO.name, []);
					} else {
						con.warn(wO.name + ': Old records found and deleted.');
						wO.save();
						gm.deleteItem(wO.name + '.records');
					}
				} else {
					con.log(2, wO.name + ' records loaded', wO.records);
				}
				wO.records = wO.records.filter( function(r) {
					if ($u.isNumber(r[wO.recordIndex]) && wO.hasRecord(r[wO.recordIndex])) {
						arr.push(r[wO.recordIndex]);
						return false;
					} 
					return true;
				});
				if (arr.length) {
					con.warn(wO.name + ': Deleted number indexed record(s) for ' + arr.join(', ') + ', since conflicting with existing string record(s)');
					wO.doSave = true;
					arr = [];
				}
					
				wO.records.forEach( function(r, i) {
					if ($u.isNumber(r[wO.recordIndex])) {
						arr.push(r[wO.recordIndex]);
						r[wO.recordIndex] = r[wO.recordIndex].toString();
					}
					wO.records[i] = $j.extend(true, {}, newR, r);
				});
				if (arr.length) {
					con.warn(wO.name + ': Converted number indexed record(s) for ' + arr.join(', ') + ' to string record(s)');
					wO.doSave = true;
				}

				if ($u.isFunction(wO.dashboard) && caap.domain.which !== 0) {
					session.setItem(wO.name + 'DashUpdate', true);
				}
			};

			wO.save = function(src) {
				var newR = new wO.record().data,
					undefinedKeyList = [];
					
				wO.records.forEach( function(r, i) {
					Object.keys(r).forEach( function(e) {
						if (!Object.keys(newR).hasIndexOf(e)) {
							undefinedKeyList = undefinedKeyList.addToList(e);
							delete r[e];
						}
					});
				});
				undefinedKeyList.removeFromList('newRecord');
				if (undefinedKeyList.length) {
					con.warn(wO.name + ' warning: Keys not in record template will be deleted: ' + undefinedKeyList.join(', '), o);
				}
				if (caap.domain.which === 3) {
					caap.messaging.setItem(wO.name, wO.records);
				} else {
					gm.setItem(wO.name, wO.records, wO.hBest, false);
					if (caap.domain.which === 0 && caap.messaging.connected.hasIndexOf("caapif") && src !== "caapif") {
						caap.messaging.setItem(wO.name, wO.records);
					}
				}
				if ($u.isFunction(wO.dashboard) && caap.domain.which !== 0) {
					session.setItem(wO.name + 'DashUpdate', true);
				}
				wO.doSave = false;
			};
			
			wO.hasRecord = function(n) {
				return wO.records.hasObj(wO.recordIndex, n.toString());
			};

			wO.getRecord = function(n) {
				if (!$u.isString(n) && !$u.isNumber(n)) {
					con.error(wO.name + ' record index is not a number or string: ' + n);
					return false;
				}
				n = n.toString();
				var i = wO.records.getObjIndex(wO.recordIndex, n),
					r = new wO.record(n).data;
				if (i >= 0) {
					wO.records[i].newRecord = false;
					return $j.extend(true, {}, r, wO.records[i]);
				} else {
					r[wO.recordIndex] = n;
					r.newRecord = true;
					return r;
				}
			};

			wO.getRecordByField = function(f, v) {
				if (!$u.isString(f) ) {
					con.error(wO.name + ' field is not string: ' + f);
					return false;
				}
				var flat = wO.records.flatten(f),
					i = -1;
				if ($u.isRegExp(v)) {
					flat.some( function(e, ii) {
						i = e.match(v) ? ii : -1;
						return i >= 0;
					});
				} else {
					i = flat.indexOf(v);
				}
				
				if (i >= 0) {
					wO.records[i].newRecord = false;
					return $j.extend(true, {}, new wO.record().data, wO.records[i]);
				} else {
					return false;
				}
			};

			wO.setRecord = function(o) {
				var i = wO.records.getObjIndex(wO.recordIndex, o[wO.recordIndex].toString()),
					newR = new wO.record().data;
					
				o.newRecord = false;
				if (i >= 0) {
					wO.records[i] = o;
				} else {
					wO.records.push(o);
				}
				wO.doSave = true;
			};

			wO.getRecordVal = function(n, f, d) {
				var i = wO.records.getObjIndex(wO.recordIndex, n.toString());
				if (i == -1) {
					con.warn(wO.name.ucWords() + ' worker warning: record ' + n + ' not found');
					return d;
				}
				if (typeof wO.records[i][f] == 'undefined') {
					con.warn(wO.name.ucWords() + ' worker warning: record ' + n + ' field "' + f + '" is undefined', wO.records[i]);
					return d;
				}
				return wO.records[i][f];
			};

			wO.setRecordVal = function(r, f, v) {
				var n = ($u.isObject(r) ? r[wO.recordIndex] : r).toString();
				
				var i = wO.records.getObjIndex(wO.recordIndex, n),
					nr = new wO.record(n).data;

				wO.doSave = true;
				if (!Object.keys(nr).hasIndexOf(f)) {
					con.warn(wO.name.ucWords() + ' worker warning: field "' + f + '" not defined in record template');
				}
				if (i >= 0) {
					if ($u.isObject(r)) {
						r[f] = v;
						wO.records[i] = r;
					} else {
						wO.records[i][f] = v;
					}
					return true;
				}
				nr[wO.recordIndex] = n;
				nr[f] = v;
				wO.records.push(nr);
			};

			wO.deleteRecord = function(n) {
				var length = wO.records.length;
				wO.records = wO.records.deleteObjs(wO.recordIndex, n.toString());
				wO.doSave = true;
				return length - wO.records.length;
			};
        } catch (err) {
            con.error("ERROR in worker.addRecordFunctions: " + err.stack);
            return false;
        }
	};

	worker.actionsList = [];
	worker.addAction = function(o) {
		o.fName = $u.setContent(o.fName, o.worker + '.' + $u.setContent(o.functionName, 'worker'));
		o.worker = o.fName.regex(/(\w+)\./);
		o.functionName = o.fName.regex(/\.(\w+)/);
		worker.actionsList = worker.actionsList.deleteObjs('fName', o.fName);
		worker.actionsList.push(o);
	};

	worker.pagesList = [];
	worker.addPageCheck = function(o) {
		var i = worker.pagesList.getObjIndex('page', o.page);
		if (i >= 0) {
			o.hours = Math.min(o.hours, worker.pagesList[i].hours);
			worker.pagesList[i] = o;
			return;
		}
		worker.pagesList.push(o);
	};
	
	worker.deletePageCheck = function(o) {
		o = $u.isObject(o) ? o : {page : o};
		var key = Object.keys(o).shift();
		worker.pagesList = worker.pagesList.deleteObjs(key, o[key]);
	};
	
	worker.checkResults = function(r) {
		if ($u.isFunction(window[r].checkResults)) {
			window[r].checkResults(session.getItem('page'), caap.resultsText);
		}
	};
	
	worker.checkSave = function(r) {
		if (window[r].doSave) {
			window[r].save();
		}
	};
	
}());