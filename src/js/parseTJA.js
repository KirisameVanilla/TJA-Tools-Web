import { arrayLCM, addZero } from './common';

export function difficultyTypeToString(difficultyType) {
    switch (difficultyType) {
        case 0:
            return '<span lang="en">Easy</span><span lang="ja">かんたん</span>';
        case 1:
            return '<span lang="en">Normal</span><span lang="ja">ふつう</span>';
        case 2:
            return '<span lang="en">Hard</span><span lang="ja">むずかしい</span>';
        case 3:
            return '<span lang="en">Oni</span><span lang="ja">おに</span>';
        case 4:
            return '<span lang="en">Edit</span><span lang="ja">おに裏</span>';
    }
    return 'Unknown';
}

function parseCourseValue(courseValue) {
    switch (courseValue.toLowerCase()) {
        case 'easy': case '0':
            return 0;

        case 'normal': case '1':
            return 1;

        case 'hard': case '2':
            return 2;

        case 'oni': case '3':
            return 3;

        case 'edit': case 'ura': case '4':
            return 4;
    }
    return null;
}

function parseStyleValue(styleValue) {
    const intValue = parseInt(styleValue, 10);
    if (!isNaN(intValue) && intValue >= 1) {
        return intValue;
    }
    switch (styleValue.toLowerCase()) {
        case 'single':
            return 1;

        case 'couple': case 'double':
            return 2;
    }
    return null;
}

function noteSymbolToNoteType(noteSymbol) {
    switch (noteSymbol) {
        case '0':
            return 'blank';

        case '1':
            return 'don';

        case '2':
            return 'kat';

        case '3':
        case 'A':
            return 'donBig';

        case '4':
        case 'B':
            return 'katBig';

        case '5':
            return 'renda';

        case '6':
            return 'rendaBig';

        case '7':
            return 'balloon';

        case '9':
            return 'balloonEx';

        case 'C':
            return 'mine';

        case 'D':
            return 'fuse';

        case 'F':
            return 'adlib';

        case 'G':
            return 'kadon';
    }
    return null;
}

export function isRollType(noteType) {
    switch (noteType) {
        case 'renda':
        case 'rendaBig':
        case 'balloon':
        case 'balloonEx':
        case 'fuse':
        case 'hakushu': // H: bongo clap applause
        case 'rendaLeft': // I: bongo yellow/left roll
            return true;

        default:
            return false;
    }
}

export function isBalloonType(noteType) {
    switch (noteType) {
        case 'balloon':
        case 'balloonEx':
        case 'fuse':
            return true;

        default:
            return false;
    }
}

function getNotes(data, rollStates, balloon, midx, currentBranch) {
    const notes = [];
    notes.nDivisions = data.length || 1;
    for (let d = 0; d < data.length; ++d) {
        const ch = data.charAt(d);

        let note = {
            symbol: ch,
            type: noteSymbolToNoteType(ch),
            position: d,
        };

        if (isRollType(note.type)) {
            if (rollStates.roll[currentBranch] !== null)
                continue;
            rollStates.roll[currentBranch] = {note: note, midx: midx, didx: notes.length};

            if (isBalloonType(note.type)) {
                const balloonBranch = (balloon.type === 0) ? 'all' : currentBranch;
                note.count = balloon[balloonBranch][rollStates.balloonOffset[balloonBranch]++];
                if (note.count === undefined)
                    note.count = 0;
            }
        } else if (note.type !== 'blank' && rollStates.roll[currentBranch] !== null) {
            let noteEnd = {
                symbol: (ch == '8') ? ch : null,
                type: (ch == '8') ? 'end' : 'endForced',
                position: d,
                start: rollStates.roll[currentBranch],
            };
            rollStates.roll[currentBranch].note.end = {note: noteEnd, midx: midx, didx: notes.length};
            notes.push(noteEnd);
            rollStates.roll[currentBranch] = null;
        }

        if (note.type !== null && note.type !== 'blank')
            notes.push(note);
    }
    return notes;
}

function parseLine(line) {
    const HEADER_GLOBAL = [
        'TITLE',
        'SUBTITLE',
        'BPM',
        'WAVE',
        'OFFSET',
        'DEMOSTART',
        'GENRE',
        'MAKER',
		'FONT',
		'SPROLL',
		'LEVELCOLOR',
		'LEVELURA',
		'TITLECOLOR',
    ];

    const HEADER_COURSE = [
        'COURSE',
        'STYLE',
        'LEVEL',
        'BALLOON',
		'BALLOONNOR',
		'BALLOONEXP',
		'BALLOONMAS',
        'SCOREINIT',
        'SCOREDIFF',
        'NOTESDESIGNER0',
        'NOTESDESIGNER1',
        'NOTESDESIGNER2',
        'NOTESDESIGNER3',
        'NOTESDESIGNER4',
        'TTROWBEAT',
    ];

    const COMMAND = [
        'START',
        'END',
        'GOGOSTART',
        'GOGOEND',
        'MEASURE',
        'SCROLL',
        'BPMCHANGE',
        'DELAY',
        'BRANCHSTART',
        'BRANCHEND',
        'SECTION',
        'N',
        'E',
        'M',
        'LEVELHOLD',
        'BMSCROLL',
        'HBSCROLL',
        'BARLINEOFF',
        'BARLINEON',

        'TTBREAK',
		'NEWLINE',
		'MOVEEVENT',
		'COUNTCHANGE',
		'AVOIDTEXTOFF',
		'AVOIDTEXTON',
		'MOVELINE',
    ];

    let match;

    // comment
    if (match = line.match(/\/\/.*/))
        line = line.substr(0, match.index).trim();

    // header
    if (match = line.match(/^([A-Z0-9]+):(.+)/i)) {
        const nameUpper = match[1].toUpperCase();
        const value = match[2];

        if (HEADER_GLOBAL.includes(nameUpper)) {
            return {
                type: 'header',
                scope: 'global',
                name: nameUpper,
                value: value.trim(),
            };
        }
        else if (HEADER_COURSE.includes(nameUpper)) {
            return {
                type: 'header',
                scope: 'course',
                name: nameUpper,
                value: value.trim(),
            };
        }
    }
    // command
    else if (match = line.match(/^#([A-Z]+)(?:\s+(.+))?/i)) {
        const nameUpper = match[1].toUpperCase();
        const value = match[2] || '';

        if (COMMAND.includes(nameUpper)) {
            return {
                type: 'command',
                name: nameUpper,
                value: value.trim(),
            };
        }
    }
    // data
    else if (match = line.match(/^(([0-9]|A|B|C|D|F|G|H|I)+,?|,)$/)) {
        const data = match[1];

        return {
            type: 'data',
            data: data,
        };
    }

    return {
        type: 'unknown',
        value: line,
    };
}

function getCourse(tjaHeaders, lines) {
    const defaultCourseHeaders = tjaHeaders.courseHeaders[undefined];
    const latestCourseHeaders = tjaHeaders.latestCourseHeaders;
    let courseHeaders = tjaHeaders.courseHeaders[latestCourseHeaders.course];
    const headers = {};

    function setHeaderValue(header, value) {
        latestCourseHeaders[header] = courseHeaders[header] = headers[header] = value;
    }

    function setHeaderBalloon(branch, value) {
        if (headers.balloon === undefined)
            headers.balloon = {'N': [], 'E': [], 'M': [], all: [], type: 0};
        headers.balloon[branch] = value;
        switch (branch) {
            case 'N': case 'E': case 'M':
                headers.balloon.type = 1;
        }
    }

    function deepCopyBalloonData(data) {
        const res = {...data};
        for (let branch of ['N', 'E', 'M', 'all']) {
            res[branch] = [...res[branch]];
        }
        return res;
    }

    function initBalloonHeader() {
        if (headers.balloon !== undefined) {
            latestCourseHeaders.balloon = courseHeaders.balloon = deepCopyBalloonData(headers.balloon);
            return;
        }
        if (courseHeaders.balloon !== undefined) {
            headers.balloon = deepCopyBalloonData(courseHeaders.balloon);
            return;
        }
        if (latestCourseHeaders.balloon !== undefined) {
            // TODO: warn apparent cross-course header fallback
            // No cross-course header fallbacks
        }
        headers.balloon = deepCopyBalloonData(defaultCourseHeaders.balloon);
    }

    const measures = [];

    // Process lines
    let hasStarted = false;
    let measureProperties = {}, measureData = '', measureEvents = [];
    let currentBranch = 'N';
    let targetBranch = 'N';
    let flagLevelhold = false;
	let branching = false;
	let midxBranchPoint = 0;
	let nBranchMeasures = 0;
	let nBranchMeasuresMax = 0;
	let rollStates = {
		balloonOffset: {N: 0, E: 0, M: 0, all: 0},
		roll: {N: null, E: null, M: null},
	};
	let currentScroll = {N: '1', E: '1', M: '1'};

    function getMeasure(midx) {
        while (midx >= measures.length) {
            let measure = {
                length: null,
                lengthNotes: null,
                properties: {},
                data: {N: null, E: null, M: null},
                events: [],
                nDivisions: 1,
                dataBranches: [],
            };
            measures.push(measure);
        }
        return measures[midx];
    }

    function pushMeasure() {
        let midx = midxBranchPoint + nBranchMeasures++;
        getMeasure(midx).data[currentBranch] = getNotes(measureData, rollStates, headers.balloon, midx, currentBranch);
        measureData = '';
    }
	
    for (const line of lines) {
		let balloons;
        if (line.type === 'header') {
            switch (line.name) {
                case 'COURSE':
                    const course = parseCourseValue(line.value);
                    if (course !== null) {
                        // switch parsed course
                        if (tjaHeaders.courseHeaders[course] === undefined) {
                            courseHeaders = tjaHeaders.courseHeaders[course] = {};
                        }
                        setHeaderValue('course', course);
                    }
                    break;

                case 'STYLE':
                    const style = parseStyleValue(line.value);
                    if (style !== null) {
                        setHeaderValue('style', style);
                    }
                    break;

                case 'LEVEL':
                    setHeaderValue('level', parseInt(line.value, 10));
                    break;

                case 'BALLOON':
                    if (hasStarted) {
                        // TODO: warn post-#START BALLOON commands
                        break;
                    }
                    balloons = line.value
                        .split(/[^0-9]/)
                        .filter(b => b !== '')
                        .map(b => parseInt(b, 10));
                    setHeaderBalloon('all', balloons);
                    break;

				case 'BALLOONNOR':
					if (hasStarted) {
						// TODO: warn post-#START BALLOON commands
						break;
					}
                    balloons = line.value
                        .split(/[^0-9]/)
                        .filter(b => b !== '')
                        .map(b => parseInt(b, 10));
                    setHeaderBalloon('N', balloons);
                    break;

				case 'BALLOONEXP':
					if (hasStarted) {
						// TODO: warn post-#START BALLOON commands
						break;
					}
                    balloons = line.value
                        .split(/[^0-9]/)
                        .filter(b => b !== '')
                        .map(b => parseInt(b, 10));
                    setHeaderBalloon('E', balloons);
                    break;

				case 'BALLOONMAS':
					if (hasStarted) {
						// TODO: warn post-#START BALLOON commands
						break;
					}
                    balloons = line.value
                        .split(/[^0-9]/)
                        .filter(b => b !== '')
                        .map(b => parseInt(b, 10));
                    setHeaderBalloon('M', balloons);
                    break;

                case 'SCOREINIT':
					let inits = line.value
                        .split(/[^0-9]/)
                        .filter(b => b !== '')
                        .map(b => parseInt(b, 10));
					
					if (inits.length === 1) {
						setHeaderValue('scoreInit', inits[0]);
						setHeaderValue('scoreShin', null);
					}
					else if (inits.length >= 2){
						setHeaderValue('scoreInit', inits[0]);
						setHeaderValue('scoreShin', inits[1]);
					}
                    //headers.scoreInit = parseInt(line.value, 10);
                    break;

                case 'SCOREDIFF':
                    setHeaderValue('scoreDiff', parseInt(line.value, 10));
                    break;

                case 'NOTESDESIGNER0':
                case 'NOTESDESIGNER1':
                case 'NOTESDESIGNER2':
                case 'NOTESDESIGNER3':
                case 'NOTESDESIGNER4': 
                    setHeaderValue('maker', line.value);
                    break; 

                case 'TTROWBEAT':
                    setHeaderValue('ttRowBeat', parseInt(line.value, 10));
                    break;

            }
        }
        else if (line.type === 'command') {
            if (!hasStarted && line.name !== 'END') {
                hasStarted = true;
                initBalloonHeader();
            }
            const currentMeasure = getMeasure(midxBranchPoint + nBranchMeasures);
            switch (line.name) {
                case 'BRANCHSTART':
					/*
                    if (flagLevelhold) {
                        break;
                    }
                    let values = line.value.split(',');
                    if (values[0] === 'r') {
                        if (values.length >= 3) targetBranch = 'M';
                        else if (values.length === 2) targetBranch = 'E';
                        else targetBranch = 'N';
                    }
                    else if (values[0] === 'p') {
                        if (values.length >= 3 && parseFloat(values[2]) <= 100) targetBranch = 'M';
                        else if (values.length >= 2 && parseFloat(values[1]) <= 100) targetBranch = 'E';
                        else targetBranch = 'N';
                    }
					*/
					branching = true;
					currentBranch = 'N';
					if (nBranchMeasures > nBranchMeasuresMax)
						nBranchMeasuresMax = nBranchMeasures;
					midxBranchPoint = midxBranchPoint + nBranchMeasuresMax;
					nBranchMeasuresMax = nBranchMeasures = 0;

					currentMeasure.events.push({
						name: 'branchStart',
						position: measureData.length,
						branch: currentBranch,
					});
                    break;

                case 'BRANCHEND':
                    branching = false;
                    currentBranch = 'N';
					if (nBranchMeasures > nBranchMeasuresMax)
						nBranchMeasuresMax = nBranchMeasures;
					midxBranchPoint = midxBranchPoint + nBranchMeasuresMax;
					nBranchMeasuresMax = nBranchMeasures = 0;

					currentMeasure.events.push({
						name: 'branchEnd',
						position: measureData.length,
						branch: currentBranch,
					});
                    break;

                case 'N':
                case 'E':
                case 'M':
                    currentBranch = line.name;
					if (branching) {
						if (nBranchMeasures > nBranchMeasuresMax)
							nBranchMeasuresMax = nBranchMeasures;
						nBranchMeasures = 0;
					}
                    break;

                case 'START':
                    let matchStartPlayer = line.value.match(/P(\d+)/);
                    if (matchStartPlayer) {
                        let startPlayer = parseInt(matchStartPlayer[1], 10);
                        if (startPlayer > 0) {
                            headers.startPlayer = startPlayer; // not a header but stored as such
                        }
                    }
                    break;

                case 'END':
                    hasStarted = false;
                    break;

                default:
                    switch (line.name) {
                        case 'MEASURE':
							let divs = line.value.replace(/,$/, '').split(',');
							if (divs.length === 0 || divs.length > 2)
								break;

							let div = divs[0].split('/').map(s => s.trim());
							if (!(div.length === 2 && div[0] && !isNaN(div[0]) && div[1] && !isNaN(div[1])))
								break;
							let measureDividend = parseFloat(div[0], 10);
							let measureDivisor = parseFloat(div[1], 10);
							if (!isFinite(measureDividend / measureDivisor))
								break;

							let measureDividendNotes;
							let measureDivisorNotes;
							if (divs[1] === undefined) {
								measureDividendNotes = measureDividend;
								measureDivisorNotes = measureDivisor;
							} else {
								let divNote = divs[1].split('/').map(s => s.trim());
								if (!(divNote.length === 2 && divNote[0] && !isNaN(divNote[0]) && divNote[1] && !isNaN(divNote[1])))
									break;
								measureDividendNotes = parseFloat(divNote[0], 10);
								measureDivisorNotes = parseFloat(divNote[1], 10);
								if (!isFinite(measureDividendNotes / measureDivisorNotes))
									break;
							}

							currentMeasure.length = [measureDividend, measureDivisor];
							currentMeasure.lengthNotes = [measureDividendNotes, measureDivisorNotes];
                            break;

                        case 'GOGOSTART':
                            currentMeasure.events.push({
                                name: 'gogoStart',
                                position: measureData.length,
								branch: currentBranch,
                            });
                            break;

                        case 'GOGOEND':
                            currentMeasure.events.push({
                                name: 'gogoEnd',
                                position: measureData.length,
								branch: currentBranch,
                            });
                            break;

                        case 'BARLINEON':
                            currentMeasure.events.push({
                                name: 'barlineon',
                                position: measureData.length,
								branch: currentBranch,
                            });
                            break;

                        case 'BARLINEOFF':
                            currentMeasure.events.push({
                                name: 'barlineoff',
                                position: measureData.length,
								branch: currentBranch,
                            });
                            break;

                        case 'SCROLL':
							currentMeasure.events.push({
								name: 'scroll',
								position: measureData.length,
								value: line.value,
								branch: currentBranch,
							});
							for (let bt of (branching ? [currentBranch] : ['N', 'E', 'M']))
								currentScroll[bt] = line.value;

                            break;

                        case 'BPMCHANGE':
                            currentMeasure.events.push({
                                name: 'bpm',
                                position: measureData.length,
                                value: line.value,
								branch: currentBranch,
                            });
                            break;

						case 'MOVEEVENT':
                            currentMeasure.events.push({
                                name: 'moveEvent',
                                position: measureData.length,
                                value: parseInt(line.value),
								branch: currentBranch,
                            });
                            break;

						case 'COUNTCHANGE':
                            currentMeasure.events.push({
                                name: 'countChange',
                                position: measureData.length,
                                value: parseInt(line.value),
								branch: currentBranch,
                            });
                            break;

                        case 'AVOIDTEXTON':
                            currentMeasure.events.push({
                                name: 'avoidtexton',
                                position: measureData.length,
								branch: currentBranch,
                            });
                            break;

                        case 'AVOIDTEXTOFF':
                            currentMeasure.events.push({
                                name: 'avoidtextoff',
                                position: measureData.length,
								branch: currentBranch,
                            });
                            break;

						case 'DELAY':
                            currentMeasure.properties['delay'] = parseFloat(line.value);
                            break;

						case 'SECTION':
                            currentMeasure.events.push({
                                name: 'section',
                                position: measureData.length,
								branch: currentBranch,
                            });
                            break;

						case 'MOVELINE':
							currentMeasure.properties['moveLine'] = parseInt(line.value);
							break;

                        case 'TTBREAK':
						case 'NEWLINE':
                            currentMeasure.properties['ttBreak'] = true;
                            break;

						/*
                        case 'LEVELHOLD':
                            flagLevelhold = true;
						*/
                    }
            }
        }
        //else if (line.type === 'data' && currentBranch === targetBranch) {
		else if (line.type === 'data') {
            if (!hasStarted) {
                hasStarted = true;
                initBalloonHeader();
            }
            let data = line.data;
            if (data.endsWith(',')) {
				measureData += data.slice(0, -1);
				pushMeasure();
            }
            else measureData += data;
        }
    }

    // handle notes past the last `,`
    if (measureData) {
        pushMeasure();
    }

    for (let bt of ['N', 'E', 'M']) {
        if (rollStates.roll[bt] !== null) {
            // TODO: warn unended roll
        }
    }

    if (measures.length) {
        // Make first BPM event
        let firstBPMEventFound = false;

        for (let i = 0; i < measures[0].events.length; i++) {
            const evt = measures[0].events[i];

            if (evt.name === 'bpm' && evt.position === 0) {
                firstBPMEventFound = true;
                break;
            }
        }

        if (!firstBPMEventFound) {
            measures[0].events.unshift({
                name: 'bpm',
                position: 0,
                value: tjaHeaders.bpm,
            });
        }
    }

	// After
	for (let i = 0; i < measures.length; i++) {
		// Calculate MEASURE progressively in case some measures were skipped
		if (measures[i].length === null)
			measures[i].length = (i > 0) ? measures[i - 1].length : [4, 4];
		if (measures[i].lengthNotes === null)
			measures[i].lengthNotes = (i > 0) ? measures[i - 1].lengthNotes : [4, 4];

		// Add Zero
		let lengths = [];
		const branchs = ['N','E','M'];
		
		for (let b of branchs) {
			if (measures[i].data[b] != null) {
				lengths.push(measures[i].data[b].nDivisions);
				measures[i].dataBranches.push(b);
			}
		}

		const fixedMax = measures[i].nDivisions = arrayLCM(lengths);
		
		for (let j = 0; j < measures[i].events.length; j++) {
			if (measures[i].data[measures[i].events[j].branch] != null) {
				const rate = fixedMax / measures[i].data[measures[i].events[j].branch].nDivisions;
				measures[i].events[j].position = measures[i].events[j].position * rate;
			}
		}
		
		for (let b of branchs) {
			if (measures[i].data[b] != null) {
				addZero(measures[i].data[b], fixedMax);
			}
		}
		
		// Merge HS Event
		let canDelete = [];
		for (let j = 0; j < measures[i].events.length; j++) {
			if (measures[i].events[j].name === 'scroll') {
				let newValue = {N:null, E:null, M:null};
				newValue[measures[i].events[j].branch] = measures[i].events[j].value;
				
				for (let k = j + 1; k < measures[i].events.length; k++) {
					if (measures[i].events[k].name === 'scroll' && measures[i].events[j].position === measures[i].events[k].position) {
						newValue[measures[i].events[k].branch] = measures[i].events[k].value;
						canDelete.push(k);
					}
				}
				
				measures[i].events[j].value = newValue;
			}
		}
		
		for (let cd of canDelete.reverse()) {
			measures[i].events.splice(cd, 1);
		}
	}

    // handle events past the last `,` without notes
    if (measures.length !== 0) {
        const measure = measures[measures.length - 1];
        if (measure.dataBranches.length === 0) {
            if (measure.events.length === 0) { // no events; can simply remove
                measures.pop();
            } else if (measures.length > 1) { // move to the back of the previous measure
                measures.pop();
                const lastMeasure = measures[measures.length - 1];
                for (let event of measure.events) {
                    event.position = lastMeasure.nDivisions;
                    lastMeasure.events.push(event);
                }
            } else { // add blank measure data
                measure.data['N'] = getNotes(''); // other arguments unused
            }
        }
    }

    // Output
    //console.log(measures[measures.length - 1])

    if (!hasStarted) {
        initBalloonHeader();
    }

    // handle header value fallbacks
    for (let header in defaultCourseHeaders) {
        if (header === 'balloon') {
            continue;
        }
        if (headers[header] !== undefined) {
            continue;
        }
        if (courseHeaders[header] !== undefined) {
            headers[header] = courseHeaders[header];
            continue;
        }
        if (latestCourseHeaders[header] !== undefined) {
            // TODO: warn apparent cross-course header fallback
            // No cross-course header fallbacks
        }
        headers[header] = defaultCourseHeaders[header];
    }

    return { headers, measures };
}

export default function parseTJA(tja) {
    // Split by lines
    const lines = tja.split(/(\r\n|\r|\n)/)
        .map(line => line.trim());

    const headers = {
        // global-fineness headers
        title: '',
        subtitle: '',
        bpm: 120,
        wave: '',
        offset: 0,
        demoStart: 0,
        genre: '',
        maker: null,
		font: 'donscore',
		spRoll: 'kusudama',
		levelColor: 0,
		levelUra: 0,
		titleColor: 0,

        // local-fineness headers
        courseHeaders: [],
        latestCourseHeaders: {},
    };

    // for initial parsed course-fineness headers
    headers.courseHeaders[undefined] = {
        course: 3,
        style: 1,
        startPlayer: 1,
        level: 0,
        balloon: {'N':[],'E':[],'M':[], all: [], type: 0},
        scoreInit: 0,
        scoreDiff: 0,
		scoreShin: null,
        maker: null,
        ttRowBeat: 16,
    };

    const courses = [];

    // Line by line
    let idx;
    let courseLines = [];

    // parse states
    let hasStarted = false;
    let hasData = false;

    function pushCourse() {
        if (courseLines.length) {
            if (!hasStarted) {
                // TODO: emit straying-#END warning
            }
            hasStarted = false;

            // process anyway to update global headers
            const course = getCourse(headers, courseLines);

            if (hasData) {
                hasData = false;
                courses.push(course);
            }
            courseLines = [];
        }
    }


    for (idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        if (line === '') continue;

        const parsed = parseLine(line);

        if (parsed.type === 'header' && parsed.scope === 'global') {
            switch (parsed.name) {
                case 'TITLE':
                    headers.title = parsed.value;
                    break;

                case 'SUBTITLE':
                    headers.subtitle = parsed.value.replace(/^(\+\+|--)/, '');
                    break;

                case 'BPM':
                    headers.bpm = parsed.value;
                    break;

                case 'WAVE':
                    headers.wave = parsed.value;
                    break;

                case 'OFFSET':
                    headers.offset = parseFloat(parsed.value);
                    break;

                case 'DEMOSTART':
                    headers.demoStart = parseFloat(parsed.value);
                    break;

                case 'GENRE':
                    headers.genre = parsed.value;
                    break;

                case 'MAKER':
                    headers.maker = parsed.value;
                    break;
				
				case 'FONT':
                    headers.font = parsed.value;
                    break;
				
				case 'SPROLL':
                    headers.spRoll = parsed.value.toLowerCase();
                    break;
				
				case 'LEVELCOLOR':
                    headers.levelColor = parseInt(parsed.value, 10);
					if (isNaN(headers.levelColor)) {
						headers.levelColor = 0;
					}
                    break;
				
				case 'LEVELURA':
                    headers.levelUra = parseInt(parsed.value, 10);
					if (isNaN(headers.levelUra)) {
						headers.levelUra = 0;
					}
                    break;
				
				case 'TITLECOLOR':
                    headers.titleColor = parseInt(parsed.value, 10);
					if (isNaN(headers.titleColor)) {
						headers.titleColor = 0;
					}
                    break;
            }
        }
        else if (parsed.type === 'header' && parsed.scope === 'course') {
            if ((parsed.name === 'COURSE' || parsed.name === 'STYLE') && hasStarted) {
                // TODO: emit missing-#END warning
                pushCourse();
                hasStarted = false;
            }
            courseLines.push(parsed);
        }
        else if (parsed.type === 'command') {
            if (parsed.name === 'START') {
                hasStarted = true;
            }
            courseLines.push(parsed);

            if (parsed.name === 'END') {
                pushCourse();
            }
        }
        else if (parsed.type === 'data') {
            if (!hasStarted) {
                // TODO: emit missing-#START warning
                hasStarted = true;
            }
            courseLines.push(parsed);
            hasData = true;
        }
    }

    pushCourse();

    // Return
	console.log(courses);
    return { headers, courses };
}

export function getCourseLines(tja, courseId) {
	let result = [];
	let write = false;
	
	const lines = tja.split(/(\r\n|\r|\n)/)
        .map(line => line.trim());
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
        if (line === '') continue;
		
		const parsed = parseLine(line);
		
		if (parsed.type === 'header' && parsed.scope === 'global') {
			result.push(line);
		}
		else if (parsed.type === 'header' && parsed.scope === 'course') {
			if (parsed.name === 'COURSE') {
				const courseValue = parsed.value.toLowerCase();
				let course;
				
				switch (courseValue) {
					case 'easy': case '0':
						course = 0;
						break;

					case 'normal': case '1':
						course = 1;
						break;

					case 'hard': case '2':
						course = 2;
						break;

					case 'oni': case '3':
						course = 3;
						break;

					case 'edit': case 'ura': case '4':
						course = 4;
						break;
				}
				
				write = (course === parseInt(courseId)) ? true : false;
			}
			if (write) {
				result.push(line);
			}
		}
		else if (parsed.type === 'command') {
			if (write) {
				result.push(line);
			}
        }
		else if (parsed.type === 'data') {
			if (write) {
				result.push(line);
			}
        }
	}
	
	return result.join('\n');
}

export function getEnabledBranch(chart, courseId) {
	const branchTypes = ['N','E','M'];
	let result = [];
	const course = chart.courses[courseId];
	if (course === undefined)
		return result;
	
	for (let bt of branchTypes) {
		let enabled = false;
		for (let m of course.measures) {
			if (m.data[bt] != null) {
				result.push(bt);
				break;
			}
		}
	}
	
	return result;
}
